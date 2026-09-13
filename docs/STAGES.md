# Implementation Stages

A running log of what was built, the decisions taken, and how each stage was verified.
(See [ARCHITECTURE.md](ARCHITECTURE.md) for the resulting system and [API.md](API.md) for endpoints.)

## Stage 0 — Scaffolding

- git init, `.gitignore` (env files, logs, dist, node_modules), fresh `ai_chat_mvp` database.
- Chose ports 4000 (backend) / 5200 (frontend) because 3000/5173 were already used
  by other projects on this machine.

## Stage 1 — Backend core: entities, auth, security defaults

- Entities: `users`, `conversations`, `messages`, `ai_models` with FK constraints
  (`CASCADE` down the ownership chain, `SET NULL` for message→model).
- Auth: register/login with bcrypt hashing, normalized (lower-cased) emails, identical
  error for unknown user vs. wrong password, JWT (1 day), admin account seeded from env
  on first boot.
- Security defaults: global `JwtAuthGuard` + `RolesGuard` + global `ValidationPipe`
  (whitelist) + global exception filter returning clean Persian messages.

**Decisions**
- `@Public()` opt-out instead of per-route guards — secure by default is harder to get wrong.
- JWT claims normalized to `{ id, email, role }` on `request.user` (found via smoke test:
  `sub` vs `id` mismatch was silently inserting `NULL` owner ids).
- bcryptjs (pure JS) instead of native bcrypt — avoids Windows build toolchain issues.

**Issues found & fixed during verification**
- TypeORM duplicate columns: declaring both `@Column({name:'user_id'}) userId` and a bare
  `@ManyToOne user` produced two columns (`user_id` + auto `userId`) and the FK stayed NULL.
  Fixed with `@JoinColumn({ name: 'user_id' })` on all three FK relations.
- `@Index()` on a `@OneToMany` relation is invalid (index must live on the FK side).

## Stage 2 — Conversations, messages, SSE streaming

- Conversation list/create/get with **ownership inside the lookup** (`WHERE userId`),
  404 (not 403) for foreign resources so existence is not leaked.
- Chat turn endpoint streams SSE: `meta` → `delta`* → `done` / `error`.
- Boundary validation: non-blank content (custom `NotBlank` validator rejects `""` and
  `"   "`), ≤ 4000 chars, UUID params.
- One-assistant-message-per-turn invariant: a single row is created per turn and updated
  in memory; final save carries `status='completed' | 'error'` (+ partial content on failure).
- Client disconnects abort the provider call and persist the partial content with
  `status='error'` (distinguishable state per spec).
- First message auto-titles the conversation.

**Decisions**
- Single POST endpoint streams the answer directly (KISS) instead of separate
  create-message + stream endpoints.
- Pre-flight `assertChatTurnAllowed` runs **before** SSE headers open, so ownership/model
  errors reach clients as normal JSON errors.
- Provider history is rebuilt from persisted messages (conversation context survives restarts).

**Issues found & fixed during verification**
- `request.closed` is true once the body is consumed — it does NOT mean the client
  disconnected. Replaced with `response.destroyed / writableEnded`.
- NestJS applies its POST 201 default even with `@Res()`; the SSE handler now sets
  `status(HttpStatus.OK)` explicitly.

## Stage 3 — AI provider abstraction & model management

- `AiProviderService`: `mock` (chunked Persian canned answer; makes demos/tests work with
  zero external dependencies) and `openai-compatible` (streaming `fetch` + SSE parser,
  `AbortController` timeout at `AI_REQUEST_TIMEOUT_MS`).
- Admin endpoints: create / list / update / set-default / delete.
- Default-model invariant: transactional swap (clear all → set one); default cannot be
  deactivated or deleted; inactive model cannot become default; first active model
  auto-default; chat resolution refuses unknown/inactive models and a missing default.

**Decisions**
- API keys stored in DB, never returned (`hasApiKey` flag) — simple, adequate for MVP.
- Admin role checked via `@Roles('admin')` metadata, not a separate admin module.

## Stage 4 — Tests

- **43 Jest unit tests** over mocked repositories (run anywhere, no DB):
  auth (hashing, duplicates, wrong credentials, seeding), JWT guard (missing/invalid/expired/
  public), roles guard, conversation ownership, default-model invariants, streaming
  one-message invariant (success, provider error, client disconnect, titling, history).
- **48-check HTTP smoke test** (`scripts/smoke-test.mjs`, Node built-in fetch, uses the
  mock provider): the full black-box suite incl. UTF-8/emoji round-trip and a real
  unreachable-provider failure path. Runs against the backend directly or through the
  Vite proxy (the browser's path).

## Stage 5 — Frontend (Vue 3 + Vite, RTL)

- Login/Register, reactive auth store persisted in localStorage, router guards
  (guest-only / auth-required / admin-only).
- Chat view: conversation sidebar, model picker (active models only, default preselected),
  streaming display via `fetch` + ReadableStream SSE parser (EventSource cannot POST with
  a JWT), typing indicator, error banners, error-status bubbles for failed turns.
- Admin view: model CRUD-lite with Persian feedback for refused invariant violations.
- Vite dev proxy `/api` → `localhost:4000` (no CORS handling needed).

**Issues found & fixed during verification**
- Vite bound to IPv6-only loopback on this machine; pinned `host: '127.0.0.1'`.

## Stage 6 — Final verification

- Fresh reboot of both servers; backend direct 401 on protected route; Vite 200.
- `npx jest`: 43/43. Smoke test direct: 48/48. Smoke test through Vite proxy: 48/48.

## Stage 8 — UI/UX redesign: premium AI workspace (TypeScript)

The frontend was rebuilt to a commercial-grade design system per the UI brief and the
project's `UI_UX_RULES.md` / `DESIGN_SYSTEM.md` (backend untouched — all 48 API smoke
checks still pass).

- **TypeScript migration**: `vue-tsc` typecheck in `npm run build`; typed API layer
  (`src/api/types.ts`, `client.ts`) and typed SFCs throughout.
- **Design system**: layered CSS tokens (`src/styles/tokens.css`) — indigo accent,
  warm off-white light theme, intentionally-designed cool near-black dark theme.
  Theme preference (روشن/سیستم/تاریک) persisted, respects `prefers-color-scheme`,
  applied pre-paint (no FOUC).
- **Persian typography**: self-hosted Vazirmatn (@fontsource) + Inter for Latin
  fragments; `.ltr`/`.mono` utilities keep mixed RTL/LTR content stable.
- **Component library** (`ui/`): AppButton, AppInput (password reveal, validation),
  AppModal, ToastHost, AppSkeleton, AppAvatar, ThemeToggle, BrandMark, EmptyState/ErrorState.
- **Workspace layout** (`layout/AppSidebar.vue`): brand, new conversation, search,
  date-grouped conversation list, profile menu (theme/admin/logout); off-canvas drawer
  below 1024px.
- **Chat experience** (`chat/`): glassy header with model selector, branded empty state
  with 4 interactive prompt cards (create + send), markdown assistant messages with
  model attribution/timestamps/copy action, streaming caret + stop button, composer with
  autosize, focus ring, char counter, disabled attachment placeholder.
- **Admin experience** (`admin/`): skeleton loading, retry error state, dense table
  (cards on mobile), default/inactive visual states, modal form with provider radio
  cards, delete confirmation, toasts for outcomes.
- **Accessibility**: global `:focus-visible`, aria-live toasts, role=alert errors,
  aria-current/expanded semantics, reduced-motion support, ≥44px touch targets.
- **Deliberate MVP skips** (documented in DESIGN_SYSTEM.md decision log): regenerate
  action (no backend endpoint), file upload (visual placeholder only), settings page
  (profile menu covers theme/admin/logout).

**Verification**: `vue-tsc --noEmit` clean, production build clean, dev server serves
the new app (pre-paint theme script verified in HTML), backend 48/48 smoke checks pass
through the Vite proxy. Browser GUI testing could not run in this session (browser
automation runtime unavailable) — visual review pending a manual pass.

## Known limitations / future work

- `DB_SYNCHRONIZE` schema management — replace with migrations before any real deployment.
- Single access token, no refresh/rotation or logout invalidation.
- API keys unencrypted at rest.
- No rate limiting; no observability; k6 load test deliberately skipped (no requirement yet).
- Frontend browser-level GUI testing not yet automated (API layer fully covered by smoke tests).
