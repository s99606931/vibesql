"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { LayoutDashboard, Plus, Search, Clock, BarChart2, TrendingUp, Table2, ExternalLink } from "lucide-react";

const DASHBOARDS = [
  {
    id: 1,
    name: "일별 매출",
    description: "일별 매출 추이 및 핵심 KPI 요약",
    widgetCount: 3,
    lastUpdated: "1시간 전",
    owner: "내 대시보드",
    widgets: [
      { type: "line", label: "매출 추이 (라인)" },
      { type: "kpi", label: "총 매출 KPI" },
      { type: "bar", label: "채널별 매출 (바)" },
    ],
  },
  {
    id: 2,
    name: "사용자 활성도",
    description: "DAU/MAU 및 이탈률 모니터링",
    widgetCount: 2,
    lastUpdated: "3시간 전",
    owner: "공유됨",
    widgets: [
      { type: "line", label: "DAU 추이 (라인)" },
      { type: "kpi", label: "이탈률 KPI" },
    ],
  },
];

const FILTERS = ["전체", "내 대시보드", "공유됨"];

function WidgetTypeIcon({ type }: { type: string }) {
  if (type === "line") return <TrendingUp size={11} />;
  if (type === "bar") return <BarChart2 size={11} />;
  return <Table2 size={11} />;
}

export default function DashboardsPage() {
  const [activeFilter, setActiveFilter] = useState("전체");
  const [search, setSearch] = useState("");

  const visible = DASHBOARDS.filter((d) => {
    if (activeFilter !== "전체" && d.owner !== activeFilter) return false;
    if (search && !d.name.includes(search) && !d.description.includes(search)) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="대시보드"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "대시보드" }]}
        actions={
          <Button variant="accent" size="sm" icon={<Plus size={13} />}>
            새 대시보드
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* Filter / search bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {FILTERS.map((f) => (
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
              width: 220,
            }}
          >
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="대시보드 검색..."
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
          <div
            style={{
              border: "1px dashed var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              background: "var(--ds-surface)",
            }}
          >
            <LayoutDashboard size={32} style={{ color: "var(--ds-text-faint)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: 4 }}>
                {search ? "검색 결과 없음" : "새 대시보드를 만들어 보세요"}
              </div>
              <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>
                쿼리 결과를 위젯으로 고정하고 한눈에 모니터링하세요.
              </div>
            </div>
            {!search && (
              <Button variant="accent" size="sm" icon={<Plus size={13} />}>
                새 대시보드
              </Button>
            )}
          </div>
        )}

        {/* Dashboard grid */}
        {visible.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "var(--ds-sp-4)",
            }}
          >
            {visible.map((dash) => (
              <Card key={dash.id} hoverable padding="var(--ds-sp-4)">
                <CardHead
                  title={dash.name}
                  meta={dash.description}
                  actions={
                    <Button variant="ghost" size="sm" icon={<ExternalLink size={12} />}>
                      열기
                    </Button>
                  }
                />

                {/* Widget preview chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-4)" }}>
                  {dash.widgets.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "var(--ds-fs-11)",
                        color: "var(--ds-text-mute)",
                        background: "var(--ds-fill)",
                        border: "1px solid var(--ds-border)",
                        borderRadius: "var(--ds-r-6)",
                        padding: "3px 8px",
                      }}
                    >
                      <WidgetTypeIcon type={w.type} />
                      {w.label}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-3)",
                    paddingTop: "var(--ds-sp-3)",
                    borderTop: "1px solid var(--ds-border)",
                  }}
                >
                  <Pill variant="default">{dash.widgetCount}개 위젯</Pill>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                    <Clock size={11} />
                    {dash.lastUpdated}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
