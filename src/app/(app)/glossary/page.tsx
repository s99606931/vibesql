"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Plus, Search, BookOpen, Trash2, X } from "lucide-react";
import type { GlossaryTerm } from "@/types";

const categoryColors: Record<string, "default" | "accent" | "success" | "warn" | "info"> = {
  매출: "accent",
  사용자: "success",
  지표: "info",
  기타: "default",
};

async function fetchGlossary(): Promise<GlossaryTerm[]> {
  const res = await fetch("/api/glossary");
  if (!res.ok) throw new Error(`glossary fetch failed: ${res.status}`);
  const json = (await res.json()) as { data?: GlossaryTerm[] };
  return Array.isArray(json.data) ? json.data : [];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--ds-sp-2) var(--ds-sp-3)",
  border: "1px solid var(--ds-border)",
  borderRadius: "var(--ds-r-6)",
  background: "var(--ds-fill)",
  color: "var(--ds-text)",
  fontSize: "var(--ds-fs-13)",
  outline: "none",
  fontFamily: "var(--ds-font-sans)",
  boxSizing: "border-box",
};

export default function GlossaryPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTerm, setNewTerm] = useState({ term: "", category: "매출", definition: "", sql: "" });

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["glossary"],
    queryFn: fetchGlossary,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async (body: typeof newTerm) => {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      return json.data as GlossaryTerm;
    },
    onSuccess: (created: GlossaryTerm) => {
      qc.invalidateQueries({ queryKey: ["glossary"] });
      setSelectedId(created.id);
      setShowAdd(false);
      setNewTerm({ term: "", category: "매출", definition: "", sql: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/glossary/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glossary"] });
      setSelectedId(null);
    },
  });

  const filtered = terms.filter(
    (t) =>
      t.term.includes(search) ||
      t.definition.includes(search) ||
      t.category.includes(search)
  );

  const selected = terms.find((t) => t.id === selectedId) ?? terms[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="비즈니스 용어집"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "비즈니스 용어집" }]}
        actions={
          <Button variant="accent" size="sm" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>
            새 용어
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>

        {/* Left panel — term list */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--ds-border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "var(--ds-sp-3) var(--ds-sp-3) var(--ds-sp-2)",
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
              <Search size={12} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="용어 검색..."
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--ds-text)",
                  fontSize: "var(--ds-fs-12)",
                  outline: "none",
                  fontFamily: "var(--ds-font-sans)",
                  flex: 1,
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {isLoading && (
              <div style={{ padding: "var(--ds-sp-4)", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)" }}>
                로딩 중...
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ padding: "var(--ds-sp-4)", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", textAlign: "center" }}>
                {search ? "검색 결과 없음" : "용어가 없습니다"}
              </div>
            )}
            {filtered.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedId(term.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: "1px solid var(--ds-border)",
                  background: (selectedId ?? terms[0]?.id) === term.id ? "var(--ds-accent-soft)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--ds-font-sans)",
                  transition: "background var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                <BookOpen
                  size={13}
                  style={{
                    color: (selectedId ?? terms[0]?.id) === term.id ? "var(--ds-accent)" : "var(--ds-text-faint)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--ds-fs-13)",
                      fontWeight: (selectedId ?? terms[0]?.id) === term.id ? "var(--ds-fw-semibold)" : "var(--ds-fw-normal)",
                      color: (selectedId ?? terms[0]?.id) === term.id ? "var(--ds-accent)" : "var(--ds-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {term.term}
                  </div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 1 }}>
                    {term.category}
                  </div>
                </div>
                <Pill variant={categoryColors[term.category] ?? "default"}>{term.category}</Pill>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — term detail or add form */}
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
          {/* AI callout */}
          <AICallout tone="accent">
            이 용어들은 SQL 생성 시 자동으로 참조됩니다. 용어를 정확히 정의할수록 AI가 더 정확한 쿼리를 생성합니다.
          </AICallout>

          {/* Add form */}
          {showAdd && (
            <Card padding="var(--ds-sp-4)">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--ds-sp-4)" }}>
                <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
                  새 용어 추가
                </div>
                <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={() => setShowAdd(false)}>닫기</Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
                <div>
                  <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>용어</label>
                  <input style={inputStyle} value={newTerm.term} onChange={(e) => setNewTerm((p) => ({ ...p, term: e.target.value }))} placeholder="예: 결제율" />
                </div>
                <div>
                  <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>카테고리</label>
                  <select
                    style={inputStyle}
                    value={newTerm.category}
                    onChange={(e) => setNewTerm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {["매출", "사용자", "지표", "기타"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>정의</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                    value={newTerm.definition}
                    onChange={(e) => setNewTerm((p) => ({ ...p, definition: e.target.value }))}
                    placeholder="용어에 대한 비즈니스 정의를 입력하세요..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>SQL 힌트 (선택)</label>
                  <input
                    style={{ ...inputStyle, fontFamily: "var(--ds-font-mono)" }}
                    value={newTerm.sql}
                    onChange={(e) => setNewTerm((p) => ({ ...p, sql: e.target.value }))}
                    placeholder="예: COUNT(*) FILTER (WHERE status='paid')"
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>취소</Button>
                  <Button
                    variant="accent"
                    size="sm"
                    loading={addMutation.isPending}
                    onClick={() => addMutation.mutate(newTerm)}
                    disabled={!newTerm.term.trim() || !newTerm.definition.trim()}
                  >
                    저장
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Term detail */}
          {selected && !showAdd && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--ds-sp-3)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--ds-fs-22)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-1)" }}>
                    {selected.term}
                  </div>
                  <Pill variant={categoryColors[selected.category] ?? "default"}>{selected.category}</Pill>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={12} />}
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(selected.id)}
                >
                  삭제
                </Button>
              </div>

              <Card padding="var(--ds-sp-4)">
                <div style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-sp-2)" }}>
                  정의
                </div>
                <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", lineHeight: 1.7 }}>
                  {selected.definition}
                </div>
              </Card>

              {selected.sql && (
                <Card padding="var(--ds-sp-4)">
                  <div style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-sp-2)" }}>
                    SQL 힌트
                  </div>
                  <code style={{ fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-12)", color: "var(--ds-accent)", background: "var(--ds-accent-soft)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2) var(--ds-sp-3)", display: "block" }}>
                    {selected.sql}
                  </code>
                </Card>
              )}
            </>
          )}

          {!selected && !showAdd && !isLoading && (
            <div style={{ textAlign: "center", padding: "var(--ds-sp-8)", color: "var(--ds-text-faint)" }}>
              <BookOpen size={32} style={{ margin: "0 auto var(--ds-sp-3)", opacity: 0.4 }} />
              <div style={{ fontSize: "var(--ds-fs-14)" }}>용어를 선택하거나 새 용어를 추가하세요</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
