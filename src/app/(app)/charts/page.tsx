"use client";

import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import ResultChart from "@/components/workspace/ResultChart";
import { useState } from "react";
import { Plus, LayoutDashboard, Trash2, ExternalLink, Hash, Search } from "lucide-react";

const chartTypes = ["전체", "라인", "바", "파이", "테이블"] as const;
type ChartFilterType = (typeof chartTypes)[number];

const mockCharts = [
  {
    id: 1,
    name: "국가별 매출",
    query: "국가별 총 매출액을 내림차순으로 보여줘",
    type: "바",
    typeVariant: "info" as const,
    rows: [
      { country: "KR", revenue: 482000 },
      { country: "US", revenue: 371000 },
      { country: "JP", revenue: 298000 },
      { country: "DE", revenue: 201000 },
      { country: "GB", revenue: 155000 },
    ],
    columns: ["country", "revenue"],
  },
  {
    id: 2,
    name: "월별 가입자 추이",
    query: "최근 12개월 신규 가입자 수 추이",
    type: "라인",
    typeVariant: "accent" as const,
    rows: [
      { month: "2024-01", signups: 1240 },
      { month: "2024-02", signups: 1480 },
      { month: "2024-03", signups: 1320 },
      { month: "2024-04", signups: 1750 },
    ],
    columns: ["month", "signups"],
  },
  {
    id: 3,
    name: "결제 방법 비율",
    query: "결제 수단별 비율을 분석해줘",
    type: "파이",
    typeVariant: "success" as const,
    rows: [
      { method: "카드", count: 5420 },
      { method: "계좌이체", count: 2310 },
      { method: "간편결제", count: 1890 },
    ],
    columns: ["method", "count"],
  },
  {
    id: 4,
    name: "상품 카테고리별 매출",
    query: "카테고리별 매출 합계와 건수",
    type: "바",
    typeVariant: "info" as const,
    rows: [
      { category: "전자", sales: 890000 },
      { category: "의류", sales: 560000 },
      { category: "식품", sales: 430000 },
      { category: "도서", sales: 120000 },
    ],
    columns: ["category", "sales"],
  },
  {
    id: 5,
    name: "주간 트렌드",
    query: "이번 주 일별 활성 사용자 수",
    type: "라인",
    typeVariant: "accent" as const,
    rows: [
      { day: "월", users: 3200 },
      { day: "화", users: 3540 },
      { day: "수", users: 4100 },
      { day: "목", users: 3890 },
      { day: "금", users: 4420 },
      { day: "토", users: 2100 },
      { day: "일", users: 1800 },
    ],
    columns: ["day", "users"],
  },
];

export default function ChartsPage() {
  const [activeFilter, setActiveFilter] = useState<ChartFilterType>("전체");
  const [search, setSearch] = useState("");

  const visible = mockCharts.filter((c) => {
    if (activeFilter !== "전체" && c.type !== activeFilter) return false;
    if (search && !c.name.includes(search) && !c.query.includes(search)) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="차트"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "차트" }]}
        actions={
          <Button variant="accent" size="sm" icon={<Plus size={13} />}>
            새 차트
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {chartTypes.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                padding: "4px 12px",
                borderRadius: "var(--ds-r-full)",
                border: "1px solid var(--ds-border)",
                background: activeFilter === f ? "var(--ds-accent-soft)" : "var(--ds-surface)",
                color: activeFilter === f ? "var(--ds-accent)" : "var(--ds-text-mute)",
                fontSize: "var(--ds-fs-12)",
                cursor: "pointer",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              {f}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              padding: "var(--ds-sp-1) var(--ds-sp-2)",
              width: 200,
            }}
          >
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="차트 검색..."
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

        {/* Empty state */}
        {visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-13)" }}>
            검색 결과 없음
          </div>
        )}

        {/* Chart grid — 3 columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--ds-sp-4)",
            alignItems: "start",
          }}
        >
          {visible.map((chart) => (
            <Card key={chart.id} hoverable padding="var(--ds-sp-3)" className="group">
              {/* Mini chart preview */}
              <div
                style={{
                  width: "100%",
                  borderRadius: "var(--ds-r-6)",
                  marginBottom: "var(--ds-sp-3)",
                  overflow: "hidden",
                  border: "1px solid var(--ds-border)",
                }}
              >
                <ResultChart rows={chart.rows} columns={chart.columns} />
              </div>

              {/* Chart info */}
              <div style={{ marginBottom: "var(--ds-sp-2)" }}>
                <div
                  style={{
                    fontSize: "var(--ds-fs-13)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: "var(--ds-text)",
                    marginBottom: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chart.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    color: "var(--ds-text-mute)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chart.query}
                </div>
              </div>

              {/* Meta row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  marginBottom: "var(--ds-sp-3)",
                }}
              >
                <Pill variant={chart.typeVariant}>{chart.type}</Pill>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: "var(--ds-fs-11)",
                    color: "var(--ds-text-faint)",
                    fontFamily: "var(--ds-font-mono)",
                  }}
                >
                  <Hash size={10} />
                  {chart.rows.length}행
                </div>
              </div>

              {/* Hover actions */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--ds-sp-1)",
                  opacity: 0,
                  transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
                }}
                className="group-hover:opacity-100"
              >
                <Button variant="ghost" size="sm" icon={<ExternalLink size={11} />}>
                  열기
                </Button>
                <Button variant="ghost" size="sm" icon={<LayoutDashboard size={11} />}>
                  대시보드에 추가
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={11} />}>
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
