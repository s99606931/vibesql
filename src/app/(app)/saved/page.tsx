"use client";

import { useState, useRef, useEffect } from "react";
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
  FolderInput,
  Copy,
  Download,
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

function formatRelativeAgo(iso: string): string {
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
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)", padding: "var(--ds-sp-2)" }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
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
                    <span
                      title={new Date(v.createdAt).toLocaleString("ko-KR")}
                      style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", flex: 1, cursor: "default" }}
                    >
                      {formatRelativeAgo(v.createdAt)}
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
                    title={v.sql}
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
  const [sortBy, setSortBy] = useState<"date" | "name" | "dialect">("date");
  const [versionPanel, setVersionPanel] = useState<{ queryId: string; queryName: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [renameModal, setRenameModal] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveModal, setMoveModal] = useState<{ id: string; currentFolder: string } | null>(null);
  const [moveFolder, setMoveFolder] = useState("");
  const [renameFolderModal, setRenameFolderModal] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
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

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/saved/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "편집 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved"] }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      const res = await fetch(`/api/saved/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folder === "미분류" ? null : folder }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "이동 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved"] }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ oldFolder, newFolder }: { oldFolder: string; newFolder: string }) => {
      const targets = savedList.filter((q) => (q.folder ?? "미분류") === oldFolder);
      await Promise.all(
        targets.map((q) =>
          fetch(`/api/saved/${q.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: newFolder === "미분류" ? null : newFolder }),
          })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (query: SavedQuery) => {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${query.name} (복사)`,
          description: query.description,
          folder: query.folder,
          tags: query.tags,
          nlQuery: query.nlQuery,
          sql: query.sql,
          dialect: query.dialect,
          connectionId: query.connectionId,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "복제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved"] }),
  });

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function exportSavedCsv() {
    if (filtered.length === 0) return;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["이름", "폴더", "방언", "NL쿼리", "태그", "저장일"].map(escape).join(",")];
    for (const q of filtered) {
      rows.push([q.name, q.folder ?? "", q.dialect, q.nlQuery, q.tags.join("|"), q.createdAt].map(escape).join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "saved-queries.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleNewFolder() {
    setNewFolderName("");
    setNewFolderModal(true);
  }

  function handleNewFolderSubmit(folderName: string) {
    const name = folderName.trim();
    if (!name) return;
    setExtraFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewFolderName("");
    setNewFolderModal(false);
  }

  const savedList = Array.isArray(data) ? data : [];
  const filtered = savedList
    .filter((q) => {
      if (!search) return true;
      const lc = search.toLowerCase();
      return (
        q.name.toLowerCase().includes(lc) ||
        q.nlQuery.toLowerCase().includes(lc) ||
        q.tags.some((t) => t.toLowerCase().includes(lc))
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "dialect") return a.dialect.localeCompare(b.dialect);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const baseFolders = groupByFolder(filtered);
  const existingNames = new Set(baseFolders.map((f) => f.name));
  const folders: FolderGroup[] = [
    ...baseFolders,
    ...extraFolders
      .filter((n) => !existingNames.has(n))
      .map((n) => ({ name: n, queries: [] as SavedQuery[] })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="저장된 쿼리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "저장된 쿼리" }]}
        actions={
          <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
            {filtered.length > 0 && (
              <button
                onClick={exportSavedCsv}
                title="CSV 내보내기"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "var(--ds-sp-1) var(--ds-sp-3)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}
              >
                <Download size={12} />
                CSV
              </button>
            )}
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => { void handleNewFolder(); }}>
              새 폴더
            </Button>
          </div>
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
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="저장된 쿼리 검색... (⌘F)"
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
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 2, flexShrink: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "name" | "dialect")}
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              color: "var(--ds-text-mute)",
              fontSize: "var(--ds-fs-12)",
              padding: "var(--ds-sp-1) var(--ds-sp-2)",
              fontFamily: "var(--ds-font-sans)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="date">최신순</option>
            <option value="name">이름순</option>
            <option value="dialect">방언순</option>
          </select>
          {filtered.length > 0 && (
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
              {filtered.length}/{savedList.length}개
            </span>
          )}
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

        {/* No-results */}
        {!isLoading && filtered.length === 0 && search && (
          <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>검색 결과가 없습니다.</div>
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
                {folder.name !== "미분류" && folder.queries.length > 0 && (
                  <button
                    onClick={() => { setRenameFolderValue(folder.name); setRenameFolderModal(folder.name); }}
                    title="폴더 이름 변경"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 2, opacity: 0.6 }}
                  >
                    <Pencil size={10} />
                  </button>
                )}
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
                          title={query.name}
                        >
                          {query.name}
                        </div>
                        {query.description && (
                          <div
                            title={query.description}
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
                            <button
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearch((prev) => prev === tag ? "" : tag);
                              }}
                              title={`"${tag}" 태그로 필터`}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                            >
                              <Pill variant="dashed">{tag}</Pill>
                            </button>
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
                            title={new Date(query.createdAt).toLocaleString("ko-KR")}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: "var(--ds-fs-11)",
                              color: "var(--ds-text-faint)",
                              cursor: "default",
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
                          icon={<FolderInput size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveFolder(query.folder ?? "미분류");
                            setMoveModal({ id: query.id, currentFolder: query.folder ?? "미분류" });
                          }}
                        >
                          이동
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameValue(query.name);
                            setRenameModal({ id: query.id, name: query.name });
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
                          variant="ghost"
                          size="sm"
                          icon={<Copy size={12} />}
                          loading={duplicateMutation.isPending && duplicateMutation.variables?.id === query.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMutation.mutate(query);
                          }}
                        >
                          복제
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={12} />}
                          loading={deleteMutation.isPending && deleteMutation.variables === query.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(query.id);
                            setConfirmDeleteName(query.name);
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

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-2)" }}>쿼리 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-4)" }}>
              <strong style={{ color: "var(--ds-text)" }}>&ldquo;{confirmDeleteName}&rdquo;</strong> 쿼리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </div>
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
                disabled={deleteMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-danger)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-bg)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New folder modal */}
      {newFolderModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setNewFolderModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>새 폴더</div>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleNewFolderSubmit(newFolderName);
                if (e.key === "Escape") setNewFolderModal(false);
              }}
              placeholder="폴더 이름 입력..."
              style={{
                width: "100%",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                marginBottom: "var(--ds-sp-4)",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setNewFolderModal(false)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => void handleNewFolderSubmit(newFolderName)}
                disabled={!newFolderName.trim()}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename folder modal */}
      {renameFolderModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setRenameFolderModal(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>폴더 이름 변경</div>
            <input
              autoFocus
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameFolderValue.trim() && renameFolderValue !== renameFolderModal) {
                  renameFolderMutation.mutate({ oldFolder: renameFolderModal, newFolder: renameFolderValue.trim() });
                  setRenameFolderModal(null);
                }
                if (e.key === "Escape") setRenameFolderModal(null);
              }}
              placeholder="새 폴더 이름..."
              style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)", marginBottom: "var(--ds-sp-4)", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setRenameFolderModal(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => {
                  if (renameFolderValue.trim() && renameFolderValue !== renameFolderModal) {
                    renameFolderMutation.mutate({ oldFolder: renameFolderModal, newFolder: renameFolderValue.trim() });
                    setRenameFolderModal(null);
                  }
                }}
                disabled={!renameFolderValue.trim() || renameFolderValue === renameFolderModal || renameFolderMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                {renameFolderMutation.isPending ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move folder modal */}
      {moveModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setMoveModal(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>폴더 이동</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)", marginBottom: "var(--ds-sp-4)" }}>
              {[...new Set(["미분류", ...folders.map((f) => f.name)])].map((name) => (
                <button
                  key={name}
                  onClick={() => setMoveFolder(name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--ds-sp-2)",
                    padding: "var(--ds-sp-2) var(--ds-sp-3)",
                    border: moveFolder === name ? "1px solid var(--ds-accent)" : "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-6)",
                    background: moveFolder === name ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    fontFamily: "var(--ds-font-sans)",
                    fontSize: "var(--ds-fs-13)",
                    color: moveFolder === name ? "var(--ds-accent)" : "var(--ds-text)",
                    transition: "all var(--ds-dur-fast) var(--ds-ease)",
                  }}
                >
                  <FolderOpen size={13} style={{ flexShrink: 0 }} />
                  {name}
                  {name === moveModal.currentFolder && (
                    <span style={{ marginLeft: "auto", fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>현재</span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setMoveModal(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => {
                  if (moveFolder !== moveModal.currentFolder) {
                    moveMutation.mutate({ id: moveModal.id, folder: moveFolder });
                  }
                  setMoveModal(null);
                }}
                disabled={moveFolder === moveModal.currentFolder || moveMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: moveFolder === moveModal.currentFolder ? "not-allowed" : "pointer", opacity: moveFolder === moveModal.currentFolder ? 0.5 : 1, fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                {moveMutation.isPending ? "이동 중..." : "이동"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
          onClick={() => setRenameModal(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-5)", maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>쿼리 이름 변경</div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim() && renameValue !== renameModal.name) {
                  renameMutation.mutate({ id: renameModal.id, name: renameValue.trim() });
                  setRenameModal(null);
                }
                if (e.key === "Escape") setRenameModal(null);
              }}
              placeholder="새 쿼리 이름..."
              style={{
                width: "100%",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                marginBottom: "var(--ds-sp-4)",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setRenameModal(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => {
                  if (renameValue.trim() && renameValue !== renameModal.name) {
                    renameMutation.mutate({ id: renameModal.id, name: renameValue.trim() });
                    setRenameModal(null);
                  }
                }}
                disabled={!renameValue.trim() || renameValue === renameModal.name || renameMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                {renameMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
