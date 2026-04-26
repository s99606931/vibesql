"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Plus, Search, BookOpen, Database } from "lucide-react";

interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  columns: { table: string; column: string }[];
  examples: string[];
}

const glossaryTerms: GlossaryTerm[] = [
  {
    id: "결제율",
    term: "결제율",
    category: "매출",
    definition: "전체 세션 또는 방문자 대비 실제 결제가 완료된 비율. (결제 건수 / 총 세션) × 100으로 계산됩니다.",
    columns: [
      { table: "orders", column: "status" },
      { table: "sessions", column: "session_id" },
    ],
    examples: ["이번 달 결제율을 보여줘", "채널별 결제율 비교"],
  },
  {
    id: "이탈률",
    term: "이탈률",
    category: "사용자",
    definition: "특정 기간 동안 서비스를 떠난 사용자 비율. 보통 30일 미접속 기준으로 집계합니다.",
    columns: [
      { table: "users", column: "last_seen_at" },
      { table: "users", column: "churned_at" },
    ],
    examples: ["월별 이탈률 추이", "이탈 위험 사용자 목록"],
  },
  {
    id: "활성 사용자",
    term: "활성 사용자",
    category: "사용자",
    definition: "지정된 기간(일/주/월) 내에 1회 이상 로그인하거나 핵심 액션을 수행한 사용자.",
    columns: [
      { table: "user_events", column: "user_id" },
      { table: "user_events", column: "event_at" },
    ],
    examples: ["오늘 활성 사용자 수", "주간 활성 사용자 추이"],
  },
  {
    id: "MAU",
    term: "MAU",
    category: "지표",
    definition: "Monthly Active Users — 월간 활성 사용자 수. 해당 월에 한 번 이상 서비스를 이용한 순 사용자 수입니다.",
    columns: [
      { table: "user_events", column: "user_id" },
      { table: "user_events", column: "event_at" },
    ],
    examples: ["이번 달 MAU", "MAU vs DAU 비율"],
  },
  {
    id: "전환율",
    term: "전환율",
    category: "매출",
    definition: "특정 퍼널 단계에서 다음 단계로 넘어간 사용자 비율. 예: 장바구니 → 결제 완료 전환율.",
    columns: [
      { table: "funnel_events", column: "step" },
      { table: "funnel_events", column: "user_id" },
    ],
    examples: ["장바구니 전환율", "단계별 전환율 분석"],
  },
  {
    id: "GMV",
    term: "GMV",
    category: "매출",
    definition: "Gross Merchandise Value — 총 거래액. 환불/취소 이전의 전체 결제 금액 합계.",
    columns: [
      { table: "orders", column: "total_amount" },
      { table: "orders", column: "created_at" },
    ],
    examples: ["이번 달 GMV", "채널별 GMV 비교"],
  },
  {
    id: "ARPU",
    term: "ARPU",
    category: "매출",
    definition: "Average Revenue Per User — 사용자 1인당 평균 매출. GMV ÷ 활성 사용자 수로 계산합니다.",
    columns: [
      { table: "orders", column: "total_amount" },
      { table: "users", column: "id" },
    ],
    examples: ["월별 ARPU 추이", "세그먼트별 ARPU"],
  },
];

const categoryColors: Record<string, "default" | "accent" | "success" | "warn" | "info"> = {
  매출: "accent",
  사용자: "success",
  지표: "info",
};

export default function GlossaryPage() {
  const [selectedId, setSelectedId] = useState<string>(glossaryTerms[0].id);
  const [search, setSearch] = useState("");

  const filtered = glossaryTerms.filter(
    (t) =>
      t.term.includes(search) ||
      t.definition.includes(search) ||
      t.category.includes(search)
  );

  const selected = glossaryTerms.find((t) => t.id === selectedId) ?? glossaryTerms[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="비즈니스 용어집"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "비즈니스 용어집" }]}
        actions={
          <Button variant="accent" size="sm" icon={<Plus size={13} />}>
            새 용어
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>

        {/* Left panel — term list */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--ds-border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search + new button */}
          <div
            style={{
              padding: "var(--ds-sp-3) var(--ds-sp-3) var(--ds-sp-2)",
              borderBottom: "1px solid var(--ds-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--ds-sp-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                padding: "var(--ds-sp-1) var(--ds-sp-2)",
              }}
            >
              <Search size={12} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="용어 검색..."
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--ds-text)",
                  fontSize: "var(--ds-fs-12)",
                  outline: "none",
                  fontFamily: "var(--ds-font-sans)",
                  flex: 1,
                }}
              />
            </div>
          </div>

          {/* Term list */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {filtered.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedId(term.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: "1px solid var(--ds-border)",
                  background:
                    selectedId === term.id ? "var(--ds-accent-soft)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--ds-font-sans)",
                  transition: "background var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                <BookOpen
                  size={13}
                  style={{
                    color:
                      selectedId === term.id
                        ? "var(--ds-accent)"
                        : "var(--ds-text-faint)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--ds-fs-13)",
                      fontWeight:
                        selectedId === term.id
                          ? "var(--ds-fw-semibold)"
                          : "var(--ds-fw-normal)",
                      color:
                        selectedId === term.id
                          ? "var(--ds-accent)"
                          : "var(--ds-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {term.term}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                      marginTop: 1,
                    }}
                  >
                    {term.category}
                  </div>
                </div>
                <Pill variant={categoryColors[term.category] ?? "default"}>
                  {term.category}
                </Pill>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — term detail */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "var(--ds-sp-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-4)",
          }}
        >
          {/* AI callout */}
          <AICallout tone="accent">
            이 용어들은 SQL 생성 시 자동으로 참조됩니다. 용어를 정확히 정의할수록 AI가 더 정확한 쿼리를 생성합니다.
          </AICallout>

          {/* Term header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--ds-sp-3)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "var(--ds-fs-22)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-text)",
                  marginBottom: "var(--ds-sp-1)",
                }}
              >
                {selected.term}
              </div>
              <Pill variant={categoryColors[selected.category] ?? "default"}>
                {selected.category}
              </Pill>
            </div>
            <Button variant="ghost" size="sm">편집</Button>
          </div>

          {/* Definition */}
          <Card padding="var(--ds-sp-4)">
            <div
              style={{
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-2)",
              }}
            >
              정의
            </div>
            <div
              style={{
                fontSize: "var(--ds-fs-13)",
                color: "var(--ds-text)",
                lineHeight: 1.7,
              }}
            >
              {selected.definition}
            </div>
          </Card>

          {/* Mapped DB columns */}
          <Card padding="var(--ds-sp-4)">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                marginBottom: "var(--ds-sp-3)",
              }}
            >
              <Database size={13} style={{ color: "var(--ds-text-faint)" }} />
              <span
                style={{
                  fontSize: "var(--ds-fs-11)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-text-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                매핑된 DB 컬럼
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-sp-2)" }}>
              {selected.columns.map((col, i) => (
                <code
                  key={i}
                  style={{
                    fontFamily: "var(--ds-font-mono)",
                    fontSize: "var(--ds-fs-12)",
                    color: "var(--ds-accent)",
                    background: "var(--ds-accent-soft)",
                    border: "1px solid var(--ds-accent)",
                    borderRadius: "var(--ds-r-4)",
                    padding: "2px 8px",
                  }}
                >
                  {col.table}.{col.column}
                </code>
              ))}
            </div>
          </Card>

          {/* Example queries */}
          <Card padding="var(--ds-sp-4)">
            <div
              style={{
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-3)",
              }}
            >
              예시 질문
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
              {selected.examples.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "var(--ds-fs-13)",
                    color: "var(--ds-text-mute)",
                    padding: "var(--ds-sp-2) var(--ds-sp-3)",
                    background: "var(--ds-fill)",
                    border: "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-6)",
                    fontStyle: "italic",
                  }}
                >
                  "{ex}"
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
