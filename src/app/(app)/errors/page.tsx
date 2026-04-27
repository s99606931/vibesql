"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { CheckCircle2, Clock, ChevronDown, ChevronRight, ScrollText, ExternalLink, AlertTriangle, Search, Copy, Check, Download, X } from "lucide-react";

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

// ─── Main page ─────────────────────────────────────────────────────────────

type Tab = "errors" | "audit";

export default function ErrorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("errors");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    staleTime: 10_000,
  });

  const allErrors = history.filter((h) => h.status === "ERROR" || h.status === "BLOCKED");
  const errors = allErrors.filter((e) =>
    !search ||
    (e.errorMsg ?? "").toLowerCase().includes(search.toLowerCase()) ||
    e.sql.toLowerCase().includes(search.toLowerCase()) ||
    (e.connectionName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.nlQuery ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const unresolvedCount = allErrors.length;
  const lastError = allErrors[0];

  const tabs: { id: Tab; label: string }[] = [
    { id: "errors", label: "오류 이력" },
    { id: "audit", label: "감사 로그" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="상태 · 에러"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "상태" }]}
        actions={
          allErrors.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              onClick={() => {
                const headers = ["시각", "유형", "오류 메시지", "SQL", "연결", "자연어 쿼리"];
                const esc = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
                const rows = errors.map((e) => [
                  new Date(e.createdAt).toLocaleString("ko-KR"),
                  classifyError(e),
                  e.errorMsg ?? "",
                  e.sql.replace(/\n/g, " "),
                  e.connectionName ?? "",
                  e.nlQuery ?? "",
                ].map(esc).join(","));
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `errors-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              CSV
            </Button>
          ) : undefined
        }
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

            {!historyLoading && allErrors.length === 0 && (
              <Card>
                <div style={{ textAlign: "center", padding: "var(--ds-sp-6)", color: "var(--ds-text-mute)" }}>
                  <CheckCircle2 size={32} style={{ color: "var(--ds-success)", margin: "0 auto var(--ds-sp-3)" }} />
                  <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)" }}>오류 없음</div>
                  <div style={{ fontSize: "var(--ds-fs-12)", marginTop: 4 }}>최근 실행된 쿼리에 오류가 없습니다.</div>
                </div>
              </Card>
            )}

            {!historyLoading && allErrors.length > 0 && (
              <>
                <div style={{ position: "relative", maxWidth: 320, marginBottom: "var(--ds-sp-3)" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
                  <input
                    ref={searchRef}
                    aria-label="오류 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="오류 검색... (⌘F)"
                    style={{ width: "100%", paddingLeft: 32, paddingRight: search ? 28 : "var(--ds-sp-3)", paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", outline: "none", fontFamily: "var(--ds-font-sans)", boxSizing: "border-box" }}
                  />
                  {search && (
                    <button aria-label="검색 지우기" onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0, transition: "color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:text-text">
                      <X size={13} />
                    </button>
                  )}
                </div>
                {search && (
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginBottom: "var(--ds-sp-2)" }}>
                    {Math.min(errors.length, 20)}/{allErrors.length}건 표시 중{errors.length > 20 ? " · 최대 20건" : ""}
                  </div>
                )}
                {search && errors.length === 0 && (
                  <div style={{ textAlign: "center", padding: "var(--ds-sp-5)", color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)" }}>
                    <div>검색 결과가 없습니다.</div>
                    <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => setSearch("")}>
                      검색 지우기
                    </Button>
                  </div>
                )}
                <Card padding={0}>
                  {errors.slice(0, 20).map((err, i) => {
                    const errType = classifyError(err);
                    const meta = typeLabel[errType];
                    const message = err.errorMsg ?? err.sql.slice(0, 80);
                    const copied = copiedId === err.id;
                    return (
                      <div
                        key={err.id}
                        className="group hover:bg-fill transition-colors"
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
                          <div title={message} style={{ fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-12)", color: "var(--ds-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {message}
                          </div>
                          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                            {err.connectionName ?? "알 수 없는 연결"} · <span title={new Date(err.createdAt).toLocaleString("ko-KR")} style={{ cursor: "default" }}>{formatTime(err.createdAt)}</span>
                            {err.nlQuery && (
                              <span style={{ marginLeft: "var(--ds-sp-2)", fontStyle: "italic" }}>"{err.nlQuery.slice(0, 40)}"</span>
                            )}
                          </div>
                        </div>
                        <button
                          aria-label="SQL 복사"
                          onClick={() => {
                            void navigator.clipboard.writeText(err.sql);
                            setCopiedId(err.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="opacity-0 group-hover:opacity-100"
                          style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "var(--ds-success)" : "var(--ds-text-faint)", padding: "var(--ds-sp-1)", borderRadius: "var(--ds-r-6)", display: "flex", alignItems: "center", transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </Card>
              </>
            )}
          </>
        )}

        {/* ── Tab: 감사 로그 → 전용 페이지로 이동 ── */}
        {activeTab === "audit" && (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ds-sp-3)", padding: "var(--ds-sp-6)", textAlign: "center" }}>
              <ScrollText size={28} style={{ color: "var(--ds-text-faint)" }} />
              <div>
                <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: 4 }}>
                  감사 로그 전용 페이지
                </div>
                <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>
                  날짜 범위 필터, 사용자 필터, 페이지네이션이 지원되는 전용 페이지에서 확인하세요.
                </div>
              </div>
              <Button variant="accent" size="sm" icon={<ExternalLink size={12} />} onClick={() => router.push("/audit-logs")}>
                감사 로그 페이지로 이동
              </Button>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
