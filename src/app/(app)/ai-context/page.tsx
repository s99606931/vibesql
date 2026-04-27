"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Plus, Trash2, Pencil, Lightbulb, ShieldX, Tag, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Copy, Check, Search, X } from "lucide-react";
import type { AiContextRule, AiContextRuleType } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

const RULE_META: Record<AiContextRuleType, { label: string; icon: React.ElementType; variant: "accent" | "warn" | "info"; hint: string }> = {
  few_shot: { label: "예시 쿼리", icon: Lightbulb, variant: "accent", hint: "자연어 → SQL 예시를 등록하면 유사한 질문에 자동 적용됩니다." },
  forbidden: { label: "금지 패턴", icon: ShieldX, variant: "warn", hint: "생성되어서는 안 되는 SQL 패턴을 등록합니다." },
  alias: { label: "테이블 별칭", icon: Tag, variant: "info", hint: "자연어 용어와 실제 테이블/컬럼 이름을 매핑합니다." },
};

const RULE_TYPES: AiContextRuleType[] = ["few_shot", "forbidden", "alias"];

interface RuleFormData {
  ruleType: AiContextRuleType;
  key: string;
  value: string;
  description: string;
  isActive: boolean;
  priority: number;
}

const DEFAULT_FORM: RuleFormData = {
  ruleType: "few_shot",
  key: "",
  value: "",
  description: "",
  isActive: true,
  priority: 0,
};

// ─── Value preview with expand ───────────────────────────────────────────────

function ValuePreview({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 100;
  return (
    <div>
      <div
        style={{
          fontSize: "var(--ds-fs-11)",
          fontFamily: "var(--ds-font-mono)",
          color: "var(--ds-text-mute)",
          whiteSpace: expanded ? "pre-wrap" : "nowrap",
          overflow: expanded ? "visible" : "hidden",
          textOverflow: expanded ? "clip" : "ellipsis",
          wordBreak: expanded ? "break-all" : undefined,
        }}
      >
        {expanded ? value : value.slice(0, 100) + (isLong ? "..." : "")}
      </div>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 2, background: "none", border: "none", cursor: "pointer", fontSize: "var(--ds-fs-10)", color: "var(--ds-accent)", padding: 0, fontFamily: "var(--ds-font-sans)" }}
        >
          {expanded ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
          {expanded ? "접기" : "전체 보기"}
        </button>
      )}
    </div>
  );
}

// ─── Rule form modal ──────────────────────────────────────────────────────────

function RuleModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: RuleFormData;
  onSave: (data: RuleFormData) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RuleFormData>(initial);
  const meta = RULE_META[form.ruleType];

  function set<K extends keyof RuleFormData>(k: K, v: RuleFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const keyLabel = form.ruleType === "few_shot" ? "자연어 질문" : form.ruleType === "forbidden" ? "패턴 이름" : "자연어 용어";
  const valueLabel = form.ruleType === "few_shot" ? "SQL 예시" : form.ruleType === "forbidden" ? "금지 SQL 패턴" : "실제 테이블/컬럼명";

  return (
    <div
      role="dialog"
      aria-modal="true"
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
          maxWidth: 520,
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
          {initial.key ? "규칙 편집" : "규칙 추가"}
        </div>

        {/* Rule type */}
        <div style={{ display: "flex", gap: "var(--ds-sp-2)", flexWrap: "wrap" }}>
          {RULE_TYPES.map((t) => {
            const m = RULE_META[t];
            const isSelected = form.ruleType === t;
            return (
              <button
                key={t}
                onClick={() => set("ruleType", t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-1)",
                  padding: "var(--ds-sp-1) var(--ds-sp-3)",
                  borderRadius: "var(--ds-r-6)",
                  border: `1px solid ${isSelected ? "var(--ds-accent)" : "var(--ds-border)"}`,
                  background: isSelected ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                  color: isSelected ? "var(--ds-accent)" : "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-12)",
                  cursor: "pointer",
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                <m.icon size={12} />
                {m.label}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", margin: 0 }}>
          {meta.hint}
        </p>

        {/* Key field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            {keyLabel} <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <input
            value={form.key}
            onChange={(e) => set("key", e.target.value)}
            placeholder={form.ruleType === "few_shot" ? "예: 이번 달 매출 상위 10개 제품" : form.ruleType === "forbidden" ? "예: no_delete" : "예: 고객"}
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

        {/* Value field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
            {valueLabel} <span style={{ color: "var(--ds-danger)" }}>*</span>
          </label>
          <textarea
            value={form.value}
            onChange={(e) => set("value", e.target.value)}
            rows={4}
            placeholder={
              form.ruleType === "few_shot"
                ? "SELECT p.name, SUM(s.amount) as revenue\nFROM products p JOIN sales s ON p.id = s.product_id\nWHERE s.sale_date >= date_trunc('month', now())\nGROUP BY p.name ORDER BY revenue DESC LIMIT 10"
                : form.ruleType === "forbidden"
                ? "DELETE FROM"
                : "customers"
            }
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
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Description + priority row */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>설명 (선택)</label>
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="규칙 설명..."
              style={{
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-12)",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
              }}
            />
          </div>
          <div style={{ width: 80, display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>우선순위</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
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
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
          <Button variant="ghost" size="md" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            size="md"
            loading={saving}
            onClick={() => onSave(form)}
            disabled={!form.key.trim() || !form.value.trim()}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiContextPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editing: AiContextRule | null }>({ open: false, editing: null });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ai-context"],
    queryFn: async () => {
      const r = await fetch("/api/ai-context");
      if (!r.ok) throw new Error("Failed to fetch rules");
      const j = (await r.json()) as { data?: AiContextRule[] };
      return j.data ?? [];
    },
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: RuleFormData; id?: string }) => {
      const url = id ? `/api/ai-context/${id}` : "/api/ai-context";
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
      queryClient.invalidateQueries({ queryKey: ["ai-context"] });
      setModal({ open: false, editing: null });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-context/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "삭제 실패");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-context"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/ai-context/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "업데이트 실패");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-context"] }),
  });

  const [search, setSearch] = useState("");

  const groupedRules = RULE_TYPES.map((t) => ({
    type: t,
    items: rules.filter((r) => {
      if (r.ruleType !== t) return false;
      if (!search) return true;
      const lc = search.toLowerCase();
      return r.key.toLowerCase().includes(lc) || r.value.toLowerCase().includes(lc) || (r.description ?? "").toLowerCase().includes(lc);
    }),
  }));

  function handleExport() {
    const payload = rules.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-context-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const items = JSON.parse(text) as RuleFormData[];
      if (!Array.isArray(items)) throw new Error("Invalid format");
      await Promise.allSettled(
        items.map((item) =>
          fetch("/api/ai-context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["ai-context"] });
    } catch {
      setImportError("JSON 파일 형식이 올바르지 않습니다.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
      <TopBar
        title="AI 컨텍스트 튜너"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "지식베이스" }, { label: "AI 컨텍스트" }]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
            <Button variant="ghost" size="sm" onClick={handleExport}>내보내기</Button>
            <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()}>가져오기</Button>
            <Button
              variant="accent"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setModal({ open: true, editing: null })}
            >
              규칙 추가
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Intro callout */}
        <div
          style={{
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-8)",
            background: "var(--ds-accent-soft)",
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            marginBottom: "var(--ds-sp-5)",
            fontSize: "var(--ds-fs-12)",
            color: "var(--ds-text-mute)",
          }}
        >
          <strong style={{ color: "var(--ds-accent)" }}>AI 컨텍스트 튜너</strong>란? 예시 쿼리, 금지 패턴, 테이블 별칭을 등록하면
          SQL 생성 시 자동으로 AI 프롬프트에 주입되어 정확도를 향상시킵니다.
        </div>

        {!isLoading && rules.length > 0 && (
          <div style={{ marginBottom: "var(--ds-sp-4)", maxWidth: 320 }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="규칙 검색... (⌘F)"
                style={{ width: "100%", paddingLeft: 30, paddingRight: search ? 28 : "var(--ds-sp-3)", paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", boxSizing: "border-box" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
            {search && (
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: "var(--ds-sp-1)" }}>
                {groupedRules.reduce((sum, g) => sum + g.items.length, 0)}/{rules.length}개 규칙 표시 중
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 80, background: "var(--ds-fill)", borderRadius: "var(--ds-r-8)" }} className="ds-stripes" />
            ))}
          </div>
        )}

        {!isLoading && search && groupedRules.every((g) => g.items.length === 0) && (
          <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>
            <div>검색 결과가 없습니다.</div>
            <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => setSearch("")}>
              검색 지우기
            </Button>
          </div>
        )}

        {!isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-5)" }}>
            {groupedRules.map(({ type, items }) => {
              const meta = RULE_META[type];
              return (
                <div key={type}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-2)",
                      marginBottom: "var(--ds-sp-2)",
                    }}
                  >
                    <meta.icon size={14} style={{ color: "var(--ds-text-faint)" }} />
                    <span
                      style={{
                        fontSize: "var(--ds-fs-11)",
                        fontWeight: "var(--ds-fw-semibold)",
                        color: "var(--ds-text-mute)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {meta.label}
                    </span>
                    <Pill variant={meta.variant}>{items.length}</Pill>
                  </div>

                  {items.length === 0 ? (
                    <div
                      style={{
                        border: "1px dashed var(--ds-border)",
                        borderRadius: "var(--ds-r-8)",
                        padding: "var(--ds-sp-4)",
                        textAlign: "center",
                        fontSize: "var(--ds-fs-12)",
                        color: "var(--ds-text-faint)",
                      }}
                    >
                      등록된 {meta.label} 규칙이 없습니다.
                    </div>
                  ) : (
                    <Card padding={0}>
                      {items.map((rule, i) => (
                        <div
                          key={rule.id}
                          className="hover:bg-fill transition-colors"
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "var(--ds-sp-3)",
                            padding: "var(--ds-sp-3) var(--ds-sp-4)",
                            borderBottom: i < items.length - 1 ? "1px solid var(--ds-border)" : undefined,
                            opacity: rule.isActive ? 1 : 0.5,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "var(--ds-fs-13)",
                                fontWeight: "var(--ds-fw-medium)",
                                color: "var(--ds-text)",
                                marginBottom: 2,
                              }}
                            >
                              {rule.key}
                            </div>
                            <ValuePreview value={rule.value} />
                            {rule.description && (
                              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                                {rule.description}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
                            {rule.priority > 0 && (
                              <span
                                style={{
                                  fontSize: "var(--ds-fs-10)",
                                  fontFamily: "var(--ds-font-mono)",
                                  color: "var(--ds-text-faint)",
                                  background: "var(--ds-fill)",
                                  borderRadius: "var(--ds-r-6)",
                                  padding: "1px 5px",
                                }}
                              >
                                P{rule.priority}
                              </span>
                            )}
                            <button
                              title="값 복사"
                              onClick={() => {
                                navigator.clipboard.writeText(rule.value);
                                setCopiedRuleId(rule.id);
                                setTimeout(() => setCopiedRuleId((prev) => prev === rule.id ? null : prev), 2000);
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: copiedRuleId === rule.id ? "var(--ds-success)" : "var(--ds-text-faint)", display: "flex", alignItems: "center" }}
                            >
                              {copiedRuleId === rule.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                              title={rule.isActive ? "비활성화" : "활성화"}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: rule.isActive ? "var(--ds-success)" : "var(--ds-text-faint)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {rule.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Pencil size={11} />}
                              onClick={() => setModal({ open: true, editing: rule })}
                            >
                              편집
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={11} />}
                              loading={deleteMutation.isPending && deleteMutation.variables === rule.id}
                              onClick={() => setDeleteConfirmId(rule.id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal.open && (
        <RuleModal
          initial={
            modal.editing
              ? {
                  ruleType: modal.editing.ruleType,
                  key: modal.editing.key,
                  value: modal.editing.value,
                  description: modal.editing.description ?? "",
                  isActive: modal.editing.isActive,
                  priority: modal.editing.priority,
                }
              : DEFAULT_FORM
          }
          saving={saveMutation.isPending}
          onSave={(data) =>
            saveMutation.mutate({ data, id: modal.editing?.id })
          }
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}

      {importError && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setImportError(null)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-danger)" }}>가져오기 오류</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>{importError}</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm" onClick={() => setImportError(null)}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>규칙 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 AI 컨텍스트 규칙을 삭제할까요?</div>
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
