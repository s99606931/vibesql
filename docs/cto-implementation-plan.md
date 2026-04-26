# CTO Implementation Plan — Menu Restructure & Core Features

> **Author**: cto-lead (PDCA Enterprise)
> **Date**: 2026-04-26
> **Audience**: frontend-architect (next phase: implementation)
> **Status**: Approved Direction — Ready for Do phase

---

## Executive Summary

| Perspective | Statement |
|---|---|
| **Problem** | 12개 평면 메뉴는 인지 부하가 크고 신규 기능(공유/RBAC/감사) 추가 시 더 악화됨. NL→SQL 결과의 신뢰도/설명 표시가 약해 사용자가 "이 SQL을 믿어도 되는가"를 판단하기 어려움. |
| **Solution** | (A) 5그룹 collapsible Sidebar로 재조직 + 신규 자리(권한/스케줄/팀/알림/리포트/카탈로그)는 placeholder로 미리 노출. (B) 이미 구현된 `Nl2SqlResult.confidence` + `explanation`을 UI에 노출하고 명시적 Explain 라우트를 추가. (C) `SharedLink` 모델 + UUID 토큰 기반 공유 링크. |
| **Function/UX Effect** | 메뉴 5그룹 + 그룹 헤더 접기/펼치기, 워크스페이스 신뢰도 칩(High/Med/Low + %), Explain 버튼, "공유" 버튼이 단축 URL 모달을 띄움, `/share/[token]` 공개 라우트로 리드온리 결과 공유. |
| **Core Value** | 비개발자가 "이 SQL이 무엇을 하고, 얼마나 믿을 수 있고, 어떻게 공유하는가"를 한 화면에서 즉시 파악. CTO 시각에서 RBAC/감사 인프라 자리를 미리 잡아 향후 확장 비용 절감. |

---

## Context Anchor

| Key | Value |
|---|---|
| WHY | 메뉴 인지 부하 감소 + AI 신뢰성 가시화 + 협업 공유 기반 마련 |
| WHO | 비개발자/분석가 (1차), 데이터 팀 리드 (2차), 향후 enterprise admin (3차 — RBAC) |
| RISK | (1) 클라이언트 컴포넌트 비대화 (Sidebar `"use client"`) — `localStorage` collapse state로 hydration mismatch 방지 필수. (2) 공유 URL의 SQL 재실행 권한 모델 — MVP는 **결과 스냅샷만** 공유, 재실행 금지. (3) confidence를 사용자가 over-trust할 위험 — "AI 자체평가" 라벨 명시. |
| SUCCESS | Sidebar 5그룹 렌더 + 접기/펼치기 동작, Workspace에 confidence 칩 표시, `/api/queries/explain` 200 응답, `/share/[token]` 공개 라우트 200, build clean (TypeScript strict), no design-token violations. |
| SCOPE | **포함**: Phase A/B/C. **제외**: 실제 RBAC 미들웨어 구현(자리만), Audit Log UI 페이지(API 자리만), 알림 백엔드, 리포트 빌더, 데이터 카탈로그 콘텐츠. |

---

## 1. 기술적 결정 사항 (Architecture Decisions)

### ADR-1: Sidebar 그룹핑 — **컴포넌트 분리 채택**

| Option | Pros | Cons | Decision |
|---|---|---|---|
| A. CSS-only (data 배열에 `group` 필드) | 코드 변경 최소, 1파일 수정 | 접기/펼치기 state 관리 지저분, a11y 약함 | ❌ |
| B. **컴포넌트 분리 (`SidebarGroup`)** | 재사용성, a11y(`<details>` 또는 `aria-expanded`), state 캡슐화 | 약 2개 신규 파일 | ✅ **채택** |
| C. shadcn `Accordion` 도입 | 즉시 동작 | 패키지 추가, 디자인 토큰과 정합성 검증 필요 | ❌ |

**Why B**: enterprise 레벨 Clean Architecture 원칙 — Sidebar는 향후 hover-preview, drag-reorder, badge count 등 확장 가능성이 큼. 데이터 배열 + 컴포넌트 분리가 SoC를 가장 잘 지킴.

**구현 형태**:
- `src/components/shell/SidebarGroup.tsx` (신규) — 그룹 헤더 + collapsible body
- `src/components/shell/Sidebar.tsx` (수정) — 5개 group 데이터 배열 → `<SidebarGroup>` 매핑
- 접기 state는 `localStorage`에 `vibesql:sidebar:collapsed` (JSON: `{ workspace: false, insights: false, ... }`) 저장
- SSR 안전: 초기값은 모두 `false`(펼침), `useEffect`로 mount 후 localStorage 동기화

---

### ADR-2: AI Confidence Score — **백엔드 산출 + 프론트엔드 표시**

| Option | Pros | Cons | Decision |
|---|---|---|---|
| A. **백엔드: 기존 `Nl2SqlResult.confidence` 활용** | 이미 모델이 self-report, 0 추가 비용 | "AI self-report"의 신뢰도 자체가 낮음 (사용자에 명시 필요) | ✅ **채택 (MVP)** |
| B. 프론트엔드 휴리스틱 (SQL 길이, JOIN 수, 경고 수) | 모델 의존 X | 정확도 낮음, 테스트 부담 | ❌ |
| C. 보강: A + 휴리스틱 가중 (medium → 70%, JOIN>3 → -10pt 등) | 점수의 객관성 향상 | 튜닝 비용, 사용자에게 설명 어려움 | ⏳ **Phase B+ (이후 고려)** |

**Why A**: `lib/claude/nl2sql.ts`의 `Nl2SqlResult`는 이미 `confidence: "high" | "medium" | "low"` + `warnings?: string[]`을 반환 중. 추가 비용 0으로 즉시 표시 가능.

**산출 규칙 (서버 측 매핑)**:
```typescript
// lib/ai/confidence.ts (신규)
export function confidenceToPercent(c: "high" | "medium" | "low", warnings?: string[]): number {
  const base = c === "high" ? 92 : c === "medium" ? 75 : 55;
  const penalty = (warnings?.length ?? 0) * 5;
  return Math.max(40, Math.min(99, base - penalty));
}

export function confidenceLabel(c: "high" | "medium" | "low"): string {
  return c === "high" ? "신뢰도 높음" : c === "medium" ? "신뢰도 보통" : "검토 필요";
}
```

**중요 UX 규칙**: 칩 옆에 작은 `info` 아이콘 + tooltip "AI 자체 평가 점수입니다. 결과를 항상 확인하세요." — over-trust 방지.

---

### ADR-3: Share Link — **UUID(crypto.randomUUID) 토큰 + DB 저장**

| Option | Pros | Cons | Decision |
|---|---|---|---|
| A. JWT (HS256, payload에 resource_id) | DB 조회 0회, stateless | revoke 어려움(블랙리스트 필요), payload 노출 | ❌ |
| B. **UUID v4 + DB lookup** | revoke 즉시(`revoked_at` 갱신), expire/access count 추적, 가장 단순 | DB 조회 1회 (캐시 가능) | ✅ **채택** |
| C. nanoid (짧은 url) | URL 짧음 | crypto.randomUUID는 표준 + 충돌 사실상 0 | ❌ |

**Why B**: 공유 링크는 **revoke 가능성이 핵심 요구사항**. JWT는 revoke를 위해 결국 DB가 필요해지므로 처음부터 DB-backed가 단순. URL은 `/share/{36자}` — 사용성 충분.

**보안 규칙**:
- 토큰: `crypto.randomUUID()` (Node 19+, Next 16에서 사용 가능)
- 만료: 기본 7일, 사용자 선택 (1d/7d/30d/never)
- 접근 시: rate limit (IP 기준 60/min)
- 결과 스냅샷 모드(MVP): `payload` JSON에 columns + rows를 저장 → 공개 페이지에서 SQL 재실행 금지 (보안/성능)

---

## 2. Phase A — Sidebar 5그룹 재조직

### 2.1 변경 파일

| 파일 | 동작 | 라인 추정 |
|---|---|---|
| `src/components/shell/Sidebar.tsx` | 수정 (`navItems` → grouped 데이터) | ~+40 / -15 |
| `src/components/shell/SidebarGroup.tsx` | 신규 | ~120 |
| `src/components/shell/sidebar-nav-data.ts` | 신규 (data 분리) | ~80 |
| `src/hooks/useSidebarCollapse.ts` | 신규 (localStorage hook) | ~40 |
| `src/app/(app)/reports/page.tsx` | 신규 (placeholder) | ~25 |
| `src/app/(app)/catalog/page.tsx` | 신규 (placeholder) | ~25 |
| `src/app/(app)/permissions/page.tsx` | 신규 (placeholder, role guard) | ~30 |
| `src/app/(app)/schedules/page.tsx` | 신규 (placeholder) | ~25 |
| `src/app/(app)/team/page.tsx` | 신규 (placeholder) | ~25 |
| `src/app/(app)/notifications/page.tsx` | 신규 (placeholder) | ~25 |

**총합**: 신규 7파일, 수정 1파일, 약 **+395 lines**

### 2.2 데이터 구조

```typescript
// src/components/shell/sidebar-nav-data.ts
import {
  Home, SquareTerminal, History, Star,
  LayoutDashboard, BarChart2, FileText,
  Table2, BookOpen, Database,
  Plug, Shield, Calendar, AlertTriangle,
  Users, User, Settings, Bell,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  countKey?: "saved";
  badge?: "soon" | "new";
};

export type NavGroup = {
  id: "workspace" | "insights" | "knowledge" | "sources" | "account";
  label: string;
  defaultOpen: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    defaultOpen: true,
    items: [
      { href: "/", icon: Home, label: "홈" },
      { href: "/workspace", icon: SquareTerminal, label: "워크스페이스" },
      { href: "/history", icon: History, label: "히스토리" },
      { href: "/saved", icon: Star, label: "저장됨", countKey: "saved" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    defaultOpen: true,
    items: [
      { href: "/dashboards", icon: LayoutDashboard, label: "대시보드" },
      { href: "/charts", icon: BarChart2, label: "차트" },
      { href: "/reports", icon: FileText, label: "리포트", badge: "soon" },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    defaultOpen: false,
    items: [
      { href: "/schema", icon: Table2, label: "스키마" },
      { href: "/glossary", icon: BookOpen, label: "용어 사전" },
      { href: "/catalog", icon: Database, label: "데이터 카탈로그", badge: "soon" },
    ],
  },
  {
    id: "sources",
    label: "Sources",
    defaultOpen: false,
    items: [
      { href: "/connections", icon: Plug, label: "연결" },
      { href: "/permissions", icon: Shield, label: "권한", badge: "soon" },
      { href: "/schedules", icon: Calendar, label: "스케줄", badge: "soon" },
      { href: "/errors", icon: AlertTriangle, label: "상태 · 에러" },
    ],
  },
  {
    id: "account",
    label: "Account",
    defaultOpen: false,
    items: [
      { href: "/team", icon: Users, label: "팀", badge: "soon" },
      { href: "/profile", icon: User, label: "프로필" },
      { href: "/settings", icon: Settings, label: "설정" },
      { href: "/notifications", icon: Bell, label: "알림", badge: "soon" },
    ],
  },
];
```

### 2.3 useSidebarCollapse Hook

```typescript
// src/hooks/useSidebarCollapse.ts
"use client";
import { useEffect, useState } from "react";

const KEY = "vibesql:sidebar:collapsed";
type Map = Record<string, boolean>;

export function useSidebarCollapse(defaults: Map) {
  // SSR-safe initial state = defaults
  const [collapsed, setCollapsed] = useState<Map>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCollapsed({ ...defaults, ...(JSON.parse(raw) as Map) });
    } catch { /* ignore */ }
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return { collapsed, toggle, hydrated };
}
```

### 2.4 SidebarGroup Component (스니펫 핵심부)

```tsx
// src/components/shell/SidebarGroup.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "./sidebar-nav-data";

interface Props {
  group: NavGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  savedCount?: number;
}

export function SidebarGroup({ group, isCollapsed, onToggle, savedCount }: Props) {
  const pathname = usePathname();

  return (
    <div style={{ marginBottom: "var(--ds-sp-2)" }}>
      <button
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={`nav-group-${group.id}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ds-sp-1)",
          width: "100%",
          padding: "var(--ds-sp-1) var(--ds-sp-3)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "var(--ds-fs-10)",
          fontWeight: "var(--ds-fw-semibold)",
          color: "var(--ds-text-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
        className="hover:text-text-mute"
      >
        <ChevronDown
          size={10}
          style={{
            transform: isCollapsed ? "rotate(-90deg)" : "none",
            transition: "transform var(--ds-dur-fast) var(--ds-ease)",
          }}
        />
        <span>{group.label}</span>
      </button>

      <div
        id={`nav-group-${group.id}`}
        hidden={isCollapsed}
        style={{ paddingLeft: 0 }}
      >
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            count={item.countKey === "saved" ? savedCount : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function NavLink({
  item, pathname, count,
}: { item: NavItem; pathname: string; count?: number }) {
  const isActive =
    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--ds-sp-2)",
        padding: "var(--ds-sp-1) var(--ds-sp-3)",
        borderRadius: "var(--ds-r-6)",
        fontSize: "var(--ds-fs-12)",
        color: isActive ? "var(--ds-text)" : "var(--ds-text-mute)",
        background: isActive ? "var(--ds-fill)" : "transparent",
        borderLeft: isActive ? "2px solid var(--ds-accent)" : "2px solid transparent",
        textDecoration: "none",
        marginBottom: "1px",
        opacity: item.badge === "soon" ? 0.6 : 1,
      }}
      className={cn("group", !isActive && "hover:bg-fill hover:text-text")}
    >
      <item.icon size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge === "soon" && (
        <span style={{
          fontSize: "var(--ds-fs-9)",
          color: "var(--ds-text-faint)",
          fontFamily: "var(--ds-font-mono)",
        }}>soon</span>
      )}
      {count != null && count > 0 && (
        <span style={{
          fontSize: "var(--ds-fs-9)",
          fontFamily: "var(--ds-font-mono)",
          color: "var(--ds-text-faint)",
          background: "var(--ds-fill)",
          borderRadius: "var(--ds-r-full)",
          padding: "1px 5px",
        }}>{count}</span>
      )}
    </Link>
  );
}
```

### 2.5 Sidebar.tsx 변경 핵심 (diff 요약)

```diff
- import { Home, SquareTerminal, ... } from "lucide-react";
- const navItems = [ ... ];
+ import { NAV_GROUPS } from "./sidebar-nav-data";
+ import { SidebarGroup } from "./SidebarGroup";
+ import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

  export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
+   const defaults = Object.fromEntries(
+     NAV_GROUPS.map((g) => [g.id, !g.defaultOpen])
+   );
+   const { collapsed, toggle } = useSidebarCollapse(defaults);
    // ... savedCount, connections 그대로 유지 ...

    return (
      <aside ...>
        {/* Workspace selector — 그대로 */}
        <nav style={{ flex: 1, padding: "var(--ds-sp-2)", overflowY: "auto" }}>
-         {navItems.map(...)}
+         {NAV_GROUPS.map((group) => (
+           <SidebarGroup
+             key={group.id}
+             group={group}
+             isCollapsed={collapsed[group.id] ?? false}
+             onToggle={() => toggle(group.id)}
+             savedCount={savedCount}
+           />
+         ))}
        </nav>
        {/* User card — 그대로 */}
      </aside>
    );
  }
```

### 2.6 Placeholder Page Template

```tsx
// src/app/(app)/reports/page.tsx (다른 placeholder도 동일 패턴)
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="리포트"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "Insights" }, { label: "리포트" }]}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        <Card>
          <div style={{
            padding: "var(--ds-sp-6)",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "var(--ds-sp-3)",
            color: "var(--ds-text-mute)",
          }}>
            <FileText size={32} style={{ color: "var(--ds-text-faint)" }} />
            <div style={{ fontSize: "var(--ds-fs-14)", color: "var(--ds-text)" }}>
              리포트 빌더 (준비 중)
            </div>
            <div style={{ fontSize: "var(--ds-fs-12)" }}>
              저장된 쿼리와 차트를 모아 정기 리포트로 만들 수 있게 됩니다.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

---

## 3. Phase B — AI Confidence Score + Explain 모드

### 3.1 변경 파일

| 파일 | 동작 | 라인 |
|---|---|---|
| `src/lib/ai/confidence.ts` | 신규 (매핑 유틸) | ~30 |
| `src/components/workspace/ConfidenceChip.tsx` | 신규 | ~70 |
| `src/app/(app)/workspace/page.tsx` | 수정 (칩 + Explain 버튼) | ~+30 |
| `src/app/api/queries/explain/route.ts` | 신규 | ~70 |
| `src/lib/claude/explain-sql.ts` | 신규 (provider abstraction reuse) | ~50 |
| `src/store/useWorkspaceStore.ts` | 수정 (confidence/percent 필드 추가) | ~+10 |

**총합**: 신규 4파일, 수정 2파일, 약 **+260 lines**

### 3.2 ConfidenceChip 컴포넌트

```tsx
// src/components/workspace/ConfidenceChip.tsx
"use client";
import { Info, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { confidenceToPercent, confidenceLabel } from "@/lib/ai/confidence";

interface Props {
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

export function ConfidenceChip({ confidence, warnings }: Props) {
  const pct = confidenceToPercent(confidence, warnings);
  const label = confidenceLabel(confidence);
  const Icon =
    confidence === "high" ? ShieldCheck :
    confidence === "medium" ? ShieldAlert : ShieldX;
  const color =
    confidence === "high" ? "var(--ds-success)" :
    confidence === "medium" ? "var(--ds-warn)" : "var(--ds-danger)";

  return (
    <div
      role="status"
      aria-label={`${label} ${pct}%`}
      title="AI 자체 평가 점수입니다. 결과를 항상 확인하세요."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--ds-sp-1)",
        padding: "2px var(--ds-sp-2)",
        borderRadius: "var(--ds-r-full)",
        background: "var(--ds-fill)",
        border: `1px solid ${color}`,
        fontSize: "var(--ds-fs-11)",
        color: "var(--ds-text)",
      }}
    >
      <Icon size={12} style={{ color }} />
      <span>{label}</span>
      <span style={{ fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-mute)" }}>
        {pct}%
      </span>
      <Info size={10} style={{ color: "var(--ds-text-faint)", marginLeft: 2 }} />
    </div>
  );
}
```

### 3.3 Workspace 페이지 통합 위치

워크스페이스 페이지 SQL 결과 영역의 헤더 부분 (현재 `Pill`, `Button` 그룹이 있는 곳)에 다음 순서로 배치:

```
[ConfidenceChip] [Explain 버튼] [Run 버튼] [Save 버튼] [Share 버튼(Phase C)]
```

`useWorkspaceStore` 확장:
```typescript
// store/useWorkspaceStore.ts (추가 필드)
interface WorkspaceState {
  // ... 기존 ...
  confidence: "high" | "medium" | "low" | null;
  warnings: string[];
  setGenerationMeta: (m: { confidence: "high" | "medium" | "low"; warnings?: string[] }) => void;
}
```

generate 응답 처리부에서:
```typescript
const result = await fetch("/api/queries/generate", { ... }).then(r => r.json());
setSql(result.data.sql);
setGenerationMeta({ confidence: result.data.confidence, warnings: result.data.warnings ?? [] });
```

### 3.4 /api/queries/explain Route

**목적**: 사용자가 이미 손으로 수정한 SQL이나 history에서 불러온 SQL에 대해 자연어 설명을 요청 (생성 시점의 explanation과 별개).

```typescript
// src/app/api/queries/explain/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { explainSql } from "@/lib/claude/explain-sql";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/auth/require-user";

const BodySchema = z.object({
  sql: z.string().min(1).max(10_000),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]).default("postgresql"),
  schemaContext: z.string().optional(),
});

const EXPLAIN_LIMIT = 30;
const EXPLAIN_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip, EXPLAIN_LIMIT, EXPLAIN_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const explanation = await explainSql(parsed.data);
    return NextResponse.json({ data: { explanation } });
  } catch (err) {
    console.error("[explain] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "설명 생성에 실패했습니다." }, { status: 500 });
  }
}
```

### 3.5 explain-sql.ts (provider 재사용)

```typescript
// src/lib/claude/explain-sql.ts
// nl2sql.ts와 동일한 provider 추상화 사용 (DB-active 우선, env fallback)
import type { Nl2SqlOptions } from "./nl2sql";

interface ExplainOptions {
  sql: string;
  dialect: Nl2SqlOptions["dialect"];
  schemaContext?: string;
}

export async function explainSql(opts: ExplainOptions): Promise<string> {
  const system = `You are a SQL teacher. Explain SQL queries in clear Korean for non-developers.
Keep explanations under 5 sentences. Use simple language. Mention any risks (full table scan, etc.) if visible.`;
  const user = `Explain this ${opts.dialect} SQL in Korean:

\`\`\`sql
${opts.sql}
\`\`\`
${opts.schemaContext ? `\nSchema:\n${opts.schemaContext}` : ""}

Respond with plain text Korean only (no markdown, no code blocks).`;

  // Reuse provider routing — call the same generateXxx helpers via a thin wrapper.
  // Implementation: factor `runProviderText(system, user)` from nl2sql.ts, return content.text.
  // (See nl2sql.ts for the existing pattern — this avoids duplication.)
  const { runProviderText } = await import("./provider-runner");
  return runProviderText({ system, user, maxTokens: 512, temperature: 0.4 });
}
```

> **Refactor note for frontend-architect**: factor the common provider routing in `nl2sql.ts` (DB-active → LMStudio env → Anthropic env) into `lib/claude/provider-runner.ts` with a single export `runProviderText({ system, user, maxTokens, temperature }): Promise<string>`. Then both `nl2sql.ts` and `explain-sql.ts` consume it. **Do not duplicate the provider switch.**

### 3.6 Workspace 페이지의 Explain 버튼 동작

- "Explain" 버튼 클릭 → `useMutation`으로 `/api/queries/explain` 호출
- 응답을 `explanation` state에 저장 + `activeTab = "explain"` 자동 전환
- 이미 `MessageSquare` icon, `setExplanation` state, "explain" 탭이 페이지에 존재 — UI 노출과 mutation만 추가하면 됨

---

## 4. Phase C — 공유 링크

### 4.1 변경 파일

| 파일 | 동작 | 라인 |
|---|---|---|
| `prisma/schema.prisma` | 수정 (`SharedLink` 모델 추가) | ~+25 |
| `prisma/migrations/{ts}_add_shared_links/migration.sql` | 신규 (수동 또는 prisma migrate) | ~30 |
| `src/app/api/share/route.ts` | 신규 (POST: 생성, GET: 내 링크 목록) | ~110 |
| `src/app/api/share/[token]/route.ts` | 신규 (GET: 메타, DELETE: revoke) | ~70 |
| `src/app/share/[token]/page.tsx` | 신규 (공개 라우트 — `(app)` 그룹 밖) | ~150 |
| `src/components/share/ShareDialog.tsx` | 신규 | ~180 |
| `src/lib/share/snapshot.ts` | 신규 (스냅샷 직렬화) | ~50 |
| `src/app/(app)/workspace/page.tsx` | 수정 (Share 버튼 + Dialog) | ~+20 |

**총합**: 신규 7파일, 수정 2파일, 약 **+635 lines**

### 4.2 Prisma 모델

```prisma
// prisma/schema.prisma — User 모델 relation 추가 + 신규 모델
model User {
  // ... 기존 필드 ...
  sharedLinks  SharedLink[]
}

model SharedLink {
  id            String           @id @default(cuid())
  token         String           @unique               // crypto.randomUUID()
  resourceType  SharedResourceType @map("resource_type")
  resourceId    String?          @map("resource_id")  // null when payload-only snapshot
  payload       Json?                                  // {sql, columns, rows, rowCount, durationMs, dialect, ...}
  expiresAt     DateTime?        @map("expires_at")
  revokedAt     DateTime?        @map("revoked_at")
  accessCount   Int              @default(0) @map("access_count")
  lastAccessedAt DateTime?       @map("last_accessed_at")
  createdAt     DateTime         @default(now()) @map("created_at")

  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("shared_links")
}

enum SharedResourceType {
  query        // SavedQuery 참조
  dashboard    // Dashboard 참조
  snapshot     // payload만 (즉석 결과 공유)
}
```

### 4.3 POST /api/share

```typescript
// src/app/api/share/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";

const BodySchema = z.object({
  resourceType: z.enum(["query", "dashboard", "snapshot"]),
  resourceId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]).default(7),
});

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth; // requireUserId returns string when not NextResponse

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Constraint: snapshot must have payload, query/dashboard must have resourceId
  if (parsed.data.resourceType === "snapshot" && !parsed.data.payload) {
    return NextResponse.json({ error: "snapshot requires payload" }, { status: 400 });
  }
  if (parsed.data.resourceType !== "snapshot" && !parsed.data.resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const link = await prisma.sharedLink.create({
    data: {
      token,
      userId,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      payload: parsed.data.payload as never,
      expiresAt,
    },
  });

  return NextResponse.json({
    data: {
      token: link.token,
      url: `/share/${link.token}`,
      expiresAt: link.expiresAt,
    },
  });
}

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const links = await prisma.sharedLink.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ data: links });
}
```

### 4.4 GET /api/share/[token] (공개)

```typescript
// src/app/api/share/[token]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`share:${ip}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const { token } = await ctx.params;
  const link = await prisma.sharedLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // Async-update — fire-and-forget, no await
  prisma.sharedLink.update({
    where: { id: link.id },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  }).catch(() => { /* non-fatal */ });

  // Resolve resource (snapshot → return payload, query/dashboard → fetch then strip secrets)
  let body: Record<string, unknown> = {
    resourceType: link.resourceType,
    payload: link.payload,
  };

  if (link.resourceType === "query" && link.resourceId) {
    const q = await prisma.savedQuery.findUnique({
      where: { id: link.resourceId },
      select: { name: true, description: true, sql: true, dialect: true, nlQuery: true },
    });
    body = { ...body, resource: q };
  }
  // ... dashboard handling similar ...

  return NextResponse.json({ data: body });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  // requireUserId + ownership check
  // ... revoke (set revokedAt = now()) ...
}
```

### 4.5 /share/[token] 공개 페이지

> **중요**: 이 라우트는 `(app)` 그룹 **밖**에 두어야 함. `(app)/layout.tsx`에 인증 가드/Sidebar가 있다면 공유 페이지는 그것을 상속하지 않아야 한다.

```tsx
// src/app/share/[token]/page.tsx
import { notFound } from "next/navigation";
import { ResultTable } from "@/components/workspace/ResultTable";

interface Props { params: Promise<{ token: string }> }

async function fetchShare(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/share/${token}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) notFound();

  // Render snapshot or resource (read-only, no execute button, no auth chrome)
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ds-bg)",
      color: "var(--ds-text)",
      padding: "var(--ds-sp-6)",
    }}>
      <header style={{ marginBottom: "var(--ds-sp-6)" }}>
        <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
          vibeSQL 공유
        </div>
        <h1 style={{ fontSize: "var(--ds-fs-20)", margin: 0 }}>
          {/* title from resource or snapshot */}
        </h1>
      </header>
      {/* ResultTable (read-only) */}
      {/* SQL preview (read-only CodeMirror) */}
      <footer style={{
        marginTop: "var(--ds-sp-8)",
        fontSize: "var(--ds-fs-11)",
        color: "var(--ds-text-faint)",
      }}>
        이 페이지는 vibeSQL에서 공유된 결과 스냅샷입니다. SQL은 재실행되지 않습니다.
      </footer>
    </div>
  );
}
```

### 4.6 ShareDialog (워크스페이스)

- "공유" 버튼 클릭 → ShareDialog 모달 오픈
- 옵션: 만료 (1d/7d/30d/never), 공유 모드 (snapshot=결과 포함 / query=SQL만)
- 생성 후 URL을 클립보드에 복사 + 모달에 표시
- 좌측 하단에 "내 공유 링크 목록" 보기 (혹은 향후 `/share/manage`)

---

## 5. 우선순위 및 예상 소요 시간

> 단위: 사람-시간 (인간 개발자 1인 기준). frontend-architect agent의 자동화 효율을 가정하면 약 30~50% 단축 가능.

| Phase | 작업 | 의존성 | 예상 |
|---|---|---|---|
| **A.1** | Sidebar 데이터/그룹 컴포넌트 (1-3 파일) | - | 2h |
| **A.2** | useSidebarCollapse hook + localStorage SSR 안전성 검증 | A.1 | 1h |
| **A.3** | 6개 placeholder 페이지 (template 복사) | - (병렬) | 1h |
| **A.4** | Sidebar.tsx 통합 + 토큰 검증 + 빌드 | A.1, A.2, A.3 | 1h |
| **Phase A 합계** | | | **5h** |
| **B.1** | `lib/ai/confidence.ts` + `ConfidenceChip` 컴포넌트 | - | 1h |
| **B.2** | `provider-runner.ts` 추출 + `nl2sql.ts` 리팩터링 | - | 2h |
| **B.3** | `/api/queries/explain` + `explain-sql.ts` | B.2 | 1.5h |
| **B.4** | Workspace 페이지 통합 (칩 + Explain 버튼 mutation + store 확장) | B.1, B.3 | 2h |
| **Phase B 합계** | | A 완료 권장(병렬 가능) | **6.5h** |
| **C.1** | Prisma 스키마 + 마이그레이션 + `prisma generate` | - | 1h |
| **C.2** | `/api/share` POST/GET + `/api/share/[token]` GET/DELETE | C.1 | 3h |
| **C.3** | `/share/[token]/page.tsx` 공개 라우트 + 스냅샷 직렬화 | C.2 | 3h |
| **C.4** | ShareDialog + Workspace 통합 + 테스트 | C.2, C.3 | 2.5h |
| **Phase C 합계** | | | **9.5h** |
| **총합** | | | **21h** (~3 working days) |

### 권장 실행 순서

1. **Day 1**: Phase A 전체 (UI 우선, 즉시 가시성 — 사용자 만족도 ↑)
2. **Day 2**: Phase B (AI 신뢰도 — 비교적 단순, provider-runner 리팩터링이 핵심)
3. **Day 3**: Phase C (공유 링크 — DB 마이그레이션 포함, 마지막 배치)

> Phase A와 B는 파일 충돌이 거의 없으므로 frontend-architect가 병렬 실행 가능.
> Phase C는 Prisma 마이그레이션이 필요하므로 사용자(=DB owner)와 합의 후 진행.

---

## 6. 검증 체크리스트 (Definition of Done)

### Phase A
- [ ] `pnpm build` 클린 (TypeScript strict, no lint warnings)
- [ ] Sidebar 5그룹 헤더 보임, 클릭 시 접기/펼치기
- [ ] localStorage `vibesql:sidebar:collapsed` 정상 저장/복원
- [ ] 페이지 새로고침 후 hydration mismatch 없음 (콘솔 무경고)
- [ ] 모든 placeholder 페이지가 200 (404 없음)
- [ ] 디자인 토큰 위반 없음 (`#`, `text-gray-`, `bg-white` 등 grep로 검증)
- [ ] `aria-expanded` 토글 동작 (a11y)

### Phase B
- [ ] 워크스페이스에서 SQL 생성 후 ConfidenceChip 표시
- [ ] tooltip 노출 ("AI 자체 평가 점수입니다…")
- [ ] Explain 버튼 클릭 → `/api/queries/explain` 200, explain 탭 자동 전환
- [ ] Rate limit (30/min) 적용 — 429 응답 확인
- [ ] `provider-runner.ts` 리팩터링 후 nl2sql 기존 동작 회귀 없음

### Phase C
- [ ] `prisma migrate dev` 성공
- [ ] POST /api/share → token + url 반환
- [ ] `/share/[token]` 200 (snapshot)
- [ ] `/share/[token]` after revoke → 404
- [ ] `/share/[token]` after expire → 410
- [ ] 공유 페이지에 인증 chrome (Sidebar/TopBar) 노출 안 됨
- [ ] 공유 페이지에 SQL 재실행 버튼 없음 (read-only)
- [ ] rate limit 60/min 동작

---

## 7. 위험 및 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Sidebar localStorage SSR mismatch | hydration warning, 깜빡임 | 초기값을 `defaultOpen`으로 고정, mount 후에만 localStorage 동기화. `suppressHydrationWarning`은 사용 X (근본 해결). |
| `provider-runner.ts` 리팩터링이 nl2sql 회귀 유발 | 기존 NL→SQL 동작 깨짐 | 리팩터링 PR을 별도 커밋으로 분리. nl2sql.test.ts 추가 (best-effort). |
| Prisma 마이그레이션이 production DB와 충돌 | 데이터 손실 | dev 환경에서 `prisma migrate dev` → 검토 → staging 적용 후 prod. SQL 직접 실행 금지. |
| 공유 페이지에서 PII 노출 | 보안 사고 | snapshot 생성 시 `payload.rows` 길이 제한 (예: 1000행, 50컬럼). 사용자에게 모달에서 "공유될 데이터 미리보기" 표시. |
| confidence over-trust | 사용자가 잘못된 SQL을 실행 | 칩 옆 info icon + tooltip 명시. SQL 가드(SELECT-only)는 그대로 유지. |
| 신규 placeholder 라우트가 RBAC 없이 노출 | enterprise 정책 위반 가능성 | `/permissions` 페이지에 향후 role guard hook 자리만 마련 (`useRole().requireRole("ADMIN")` placeholder). 실제 가드는 별도 PDCA. |

---

## 8. frontend-architect 인계 사항

1. **순서 엄수**: Phase A → B → C. 각 Phase는 독립적으로 빌드 클린 상태로 마무리할 것.
2. **provider-runner 리팩터링 우선**: Phase B 들어가기 전에 `lib/claude/provider-runner.ts` 추출. nl2sql/explain-sql 양쪽이 의존.
3. **디자인 토큰 강제**: `apps/web/CLAUDE.md`의 "Token-Only Styling" 규칙 절대 준수. `#`, `text-gray-`, `dark:` 사용 금지.
4. **client/server 경계**: 공유 페이지(`/share/[token]`)는 server component default + 결과 테이블만 client. 인증 가드 상속 안 됨에 유의.
5. **테스트**: 각 Phase 종료 시 `pnpm build` + 수동 스모크 테스트. E2E는 별도 PDCA로 다룸.
6. **PDCA 다음 단계**: Phase A 종료 후 `/pdca analyze menu-restructure`, B/C도 각각 분리하여 분석.

---

**End of CTO Implementation Plan**
