"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import {
  Play,
  Save,
  Share2,
  Star,
  Copy,
  ChevronDown,
  Table2,
  BarChart2,
  MessageSquare,
} from "lucide-react";

const SAMPLE_SQL = `SELECT
  c.country,
  COUNT(DISTINCT o.user_id) AS users,
  SUM(o.amount) AS total_revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '7 days'
GROUP BY c.country
ORDER BY users DESC
LIMIT 100`;

const SAMPLE_RESULTS = [
  { country: "한국", users: 1842, total_revenue: "₩124,500,000" },
  { country: "미국", users: 934, total_revenue: "$89,200" },
  { country: "일본", users: 621, total_revenue: "¥8,400,000" },
  { country: "독일", users: 412, total_revenue: "€34,800" },
  { country: "영국", users: 387, total_revenue: "£28,300" },
];

type WorkspaceState = "idle" | "generating" | "ready" | "running" | "success";

export default function WorkspacePage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<WorkspaceState>("idle");
  const [activeTab, setActiveTab] = useState<"table" | "chart" | "explain">("table");
  const [isEdited, setIsEdited] = useState(false);

  function handleGenerate() {
    if (!query.trim()) return;
    setState("generating");
    setTimeout(() => setState("ready"), 1500);
  }

  function handleRun() {
    setState("running");
    setTimeout(() => setState("success"), 800);
  }

  const showSQL = state === "ready" || state === "running" || state === "success";
  const showResults = state === "success";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title={query || "새 쿼리"}
        breadcrumbs={[
          { label: "vibeSQL", href: "/" },
          { label: "워크스페이스" },
        ]}
        actions={
          <>
            {showResults && (
              <>
                <Button variant="ghost" size="sm" icon={<Star size={13} />}>저장</Button>
                <Button variant="ghost" size="sm" icon={<Share2 size={13} />}>공유</Button>
              </>
            )}
          </>
        }
      />

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
        {/* Natural language input */}
        <div
          style={{
            background: "var(--ds-surface)",
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-8)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", padding: "var(--ds-sp-3)" }}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="결제 사용자에 대해 무엇을 알고 싶나요?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "var(--ds-fs-14)",
                color: "var(--ds-text)",
                fontFamily: "var(--ds-font-sans)",
                resize: "none",
                minHeight: 48,
                lineHeight: 1.5,
              }}
              rows={2}
            />
          </div>

          {/* Quick chips */}
          <div
            style={{
              display: "flex",
              gap: "var(--ds-sp-2)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              borderTop: "1px solid var(--ds-border)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>예시:</span>
            {["오늘 활성 사용자", "주간 매출 추이", "국가별 가입자 수", "결제 실패율"].map((chip) => (
              <button
                key={chip}
                onClick={() => setQuery(chip)}
                style={{
                  padding: "2px 10px",
                  borderRadius: "var(--ds-r-full)",
                  border: "1px solid var(--ds-border)",
                  background: "var(--ds-surface)",
                  color: "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-11)",
                  cursor: "pointer",
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                {chip}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            <Button
              variant="accent"
              size="sm"
              loading={state === "generating"}
              onClick={handleGenerate}
            >
              {state === "generating" ? "생성 중..." : "SQL 생성"}
            </Button>
          </div>
        </div>

        {/* AI reasoning */}
        {state === "generating" && (
          <AICallout tone="accent" streaming>
            <span style={{ color: "var(--ds-accent)" }}>
              orders 테이블과 customers 테이블을 분석하고 있습니다...
            </span>
          </AICallout>
        )}

        {showSQL && (
          <AICallout label="◆ AI · SQL 생성 완료" tone="accent">
            orders 테이블에서 status가 paid인 사용자를 customers와 조인하여 국가별로 집계했습니다.
          </AICallout>
        )}

        {/* SQL Editor */}
        {showSQL && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                borderBottom: "1px solid var(--ds-border)",
                gap: "var(--ds-sp-2)",
              }}
            >
              <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-mono)" }}>SQL</span>
              {isEdited && <Pill variant="warn">수정됨</Pill>}
              <div style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" icon={<Copy size={12} />} onClick={() => navigator.clipboard.writeText(SAMPLE_SQL)}>복사</Button>
              <Button
                variant="primary"
                size="sm"
                loading={state === "running"}
                icon={<Play size={12} />}
                onClick={handleRun}
              >
                실행 ⌘⏎
              </Button>
            </div>

            <pre
              contentEditable
              suppressContentEditableWarning
              onInput={() => setIsEdited(true)}
              style={{
                margin: 0,
                padding: "var(--ds-sp-4)",
                fontFamily: "var(--ds-font-mono)",
                fontSize: "var(--ds-fs-13)",
                lineHeight: 1.55,
                color: "var(--ds-text)",
                background: "transparent",
                outline: "none",
                overflow: "auto",
                maxHeight: 280,
                whiteSpace: "pre",
              }}
            >
              {SAMPLE_SQL}
            </pre>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--ds-border)",
                padding: "0 var(--ds-sp-3)",
                gap: "var(--ds-sp-1)",
                alignItems: "center",
              }}
            >
              {[
                { key: "table", icon: Table2, label: "테이블" },
                { key: "chart", icon: BarChart2, label: "차트" },
                { key: "explain", icon: MessageSquare, label: "SQL 설명" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-1)",
                    padding: "var(--ds-sp-2) var(--ds-sp-3)",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.key ? "2px solid var(--ds-accent)" : "2px solid transparent",
                    color: activeTab === tab.key ? "var(--ds-accent)" : "var(--ds-text-mute)",
                    fontSize: "var(--ds-fs-12)",
                    cursor: "pointer",
                    fontFamily: "var(--ds-font-sans)",
                    fontWeight: "var(--ds-fw-medium)",
                    marginBottom: -1,
                  }}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}

              <div style={{ flex: 1 }} />

              <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                5행 · 0.8s
              </span>
            </div>

            {/* Table view */}
            {activeTab === "table" && (
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ds-fill)" }}>
                      {["국가", "사용자", "총 매출"].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: "var(--ds-sp-2) var(--ds-sp-3)",
                            textAlign: "left",
                            fontSize: "var(--ds-fs-10)",
                            fontFamily: "var(--ds-font-mono)",
                            color: "var(--ds-text-mute)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid var(--ds-border)",
                            fontWeight: "var(--ds-fw-semibold)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_RESULTS.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid var(--ds-border)",
                        }}
                        className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
                      >
                        <td style={{ padding: "var(--ds-sp-2) var(--ds-sp-3)", fontSize: "var(--ds-fs-13)", color: "var(--ds-text)" }}>
                          {row.country}
                        </td>
                        <td
                          className="ds-num"
                          style={{
                            padding: "var(--ds-sp-2) var(--ds-sp-3)",
                            fontSize: "var(--ds-fs-13)",
                            color: "var(--ds-text)",
                            textAlign: "right",
                          }}
                        >
                          {row.users.toLocaleString()}
                        </td>
                        <td
                          className="ds-num"
                          style={{
                            padding: "var(--ds-sp-2) var(--ds-sp-3)",
                            fontSize: "var(--ds-fs-13)",
                            color: "var(--ds-text)",
                            textAlign: "right",
                          }}
                        >
                          {row.total_revenue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chart placeholder */}
            {activeTab === "chart" && (
              <div
                className="ds-stripes"
                style={{ height: 200, margin: "var(--ds-sp-4)" }}
              >
                차트 영역 (M2에서 구현)
              </div>
            )}

            {/* Explain */}
            {activeTab === "explain" && (
              <div style={{ padding: "var(--ds-sp-4)" }}>
                <AICallout label="◆ AI · SQL 설명">
                  이 쿼리는 지난 7일간 결제 완료(paid) 주문을 국가별로 집계합니다.
                  orders 테이블과 customers 테이블을 고객 ID로 조인하여
                  각 국가의 유니크 사용자 수와 총 매출액을 계산합니다.
                  결과는 사용자 수 기준 내림차순으로 정렬됩니다.
                </AICallout>
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {state === "idle" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--ds-sp-12)",
              color: "var(--ds-text-faint)",
              gap: "var(--ds-sp-3)",
            }}
          >
            <BarChart2 size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-medium)" }}>
              위에서 질문을 입력하세요
            </div>
            <div style={{ fontSize: "var(--ds-fs-12)" }}>
              ⌘⏎ 로 SQL 실행 · ⌘S 로 저장
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
