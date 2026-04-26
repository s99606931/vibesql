---
name: vibeSQL Design Enforcement Rules
description: Hard rules on color/token usage enforced by CLAUDE.md — violations are never acceptable
type: feedback
---

Never hardcode colors (`#fff`, hex, `rgb()`, `hsl()`). Always use `var(--ds-*)` CSS variables.

Never use Tailwind `dark:` variant. Dark mode is via `[data-mode="dark"]` attribute on the root.

Never use Tailwind palette colors like `text-indigo-500`, `bg-gray-100`. Use semantic aliases: `bg-surface`, `text-mute`, `text-accent`, etc.

Inline styles must always use `var(--ds-*)` tokens for colors, spacing, and radii.

**Why:** Design system enforces theming via CSS variable swaps — hardcoded values break dark mode and prevent token-level theming.

**How to apply:** Every color, spacing, radius value must reference a `--ds-*` variable. Recharts `fill`/`stroke` also use CSS var strings: `fill="var(--ds-accent)"`.
