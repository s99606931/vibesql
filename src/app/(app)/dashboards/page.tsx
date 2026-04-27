"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, Plus, Search, Clock, BarChart2, TrendingUp, Table2, ExternalLink } from "lucide-react";

interface StatsData {
  totalQueries: number;
  successRate: number;
  totalConnections: number;
  totalSaved: number;
  avgDurationMs: number;
}

interface KpiTileProps {
  label: string;
  value: string | number | undefined;
  loading: boolean;
}

function KpiTile({ label, value, loading }: KpiTileProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--ds-surface)",
        border: "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)",
        padding: "var(--ds-sp-3) var(--ds-sp-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ds-sp-1)",
      }}
    >
      {loading ? (
        <Skeleton style={{ height: 28, width: "60%", borderRadius: "var(--ds-r-6)" }} />
      ) : (
        <span
          style={{
            fontSize: "var(--ds-fs-24)",
            fontWeight: "700",
            color: "var(--ds-accent)",
            lineHeight: 1.1,
          }}
        >
          {value ?? "—"}
        </span>
      )}
      <span
        style={{
          fontSize: "var(--ds-fs-11)",
          color: "var(--ds-text-mute)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Array<{ type: string; label: string }>;
  isPublic: boolean;
  updatedAt: string;
}

const FILTERS = ["전체", "내 대시보드", "공유됨"];

function WidgetTypeIcon({ type }: { type: string }) {
  if (type === "line") return <TrendingUp size={11} />;
  if (type === "bar") return <BarChart2 size={11} />;
  return <Table2 size={11} />;
}

export default function DashboardsPage() {
  const [activeFilter, setActiveFilter] = useState("전체");
  const [search, setSearch] = useState("");
  const [newDashModal, setNewDashModal] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [newDashDesc, setNewDashDesc] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats");
      if (!r.ok) throw new Error("통계를 불러오지 못했습니다.");
      const j = (await r.json()) as { data: StatsData };
      return j.data;
    },
    staleTime: 30_000,
  });

  const { data: dashboards = [], isLoading: dashLoading } = useQuery<Dashboard[]>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const r = await fetch("/api/dashboards");
      if (!r.ok) return [];
      const j = (await r.json()) as { data: Dashboard[] };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const r = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined, widgets: [] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "생성 실패");
      return j.data as Dashboard;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/dashboards/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
  });

  const visible = dashboards.filter((d) => {
    if (activeFilter === "공유됨" && !d.isPublic) return false;
    if (activeFilter === "내 대시보드" && d.isPublic) return false;
    if (search && !d.name.includes(search) && !(d.description ?? "").includes(search)) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="대시보드"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "대시보드" }]}
        actions={
          <Button
            variant="accent"
            size="sm"
            icon={<Plus size={13} />}
            loading={createMutation.isPending}
            onClick={() => { setNewDashName(""); setNewDashModal(true); }}
          >
            새 대시보드
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* KPI summary bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-3)",
            marginBottom: "var(--ds-sp-5)",
          }}
        >
          <KpiTile
            label="총 쿼리"
            value={stats?.totalQueries}
            loading={statsLoading}
          />
          <KpiTile
            label="성공률"
            value={stats !== undefined ? `${stats.successRate}%` : undefined}
            loading={statsLoading}
          />
          <KpiTile
            label="연결 수"
            value={stats?.totalConnections}
            loading={statsLoading}
          />
          <KpiTile
            label="저장된 쿼리"
            value={stats?.totalSaved}
            loading={statsLoading}
          />
        </div>

        {/* Filter / search bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {FILTERS.map((f) => (
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              padding: "var(--ds-sp-1) var(--ds-sp-2)",
              width: 220,
            }}
          >
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="대시보드 검색..."
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

        {/* Empty state */}
        {visible.length === 0 && (
          <div
            style={{
              border: "1px dashed var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              background: "var(--ds-surface)",
            }}
          >
            <LayoutDashboard size={32} style={{ color: "var(--ds-text-faint)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: 4 }}>
                {search ? "검색 결과 없음" : "새 대시보드를 만들어 보세요"}
              </div>
              <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>
                쿼리 결과를 위젯으로 고정하고 한눈에 모니터링하세요.
              </div>
            </div>
            {!search && (
              <Button
                variant="accent"
                size="sm"
                icon={<Plus size={13} />}
                loading={createMutation.isPending}
                onClick={() => { setNewDashName(""); setNewDashModal(true); }}
              >
                새 대시보드
              </Button>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {dashLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--ds-sp-4)" }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Dashboard grid */}
        {!dashLoading && visible.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "var(--ds-sp-4)",
            }}
          >
            {visible.map((dash) => (
              <Card key={dash.id} hoverable padding="var(--ds-sp-4)">
                <CardHead
                  title={dash.name}
                  meta={dash.description}
                  actions={
                    <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
                      <Button variant="ghost" size="sm" icon={<ExternalLink size={12} />} onClick={() => router.push(`/dashboards/${dash.id}`)}>
                        열기
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteConfirmId(dash.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  }
                />

                {/* Widget preview chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-4)" }}>
                  {(dash.widgets ?? []).length === 0 ? (
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>위젯 없음 — 워크스페이스에서 추가하세요</span>
                  ) : (
                    dash.widgets.map((w, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "var(--ds-fs-11)",
                          color: "var(--ds-text-mute)",
                          background: "var(--ds-fill)",
                          border: "1px solid var(--ds-border)",
                          borderRadius: "var(--ds-r-6)",
                          padding: "3px 8px",
                        }}
                      >
                        <WidgetTypeIcon type={w.type} />
                        {w.label}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-3)",
                    paddingTop: "var(--ds-sp-3)",
                    borderTop: "1px solid var(--ds-border)",
                  }}
                >
                  <Pill variant={dash.isPublic ? "success" : "default"}>{dash.isPublic ? "공유됨" : "내 대시보드"}</Pill>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                    <Clock size={11} />
                    {new Date(dash.updatedAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New dashboard modal */}
      {newDashModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setNewDashModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>새 대시보드</div>
            <input
              autoFocus
              value={newDashName}
              onChange={(e) => setNewDashName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setNewDashModal(false);
              }}
              placeholder="대시보드 이름 입력..."
              style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", marginBottom: "var(--ds-sp-2)", boxSizing: "border-box" }}
            />
            <input
              value={newDashDesc}
              onChange={(e) => setNewDashDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDashName.trim()) { createMutation.mutate({ name: newDashName.trim(), description: newDashDesc.trim() }); setNewDashModal(false); setNewDashName(""); setNewDashDesc(""); }
                if (e.key === "Escape") setNewDashModal(false);
              }}
              placeholder="설명 (선택)"
              style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", marginBottom: "var(--ds-sp-4)", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => { setNewDashModal(false); setNewDashName(""); setNewDashDesc(""); }} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => { if (newDashName.trim()) { createMutation.mutate({ name: newDashName.trim(), description: newDashDesc.trim() }); setNewDashModal(false); setNewDashName(""); setNewDashDesc(""); } }}
                disabled={!newDashName.trim() || createMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>대시보드 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 대시보드를 삭제할까요? 위젯 데이터도 함께 삭제됩니다.</div>
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
