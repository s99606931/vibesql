"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Database,
  BookMarked,
  LayoutDashboard,
  Activity,
  RotateCcw,
  KeyRound,
  Download,
  Trash2,
  Copy,
  Check,
} from "lucide-react";

interface HistoryItem {
  id: string;
  nlQuery?: string;
  sql: string;
  status: "SUCCESS" | "ERROR" | "BLOCKED";
  rowCount?: number;
  durationMs?: number;
  errorMsg?: string;
  connectionName?: string;
  createdAt: string;
}

async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch("/api/history");
  const json = (await res.json()) as { data?: HistoryItem[] };
  return json.data ?? [];
}

async function fetchConnections(): Promise<unknown[]> {
  const res = await fetch("/api/connections");
  const json = (await res.json()) as { data?: unknown[] };
  return json.data ?? [];
}

async function fetchSaved(): Promise<unknown[]> {
  const res = await fetch("/api/saved");
  const json = (await res.json()) as { data?: unknown[] };
  return json.data ?? [];
}

async function fetchDashboards(): Promise<unknown[]> {
  const res = await fetch("/api/dashboards");
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: unknown[] };
  return Array.isArray(json.data) ? json.data : [];
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "방금 전";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffMs / 86_400_000);
  return `${diffDay}일 전`;
}

export default function ProfilePage() {
  const dialect = useSettingsStore((s) => s.dialect);
  const { setSql, setNlQuery, setStatus } = useWorkspaceStore();
  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = useCallback(() => {
    if (!currentUser?.email) return;
    void navigator.clipboard.writeText(currentUser.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 1500);
  }, [currentUser?.email]);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    staleTime: 10_000,
  });
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: fetchConnections,
    staleTime: 30_000,
  });
  const { data: saved = [], isLoading: savedLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: fetchSaved,
    staleTime: 30_000,
  });
  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
    staleTime: 30_000,
  });

  const isLoading = historyLoading || connectionsLoading || savedLoading || dashboardsLoading;

  const now = new Date();
  const todayStr = now.toDateString();
  const todayQueries = history.filter((h) => new Date(h.createdAt).toDateString() === todayStr);
  const thisMonth = history.filter((h) => {
    const d = new Date(h.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const STATS = [
    { label: "오늘 쿼리", value: todayQueries.length.toLocaleString(), icon: <Activity size={16} />, href: "/history" },
    { label: "이번 달 쿼리", value: thisMonth.length.toLocaleString(), icon: <Activity size={16} />, href: "/history" },
    { label: "연결된 DB", value: String(connections.length), icon: <Database size={16} />, href: "/connections" },
    { label: "저장된 쿼리", value: String(saved.length), icon: <BookMarked size={16} />, href: "/saved" },
    { label: "대시보드", value: String(dashboards.length), icon: <LayoutDashboard size={16} />, href: "/dashboards" },
  ];

  const recentItems = history.slice(0, 5);

  function handleRerun(item: HistoryItem) {
    if (item.nlQuery) setNlQuery(item.nlQuery);
    setSql(item.sql);
    setStatus("ready");
    router.push("/workspace");
  }

  async function handleExport() {
    const [savedRes, historyRes] = await Promise.all([
      fetch("/api/saved").then((r) => r.json()) as Promise<{ data?: unknown }>,
      fetch("/api/history").then((r) => r.json()) as Promise<{ data?: unknown }>,
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      savedQueries: savedRes.data ?? [],
      history: historyRes.data ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibesql-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportCsv() {
    const savedRes = (await fetch("/api/saved").then((r) => r.json())) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(savedRes.data) ? savedRes.data : [];
    const headers = ["name", "description", "folder", "tags", "dialect", "nlQuery", "sql", "createdAt"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => escape(h === "tags" && Array.isArray(r[h]) ? (r[h] as string[]).join(";") : r[h])).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibesql-saved-queries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeleteAccount() {
    setDeleteAccountModal(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="프로필"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "프로필" }]}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "var(--ds-sp-6)" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-4)",
          }}
        >
          {/* User hero */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-4)" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "var(--ds-r-full)",
                  background: "var(--ds-accent-soft)",
                  border: "2px solid var(--ds-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--ds-fs-22)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-accent)",
                  flexShrink: 0,
                }}
              >
                {(currentUser?.name ?? currentUser?.email ?? "V").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--ds-fs-18)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: 2 }}>
                  {currentUser?.name ?? currentUser?.email ?? "vibeSQL 사용자"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-2)" }}>
                  <span style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>
                    {currentUser?.email ? currentUser.email : dialect.toUpperCase() + " 모드"}
                  </span>
                  {currentUser?.email && (
                    <button
                      aria-label="이메일 복사"
                      onClick={handleCopyEmail}
                      style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: copiedEmail ? "var(--ds-success)" : "var(--ds-text-faint)", padding: 2, borderRadius: "var(--ds-r-6)", transition: "color var(--ds-dur-fast) var(--ds-ease)" }}
                    >
                      {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                {currentUser?.role === "ADMIN"
                  ? <Pill variant="warn">관리자</Pill>
                  : <Pill variant="accent">일반 사용자</Pill>
                }
              </div>
              <Button variant="default" size="sm" onClick={() => router.push("/settings")}>프로필 편집</Button>
            </div>
          </Card>

          {/* Usage stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--ds-sp-3)" }}>
            {isLoading
              ? [0, 1, 2, 3].map((i) => (
                  <Card key={i}>
                    <Skeleton className="h-4 w-3/4 rounded" style={{ marginBottom: "var(--ds-sp-2)" }} />
                    <Skeleton className="h-7 w-1/2 rounded" />
                  </Card>
                ))
              : STATS.map((stat) => (
                  <Card
                    key={stat.label}
                    hoverable
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(stat.href)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-2)" }}>
                      {stat.icon}
                      <span style={{ fontSize: "var(--ds-fs-11)" }}>{stat.label}</span>
                    </div>
                    <div
                      className="ds-num"
                      style={{ fontSize: "var(--ds-fs-22)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}
                    >
                      {stat.value}
                    </div>
                  </Card>
                ))}
          </div>

          {/* Recent activity */}
          <Card>
            <CardHead title="최근 활동" meta={isLoading ? "" : `최근 ${recentItems.length}개 쿼리`} />

            {isLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)", padding: "var(--ds-sp-2) 0" }}>
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
            )}

            {!isLoading && recentItems.length === 0 && (
              <div style={{ padding: "var(--ds-sp-4)", textAlign: "center", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>
                <div>아직 실행한 쿼리가 없습니다.</div>
                <Link href="/workspace" style={{ display: "inline-block", marginTop: "var(--ds-sp-2)", fontSize: "var(--ds-fs-12)", color: "var(--ds-accent)" }}>
                  워크스페이스로 이동 →
                </Link>
              </div>
            )}

            {!isLoading && recentItems.map((item, i) => (
              <div
                key={item.id}
                className="group hover:bg-fill transition-colors"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-3)",
                  padding: "var(--ds-sp-3) 0",
                  borderBottom: i < recentItems.length - 1 ? "1px solid var(--ds-border)" : "none",
                  cursor: "pointer",
                }}
              >
                <span
                  className="ds-mono"
                  title={new Date(item.createdAt).toLocaleString("ko-KR")}
                  style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", width: 68, flexShrink: 0, cursor: "default" }}
                >
                  {formatTime(item.createdAt)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div title={item.nlQuery ?? item.sql} style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.nlQuery ?? item.sql.slice(0, 60)}
                  </div>
                  <div style={{ display: "flex", gap: "var(--ds-sp-2)", marginTop: 2, alignItems: "center" }}>
                    {item.connectionName && (
                      <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                        {item.connectionName}
                      </span>
                    )}
                    {(item.rowCount ?? 0) > 0 && (
                      <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                        {item.rowCount?.toLocaleString()}행
                      </span>
                    )}
                    <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                      {formatDuration(item.durationMs)}
                    </span>
                  </div>
                </div>
                {item.status === "SUCCESS"
                  ? <Pill variant="success" dot="ok">성공</Pill>
                  : item.status === "BLOCKED"
                  ? <Pill variant="info">차단됨</Pill>
                  : <Pill variant="danger" dot="err">실패</Pill>
                }
                <div style={{ opacity: 0, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }} className="group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw size={12} />}
                    onClick={(e) => { e.stopPropagation(); handleRerun(item); }}
                  >
                    재실행
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          {/* Account management */}
          <Card>
            <CardHead title="계정 관리" />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ds-sp-4)", paddingBottom: "var(--ds-sp-3)", borderBottom: "1px solid var(--ds-border)" }}>
                <div>
                  <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>비밀번호 변경</div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>설정에서 변경하세요</div>
                </div>
                <Button variant="default" size="sm" icon={<KeyRound size={12} />} onClick={() => router.push("/settings")}>변경하기</Button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ds-sp-4)", paddingBottom: "var(--ds-sp-3)", borderBottom: "1px solid var(--ds-border)" }}>
                <div>
                  <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>데이터 내보내기</div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>저장된 쿼리와 히스토리를 JSON 또는 CSV로 다운로드</div>
                </div>
                <div style={{ display: "flex", gap: "var(--ds-sp-2)", flexShrink: 0 }}>
                  <Button variant="ghost" size="sm" icon={<Download size={12} />} onClick={() => { void handleExportCsv(); }}>CSV</Button>
                  <Button variant="default" size="sm" icon={<Download size={12} />} onClick={() => { void handleExport(); }}>JSON</Button>
                </div>
              </div>
              <div style={{ border: "1px solid var(--ds-danger)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-4)" }}>
                <div style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-danger)", marginBottom: "var(--ds-sp-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  위험 구역
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ds-sp-4)" }}>
                  <div>
                    <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>계정 삭제</div>
                    <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>계정과 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</div>
                  </div>
                  <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={handleDeleteAccount}>계정 삭제</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {deleteAccountModal && (
        <div role="dialog" aria-modal="true" aria-label="계정 삭제 요청" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteAccountModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setDeleteAccountModal(false); }}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 320, maxWidth: 400, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-danger)" }}>계정 삭제 요청</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", lineHeight: 1.6 }}>
              계정 삭제는 관리자 패널에서 처리됩니다.<br />
              지원팀(<strong>support@vibesql.com</strong>)에 문의하거나 관리자에게 요청해주세요.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button autoFocus variant="ghost" size="sm" onClick={() => setDeleteAccountModal(false)}>닫기</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
