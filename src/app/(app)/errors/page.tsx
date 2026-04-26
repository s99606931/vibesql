"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight } from "lucide-react";

// ─── Error History types ───────────────────────────────────────────────────

interface HistoryItem {
  id: string;
  nlQuery?: string;
  sql: string;
  status: "SUCCESS" | "ERROR" | "BLOCKED";
  errorMsg?: string;
  connectionName?: string;
  createdAt: string;
}

type ErrorType = "query_error" | "guard_blocked" | "unknown";

const typeLabel: Record<ErrorType, { label: string; variant: "danger" | "warn" | "info" }> = {
  query_error: { label: "쿼리 오류", variant: "danger" },
  guard_blocked: { label: "보안 차단", variant: "info" },
  unknown: { label: "오류", variant: "warn" },
};

function classifyError(item: HistoryItem): ErrorType {
  if (item.status === "BLOCKED") return "guard_blocked";
  if (item.status === "ERROR") return "query_error";
  return "unknown";
}

// ─── Audit Log types ───────────────────────────────────────────────────────

type AuditLogItem = {
  id: string;
  action: string;
  userId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ─── Shared utils ──────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (diffDays === 0) return `${hh}:${mm}`;
  if (diffDays === 1) return `어제 ${hh}:${mm}`;
  return `${diffDays}일 전`;
}

// ─── Data fetchers ─────────────────────────────────────────────────────────

async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch("/api/history");
  const json = (await res.json()) as { data?: HistoryItem[] };
  return json.data ?? [];
}

async function fetchAuditLogs(): Promise<AuditLogItem[]> {
  const r = await fetch("/api/audit-logs");
  if (!r.ok) throw new Error("Failed to fetch audit logs");
  const j = (await r.json()) as { data?: AuditLogItem[] };
  return j.data ?? [];
}

// ─── Audit log row ─────────────────────────────────────────────────────────

function AuditLogRow({ item, isLast }: { item: AuditLogItem; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;

  return (
    <div
      style={{
        borderBottom: isLast ? undefined : "1px solid var(--ds-border)",
        padding: "var(--ds-sp-3) var(--ds-sp-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--ds-sp-3)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: "var(--ds-fw-semibold)",
              fontSize: "var(--ds-fs-13)",
              color: "var(--ds-text)",
              fontFamily: "var(--ds-font-mono)",
            }}
          >
            {item.action}
          </div>
          <div
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-faint)",
              marginTop: 2,
              display: "flex",
              gap: "var(--ds-sp-2)",
              flexWrap: "wrap",
            }}
          >
            {item.ipAddress && <span>{item.ipAddress}</span>}
            {item.userId && <span>user:{item.userId.slice(0, 8)}</span>}
            <span>{formatTime(item.createdAt)}</span>
          </div>
        </div>

        {hasMetadata && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "2px var(--ds-sp-2)",
              background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              cursor: "pointer",
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-faint)",
              fontFamily: "var(--ds-font-sans)",
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            detail
          </button>
        )}
      </div>

      {expanded && hasMetadata && (
        <pre
          style={{
            padding: "var(--ds-sp-2) var(--ds-sp-3)",
            background: "var(--ds-fill)",
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-6)",
            fontSize: "var(--ds-fs-11)",
            fontFamily: "var(--ds-font-mono)",
            color: "var(--ds-text-mute)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
            marginTop: "var(--ds-sp-2)",
          }}
        >
          {JSON.stringify(item.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

type Tab = "errors" | "audit";

export default function ErrorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("errors");

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    staleTime: 10_000,
  });

  const { data: auditLogs = [], isLoading: auditLoading, error: auditError } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: fetchAuditLogs,
    staleTime: 30_000,
    enabled: activeTab === "audit",
  });

  const errors = history.filter((h) => h.status === "ERROR" || h.status === "BLOCKED");
  const unresolvedCount = errors.length;
  const lastError = errors[0];

  const tabs: { id: Tab; label: string }[] = [
    { id: "errors", label: "오류 이력" },
    { id: "audit", label: "감사 로그" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="상태 · 에러"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "상태" }]}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* Status summary — always visible */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-5)" }}>
          {[
            {
              icon: CheckCircle2,
              label: "시스템 정상",
              value: unresolvedCount === 0 ? "모든 연결 활성" : "오류 확인 필요",
              color: unresolvedCount === 0 ? "var(--ds-success)" : "var(--ds-warn)",
            },
            {
              icon: AlertTriangle,
              label: "미해결 오류",
              value: historyLoading ? "—" : `${unresolvedCount}건`,
              color: unresolvedCount > 0 ? "var(--ds-danger)" : "var(--ds-text-mute)",
            },
            {
              icon: Clock,
              label: "마지막 오류",
              value: historyLoading ? "—" : lastError ? formatTime(lastError.createdAt) : "없음",
              color: "var(--ds-text-mute)",
            },
          ].map((item) => (
            <Card key={item.label}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)" }}>
                <item.icon size={20} style={{ color: item.color }} />
                <div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{item.label}</div>
                  <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>{item.value}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 2,
            borderBottom: "1px solid var(--ds-border)",
            marginBottom: "var(--ds-sp-4)",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--ds-accent)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: "var(--ds-fs-13)",
                  fontWeight: isActive ? "var(--ds-fw-semibold)" : "var(--ds-fw-normal)",
                  color: isActive ? "var(--ds-text)" : "var(--ds-text-mute)",
                  fontFamily: "var(--ds-font-sans)",
                  marginBottom: -1,
                  transition: "color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: 오류 이력 ── */}
        {activeTab === "errors" && (
          <>
            <div style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-sp-2)" }}>
              최근 오류 로그
            </div>

            {historyLoading && (
              <Card padding={0}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: 56, borderBottom: i < 2 ? "1px solid var(--ds-border)" : undefined, background: "var(--ds-fill)", margin: 0 }} className="ds-stripes" />
                ))}
              </Card>
            )}

            {!historyLoading && errors.length === 0 && (
              <Card>
                <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)" }}>
                  <CheckCircle2 size={32} style={{ color: "var(--ds-success)", margin: "0 auto var(--ds-sp-3)" }} />
                  <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)" }}>오류 없음</div>
                  <div style={{ fontSize: "var(--ds-fs-12)", marginTop: 4 }}>최근 실행된 쿼리에 오류가 없습니다.</div>
                </div>
              </Card>
            )}

            {!historyLoading && errors.length > 0 && (
              <Card padding={0}>
                {errors.slice(0, 20).map((err, i) => {
                  const errType = classifyError(err);
                  const meta = typeLabel[errType];
                  const message = err.errorMsg ?? err.sql.slice(0, 80);
                  return (
                    <div
                      key={err.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--ds-sp-3)",
                        padding: "var(--ds-sp-3) var(--ds-sp-4)",
                        borderBottom: i < errors.length - 1 ? "1px solid var(--ds-border)" : undefined,
                      }}
                    >
                      <Pill variant={meta.variant}>{meta.label}</Pill>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-12)", color: "var(--ds-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {message}
                        </div>
                        <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                          {err.connectionName ?? "알 수 없는 연결"} · {formatTime(err.createdAt)}
                          {err.nlQuery && (
                            <span style={{ marginLeft: "var(--ds-sp-2)", fontStyle: "italic" }}>"{err.nlQuery.slice(0, 40)}"</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* ── Tab: 감사 로그 ── */}
        {activeTab === "audit" && (
          <>
            <div style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-sp-2)" }}>
              감사 로그
            </div>

            {auditLoading && (
              <Card padding={0}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ height: 56, borderBottom: i < 3 ? "1px solid var(--ds-border)" : undefined, background: "var(--ds-fill)", margin: 0 }} className="ds-stripes" />
                ))}
              </Card>
            )}

            {!auditLoading && auditError && (
              <Card>
                <div style={{ textAlign: "center", padding: "var(--ds-sp-5)", color: "var(--ds-danger)" }}>
                  <AlertTriangle size={24} style={{ margin: "0 auto var(--ds-sp-2)" }} />
                  <div style={{ fontSize: "var(--ds-fs-13)" }}>감사 로그를 불러오지 못했습니다.</div>
                </div>
              </Card>
            )}

            {!auditLoading && !auditError && auditLogs.length === 0 && (
              <Card>
                <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)" }}>
                  <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)" }}>감사 로그가 없습니다</div>
                  <div style={{ fontSize: "var(--ds-fs-12)", marginTop: 4 }}>기록된 감사 이벤트가 없습니다.</div>
                </div>
              </Card>
            )}

            {!auditLoading && !auditError && auditLogs.length > 0 && (
              <Card padding={0}>
                {auditLogs.map((item, i) => (
                  <AuditLogRow
                    key={item.id}
                    item={item}
                    isLast={i === auditLogs.length - 1}
                  />
                ))}
              </Card>
            )}
          </>
        )}

      </div>
    </div>
  );
}
