# Contributing to vibeSQL

Thanks for considering a contribution. This doc covers the practicalities; the higher-level design-system and code conventions live in [`AGENTS.md`](AGENTS.md).

## Getting set up

```bash
git clone https://github.com/s99606931/vibesql.git
cd vibesql
cp .env.example .env.local       # fill in DATABASE_URL, ANTHROPIC_API_KEY, secrets
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run dev
```

Or use `docker compose up -d --build` (see [README — Quickstart](README.md#quickstart--docker-compose)).

## Development workflow

1. **Branch** from `main`: `git checkout -b feat/<short-name>` or `fix/<short-name>`.
2. **Commit small, focused changes.** Use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): …` — new functionality
   - `fix(scope): …` — bug fix
   - `chore(scope): …` — tooling, deps, refactor with no behavior change
   - `test(scope): …` — adding or fixing tests
   - `docs(scope): …` — documentation only
3. **Run the checks before pushing:**

   ```bash
   npx tsc --noEmit
   npm test
   npm run lint
   ```

4. **Open a PR against `main`.** CI must be green before review.

## Code style

- TypeScript strict mode — no `any` without a comment justifying it.
- React Server Components by default. Add `"use client"` only when you need state, effects, or browser APIs.
- Server state → TanStack React Query. UI state → Zustand.
- API responses follow `{ data: T, error?: string, meta?: Record<string, unknown> }`.
- **Design tokens, not hardcoded colors.** Use `var(--ds-*)` or its Tailwind semantic alias (`bg-surface`, `text-text`, `border-border`, …). See [`AGENTS.md`](AGENTS.md) for the full list. Pull requests with `#ffffff`, `text-gray-500`, or `dark:` variants will be asked for changes.
- Inputs (`input`, `textarea`, `select`) intentionally have no focus ring — see `globals.css`. Don't reintroduce one.

## Tests

- Place unit/integration tests next to source: `src/**/__tests__/*.test.ts`.
- Place Playwright sweeps in `tests/e2e/` — they're excluded from `npm test` and run via `npx playwright test`.
- Test API routes directly (Next.js handlers), don't spin up the full server.
- Prefer `vi.stubEnv` over mutating `process.env` directly so vitest can clean up.

## Security

- Never log connection passwords or secrets, even in dev.
- All user-supplied SQL must go through `src/lib/sql-guard/index.ts`. If you bypass it for a good reason, document why in the PR.
- Validate every incoming payload with Zod before touching the database.

## Reporting issues

- **Bugs / feature requests** — open a regular GitHub issue.
- **Security vulnerabilities** — open a private security advisory on the repo. Don't file a public issue.

## Releasing

`main` auto-deploys to Railway via `.github/workflows/ci-cd.yml` once tests pass. There's no separate release branch; merge to `main` is the release.
