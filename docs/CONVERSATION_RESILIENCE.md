# Conversation Resilience

How chat turns survive refresh, tab close, internet disconnect, multiple tabs,
and provider failures — and how the UI brings each of them back.

Companion doc to [ARCHITECTURE.md](ARCHITECTURE.md) (system shape) and
[API.md](API.md) (HTTP/SSE contract). The Day 3+4 work in `STAGES.md` §11 was
authored against this spec.

---

## 1. Threat model

The conversation is the unit of value. Every event below MUST leave the user
with a usable conversation on their next visit:

| # | Event | Required outcome |
|---|---|---|
| 1 | User refreshes the browser mid-stream | Conversation reloads with the last completed turns; the in-flight assistant row shows a Retry button (no orphaned "loading forever" placeholder). |
| 2 | User closes the tab mid-stream | Next visit to the same conversation: same as #1. The user row is already persisted, so the user's intent is never lost. |
| 3 | User opens a second tab on the same conversation | Second tab shows the last persisted state. It cannot duplicate the user's message or fabricate AI text. |
| 4 | Internet drops mid-stream | Server persists the partial answer with `status='interrupted'`. The offline banner explains why the UI is "stuck". When the network returns, the user can Retry. |
| 5 | Provider errors out (timeout, 5xx, refused connection) | Server persists the partial answer with `status='failed'` and an internal `errorMessage`. The client gets a generic, non-leaky message. Retry produces a fresh assistant row. |
| 6 | User hits Stop (abort) | Same as #4 — `status='interrupted'`. No error event is emitted (the disconnector can't receive it anyway). |
| 7 | User double-clicks Send | The second click is rejected (`streaming.value === true` guard on the client). |
| 8 | Network blip causes the same POST to retry | Backend recognizes the idempotency key, reuses the user row, streams a fresh assistant. No duplicate user bubble. |

---

## 2. Persistence is the source of truth

PostgreSQL holds the entire conversation. The frontend NEVER invents a
message — every bubble on screen was either:

- just emitted by the server (live stream), or
- read back from `GET /conversations/:id` (refresh, retry, tab switch).

Implication: there is no purely-client "draft" or "placeholder" row that
can drift from the server. The streaming placeholder in the UI is a Vue
ref tagged with a sentinel id (`__streaming__`); it is replaced by the
real row as soon as the `meta` event lands and is purged entirely on
done/error.

---

## 3. Assistant message state machine

The `messages.status` column is a small enum on the assistant role:

```
       ┌──────────┐
       │ pending  │  pre-persisted, AI not started yet (DB row exists)
       └────┬─────┘
            │ first AI delta arrives (in-memory flip on the server)
            ▼
       ┌──────────┐
       │ streaming│  AI is producing bytes (in-memory on the server)
       └────┬─────┘
            │
   ┌────────┼─────────────────────┐
   ▼        ▼                     ▼
┌────────┐ ┌──────────┐    ┌──────────┐
│completed│ │interrupted│    │ failed   │
└────────┘ └──────────┘    └──────────┘
  success    client gone     provider / network
             (no error        failure (error event
              event)          with generic message)
```

`pending` is written **before** the SSE `meta` event is emitted — a reload
between the POST and the first delta still finds the row.

`streaming` is flipped in memory on the first delta (and on the
`streamingRow.status` in the client). It is **not** persisted on every
chunk — only at terminal transitions. The live bytes in flight are the
SSE deltas, not the DB.

`interrupted` vs `failed` is a meaningful distinction (see §5).

User rows always have `status = null`.

---

## 4. Idempotency

The client generates an opaque token (`cm-<base36 ts>-<rand>`, ≤ 64 chars)
and sends it in the body as `clientMessageId`, mirrored to the
`Idempotency-Key` HTTP header for proxies and replay logs.

The backend's contract:

| Case | Behavior |
|---|---|
| No `clientMessageId` provided | New user row, normal flow. |
| `clientMessageId` provided, no row matches in this conversation | New user row with `client_message_id = <token>`. |
| `clientMessageId` matches an existing user row, **content matches** | Reuse the user row; create a fresh assistant row; emit `replay: true` in `meta`. |
| `clientMessageId` matches an existing user row, **content differs** | `400 این پیام قبلاً با متن دیگری ارسال شده است.` (caught in pre-flight, before SSE headers open). |

The matching index is `(conversationId, role='user', clientMessageId)`.
Composite key on the column, not unique constraint — the same token is
allowed across conversations.

**Idempotency is the only mechanism that prevents double-send.** It is
intentionally simple: there is no Redis, no queue, no replay log. The
backend resolves the collision by looking at the conversation's own
message rows.

---

## 5. Disconnect vs failure disambiguation

Both surface as "the stream ended without a `done` event". The client
must be able to tell them apart so a user who clicked Stop doesn't see
an error toast that suggests the provider is down.

```
                  ┌──────────────────────────────┐
stream loop       │  for-await delta from AI     │
                  └─────────────┬────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │ isClientDisconnected()?       │
                └──┬─────────────────────────┬──┘
                   │ yes                     │ no
                   ▼                         ▼
        ┌──────────────────────┐    ┌────────────────────────┐
        │ status = 'interrupted'│    │ status = 'completed'   │
        │ no error event         │    │ emit 'done' event      │
        └──────────────────────┘    └────────────────────────┘

catch (error):
                ┌───────────────────────────────┐
                │ isClientDisconnected()?       │
                └──┬─────────────────────────┬──┘
                   │ yes                     │ no
                   ▼                         ▼
        ┌──────────────────────┐    ┌──────────────────────────┐
        │ status = 'interrupted'│    │ status = 'failed'        │
        │ no error event         │    │ emit 'error' event with  │
        │                        │    │ generic client message;  │
        │                        │    │ store raw detail in      │
        │                        │    │ errorMessage             │
        └──────────────────────┘    └──────────────────────────┘
```

Both `AbortError`s share the same class — `controller.abort()` from the
client and `AbortController` from the provider timeout. Disambiguation
is done by asking `isClientDisconnected()` first.

---

## 6. Pre-persist invariant

`MessagesController.sendMessage` calls `MessagesService.assertChatTurnAllowed`
**before** the SSE headers are flushed. This is the single chokepoint for
all 4xx-class errors:

- 401 (auth — handled by `JwtAuthGuard`)
- 404 unknown/foreign conversation
- 400 inactive model, bad UUID
- 403 model not allowed for the caller's plan
- 400 idempotency collision (same token, different content)

Only after the check passes do we:

1. Flush SSE headers (`200 OK`, `text/event-stream`).
2. Persist the user row.
3. Pre-persist the assistant row with `status='pending'`.
4. Emit the `meta` event (carrying the real `assistantMessage.id`).
5. Stream deltas.

This guarantees that a 4xx never produces an orphan SSE response, and a
successful request always leaves at least one DB row per user message
even if the AI fails to start.

---

## 7. Frontend UX mapping

| DB status | Component rendering | User affordance |
|---|---|---|
| `null` (user row) | Soft accent block, `dir="auto"` | none (read-only history) |
| `pending` / `streaming` (no live deltas — refreshed mid-stream) | Muted in-progress text + animated dots (`aria-live="polite"`) | Retry button (defensive; usually the other tab is handling it) |
| `streaming` (live deltas arriving on this tab) | Markdown rendered progressively + caret | Stop button (composer) |
| `completed` | Full markdown body | Copy + Retry (Retry hides once we add regenerate) |
| `interrupted` | Italic muted text + partial content | **Retry** (primary accent, first action) |
| `failed` | Red surface + `errorMessage` | **Retry** (primary accent, first action) |

The Retry button is disabled while another send is in flight
(`streaming.value` is shared across the page). It calls
`send(userRow.content, { clientMessageId: userRow.clientMessageId })`,
which the backend treats as a replay.

---

## 8. Last-opened conversation persistence

The active conversation id is stored in `localStorage` under
`hooshyar.active-conversation` (UUID-validated on read). On mount, the
chat view restores it — but only if it still belongs to the user. A
foreign or deleted id is silently cleared.

This is a UX nicety, not a security boundary. The JWT still gates every
request; the id is just a hint.

---

## 9. Offline banner

`useOnline()` is a singleton composable wrapping `navigator.onLine` and
the `online`/`offline` window events. The signal is a UI HINT — the
browser may report "online" while DNS / captive portals are broken — so
each request still surfaces its own error.

The banner:

- slides in under the chat header (200ms ease-out),
- carries a pulsing red dot,
- is `role="status"` `aria-live="polite"`,
- disappears the instant connectivity returns.

It deliberately does NOT block sending. The user can still hit Send and
the request will surface the same generic error a failed stream would.

---

## 10. Testing approach

| Layer | Tool | What it covers |
|---|---|---|
| Service (`messages.service.spec.ts`) | Jest + mocked repository | Pre-persist, status transitions, idempotency reuse/conflict, replay, one-row-per-turn invariant, rename rules, content/attribution per model. 17 specs. |
| HTTP smoke (`scripts/smoke-test.mjs`) | Node fetch | Full black-box: auth, ownership, plan authorization, model CRUD, **status='failed'**, **meta carries assistantMessage + replay=false**, **clientMessageId reuse**, **Idempotency-Key header**, **content-mismatch → 400**. 75 checks. |
| Live resilience (`scripts/resilience-test.mjs`) | Node fetch + real aborts | Aborts mid-stream, checks `status='interrupted'` + partial content kept; verifies Retry semantics; verifies Idempotency-Key header round-trip. 14 checks. |
| Vite dev server smoke | `curl` against the SPA | Routes mount, ChatView bundle includes the new imports. |
| Frontend | `vue-tsc --noEmit` + production build | Type safety + compile. |

Browser GUI testing is intentionally not yet automated (no runner
available in the dev environment). Manual coverage is documented in
[STAGES.md §11](STAGES.md).

---

## 11. What we deliberately did NOT do

- **No WebSocket** — SSE is enough for one-way streaming.
- **No Redis / BullMQ / queue** — the database is the durable buffer.
- **No optimistic concurrency on the assistant row** — only one tab can
  stream at a time (the `streaming.value` guard). Concurrent writers
  would race; we accept that as a known limitation.
- **No `pending` row cleanup job** — rows stay in `pending` if the
  server crashes mid-stream. A future hardening pass could add a
  periodic job to mark them `interrupted` after a stale threshold.
- **No client-side retry queue for failed sends** — Retry is a
  deliberate user action. We never silently re-send.
- **No separate "regenerate" endpoint** — Retry today creates a new
  assistant row; "regenerate" is the same surface with different copy.
