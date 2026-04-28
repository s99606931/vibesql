# vibeSQL — User Guide

> 🇰🇷 [한국어](USER_GUIDE.ko.md)

This guide walks you through running vibeSQL, signing up, connecting your database, and asking your first question. It assumes you've already followed [README — Quickstart](../README.md#quickstart--docker-compose).

## Contents

1. [First-time setup](#1-first-time-setup)
2. [Signing in](#2-signing-in)
3. [Adding a database connection](#3-adding-a-database-connection)
4. [Browsing the schema](#4-browsing-the-schema)
5. [Asking your first NL question](#5-asking-your-first-nl-question)
6. [Working with results](#6-working-with-results)
7. [Saving, scheduling, dashboards](#7-saving-scheduling-dashboards)
8. [Using the AI assistant panel](#8-using-the-ai-assistant-panel)
9. [Admin features](#9-admin-features)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. First-time setup

After `docker compose up -d --build` finishes, open <http://localhost:3000>. You'll land on `/signin`.

The first registered account becomes **ADMIN** automatically. Pick a real email + a strong password — there is no password reset flow yet, so don't forget it.

If you're running with `VIBESQL_DEV_AUTH_BYPASS=1` (development only), you can skip signin entirely and the app treats all requests as the dev user. **Never enable this in production.**

## 2. Signing in

- `/signin` has two tabs: **Login** and **Sign up**
- Email + password only (no OAuth in v1)
- Successful sign-in sets an `httpOnly` `vs-session` cookie and redirects to `/home`

## 3. Adding a database connection

vibeSQL doesn't have demo data — you connect your own database.

1. Click **연결 / Connections** in the sidebar
2. Click **새 연결 / New Connection**
3. Fill in:
   - **Name** — anything memorable, e.g. "prod-readonly"
   - **Type** — PostgreSQL (MySQL/SQLite coming soon)
   - **Host / Port / Database / Username / Password**
   - **SSL** — toggle for hosted databases (RDS, Supabase, Neon, etc.)
4. Click **테스트 / Test** to verify reachability and view server version + latency
5. Save — the password is encrypted with AES-256-GCM (`CONNECTION_ENCRYPTION_KEY`) before persisting

> ⚠ **Use a read-only DB user.** vibeSQL's SQL guard rejects anything other than `SELECT`, but defense in depth is always better. Create a dedicated PostgreSQL role with only `SELECT` privileges on the schemas you want exposed.

## 4. Browsing the schema

Once you've added a connection, the **스키마 / Schema** page introspects `information_schema` and `pg_class` to show:

- All tables in the `public` schema
- Approximate row counts (from `reltuples`)
- Column lists
- **PII badges** — vibeSQL flags tables whose columns match patterns like `email`, `phone`, `ssn`, `password`, `card_number`, etc. Use this to decide what to expose.

Click a table name to see its columns. Click an active connection from the connection switcher to swap between datasets.

## 5. Asking your first NL question

Go to **워크스페이스 / Workspace**. The page has three regions: NL input (top), generated SQL (middle), result table (bottom).

1. Type your question. Korean and English both work — the AI keeps the language of your question in any explanation it returns.

   *Examples:*
   - "이번 주 주문이 가장 많은 상위 10명 사용자"
   - "Find duplicate emails in the customers table"
   - "monthly revenue by product category, last 6 months"

2. Click **SQL 생성 / Generate**. The system:
   - Pulls schema context from your active connection
   - Sends NL + schema + dialect to Claude
   - Validates the returned SQL through the AST guard
   - Streams the SQL into the editor with a confidence badge (high / medium / low)

3. Review the SQL. The editor is editable — tweak it if needed.

4. Click **실행 / Run** to execute. Read-only — only `SELECT` will run; anything else is rejected before reaching the database.

## 6. Working with results

The result table supports:

- **Sorting** — click column headers
- **Searching** — text filter on visible columns
- **Pagination** — 50 rows per page; large results stream
- **Charts** — switch to chart view for line / bar / pie based on column types
- **Export** — CSV download of the current result

Each run is recorded in **히스토리 / History**. Star a query to pin it; saved queries also appear in **저장됨 / Saved**.

## 7. Saving, scheduling, dashboards

- **저장됨 / Saved** — group saved queries into folders, share within your tenant, export as CSV
- **스케줄러 / Schedules** — run a saved query on a cron schedule and email/webhook the result *(coming soon)*
- **대시보드 / Dashboards** — assemble multiple chart widgets into a single view; embeds live SQL queries with read-only refresh
- **차트 / Charts** — standalone chart builder pinned to one query
- **리포트 / Reports** — *(coming soon)*

## 8. Using the AI assistant panel

The AI button at the top right opens a slide-in chat panel that knows your **current SQL**, **active connection**, **dialect**, and **selected schema snippet**.

Useful prompts:

- *"Optimize this query"* — receive an indexed/CTE-rewritten version
- *"Explain this in plain Korean"* — line-by-line explanation
- *"What's wrong with this query?"* — debugging help against actual schema
- *"Show me the data for the latest order"* — converts to NL→SQL inline

Code blocks rendered in the chat have **복사 / Copy** and **적용 / Apply** buttons. Apply pushes the SQL straight into the workspace editor.

Press `⌘I` (`Ctrl+I` on Linux) to toggle the panel from anywhere. `Esc` closes.

## 9. Admin features

Admin users (the first signup, plus anyone an existing admin promotes) get extra menu items:

- **사용자 관리 / Admin Users** — list users, change roles, deactivate accounts
- **AI 프로바이더 / AI Providers** — manage which Claude / OpenAI / Google keys the tenant uses
- **AI 컨텍스트 / AI Context** — system prompt customization, glossary upload, table descriptions
- **상태·에러 / Errors** — recent app errors with stack traces (server-side filtered)
- **감사 로그 / Audit Logs** — every login, query execution, role change

## 10. Troubleshooting

**"Failed to fetch" on /home**
- The browser couldn't reach the API. Check `docker compose logs -f web` — likely the container isn't healthy yet.

**Query takes 30+ seconds and times out**
- vibeSQL has a per-query timeout of 30s. Add a `LIMIT` or filter in the SQL editor before running.

**"CONNECTION_ENCRYPTION_KEY must be set"**
- Your env file is missing the encryption key. Generate one: `openssl rand -hex 32` and set in `.env.docker` (or `.env.local`). Restart.

**Can't sign in after restart**
- If you're running without `DATABASE_URL` (in-memory mode), accounts disappear on restart. Set `DATABASE_URL` for persistence.

**Confidence is "low" on every query**
- The AI didn't get enough schema context. Open the schema page, confirm your active connection introspected correctly, and check that table descriptions exist (admins can add them under AI Context).

**The AI assistant button overlaps page actions**
- This was fixed in v0.2 — TopBar reserves 164px on the right. If you see overlap, you're on an older build; pull the latest.

---

For deeper technical details (architecture, security model, contributing), see [README](../README.md), [SECURITY.md](../SECURITY.md), and [CONTRIBUTING.md](../CONTRIBUTING.md).
