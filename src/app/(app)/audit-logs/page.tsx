"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Search, Activity, Shield, Database, Zap, FileText, Settings } from "lucide-react";
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
  return d.toLocaleString("ko-KR", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const group = categorizeAction(log.action);
  const meta = ACTION_META[group];
  const Icon = meta.icon;

  return (
    <div style={{
      borderBottom: "1px solid var(--ds-border)",
      padding: "var(--ds-sp-2) var(--ds-sp-3)",
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", cursor: log.metadata ? "pointer" : "default" }}
        onClick={() => { if (log.metadata) setExpanded((v) => !v); }}
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
          <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
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
        <pre style={{
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

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ActionGroup | "all">("all");

  const { data: logs = [], isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/audit-logs");
      const json = await res.json() as { data?: AuditLogItem[] };
      return json.data ?? [];
    },
    staleTime: 30_000,
  });

  const filtered = logs.filter((log) => {
    const matchGroup = group === "all" || categorizeAction(log.action) === group;
    const matchSearch = !search || log.action.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="감사 로그"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "계정" }, { label: "감사 로그" }]}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
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
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-4)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="액션 검색..."
              style={{
                width: "100%", paddingLeft: 30, paddingRight: "var(--ds-sp-3)",
                paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)",
                background: "var(--ds-fill)", border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap" }}>
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroup(opt.value)}
                style={{
                  padding: "var(--ds-sp-1) var(--ds-sp-2)", borderRadius: "var(--ds-r-6)",
                  border: "1px solid",
                  borderColor: group === opt.value ? "var(--ds-accent)" : "var(--ds-border)",
                  background: group === opt.value ? "var(--ds-accent-soft)" : "transparent",
                  color: group === opt.value ? "var(--ds-accent)" : "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-12)", cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log list */}
        {isLoading ? (
          <div style={{ color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)", padding: "var(--ds-sp-5) 0" }}>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <Card style={{ padding: "var(--ds-sp-6)", textAlign: "center" }}>
            <FileText size={24} style={{ color: "var(--ds-text-faint)", marginBottom: "var(--ds-sp-2)" }} />
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>
              {!process.env.DATABASE_URL
                ? "감사 로그는 데이터베이스 연결 시 기록됩니다."
                : logs.length === 0
                ? "아직 활동 기록이 없습니다."
                : "검색 결과가 없습니다."}
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {filtered.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
