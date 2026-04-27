"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Activity, Shield, Database, Zap, FileText, Settings, Download, X } from "lucide-react";
import type { AuditLogItem } from "@/app/api/audit-logs/route";

// ─── Action meta ──────────────────────────────────────────────────────────────

type ActionGroup = "query" | "connection" | "auth" | "settings" | "other";

function categorizeAction(action: string): ActionGroup {
  if (action.startsWith("query.") || action.startsWith("sql.") || action.startsWith("generate.")) return "query";
  if (action.startsWith("connection.") || action.startsWith("schema.")) return "connection";
  if (action.startsWith("auth.") || action.startsWith("login") || action.startsWith("logout")) return "auth";
  if (action.startsWith("settings.") || action.startsWith("provider.") || action.startsWith("ai.")) return "settings";
  return "other";
}

const ACTION_META: Record<ActionGroup, { label: string; icon: React.ElementType; variant: "accent" | "info" | "success" | "warn" | "default" }> = {
  query:      { label: "쿼리",   icon: Database,  variant: "accent" },
  connection: { label: "연결",   icon: Zap,       variant: "info" },
  auth:       { label: "인증",   icon: Shield,    variant: "success" },
  settings:   { label: "설정",   icon: Settings,  variant: "warn" },
  other:      { label: "기타",   icon: Activity,  variant: "default" },
};

const GROUP_OPTIONS: { value: ActionGroup | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  ...Object.entries(ACTION_META).map(([k, v]) => ({ value: k as ActionGroup, label: v.label })),
];

function formatAction(action: string): string {
  const MAP: Record<string, string> = {
    "query.generate": "SQL 생성",
    "query.run": "쿼리 실행",
    "query.save": "쿼리 저장",
    "query.delete": "쿼리 삭제",
    "connection.create": "연결 생성",
    "connection.delete": "연결 삭제",
    "connection.test": "연결 테스트",
    "auth.login": "로그인",
    "auth.logout": "로그아웃",
    "provider.create": "AI 프로바이더 추가",
    "provider.update": "AI 프로바이더 수정",
    "provider.delete": "AI 프로바이더 삭제",
    "settings.update": "설정 변경",
  };
  return MAP[action] ?? action;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "방금 전";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const group = categorizeAction(log.action);
  const meta = ACTION_META[group];
  const Icon = meta.icon;
  const detailId = `log-detail-${log.id}`;

  return (
    <div
      className="hover:bg-fill transition-colors"
      style={{
        borderBottom: "1px solid var(--ds-border)",
        padding: "var(--ds-sp-2) var(--ds-sp-3)",
      }}
    >
      <div
        role={log.metadata ? "button" : undefined}
        tabIndex={log.metadata ? 0 : undefined}
        aria-expanded={log.metadata ? expanded : undefined}
        aria-controls={log.metadata ? detailId : undefined}
        aria-label={log.metadata ? "로그 상세 보기" : undefined}
        style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", cursor: log.metadata ? "pointer" : "default" }}
        onClick={() => { if (log.metadata) setExpanded((v) => !v); }}
        onKeyDown={(e) => { if (log.metadata && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setExpanded((v) => !v); } }}
      >
        <Icon size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", flexWrap: "wrap" }}>
          <Pill variant={meta.variant}>{meta.label}</Pill>
          <span style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)" }}>
            {formatAction(log.action)}
          </span>
          <span style={{ fontSize: "var(--ds-fs-11)", fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-faint)" }}>
            {log.action}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", flexShrink: 0 }}>
          {log.ipAddress && (
            <span style={{ fontSize: "var(--ds-fs-10)", fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-faint)" }}>
              {log.ipAddress}
            </span>
          )}
          <span
            title={new Date(log.createdAt).toLocaleString("ko-KR")}
            style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", cursor: "default" }}
          >
            {formatTimestamp(log.createdAt)}
          </span>
          {log.metadata && (
            <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)" }}>
              {expanded ? "▲" : "▶"}
            </span>
          )}
        </div>
      </div>

      {expanded && log.metadata && (
        <pre id={detailId} style={{
          marginTop: "var(--ds-sp-2)", marginLeft: 28,
          background: "var(--ds-fill)", borderRadius: "var(--ds-r-6)",
          padding: "var(--ds-sp-2) var(--ds-sp-3)", fontSize: "var(--ds-fs-11)",
          fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-mute)",
          overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ActionGroup | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: logs = [], isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ["audit-logs", userIdFilter],
    queryFn: async () => {
      const url = userIdFilter.trim()
        ? `/api/audit-logs?userId=${encodeURIComponent(userIdFilter.trim())}`
        : "/api/audit-logs";
      const res = await fetch(url);
      const json = await res.json() as { data?: AuditLogItem[] };
      return json.data ?? [];
    },
    staleTime: 30_000,
  });

  const filtered = logs.filter((log) => {
    const matchGroup = group === "all" || categorizeAction(log.action) === group;
    const matchSearch = !search || log.action.toLowerCase().includes(search.toLowerCase()) || (log.userId ?? "").toLowerCase().includes(search.toLowerCase());
    const logDate = new Date(log.createdAt);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo = !dateTo || logDate <= new Date(dateTo + "T23:59:59");
    return matchGroup && matchSearch && matchFrom && matchTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const rows = [["시각", "액션", "그룹", "사용자 ID", "IP", "메타데이터"]];
    for (const log of filtered) {
      rows.push([
        formatTimestamp(log.createdAt),
        formatAction(log.action),
        ACTION_META[categorizeAction(log.action)].label,
        log.userId ?? "",
        log.ipAddress ?? "",
        log.metadata ? JSON.stringify(log.metadata) : "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-logs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="감사 로그"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "계정" }, { label: "감사 로그" }]}
        actions={
          filtered.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              aria-label="CSV 내보내기"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "var(--ds-sp-1) var(--ds-sp-3)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)" }}
            >
              <Download size={12} />
              CSV
            </button>
          ) : undefined
        }
      />

      <div aria-busy={isLoading} aria-live="polite" style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-5)" }}>
          {[
            { label: "전체 로그", value: logs.length },
            { label: "쿼리", value: logs.filter((l) => categorizeAction(l.action) === "query").length },
            { label: "연결", value: logs.filter((l) => categorizeAction(l.action) === "connection").length },
            { label: "설정", value: logs.filter((l) => categorizeAction(l.action) === "settings").length },
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
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-3)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
            <input
              ref={searchRef}
              type="search"
              aria-label="액션 / 사용자 검색"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="액션 / 사용자 검색... (⌘F)"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: search ? 28 : "var(--ds-sp-3)",
                paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)",
                background: "var(--ds-fill)", border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)",
                outline: "none", fontFamily: "var(--ds-font-sans)",
              }}
            />
            {search && (
              <button type="button" aria-label="검색 지우기" onClick={() => { setSearch(""); setPage(1); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0, transition: "color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:text-text">
                <X size={13} />
              </button>
            )}
          </div>
          <input
            aria-label="사용자 ID 필터"
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
            placeholder="사용자 ID 필터..."
            style={{
              padding: "var(--ds-sp-2) var(--ds-sp-3)", background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)",
              color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none",
              fontFamily: "var(--ds-font-sans)", width: 160,
            }}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            aria-label="시작 날짜"
            style={{
              padding: "var(--ds-sp-2) var(--ds-sp-3)", background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)",
              color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none",
              fontFamily: "var(--ds-font-sans)",
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            aria-label="종료 날짜"
            style={{
              padding: "var(--ds-sp-2) var(--ds-sp-3)", background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)",
              color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none",
              fontFamily: "var(--ds-font-sans)",
            }}
          />
          {(dateFrom || dateTo || userIdFilter) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); setUserIdFilter(""); setPage(1); }}
              style={{ padding: "var(--ds-sp-2) var(--ds-sp-3)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)" }}
            >
              초기화
            </button>
          )}
        </div>
        <div role="group" aria-label="액션 그룹 필터" style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap", marginBottom: "var(--ds-sp-4)" }}>
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={group === opt.value}
              onClick={() => { setGroup(opt.value); setPage(1); }}
              style={{
                padding: "var(--ds-sp-1) var(--ds-sp-2)", borderRadius: "var(--ds-r-6)",
                border: "1px solid",
                borderColor: group === opt.value ? "var(--ds-accent)" : "var(--ds-border)",
                background: group === opt.value ? "var(--ds-accent-soft)" : "transparent",
                color: group === opt.value ? "var(--ds-accent)" : "var(--ds-text-mute)",
                fontSize: "var(--ds-fs-12)", cursor: "pointer",
                transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
              }}
            >
              {opt.label}
            </button>
          ))}
          <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", alignSelf: "center", marginLeft: "var(--ds-sp-2)" }}>
            {filtered.length}건 · {page}/{totalPages} 페이지
          </span>
        </div>

        {/* Log list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card style={{ padding: "var(--ds-sp-6)", textAlign: "center" }}>
            <FileText size={24} style={{ color: "var(--ds-text-faint)", marginBottom: "var(--ds-sp-2)" }} />
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>
              {logs.length === 0
                ? "아직 활동 기록이 없습니다."
                : "검색 결과가 없습니다."}
            </div>
            {logs.length > 0 && (
              <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => { setSearch(""); setPage(1); }}>
                검색 지우기
              </Button>
            )}
          </Card>
        ) : (
          <>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {paginated.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="페이지 탐색" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--ds-sp-2)", marginTop: "var(--ds-sp-4)" }}>
                <button
                  type="button"
                  aria-label="이전 페이지"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: "var(--ds-sp-1) var(--ds-sp-3)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "var(--ds-fs-12)", color: page === 1 ? "var(--ds-text-faint)" : "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", opacity: page === 1 ? 0.5 : 1, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                >
                  이전
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return p <= totalPages ? (
                    <button
                      key={p}
                      type="button"
                      aria-label={`${p} 페이지`}
                      aria-current={p === page ? "page" : undefined}
                      onClick={() => setPage(p)}
                      style={{ padding: "var(--ds-sp-1) var(--ds-sp-3)", background: p === page ? "var(--ds-accent)" : "var(--ds-fill)", border: "1px solid", borderColor: p === page ? "var(--ds-accent)" : "var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-12)", color: p === page ? "var(--ds-accent-on)" : "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)" }}
                    >
                      {p}
                    </button>
                  ) : null;
                })}
                <button
                  type="button"
                  aria-label="다음 페이지"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: "var(--ds-sp-1) var(--ds-sp-3)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: "var(--ds-fs-12)", color: page === totalPages ? "var(--ds-text-faint)" : "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)", opacity: page === totalPages ? 0.5 : 1, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                >
                  다음
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
