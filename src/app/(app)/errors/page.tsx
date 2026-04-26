"use client";

import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

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

async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch("/api/history");
  const json = (await res.json()) as { data?: HistoryItem[] };
  return json.data ?? [];
}

export default function ErrorsPage() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    staleTime: 10_000,
  });

  const errors = history.filter((h) => h.status === "ERROR" || h.status === "BLOCKED");
  const unresolvedCount = errors.length;
  const lastError = errors[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="상태 · 에러"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "상태" }]}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>

        {/* Status summary */}
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
              value: isLoading ? "—" : `${unresolvedCount}건`,
              color: unresolvedCount > 0 ? "var(--ds-danger)" : "var(--ds-text-mute)",
            },
            {
              icon: Clock,
              label: "마지막 오류",
              value: isLoading ? "—" : lastError ? formatTime(lastError.createdAt) : "없음",
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

        {/* Error log label */}
        <div style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-sp-2)" }}>
          최근 오류 로그
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <Card padding={0}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 56, borderBottom: i < 2 ? "1px solid var(--ds-border)" : undefined, background: "var(--ds-fill)", margin: 0 }} className="ds-stripes" />
            ))}
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && errors.length === 0 && (
          <Card>
            <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)" }}>
              <CheckCircle2 size={32} style={{ color: "var(--ds-success)", margin: "0 auto var(--ds-sp-3)" }} />
              <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)" }}>오류 없음</div>
              <div style={{ fontSize: "var(--ds-fs-12)", marginTop: 4 }}>최근 실행된 쿼리에 오류가 없습니다.</div>
            </div>
          </Card>
        )}

        {/* Error list */}
        {!isLoading && errors.length > 0 && (
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
      </div>
    </div>
  );
}
