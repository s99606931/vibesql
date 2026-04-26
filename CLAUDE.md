@AGENTS.md

# vibeSQL — Agent Harness Rules

> All sub-agents, team agents, and Claude Code sessions working in this directory MUST follow these rules without exception.

## Design System Enforcement

### Token-Only Styling — NO EXCEPTIONS
```
FORBIDDEN:                          ALLOWED:
#4f46e5, #fff, rgb(...), hsl(...)  var(--ds-accent)
Tailwind: text-indigo-500           text-accent (maps to --ds-accent)
Tailwind: bg-gray-100               bg-surface (maps to --ds-surface)
dark: variant                       [data-mode="dark"] selector
px-4 (hardcoded)                   style={{ padding: "var(--ds-sp-4)" }}
```

### Required CSS Variables
| Purpose | Variable |
|---------|----------|
| Page background | `--ds-bg` |
| Card/panel background | `--ds-surface` |
| Elevated surface | `--ds-surface-2` |
| Input fill | `--ds-fill` |
| Default border | `--ds-border` |
| Primary text | `--ds-text` |
| Secondary text | `--ds-text-mute` |
| Hint/placeholder | `--ds-text-faint` |
| Interactive accent | `--ds-accent` |
| Accent hover | `--ds-accent-hover` |
| Accent fill/bg | `--ds-accent-soft` |
| Spacing 4px | `--ds-sp-1` |
| Spacing 8px | `--ds-sp-2` |
| Spacing 12px | `--ds-sp-3` |
| Spacing 16px | `--ds-sp-4` |
| Spacing 20px | `--ds-sp-5` |
| Spacing 24px | `--ds-sp-6` |
| Border radius 6px | `--ds-r-6` |
| Border radius 8px | `--ds-r-8` |
| Monospace font | `--ds-font-mono` |
| Sans font | `--ds-font-sans` |

### Allowed Tailwind Semantic Classes
These map to design tokens and are safe to use:
- `bg-bg`, `bg-surface`, `bg-surface-2`, `bg-fill`
- `text-text`, `text-mute`, `text-faint`
- `text-accent`, `bg-accent-soft`
- `border-border`, `border-border-strong`
- `text-success`, `text-warn`, `text-danger`, `text-info`

### Component Rules
1. Shell components (Sidebar, TopBar, AppShell): use inline styles with `var(--ds-)` tokens
2. UI components (Button, Pill, Card, AICallout): import from `@/components/ui-vs/`
3. Form inputs: use components from `@/components/ui/` (shadcn bridge)
4. Icons: use `lucide-react` only, size 12-20px
5. CodeMirror SQL editor: import from `@/components/workspace/SqlEditor`

## File Structure Rules
```
src/
  app/
    (app)/              ← authenticated app pages
    (auth)/             ← auth pages (signin)
    api/                ← Next.js route handlers
  components/
    shell/              ← AppShell, Sidebar, TopBar ONLY
    ui/                 ← shadcn components (DO NOT MODIFY)
    ui-vs/              ← vibeSQL custom components
    workspace/          ← workspace-specific components
    connections/        ← connection-specific components
    auth/               ← auth-specific components
  lib/
    api/                ← fetch utilities
    db/                 ← Prisma client
    claude/             ← Claude API integration
    sql-guard/          ← AST guard (SELECT-only)
  store/                ← Zustand stores
  types/                ← TypeScript type definitions
  hooks/                ← Custom React hooks
```

## Code Style
- TypeScript strict mode — no `any` without explicit comment
- React Server Components by default; `"use client"` only when needed (useState, useEffect, event handlers)
- Zustand for UI state, React Query for server state
- `cn()` utility for conditional class names: `import { cn } from "@/lib/utils"`
- API responses: `{ data: T, error?: string, meta?: Record<string, unknown> }`
- Error boundaries: wrap page-level components
- Loading states: use `<Skeleton>` from `@/components/ui/skeleton`

## API Route Pattern
```typescript
// app/api/[resource]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

const Schema = z.object({ ... });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  // implementation
  return NextResponse.json({ data: result });
}
```

## State Management Pattern
```typescript
// store/useWorkspaceStore.ts
import { create } from "zustand";

interface WorkspaceState {
  status: "idle" | "generating" | "ready" | "running" | "success" | "error";
  nlQuery: string;
  sql: string;
  setNlQuery: (q: string) => void;
  // ...
}
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  status: "idle",
  nlQuery: "",
  sql: "",
  setNlQuery: (nlQuery) => set({ nlQuery }),
}));
```

## Claude API Pattern
```typescript
// lib/claude/nl2sql.ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

export async function generateSQL(nl: string, schema: string, dialect: string) {
  // streaming response via SDK
}
```

## Security Rules (MANDATORY)
1. SQL guard: ALL queries through `lib/sql-guard/index.ts` before execution
2. DB credentials: NEVER logged, stored in Prisma models encrypted
3. Read-only: Only SELECT queries allowed (AST validation)
4. Rate limiting: All `/api/queries/*` endpoints limited
5. Input sanitization: All user inputs validated with Zod before processing

## Testing Pattern
- Unit tests: `__tests__/` adjacent to source files
- E2E: `tests/e2e/` at project root
- Mock DB: use `prisma.$transaction` and rollback in tests

## Performance Rules
1. `React.memo` for heavy list items (QueryResultRow, ConnectionCard)
2. Virtual scrolling for result tables > 1000 rows
3. CodeMirror: lazy load with `dynamic(() => import(...), { ssr: false })`
4. Schema indexing: background job, never blocking UI
5. React Query: `staleTime: 30_000` for schema data, `0` for query results
