---
name: vibeSQL Project Context
description: Tech stack, component locations, workspace architecture for vibeSQL
type: project
---

vibeSQL is a natural language → SQL web service. Next.js 16.2.4, React 19, Tailwind 4, Zustand v5, TanStack React Query v5.

Custom UI components live in `src/components/ui-vs/`: Button, Pill, Card, AICallout, AIBadge.
Shell components: `src/components/shell/TopBar`, AppShell, Sidebar.
Workspace-specific components: `src/components/workspace/` — SqlEditor, ResultTable, ResultChart, ResultChartInner.

Icons: lucide-react only, 12-20px.
SSR-incompatible components (recharts, CodeMirror) are wrapped in `next/dynamic` with `{ ssr: false }`.

**Why:** App Router with React Server Components by default — client components need `"use client"` or dynamic import.

**How to apply:** Any component with useState/useEffect/event handlers needs `"use client"`. Heavy viz libs use dynamic import pattern with a skeleton/stripes loading fallback.
