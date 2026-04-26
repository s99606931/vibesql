import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { AICallout, AIBadge } from "@/components/ui-vs/AICallout";
import { Search } from "lucide-react";

const tables = [
  {
    name: "orders",
    rows: "8.4M",
    columns: 18,
    description: "주문 트랜잭션 테이블. 결제 상태, 금액, 배송 정보 포함.",
    cols: ["id", "user_id", "status", "amount", "created_at", "updated_at"],
    fks: ["customers", "products"],
    pii: true,
  },
  {
    name: "customers",
    rows: "1.2M",
    columns: 12,
    description: "고객 계정 정보. PII 컬럼 포함 — 주의.",
    cols: ["id", "email", "name", "country", "plan", "created_at"],
    fks: [],
    pii: true,
  },
  {
    name: "products",
    rows: "4,832",
    columns: 9,
    description: "상품 카탈로그. 활성/비활성 포함.",
    cols: ["id", "name", "category", "price", "stock", "active"],
    fks: [],
    pii: false,
  },
  {
    name: "payments",
    rows: "9.1M",
    columns: 14,
    description: "결제 처리 이력. orders와 1:1 관계.",
    cols: ["id", "order_id", "method", "status", "amount", "processed_at"],
    fks: ["orders"],
    pii: true,
  },
  {
    name: "audit_logs",
    rows: "22.3M",
    columns: 7,
    description: "모든 쿼리 실행 감사 로그. Append-only.",
    cols: ["id", "user_id", "query", "rows_affected", "duration_ms", "created_at"],
    fks: ["customers"],
    pii: false,
  },
  {
    name: "glossary_terms",
    rows: "143",
    columns: 6,
    description: "회사 용어 사전. AI 쿼리 정확도 향상.",
    cols: ["id", "term", "definition", "mapped_columns", "category", "created_by"],
    fks: [],
    pii: false,
  },
];

export default function SchemaPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="스키마"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "스키마" }]}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Search + filters */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-3)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)" }} />
            <input
              placeholder="테이블 검색..."
              style={{
                width: "100%",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                paddingLeft: 30,
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
              }}
            />
          </div>
          <Pill variant="accent">public</Pill>
          <Pill>PII 포함</Pill>
          <Pill>최근 변경</Pill>
        </div>

        {/* Table grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--ds-sp-4)" }}>
          {tables.map((table) => (
            <Card key={table.name} hoverable style={{ cursor: "pointer" }}>
              <CardHead
                title={table.name}
                meta={`${table.rows}행 · ${table.columns}컬럼`}
                actions={
                  <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
                    {table.pii && <Pill variant="warn">PII</Pill>}
                    <Pill variant="default">{table.rows}</Pill>
                  </div>
                }
              />

              {/* Columns preview */}
              <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap", marginBottom: "var(--ds-sp-3)" }}>
                {table.cols.slice(0, 5).map((col) => (
                  <span
                    key={col}
                    style={{
                      fontFamily: "var(--ds-font-mono)",
                      fontSize: "var(--ds-fs-10)",
                      color: "var(--ds-text-mute)",
                      background: "var(--ds-fill)",
                      padding: "1px 6px",
                      borderRadius: "var(--ds-r-4)",
                    }}
                  >
                    {col}
                  </span>
                ))}
                {table.cols.length > 5 && (
                  <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)" }}>
                    +{table.cols.length - 5} more
                  </span>
                )}
              </div>

              {/* FK badges */}
              {table.fks.length > 0 && (
                <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap", marginBottom: "var(--ds-sp-2)" }}>
                  {table.fks.map((fk) => (
                    <span
                      key={fk}
                      style={{
                        fontFamily: "var(--ds-font-mono)",
                        fontSize: "var(--ds-fs-10)",
                        color: "var(--ds-info)",
                        border: "1px solid var(--ds-info)",
                        padding: "1px 6px",
                        borderRadius: "var(--ds-r-4)",
                      }}
                    >
                      FK: {fk}
                    </span>
                  ))}
                </div>
              )}

              {/* AI description */}
              <div
                style={{
                  fontSize: "var(--ds-fs-11)",
                  color: "var(--ds-text-mute)",
                  lineHeight: 1.5,
                  borderTop: "1px dashed var(--ds-border)",
                  paddingTop: "var(--ds-sp-2)",
                  marginTop: "var(--ds-sp-2)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ds-sp-1)", marginRight: "var(--ds-sp-1)" }}>
                  <AIBadge />
                </span>
                {table.description}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
