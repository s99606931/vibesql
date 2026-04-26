<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# vibeSQL — Agent Reference

> Quick reference for all agents. Full rules in CLAUDE.md.

## Project: vibeSQL
Natural language → SQL web service. Users type questions in Korean/English, Claude AI generates dialect-specific SQL, executes read-only against connected DBs, and returns results.

## Tech Stack
- **Framework**: Next.js 16.2.4 (App Router) + TypeScript + Tailwind 4 + React 19
- **AI**: Claude API (`@anthropic-ai/sdk`) — `claude-sonnet-4-6` for SQL generation
- **UI State**: Zustand v5 | **Server State**: TanStack React Query v5
- **Tables**: TanStack React Table v8 | **Forms**: react-hook-form v7 + Zod v4
- **SQL Editor**: CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-sql`)
- **Icons**: lucide-react | **Command Palette**: cmdk v1

## Design System — ONE RULE
**NEVER** use hardcoded colors (`#fff`, `text-indigo-500`, `dark:` variants).
**ALWAYS** use `var(--ds-*)` CSS variables or their Tailwind semantic aliases.

```tsx
// ❌ WRONG
<div className="bg-white text-gray-900 dark:bg-gray-900 p-4">
// ✅ CORRECT (inline tokens)
<div style={{ background: "var(--ds-surface)", color: "var(--ds-text)", padding: "var(--ds-sp-4)" }}>
// ✅ CORRECT (semantic Tailwind)
<div className="bg-surface text-text">
```

## Component Imports
```tsx
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { AICallout, AIBadge } from "@/components/ui-vs/AICallout";
import { TopBar } from "@/components/shell/TopBar";
import { cn } from "@/lib/utils";
```

## Page Template
```tsx
import { TopBar } from "@/components/shell/TopBar";
export default function FeaturePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Feature" breadcrumbs={[{ label: "vibeSQL" }, { label: "Feature" }]} />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* content */}
      </div>
    </div>
  );
}
```

## API Route Template
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
const BodySchema = z.object({ field: z.string() });
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  return NextResponse.json({ data: {} });
}
```

## Spacing: --ds-sp-1=4px, --ds-sp-2=8px, --ds-sp-3=12px, --ds-sp-4=16px, --ds-sp-5=20px, --ds-sp-6=24px
## Font sizes: --ds-fs-10 through --ds-fs-28 (body default: --ds-fs-13=13px)
