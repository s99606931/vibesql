"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Plus, Trash2, Play, Pencil, Clock, Calendar, CheckCircle2, XCircle, Loader } from "lucide-react";
import type { ScheduledQuery, DbDialect } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

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
}

const DEFAULT_FORM: ScheduleFormData = {
  name: "",
  sql: "",
  dialect: "postgresql",
  cronExpr: "0 9 * * *",
  isActive: true,
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

  function set<K extends keyof ScheduleFormData>(k: K, v: ScheduleFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
          <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            스케줄 이름 <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <input
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
          <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            SQL 쿼리 <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <textarea
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
          <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>Cron 표현식</label>
          <input
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
          <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
            형식: 분 시 일 월 요일 (예: 0 9 * * 1 = 매주 월요일 오전 9시)
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
          <Button variant="ghost" size="md" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            size="md"
            loading={saving}
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || !form.sql.trim() || !form.cronExpr.trim()}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editing: ScheduledQuery | null }>({ open: false, editing: null });
  const [runningId, setRunningId] = useState<string | null>(null);

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
          <Button
            variant="accent"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setModal({ open: true, editing: null })}
          >
            스케줄 추가
          </Button>
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
            </div>
          </Card>
        )}

        {!isLoading && schedules.length > 0 && (
          <Card padding={0}>
            {schedules.map((schedule, i) => (
              <div
                key={schedule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-3)",
                  padding: "var(--ds-sp-3) var(--ds-sp-4)",
                  borderBottom: i < schedules.length - 1 ? "1px solid var(--ds-border)" : undefined,
                  opacity: schedule.isActive ? 1 : 0.6,
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--ds-r-full)",
                    background: schedule.isActive ? "var(--ds-success)" : "var(--ds-text-faint)",
                    flexShrink: 0,
                  }}
                />

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: 2 }}>
                    <span
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
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--ds-font-mono)",
                    }}
                  >
                    {schedule.sql.slice(0, 80)}{schedule.sql.length > 80 ? "..." : ""}
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
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {statusIcon(schedule.lastRunStatus)}
                        마지막 실행 {formatTime(schedule.lastRunAt)}
                      </span>
                    )}
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
                    onClick={() => {
                      if (confirm(`"${schedule.name}" 스케줄을 삭제할까요?`)) {
                        deleteMutation.mutate(schedule.id);
                      }
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </Card>
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
                }
              : DEFAULT_FORM
          }
          saving={saveMutation.isPending}
          onSave={(data) => saveMutation.mutate({ data, id: modal.editing?.id })}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}
