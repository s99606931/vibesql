"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Button } from "@/components/ui-vs/Button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Star, MoreHorizontal, Trash2, Download, ChevronDown, ChevronRight, Copy, Check, X } from "lucide-react";

type HistoryFilter = "전체" | "성공" | "실패" | "즐겨찾기";
const HISTORY_FILTERS: HistoryFilter[] = ["전체", "성공", "실패", "즐겨찾기"];

interface HistoryItem {
  id: string;
  nlQuery?: string;
  sql: string;
  dialect?: string;
  status: "SUCCESS" | "ERROR" | "BLOCKED";
  rowCount?: number;
  durationMs?: number | null;
  errorMsg?: string;
  starred: boolean;
  createdAt: string;
  connectionName?: string;
}


function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const d = new Date(item.createdAt).toDateString();
    const label =
      d === today
        ? "오늘"
        : d === yesterday
        ? "어제"
        : new Date(item.createdAt).toLocaleDateString("ko-KR");
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

function formatTime(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("전체");
  const [search, setSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [clearAllModal, setClearAllModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setSql, setNlQuery, setStatus } = useWorkspaceStore();

  const starMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/history/${id}/star`, { method: "POST" });
      if (!res.ok) throw new Error("즐겨찾기 처리에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) throw new Error("전체 삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const [limit, setLimit] = useState(50);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const statusParam =
    activeFilter === "성공" ? "SUCCESS" :
    activeFilter === "실패" ? "ERROR" :
    undefined;
  const starredParam = activeFilter === "즐겨찾기";

  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ["history", search, activeFilter, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (search) params.set("search", search);
      if (statusParam) params.set("status", statusParam);
      if (starredParam) params.set("starred", "true");
      const res = await fetch(`/api/history?${params.toString()}`);
      const json = await res.json() as { data: HistoryItem[]; meta?: { total: number }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "히스토리를 불러오지 못했습니다.");
      return json;
    },
    staleTime: 10_000,
  });

  const data = historyResponse?.data ?? [];
  const totalCount = historyResponse?.meta?.total ?? data.length;
  const filtered = data;

  const historyGroups = groupByDate(filtered);

  function exportHistoryCsv() {
    if (data.length === 0) return;
    const headers = ["createdAt", "status", "dialect", "rowCount", "durationMs", "nlQuery", "sql", "errorMsg"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...data.map((item) =>
        headers.map((h) => escape(item[h as keyof HistoryItem])).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="히스토리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "히스토리" }]}
        actions={
          data.length > 0 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={13} />}
                onClick={exportHistoryCsv}
              >
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => setClearAllModal(true)}
              >
                전체 삭제
              </Button>
            </>
          ) : undefined
        }
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
          {HISTORY_FILTERS.map((f) => (
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
          <div style={{ position: "relative" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="히스토리 검색... (⌘F)"
              style={{
                paddingTop: "var(--ds-sp-1)",
                paddingBottom: "var(--ds-sp-1)",
                paddingLeft: "var(--ds-sp-3)",
                paddingRight: search ? 28 : "var(--ds-sp-3)",
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
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Total count */}
        {!isLoading && filtered.length > 0 && (
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginBottom: "var(--ds-sp-3)" }}>
            {filtered.length.toLocaleString()}개 쿼리{totalCount > filtered.length ? ` (전체 ${totalCount.toLocaleString()}개 중)` : ""}
          </div>
        )}

        {/* History list */}
        {!isLoading &&
          Object.entries(historyGroups).map(([date, items]) => {
            const collapsed = collapsedDates.has(date);
            return (
            <div key={date} style={{ marginBottom: "var(--ds-sp-5)" }}>
              <button
                onClick={() => setCollapsedDates((prev) => {
                  const next = new Set(prev);
                  if (next.has(date)) next.delete(date); else next.add(date);
                  return next;
                })}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "var(--ds-fs-11)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-text-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "var(--ds-sp-2)",
                  paddingLeft: "var(--ds-sp-1)",
                  padding: 0,
                }}
              >
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {date}
                <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", fontWeight: "normal", textTransform: "none", letterSpacing: 0 }}>
                  ({items.length})
                </span>
              </button>

              {!collapsed && <Card padding={0}>
                {items.map((item, i) => (
                  <div key={item.id}>
                  <div
                    className="group"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-3)",
                      padding: "var(--ds-sp-3) var(--ds-sp-4)",
                      borderBottom: (i < items.length - 1 && expandedErrorId !== item.id) ? "1px solid var(--ds-border)" : undefined,
                      cursor: "pointer",
                      transition: "background var(--ds-dur-fast) var(--ds-ease)",
                    }}
                    onClick={() => {
                      setExpandedErrorId((prev) => prev === item.id ? null : item.id);
                    }}
                  >
                    {/* Expand chevron */}
                    <span style={{ color: "var(--ds-text-faint)", flexShrink: 0, display: "flex" }}>
                      {expandedErrorId === item.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>

                    {/* Time */}
                    <span
                      className="ds-mono"
                      title={new Date(item.createdAt).toLocaleString("ko-KR")}
                      style={{
                        fontSize: "var(--ds-fs-11)",
                        color: "var(--ds-text-faint)",
                        width: 36,
                        flexShrink: 0,
                        cursor: "default",
                      }}
                    >
                      {formatTime(item.createdAt)}
                    </span>

                    {/* Query */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        title={item.nlQuery ?? item.sql}
                        style={{
                          fontSize: "var(--ds-fs-13)",
                          color: "var(--ds-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.nlQuery ?? item.sql}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--ds-sp-2)",
                          marginTop: 2,
                          alignItems: "center",
                        }}
                      >
                        {item.connectionName && (
                          <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                            {item.connectionName}
                          </span>
                        )}
                        {item.rowCount != null && item.rowCount > 0 && (
                          <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                            {item.rowCount.toLocaleString()}행
                          </span>
                        )}
                        <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                          {formatDuration(item.durationMs)}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    {item.status === "SUCCESS" ? (
                      <Pill variant="success" dot="ok">성공</Pill>
                    ) : item.status === "ERROR" ? (
                      <Pill variant="danger" dot="err">실패</Pill>
                    ) : (
                      <Pill variant="warn">차단</Pill>
                    )}

                    {/* Starred */}
                    {item.starred && (
                      <Star size={13} style={{ color: "var(--ds-warn)", fill: "var(--ds-warn)", flexShrink: 0 }} />
                    )}

                    {/* Actions (hover) */}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--ds-sp-1)",
                        opacity: 0,
                        transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
                      }}
                      className="group-hover:opacity-100"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RotateCcw size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.nlQuery) setNlQuery(item.nlQuery);
                          setSql(item.sql);
                          setStatus("ready");
                          router.push("/workspace");
                        }}
                      >재실행</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={
                          <Star
                            size={12}
                            style={item.starred ? { fill: "var(--ds-warn)", color: "var(--ds-warn)" } : undefined}
                          />
                        }
                        onClick={(e) => { e.stopPropagation(); starMutation.mutate(item.id); }}
                      >저장</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={copiedId === item.id ? <Check size={12} style={{ color: "var(--ds-success)" }} /> : <Copy size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(item.sql);
                          setCopiedId(item.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                      >{copiedId === item.id ? "복사됨" : "복사"}</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<MoreHorizontal size={12} />}
                        aria-label="삭제"
                        loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(item.id);
                        }}
                      >삭제</Button>
                    </div>
                  </div>
                  {expandedErrorId === item.id && (
                    <div
                      style={{
                        padding: "var(--ds-sp-2) var(--ds-sp-4)",
                        background: item.errorMsg ? "var(--ds-danger-soft, #fff1f0)" : "var(--ds-fill)",
                        borderTop: `1px solid ${item.errorMsg ? "var(--ds-danger-border, #fca5a5)" : "var(--ds-border)"}`,
                        borderBottom: i < items.length - 1 ? "1px solid var(--ds-border)" : undefined,
                        fontSize: "var(--ds-fs-12)",
                        fontFamily: "var(--ds-font-mono)",
                        color: item.errorMsg ? "var(--ds-danger, #e53e3e)" : "var(--ds-text-mute)",
                        wordBreak: "break-all",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.errorMsg ?? item.sql}
                    </div>
                  )}
                  </div>
                ))}
              </Card>}
            </div>
          );})}



        {/* No-results */}
        {!isLoading && filtered.length === 0 && (search || activeFilter !== "전체") && (
          <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>
            {search ? "검색 결과가 없습니다." : "해당 필터에 결과가 없습니다."}
          </div>
        )}

        {/* Load more */}
        {data.length > 0 && data.length < totalCount && (
          <div style={{ textAlign: "center", paddingTop: "var(--ds-sp-4)" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit((prev) => prev + 50)}
            >
              더 보기 ({data.length}/{totalCount}개)
            </Button>
          </div>
        )}
      </div>

      {clearAllModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setClearAllModal(false)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 320, maxWidth: 400, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>전체 히스토리 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", lineHeight: 1.6 }}>
              모든 쿼리 히스토리 ({totalCount.toLocaleString()}개)가 영구적으로 삭제됩니다.<br />
              이 작업은 되돌릴 수 없습니다.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setClearAllModal(false)}>취소</Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={12} />}
                loading={clearAllMutation.isPending}
                onClick={() => { clearAllMutation.mutate(); setClearAllModal(false); }}
              >
                전체 삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)} onKeyDown={(e) => { if (e.key === "Escape") setDeleteConfirmId(null); }}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>히스토리 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 히스토리 항목을 삭제할까요?</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>취소</Button>
              <Button variant="danger" size="sm" onClick={() => { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); }}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
