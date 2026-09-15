# API Reference

Base URL: `http://localhost:4000/api` (through the Vite dev proxy: `/api` on port 5200).

All routes require `Authorization: Bearer <token>` **except** the two marked public.
Validation errors return `400` with `{ "message": string | string[] }`.
Ownership violations return `404` (resource hidden, not forbidden).

## Auth (public)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | 201 `{ accessToken, user }`; 409 duplicate email; password ≥ 8 chars |
| POST | `/auth/login` | `{ email, password }` | 200 `{ accessToken, user }`; 401 same message for unknown email / wrong password |

JWT payload: `{ sub: userId, email, role }`, expires in `JWT_EXPIRES_IN` (default 1d).

## Conversations

| Method | Path | Notes |
|---|---|---|
| GET | `/conversations` | caller's conversations, newest first |
| POST | `/conversations` | body `{ title? }` (empty body allowed → «گفتگوی جدید») |
| GET | `/conversations/:conversationId` | `{ conversation, messages }` (messages oldest first) |

## Messages (streaming)

`POST /conversations/:conversationId/messages` — body `{ content, modelId?, clientMessageId? }`

- `content` must be non-blank, ≤ 4000 chars (validated at the boundary)
- `modelId` optional; must reference a model that is **active** (and **free** for FREE-plan
  callers) — otherwise the default model is used. Authorization is re-checked on every send
  against current backend state; the frontend is never trusted (403 for a premium model
  requested by a FREE user, even via direct API calls).
- `clientMessageId` optional; opaque client-generated token (≤ 64 chars) used for idempotency.
  The same value may also be sent as the `Idempotency-Key` HTTP header — both are accepted,
  the header is just a convenience for proxies and replay logs.

### Pre-flight

All 4xx-class errors (auth, ownership, plan, model state, **idempotency content collision**)
are caught by `MessagesService.assertChatTurnAllowed` **before** the SSE headers are
flushed. The frontend never sees an orphan SSE response carrying a JSON error.

| Failure | Status | Body |
|---|---|---|
| Unknown / foreign conversation | 404 | `{ message }` |
| Unknown model id | 404 | `{ message }` |
| Inactive model | 400 | `{ message }` |
| Model not allowed for caller's plan | 403 | `{ message }` |
| `clientMessageId` matches an existing user row whose `content` differs | 400 | `{ message: "این پیام قبلاً با متن دیگری ارسال شده است." }` |

### Success — 200 `text/event-stream`

Exactly one assistant message row is persisted per turn in every outcome, including failure.
The order of events on a normal run:

```
event: meta
data: {
  "userMessage":      { id, role: "user", content, status: null, ... },
  "assistantMessage": { id, role: "assistant", content: "", status: "pending", ... },
  "model":            { id, name, provider },
  "replay":           false
}

event: delta
data: { "text": "chunk" }     // repeated as the provider streams

event: done
data: { "assistantMessage": { status: "completed", content, ... } }
```

`meta` carries the real `assistantMessage.id` so the client can swap its placeholder for
the persisted row immediately (no race between optimistic UI and DB state).

### Replay

A `clientMessageId` that matches an existing user row **with the same content** is treated
as a retry: the existing user row is reused (no duplicate), a **fresh** assistant row is
created, and `meta.replay = true`. The body of the request must match the original
character-for-character; see the `400` row above for the mismatch path.

### Failure paths

Provider error (timeout, 5xx, refused connection). Partial content is persisted with
`status: "failed"` and a server-side `errorMessage`. The client receives a non-leaky
generic message:

```
event: error
data: { "message": "سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید." }
```

Client disconnect (browser tab closed, network dropped, Stop button). **No `error`
event is emitted** — the disconnector cannot receive it. The server persists the partial
answer with `status: "interrupted"` and no `errorMessage`. The next `GET` on the
conversation surfaces the row as a Retry target.

The full state machine and disambiguation rules live in
[CONVERSATION_RESILIENCE.md](CONVERSATION_RESILIENCE.md).

### Message shape

```ts
type MessageStatus = 'pending' | 'streaming' | 'completed' | 'interrupted' | 'failed';

interface Message {
  id: string;                  // uuid
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus | null;  // null on user rows
  errorMessage: string | null;   // server-side detail, never leaked to client
  modelId: string | null;
  clientMessageId: string | null; // user rows only
  createdAt: string;             // ISO
}
```

## Models (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/models` | models the **caller's plan** may use — currently **active AND free** (the plan-filtered list for the chat picker; never the full catalog) |

## Admin models (`role=admin` only)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/models` | all models; `apiKey` never returned, `hasApiKey` instead |
| POST | `/admin/models` | `{ name, provider: 'mock'\|'openai-compatible', externalModelId, baseUrl?, apiKey?, isActive?, isFree? }`; the first active+free model auto-becomes default |
| PATCH | `/admin/models/:modelId` | partial update (incl. `isFree`); deactivating the default is refused (400); removing free access from the default is refused (400) |
| POST | `/admin/models/:modelId/default` | transactional swap; exactly one default; inactive or non-free models refused (400) |
| DELETE | `/admin/models/:modelId` | default model deletion refused (400) |

## Error semantics

| Status | Meaning |
|---|---|
| 400 | validation failure (empty/long message, bad UUID, inactive model, default-model rule incl. free access, idempotency content collision) |
| 401 | missing/invalid/expired JWT |
| 403 | authenticated but insufficient role — or a model the caller's plan is not allowed to use |
| 404 | unknown or foreign resource (no existence leak) |
| 409 | duplicate email on register |
| 500 | unexpected error (clean JSON, details only in server logs) |
