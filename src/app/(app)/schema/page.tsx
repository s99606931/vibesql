"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { AIBadge } from "@/components/ui-vs/AICallout";
import { Button } from "@/components/ui-vs/Button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Database, Copy, Play, RefreshCw, Link2, Download, X } from "lucide-react";
import { useConnections } from "@/hooks/useConnections";

interface TableMeta {
  name: string;
  rows: string;
  columns: number;
  description: string;
  cols: string[];
  fks: string[];
  pii: boolean;
}

type SchemaFilter = "all" | "pii" | "public";

export default function SchemaPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<SchemaFilter>("all");
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [copiedCol, setCopiedCol] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { activeConnectionId, setActiveConnection } = useWorkspaceStore();
  const { setSql, setNlQuery, setStatus } = useWorkspaceStore();
  const router = useRouter();
  const { data: connections } = useConnections();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["schema", activeConnectionId],
    queryFn: async () => {
      const url = activeConnectionId
        ? `/api/schema?connectionId=${encodeURIComponent(activeConnectionId)}`
        : "/api/schema";
      const res = await fetch(url);
      const json = await res.json();
      return json.data as TableMeta[];
    },
    initialData: [],
    staleTime: 30_000,
  });

  const tables = (data ?? []).filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "pii" && t.pii) ||
      (activeFilter === "public" && !t.pii);
    return matchSearch && matchFilter;
  });

  function handleTableClick(table: TableMeta) {
    setExpandedTable((prev) => (prev === table.name ? null : table.name));
  }

  function handleTableRun(e: React.MouseEvent, table: TableMeta) {
    e.stopPropagation();
    const sql = `SELECT *\nFROM ${table.name}\nLIMIT 100;`;
    setSql(sql);
    setNlQuery(`${table.name} 테이블 전체 조회`);
    setStatus("ready");
    router.push("/workspace");
  }

  function handleCopyTable(e: React.MouseEvent, table: TableMeta) {
    e.stopPropagation();
    navigator.clipboard.writeText(table.name)
      .then(() => {
        setCopiedTable(table.name);
        setTimeout(() => setCopiedTable(null), 1500);
      })
      .catch(() => {});
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="스키마"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "스키마" }]}
        actions={
          tables.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              onClick={() => {
                const headers = ["테이블", "행수", "컬럼수", "컬럼목록", "FK", "PII"];
                const esc = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
                const rows = tables.map((t) => [t.name, t.rows, String(t.columns), t.cols.join("|"), t.fks.join("|"), t.pii ? "Y" : "N"].map(esc).join(","));
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `schema-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              CSV
            </Button>
          ) : undefined
        }
      />

      <div aria-busy={isLoading} aria-live="polite" style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Connection selector + refresh */}
        {connections && connections.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-3)" }}>
            <Database size={13} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <select
              aria-label="데이터베이스 연결 선택"
              value={activeConnectionId ?? ""}
              onChange={(e) => setActiveConnection(e.target.value || null)}
              style={{
                padding: "var(--ds-sp-1) var(--ds-sp-3)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-12)",
                cursor: "pointer",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              <option value="">데모 스키마</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refetch()}
              aria-label="스키마 새로고침"
              style={{ display: "flex", alignItems: "center", padding: "var(--ds-sp-1)", background: "none", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", color: "var(--ds-text-mute)", transition: "color var(--ds-dur-fast) var(--ds-ease), background var(--ds-dur-fast) var(--ds-ease)" }}
              className="hover:bg-fill"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        )}

        {/* Search + filters */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-3)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ds-text-faint)",
              }}
            />
            <input
              ref={searchRef}
              type="search"
              aria-label="테이블 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="테이블 검색... (⌘F)"
              style={{
                width: "100%",
                paddingTop: "var(--ds-sp-2)",
                paddingBottom: "var(--ds-sp-2)",
                paddingLeft: 30,
                paddingRight: search ? 28 : "var(--ds-sp-3)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
              }}
            />
            {search && (
              <button type="button" aria-label="검색 지우기" onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-pressed={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <Pill variant={activeFilter === "all" ? "accent" : "default"}>전체</Pill>
          </button>
          <button
            type="button"
            aria-pressed={activeFilter === "public"}
            onClick={() => setActiveFilter("public")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <Pill variant={activeFilter === "public" ? "accent" : "default"}>public</Pill>
          </button>
          <button
            type="button"
            aria-pressed={activeFilter === "pii"}
            onClick={() => setActiveFilter("pii")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <Pill variant={activeFilter === "pii" ? "warn" : "default"}>PII 포함</Pill>
          </button>
          <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
            {(search || activeFilter !== "all") && (data ?? []).length !== tables.length
              ? `${tables.length} / ${(data ?? []).length}개 테이블`
              : `${tables.length}개 테이블`}
          </span>
        </div>

        {/* No connection callout */}
        {!activeConnectionId && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              padding: "var(--ds-sp-3) var(--ds-sp-4)",
              background: "var(--ds-accent-soft)",
              border: "1px solid var(--ds-accent)",
              borderRadius: "var(--ds-r-8)",
              marginBottom: "var(--ds-sp-4)",
              fontSize: "var(--ds-fs-13)",
              color: "var(--ds-accent)",
            }}
          >
            <Database size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>연결된 DB가 없습니다. 스키마를 보려면 워크스페이스에서 DB 연결을 활성화하세요.</span>
            <Button variant="accent" size="sm" onClick={() => router.push("/connections")}>
              연결 추가
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "var(--ds-sp-4)",
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Table grid */}
        {!isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "var(--ds-sp-4)",
            }}
          >
            {tables.map((table) => (
              <Card
                key={table.name}
                hoverable
                aria-expanded={expandedTable === table.name}
                style={{ cursor: "pointer" }}
                onClick={() => handleTableClick(table)}
              >
                <CardHead
                  title={table.name}
                  meta={`${table.rows}행 · ${table.columns}컬럼`}
                  actions={
                    <div style={{ display: "flex", gap: "var(--ds-sp-1)", alignItems: "center" }}>
                      {table.fks.length > 0 && (
                        <Pill variant="info">
                          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Link2 size={9} />
                            FK {table.fks.length}
                          </span>
                        </Pill>
                      )}
                      {table.pii && <Pill variant="warn">PII</Pill>}
                      <button
                        type="button"
                        onClick={(e) => handleCopyTable(e, table)}
                        aria-label={copiedTable === table.name ? "복사됨" : "테이블명 복사"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: copiedTable === table.name ? "var(--ds-accent)" : "var(--ds-text-faint)", display: "flex", alignItems: "center", padding: 2, gap: 2, transition: "color var(--ds-dur-fast) var(--ds-ease)" }}
                      >
                        <Copy size={11} />
                        {copiedTable === table.name && (
                          <span style={{ fontSize: "var(--ds-fs-10)", fontFamily: "var(--ds-font-sans)" }}>복사됨</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleTableRun(e, table)}
                        aria-label="워크스페이스에서 SELECT 실행"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-accent)", display: "flex", alignItems: "center", padding: 2, transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                        className="hover:opacity-70"
                      >
                        <Play size={11} />
                      </button>
                    </div>
                  }
                />

                {/* Columns */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--ds-sp-1)",
                    flexWrap: "wrap",
                    marginBottom: "var(--ds-sp-3)",
                  }}
                >
                  {(expandedTable === table.name ? table.cols : table.cols.slice(0, 5)).map((col) => (
                    <span
                      key={col}
                      role="button"
                      tabIndex={0}
                      aria-label={`${col} 복사`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(col);
                        setCopiedCol(col);
                        setTimeout(() => setCopiedCol((p) => p === col ? null : p), 1500);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          navigator.clipboard.writeText(col);
                          setCopiedCol(col);
                          setTimeout(() => setCopiedCol((p) => p === col ? null : p), 1500);
                        }
                      }}
                      style={{
                        fontFamily: "var(--ds-font-mono)",
                        fontSize: "var(--ds-fs-10)",
                        color: copiedCol === col ? "var(--ds-accent)" : "var(--ds-text-mute)",
                        background: copiedCol === col ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                        padding: "1px 6px",
                        borderRadius: "var(--ds-r-4)",
                        cursor: "pointer",
                        transition: "color var(--ds-dur-fast) var(--ds-ease), background var(--ds-dur-fast) var(--ds-ease)",
                      }}
                    >
                      {col}
                    </span>
                  ))}
                  {table.cols.length > 5 && expandedTable !== table.name && (
                    <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-accent)", cursor: "pointer", transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }} className="hover:opacity-70">
                      +{table.cols.length - 5} 더 보기
                    </span>
                  )}
                  {expandedTable === table.name && table.cols.length > 5 && (
                    <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)", cursor: "pointer", transition: "color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:text-text">
                      접기 ▲
                    </span>
                  )}
                </div>

                {/* FK badges */}
                {table.fks.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--ds-sp-1)",
                      flexWrap: "wrap",
                      marginBottom: "var(--ds-sp-2)",
                    }}
                  >
                    {table.fks.map((fk) => (
                      <span
                        key={fk}
                        style={{
                          fontFamily: "var(--ds-font-mono)",
                          fontSize: "var(--ds-fs-10)",
                          color: "var(--ds-info)",
                          border: "1px solid var(--ds-info)",
                          padding: "1px 6px",
                          borderRadius: "var(--ds-r-4)",
                        }}
                      >
                        FK: {fk}
                      </span>
                    ))}
                  </div>
                )}

                {/* AI description */}
                <div
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    color: "var(--ds-text-mute)",
                    lineHeight: 1.5,
                    borderTop: "1px dashed var(--ds-border)",
                    paddingTop: "var(--ds-sp-2)",
                    marginTop: "var(--ds-sp-2)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-1)",
                      marginRight: "var(--ds-sp-1)",
                    }}
                  >
                    <AIBadge />
                  </span>
                  {table.description || "AI 설명 없음"}
                </div>
              </Card>
            ))}

            {tables.length === 0 && (
              <div
                style={{
                  gridColumn: "1/-1",
                  textAlign: "center",
                  padding: "var(--ds-sp-12)",
                  color: "var(--ds-text-faint)",
                  fontSize: "var(--ds-fs-13)",
                }}
              >
                <div>
                  {search
                    ? `"${search}"와 일치하는 테이블이 없습니다.`
                    : activeFilter === "pii"
                    ? "PII 포함 테이블이 없습니다."
                    : "표시할 테이블이 없습니다."}
                </div>
                {(search || activeFilter !== "all") && (
                  <Button variant="ghost" size="sm" style={{ marginTop: "var(--ds-sp-2)" }} onClick={() => { setSearch(""); setActiveFilter("all"); }}>
                    필터 초기화
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
