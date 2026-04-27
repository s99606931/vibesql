"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import {
  Plug,
  Cpu,
  SquareTerminal,
  Table2,
  BookOpen,
  BarChart2,
  LayoutDashboard,
  History,
  Star,
  Settings,
  CheckCircle2,
  Circle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

// ─── 워크플로 스텝 ─────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "데이터베이스 연결",
    desc: "PostgreSQL, MySQL, SQLite 등 사용할 DB를 연결합니다.",
    href: "/connections",
    icon: Plug,
    checkKey: "connections" as const,
  },
  {
    step: 2,
    title: "AI 프로바이더 설정",
    desc: "Anthropic, Ollama, LM Studio 등 SQL 생성에 사용할 AI를 설정합니다.",
    href: "/settings",
    icon: Cpu,
    checkKey: "ai-providers" as const,
  },
  {
    step: 3,
    title: "자연어로 SQL 생성",
    desc: "워크스페이스에서 한국어로 질문하면 AI가 SQL을 자동 생성합니다.",
    href: "/workspace",
    icon: SquareTerminal,
    checkKey: null,
  },
];

// ─── 메뉴 가이드 ───────────────────────────────────────────────────────────────

const MENU_GUIDES = [
  {
    href: "/workspace",
    icon: SquareTerminal,
    label: "워크스페이스",
    summary: "자연어 → SQL 생성 · 실행",
    guide: [
      "상단 드롭다운에서 연결할 데이터베이스를 선택하세요.",
      "입력창에 한국어로 질문을 입력하면 AI가 SQL을 생성합니다.",
      "생성된 SQL을 편집하거나 즉시 실행할 수 있습니다.",
      "결과는 테이블 또는 차트로 확인할 수 있습니다.",
    ],
  },
  {
    href: "/connections",
    icon: Plug,
    label: "연결",
    summary: "데이터베이스 연결 관리",
    guide: [
      "'새 연결 추가' 버튼으로 DB 접속 정보를 입력합니다.",
      "연결 테스트로 접속 가능 여부를 미리 확인하세요.",
      "여러 DB를 등록하고 워크스페이스에서 전환할 수 있습니다.",
      "지원: PostgreSQL, MySQL, SQLite, MS SQL, Oracle",
    ],
  },
  {
    href: "/schema",
    icon: Table2,
    label: "스키마",
    summary: "DB 테이블 구조 탐색",
    guide: [
      "연결된 DB의 테이블과 컬럼을 한눈에 확인합니다.",
      "테이블 카드를 클릭하면 SELECT 쿼리가 자동 생성됩니다.",
      "PII(개인정보) 포함 여부 필터로 민감 데이터를 구분합니다.",
      "스키마 정보는 AI SQL 생성의 컨텍스트로 자동 활용됩니다.",
    ],
  },
  {
    href: "/glossary",
    icon: BookOpen,
    label: "용어 사전",
    summary: "비즈니스 용어 정의 관리",
    guide: [
      "자주 쓰는 비즈니스 용어와 컬럼 별칭을 등록합니다.",
      "등록된 용어는 AI SQL 생성 시 자동으로 참조됩니다.",
      "예: '결제율' = conversion_rate, '활성 사용자' = is_active=true",
      "용어집이 풍부할수록 SQL 생성 정확도가 높아집니다.",
    ],
  },
  {
    href: "/charts",
    icon: BarChart2,
    label: "결과 · 차트",
    summary: "쿼리 결과 시각화",
    guide: [
      "워크스페이스에서 실행한 결과를 차트로 전환합니다.",
      "막대, 선, 원형 등 다양한 차트 유형을 선택할 수 있습니다.",
      "차트를 대시보드에 추가해 모아볼 수 있습니다.",
    ],
  },
  {
    href: "/dashboards",
    icon: LayoutDashboard,
    label: "대시보드",
    summary: "차트 모음 · 공유",
    guide: [
      "여러 차트를 묶어 대시보드를 구성합니다.",
      "대시보드를 공개(Public)로 설정해 링크로 공유할 수 있습니다.",
      "위젯을 추가하거나 삭제해 레이아웃을 커스터마이즈합니다.",
    ],
  },
  {
    href: "/history",
    icon: History,
    label: "히스토리",
    summary: "실행 기록 조회",
    guide: [
      "실행한 모든 SQL 쿼리 기록을 확인합니다.",
      "성공/실패/차단 상태로 필터링할 수 있습니다.",
      "별표를 눌러 중요한 쿼리를 즐겨찾기합니다.",
      "쿼리를 클릭하면 워크스페이스에서 재실행할 수 있습니다.",
    ],
  },
  {
    href: "/saved",
    icon: Star,
    label: "저장됨",
    summary: "자주 쓰는 쿼리 보관",
    guide: [
      "워크스페이스에서 '저장' 버튼으로 쿼리를 저장합니다.",
      "폴더로 분류해 쿼리를 체계적으로 관리하세요.",
      "저장된 쿼리를 클릭하면 즉시 워크스페이스에서 실행됩니다.",
    ],
  },
  {
    href: "/settings",
    icon: Settings,
    label: "설정",
    summary: "AI · 외관 · 알림 구성",
    guide: [
      "AI 설정: SQL 생성에 사용할 AI 프로바이더를 추가·관리합니다.",
      "외관: 테마 색상, 다크/라이트 모드, 밀도를 조정합니다.",
      "보안: 세션 타임아웃을 설정합니다 (기본: SELECT 전용).",
      "알림: 쿼리 성공·실패·장시간 실행 알림을 켜고 끕니다.",
    ],
  },
];

// ─── Status types ─────────────────────────────────────────────────────────────

type CheckStatus = "loading" | "ok" | "empty" | "error";

// ─── Guide accordion item ─────────────────────────────────────────────────────

function GuideItem({
  item,
  defaultOpen = false,
}: {
  item: (typeof MENU_GUIDES)[number];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = item.icon;
  const panelId = `guide-panel-${item.label.replace(/\s+/g, "-").replace(/·/g, "")}`;
  return (
    <div
      style={{
        border: "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${item.label} ${open ? "접기" : "펼치기"}`}
        onClick={() => setOpen((v) => !v)}
        className={open ? undefined : "hover:bg-fill transition-colors"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ds-sp-3)",
          width: "100%",
          padding: "var(--ds-sp-3) var(--ds-sp-4)",
          background: open ? "var(--ds-fill)" : "var(--ds-surface)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--ds-font-sans)",
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--ds-r-6)",
            background: "var(--ds-accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon aria-hidden="true" size={15} style={{ color: "var(--ds-accent)" }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--ds-fs-13)",
              fontWeight: "var(--ds-fw-medium)",
              color: "var(--ds-text)",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-mute)",
              marginTop: 1,
            }}
          >
            {item.summary}
          </span>
        </span>
        <Link
          href={item.href}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: "var(--ds-fs-11)",
            color: "var(--ds-accent)",
            textDecoration: "none",
            padding: "2px 8px",
            borderRadius: "var(--ds-r-6)",
            border: "1px solid var(--ds-accent-soft)",
            flexShrink: 0,
          }}
        >
          이동
        </Link>
        <span style={{ color: "var(--ds-text-faint)", flexShrink: 0 }}>
          {open ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
        </span>
      </button>
      <div
          id={panelId}
          hidden={!open}
          style={{
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            borderTop: "1px solid var(--ds-border)",
            background: "var(--ds-bg)",
          }}
        >
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {item.guide.map((tip, i) => (
              <li
                key={i}
                style={{ display: "flex", gap: "var(--ds-sp-2)", alignItems: "flex-start" }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "var(--ds-r-full)",
                    background: "var(--ds-fill)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "var(--ds-fs-9)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: "var(--ds-accent)",
                    flexShrink: 0,
                    marginTop: 1,
                    fontFamily: "var(--ds-font-mono)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: "var(--ds-fs-12)",
                    color: "var(--ds-text-mute)",
                    lineHeight: 1.5,
                  }}
                >
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: connections, isLoading: connLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const r = await fetch("/api/connections");
      if (!r.ok) throw new Error("Failed to fetch connections");
      const j = await r.json() as { data?: unknown[] };
      return j.data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: aiProviders, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const r = await fetch("/api/ai-providers");
      if (!r.ok) throw new Error("Failed to fetch AI providers");
      const j = await r.json() as { data?: unknown[] };
      return j.data ?? [];
    },
    staleTime: 30_000,
  });

  function getStatus(key: "connections" | "ai-providers"): CheckStatus {
    if (key === "connections") {
      if (connLoading) return "loading";
      return (connections?.length ?? 0) > 0 ? "ok" : "empty";
    }
    if (aiLoading) return "loading";
    return (aiProviders?.length ?? 0) > 0 ? "ok" : "empty";
  }

  const connStatus = getStatus("connections");
  const aiStatus = getStatus("ai-providers");

  const completedSteps = [connStatus === "ok", aiStatus === "ok"].filter(Boolean).length;
  const allReady = connStatus === "ok" && aiStatus === "ok";

  function nextAction(): { label: string; href: string } {
    if (connStatus !== "ok") return { label: "연결 추가하기", href: "/connections" };
    if (aiStatus !== "ok") return { label: "AI 프로바이더 설정하기", href: "/settings" };
    return { label: "워크스페이스에서 시작하기", href: "/workspace" };
  }

  const next = nextAction();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="홈"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "홈" }]}
      />

      <div aria-busy={connLoading || aiLoading} aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: "var(--ds-sp-6)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--ds-sp-6)" }}>

          {/* ── 헤더 ─────────────────────────────────────────────────────── */}
          <div>
            <h1
              style={{
                fontSize: "var(--ds-fs-22)",
                fontWeight: "var(--ds-fw-bold)",
                color: "var(--ds-text)",
                margin: 0,
                marginBottom: "var(--ds-sp-2)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              vibeSQL 시작 가이드
            </h1>
            <p
              style={{
                fontSize: "var(--ds-fs-13)",
                color: "var(--ds-text-mute)",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              자연어로 질문하면 AI가 SQL을 자동 생성하고 실행합니다.
              아래 3단계를 완료하면 바로 시작할 수 있습니다.
            </p>
          </div>

          {/* ── 진행 상태 요약 ────────────────────────────────────────────── */}
          <div
            style={{
              background: allReady ? "var(--ds-success-soft, var(--ds-accent-soft))" : "var(--ds-fill)",
              border: `1px solid ${allReady ? "var(--ds-success, var(--ds-accent))" : "var(--ds-border)"}`,
              borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-4)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "var(--ds-fs-13)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: allReady ? "var(--ds-success, var(--ds-accent))" : "var(--ds-text)",
                  marginBottom: 4,
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                {allReady ? "설정 완료 — 바로 사용 가능합니다" : `준비 중 (${completedSteps}/2 단계 완료)`}
              </div>
              <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>
                {allReady
                  ? "연결과 AI 프로바이더가 설정되었습니다. 워크스페이스에서 SQL을 생성해보세요."
                  : "아래 단계를 완료하면 자연어 SQL 생성을 시작할 수 있습니다."}
              </div>
            </div>
            <Link href={next.href} style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="accent" size="sm" icon={<ArrowRight size={13} />}>
                {next.label}
              </Button>
            </Link>
          </div>

          {/* ── 워크플로 3단계 ────────────────────────────────────────────── */}
          <div>
            <div
              style={{
                fontSize: "var(--ds-fs-12)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-3)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              시작 단계
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
              {WORKFLOW_STEPS.map((s) => {
                const Icon = s.icon;
                const status: CheckStatus =
                  s.checkKey === null
                    ? "ok"
                    : s.checkKey === "connections"
                    ? connStatus
                    : aiStatus;
                const done = status === "ok";
                const loading = status === "loading";

                return (
                  <div
                    key={s.step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-4)",
                      padding: "var(--ds-sp-4)",
                      border: `1px solid ${done ? "var(--ds-accent-soft)" : "var(--ds-border)"}`,
                      borderRadius: "var(--ds-r-8)",
                      background: done ? "var(--ds-surface)" : "var(--ds-bg)",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {/* Step number / status icon */}
                    <div style={{ flexShrink: 0, position: "relative" }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--ds-r-full)",
                          background: done ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "var(--ds-fs-13)",
                          fontWeight: "var(--ds-fw-bold)",
                          color: done ? "var(--ds-accent)" : "var(--ds-text-faint)",
                          fontFamily: "var(--ds-font-mono)",
                        }}
                      >
                        {loading ? (
                          <Circle role="img" aria-label="로딩 중" size={16} style={{ color: "var(--ds-text-faint)" }} />
                        ) : done ? (
                          <CheckCircle2 role="img" aria-label="완료" size={18} style={{ color: "var(--ds-accent)" }} />
                        ) : (
                          s.step
                        )}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: 2 }}>
                        <Icon aria-hidden="true" size={14} style={{ color: "var(--ds-text-mute)", flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: "var(--ds-fs-13)",
                            fontWeight: "var(--ds-fw-semibold)",
                            color: "var(--ds-text)",
                            fontFamily: "var(--ds-font-sans)",
                          }}
                        >
                          {s.title}
                        </span>
                        {done && s.checkKey && (
                          <Pill variant="success" dot="ok">완료</Pill>
                        )}
                        {!done && !loading && s.checkKey && (
                          <Pill variant="warn">
                            {s.checkKey === "connections"
                              ? "연결 없음"
                              : "프로바이더 없음"}
                          </Pill>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--ds-fs-12)",
                          color: "var(--ds-text-mute)",
                          lineHeight: 1.5,
                        }}
                      >
                        {s.desc}
                      </div>
                    </div>

                    {/* Action */}
                    {!done && !loading && s.checkKey && (
                      <Link href={s.href} style={{ textDecoration: "none", flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" icon={<ArrowRight size={11} />}>
                          {s.checkKey === "connections" ? "연결 추가" : "설정하기"}
                        </Button>
                      </Link>
                    )}
                    {done && s.checkKey && (
                      <Link href={s.href} style={{ textDecoration: "none", flexShrink: 0 }}>
                        <Button variant="ghost" size="sm">
                          관리
                        </Button>
                      </Link>
                    )}
                    {s.checkKey === null && (
                      <Link href={s.href} style={{ textDecoration: "none", flexShrink: 0 }}>
                        <Button variant={allReady ? "accent" : "ghost"} size="sm" icon={<ArrowRight size={11} />}>
                          열기
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 빠른 상태 정보 ────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--ds-sp-3)",
            }}
          >
            <StatusCard
              icon={<Plug size={14} />}
              label="연결된 DB"
              value={connLoading ? "—" : `${connections?.length ?? 0}개`}
              status={connStatus}
              href="/connections"
              emptyMsg="연결을 추가하세요"
            />
            <StatusCard
              icon={<Cpu size={14} />}
              label="AI 프로바이더"
              value={aiLoading ? "—" : `${aiProviders?.length ?? 0}개`}
              status={aiStatus}
              href="/settings"
              emptyMsg="AI 설정이 필요합니다"
            />
          </div>

          {/* ── 통계 + 최근 쿼리 ──────────────────────────────────────────── */}
          <StatsSection />

          {/* ── 메뉴별 사용 가이드 ────────────────────────────────────────── */}
          <div>
            <div
              style={{
                fontSize: "var(--ds-fs-12)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-3)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              메뉴별 사용 가이드
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
              {MENU_GUIDES.map((item, idx) => (
                <GuideItem key={item.href} item={item} defaultOpen={idx === 0} />
              ))}
            </div>
          </div>

          {/* ── 도움말 푸터 ───────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              padding: "var(--ds-sp-3) var(--ds-sp-4)",
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)",
            }}
          >
            <AlertCircle aria-hidden="true" size={14} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)" }}>
              명령 팔레트(⌘K)로 어디서든 빠르게 이동하고 검색할 수 있습니다.
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── StatsSection ─────────────────────────────────────────────────────────────

type StatsData = {
  totalQueries: number;
  successRate: number;
  totalSaved: number;
  avgDurationMs: number;
};

type HistoryItem = {
  id: string;
  nlQuery?: string;
  sql: string;
  status: string;
  createdAt: string;
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "방금 전";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffMs / 86_400_000);
  return `${diffDay}일 전`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    SUCCESS: {
      label: "성공",
      color: "var(--ds-success)",
      bg: "color-mix(in srgb, var(--ds-success) 12%, transparent)",
    },
    ERROR: {
      label: "오류",
      color: "var(--ds-danger)",
      bg: "color-mix(in srgb, var(--ds-danger) 12%, transparent)",
    },
    BLOCKED: {
      label: "차단",
      color: "var(--ds-warn)",
      bg: "color-mix(in srgb, var(--ds-warn) 12%, transparent)",
    },
  };
  const s = map[status] ?? { label: status, color: "var(--ds-text-mute)", bg: "var(--ds-fill)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 8px",
        borderRadius: "var(--ds-r-full)",
        fontSize: "var(--ds-fs-10)",
        fontWeight: "var(--ds-fw-semibold)",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}`,
        flexShrink: 0,
        opacity: 0.85,
        fontFamily: "var(--ds-font-sans)",
      }}
    >
      {s.label}
    </span>
  );
}

function StatsSection() {
  const router = useRouter();
  const { setSql, setNlQuery, setStatus } = useWorkspaceStore();
  const [copiedHistId, setCopiedHistId] = useState<string | null>(null);
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats");
      if (!r.ok) throw new Error("Failed to fetch stats");
      const j = await r.json() as { data?: StatsData };
      return j.data ?? null;
    },
    staleTime: 30_000,
  });

  const { data: recentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["history-recent"],
    queryFn: async () => {
      const r = await fetch("/api/history?limit=3");
      if (!r.ok) throw new Error("Failed to fetch history");
      const j = await r.json() as { data?: HistoryItem[] };
      return j.data ?? [];
    },
    staleTime: 30_000,
  });

  const statCards = [
    {
      label: "전체 쿼리",
      value: stats ? `${stats.totalQueries}개` : "—",
      icon: <BarChart2 size={14} />,
      href: "/history",
    },
    {
      label: "성공률",
      value: stats ? `${stats.successRate}%` : "—",
      icon: <TrendingUp size={14} />,
      href: "/history",
    },
    {
      label: "저장된 쿼리",
      value: stats ? `${stats.totalSaved}개` : "—",
      icon: <Star size={14} />,
      href: "/saved",
    },
    {
      label: "평균 실행 시간",
      value: stats ? `${stats.avgDurationMs}ms` : "—",
      icon: <Clock size={14} />,
      href: "/history",
    },
  ];

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "var(--ds-fs-12)",
    fontWeight: "var(--ds-fw-semibold)",
    color: "var(--ds-text-mute)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "var(--ds-sp-3)",
    fontFamily: "var(--ds-font-sans)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>
      {/* 통계 카드 2×2 */}
      <div>
        <div style={sectionHeaderStyle}>사용 통계</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--ds-sp-3)",
          }}
        >
          {statCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="hover:border-border-strong"
              style={{
                padding: "var(--ds-sp-4)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-8)",
                background: "var(--ds-surface)",
                display: "block",
                textDecoration: "none",
                transition: "border-color var(--ds-dur-fast) var(--ds-ease)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  marginBottom: "var(--ds-sp-2)",
                }}
              >
                <span aria-hidden="true" style={{ color: "var(--ds-text-mute)" }}>{card.icon}</span>
                <span
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    color: "var(--ds-text-mute)",
                    fontFamily: "var(--ds-font-sans)",
                  }}
                >
                  {card.label}
                </span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : statsError ? (
                <div role="alert" style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-danger)", marginTop: 4 }}>오류</div>
              ) : (
                <div
                  style={{
                    fontSize: "var(--ds-fs-22)",
                    fontWeight: "var(--ds-fw-bold)",
                    color: "var(--ds-text)",
                    fontFamily: "var(--ds-font-mono)",
                    lineHeight: 1,
                  }}
                >
                  {card.value}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 쿼리 3개 */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--ds-sp-3)",
          }}
        >
          <div style={sectionHeaderStyle as React.CSSProperties}>최근 쿼리</div>
          <Link
            href="/history"
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-accent)",
              textDecoration: "none",
            }}
          >
            히스토리 더 보기 →
          </Link>
        </div>

        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : !recentHistory || recentHistory.length === 0 ? (
          <div
            style={{
              padding: "var(--ds-sp-4)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-surface)",
              color: "var(--ds-text-faint)",
              fontSize: "var(--ds-fs-12)",
              textAlign: "center",
            }}
          >
            <div>아직 실행된 쿼리가 없습니다.</div>
            <Link href="/workspace" style={{ display: "inline-block", marginTop: "var(--ds-sp-2)", fontSize: "var(--ds-fs-12)", color: "var(--ds-accent)" }}>
              워크스페이스로 이동 →
            </Link>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            {recentHistory.map((item, idx) => {
              const preview = (item.nlQuery || item.sql).slice(0, 60);
              const isTruncated = (item.nlQuery || item.sql).length > 60;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`워크스페이스에서 열기: ${item.nlQuery || item.sql}`}
                  onClick={() => {
                    if (item.nlQuery) setNlQuery(item.nlQuery);
                    setSql(item.sql);
                    setStatus("ready");
                    router.push("/workspace");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (item.nlQuery) setNlQuery(item.nlQuery);
                      setSql(item.sql);
                      setStatus("ready");
                      router.push("/workspace");
                    }
                  }}
                  className="group hover:bg-fill transition-colors"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-3)",
                    padding: "var(--ds-sp-3) var(--ds-sp-4)",
                    background: "var(--ds-surface)",
                    borderTop: idx > 0 ? "1px solid var(--ds-border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <span
                    title={item.nlQuery || item.sql}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "var(--ds-fs-12)",
                      color: "var(--ds-text)",
                      fontFamily: item.nlQuery ? "var(--ds-font-sans)" : "var(--ds-font-mono)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {preview}{isTruncated ? "..." : ""}
                  </span>
                  <span
                    title={new Date(item.createdAt).toLocaleString("ko-KR")}
                    style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", flexShrink: 0, fontFamily: "var(--ds-font-mono)" }}
                  >
                    {formatRelativeTime(item.createdAt)}
                  </span>
                  <StatusBadge status={item.status} />
                  <button
                    type="button"
                    aria-label={copiedHistId === item.id ? "복사됨" : "SQL 복사"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(item.sql);
                      setCopiedHistId(item.id);
                      setTimeout(() => setCopiedHistId(null), 1500);
                    }}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: copiedHistId === item.id ? "var(--ds-success)" : "var(--ds-text-faint)", padding: 2, borderRadius: "var(--ds-r-6)", flexShrink: 0, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                  >
                    {copiedHistId === item.id ? <Check aria-hidden="true" size={11} /> : <Copy aria-hidden="true" size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatusCard ───────────────────────────────────────────────────────────────

function StatusCard({
  icon,
  label,
  value,
  status,
  href,
  emptyMsg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: CheckStatus;
  href: string;
  emptyMsg: string;
}) {
  const ok = status === "ok";
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "var(--ds-sp-4)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-8)",
          background: "var(--ds-surface)",
          cursor: "pointer",
          transition: "border-color var(--ds-dur-fast) var(--ds-ease)",
        }}
        className="hover:border-border-strong"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-2)" }}>
          <span style={{ color: "var(--ds-text-mute)" }}>{icon}</span>
          <span
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-mute)",
              fontFamily: "var(--ds-font-sans)",
            }}
          >
            {label}
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--ds-fs-22)",
            fontWeight: "var(--ds-fw-bold)",
            color: ok ? "var(--ds-text)" : "var(--ds-text-faint)",
            fontFamily: "var(--ds-font-mono)",
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          {value}
        </div>
        {!ok && status !== "loading" && (
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-warn)" }}>
            {emptyMsg}
          </div>
        )}
      </div>
    </Link>
  );
}
