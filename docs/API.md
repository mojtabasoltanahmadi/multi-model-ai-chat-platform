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

`POST /conversations/:conversationId/messages` — body `{ content, modelId? }`

- `content` must be non-blank, ≤ 4000 chars (validated at the boundary)
- `modelId` optional; must reference an **active** model, otherwise the default model is used

Pre-flight failures return normal JSON errors (404 unknown/foreign conversation, 404 unknown
model, 400 inactive model / no default). Success responds **200 text/event-stream**:

```
event: meta
data: {"userMessage":{...},"model":{"id","name","provider"}}

event: delta
data: {"text":"chunk"}

event: done
data: {"assistantMessage":{ "status": "completed", ... }}

-- or, on provider failure (partial content already persisted with status "error"):

event: error
data: {"message":"سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید."}
```

Exactly one assistant message is persisted per turn in every outcome.

## Models (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/models` | **active** models only (for the chat picker) |

## Admin models (`role=admin` only)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/models` | all models; `apiKey` never returned, `hasApiKey` instead |
| POST | `/admin/models` | `{ name, provider: 'mock'\|'openai-compatible', externalModelId, baseUrl?, apiKey?, isActive? }`; first active model auto-becomes default |
| PATCH | `/admin/models/:modelId` | partial update; deactivating the default is refused (400) |
| POST | `/admin/models/:modelId/default` | transactional swap; exactly one default; inactive models refused (400) |
| DELETE | `/admin/models/:modelId` | default model deletion refused (400) |

## Error semantics

| Status | Meaning |
|---|---|
| 400 | validation failure (empty/long message, bad UUID, inactive model, default-model rule) |
| 401 | missing/invalid/expired JWT |
| 403 | authenticated but insufficient role |
| 404 | unknown or foreign resource (no existence leak) |
| 409 | duplicate email on register |
| 500 | unexpected error (clean JSON, details only in server logs) |
