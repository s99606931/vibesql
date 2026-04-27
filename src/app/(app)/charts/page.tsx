"use client";

import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Plus, ExternalLink, BarChart2, TrendingUp, PieChart,
  Table2, Search, Play, RefreshCw, AlertCircle, LayoutDashboard, Download, Copy, Check, X,
} from "lucide-react";

const ResultChart = dynamic(
  () => import("@/components/workspace/ResultChart"),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  folder: string;
  dialect?: string;
  connectionId?: string;
  createdAt: string;
}

interface RunResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: RunResult }
  | { status: "error"; message: string };

const chartTypes = ["전체", "라인", "바", "파이", "테이블"] as const;
type ChartFilterType = (typeof chartTypes)[number];

function inferChartType(name: string, folder: string): ChartFilterType {
  const text = `${name} ${folder}`.toLowerCase();
  if (text.includes("추이") || text.includes("트렌드") || text.includes("라인") || text.includes("line")) return "라인";
  if (text.includes("비율") || text.includes("파이") || text.includes("pie") || text.includes("분포")) return "파이";
  if (text.includes("바") || text.includes("bar") || text.includes("매출") || text.includes("비교")) return "바";
  return "테이블";
}

const CHART_TYPE_ICONS: Record<string, React.ReactNode> = {
  "라인": <TrendingUp size={11} />,
  "바": <BarChart2 size={11} />,
  "파이": <PieChart size={11} />,
  "테이블": <Table2 size={11} />,
};

const CHART_TYPE_VARIANTS: Record<string, "accent" | "success" | "info" | "default"> = {
  "라인": "accent",
  "바": "info",
  "파이": "success",
  "테이블": "default",
};

function formatRelativeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "방금 전";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(diff / 3_600_000);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

function exportChartsCsv(charts: Array<{ name: string; folder: string; chartType: string; sql: string; dialect?: string; createdAt: string }>) {
  const headers = ["이름", "폴더", "차트 유형", "방언", "SQL", "생성일"];
  const esc = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = charts.map((c) => [c.name, c.folder, c.chartType, c.dialect ?? "", c.sql.replace(/\n/g, " "), new Date(c.createdAt).toLocaleString("ko-KR")].map(esc).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `charts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChartsPage() {
  const [activeFilter, setActiveFilter] = useState<ChartFilterType>("전체");
  const [search, setSearch] = useState("");
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());
  const [addDashModal, setAddDashModal] = useState<{ chartId: string; chartName: string; sql: string } | null>(null);
  const [selectedDashId, setSelectedDashId] = useState("");
  const [copiedChartId, setCopiedChartId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { setSql, setStatus, activeConnectionId } = useWorkspaceStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: dashboards = [] } = useQuery<Array<{ id: string; name: string; widgets: unknown[] }>>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const r = await fetch("/api/dashboards");
      const j = await r.json() as { data?: Array<{ id: string; name: string; widgets: unknown[] }> };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 60_000,
    enabled: !!addDashModal,
  });

  const addToDashMutation = useMutation({
    mutationFn: async ({ dashId, sql, label }: { dashId: string; sql: string; label: string }) => {
      const dash = dashboards.find((d) => d.id === dashId);
      const widgets = Array.isArray(dash?.widgets) ? dash!.widgets : [];
      const r = await fetch(`/api/dashboards/${dashId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: [...widgets, { type: "table", label, sql, createdAt: new Date().toISOString() }] }),
      });
      if (!r.ok) throw new Error("추가 실패");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setAddDashModal(null);
    },
  });

  const { data: savedQueries, isLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => {
      const res = await fetch("/api/saved");
      if (!res.ok) throw new Error("저장된 쿼리를 불러오지 못했습니다.");
      const json = await res.json() as { data: SavedQuery[] };
      return (Array.isArray(json.data) ? json.data : []) as SavedQuery[];
    },
    staleTime: 30_000,
  });

  const charts = (savedQueries ?? []).map((q) => ({
    ...q,
    chartType: inferChartType(q.name, q.folder),
  }));

  const visible = charts.filter((c) => {
    if (activeFilter !== "전체" && c.chartType !== activeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.sql.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getCardState = (id: string): CardState =>
    cardStates.get(id) ?? { status: "idle" };

  const setCardState = useCallback((id: string, state: CardState) => {
    setCardStates((prev) => new Map(prev).set(id, state));
  }, []);

  const runChart = useCallback(async (chart: typeof charts[number]) => {
    const connId = chart.connectionId ?? activeConnectionId ?? "";
    if (!connId) {
      setCardState(chart.id, { status: "error", message: "연결을 선택해주세요. 워크스페이스에서 연결을 활성화하세요." });
      return;
    }

    setCardState(chart.id, { status: "loading" });
    try {
      const res = await fetch("/api/queries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: chart.sql, connectionId: connId, limit: 200 }),
      });
      const json = await res.json() as { data?: RunResult; error?: string };
      if (!res.ok || json.error) {
        setCardState(chart.id, { status: "error", message: json.error ?? "실행 실패" });
      } else if (json.data) {
        setCardState(chart.id, { status: "ready", result: json.data });
      }
    } catch (e) {
      setCardState(chart.id, {
        status: "error",
        message: e instanceof Error ? e.message : "네트워크 오류",
      });
    }
  }, [activeConnectionId, setCardState]);

  function openInWorkspace(sql: string) {
    setSql(sql);
    setStatus("ready");
    router.push("/workspace");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="차트"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "차트" }]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
            {visible.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={13} />}
                onClick={() => exportChartsCsv(visible)}
              >
                CSV 내보내기
              </Button>
            )}
            {visible.length > 0 && activeConnectionId && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Play size={13} />}
                onClick={() => visible.forEach((c) => { void runChart(c); })}
              >
                모두 실행
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => {
                setCardStates(new Map());
                void queryClient.invalidateQueries({ queryKey: ["saved"] });
              }}
            >
              새로고침
            </Button>
            <Button variant="accent" size="sm" icon={<Plus size={13} />} onClick={() => router.push("/workspace")}>
              새 차트
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* Filter + search bar */}
        <div style={{ display: "flex", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-5)", alignItems: "center", flexWrap: "wrap" }}>
          {chartTypes.map((f) => {
            const count = f === "전체" ? charts.length : charts.filter((c) => c.chartType === f).length;
            return (
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
                {f}{count > 0 && <span style={{ marginLeft: 4, fontSize: "var(--ds-fs-10)", opacity: 0.7 }}>{count}</span>}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", padding: "var(--ds-sp-1) var(--ds-sp-2)", width: 200 }}>
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="차트 검색... (⌘F)"
              style={{ border: "none", background: "transparent", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", outline: "none", fontFamily: "var(--ds-font-sans)", flex: 1 }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 2, flexShrink: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
          {search && !isLoading && (
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", whiteSpace: "nowrap" }}>
              {visible.length}/{charts.length}개
            </span>
          )}
        </div>

        {/* No active connection warning */}
        {!activeConnectionId && !isLoading && visible.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              padding: "var(--ds-sp-3) var(--ds-sp-4)",
              background: "var(--ds-warn-soft, color-mix(in srgb, var(--ds-warn) 12%, transparent))",
              border: "1px solid var(--ds-warn)",
              borderRadius: "var(--ds-r-8)",
              marginBottom: "var(--ds-sp-4)",
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-warn)",
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            연결이 없습니다. 워크스페이스에서 DB 연결을 활성화해야 차트를 실행할 수 있습니다.
            <Button variant="ghost" size="sm" onClick={() => router.push("/workspace")} style={{ marginLeft: "auto" }}>
              연결하러 가기
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--ds-sp-4)" }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-13)" }}>
            {charts.length === 0 ? (
              <>
                <div>저장된 쿼리가 없습니다. 워크스페이스에서 쿼리를 저장해보세요.</div>
                <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => router.push("/workspace")}>
                  워크스페이스로 이동
                </Button>
              </>
            ) : (
              <>
                <div>검색 결과 없음</div>
                <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => setSearch("")}>
                  검색 지우기
                </Button>
              </>
            )}
          </div>
        )}

        {/* Chart grid */}
        {!isLoading && visible.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--ds-sp-4)", alignItems: "start" }}>
            {visible.map((chart) => {
              const state = getCardState(chart.id);
              return (
                <Card key={chart.id} hoverable padding="var(--ds-sp-3)" className="group">

                  {/* Chart preview area */}
                  <div
                    style={{
                      width: "100%",
                      borderRadius: "var(--ds-r-6)",
                      marginBottom: "var(--ds-sp-3)",
                      overflow: "hidden",
                      border: "1px solid var(--ds-border)",
                      background: "var(--ds-fill)",
                      minHeight: 140,
                    }}
                  >
                    {state.status === "idle" && (
                      <pre
                        className="ds-mono"
                        style={{
                          fontSize: "var(--ds-fs-10)",
                          color: "var(--ds-text-mute)",
                          margin: 0,
                          padding: "var(--ds-sp-3)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxHeight: 140,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 6,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {chart.sql}
                      </pre>
                    )}

                    {state.status === "loading" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 140, flexDirection: "column", gap: "var(--ds-sp-2)", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-12)" }}>
                        <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", color: "var(--ds-accent)" }} />
                        실행 중...
                      </div>
                    )}

                    {state.status === "error" && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--ds-sp-2)", padding: "var(--ds-sp-3)", color: "var(--ds-danger)", fontSize: "var(--ds-fs-12)" }}>
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{state.message}</span>
                      </div>
                    )}

                    {state.status === "ready" && state.result.columns.length > 0 && (
                      <ResultChart
                        rows={state.result.rows}
                        columns={state.result.columns}
                      />
                    )}

                    {state.status === "ready" && state.result.rows.length === 0 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 140, color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-12)" }}>
                        결과 없음
                      </div>
                    )}
                  </div>

                  {/* Title + folder */}
                  <div style={{ marginBottom: "var(--ds-sp-2)" }}>
                    <div title={chart.name} style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chart.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                      <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", fontFamily: "var(--ds-font-mono)" }}>
                        {chart.folder}
                      </span>
                      <span
                        title={new Date(chart.createdAt).toLocaleString("ko-KR")}
                        style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", cursor: "default" }}
                      >
                        {formatRelativeAgo(chart.createdAt)}
                      </span>
                      {state.status === "ready" && (
                        <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)" }}>
                          {state.result.rowCount}행 · {state.result.durationMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-3)" }}>
                    <Pill variant={CHART_TYPE_VARIANTS[chart.chartType] ?? "default"}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {CHART_TYPE_ICONS[chart.chartType]}
                        {chart.chartType}
                      </span>
                    </Pill>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
                    <Button
                      variant={state.status === "ready" ? "ghost" : "accent"}
                      size="sm"
                      icon={state.status === "loading"
                        ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                        : state.status === "ready"
                          ? <RefreshCw size={11} />
                          : <Play size={11} />}
                      onClick={() => runChart(chart)}
                      disabled={state.status === "loading"}
                    >
                      {state.status === "idle" ? "차트 실행" : state.status === "loading" ? "실행 중" : "새로고침"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={11} />}
                      onClick={() => openInWorkspace(chart.sql)}
                    >
                      워크스페이스
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<LayoutDashboard size={11} />}
                      onClick={() => { setSelectedDashId(""); setAddDashModal({ chartId: chart.id, chartName: chart.name, sql: chart.sql }); }}
                    >
                      대시보드
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={copiedChartId === chart.id ? <Check size={11} style={{ color: "var(--ds-success)" }} /> : <Copy size={11} />}
                      onClick={() => {
                        void navigator.clipboard.writeText(chart.sql);
                        setCopiedChartId(chart.id);
                        setTimeout(() => setCopiedChartId(null), 1500);
                      }}
                    >
                      {copiedChartId === chart.id ? "복사됨" : "SQL"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {addDashModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAddDashModal(null)} onKeyDown={(e) => { if (e.key === "Escape") setAddDashModal(null); }}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 300, maxWidth: 380, display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>대시보드에 추가</div>
            <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>"{addDashModal.chartName}"</div>
            {dashboards.length === 0 ? (
              <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", textAlign: "center", padding: "var(--ds-sp-4)" }}>대시보드를 먼저 생성하세요.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)", maxHeight: 160, overflowY: "auto" }}>
                {dashboards.map((d) => (
                  <button key={d.id} onClick={() => setSelectedDashId(d.id)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-3)", borderRadius: "var(--ds-r-6)", border: `1px solid ${selectedDashId === d.id ? "var(--ds-accent)" : "var(--ds-border)"}`, background: selectedDashId === d.id ? "var(--ds-accent-soft)" : "transparent", color: selectedDashId === d.id ? "var(--ds-accent)" : "var(--ds-text)", cursor: "pointer", textAlign: "left", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-sans)" }}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setAddDashModal(null)}>취소</Button>
              <Button variant="accent" size="sm" disabled={!selectedDashId || addToDashMutation.isPending} onClick={() => addToDashMutation.mutate({ dashId: selectedDashId, sql: addDashModal.sql, label: addDashModal.chartName })}>
                {addToDashMutation.isPending ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
