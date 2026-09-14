# AI Chat MVP — پلتفرم چت چندمدلی

A minimal, working MVP of a multi-model AI chat platform for Persian-speaking users:
register/login, own conversations, streamed AI responses, and admin-managed AI models.

- **Backend**: NestJS + TypeORM + PostgreSQL (modular monolith, port 4000)
- **Frontend**: Vue 3 + TypeScript + Vite (RTL Persian UI, port 5200, light & dark themes)

## Quick Start

### 1. Prerequisites

- Node.js 20+ (developed on Node 24)
- PostgreSQL 14+ (developed on PostgreSQL 18) — either a local install or `docker compose up -d db` (compose file provided in `infra/` if you use Docker)

### 2. Database

Create a database (example):

```sql
CREATE DATABASE ai_chat_mvp;
```

### 3. Backend

```bash
cd backend
cp .env.example .env        # then edit DB_PASSWORD and JWT_SECRET
npm install
npm run start:dev           # http://localhost:4000/api
```

On first boot the backend creates the schema (`DB_SYNCHRONIZE=true`, dev convenience) and seeds
an admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@example.com` / `admin1234` —
change them for any real deployment).

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5200
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so no CORS setup is needed.

### 5. First chat

1. Log in as the admin → open **پنل مدیریت مدل‌ها**.
2. Create a model. Two provider kinds exist:
   - `mock` — streams a canned Persian response, no API key needed (great for demos/tests)
   - `openai-compatible` — any OpenAI-compatible streaming API (set `externalModelId`, optional
     `baseUrl`, and `apiKey`)
3. The first active model automatically becomes the default.
4. Register a normal user, create a conversation, and chat — responses stream in live.

## Tests

```bash
cd backend
npx jest                    # 43 unit tests (no database needed)

# with the backend running:
node ../scripts/smoke-test.mjs       # 48 end-to-end HTTP checks
```

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md) — pre-development design for Task 1 (requirements, rules, invariants, scope, breakdown)
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — visual source of truth: tokens, components, page patterns, decision log
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, data model, invariants, error handling
- [docs/API.md](docs/API.md) — endpoint reference and the SSE streaming protocol
- [docs/STAGES.md](docs/STAGES.md) — implementation stages, decisions, edge cases, known limitations

## Security notes

- Passwords are stored as bcrypt hashes; JWTs are required on every route except
  `/auth/register` and `/auth/login` (secure by default, `@Public()` opt-out).
- Conversations/messages are filtered by owner in the query itself; other users' resources
  return 404 (no existence leak).
- Provider API keys are stored server-side and never returned by any API (`hasApiKey` flag only).
- AI provider failures surface as generic client-facing messages; details stay in server logs.
- AI markdown responses are rendered with raw HTML disabled (no script injection).

## Known limitations (deliberate MVP scope)

- Schema via `DB_SYNCHRONIZE` instead of migrations (dev-only convenience, see docs/STAGES.md)
- Access tokens only (no refresh tokens / logout blacklist)
- API keys stored in plain text in the database (masked at the API boundary)
- Attachment button in the composer is visual-only (file upload intentionally out of MVP)
- No regenerate-message action (requires a backend regenerate endpoint)
- No rate limiting, Redis/queues, or observability stack — none are needed yet
