"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { ConnectionWizard } from "@/components/connections/ConnectionWizard";
import { useConnections, useTestConnection, useUpdateConnection } from "@/hooks/useConnections";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2, Trash2, Pencil, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { DbDialect, Connection } from "@/types";

const dialectLabels: Record<DbDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
  oracle: "Oracle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--ds-sp-2) var(--ds-sp-3)",
  border: "1px solid var(--ds-border)",
  borderRadius: "var(--ds-r-6)",
  background: "var(--ds-surface-2)",
  color: "var(--ds-text)",
  fontSize: "var(--ds-fs-13)",
  outline: "none",
  fontFamily: "var(--ds-font-sans)",
  boxSizing: "border-box",
};

function EditConnectionForm({
  conn,
  onClose,
}: {
  conn: Connection;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: conn.name,
    host: conn.host ?? "",
    port: conn.port ? String(conn.port) : "",
    database: conn.database,
    username: conn.username ?? "",
    password: "",
    ssl: conn.ssl,
  });
  const update = useUpdateConnection();

  function set(key: string, value: string | boolean) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    update.mutate({
      id: conn.id,
      config: {
        name: form.name || undefined,
        host: form.host || undefined,
        port: form.port ? parseInt(form.port, 10) : undefined,
        database: form.database || undefined,
        username: form.username || undefined,
        password: form.password || undefined,
        ssl: form.ssl,
      },
    });
    onClose();
  }

  return (
    <Card padding="var(--ds-sp-4)" style={{ marginTop: "var(--ds-sp-3)", border: "1px solid var(--ds-accent)" }}>
      <CardHead
        title={`연결 편집 — ${conn.name}`}
        actions={<Button variant="ghost" size="sm" icon={<X size={13} />} onClick={onClose}>닫기</Button>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-3)", marginTop: "var(--ds-sp-3)" }}>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>이름</label>
          <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>호스트</label>
          <input style={inputStyle} value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="db.example.com" />
        </div>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>포트</label>
          <input style={{ ...inputStyle, fontFamily: "var(--ds-font-mono)" }} value={form.port} onChange={(e) => set("port", e.target.value)} placeholder="5432" />
        </div>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>데이터베이스</label>
          <input style={inputStyle} value={form.database} onChange={(e) => set("database", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>사용자명</label>
          <input style={inputStyle} value={form.username} onChange={(e) => set("username", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", display: "block", marginBottom: 4 }}>비밀번호 (변경 시만 입력)</label>
          <input style={inputStyle} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", marginTop: "var(--ds-sp-3)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text)" }}>
          <input type="checkbox" checked={form.ssl} onChange={(e) => set("ssl", e.target.checked)} />
          SSL 활성화
        </label>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
        <Button variant="accent" size="sm" loading={update.isPending} onClick={handleSave} disabled={!form.name || !form.database}>
          저장
        </Button>
      </div>
    </Card>
  );
}

interface ConnTestFeedback {
  status: "success" | "error";
  latencyMs?: number;
  serverVersion?: string;
  message?: string;
}

export default function ConnectionsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const activeConnectionId = useWorkspaceStore((s) => s.activeConnectionId);
  const [testFeedback, setTestFeedback] = useState<Record<string, ConnTestFeedback>>({});
  const { data: connections, isLoading, isError, error } = useConnections();
  const testMutation = useTestConnection();
  const queryClient = useQueryClient();
  const feedbackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  function scheduleFeedbackClear(id: string) {
    if (feedbackTimers.current[id]) {
      clearTimeout(feedbackTimers.current[id]);
    }
    feedbackTimers.current[id] = setTimeout(() => {
      setTestFeedback((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete feedbackTimers.current[id];
    }, 5000);
  }

  function handleTest(id: string) {
    if (feedbackTimers.current[id]) {
      clearTimeout(feedbackTimers.current[id]);
      delete feedbackTimers.current[id];
    }
    setTestFeedback((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    testMutation.mutate(id, {
      onSuccess: (data) => {
        setTestFeedback((prev) => ({
          ...prev,
          [id]: {
            status: data.ok ? "success" : "error",
            latencyMs: data.latencyMs,
            serverVersion: data.serverVersion,
          },
        }));
        void queryClient.invalidateQueries({ queryKey: ["connections"] });
        scheduleFeedbackClear(id);
      },
      onError: (err) => {
        setTestFeedback((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            message: err instanceof Error ? err.message : "연결 실패",
          },
        }));
        void queryClient.invalidateQueries({ queryKey: ["connections"] });
        scheduleFeedbackClear(id);
      },
    });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "삭제에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

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
                    {["이름", "종류", "호스트", "포트", "데이터베이스", "마지막 테스트", "상태", ""].map(
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
                    const feedback = testFeedback[conn.id];
                    return (
                      <tr
                        key={conn.id}
                        className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
                        style={{ borderBottom: "1px solid var(--ds-border)" }}
                      >
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
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
                            {activeConnectionId === conn.id && (
                              <Pill variant="success" dot="ok">활성</Pill>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexWrap: "wrap" }}>
                            <Pill variant="default">
                              {dialectLabels[conn.type] ?? conn.type}
                            </Pill>
                            {conn.ssl && (
                              <Pill variant="success">SSL</Pill>
                            )}
                          </div>
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
                            className="ds-mono"
                            style={{
                              fontSize: "var(--ds-fs-12)",
                              color: "var(--ds-text-mute)",
                            }}
                          >
                            {conn.port ?? "—"}
                          </span>
                        </td>
                        <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                          <span
                            className="ds-mono"
                            style={{
                              fontSize: "var(--ds-fs-12)",
                              color: "var(--ds-text-mute)",
                            }}
                          >
                            {conn.database ?? "—"}
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
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
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
                                연결 정상
                              </Pill>
                            ) : conn.lastTestedOk === false ? (
                              <Pill variant="danger" dot="err">
                                연결 실패
                              </Pill>
                            ) : (
                              <Pill variant="default">테스트 안함</Pill>
                            )}
                            {feedback && !isTesting && (
                              <span
                                style={{
                                  fontSize: "var(--ds-fs-11)",
                                  color: feedback.status === "success" ? "var(--ds-success)" : "var(--ds-danger)",
                                  fontFamily: "var(--ds-font-mono)",
                                }}
                              >
                                {feedback.status === "success"
                                  ? `${typeof feedback.latencyMs === "number" ? `${feedback.latencyMs}ms` : ""}${feedback.serverVersion ? ` · ${feedback.serverVersion}` : ""}`.trim() || "OK"
                                  : feedback.message ?? "연결 실패"}
                              </span>
                            )}
                          </div>
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
                              icon={<Pencil size={12} />}
                              onClick={() => setEditingConn(editingConn?.id === conn.id ? null : conn)}
                            >
                              편집
                            </Button>
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
                              onClick={() => handleTest(conn.id)}
                            >
                              {isTesting ? "테스트 중" : "재테스트"}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={12} />}
                              disabled={deleteMutation.isPending && deleteMutation.variables === conn.id}
                              onClick={() => setDeleteConfirmId(conn.id)}
                            >
                              삭제
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

        {editingConn && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--ds-sp-4)" }}
            onClick={() => setEditingConn(null)}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
              <EditConnectionForm conn={editingConn} onClose={() => setEditingConn(null)} />
            </div>
          </div>
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

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-5)", minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>연결 삭제</div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>이 연결을 삭제하시겠습니까? 연관된 저장 쿼리에 영향을 줄 수 있습니다.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>취소</Button>
              <Button variant="danger" size="sm" onClick={() => { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); }}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
