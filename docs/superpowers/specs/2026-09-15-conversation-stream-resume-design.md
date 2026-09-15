# Conversation Stream Resume — Design

**Date:** 2026-09-15
**Status:** Proposed
**Author:** (brainstorming session)
**Parent spec:** [docs/CONVERSATION_RESILIENCE.md](../../../docs/CONVERSATION_RESILIENCE.md)
**Scope:** Single phase. One feature. New endpoint + new module + small schema migration.

---

## 1. Problem statement

Today, refreshing the browser or reopening a tab mid-stream shows the
persisted partial response with a **Retry** button. The user loses any
in-flight deltas they were about to see and has to consciously click
Retry, which starts a brand-new assistant row.

This spec replaces that UX with a seamless continuation: when a client
loads a conversation whose assistant row is still `status='streaming'`,
it auto-joins the live stream from its last seen event id. The user
sees bytes continuing to arrive as if nothing happened.

**Threat model (from CONVERSATION_RESILIENCE.md §1) updated:**

| # | Event | New behavior |
|---|---|---|
| 1 | Refresh mid-stream | Auto-join live stream from cursor. Bytes continue arriving. No Retry. |
| 2 | Tab close mid-stream | Same as #1 on next visit. |
| 3 | Open a second tab mid-stream | Tab B joins the live stream from its own (lower) cursor. Server fans out the same events to both. |
| 4 | Internet drops mid-stream | LocalStorage holds the cursor. On reconnect, auto-join picks up. |
| 5 | Provider failure | `status='failed'` (terminal). Resume returns 410. Standard Retry UI. |
| 6 | User hits Stop | `status='interrupted'` (terminal). Resume returns 410. Standard Retry UI. |

---

## 2. Approach

**SSE Last-Event-ID resume.** Standard HTTP semantics. No WebSocket,
no Redis, no replay log.

- The server tracks every active stream in memory: a ring buffer of
  recent events (id, name, data), a set of live subscribers, and the
  last issued event id.
- Every event carries an `id:` line so the client (and the server's
  replay logic) can address it.
- A new endpoint `GET /conversations/:id/messages/:messageId/stream`
  accepts an optional `Last-Event-ID` header. If present, the server
  replays buffered events with id > Last-Event-ID then attaches the
  client as a live subscriber.
- The client persists its last seen event id per message in
  `localStorage` (keyed by `hooshyar.lastEventId.<messageId>`). On
  page load, if any assistant row has `status='streaming'`, the chat
  view kicks off a resume subscription automatically.

---

## 3. Architecture

### 3.1 New module: `StreamRegistry`

**Location:** `backend/src/streams/stream-registry.service.ts`

A process-wide singleton keyed by **assistant messageId**. One entry
per active stream:

```ts
interface StreamEntry {
  messageId: string;
  conversationId: string;
  /** Monotonically increasing, starts at 1. */
  nextEventId: number;
  /** Recent events for replay. Bounded ring buffer. */
  buffer: RingBuffer<{ id: number; event: string; data: string }>;
  /** Currently-attached live subscribers. */
  subscribers: Set<Response>;
  /** When this stream is scheduled to be evicted (post-terminal). */
  evictAt: NodeJS.Timeout | null;
}
```

**Public surface:**

| Method | Purpose |
|---|---|
| `register(messageId, conversationId): StreamEntry` | Create entry at stream start. |
| `nextEventId(messageId): { id: number; entry: StreamEntry }` | Atomically allocate the next id. |
| `record(messageId, id, event, data)` | Append to buffer + fan out to subscribers. |
| `subscribe(messageId, response, fromEventId: number): { replayed: number; liveAttached: true }` | Replay buffered events with id > fromEventId, then attach as live. |
| `scheduleEviction(messageId, ms = 60_000)` | On terminal status: clear the entry after 60s. |
| `drop(messageId)` | Immediate drop (used in error paths). |

**Ring buffer:** capacity 1000 events. When full, oldest event is
evicted. If a subscriber's `fromEventId` is older than the oldest
buffered id, the subscribe call sees the buffer has wrapped and the
controller returns 410.

**Memory bound:** O(active streams × 1000 events). At ~500 bytes/event,
that's ~500 KB per active stream. We assume well under 100 concurrent
streams in practice.

### 3.2 New endpoint

```
GET /api/conversations/:conversationId/messages/:messageId/stream
Authorization: Bearer <jwt>
Last-Event-ID: <integer>     (optional)

→ 200 text/event-stream    (live + optional replay; OR terminal replay of the final 'done' event)
→ 410 application/json     (buffer evicted OR terminal with a gap)
→ 401 application/json     (auth)
→ 403 application/json     (not your message)
→ 404 application/json     (message not found)
```

**Replay contract:**

The header value is interpreted as "I have received every event with
id <= Last-Event-ID." The server replays every buffered event with
`id > Last-Event-ID`, then attaches the client as a live subscriber.
Replay is gap-free up to the oldest buffered event id: if
`Last-Event-ID < buffer.oldestEventId - 1`, the next replayable event
has been evicted and the request returns 410 (see below).

**Server flow:**

1. Auth + ownership check (must own the conversation).
2. Load the assistant row by id.
3. If `status` is terminal (completed / interrupted / failed):
   - If the row's `lastEventId` column is null OR
     `Last-Event-ID < row.lastEventId`: return 410 with the row in
     the JSON body.
   - Else (client caught up): return 200 with a single `done` event
     carrying the row, then close the stream. Standard completion
     semantics on the client.
4. If `status` is `streaming` or `pending`:
   - Look up registry entry by messageId.
   - If absent: return 410 with the row (server restarted, buffer
     lost; client sees persisted snapshot + Retry).
   - If `Last-Event-ID` is provided AND the buffer is non-empty AND
     `Last-Event-ID < buffer.oldestEventId - 1`: return 410 with the
     row (gap too large for replay).
   - Else: write replay events (events with id > Last-Event-ID),
     attach as live subscriber, keep connection open.

**Response headers (live + replay):**
```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### 3.3 SSE event wire format

Every event now carries an `id:` line:

```
id: 7
event: delta
data: {"text":"سلام "}

```

The existing event types (`meta`, `delta`, `done`, `error`) are
unchanged. `id:` is purely additive — existing clients ignore it.

### 3.4 DB schema change

Add one column to `messages`:

```sql
ALTER TABLE messages
  ADD COLUMN last_event_id INTEGER NULL;
```

**Write semantics:** updated **only** at terminal transitions (matches
CONVERSATION_RESILIENCE.md §3 — "streaming is NOT persisted on every
chunk"). Set by `MessagesService` alongside `status='completed'` /
`'interrupted'` / `'failed'`.

**Read semantics:** returned by `GET /conversations/:id` so a client
loading a fresh conversation knows the server's view of the final
event id. Useful for clients that lost localStorage and need a
baseline.

### 3.5 Frontend changes

**New function `resumeStreamMessage`** in `frontend/src/api/client.ts`
(mirrors `streamChatMessage`):
- `GET` request, no body.
- `Last-Event-ID` header if known.
- Same event dispatcher; reads `id:` lines alongside `event:` and
  `data:`.
- On `410`: resolves to a structured `{ kind: 'gone', message }` so
  the caller can fall back to the persisted snapshot.

**New composable `useResumeOnLoad`** in
`frontend/src/composables/useResumeOnLoad.ts`:
- Input: the loaded `messages` array (ref) and an `applyDelta` setter
  from the chat view.
- On mount: scan for `status === 'streaming'` assistant rows.
- For each: read `localStorage['hooshyar.lastEventId.<id>']` (if any),
  call `resumeStreamMessage` with that value.
- Pipe `meta` / `delta` / `done` / `error` events into the same
  streaming state machine used by the active send.
- Persist the latest event id on every delta.
- Clear localStorage on `done` / `error`.
- Return a `disposer` that aborts the active subscription when the
  chat view unmounts or the user navigates away.

**ChatView.vue:** call `useResumeOnLoad` after `loadMessages()`
resolves. On conversation switch, abort the prior subscription.

### 3.6 Multi-tab semantics

Two tabs on the same mid-stream conversation:

| Step | Tab A (joined first) | Tab B (joins later) |
|---|---|---|
| Last seen | 38 | 22 (joined earlier in stream) |
| Resume | (no resume — was live) | `Last-Event-ID: 22` |
| Server | Live | Replays 23..42, then attaches live |
| Subsequent deltas | Live | Live |
| `done` event | Received | Received |

Both tabs receive identical event ids. Each tracks its own
lastSeenEventId in localStorage (the values converge naturally as
both see the same events).

The `streaming.value` guard in the composer (existing) still prevents
either tab from initiating a new send while a stream is attached.

---

## 4. Data flow

### 4.1 Refresh mid-stream (happy path)

```
Browser refresh during a stream. Server is at event 50.

1. ChatView mounts.
2. GET /conversations/:id → messages array includes
     assistantRow: { status='streaming', content='<partial>', lastEventId=null }
3. useResumeOnLoad sees status='streaming', reads
     localStorage['hooshyar.lastEventId.<msgId>'] = 38.
4. Opens GET /conversations/:id/messages/:msgId/stream
     with Last-Event-ID: 38.
5. Server:
   - Entry exists. Buffer holds 1..50.
   - Replays events 39..50 to the new subscriber.
   - Attaches as live subscriber.
6. Client dispatches each replayed event:
   - deltas 39..50 are appended to streamingRow.content
     (idempotent — the persisted content already covers 1..38,
     so this just renders the missing bytes).
   - 'streaming' status is confirmed on each.
7. Server emits 51, 52, ... in real time.
   Client keeps appending.
8. Eventually 'done' fires.
   - lastEventId=NN persisted to DB.
   - Buffer scheduled for eviction in 60s.
   - Client clears localStorage entry.
   - streamingRow.status = 'completed'.
```

### 4.2 Buffer evicted (stream terminated long ago)

```
Stream finished 5 minutes ago. Buffer evicted. lastEventId=80.

1. ChatView mounts. Reads status='completed' from GET response.
2. useResumeOnLoad: status is terminal, no resume.
3. Renders the persisted row. Standard completed-message UI.

(Resume path itself:)

1. Client opens GET .../stream with Last-Event-ID: 60.
2. Server: status='completed', lastEventId=80, no buffer.
3. Returns 410 with the row in the body.
4. Client falls back to the existing rendering. No error toast.
```

### 4.3 Server restart

```
Server restarts mid-stream. Buffer gone. Row still 'streaming' in DB.

1. ChatView loads. status='streaming'.
2. Opens resume.
3. Server: row found, status='streaming', no registry entry.
4. Returns 410 with the row (status='streaming', partial content).
5. Client: sees a 'streaming' row with no live deltas.
   Shows the standard "in-progress" UI (CONVERSATION_RESILIENCE.md §7).
   Retry button is available.
```

---

## 5. Error handling

| Failure | Status | Client behavior |
|---|---|---|
| Buffer evicted / gap too large | 410 | Fall back to standard rendering of the persisted row. No error toast. |
| Auth expired | 401 | Same logout flow as today (CONVERSATION_RESILIENCE.md §10). |
| Not your conversation/message | 403 / 404 | Conversation reload. |
| Network error during resume | (transport) | Same generic "ارتباط هنگام دریافت پاسخ قطع شد." toast. The persisted row remains visible. User can Retry. |
| Slow subscriber falls > 1000 events behind | (server closes conn) | Subscriber receives the events it has, then conn closes. Next resume sees 410. |

No silent retry. No client-side retry queue. Matches
CONVERSATION_RESILIENCE.md §11.

---

## 6. Testing

| Layer | Tool | What it covers |
|---|---|---|
| `stream-registry.service.spec.ts` | Jest | Register/record/subscribe, ring buffer eviction at size 1000, multi-subscriber fan-out, scheduleEviction firing after 60s, drop immediate, 410 lookup when no entry. |
| `messages.service.spec.ts` (extend) | Jest | Stream registers on start, deregisters on terminal, `lastEventId` persisted on done/interrupted/failed, NOT persisted on first delta. |
| `messages.controller.spec.ts` (extend or new) | Jest | GET endpoint: 200 + SSE replay, 204 terminal, 410 no-buffer, 410 gap, 401, 403, 404, replay ordering. |
| `scripts/resume-test.mjs` (new) | Node fetch + real aborts | Two concurrent connections receive the same final `done`. Last-Event-ID replay produces no duplicates and no gaps. 410 path. Terminal + 60s eviction verified via stub. |
| Existing `resilience-test.mjs` (extend) | Node fetch | Existing interrupted scenarios still pass; new "refresh mid-stream then auto-join" scenario. |
| `frontend/src/api/client.ts` (extend) | Manual / vite build | resumeStreamMessage dispatches all event types correctly; 410 falls back gracefully. |
| `useResumeOnLoad.spec.ts` (new) | Vitest | Reads localStorage on mount; aborts on unmount; clears localStorage on done. |
| Build | `vue-tsc --noEmit`, `nest build` | Compile clean. |

Browser GUI testing remains manual (no runner available), documented
in `docs/STAGES.md`.

---

## 7. What we deliberately do NOT do

Carried over from CONVERSATION_RESILIENCE.md §11 and added:

- **No optimistic concurrency on the assistant row.** Multiple tabs
  can subscribe but only one new send can be in flight at a time
  (the `streaming.value` guard).
- **No per-delta DB writes.** `lastEventId` is set at terminal only.
- **No Redis / replay log.** The in-memory ring buffer is the entire
  resume surface.
- **No client-side auto-retry on resume failure.** The user sees the
  persisted row + Retry button.
- **No "resume from byte 0" replay.** A fresh subscriber without
  Last-Event-ID attaches live only and relies on the persisted
  snapshot from the GET response.
- **No cross-tab leader election.** Both tabs independently
  subscribe; both receive the same events. The composer is shared.
- **No buffer persistence across server restarts.** Restart = 410 for
  anyone mid-resume. The `pending` row cleanup gap remains.

---

## 8. Rollout & migration

1. **Schema migration:** additive `last_event_id` column. Safe to
   deploy before code; the column is `NULL` for all existing rows.
2. **Backend deploy:** `StreamRegistry` module ships; `writeEvent`
   emits `id:` lines; new GET endpoint live. Existing POST flow
   unchanged.
3. **Frontend deploy:** `resumeStreamMessage` + `useResumeOnLoad` ship
   together. ChatView wires them. No flag flip needed — the auto-join
   is silent and falls back gracefully if the server hasn't shipped
   yet (just shows the existing Retry UI).
4. **No DB backfill.** `last_event_id` populates on the next terminal
   transition for each row.

---

## 9. Decisions on previously-open questions

(Decisions taken when the user said "continue" without explicit
answers on these; documented here for traceability.)

1. **`messages.last_event_id` column:** **Kept.** Used for the 410
   path's freshness check and as a "server's view of head" returned
   in `GET /conversations/:id`. Set at terminal only. Dropping the
   column would force the 410 path to read `createdAt` and
   `content.length` heuristics — less precise.

2. **Replay + live in one stream:** **Yes, single continuous
   stream.** The server writes replay events first, then continues
   with live. Same wire format, same event types, same parser. Two
   blocks would force the client to handle a "replay done" marker.

3. **Backpressure:** **Ring buffer drops oldest; subscriber falls
   behind → 410 on next resume.** No synthetic `interrupted` event.
   Keeps the resume protocol simple.
