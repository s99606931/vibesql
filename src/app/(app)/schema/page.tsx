"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { AICallout, AIBadge } from "@/components/ui-vs/AICallout";
import { Button } from "@/components/ui-vs/Button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Database } from "lucide-react";

interface TableMeta {
  name: string;
  rows: string;
  columns: number;
  description: string;
  cols: string[];
  fks: string[];
  pii: boolean;
}


export default function SchemaPage() {
  const [search, setSearch] = useState("");
  const activeConnectionId = useWorkspaceStore((s) => s.activeConnectionId);
  const router = useRouter();

  const { data, isLoading } = useQuery({
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

  const tables = (data ?? []).filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="스키마"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "스키마" }]}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="테이블 검색..."
              style={{
                width: "100%",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
                paddingLeft: 30,
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-surface)",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-13)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
              }}
            />
          </div>
          <Pill variant="accent">public</Pill>
          <Pill>PII 포함</Pill>
          <Pill>최근 변경</Pill>
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
              <Card key={table.name} hoverable style={{ cursor: "pointer" }}>
                <CardHead
                  title={table.name}
                  meta={`${table.rows}행 · ${table.columns}컬럼`}
                  actions={
                    <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
                      {table.pii && <Pill variant="warn">PII</Pill>}
                      <Pill variant="default">{table.rows}</Pill>
                    </div>
                  }
                />

                {/* Columns preview */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--ds-sp-1)",
                    flexWrap: "wrap",
                    marginBottom: "var(--ds-sp-3)",
                  }}
                >
                  {table.cols.slice(0, 5).map((col) => (
                    <span
                      key={col}
                      style={{
                        fontFamily: "var(--ds-font-mono)",
                        fontSize: "var(--ds-fs-10)",
                        color: "var(--ds-text-mute)",
                        background: "var(--ds-fill)",
                        padding: "1px 6px",
                        borderRadius: "var(--ds-r-4)",
                      }}
                    >
                      {col}
                    </span>
                  ))}
                  {table.cols.length > 5 && (
                    <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)" }}>
                      +{table.cols.length - 5} more
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
                  {table.description}
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
                &ldquo;{search}&rdquo;와 일치하는 테이블이 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
