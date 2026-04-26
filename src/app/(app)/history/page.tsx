import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Button } from "@/components/ui-vs/Button";
import { RotateCcw, Star, MoreHorizontal } from "lucide-react";

const historyGroups = [
  {
    date: "오늘",
    items: [
      { time: "12:04", nl: "결제 사용자 100명을 보여줘", rows: 1000, duration: "0.8s", conn: "prod_analytics", status: "success", starred: true },
      { time: "11:22", nl: "결제 실패 — checkout", rows: 0, duration: "—", conn: "prod_analytics", status: "error", starred: false },
      { time: "10:45", nl: "국가별 신규 가입자 추이", rows: 42, duration: "1.2s", conn: "prod_analytics", status: "success", starred: false },
    ],
  },
  {
    date: "어제",
    items: [
      { time: "16:30", nl: "주간 매출 집계", rows: 7, duration: "0.4s", conn: "local_dev", status: "success", starred: true },
      { time: "09:15", nl: "상품별 반환율 분석", rows: 23, duration: "2.1s", conn: "prod_analytics", status: "success", starred: false },
    ],
  },
];

export default function HistoryPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="히스토리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "히스토리" }]}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-4)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {["전체", "성공", "실패", "즐겨찾기"].map((f, i) => (
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
          <div style={{ flex: 1 }} />
          <input
            placeholder="히스토리 검색..."
            style={{
              padding: "var(--ds-sp-1) var(--ds-sp-3)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-12)",
              outline: "none",
              fontFamily: "var(--ds-font-sans)",
              width: 200,
            }}
          />
        </div>

        {/* History list */}
        {historyGroups.map((group) => (
          <div key={group.date} style={{ marginBottom: "var(--ds-sp-5)" }}>
            <div
              style={{
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-2)",
                paddingLeft: "var(--ds-sp-1)",
              }}
            >
              {group.date}
            </div>

            <Card padding={0}>
              {group.items.map((item, i) => (
                <div
                  key={i}
                  className="group"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-3)",
                    padding: "var(--ds-sp-3) var(--ds-sp-4)",
                    borderBottom: i < group.items.length - 1 ? "1px solid var(--ds-border)" : undefined,
                    cursor: "pointer",
                    transition: "background var(--ds-dur-fast) var(--ds-ease)",
                  }}
                >
                  {/* Time */}
                  <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", width: 36, flexShrink: 0 }}>
                    {item.time}
                  </span>

                  {/* Query */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.nl}
                    </div>
                    <div style={{ display: "flex", gap: "var(--ds-sp-2)", marginTop: 2, alignItems: "center" }}>
                      <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{item.conn}</span>
                      {item.rows > 0 && (
                        <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{item.rows.toLocaleString()}행</span>
                      )}
                      <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{item.duration}</span>
                    </div>
                  </div>

                  {/* Status */}
                  {item.status === "success"
                    ? <Pill variant="success" dot="ok">성공</Pill>
                    : <Pill variant="danger" dot="err">실패</Pill>
                  }

                  {/* Starred */}
                  {item.starred && <Star size={13} style={{ color: "var(--ds-warn)", fill: "var(--ds-warn)", flexShrink: 0 }} />}

                  {/* Actions (hover) */}
                  <div style={{ display: "flex", gap: "var(--ds-sp-1)", opacity: 0, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }} className="group-hover:opacity-100">
                    <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />}>재실행</Button>
                    <Button variant="ghost" size="sm" icon={<Star size={12} />}>저장</Button>
                    <Button variant="ghost" size="sm" icon={<MoreHorizontal size={12} />} aria-label="더보기">···</Button>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
