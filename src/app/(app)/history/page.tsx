"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Button } from "@/components/ui-vs/Button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Star, MoreHorizontal } from "lucide-react";

type HistoryFilter = "전체" | "성공" | "실패" | "즐겨찾기";
const HISTORY_FILTERS: HistoryFilter[] = ["전체", "성공", "실패", "즐겨찾기"];

interface HistoryItem {
  id: string;
  nlQuery?: string;
  sql: string;
  dialect?: string;
  status: "SUCCESS" | "ERROR" | "BLOCKED";
  rowCount?: number;
  durationMs?: number | null;
  errorMsg?: string;
  starred: boolean;
  createdAt: string;
  connectionName?: string;
}

const mockHistory: HistoryItem[] = [
  {
    id: "1",
    createdAt: new Date().toISOString(),
    nlQuery: "결제 사용자 100명을 보여줘",
    sql: "SELECT...",
    connectionName: "prod_analytics",
    status: "SUCCESS",
    rowCount: 1000,
    durationMs: 800,
    starred: true,
    dialect: "postgresql",
  },
  {
    id: "2",
    createdAt: new Date().toISOString(),
    nlQuery: "결제 실패 — checkout",
    sql: "SELECT...",
    connectionName: "prod_analytics",
    status: "ERROR",
    rowCount: 0,
    durationMs: null,
    starred: false,
    dialect: "postgresql",
  },
];

function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const d = new Date(item.createdAt).toDateString();
    const label =
      d === today
        ? "오늘"
        : d === yesterday
        ? "어제"
        : new Date(item.createdAt).toLocaleDateString("ko-KR");
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

function formatTime(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("전체");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await fetch("/api/history");
      const json = await res.json();
      return json.data as HistoryItem[];
    },
    initialData: mockHistory,
    staleTime: 10_000,
  });

  const filtered = (data ?? []).filter((item) => {
    if (activeFilter === "성공" && item.status !== "SUCCESS") return false;
    if (activeFilter === "실패" && item.status !== "ERROR" && item.status !== "BLOCKED") return false;
    if (activeFilter === "즐겨찾기" && !item.starred) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.nlQuery?.toLowerCase().includes(q) ||
        item.sql.toLowerCase().includes(q) ||
        item.connectionName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const historyGroups = groupByDate(filtered);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="히스토리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "히스토리" }]}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-4)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {HISTORY_FILTERS.map((f) => (
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="히스토리 검색..."
            style={{
              padding: "var(--ds-sp-1) var(--ds-sp-3)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-surface)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-12)",
              outline: "none",
              fontFamily: "var(--ds-font-sans)",
              width: 200,
            }}
          />
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* History list */}
        {!isLoading &&
          Object.entries(historyGroups).map(([date, items]) => (
            <div key={date} style={{ marginBottom: "var(--ds-sp-5)" }}>
              <div
                style={{
                  fontSize: "var(--ds-fs-11)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-text-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "var(--ds-sp-2)",
                  paddingLeft: "var(--ds-sp-1)",
                }}
              >
                {date}
              </div>

              <Card padding={0}>
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className="group"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-3)",
                      padding: "var(--ds-sp-3) var(--ds-sp-4)",
                      borderBottom: i < items.length - 1 ? "1px solid var(--ds-border)" : undefined,
                      cursor: "pointer",
                      transition: "background var(--ds-dur-fast) var(--ds-ease)",
                    }}
                  >
                    {/* Time */}
                    <span
                      className="ds-mono"
                      style={{
                        fontSize: "var(--ds-fs-11)",
                        color: "var(--ds-text-faint)",
                        width: 36,
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(item.createdAt)}
                    </span>

                    {/* Query */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--ds-fs-13)",
                          color: "var(--ds-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.nlQuery ?? item.sql}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--ds-sp-2)",
                          marginTop: 2,
                          alignItems: "center",
                        }}
                      >
                        {item.connectionName && (
                          <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                            {item.connectionName}
                          </span>
                        )}
                        {item.rowCount != null && item.rowCount > 0 && (
                          <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                            {item.rowCount.toLocaleString()}행
                          </span>
                        )}
                        <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                          {formatDuration(item.durationMs)}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    {item.status === "SUCCESS" ? (
                      <Pill variant="success" dot="ok">성공</Pill>
                    ) : item.status === "ERROR" ? (
                      <Pill variant="danger" dot="err">실패</Pill>
                    ) : (
                      <Pill variant="warn">차단</Pill>
                    )}

                    {/* Starred */}
                    {item.starred && (
                      <Star size={13} style={{ color: "var(--ds-warn)", fill: "var(--ds-warn)", flexShrink: 0 }} />
                    )}

                    {/* Actions (hover) */}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--ds-sp-1)",
                        opacity: 0,
                        transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
                      }}
                      className="group-hover:opacity-100"
                    >
                      <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />}>재실행</Button>
                      <Button variant="ghost" size="sm" icon={<Star size={12} />}>저장</Button>
                      <Button variant="ghost" size="sm" icon={<MoreHorizontal size={12} />} aria-label="더보기">···</Button>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
      </div>
    </div>
  );
}
