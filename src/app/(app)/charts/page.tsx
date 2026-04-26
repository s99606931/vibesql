import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import { Plus, LayoutDashboard, Trash2, ExternalLink, Hash } from "lucide-react";

const chartTypes = ["전체", "라인", "바", "파이", "테이블"];

const mockCharts = [
  {
    id: 1,
    name: "국가별 매출",
    query: "국가별 총 매출액을 내림차순으로 보여줘",
    rows: 42,
    type: "바",
    typeVariant: "info" as const,
    height: 160,
  },
  {
    id: 2,
    name: "월별 가입자 추이",
    query: "최근 12개월 신규 가입자 수 추이",
    rows: 12,
    type: "라인",
    typeVariant: "accent" as const,
    height: 140,
  },
  {
    id: 3,
    name: "결제 방법 비율",
    query: "결제 수단별 비율을 분석해줘",
    rows: 6,
    type: "파이",
    typeVariant: "success" as const,
    height: 180,
  },
  {
    id: 4,
    name: "상품 카테고리별 매출",
    query: "카테고리별 매출 합계와 건수",
    rows: 18,
    type: "바",
    typeVariant: "info" as const,
    height: 150,
  },
  {
    id: 5,
    name: "주간 트렌드",
    query: "이번 주 일별 활성 사용자 수",
    rows: 7,
    type: "라인",
    typeVariant: "accent" as const,
    height: 160,
  },
];

export default function ChartsPage() {
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
          {chartTypes.map((f, i) => (
            <button
              key={f}
              style={{
                padding: "4px 12px",
                borderRadius: "var(--ds-r-full)",
                border: "1px solid var(--ds-border)",
                background: i === 0 ? "var(--ds-accent-soft)" : "var(--ds-surface)",
                color: i === 0 ? "var(--ds-accent)" : "var(--ds-text-mute)",
                fontSize: "var(--ds-fs-12)",
                cursor: "pointer",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Chart grid — 3 columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--ds-sp-4)",
            alignItems: "start",
          }}
        >
          {mockCharts.map((chart) => (
            <Card key={chart.id} hoverable padding="var(--ds-sp-3)" className="group">
              {/* Striped placeholder area */}
              <div
                className="ds-stripes"
                style={{
                  width: "100%",
                  height: chart.height,
                  borderRadius: "var(--ds-r-6)",
                  marginBottom: "var(--ds-sp-3)",
                  overflow: "hidden",
                }}
              />

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
                  {chart.rows}행
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
