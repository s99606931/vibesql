"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BarChart2,
  TrendingUp,
  Table2,
  Pencil,
  Trash2,
  Clock,
  Globe,
  Lock,
  Copy,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Database,
  ChevronDown,
} from "lucide-react";
import ResultChart from "@/components/workspace/ResultChart";
import { ResultTable } from "@/components/workspace/ResultTable";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "방금 전";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 30) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Widget {
  type: string;       // "table" | "bar" | "line" | "area"
  label: string;
  sql?: string;
  connectionId?: string;
  createdAt?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  isPublic: boolean;
  updatedAt: string;
  createdAt: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
  database: string;
  host?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs?: number;
}

// ── Helper ───────────────────────────────────────────────────────────────────

function WidgetTypeIcon({ type }: { type: string }) {
  if (type === "line") return <TrendingUp size={14} />;
  if (type === "bar") return <BarChart2 size={14} />;
  return <Table2 size={14} />;
}

// ── Connection Selector ───────────────────────────────────────────────────────

interface ConnectionSelectorProps {
  connections: Connection[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

function ConnectionSelector({ connections, selectedId, onChange }: ConnectionSelectorProps) {
  const selected = connections.find((c) => c.id === selectedId);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
      <Database size={13} style={{ color: "var(--ds-text-mute)", flexShrink: 0 }} />
      <div style={{ position: "relative" }}>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            background: "var(--ds-fill)",
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-6)",
            padding: "4px 28px 4px 10px",
            fontSize: "var(--ds-fs-12)",
            color: selected ? "var(--ds-text)" : "var(--ds-text-faint)",
            fontFamily: "var(--ds-font-sans)",
            cursor: "pointer",
            outline: "none",
            minWidth: 160,
          }}
        >
          <option value="">연결 선택...</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.database})
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ds-text-mute)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Widget Card ───────────────────────────────────────────────────────────────

interface WidgetCardProps {
  widget: Widget;
  index: number;
  selectedConnectionId: string | null;
  onRemove: (index: number) => void;
  isRemoving: boolean;
}

function WidgetCard({ widget, index, selectedConnectionId, onRemove, isRemoving }: WidgetCardProps) {
  // Determine which connectionId to use: widget's own > globally selected
  const effectiveConnectionId = widget.connectionId ?? selectedConnectionId;

  const hasSql = Boolean(widget.sql?.trim());
  const canFetch = hasSql && Boolean(effectiveConnectionId);

  const { data, isLoading, isError, error, refetch } = useQuery<QueryResult>({
    queryKey: ["widget-data", widget.sql, widget.label, effectiveConnectionId],
    queryFn: async () => {
      const res = await fetch("/api/queries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: widget.sql,
          connectionId: effectiveConnectionId,
          limit: 1000,
        }),
      });
      const json = await res.json() as { data?: QueryResult; error?: string };
      if (!res.ok) throw new Error(json.error ?? "쿼리 실행 실패");
      if (!json.data) throw new Error("응답 데이터가 없습니다.");
      return json.data;
    },
    enabled: canFetch,
    staleTime: 0,
    retry: false,
  });

  const showChart = widget.type === "bar" || widget.type === "line" || widget.type === "area";

  return (
    <div
      style={{
        border: "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)",
        background: "var(--ds-surface)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Widget Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--ds-sp-2) var(--ds-sp-3)",
          borderBottom: "1px solid var(--ds-border)",
          background: "var(--ds-fill)",
          gap: "var(--ds-sp-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", minWidth: 0 }}>
          <span style={{ color: "var(--ds-accent)", flexShrink: 0 }}>
            <WidgetTypeIcon type={widget.type} />
          </span>
          <span
            title={widget.label}
            style={{
              fontSize: "var(--ds-fs-13)",
              fontWeight: "var(--ds-fw-medium)",
              color: "var(--ds-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {widget.label}
          </span>
          {data && (
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", flexShrink: 0 }}>
              {data.rowCount.toLocaleString()}행
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {canFetch && (
            <button
              onClick={() => void refetch()}
              disabled={isLoading}
              title="새로고침"
              style={{
                background: "none",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                color: "var(--ds-text-faint)",
                padding: 2,
                display: "flex",
                alignItems: "center",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <RefreshCw size={11} style={{ animation: isLoading ? "spin 1s linear infinite" : undefined }} />
            </button>
          )}
          <button
            onClick={() => onRemove(index)}
            disabled={isRemoving}
            title="위젯 삭제"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ds-text-faint)",
              padding: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Widget Body */}
      <div style={{ flex: 1 }}>
        {/* No SQL: label-only card */}
        {!hasSql && (
          <div
            style={{
              padding: "var(--ds-sp-4)",
              fontSize: "var(--ds-fs-13)",
              color: "var(--ds-text-faint)",
              textAlign: "center",
            }}
          >
            SQL이 없는 위젯입니다.
          </div>
        )}

        {/* Has SQL but no connection selected */}
        {hasSql && !effectiveConnectionId && (
          <div
            style={{
              padding: "var(--ds-sp-4)",
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-text-faint)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
            }}
          >
            <Database size={18} style={{ color: "var(--ds-text-faint)", opacity: 0.5 }} />
            <span>연결을 선택하면 SQL을 실행합니다.</span>
          </div>
        )}

        {/* Loading */}
        {canFetch && isLoading && (
          <div style={{ padding: "var(--ds-sp-3)" }}>
            <Skeleton className="h-4 w-3/4 rounded mb-2" />
            <Skeleton className="h-4 w-1/2 rounded mb-2" />
            <Skeleton className="h-4 w-5/6 rounded" />
          </div>
        )}

        {/* Error */}
        {canFetch && isError && !isLoading && (
          <div
            style={{
              padding: "var(--ds-sp-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--ds-sp-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                fontSize: "var(--ds-fs-12)",
                color: "var(--ds-danger)",
              }}
            >
              <AlertCircle size={13} />
              <span>{error instanceof Error ? error.message : "쿼리 실행에 실패했습니다."}</span>
            </div>
            {widget.sql && (
              <pre
                style={{
                  fontSize: "var(--ds-fs-11)",
                  fontFamily: "var(--ds-font-mono)",
                  color: "var(--ds-text-mute)",
                  background: "var(--ds-fill)",
                  borderRadius: "var(--ds-r-6)",
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  margin: 0,
                  maxHeight: 80,
                  overflowY: "auto",
                }}
              >
                {widget.sql}
              </pre>
            )}
          </div>
        )}

        {/* Success: render chart or table */}
        {canFetch && !isLoading && !isError && data && (
          <div>
            {showChart ? (
              <ResultChart rows={data.rows} columns={data.columns} />
            ) : (
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                <ResultTable rows={data.rows.slice(0, 100)} columns={data.columns} />
                {data.rowCount > 100 && (
                  <div
                    style={{
                      padding: "var(--ds-sp-2) var(--ds-sp-3)",
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                      borderTop: "1px solid var(--ds-border)",
                    }}
                  >
                    상위 100행 표시 중 (전체 {data.rowCount.toLocaleString()}행)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Dashboard data
  const { data: dashboard, isLoading, isError } = useQuery<Dashboard>({
    queryKey: ["dashboard", id],
    queryFn: async () => {
      const r = await fetch(`/api/dashboards/${id}`);
      if (!r.ok) throw new Error("대시보드를 찾을 수 없습니다.");
      const j = await r.json() as { data: Dashboard };
      return j.data;
    },
    staleTime: 30_000,
  });

  // Connections list
  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: async () => {
      const r = await fetch("/api/connections");
      const j = await r.json() as { data?: Connection[] };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/dashboards/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      router.push("/dashboards");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const r = await fetch(`/api/dashboards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!r.ok) throw new Error("수정 실패");
      return (await r.json() as { data: Dashboard }).data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["dashboard", id], updated);
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/dashboards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !dashboard?.isPublic }),
      });
      if (!r.ok) throw new Error("공유 설정 변경 실패");
      return (await r.json() as { data: Dashboard }).data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["dashboard", id], updated);
    },
  });

  const removeWidgetMutation = useMutation({
    mutationFn: async (widgetIndex: number) => {
      const widgets = (dashboard?.widgets ?? []).filter((_, i) => i !== widgetIndex);
      const r = await fetch(`/api/dashboards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets }),
      });
      if (!r.ok) throw new Error("위젯 삭제 실패");
      return (await r.json() as { data: Dashboard }).data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["dashboard", id], updated);
    },
  });

  function handleRename() {
    setRenameName(dashboard?.name ?? "");
    setRenameDesc(dashboard?.description ?? "");
    setRenameModal(true);
  }

  // ── Loading / Error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <TopBar
          title="대시보드"
          breadcrumbs={[{ label: "vibeSQL" }, { label: "대시보드", href: "/dashboards" }, { label: "…" }]}
        />
        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
          <Skeleton className="h-8 w-64 rounded mb-4" />
          <Skeleton className="h-40 w-full rounded" />
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <TopBar
          title="대시보드"
          breadcrumbs={[{ label: "vibeSQL" }, { label: "대시보드", href: "/dashboards" }, { label: "오류" }]}
        />
        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
          <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-danger)" }}>
            대시보드를 불러오지 못했습니다.
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={13} />}
            onClick={() => router.push("/dashboards")}
            style={{ marginTop: "var(--ds-sp-3)" }}
          >
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const widgets = (dashboard.widgets ?? []) as Widget[];
  const connList = connections ?? [];

  // Determine if any widget needs a connection (has sql but no widget-level connectionId)
  const needsGlobalConnection = widgets.some((w) => w.sql?.trim() && !w.connectionId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title={dashboard.name}
        breadcrumbs={[
          { label: "vibeSQL" },
          { label: "대시보드", href: "/dashboards" },
          { label: dashboard.name },
        ]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={12} />}
              loading={renameMutation.isPending}
              onClick={handleRename}
            >
              편집
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={12} />}
              loading={deleteMutation.isPending}
              onClick={() => setDeleteConfirm(true)}
            >
              삭제
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-4)",
          }}
        >

          {/* Meta card */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "var(--ds-sp-4)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--ds-fs-22)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: "var(--ds-text)",
                    marginBottom: "var(--ds-sp-1)",
                  }}
                >
                  {dashboard.name}
                </div>
                {dashboard.description && (
                  <div
                    style={{
                      fontSize: "var(--ds-fs-13)",
                      color: "var(--ds-text-mute)",
                      marginBottom: "var(--ds-sp-2)",
                    }}
                  >
                    {dashboard.description}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", flexWrap: "wrap" }}>
                  <button
                    onClick={() => togglePublicMutation.mutate()}
                    disabled={togglePublicMutation.isPending}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    title={dashboard.isPublic ? "비공개로 전환" : "공유로 전환"}
                  >
                    <Pill variant={dashboard.isPublic ? "success" : "default"}>
                      {dashboard.isPublic
                        ? <><Globe size={10} style={{ marginRight: 3 }} />공유됨</>
                        : <><Lock size={10} style={{ marginRight: 3 }} />비공개</>}
                    </Pill>
                  </button>
                  {dashboard.isPublic && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="hover:bg-fill transition-colors"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "none",
                        border: `1px solid var(--ds-border)`,
                        borderRadius: "var(--ds-r-6)",
                        padding: "2px 8px",
                        cursor: "pointer",
                        fontSize: "var(--ds-fs-11)",
                        color: copiedUrl ? "var(--ds-success)" : "var(--ds-text-mute)",
                      }}
                      title="공유 URL 복사"
                    >
                      {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
                      {copiedUrl ? "복사됨!" : "URL 복사"}
                    </button>
                  )}
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                    }}
                  >
                    <Clock size={11} />
                    <span title={new Date(dashboard.updatedAt).toLocaleString("ko-KR")}>{formatRelativeTime(dashboard.updatedAt)}</span>
                  </span>
                </div>
              </div>

              {/* Connection selector: show when there are SQL-capable widgets */}
              {widgets.some((w) => w.sql?.trim()) && connList.length > 0 && needsGlobalConnection && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-2)",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--ds-fs-12)",
                      color: "var(--ds-text-mute)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    기본 연결:
                  </span>
                  <ConnectionSelector
                    connections={connList}
                    selectedId={selectedConnectionId}
                    onChange={setSelectedConnectionId}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Widgets section */}
          <Card padding="var(--ds-sp-4)">
            <CardHead
              title="위젯"
              meta={`${widgets.length}개`}
              actions={
                widgets.some((w) => w.sql?.trim()) && connList.length > 0 && !needsGlobalConnection ? (
                  <ConnectionSelector
                    connections={connList}
                    selectedId={selectedConnectionId}
                    onChange={setSelectedConnectionId}
                  />
                ) : undefined
              }
            />

            {widgets.length === 0 ? (
              <div
                style={{
                  padding: "var(--ds-sp-6)",
                  textAlign: "center",
                  border: "1px dashed var(--ds-border)",
                  borderRadius: "var(--ds-r-6)",
                  color: "var(--ds-text-faint)",
                  fontSize: "var(--ds-fs-13)",
                }}
              >
                위젯이 없습니다. 워크스페이스에서 쿼리 결과를 이 대시보드에 추가하세요.
                <div style={{ marginTop: "var(--ds-sp-3)" }}>
                  <Button variant="ghost" size="sm" onClick={() => router.push("/workspace")}>
                    워크스페이스로 이동
                  </Button>
                </div>
              </div>
            ) : connList.length === 0 && widgets.some((w) => w.sql?.trim()) ? (
              /* No connections at all: show banner + widget labels */
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-2)",
                    padding: "var(--ds-sp-3)",
                    borderRadius: "var(--ds-r-6)",
                    background: "var(--ds-accent-soft)",
                    border: "1px solid var(--ds-accent)",
                    fontSize: "var(--ds-fs-12)",
                    color: "var(--ds-accent)",
                  }}
                >
                  <Database size={14} />
                  <span>
                    SQL 위젯을 실행하려면{" "}
                    <a
                      href="/connections"
                      style={{ color: "var(--ds-accent)", textDecoration: "underline", cursor: "pointer" }}
                    >
                      데이터베이스 연결
                    </a>
                    을 먼저 추가하세요.
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "var(--ds-sp-3)",
                  }}
                >
                  {widgets.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid var(--ds-border)",
                        borderRadius: "var(--ds-r-8)",
                        padding: "var(--ds-sp-3)",
                        background: "var(--ds-fill)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--ds-sp-2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                        <span style={{ color: "var(--ds-accent)" }}>
                          <WidgetTypeIcon type={w.type} />
                        </span>
                        <span style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)" }}>
                          {w.label}
                        </span>
                      </div>
                      <button
                        onClick={() => removeWidgetMutation.mutate(i)}
                        disabled={removeWidgetMutation.isPending}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--ds-text-faint)",
                          padding: 2,
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="위젯 삭제"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Normal widget grid */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: "var(--ds-sp-4)",
                }}
              >
                {widgets.map((w, i) => (
                  <WidgetCard
                    key={`${i}-${w.label}-${w.sql ?? ""}`}
                    widget={w}
                    index={i}
                    selectedConnectionId={selectedConnectionId}
                    onRemove={(idx) => removeWidgetMutation.mutate(idx)}
                    isRemoving={removeWidgetMutation.isPending}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirm(false)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>대시보드 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>"{dashboard?.name}" 대시보드를 삭제할까요? 위젯 데이터도 함께 삭제됩니다.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>취소</Button>
              <Button variant="danger" size="sm" onClick={() => { deleteMutation.mutate(); setDeleteConfirm(false); }}>삭제</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setRenameModal(false)}
        >
          <div
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 320, maxWidth: 400, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>대시보드 이름 편집</div>

            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>이름</div>
              <input
                autoFocus
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenameModal(false);
                  if (e.key === "Enter" && renameName.trim() && renameName.trim() !== dashboard?.name) {
                    renameMutation.mutate({ name: renameName.trim(), description: renameDesc || undefined });
                    setRenameModal(false);
                  }
                }}
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-sans)", outline: "none", boxSizing: "border-box" }}
                placeholder="대시보드 이름"
              />
            </div>

            <div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>설명 (선택)</div>
              <input
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setRenameModal(false); }}
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-sans)", outline: "none", boxSizing: "border-box" }}
                placeholder="대시보드 설명"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setRenameModal(false)}>취소</Button>
              <Button
                variant="accent"
                size="sm"
                disabled={!renameName.trim() || renameName.trim() === dashboard?.name || renameMutation.isPending}
                onClick={() => {
                  renameMutation.mutate({ name: renameName.trim(), description: renameDesc || undefined });
                  setRenameModal(false);
                }}
              >
                {renameMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe (inline) */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
