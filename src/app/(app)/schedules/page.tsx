"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Plus, Trash2, Play, Pencil, Clock, Calendar, CheckCircle2, XCircle, Loader, ChevronDown, ChevronRight, Database, Search, Download, X, Copy, Check } from "lucide-react";
import type { ScheduledQuery, DbDialect } from "@/types";
import { useConnections } from "@/hooks/useConnections";

// ─── helpers ──────────────────────────────────────────────────────────────────

function cronToHuman(expr: string): string {
  const presetMap: Record<string, string> = {
    "0 * * * *": "매시간 정각",
    "0 0 * * *": "매일 자정 (00:00)",
    "0 9 * * *": "매일 오전 9:00",
    "0 9 * * 1": "매주 월요일 오전 9:00",
    "0 9 1 * *": "매월 1일 오전 9:00",
  };
  if (presetMap[expr.trim()]) return presetMap[expr.trim()];
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "";
  const [min, hour, dom, , dow] = parts;
  const timeStr = (hour !== "*" && min !== "*") ? `${hour.padStart(2, "0")}:${min.padStart(2, "0")}` : null;
  if (dom !== "*" && dow === "*") return `매월 ${dom}일${timeStr ? ` ${timeStr}` : ""}`;
  if (dow !== "*" && dom === "*") {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const d = parseInt(dow, 10);
    return `매주 ${!isNaN(d) && days[d] ? days[d] + "요일" : dow}${timeStr ? ` ${timeStr}` : ""}`;
  }
  if (dom === "*" && dow === "*") return `매일${timeStr ? ` ${timeStr}` : " (매시간)"}`;
  return "";
}

function isCronValid(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  return parts.every((p, i) => {
    if (p === "*") return true;
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= ranges[i][0] && n <= ranges[i][1];
  });
}

const CRON_PRESETS = [
  { label: "매시간", value: "0 * * * *" },
  { label: "매일 자정", value: "0 0 * * *" },
  { label: "매일 오전 9시", value: "0 9 * * *" },
  { label: "매주 월요일", value: "0 9 * * 1" },
  { label: "매월 1일", value: "0 9 1 * *" },
];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs < 0) return formatTime(iso);
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}분 후`;
  const diffHr = Math.round(diffMs / 3600000);
  if (diffHr < 24) return `${diffHr}시간 후`;
  const diffDay = Math.round(diffMs / 86400000);
  return `${diffDay}일 후`;
}

function statusIcon(status: string | null | undefined) {
  if (!status) return null;
  if (status === "success") return <CheckCircle2 size={14} style={{ color: "var(--ds-success)" }} />;
  if (status === "error") return <XCircle size={14} style={{ color: "var(--ds-danger)" }} />;
  return <Loader size={14} style={{ color: "var(--ds-warn)" }} />;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface ScheduleFormData {
  name: string;
  sql: string;
  dialect: DbDialect;
  cronExpr: string;
  isActive: boolean;
  connectionId?: string;
}

const DEFAULT_FORM: ScheduleFormData = {
  name: "",
  sql: "",
  dialect: "postgresql",
  cronExpr: "0 9 * * *",
  isActive: true,
  connectionId: undefined,
};

function ScheduleModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: ScheduleFormData;
  onSave: (data: ScheduleFormData) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ScheduleFormData>(initial);
  const { data: connections = [] } = useConnections();

  function set<K extends keyof ScheduleFormData>(k: K, v: ScheduleFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial.name ? "스케줄 편집" : "스케줄 추가"}
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
          background: "var(--ds-surface)",
          borderRadius: "var(--ds-r-8)",
          border: "1px solid var(--ds-border)",
          padding: "var(--ds-sp-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-4)",
          boxShadow: "var(--ds-shadow-modal)",
        }}
      >
        <div style={{ fontSize: "var(--ds-fs-16)", fontWeight: "var(--ds-fw-bold)", color: "var(--ds-text)" }}>
          {initial.name ? "스케줄 편집" : "스케줄 추가"}
        </div>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="sched-name" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            스케줄 이름 <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <input
            id="sched-name"
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 일별 매출 집계"
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-fill)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-13)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              outline: "none",
              fontFamily: "var(--ds-font-sans)",
            }}
          />
        </div>

        {/* SQL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="sched-sql" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            SQL 쿼리 <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <textarea
            id="sched-sql"
            value={form.sql}
            onChange={(e) => set("sql", e.target.value)}
            rows={5}
            placeholder="SELECT ..."
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-fill)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-12)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              outline: "none",
              fontFamily: "var(--ds-font-mono)",
              resize: "vertical",
            }}
          />
        </div>

        {/* Dialect + Cron row */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>DB 방언</label>
            <select
              aria-label="DB 방언"
              value={form.dialect}
              onChange={(e) => set("dialect", e.target.value as DbDialect)}
              style={{
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                cursor: "pointer",
              }}
            >
              {(["postgresql", "mysql", "sqlite", "mssql", "oracle"] as DbDialect[]).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>실행 주기</label>
            <select
              aria-label="실행 주기"
              value={CRON_PRESETS.some((p) => p.value === form.cronExpr) ? form.cronExpr : "custom"}
              onChange={(e) => {
                if (e.target.value !== "custom") set("cronExpr", e.target.value);
              }}
              style={{
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                cursor: "pointer",
              }}
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">직접 입력</option>
            </select>
          </div>
        </div>

        {/* Cron expression display / edit */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="sched-cron" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>Cron 표현식</label>
          <input
            id="sched-cron"
            value={form.cronExpr}
            onChange={(e) => set("cronExpr", e.target.value)}
            placeholder="0 9 * * *"
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-fill)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-13)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              outline: "none",
              fontFamily: "var(--ds-font-mono)",
            }}
          />
          <div style={{ display: "flex", gap: "var(--ds-sp-2)", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
              형식: 분 시 일 월 요일 (예: 0 9 * * 1 = 매주 월요일 오전 9시)
            </span>
            {form.cronExpr.trim() && !isCronValid(form.cronExpr) && (
              <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-danger)", fontWeight: "var(--ds-fw-medium)" }}>
                ⚠ 잘못된 Cron 형식입니다
              </span>
            )}
            {cronToHuman(form.cronExpr) && isCronValid(form.cronExpr) && (
              <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-accent)", fontWeight: "var(--ds-fw-medium)" }}>
                → {cronToHuman(form.cronExpr)}
              </span>
            )}
          </div>
        </div>

        {/* Connection selector */}
        {connections.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>연결 (선택)</label>
            <select
              aria-label="연결 선택"
              value={form.connectionId ?? ""}
              onChange={(e) => set("connectionId", e.target.value || undefined)}
              style={{ border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", padding: "var(--ds-sp-2) var(--ds-sp-3)", outline: "none", fontFamily: "var(--ds-font-sans)", cursor: "pointer" }}
            >
              <option value="">연결 선택 안함</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
          <Button variant="ghost" size="md" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            size="md"
            loading={saving}
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || !form.sql.trim() || !isCronValid(form.cronExpr)}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

function exportSchedulesCsv(data: ScheduledQuery[]) {
  const headers = ["이름", "방언", "Cron", "활성", "마지막 실행", "상태", "행 수", "소요 시간(ms)"];
  const esc = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = data.map((s) => [
    s.name,
    s.dialect,
    s.cronExpr,
    s.isActive ? "활성" : "비활성",
    s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("ko-KR") : "",
    s.lastRunStatus ?? "",
    s.rowCount != null ? String(s.rowCount) : "",
    s.durationMs != null ? String(s.durationMs) : "",
  ].map(esc).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedules-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const { data: connections = [] } = useConnections();
  const [modal, setModal] = useState<{ open: boolean; editing: ScheduledQuery | null }>({ open: false, editing: null });
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedSqlId, setExpandedSqlId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [copiedSqlId, setCopiedSqlId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const r = await fetch("/api/schedules");
      if (!r.ok) throw new Error("Failed to fetch schedules");
      const j = (await r.json()) as { data?: ScheduledQuery[] };
      return j.data ?? [];
    },
    staleTime: 15_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: ScheduleFormData; id?: string }) => {
      const url = id ? `/api/schedules/${id}` : "/api/schedules";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setModal({ open: false, editing: null });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "삭제 실패");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });

  async function handleToggleActive(schedule: ScheduledQuery) {
    if (togglingId === schedule.id) return;
    setTogglingId(schedule.id);

    // Optimistic update
    queryClient.setQueryData<ScheduledQuery[]>(["schedules"], (prev) =>
      prev ? prev.map((s) => s.id === schedule.id ? { ...s, isActive: !s.isActive } : s) : prev
    );

    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "토글 실패");
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) {
      // Rollback on error
      queryClient.setQueryData<ScheduledQuery[]>(["schedules"], (prev) =>
        prev ? prev.map((s) => s.id === schedule.id ? { ...s, isActive: schedule.isActive } : s) : prev
      );
      console.warn("[schedule] toggle failed:", e instanceof Error ? e.message : e);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      const res = await fetch(`/api/schedules/${id}/run`, { method: "POST" });
      const json = (await res.json()) as { data?: { status: string; durationMs: number }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "실행 실패");
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) {
      console.error("[schedule] run failed:", e instanceof Error ? e.message : e);
    } finally {
      setRunningId(null);
    }
  }

  const activeCount = schedules.filter((s) => s.isActive).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="쿼리 스케줄러"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "워크스페이스" }, { label: "스케줄러" }]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              onClick={() => exportSchedulesCsv(schedules)}
              disabled={schedules.length === 0}
            >
              내보내기
            </Button>
            <Button
              variant="accent"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setModal({ open: true, editing: null })}
            >
              스케줄 추가
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-5)" }}>
          {[
            { icon: Calendar, label: "전체 스케줄", value: isLoading ? "—" : `${schedules.length}개` },
            { icon: CheckCircle2, label: "활성", value: isLoading ? "—" : `${activeCount}개`, color: "var(--ds-success)" },
            { icon: Clock, label: "비활성", value: isLoading ? "—" : `${schedules.length - activeCount}개` },
          ].map((item) => (
            <Card key={item.label}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)" }}>
                <item.icon size={20} style={{ color: item.color ?? "var(--ds-text-mute)" }} />
                <div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{item.label}</div>
                  <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
                    {item.value}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Notice about scheduled execution */}
        <div
          style={{
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-8)",
            background: "var(--ds-fill)",
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            marginBottom: "var(--ds-sp-4)",
            fontSize: "var(--ds-fs-12)",
            color: "var(--ds-text-faint)",
          }}
        >
          자동 실행에는 별도의 워커 프로세스가 필요합니다. 지금은 수동 실행(▶) 버튼으로 즉시 실행할 수 있습니다.
        </div>

        {isLoading && (
          <Card padding={0}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 72, borderBottom: i < 2 ? "1px solid var(--ds-border)" : undefined, background: "var(--ds-fill)" }} className="ds-stripes" />
            ))}
          </Card>
        )}

        {!isLoading && schedules.length === 0 && (
          <Card>
            <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)" }}>
              <Calendar size={32} style={{ color: "var(--ds-text-faint)", margin: "0 auto var(--ds-sp-3)" }} />
              <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)" }}>스케줄이 없습니다</div>
              <div style={{ fontSize: "var(--ds-fs-12)", marginTop: 4 }}>
                쿼리를 자동으로 실행할 스케줄을 추가해보세요.
              </div>
              <Button variant="accent" size="sm" icon={<Plus size={13} />} style={{ marginTop: "var(--ds-sp-3)" }} onClick={() => setModal({ open: true, editing: null })}>
                첫 스케줄 추가
              </Button>
            </div>
          </Card>
        )}

        {!isLoading && schedules.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-3)" }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
                <input
                  ref={searchRef}
                  aria-label="스케줄 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="스케줄 검색... (⌘F)"
                  style={{ width: "100%", paddingLeft: 30, paddingRight: search ? 28 : "var(--ds-sp-3)", paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)" }}
                />
                {search && (
                  <button type="button" aria-label="검색 지우기" onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0, transition: "color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:text-text">
                    <X size={13} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                {search
                  ? `${schedules.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.sql.toLowerCase().includes(search.toLowerCase())).length}/${schedules.length}개`
                  : `${schedules.length}개`}
              </span>
            </div>
          <Card padding={0}>
            {schedules.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.sql.toLowerCase().includes(search.toLowerCase())).map((schedule, i, arr) => (
              <div
                key={schedule.id}
                className="group hover:bg-fill transition-colors"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-3)",
                  padding: "var(--ds-sp-3) var(--ds-sp-4)",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--ds-border)" : undefined,
                  opacity: schedule.isActive ? 1 : 0.6,
                }}
              >
                {/* Active toggle */}
                <button
                  aria-label={schedule.isActive ? "비활성화" : "활성화"}
                  disabled={togglingId === schedule.id}
                  onClick={() => { void handleToggleActive(schedule); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: togglingId === schedule.id ? "wait" : "pointer",
                    opacity: togglingId === schedule.id ? 0.5 : 1,
                  }}
                  title={schedule.isActive ? "클릭하여 비활성화" : "클릭하여 활성화"}
                >
                  {/* Track */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      width: 32,
                      height: 18,
                      borderRadius: "var(--ds-r-full)",
                      background: schedule.isActive ? "var(--ds-success)" : "var(--ds-border)",
                      padding: "2px",
                      transition: "background var(--ds-dur-fast) var(--ds-ease)",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Thumb */}
                    <span
                      style={{
                        display: "block",
                        width: 14,
                        height: 14,
                        borderRadius: "var(--ds-r-full)",
                        background: "var(--ds-surface)",
                        transform: schedule.isActive ? "translateX(14px)" : "translateX(0)",
                        transition: "transform var(--ds-dur-fast) var(--ds-ease)",
                        flexShrink: 0,
                      }}
                    />
                  </span>
                </button>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: 2 }}>
                    <span
                      title={schedule.name}
                      style={{
                        fontSize: "var(--ds-fs-13)",
                        fontWeight: "var(--ds-fw-medium)",
                        color: "var(--ds-text)",
                      }}
                    >
                      {schedule.name}
                    </span>
                    <Pill variant="dashed">{schedule.dialect}</Pill>
                    <span
                      style={{
                        fontSize: "var(--ds-fs-11)",
                        fontFamily: "var(--ds-font-mono)",
                        color: "var(--ds-text-faint)",
                        background: "var(--ds-fill)",
                        padding: "1px var(--ds-sp-2)",
                        borderRadius: "var(--ds-r-6)",
                        border: "1px solid var(--ds-border)",
                      }}
                    >
                      {schedule.cronExpr}
                    </span>
                  </div>
                  <div
                    onClick={() => setExpandedSqlId((prev) => prev === schedule.id ? null : schedule.id)}
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                      fontFamily: "var(--ds-font-mono)",
                      cursor: schedule.sql.length > 60 ? "pointer" : "default",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 3,
                    }}
                  >
                    {schedule.sql.length > 60 && (
                      <span style={{ flexShrink: 0, marginTop: 1 }}>
                        {expandedSqlId === schedule.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </span>
                    )}
                    {expandedSqlId === schedule.id
                      ? <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{schedule.sql}</span>
                      : <span title={schedule.sql} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{schedule.sql.slice(0, 80)}{schedule.sql.length > 80 ? "..." : ""}</span>
                    }
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-3)",
                      marginTop: 2,
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                    }}
                  >
                    {schedule.lastRunAt && (
                      <span
                        title={new Date(schedule.lastRunAt).toLocaleString("ko-KR")}
                        style={{ display: "flex", alignItems: "center", gap: 3, cursor: "default" }}
                      >
                        {statusIcon(schedule.lastRunStatus)}
                        마지막 실행 {formatTime(schedule.lastRunAt)}
                      </span>
                    )}
                    {schedule.rowCount != null && (
                      <span style={{ fontFamily: "var(--ds-font-mono)" }}>
                        {schedule.rowCount.toLocaleString()}행
                      </span>
                    )}
                    {schedule.durationMs != null && (
                      <span style={{ fontFamily: "var(--ds-font-mono)" }}>
                        {schedule.durationMs < 1000 ? `${schedule.durationMs}ms` : `${(schedule.durationMs / 1000).toFixed(1)}s`}
                      </span>
                    )}
                    {schedule.nextRunAt && schedule.isActive && (
                      <span
                        title={new Date(schedule.nextRunAt).toLocaleString("ko-KR")}
                        style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--ds-accent)", cursor: "default" }}
                      >
                        다음 {formatRelativeTime(schedule.nextRunAt)}
                      </span>
                    )}
                    {schedule.connectionId && (() => {
                      const conn = connections.find((c) => c.id === schedule.connectionId);
                      return conn ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Database size={10} />
                          {conn.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={runningId === schedule.id ? <Loader size={12} /> : <Play size={12} />}
                    loading={runningId === schedule.id}
                    onClick={() => { void handleRun(schedule.id); }}
                  >
                    실행
                  </Button>
                  <span className="opacity-0 group-hover:opacity-100" style={{ transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={copiedSqlId === schedule.id ? <Check size={12} style={{ color: "var(--ds-success)" }} /> : <Copy size={12} />}
                    onClick={() => {
                      void navigator.clipboard.writeText(schedule.sql);
                      setCopiedSqlId(schedule.id);
                      setTimeout(() => setCopiedSqlId(null), 1500);
                    }}
                  >
                    {copiedSqlId === schedule.id ? "복사됨" : "SQL"}
                  </Button>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={12} />}
                    onClick={() => setModal({ open: true, editing: schedule })}
                  >
                    편집
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    loading={deleteMutation.isPending && deleteMutation.variables === schedule.id}
                    onClick={() => setDeleteConfirmId(schedule.id)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </Card>
          {search && schedules.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.sql.toLowerCase().includes(search.toLowerCase())).length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--ds-sp-5)", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>
              <div>검색 결과가 없습니다.</div>
              <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => setSearch("")}>검색 지우기</Button>
            </div>
          )}
          </>
        )}
      </div>

      {modal.open && (
        <ScheduleModal
          initial={
            modal.editing
              ? {
                  name: modal.editing.name,
                  sql: modal.editing.sql,
                  dialect: modal.editing.dialect,
                  cronExpr: modal.editing.cronExpr,
                  isActive: modal.editing.isActive,
                  connectionId: (modal.editing as ScheduledQuery & { connectionId?: string }).connectionId,
                }
              : DEFAULT_FORM
          }
          saving={saveMutation.isPending}
          onSave={(data) => saveMutation.mutate({ data, id: modal.editing?.id })}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}

      {deleteConfirmId && (
        <div role="dialog" aria-modal="true" aria-label="스케줄 삭제" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)} onKeyDown={(e) => { if (e.key === "Escape") setDeleteConfirmId(null); }}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>스케줄 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 스케줄을 삭제할까요? 예약된 실행이 취소됩니다.</div>
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
