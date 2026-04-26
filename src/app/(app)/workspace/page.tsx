"use client";

import { useWorkspaceStore } from "@/store/useWorkspaceStore";
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
  Table2,
  BarChart2,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { ResultTable } from "@/components/workspace/ResultTable";
import ResultChart from "@/components/workspace/ResultChart";
import { SqlEditor } from "@/components/workspace/SqlEditor";

type ResultTab = "table" | "chart" | "explain";

export default function WorkspacePage() {
  const {
    status,
    nlQuery,
    sql,
    results,
    rowCount,
    duration,
    errorMessage,
    setNlQuery,
    setSql,
    setStatus,
    setResults,
    setError,
    reset,
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<ResultTab>("table");
  const [isEdited, setIsEdited] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  async function handleGenerate() {
    if (!nlQuery.trim()) return;
    setStatus("generating");
    setIsEdited(false);
    try {
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nl: nlQuery,
          dialect: "postgresql",
          schemaContext: "orders(id,user_id,status,amount,created_at), customers(id,email,name,country), products(id,name,category,price)",
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "SQL generation failed");
      setSql(json.data.sql);
      setExplanation(json.data.explanation);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SQL 생성에 실패했습니다");
      setStatus("error");
    }
  }

  async function handleRun() {
    if (!sql.trim()) return;
    setStatus("running");
    try {
      const res = await fetch("/api/queries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, connectionId: "default", limit: 1000 }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Query execution failed");
      const { rows, rowCount: rc, durationMs } = json.data;
      setResults(rows, rc, durationMs);
      setStatus("success");
      // Save to history (non-blocking, failure is acceptable)
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nlQuery: nlQuery || undefined,
          sql,
          dialect: "postgresql",
          status: "SUCCESS",
          rowCount: rc,
          durationMs,
        }),
      }).catch(() => undefined); // non-critical
    } catch (err) {
      setError(err instanceof Error ? err.message : "실행에 실패했습니다");
      setStatus("error");
      // Save failed execution to history (non-blocking)
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nlQuery: nlQuery || undefined,
          sql,
          dialect: "postgresql",
          status: "ERROR",
          errorMsg: err instanceof Error ? err.message : "실행에 실패했습니다",
        }),
      }).catch(() => undefined); // non-critical
    }
  }

  const showSQL = ["ready", "running", "success", "error"].includes(status);
  const showResults = status === "success" && results !== null;
  const columns = results && results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title={nlQuery || "새 쿼리"}
        breadcrumbs={[{ label: "vibeSQL", href: "/" }, { label: "워크스페이스" }]}
        actions={
          <>
            {showResults && (
              <>
                <Button variant="ghost" size="sm" icon={<Star size={13} />}>저장</Button>
                <Button variant="ghost" size="sm" icon={<Share2 size={13} />}>공유</Button>
              </>
            )}
            {status !== "idle" && (
              <Button variant="ghost" size="sm" onClick={reset}>초기화</Button>
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
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
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
                onClick={() => setNlQuery(chip)}
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
              loading={status === "generating"}
              onClick={handleGenerate}
            >
              {status === "generating" ? "생성 중..." : "SQL 생성"}
            </Button>
          </div>
        </div>

        {/* AI generating */}
        {status === "generating" && (
          <AICallout tone="accent" streaming>
            스키마를 분석하고 SQL을 생성하고 있습니다...
          </AICallout>
        )}

        {/* Error */}
        {status === "error" && errorMessage && (
          <AICallout tone="danger" label="◆ 오류">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
              <TriangleAlert size={13} />
              {errorMessage}
            </div>
          </AICallout>
        )}

        {/* AI explanation */}
        {showSQL && explanation && status !== "error" && (
          <AICallout label="◆ AI · SQL 생성 완료" tone="accent">
            {explanation}
          </AICallout>
        )}

        {/* SQL Editor */}
        {showSQL && sql && (
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
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy size={12} />}
                onClick={() => navigator.clipboard.writeText(sql)}
              >
                복사
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={status === "running"}
                icon={<Play size={12} />}
                onClick={handleRun}
              >
                실행 ⌘⏎
              </Button>
            </div>

            <SqlEditor
              value={sql}
              onChange={(v) => {
                setSql(v);
                setIsEdited(true);
              }}
              minHeight={120}
              maxHeight={280}
            />
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
                { key: "table" as ResultTab, icon: Table2, label: "테이블" },
                { key: "chart" as ResultTab, icon: BarChart2, label: "차트" },
                { key: "explain" as ResultTab, icon: MessageSquare, label: "SQL 설명" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
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
                {rowCount}행 · {duration ? `${duration}ms` : "—"}
              </span>
              <Button variant="ghost" size="sm" icon={<Save size={12} />}>CSV</Button>
            </div>

            {activeTab === "table" && (
              <ResultTable rows={results!} columns={columns} />
            )}

            {activeTab === "chart" && (
              <ResultChart rows={results!} columns={columns} />
            )}

            {activeTab === "explain" && (
              <div style={{ padding: "var(--ds-sp-4)" }}>
                <AICallout label="◆ AI · SQL 설명">
                  {explanation ?? "이 쿼리는 요청하신 데이터를 조회합니다."}
                </AICallout>
              </div>
            )}
          </div>
        )}

        {status === "idle" && (
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
            <div style={{ fontSize: "var(--ds-fs-12)" }}>⌘⏎ 로 SQL 생성 · 실행</div>
          </div>
        )}
      </div>
    </div>
  );
}
