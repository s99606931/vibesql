"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { ConnectionWizard } from "@/components/connections/ConnectionWizard";
import { useConnections, useTestConnection } from "@/hooks/useConnections";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import type { DbDialect } from "@/types";

const dialectLabels: Record<DbDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
  oracle: "Oracle",
};

export default function ConnectionsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const { data: connections, isLoading, isError, error } = useConnections();
  const testMutation = useTestConnection();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <TopBar
        title="연결"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "연결" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setShowWizard(true)}
          >
            새 연결
          </Button>
        }
      />

      <div
        style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}
      >
        {isLoading && (
          <Card padding={0}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--ds-sp-2)",
                padding: "var(--ds-sp-4)",
              }}
            >
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        )}

        {isError && (
          <div
            style={{
              fontSize: "var(--ds-fs-13)",
              color: "var(--ds-danger)",
              padding: "var(--ds-sp-4)",
            }}
          >
            {error instanceof Error ? error.message : "연결 목록을 불러오지 못했습니다."}
          </div>
        )}

        {!isLoading && !isError && connections && connections.length > 0 && (
          <Card padding={0}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--ds-fill)" }}>
                    {["이름", "종류", "호스트", "마지막 테스트", "상태", ""].map(
                      (col) => (
                        <th
                          key={col}
                          style={{
                            padding: "var(--ds-sp-2) var(--ds-sp-4)",
                            textAlign: "left",
                            fontSize: "var(--ds-fs-10)",
                            fontFamily: "var(--ds-font-mono)",
                            color: "var(--ds-text-mute)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid var(--ds-border)",
                            fontWeight:
                              "var(--ds-fw-semibold)" as React.CSSProperties["fontWeight"],
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {connections.map((conn) => {
                    const isTesting =
                      testMutation.isPending &&
                      testMutation.variables === conn.id;
                    return (
                      <tr
                        key={conn.id}
                        className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
                        style={{ borderBottom: "1px solid var(--ds-border)" }}
                      >
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <span
                            style={{
                              fontFamily: "var(--ds-font-mono)",
                              fontSize: "var(--ds-fs-13)",
                              color: "var(--ds-text)",
                              fontWeight:
                                "var(--ds-fw-medium)" as React.CSSProperties["fontWeight"],
                            }}
                          >
                            {conn.name}
                          </span>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <Pill variant="default">
                            {dialectLabels[conn.type] ?? conn.type}
                          </Pill>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <span
                            className="ds-mono"
                            style={{
                              fontSize: "var(--ds-fs-12)",
                              color: "var(--ds-text-mute)",
                            }}
                          >
                            {conn.host ?? "—"}
                          </span>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <span
                            style={{
                              fontSize: "var(--ds-fs-12)",
                              color: "var(--ds-text-faint)",
                            }}
                          >
                            {conn.lastTestedAt
                              ? new Date(conn.lastTestedAt).toLocaleString("ko-KR")
                              : "미테스트"}
                          </span>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          {isTesting ? (
                            <Pill variant="info">
                              <Loader2
                                size={10}
                                style={{ animation: "spin 1s linear infinite" }}
                              />
                              테스트 중
                            </Pill>
                          ) : conn.lastTestedOk === true ? (
                            <Pill variant="success" dot="ok">
                              연결됨
                            </Pill>
                          ) : conn.lastTestedOk === false ? (
                            <Pill variant="danger" dot="err">
                              오류
                            </Pill>
                          ) : (
                            <Pill variant="default">미확인</Pill>
                          )}
                        </td>
                        <td style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "var(--ds-sp-1)",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={
                                isTesting ? (
                                  <Loader2
                                    size={12}
                                    style={{ animation: "spin 1s linear infinite" }}
                                  />
                                ) : (
                                  <RefreshCw size={12} />
                                )
                              }
                              disabled={isTesting}
                              onClick={() =>
                                testMutation.mutate(conn.id)
                              }
                            >
                              재테스트
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!isLoading && !isError && (!connections || connections.length === 0) && (
          <Card
            dashed
            style={{
              marginTop: "var(--ds-sp-4)",
              textAlign: "center",
              padding: "var(--ds-sp-10)" as React.CSSProperties["padding"],
            }}
          >
            <div
              style={{
                color: "var(--ds-text-faint)",
                marginBottom: "var(--ds-sp-3)",
                fontSize: "var(--ds-fs-14)",
              }}
            >
              연결된 DB가 없습니다
            </div>
            <Button
              variant="accent"
              icon={<Plus size={13} />}
              onClick={() => setShowWizard(true)}
            >
              첫 연결 추가하기
            </Button>
          </Card>
        )}
      </div>

      {showWizard && (
        <ConnectionWizard
          onClose={() => setShowWizard(false)}
          onDone={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
