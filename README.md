# vibeSQL

> **자연어로 데이터에 질문하세요.** Korean/English natural-language → SQL → execute on your databases → results.

vibeSQL takes a question in plain language ("이번 주 매출 상위 10명"), generates dialect-specific SQL via Claude, executes it read-only against a connected database, and shows the results in a workspace UI with a built-in AI assistant.

[![CI](https://github.com/s99606931/vibesql/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/s99606931/vibesql/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node ≥22](https://img.shields.io/badge/node-%E2%89%A522-339933.svg?logo=node.js&logoColor=white)](#quickstart--local-dev-without-docker)

🇰🇷 [한국어 README](README.ko.md) · 📖 [User Guide](docs/USER_GUIDE.md) · 🔒 [Security](SECURITY.md) · 🤝 [Contributing](CONTRIBUTING.md)

---

## Features

- **NL → SQL** with Claude (`claude-sonnet-4-6`); confidence scoring; explanation panel
- **Read-only AST guard** — every query passes through `lib/sql-guard` before hitting the DB
- **Workspace** with CodeMirror SQL editor, result table, charts, save/share, query history
- **Schema browser** with PII auto-detection by column-name heuristics
- **Connections** — encrypted DB credentials (AES-256-GCM at rest), latency probe, status chip
- **AI assistant panel** — context-aware (current SQL, schema, dialect) chat with markdown + code apply
- **Admin** — user roles (USER / ADMIN), audit logs, AI provider/context management

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Zustand v5 · TanStack React Query v5 · Prisma 7 · PostgreSQL · CodeMirror 6 · Vitest 4 · Playwright 1.59

---

## Quickstart — Docker compose

The fastest way to run vibeSQL locally. Boots Postgres + Next.js standalone in one command.

```bash
git clone https://github.com/s99606931/vibesql.git
cd vibesql

cp .env.docker.example .env.docker
# edit .env.docker — set ANTHROPIC_API_KEY, generate CONNECTION_ENCRYPTION_KEY + JWT_SECRET:
#   openssl rand -hex 32

docker compose up -d --build
open http://localhost:3000
```

The first registered account becomes **ADMIN** automatically. After that, use `/signin` to log in.

Stop & remove:

```bash
docker compose down            # keep data
docker compose down -v         # also wipe the postgres volume
```

Logs:

```bash
docker compose logs -f web
docker compose logs -f postgres
```

---

## Quickstart — local dev (without Docker)

Requires **Node.js 22+** and a running PostgreSQL 16+ instance.

```bash
git clone https://github.com/s99606931/vibesql.git
cd vibesql

cp .env.example .env.local
# minimum: set DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, CONNECTION_ENCRYPTION_KEY

npm install --legacy-peer-deps
npx prisma generate
npx prisma db push           # creates the schema in your DB

npm run dev                  # http://localhost:3000
```

Run it without a real DB by leaving `DATABASE_URL` unset — vibeSQL falls back to an in-memory store seeded with `admin@vibesql.dev` / `admin123` (dev only; never enable in production).

---

## Environment variables

| Variable | Required | Description |
|---|:---:|---|
| `DATABASE_URL` | ⚠ | PostgreSQL URL. Omit for in-memory dev mode. |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for SQL generation + chat. |
| `OPENAI_API_KEY` | ⚪ | Alternate provider. |
| `GOOGLE_AI_API_KEY` | ⚪ | Alternate provider. |
| `CONNECTION_ENCRYPTION_KEY` | ✅ | 64-char hex (`openssl rand -hex 32`). AES-256-GCM key for stored DB passwords. |
| `JWT_SECRET` | ✅ | 64-char hex for `vs-session` cookie signing. |
| `NEXT_PUBLIC_APP_URL` | ⚪ | External base URL when behind a reverse proxy. |
| `VIBESQL_DEV_AUTH_BYPASS` | ⚪ | `1` skips auth in local dev/test only (NEVER in production). |
| `VIBESQL_DEV_AS_ADMIN` | ⚪ | `1` grants ADMIN to the dev-bypass user. |

Full list with defaults: see [`.env.example`](.env.example) and [`.env.docker.example`](.env.docker.example).

---

## Project structure

```
src/
  app/
    (app)/                ← authenticated pages (workspace, schema, connections, …)
    (auth)/               ← signin / register
    api/                  ← Next.js route handlers
  components/
    shell/                ← AppShell, Sidebar, TopBar, AiChatPanel
    ui-vs/                ← vibeSQL design-system components
    ui/                   ← shadcn bridge (do not modify)
    workspace/            ← SqlEditor, ResultTable, ResultChart
    connections/          ← connection-specific UI
  lib/
    claude/               ← Claude API integration (NL→SQL pipeline)
    sql-guard/            ← AST guard (SELECT-only validation)
    nl2sql/               ← linker, generator, refiner
    db/                   ← Prisma client
    connections/          ← AES-256-GCM encrypt helpers
  store/                  ← Zustand stores (workspace, settings)
prisma/                   ← schema.prisma + migrations
tests/e2e/                ← Playwright sweeps (kept out of the vitest run)
```

## Scripts

```bash
npm run dev               # next dev (Turbopack)
npm run build             # next build (standalone output)
npm start                 # next start
npm test                  # vitest run (unit + integration)
npm run test:watch        # vitest in watch mode
npm run test:coverage     # vitest with v8 coverage
npm run lint              # eslint
```

## Testing

- **Unit / integration**: `npm test` — 275+ tests under `src/**/__tests__/**`. Vitest 4, jsdom for React, node for API.
- **E2E**: Playwright sweeps under `tests/e2e/` — run with `npx playwright test`. CI runs unit only.

CI requires the same env shape as production (`DATABASE_URL`, `JWT_SECRET`, `CONNECTION_ENCRYPTION_KEY`), supplied by the workflow at `.github/workflows/ci-cd.yml`.

---

## Deployment

The `ci-cd.yml` workflow auto-deploys `main` to Railway after tests pass. Set these repo secrets:

- `RAILWAY_TOKEN` — your Railway personal access token
- `RAILWAY_SERVICE_NAME` — name of the service that runs the web app

Production URL of this fork: <https://vibesql-production.up.railway.app>

For step-by-step Railway setup (postgres plugin, env wiring, custom domains): see [`DEPLOY-GUIDE.md`](DEPLOY-GUIDE.md).

The `Dockerfile` produces a minimal standalone runtime (~150 MB) and works on any container host. `docker-compose.yml` shows how to compose it with Postgres locally.

---

## Security model (short version)

- All user-issued SQL passes through `src/lib/sql-guard` and is rejected unless every statement is a `SELECT`.
- Connection passwords are AES-256-GCM encrypted with `CONNECTION_ENCRYPTION_KEY`. A base64 fallback exists ONLY when `VIBESQL_DEV_AUTH_BYPASS=1` AND `NODE_ENV=development|test` — production never qualifies.
- JWT signing uses `JWT_SECRET`. Tokens are stored in an `httpOnly` cookie named `vs-session`.
- Rate limiting on `/api/queries/*`. Input validation with Zod at every boundary.

Found a vulnerability? Please open a private security advisory on GitHub instead of a public issue.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The short version: small focused PRs, write a test, follow the design-token rules in [`AGENTS.md`](AGENTS.md) (no hardcoded colors — use `var(--ds-*)` or its Tailwind aliases).

## License

[MIT](LICENSE) © vibeSQL contributors.
