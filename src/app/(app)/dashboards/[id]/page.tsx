"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart2, TrendingUp, Table2, Pencil, Trash2, Clock, Globe, Lock, X } from "lucide-react";

interface Widget {
  type: string;
  label: string;
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

function WidgetTypeIcon({ type }: { type: string }) {
  if (type === "line") return <TrendingUp size={14} />;
  if (type === "bar") return <BarChart2 size={14} />;
  return <Table2 size={14} />;
}

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

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
    const name = prompt("새 이름을 입력하세요:", dashboard?.name);
    if (name?.trim() && name.trim() !== dashboard?.name) {
      const description = prompt("설명 (선택):", dashboard?.description ?? "");
      renameMutation.mutate({ name: name.trim(), description: description ?? undefined });
    }
  }

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
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => router.push("/dashboards")} style={{ marginTop: "var(--ds-sp-3)" }}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title={dashboard.name}
        breadcrumbs={[{ label: "vibeSQL" }, { label: "대시보드", href: "/dashboards" }, { label: dashboard.name }]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
            <Button variant="ghost" size="sm" icon={<Pencil size={12} />} loading={renameMutation.isPending} onClick={handleRename}>
              편집
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={12} />}
              loading={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`"${dashboard.name}" 대시보드를 삭제할까요?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              삭제
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>

          {/* Meta */}
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--ds-sp-4)" }}>
              <div>
                <div style={{ fontSize: "var(--ds-fs-22)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-1)" }}>
                  {dashboard.name}
                </div>
                {dashboard.description && (
                  <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>
                    {dashboard.description}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                  <button
                    onClick={() => togglePublicMutation.mutate()}
                    disabled={togglePublicMutation.isPending}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    title={dashboard.isPublic ? "비공개로 전환" : "공유로 전환"}
                  >
                    <Pill variant={dashboard.isPublic ? "success" : "default"}>
                      {dashboard.isPublic
                        ? <><Globe size={10} style={{ marginRight: 3 }} />공유됨</>
                        : <><Lock size={10} style={{ marginRight: 3 }} />비공개</>
                      }
                    </Pill>
                  </button>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                    <Clock size={11} />
                    {new Date(dashboard.updatedAt).toLocaleString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Widgets */}
          <Card>
            <CardHead
              title="위젯"
              meta={`${(dashboard.widgets ?? []).length}개`}
            />
            {(dashboard.widgets ?? []).length === 0 ? (
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
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--ds-sp-3)" }}>
                {(dashboard.widgets as Widget[]).map((w, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid var(--ds-border)",
                      borderRadius: "var(--ds-r-8)",
                      padding: "var(--ds-sp-3)",
                      background: "var(--ds-fill)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-2)",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                      <div style={{ color: "var(--ds-accent)" }}>
                        <WidgetTypeIcon type={w.type} />
                      </div>
                      <span style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)" }}>{w.label}</span>
                    </div>
                    <button
                      onClick={() => removeWidgetMutation.mutate(i)}
                      disabled={removeWidgetMutation.isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", padding: 2, display: "flex", alignItems: "center" }}
                      title="위젯 삭제"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
