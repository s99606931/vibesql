"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Card } from "@/components/ui-vs/Card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  FolderOpen,
  Play,
  Pencil,
  Trash2,
  Search,
  Hash,
  Clock,
  Save,
  ExternalLink,
  Plus,
  History,
  RotateCcw,
  X,
} from "lucide-react";
import type { SavedQuery, QueryVersion } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

interface FolderGroup {
  name: string;
  queries: SavedQuery[];
}


function groupByFolder(items: SavedQuery[]): FolderGroup[] {
  const map: Record<string, SavedQuery[]> = {};
  for (const item of items) {
    const f = item.folder ?? "미분류";
    if (!map[f]) map[f] = [];
    map[f].push(item);
  }
  return Object.entries(map).map(([name, queries]) => ({ name, queries }));
}

function formatDate(iso: string): string {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const d = new Date(iso);
  if (d.toDateString() === today) return `오늘 ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  if (d.toDateString() === yesterday) return `어제 ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return d.toLocaleDateString("ko-KR");
}

// ─── Version history panel ────────────────────────────────────────────────────

function VersionPanel({
  queryId,
  queryName,
  onClose,
  onRestore,
}: {
  queryId: string;
  queryName: string;
  onClose: () => void;
  onRestore: (sql: string) => void;
}) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["versions", queryId],
    queryFn: async () => {
      const r = await fetch(`/api/saved/${queryId}/versions`);
      if (!r.ok) throw new Error("Failed to fetch versions");
      const j = (await r.json()) as { data?: QueryVersion[] };
      return j.data ?? [];
    },
    staleTime: 10_000,
  });

  const [restoring, setRestoring] = useState<string | null>(null);

  async function handleRestore(version: QueryVersion) {
    setRestoring(version.id);
    try {
      const res = await fetch(`/api/saved/${queryId}/versions/${version.id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("복원 실패");
      onRestore(version.sql);
      onClose();
    } catch (e) {
      console.error("[versions] restore failed:", e instanceof Error ? e.message : e);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          background: "var(--ds-surface)",
          borderLeft: "1px solid var(--ds-border)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--ds-shadow-modal)",
        }}
      >
        <div
          style={{
            padding: "var(--ds-sp-4)",
            borderBottom: "1px solid var(--ds-border)",
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
          }}
        >
          <History size={16} style={{ color: "var(--ds-accent)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
              버전 히스토리
            </div>
            <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{queryName}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ds-text-faint)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-2)" }}>
          {isLoading && (
            <div style={{ padding: "var(--ds-sp-4)", textAlign: "center", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-12)" }}>
              불러오는 중...
            </div>
          )}

          {!isLoading && versions.length === 0 && (
            <div style={{ padding: "var(--ds-sp-5)", textAlign: "center", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-12)" }}>
              저장된 버전이 없습니다.
              <br />
              쿼리를 수정할 때 버전이 자동으로 기록됩니다.
            </div>
          )}

          {!isLoading && versions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
              {versions.map((v) => (
                <div
                  key={v.id}
                  style={{
                    border: "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-8)",
                    padding: "var(--ds-sp-3)",
                    background: "var(--ds-fill)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-1)" }}>
                    <Pill variant="info">v{v.versionNo}</Pill>
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", flex: 1 }}>
                      {new Date(v.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw size={11} />}
                      loading={restoring === v.id}
                      onClick={() => { void handleRestore(v); }}
                    >
                      복원
                    </Button>
                  </div>
                  {v.note && (
                    <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>
                      {v.note}
                    </div>
                  )}
                  <pre
                    style={{
                      fontSize: "var(--ds-fs-10)",
                      fontFamily: "var(--ds-font-mono)",
                      color: "var(--ds-text-mute)",
                      background: "var(--ds-surface)",
                      border: "1px solid var(--ds-border)",
                      borderRadius: "var(--ds-r-6)",
                      padding: "var(--ds-sp-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      margin: 0,
                      maxHeight: 48,
                    }}
                  >
                    {v.sql.slice(0, 120)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const [search, setSearch] = useState("");
  const [versionPanel, setVersionPanel] = useState<{ queryId: string; queryName: string } | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setSql, setStatus } = useWorkspaceStore();

  const { data, isLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => {
      const res = await fetch("/api/saved");
      if (!res.ok) throw new Error(`saved fetch failed: ${res.status}`);
      const json = (await res.json()) as { data?: SavedQuery[] };
      return Array.isArray(json.data) ? json.data : [];
    },
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "삭제 실패");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved"] });
    },
  });

  async function handleNewFolder() {
    const folder = prompt("새 폴더 이름을 입력하세요:");
    if (!folder?.trim()) return;
    const name = folder.trim();
    const unclassified = (queryClient.getQueryData<SavedQuery[]>(["saved"]) ?? []).filter(
      (q) => (q.folder ?? "미분류") === "미분류"
    );
    if (unclassified.length === 0) {
      queryClient.setQueryData<SavedQuery[]>(["saved"], (old) => old ?? []);
      return;
    }
    const results = await Promise.allSettled(
      unclassified.map((q) =>
        fetch(`/api/saved/${q.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: name }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "PATCH 실패");
        })
      )
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) console.error("[saved] folder move partial failure:", failures);
    queryClient.invalidateQueries({ queryKey: ["saved"] });
  }

  const savedList = Array.isArray(data) ? data : [];
  const filtered = savedList.filter(
    (q) =>
      !search ||
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.nlQuery.toLowerCase().includes(search.toLowerCase())
  );

  const folders = groupByFolder(filtered);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="저장된 쿼리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "저장된 쿼리" }]}
        actions={
          <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => { void handleNewFolder(); }}>
            새 폴더
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Search + action bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              padding: "var(--ds-sp-1) var(--ds-sp-2)",
              flex: 1,
              maxWidth: 320,
            }}
          >
            <Search size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="저장된 쿼리 검색..."
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
          <div style={{ flex: 1 }} />
          <Button
            variant="ghost"
            size="sm"
            icon={<Save size={13} />}
            onClick={() => router.push("/workspace")}
          >
            워크스페이스에서 저장
          </Button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Version history panel */}
        {versionPanel && (
          <VersionPanel
            queryId={versionPanel.queryId}
            queryName={versionPanel.queryName}
            onClose={() => setVersionPanel(null)}
            onRestore={(sql) => {
              setSql(sql);
              setStatus("ready");
              router.push("/workspace");
            }}
          />
        )}

        {/* Folder groups */}
        {!isLoading &&
          folders.map((folder) => (
            <div key={folder.name} style={{ marginBottom: "var(--ds-sp-6)" }}>
              {/* Folder header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  marginBottom: "var(--ds-sp-2)",
                  paddingLeft: "var(--ds-sp-1)",
                }}
              >
                <FolderOpen size={13} style={{ color: "var(--ds-text-faint)" }} />
                <span
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: "var(--ds-text-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {folder.name}
                </span>
                <span
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    color: "var(--ds-text-faint)",
                    fontFamily: "var(--ds-font-mono)",
                  }}
                >
                  ({folder.queries.length})
                </span>
              </div>

              {folder.queries.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed var(--ds-border)",
                    borderRadius: "var(--ds-r-8)",
                    padding: "var(--ds-sp-5)",
                    textAlign: "center",
                    fontSize: "var(--ds-fs-12)",
                    color: "var(--ds-text-faint)",
                    background: "var(--ds-surface)",
                  }}
                >
                  이 폴더는 비어있습니다.
                </div>
              ) : (
                <Card padding={0}>
                  {folder.queries.map((query, i) => (
                    <div
                      key={query.id}
                      className="group"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--ds-sp-3)",
                        padding: "var(--ds-sp-3) var(--ds-sp-4)",
                        borderBottom:
                          i < folder.queries.length - 1
                            ? "1px solid var(--ds-border)"
                            : undefined,
                        cursor: "pointer",
                        transition: "background var(--ds-dur-fast) var(--ds-ease)",
                      }}
                    >
                      {/* Star */}
                      <Star
                        size={14}
                        style={{
                          color: "var(--ds-warn)",
                          fill: "var(--ds-warn)",
                          flexShrink: 0,
                        }}
                      />

                      {/* Main content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--ds-fs-13)",
                            fontWeight: "var(--ds-fw-medium)",
                            color: "var(--ds-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginBottom: 2,
                          }}
                        >
                          {query.name}
                        </div>
                        {query.description && (
                          <div
                            style={{
                              fontSize: "var(--ds-fs-11)",
                              color: "var(--ds-text-mute)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: "var(--ds-sp-1)",
                            }}
                          >
                            {query.description}
                          </div>
                        )}

                        {/* Tags + meta */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--ds-sp-2)",
                            flexWrap: "wrap",
                          }}
                        >
                          {query.tags.map((tag) => (
                            <Pill key={tag} variant="dashed">
                              {tag}
                            </Pill>
                          ))}
                          {query.connectionId && (
                            <span
                              className="ds-mono"
                              style={{
                                fontSize: "var(--ds-fs-11)",
                                color: "var(--ds-text-faint)",
                              }}
                            >
                              {query.connectionId}
                            </span>
                          )}
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: "var(--ds-fs-11)",
                              color: "var(--ds-text-faint)",
                            }}
                          >
                            <Clock size={10} />
                            {formatDate(query.createdAt)}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: "var(--ds-fs-11)",
                              color: "var(--ds-text-faint)",
                              fontFamily: "var(--ds-font-mono)",
                            }}
                          >
                            <Hash size={10} />
                            {query.dialect}
                          </span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--ds-sp-1)",
                          opacity: 0,
                          transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
                          flexShrink: 0,
                        }}
                        className="group-hover:opacity-100"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ExternalLink size={12} />}
                          onClick={() => {
                            setSql(query.sql);
                            setStatus("ready");
                            router.push("/workspace");
                          }}
                        >
                          워크스페이스에서 열기
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Clock size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/schedules?sql=${encodeURIComponent(query.sql)}&name=${encodeURIComponent(query.name)}&dialect=${encodeURIComponent(query.dialect)}`
                            );
                          }}
                        >
                          스케줄 등록
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Play size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSql(query.sql);
                            setStatus("running");
                            router.push("/workspace");
                          }}
                        >
                          실행
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newName = prompt("쿼리 이름을 변경하세요:", query.name);
                            if (newName && newName !== query.name) {
                              fetch(`/api/saved/${query.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newName }),
                              }).then(async (r) => {
                                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "편집 실패");
                                queryClient.invalidateQueries({ queryKey: ["saved"] });
                              }).catch((e) => console.warn("[saved] rename failed:", e));
                            }
                          }}
                        >
                          편집
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<History size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVersionPanel({ queryId: query.id, queryName: query.name });
                          }}
                        >
                          버전
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={12} />}
                          loading={deleteMutation.isPending && deleteMutation.variables === query.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${query.name}" 쿼리를 삭제할까요?`)) {
                              deleteMutation.mutate(query.id);
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
          ))}
      </div>
    </div>
  );
}
