"use client";

import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useConnections } from "@/hooks/useConnections";
import { TopBar } from "@/components/shell/TopBar";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import {
  Play,
  Share2,
  Star,
  Copy,
  Table2,
  BarChart2,
  MessageSquare,
  TriangleAlert,
  Check,
  Save,
  LayoutDashboard,
} from "lucide-react";
import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ResultTable } from "@/components/workspace/ResultTable";
import ResultChart from "@/components/workspace/ResultChart";
import { SqlEditor } from "@/components/workspace/SqlEditor";
import { ShareDialog } from "@/components/share/ShareDialog";

type ResultTab = "table" | "chart" | "explain";

function exportToCsv(rows: Record<string, unknown>[], columns: string[]): void {
  if (rows.length === 0 || columns.length === 0) return;

  const escape = (val: unknown): string => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(",")).join("\n");
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vibesql-export-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function SqlParamLoader() {
  const searchParams = useSearchParams();
  const { setSql, setStatus } = useWorkspaceStore();
  useEffect(() => {
    const sqlParam = searchParams.get("sql");
    if (sqlParam && !useWorkspaceStore.getState().sql) {
      setSql(decodeURIComponent(sqlParam));
      setStatus("ready");
    }
  }, [searchParams, setSql, setStatus]);
  return null;
}

export default function WorkspacePage() {
  const {
    status,
    nlQuery,
    sql,
    results,
    rowCount,
    duration,
    errorMessage,
    activeConnectionId,
    setNlQuery,
    setSql,
    setStatus,
    setResults,
    setError,
    reset,
    setActiveConnection,
  } = useWorkspaceStore();

  const { dialect } = useSettingsStore();
  const { data: connections } = useConnections();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ResultTab>("table");
  const [isEdited, setIsEdited] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const savedOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (savedOkTimer.current) clearTimeout(savedOkTimer.current);
    };
  }, []);

  const activeConnection = (connections ?? []).find((c) => c.id === activeConnectionId);

  const saveQueryMutation = useMutation({
    mutationFn: async (payload: { name: string; query: string; folder: string }) => {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          sql: payload.query,
          folder: payload.folder,
          dialect,
          ...(activeConnectionId ? { connectionId: activeConnectionId } : {}),
        }),
      });
      const json = await res.json() as { data: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved"] });
      setSavedOk(true);
      if (savedOkTimer.current) clearTimeout(savedOkTimer.current);
      savedOkTimer.current = setTimeout(() => setSavedOk(false), 1500);
    },
  });

  const { data: dashboards } = useQuery<Array<{ id: string; name: string; widgets: unknown[] }>>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const r = await fetch("/api/dashboards");
      const j = await r.json() as { data?: Array<{ id: string; name: string; widgets: unknown[] }> };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 30_000,
    enabled: false,
  });

  const addToDashboardMutation = useMutation({
    mutationFn: async ({ dashId, label }: { dashId: string; label: string }) => {
      const dash = (dashboards ?? []).find((d) => d.id === dashId);
      const existingWidgets = Array.isArray(dash?.widgets) ? dash!.widgets : [];
      const newWidget = { type: "table", label, sql, createdAt: new Date().toISOString() };
      const r = await fetch(`/api/dashboards/${dashId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: [...existingWidgets, newWidget] }),
      });
      if (!r.ok) throw new Error("대시보드 추가 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
  });

  async function handleAddToDashboard() {
    const fresh = await queryClient.fetchQuery<Array<{ id: string; name: string; widgets: unknown[] }>>({
      queryKey: ["dashboards"],
      queryFn: async () => {
        const r = await fetch("/api/dashboards");
        const j = await r.json() as { data?: Array<{ id: string; name: string; widgets: unknown[] }> };
        return Array.isArray(j.data) ? j.data : [];
      },
    });
    if (!fresh || fresh.length === 0) {
      alert("대시보드가 없습니다. 먼저 대시보드를 생성하세요.");
      return;
    }
    const opts = fresh.map((d, i) => `${i + 1}. ${d.name}`).join("\n");
    const input = prompt(`어느 대시보드에 추가할까요?\n\n${opts}\n\n번호를 입력하세요:`);
    const idx = parseInt(input ?? "", 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= fresh.length) return;
    const label = prompt("위젯 이름:", nlQuery || "쿼리 결과") ?? "쿼리 결과";
    addToDashboardMutation.mutate({ dashId: fresh[idx].id, label });
  }

  async function handleGenerate() {
    if (!nlQuery.trim()) return;
    setStatus("generating");
    setIsEdited(false);
    try {
      // Fetch schema + glossary in parallel for richer NL→SQL context
      let schemaContext = "No schema provided — generate generic SQL";
      let glossaryContext: string | undefined;
      await Promise.allSettled([
        (async () => {
          const url = activeConnectionId
            ? `/api/schema?connectionId=${encodeURIComponent(activeConnectionId)}`
            : "/api/schema";
          const sr = await fetch(url);
          const sj = (await sr.json()) as { data?: Array<{ name: string; cols: string[] }> };
          if (sj.data && sj.data.length > 0) {
            schemaContext = sj.data
              .map((t) => `${t.name}(${t.cols.join(", ")})`)
              .join("; ");
          }
        })(),
        (async () => {
          const gr = await fetch("/api/glossary");
          const gj = (await gr.json()) as { data?: Array<{ term: string; definition: string; sql?: string }> };
          if (gj.data && gj.data.length > 0) {
            glossaryContext = gj.data
              .map((t) => `${t.term}: ${t.definition}${t.sql ? ` [SQL hint: ${t.sql}]` : ""}`)
              .join("\n");
          }
        })(),
      ]);

      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nl: nlQuery,
          dialect,
          schemaContext,
          glossary: glossaryContext,
        }),
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") ?? "60";
        throw new Error(`요청이 너무 많습니다. ${retryAfter}초 후 다시 시도하세요.`);
      }
      const json = await res.json() as {
        error?: string;
        data: { sql: string; explanation: string; confidence: "high" | "medium" | "low"; warnings?: string[] };
      };
      if (!res.ok || json.error) throw new Error(json.error ?? "SQL generation failed");
      setSql(json.data.sql);
      setExplanation(json.data.explanation);
      setConfidence(json.data.confidence ?? null);
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
        body: JSON.stringify({
          sql,
          connectionId: activeConnectionId ?? "default",
          limit: 1000,
        }),
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") ?? "60";
        throw new Error(`요청이 너무 많습니다. ${retryAfter}초 후 다시 시도하세요.`);
      }
      const isBlocked = res.status === 403;
      const json = await res.json();
      if (!res.ok || json.error) {
        const histStatus = isBlocked ? "BLOCKED" : "ERROR";
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nlQuery: nlQuery || undefined,
            sql,
            dialect,
            status: histStatus,
            errorMsg: json.error ?? "실행에 실패했습니다",
            ...(activeConnectionId ? { connectionId: activeConnectionId } : {}),
            ...(activeConnection ? { connectionName: activeConnection.name } : {}),
          }),
        }).then(() => queryClient.invalidateQueries({ queryKey: ["history"] })).catch(() => undefined);
        throw new Error(json.error ?? "Query execution failed");
      }
      const runData = (json as { data?: { rows: Record<string, unknown>[]; rowCount: number; durationMs: number } }).data;
      if (!runData) throw new Error("서버 응답 형식이 올바르지 않습니다.");
      const { rows, rowCount: rc, durationMs } = runData;
      setResults(rows, rc, durationMs); // setResults already sets status → "success"
      // Save to history + invalidate cache (non-blocking)
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nlQuery: nlQuery || undefined,
          sql,
          dialect,
          status: "SUCCESS",
          rowCount: rc,
          durationMs,
          ...(activeConnectionId ? { connectionId: activeConnectionId } : {}),
          ...(activeConnection ? { connectionName: activeConnection.name } : {}),
        }),
      }).then((r) => {
        if (r.ok) return queryClient.invalidateQueries({ queryKey: ["history"] });
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "실행에 실패했습니다");
      setStatus("error");
    }
  }

  const showSQL = ["ready", "running", "success", "error"].includes(status);
  const showResults = status === "success" && results !== null;
  const columns = useMemo(
    () => (results && results.length > 0 ? Object.keys(results[0]) : []),
    [results]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Suspense fallback={null}><SqlParamLoader /></Suspense>
      <TopBar
        title={nlQuery || "새 쿼리"}
        breadcrumbs={[{ label: "vibeSQL", href: "/" }, { label: "워크스페이스" }]}
        actions={
          <>
            {/* Connection selector */}
            <select
              value={activeConnectionId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setActiveConnection(id);
                fetch("/api/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lastConnectionId: id }),
                }).catch(() => {});
              }}
              style={{
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: activeConnectionId ? "var(--ds-text)" : "var(--ds-text-faint)",
                fontSize: "var(--ds-fs-12)",
                padding: "var(--ds-sp-1) var(--ds-sp-2)",
                fontFamily: "var(--ds-font-sans)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="" disabled>연결 선택...</option>
              {(connections ?? []).map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>

            {showResults && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={savedOk ? <Check size={13} /> : <Star size={13} />}
                  loading={saveQueryMutation.isPending}
                  onClick={() =>
                    saveQueryMutation.mutate({
                      name: nlQuery || "쿼리",
                      query: sql,
                      folder: "기본",
                    })
                  }
                >
                  저장
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Share2 size={13} />}
                  onClick={() => setShareOpen(true)}
                >공유</Button>
              </>
            )}
            {status !== "idle" && (
              <Button variant="ghost" size="sm" onClick={() => { reset(); setConfidence(null); setExplanation(null); }}>초기화</Button>
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
              aria-label="자연어 질문 입력"
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
              {confidence && !isEdited && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "1px 8px",
                    borderRadius: "var(--ds-r-full)",
                    fontSize: "var(--ds-fs-10)",
                    fontWeight: "var(--ds-fw-semibold)",
                    letterSpacing: "0.03em",
                    background:
                      confidence === "high"
                        ? "var(--ds-success-soft, color-mix(in srgb, var(--ds-success) 15%, transparent))"
                        : confidence === "medium"
                        ? "var(--ds-warn-soft, color-mix(in srgb, var(--ds-warn) 15%, transparent))"
                        : "var(--ds-danger-soft, color-mix(in srgb, var(--ds-danger) 15%, transparent))",
                    color:
                      confidence === "high"
                        ? "var(--ds-success)"
                        : confidence === "medium"
                        ? "var(--ds-warn)"
                        : "var(--ds-danger)",
                    border: `1px solid ${
                      confidence === "high"
                        ? "var(--ds-success)"
                        : confidence === "medium"
                        ? "var(--ds-warn)"
                        : "var(--ds-danger)"
                    }`,
                    opacity: 0.8,
                  }}
                >
                  {confidence === "high" ? "신뢰도 높음" : confidence === "medium" ? "신뢰도 중간" : "신뢰도 낮음"}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy size={12} />}
                onClick={() =>
                  navigator.clipboard.writeText(sql).catch(() =>
                    alert("클립보드 복사에 실패했습니다.")
                  )
                }
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
              <Button
                variant="ghost"
                size="sm"
                icon={<Save size={12} />}
                onClick={() => results && exportToCsv(results, columns)}
              >
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<LayoutDashboard size={12} />}
                loading={addToDashboardMutation.isPending}
                onClick={handleAddToDashboard}
              >
                대시보드 추가
              </Button>
            </div>

            {activeTab === "table" && results && (
              <ResultTable rows={results} columns={columns} />
            )}

            {activeTab === "chart" && results && (
              <ResultChart rows={results} columns={columns} />
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

      <ShareDialog
        sql={sql}
        nlQuery={nlQuery || undefined}
        dialect={dialect}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
