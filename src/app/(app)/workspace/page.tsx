"use client";

import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useConnections } from "@/hooks/useConnections";
import { TopBar } from "@/components/shell/TopBar";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileText,
  Search,
  X,
} from "lucide-react";
import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ResultTable } from "@/components/workspace/ResultTable";
import ResultChart from "@/components/workspace/ResultChart";
import { SqlEditor } from "@/components/workspace/SqlEditor";
import { ShareDialog } from "@/components/share/ShareDialog";

type ResultTab = "table" | "chart" | "explain";

function confidenceToPercent(c: "high" | "medium" | "low"): number {
  return c === "high" ? 95 : c === "medium" ? 70 : 40;
}

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

// ─── Template Picker Modal ────────────────────────────────────────────────────

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nlQuery: string;
  sql: string;
  dialect: string;
  tags: string[];
}

function TemplatePicker({
  onSelect,
  onClose,
}: {
  onSelect: (t: QueryTemplate) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery<QueryTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const r = await fetch("/api/templates?limit=20");
      const j = (await r.json()) as { data?: QueryTemplate[] };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 60_000,
  });

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.nlQuery.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="템플릿 불러오기"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--ds-overlay-bg, color-mix(in srgb, var(--ds-bg) 40%, black))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--ds-sp-4)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "80vh",
          background: "var(--ds-surface)",
          borderRadius: "var(--ds-r-8)",
          border: "1px solid var(--ds-border)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--ds-shadow-modal)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            padding: "var(--ds-sp-4)",
            borderBottom: "1px solid var(--ds-border)",
          }}
        >
          <FileText size={16} style={{ color: "var(--ds-accent)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: "var(--ds-fs-16)",
              fontWeight: "var(--ds-fw-bold)",
              color: "var(--ds-text)",
              fontFamily: "var(--ds-font-sans)",
              flex: 1,
            }}
          >
            템플릿 불러오기
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--ds-r-6)",
              border: "none",
              background: "transparent",
              color: "var(--ds-text-faint)",
              cursor: "pointer",
              transition: "color var(--ds-dur-fast) var(--ds-ease)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            borderBottom: "1px solid var(--ds-border)",
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
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              autoFocus
              type="search"
              aria-label="템플릿 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="템플릿 검색... (⌘F)"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                flex: 1,
              }}
            />
          </div>
        </div>

        {/* Template list */}
        <div aria-busy={isLoading} aria-live="polite" style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-2)" }}>
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)", padding: "var(--ds-sp-2)" }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div
              style={{
                padding: "var(--ds-sp-5)",
                textAlign: "center",
                color: "var(--ds-text-faint)",
                fontSize: "var(--ds-fs-12)",
              }}
            >
              <div>검색 결과가 없습니다.</div>
              {search && (
                <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => setSearch("")}>
                  검색 지우기
                </Button>
              )}
            </div>
          )}

          {!isLoading &&
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className="hover:bg-fill hover:border-border transition-colors"
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: "var(--ds-r-8)",
                  padding: "var(--ds-sp-3)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--ds-sp-1)",
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--ds-fs-13)",
                      fontWeight: "var(--ds-fw-semibold)",
                      color: "var(--ds-text)",
                    }}
                  >
                    {t.name}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--ds-fs-10)",
                      color: "var(--ds-text-faint)",
                      fontFamily: "var(--ds-font-mono)",
                      background: "var(--ds-surface-2)",
                      border: "1px solid var(--ds-border)",
                      borderRadius: "var(--ds-r-6)",
                      padding: "1px 6px",
                    }}
                  >
                    {t.dialect}
                  </span>
                </div>
                {t.nlQuery && (
                  <div
                    style={{
                      fontSize: "var(--ds-fs-12)",
                      color: "var(--ds-text-mute)",
                    }}
                  >
                    {t.nlQuery}
                  </div>
                )}
                <pre
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    fontFamily: "var(--ds-font-mono)",
                    color: "var(--ds-text-faint)",
                    background: "var(--ds-surface-2, var(--ds-fill))",
                    border: "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-6)",
                    padding: "var(--ds-sp-1) var(--ds-sp-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    margin: 0,
                  }}
                  title={t.sql}
                >
                  {t.sql.slice(0, 100)}{t.sql.length > 100 ? "..." : ""}
                </pre>
              </button>
            ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            borderTop: "1px solid var(--ds-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="ghost" size="md" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
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

  const { dialect, setDialect } = useSettingsStore();
  const { data: connections } = useConnections();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ResultTab>("table");
  const [isEdited, setIsEdited] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationFetching, setExplanationFetching] = useState(false);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const savedOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [addToDashModal, setAddToDashModal] = useState<{ dashboards: Array<{ id: string; name: string; widgets: unknown[] }> } | null>(null);
  const [selectedDashId, setSelectedDashId] = useState<string>("");
  const [widgetLabel, setWidgetLabel] = useState<string>("");
  const [noDashMsg, setNoDashMsg] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [noConnWarn, setNoConnWarn] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveFolder, setSaveFolder] = useState("기본");

  useEffect(() => {
    return () => {
      if (savedOkTimer.current) clearTimeout(savedOkTimer.current);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === "Enter" && sql.trim() && status !== "running") {
        e.preventDefault();
        void handleRun();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && sql.trim() && status === "ready") {
        e.preventDefault();
        setSaveName(nlQuery || "쿼리");
        setSaveFolder("기본");
        setSaveModal(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sql, status, nlQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const newWidget = { type: "table", label, sql, connectionId: activeConnectionId ?? undefined, createdAt: new Date().toISOString() };
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
      setNoDashMsg(true);
      setTimeout(() => setNoDashMsg(false), 2500);
      return;
    }
    setSelectedDashId(fresh[0].id);
    setWidgetLabel(nlQuery || "쿼리 결과");
    setAddToDashModal({ dashboards: fresh });
  }

  async function handleGenerate() {
    if (!nlQuery.trim()) return;
    if (!activeConnectionId) {
      setNoConnWarn(true);
      setTimeout(() => setNoConnWarn(false), 3000);
    }
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
              aria-label="데이터베이스 연결 선택"
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
              <option value="">연결 없음</option>
              {(connections ?? []).map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>

            {/* Dialect selector */}
            <select
              aria-label="SQL 방언 선택"
              value={dialect}
              onChange={(e) => setDialect(e.target.value as typeof dialect)}
              style={{
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: "var(--ds-text-mute)",
                fontSize: "var(--ds-fs-12)",
                padding: "var(--ds-sp-1) var(--ds-sp-2)",
                fontFamily: "var(--ds-font-mono)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {(["postgresql", "mysql", "sqlite", "mssql", "oracle"] as const).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <Button
              variant="ghost"
              size="sm"
              icon={<FileText size={13} />}
              aria-label="템플릿 불러오기"
              onClick={() => setTemplatePickerOpen(true)}
            >
              템플릿
            </Button>

            {showResults && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-keyshortcuts="Meta+s"
                  aria-label="저장"
                  icon={savedOk ? <Check size={13} /> : <Star size={13} />}
                  loading={saveQueryMutation.isPending}
                  onClick={() => {
                    setSaveName(nlQuery || "쿼리");
                    setSaveFolder("기본");
                    setSaveModal(true);
                  }}
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
                type="button"
                aria-label={`예시 질문: ${chip}`}
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
                  transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                {chip}
              </button>
            ))}
            {nlQuery.length > 0 && (
              <>
                <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", fontFamily: "var(--ds-font-mono)" }}>
                  {nlQuery.length}자
                </span>
                <button
                  type="button"
                  aria-label="입력 지우기"
                  onClick={() => setNlQuery("")}
                  style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", padding: 2, borderRadius: "var(--ds-r-6)", transition: "color var(--ds-dur-fast) var(--ds-ease)" }}
                >
                  <X size={12} />
                </button>
              </>
            )}
            <div style={{ flex: 1 }} />
            <Button
              variant="accent"
              size="sm"
              loading={status === "generating"}
              aria-keyshortcuts="Meta+Enter"
              onClick={handleGenerate}
            >
              {status === "generating" ? "생성 중..." : "SQL 생성"}
            </Button>
          </div>
        </div>

        {/* No connection warning */}
        {noConnWarn && (
          <AICallout tone="default" label="◆ 연결 없음">
            연결된 DB가 없습니다. 상단에서 연결을 선택하면 스키마 기반 SQL이 생성됩니다.
          </AICallout>
        )}

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
                  {confidence === "high" ? "신뢰도 높음" : confidence === "medium" ? "신뢰도 중간" : "신뢰도 낮음"} {confidenceToPercent(confidence)}%
                </span>
              )}
              <div style={{ flex: 1 }} />
              {copyFailed && (
                <span role="alert" aria-live="assertive" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-danger, #e53e3e)" }}>복사 실패</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy size={12} />}
                onClick={() =>
                  navigator.clipboard.writeText(sql).catch(() => {
                    setCopyFailed(true);
                    setTimeout(() => setCopyFailed(false), 2000);
                  })
                }
              >
                복사
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={status === "running"}
                icon={<Play size={12} />}
                aria-keyshortcuts="Alt+Enter"
                onClick={handleRun}
              >
                실행 ⌥⏎
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "2px var(--ds-sp-3)",
                borderTop: "1px solid var(--ds-border)",
                fontSize: "var(--ds-fs-10)",
                color: "var(--ds-text-faint)",
                fontFamily: "var(--ds-font-mono)",
                background: "var(--ds-fill)",
              }}
            >
              {sql.split("\n").length}줄 · {sql.length}자
            </div>
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
              role="tablist"
              aria-label="결과 보기 탭"
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
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`result-panel-${tab.key}`}
                  id={`result-tab-${tab.key}`}
                  onClick={async () => {
                    setActiveTab(tab.key);
                    if (tab.key === "explain" && sql.trim() && (isEdited || !explanation) && !explanationFetching) {
                      setExplanationFetching(true);
                      try {
                        const r = await fetch("/api/queries/explain", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sql, dialect }),
                        });
                        const j = await r.json() as { data?: { explanation: string }; error?: string };
                        if (j.data?.explanation) setExplanation(j.data.explanation);
                      } catch { /* keep existing explanation */ } finally {
                        setExplanationFetching(false);
                      }
                    }
                  }}
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
                    transition: "color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
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
              {results && results.length >= 1000 && (
                <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-warn, #d97706)", background: "var(--ds-warn-soft, #fef3c7)", padding: "1px 6px", borderRadius: "var(--ds-r-4)", fontFamily: "var(--ds-font-sans)" }}>
                  최대 1,000행
                </span>
              )}
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
                onClick={() => { void handleAddToDashboard(); }}
              >
                대시보드 추가
              </Button>
              {noDashMsg && (
                <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)" }}>대시보드를 먼저 생성하세요</span>
              )}
            </div>

            {activeTab === "table" && results && (
              <div id="result-panel-table" role="tabpanel" aria-labelledby="result-tab-table">
                <ResultTable rows={results} columns={columns} />
              </div>
            )}

            {activeTab === "chart" && results && (
              <div id="result-panel-chart" role="tabpanel" aria-labelledby="result-tab-chart">
                <ResultChart rows={results} columns={columns} />
              </div>
            )}

            {activeTab === "explain" && (
              <div id="result-panel-explain" role="tabpanel" aria-labelledby="result-tab-explain" style={{ padding: "var(--ds-sp-4)" }}>
                <AICallout label="◆ AI · SQL 설명">
                  {explanationFetching
                    ? "SQL 설명을 불러오는 중..."
                    : explanation ?? "이 쿼리는 요청하신 데이터를 조회합니다."}
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
            <div style={{ fontSize: "var(--ds-fs-12)" }}>⌘⏎ SQL 생성 · ⌥⏎ 실행</div>
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

      {templatePickerOpen && (
        <TemplatePicker
          onSelect={(t) => {
            setSql(t.sql);
            setNlQuery(t.nlQuery);
            setStatus("ready");
            setTemplatePickerOpen(false);
          }}
          onClose={() => setTemplatePickerOpen(false)}
        />
      )}

      {saveModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="쿼리 저장"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setSaveModal(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setSaveModal(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}
          >
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>쿼리 저장</div>
            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>이름</div>
              <input
                autoFocus
                aria-label="쿼리 이름"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setSaveModal(false); }}
                placeholder="쿼리 이름"
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>폴더</div>
              <input
                aria-label="저장 폴더"
                value={saveFolder}
                onChange={(e) => setSaveFolder(e.target.value)}
                list="save-folder-list"
                placeholder="폴더 이름 (예: 기본, 분석, 보고서)"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSaveModal(false);
                  if (e.key === "Enter" && saveName.trim()) {
                    saveQueryMutation.mutate({ name: saveName.trim(), query: sql, folder: saveFolder.trim() || "기본" });
                    setSaveModal(false);
                  }
                }}
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", boxSizing: "border-box" }}
              />
              <datalist id="save-folder-list">
                <option value="기본" />
                <option value="분석" />
                <option value="보고서" />
                <option value="임시" />
              </datalist>
            </div>
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSaveModal(false)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:bg-surface hover:text-text">취소</button>
              <button
                type="button"
                disabled={!saveName.trim() || saveQueryMutation.isPending}
                onClick={() => { saveQueryMutation.mutate({ name: saveName.trim(), query: sql, folder: saveFolder.trim() || "기본" }); setSaveModal(false); }}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)", transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {addToDashModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="대시보드에 추가"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setAddToDashModal(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setAddToDashModal(null); }}
        >
          <div
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 320, maxWidth: 400, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>대시보드에 추가</div>

            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>대시보드 선택</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)", maxHeight: 160, overflowY: "auto" }}>
                {addToDashModal.dashboards.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={selectedDashId === d.id}
                    onClick={() => setSelectedDashId(d.id)}
                    style={{
                      padding: "var(--ds-sp-2) var(--ds-sp-3)",
                      borderRadius: "var(--ds-r-6)",
                      border: `1px solid ${selectedDashId === d.id ? "var(--ds-accent)" : "var(--ds-border)"}`,
                      background: selectedDashId === d.id ? "var(--ds-accent-soft)" : "transparent",
                      color: selectedDashId === d.id ? "var(--ds-accent)" : "var(--ds-text)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "var(--ds-fs-13)",
                      fontFamily: "var(--ds-font-sans)",
                      transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>위젯 이름</div>
              <input
                autoFocus
                aria-label="위젯 이름"
                value={widgetLabel}
                onChange={(e) => setWidgetLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAddToDashModal(null);
                  if (e.key === "Enter" && widgetLabel.trim() && selectedDashId) {
                    addToDashboardMutation.mutate({ dashId: selectedDashId, label: widgetLabel.trim() });
                    setAddToDashModal(null);
                  }
                }}
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-sans)", outline: "none", boxSizing: "border-box" }}
                placeholder="위젯 이름을 입력하세요"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setAddToDashModal(null)}>취소</Button>
              <Button
                variant="accent"
                size="sm"
                disabled={!widgetLabel.trim() || !selectedDashId || addToDashboardMutation.isPending}
                onClick={() => {
                  addToDashboardMutation.mutate({ dashId: selectedDashId, label: widgetLabel.trim() });
                  setAddToDashModal(null);
                }}
              >
                {addToDashboardMutation.isPending ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
