# Architecture

A **modular monolith**: one NestJS application where each folder owns one domain.
No microservices, queues, or external infrastructure beyond PostgreSQL.

```
backend/src/
├── auth/            register, login, JWT issuing, admin seeding
├── users/           user entity + lookup service
├── conversations/   conversation entity, CRUD-lite, ownership lookup
├── messages/        message entity, chat-turn orchestration, SSE controller
├── models/          AiModel entity, admin management, chat model resolution
├── ai/              provider abstraction (mock + openai-compatible)
├── common/          guards, decorators, global exception filter
├── config/          typed env configuration
└── database/        TypeORM root module
```

## Data model

```
users(id, email UNIQUE, password_hash, role)          role ∈ {user, admin}
conversations(id, user_id → users, title, timestamps)  one owner per conversation
messages(id, conversation_id → conversations, role,    role ∈ {user, assistant}
         content, status, error_message, model_id,     status ∈ {completed, error} |
         timestamps)                                   null for user messages
ai_models(id, name, provider, external_model_id,       provider ∈ {mock, openai-compatible}
          base_url, api_key, is_active, is_free, is_default)
```

Foreign keys use `ON DELETE CASCADE` from messages→conversations→users, and
`SET NULL` for message→model (history survives model deletion).

## Request flow for a chat turn

```
POST /api/conversations/:id/messages  (JWT, JSON {content, modelId?})
  │ ValidationPipe: boundary validation (non-blank, ≤ 4000 chars, UUIDs)
  │ JwtAuthGuard: authenticated user attached to request
  ▼
MessagesController
  │ 1. assertChatTurnAllowed: conversation owned by caller + model resolvable
  │    (throws 404/400 BEFORE the SSE response opens)
  │ 2. persist user message
  │ 3. SSE: meta → delta* → done | error        (one logical assistant message)
  ▼
AiProviderService.streamChat(history, model)
     mock:                word-chunked canned Persian answer
     openai-compatible:   POST /chat/completions stream, parsed SSE → deltas
     timeout:             AbortController (AI_REQUEST_TIMEOUT_MS, default 60s)
```

### Streaming invariant (one message per turn)

An assistant row is created once per turn and mutated in memory while streaming:

- success → saved with `status='completed'`, full content
- provider error/timeout → saved with `status='error'`, partial content, internal
  `error_message` (server-side only); client gets a generic error event
- client disconnect → stream aborted, partial content saved with `status='error'`

Whatever the outcome, exactly one assistant row is persisted. The UI shows
`⚠️ errorMessage` on error-status bubbles, keeping partial + error distinguishable.

## Free-model access & plan authorization

The MVP has a single FREE plan (`UserPlan = 'free'`), but the authorization chokepoint is
already plan-aware. Access to a model = **active AND allowed for the caller's plan**
(`isFree = true` for the FREE plan). `isFree` and `isActive` are independent: a model can
be free-configured but temporarily disabled (hidden from the picker, not usable).

- `GET /models` returns only models the **caller's plan** may use — never the full catalog.
  Hiding models in the frontend is UX, not authorization.
- `ModelsService.resolveChatModel(modelId?, plan)` is the single chokepoint for chat:
  the requested (or default) model must exist (404), be active (400), and be allowed for
  the plan (403). It re-reads current backend state on **every send**, so a model disabled
  or un-freed after the user selected it is rejected on the next message — a stale frontend
  selector or direct API tampering cannot bypass it (concurrent admin changes are honored).
- The default model must always be **active + free**: `setDefault` refuses inactive or
  non-free models; deactivating/un-freeing/deleting the default is refused; the bootstrap
  auto-default only picks an active+free model. Free users therefore always have a valid
  default to fall back on.

## Model switching & per-message attribution

The model is stored **per assistant message** (`messages.model_id`), not per conversation.
Switching models mid-conversation only affects new turns; history is never rewritten.
Each assistant message remains attributable to the model that produced it (the SSE `meta`
and `done` events include `modelId`; the FK is `SET NULL` if the model is later deleted,
which preserves history).

## Security model

- **Secure by default**: `JwtAuthGuard` and `RolesGuard` are global. Routes opt OUT with
  `@Public()` (register/login) or declare `@Roles('admin')` (admin endpoints). Everything
  else requires a valid JWT.
- **Ownership in the query**: conversations and messages are looked up with
  `WHERE user_id = :caller` — foreign resources return 404, not 403, so existence is
  not leaked.
- **Passwords**: bcrypt (10 rounds). Login errors are identical for unknown email and
  wrong password.
- **Secrets**: provider API keys never leave the backend (responses carry `hasApiKey`).
  The admin list strips `apiKey`.
- **Provider failures**: caught in the chat turn; logged server-side; client sees
  «سرویس هوش مصنوعی موقتاً در دسترس نیست». Unhandled exceptions reach a global filter
  that returns clean JSON (no stack traces).

## Default-model invariant

At most one default model exists and it must be **active and free**:

- `setDefault` swaps in a transaction (clear all → set one); inactive or non-free models
  are refused (400).
- Creating the first active+free model auto-assigns default (bootstrap convenience).
- Deactivating, un-freeing, or deleting the default is refused (400) until another model
  is default.
- Chat falls back to the default only if it exists, is active, and is allowed for the
  caller's plan; inactive, unknown, or unauthorized model ids are rejected before any
  message is persisted.

## Deliberate MVP trade-offs

- `synchronize: true` schema management (documented dev convenience; production would use migrations).
- No refresh tokens; token expiry is 1 day.
- API keys stored unencrypted in the database.
- No rate limiting / observability / queues — no requirement yet.
