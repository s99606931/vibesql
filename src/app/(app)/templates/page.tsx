"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import {
  Plus, Trash2, ExternalLink, Search, BarChart2,
  Wrench, FileText, Bug, Star, Tag,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { QueryTemplate, TemplateCategory } from "@/app/api/templates/route";

// ─── Category meta ────────────────────────────────────────────────────────────

const CAT_META: Record<TemplateCategory, { label: string; icon: React.ElementType; variant: "accent" | "info" | "success" | "warn" | "default" }> = {
  analytics:  { label: "분석",     icon: BarChart2, variant: "accent" },
  operations: { label: "운영",     icon: Wrench,    variant: "info" },
  reporting:  { label: "보고서",   icon: FileText,  variant: "success" },
  debugging:  { label: "디버깅",  icon: Bug,       variant: "warn" },
  custom:     { label: "내 템플릿", icon: Star,      variant: "default" },
};

const CATEGORY_OPTIONS: { value: TemplateCategory | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  ...Object.entries(CAT_META).map(([k, v]) => ({ value: k as TemplateCategory, label: v.label })),
];

// ─── SaveModal ────────────────────────────────────────────────────────────────

interface SaveForm {
  name: string;
  description: string;
  category: TemplateCategory;
  nlQuery: string;
  sql: string;
  dialect: string;
  tags: string;
}

function SaveModal({
  onSave,
  onClose,
  saving,
}: {
  onSave: (form: SaveForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SaveForm>({
    name: "", description: "", category: "custom",
    nlQuery: "", sql: "", dialect: "postgresql", tags: "",
  });

  function set<K extends keyof SaveForm>(k: K, v: SaveForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--ds-surface)", border: "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)",
        width: 520, maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
          <h2 style={{ flex: 1, fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: 0 }}>
            내 템플릿 저장
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {[
          { label: "템플릿 이름", key: "name" as const, placeholder: "예: 월별 매출 집계" },
          { label: "설명", key: "description" as const, placeholder: "이 템플릿이 하는 일을 간단히 설명하세요" },
          { label: "자연어 질문", key: "nlQuery" as const, placeholder: "월별 매출 합계를 보여줘" },
          { label: "태그 (쉼표 구분)", key: "tags" as const, placeholder: "monthly, sales, aggregation" },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>{label}</label>
            <input
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
            />
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>SQL 쿼리</label>
          <textarea
            value={form.sql}
            onChange={(e) => set("sql", e.target.value)}
            placeholder="SELECT ..."
            rows={4}
            style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-mono)", width: "100%", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-3)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>카테고리</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as TemplateCategory)}
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
            >
              {Object.entries(CAT_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>방언</label>
            <select
              value={form.dialect}
              onChange={(e) => set("dialect", e.target.value)}
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
            >
              {["postgresql", "mysql", "sqlite", "mssql"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)", marginTop: "var(--ds-sp-1)" }}>
          <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
          <Button
            size="sm"
            disabled={saving || !form.name.trim() || !form.sql.trim() || !form.nlQuery.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: QueryTemplate;
  onUse: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const CatIcon = CAT_META[template.category].icon;

  return (
    <Card style={{ padding: "var(--ds-sp-4)", display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--ds-sp-2)" }}>
        <CatIcon size={14} style={{ color: "var(--ds-text-faint)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
              {template.name}
            </span>
            <Pill variant={CAT_META[template.category].variant}>{CAT_META[template.category].label}</Pill>
            {!template.isBuiltIn && <Pill variant="default">내 템플릿</Pill>}
          </div>
          {template.description && (
            <p style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", margin: "4px 0 0 0", lineHeight: 1.5 }}>
              {template.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={onUse} title="워크스페이스에서 열기">
            <ExternalLink size={13} />
            <span style={{ marginLeft: 4 }}>사용</span>
          </Button>
          {!template.isBuiltIn && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} title="삭제">
              <Trash2 size={13} style={{ color: "var(--ds-danger)" }} />
            </Button>
          )}
        </div>
      </div>

      {/* NL Query */}
      <div style={{
        background: "var(--ds-accent-soft)", borderRadius: "var(--ds-r-6)",
        padding: "var(--ds-sp-2) var(--ds-sp-3)", fontSize: "var(--ds-fs-12)",
        color: "var(--ds-accent)", fontStyle: "italic",
      }}>
        "{template.nlQuery}"
      </div>

      {/* SQL preview */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)",
            padding: 0, marginBottom: expanded ? "var(--ds-sp-1)" : 0,
          }}
        >
          {expanded ? "▼ SQL 숨기기" : "▶ SQL 보기"}
        </button>
        {expanded && (
          <pre style={{
            background: "var(--ds-fill)", borderRadius: "var(--ds-r-6)",
            padding: "var(--ds-sp-2) var(--ds-sp-3)", margin: 0,
            fontSize: "var(--ds-fs-11)", fontFamily: "var(--ds-font-mono)",
            color: "var(--ds-text-mute)", overflowX: "auto", lineHeight: 1.6,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {template.sql}
          </pre>
        )}
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", flexWrap: "wrap" }}>
          <Tag size={11} style={{ color: "var(--ds-text-faint)" }} />
          {template.tags.map((tag) => (
            <span key={tag} style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", fontFamily: "var(--ds-font-mono)" }}>
              #{tag}
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", fontFamily: "var(--ds-font-mono)" }}>
            {template.dialect}
          </span>
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const setNlQuery = useWorkspaceStore((s) => s.setNlQuery);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [saveModal, setSaveModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryKey = ["templates", category, search];

  const { data, isLoading } = useQuery<{ data: QueryTemplate[]; meta: { total: number } }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/templates?${params.toString()}`);
      return res.json() as Promise<{ data: QueryTemplate[]; meta: { total: number } }>;
    },
    staleTime: 30_000,
  });

  const templates = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (form: { name: string; description: string; category: TemplateCategory; nlQuery: string; sql: string; dialect: string; tags: string }) => {
      const body = {
        ...form,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("저장 실패");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
      setSaveModal(false);
    },
  });

  function handleUse(template: QueryTemplate) {
    setNlQuery(template.nlQuery);
    router.push("/workspace");
  }

  const builtInCount = templates.filter((t) => t.isBuiltIn).length;
  const customCount = templates.filter((t) => !t.isBuiltIn).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="쿼리 템플릿"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "워크스페이스" }, { label: "템플릿" }]}
        actions={
          <Button size="sm" onClick={() => setSaveModal(true)}>
            <Plus size={13} />
            <span style={{ marginLeft: 4 }}>템플릿 저장</span>
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-5)" }}>
          {[
            { label: "전체", value: templates.length },
            { label: "기본 제공", value: builtInCount },
            { label: "내 템플릿", value: customCount },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--ds-surface)", border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-3) var(--ds-sp-4)",
                minWidth: 80, textAlign: "center",
              }}
            >
              <div style={{ fontSize: "var(--ds-fs-20)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", fontFamily: "var(--ds-font-mono)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-4)", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="템플릿 검색..."
              style={{
                width: "100%", paddingLeft: 30, paddingRight: "var(--ds-sp-3)",
                paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)",
                background: "var(--ds-fill)", border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)",
              }}
            />
          </div>
          {/* Category filter */}
          <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap" }}>
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategory(opt.value)}
                style={{
                  padding: "var(--ds-sp-1) var(--ds-sp-2)",
                  borderRadius: "var(--ds-r-6)",
                  border: "1px solid",
                  borderColor: category === opt.value ? "var(--ds-accent)" : "var(--ds-border)",
                  background: category === opt.value ? "var(--ds-accent-soft)" : "transparent",
                  color: category === opt.value ? "var(--ds-accent)" : "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-12)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template list */}
        {isLoading ? (
          <div style={{ color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)", padding: "var(--ds-sp-5) 0" }}>
            불러오는 중...
          </div>
        ) : templates.length === 0 ? (
          <div style={{
            border: "1px dashed var(--ds-border)", borderRadius: "var(--ds-r-8)",
            padding: "var(--ds-sp-6)", textAlign: "center",
          }}>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-3)" }}>
              {search || category !== "all" ? "검색 결과가 없습니다." : "등록된 템플릿이 없습니다."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={() => handleUse(t)}
                onDelete={!t.isBuiltIn ? () => setDeleteConfirmId(t.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {saveModal && (
        <SaveModal
          onSave={(form) => saveMutation.mutate(form)}
          onClose={() => setSaveModal(false)}
          saving={saveMutation.isPending}
        />
      )}

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>템플릿 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 템플릿을 삭제할까요? 되돌릴 수 없습니다.</div>
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
