"use client";

import { useState } from "react";
import {
  useCreateConnection,
  useTestConnection,
  useScanConnection,
  type ConnectionConfig,
} from "@/hooks/useConnections";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Check, X, Loader2 } from "lucide-react";
import type { DbDialect } from "@/types";

type WizardStep = "form" | "test" | "scan";

const dialectLabels: Record<DbDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
  oracle: "Oracle",
};

const defaultPortByDialect: Record<DbDialect, string> = {
  postgresql: "5432",
  mysql: "3306",
  sqlite: "",
  mssql: "1433",
  oracle: "1521",
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

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--ds-font-mono)",
};

interface ConnectionWizardProps {
  onClose: () => void;
  /** Called after a successful create + test + scan flow */
  onDone?: () => void;
}

export function ConnectionWizard({ onClose, onDone }: ConnectionWizardProps) {
  const [step, setStep] = useState<WizardStep>("form");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    dialect: "postgresql" as DbDialect,
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    ssl: false,
  });

  const createMutation = useCreateConnection();
  const testMutation = useTestConnection();
  const scanMutation = useScanConnection();

  /* ── Step helpers ── */

  function updateDialect(d: DbDialect) {
    setForm((f) => ({ ...f, dialect: d, port: defaultPortByDialect[d] }));
  }

  async function handleNext() {
    if (step === "form") {
      const config: ConnectionConfig = {
        name: form.name,
        type: form.dialect,
        host: form.host || undefined,
        port: form.port ? Number(form.port) : undefined,
        database: form.database,
        username: form.username || undefined,
        password: form.password || undefined,
        ssl: form.ssl,
      };
      const conn = await createMutation.mutateAsync(config);
      setCreatedId(conn.id);
      await testMutation.mutateAsync(conn.id);
      setStep("test");
    } else if (step === "test") {
      if (createdId) {
        await scanMutation.mutateAsync(createdId);
      }
      setStep("scan");
    } else {
      onDone?.();
      onClose();
    }
  }

  const isBusy =
    createMutation.isPending ||
    testMutation.isPending ||
    scanMutation.isPending;

  const testData = testMutation.data;
  const scanData = scanMutation.data;

  const stepError =
    createMutation.error?.message ??
    testMutation.error?.message ??
    scanMutation.error?.message;

  const steps: WizardStep[] = ["form", "test", "scan"];
  const stepLabels: Record<WizardStep, string> = {
    form: "연결 정보",
    test: "테스트",
    scan: "스키마 분석",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--ds-z-modal)" as React.CSSProperties["zIndex"],
        padding: "var(--ds-sp-6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--ds-surface)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-10)" as React.CSSProperties["borderRadius"],
          padding: "var(--ds-sp-6)",
          width: "100%",
          maxWidth: 520,
          boxShadow: "var(--ds-shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicators */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-5)",
            alignItems: "center",
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s}
              style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "var(--ds-r-full)" as React.CSSProperties["borderRadius"],
                  background: step === s ? "var(--ds-accent)" : "var(--ds-fill)",
                  color:
                    step === s ? "var(--ds-accent-on)" : "var(--ds-text-mute)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--ds-fs-10)",
                  fontWeight: "var(--ds-fw-semibold)" as React.CSSProperties["fontWeight"],
                }}
              >
                {i + 1}
              </div>
              <span
                style={{
                  fontSize: "var(--ds-fs-12)",
                  color: step === s ? "var(--ds-text)" : "var(--ds-text-faint)",
                }}
              >
                {stepLabels[s]}
              </span>
              {i < steps.length - 1 && (
                <div
                  style={{ width: 24, height: 1, background: "var(--ds-border)" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Form ── */}
        {step === "form" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}
          >
            <h2 className="ds-h4">새 연결 추가</h2>

            <div>
              <label className="ds-label">연결 이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="prod_analytics"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="ds-label">DB 종류</label>
              <select
                value={form.dialect}
                onChange={(e) => updateDialect(e.target.value as DbDialect)}
                style={inputStyle}
              >
                {(Object.entries(dialectLabels) as [DbDialect, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>

            {form.dialect !== "sqlite" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 88px",
                  gap: "var(--ds-sp-2)",
                }}
              >
                <div>
                  <label className="ds-label">호스트</label>
                  <input
                    value={form.host}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, host: e.target.value }))
                    }
                    placeholder="db.example.com"
                    style={monoInputStyle}
                  />
                </div>
                <div>
                  <label className="ds-label">포트</label>
                  <input
                    value={form.port}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, port: e.target.value }))
                    }
                    placeholder="5432"
                    style={monoInputStyle}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="ds-label">데이터베이스</label>
              <input
                value={form.database}
                onChange={(e) =>
                  setForm((f) => ({ ...f, database: e.target.value }))
                }
                placeholder={form.dialect === "sqlite" ? "/path/to/file.db" : "analytics"}
                style={monoInputStyle}
              />
            </div>

            {form.dialect !== "sqlite" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--ds-sp-2)",
                }}
              >
                <div>
                  <label className="ds-label">사용자</label>
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="readonly_user"
                    style={monoInputStyle}
                  />
                </div>
                <div>
                  <label className="ds-label">비밀번호</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            <AICallout label="◆ 보안 안내">
              자격증명은 KMS로 암호화하여 저장됩니다. 데이터 행은 AI에 전송되지
              않습니다.
            </AICallout>
          </div>
        )}

        {/* ── Step 2: Test ── */}
        {step === "test" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}
          >
            <h2 className="ds-h4">연결 테스트</h2>

            {testMutation.isPending && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  color: "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-13)",
                }}
              >
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                연결 중...
              </div>
            )}

            {testMutation.isSuccess && testData && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}
              >
                {[
                  testData.serverVersion ? `연결 성공 — ${testData.serverVersion}` : "연결 성공",
                  `응답 속도: ${testData.latencyMs}ms`,
                  "읽기 권한 확인 완료",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-2)",
                      fontSize: "var(--ds-fs-13)",
                      color: "var(--ds-success)",
                    }}
                  >
                    <Check size={14} />
                    {item}
                  </div>
                ))}
              </div>
            )}

            {testMutation.isError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  fontSize: "var(--ds-fs-13)",
                  color: "var(--ds-danger)",
                }}
              >
                <X size={14} />
                {testMutation.error.message}
              </div>
            )}

            {testData && (
              <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
                <Pill variant="success" dot="ok">
                  연결됨
                </Pill>
                <Pill variant="default">{`${testData.latencyMs}ms`}</Pill>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Scan ── */}
        {step === "scan" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}
          >
            <h2 className="ds-h4">스키마 분석</h2>

            {scanMutation.isPending && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "var(--ds-sp-2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--ds-fs-12)",
                      color: "var(--ds-text-mute)",
                    }}
                  >
                    스키마 분석 중...
                  </span>
                  <Loader2
                    size={12}
                    style={{ animation: "spin 1s linear infinite", color: "var(--ds-text-faint)" }}
                  />
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--ds-fill)",
                    borderRadius: "var(--ds-r-full)" as React.CSSProperties["borderRadius"],
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "60%",
                      height: "100%",
                      background: "var(--ds-accent)",
                      borderRadius: "var(--ds-r-full)" as React.CSSProperties["borderRadius"],
                    }}
                  />
                </div>
              </div>
            )}

            {scanMutation.isSuccess && scanData && (
              <>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}
                >
                  <Check size={14} style={{ color: "var(--ds-success)" }} />
                  <span
                    style={{
                      fontSize: "var(--ds-fs-13)",
                      color: "var(--ds-success)",
                    }}
                  >
                    {`${scanData.tableCount}개 테이블 분석 완료`}
                  </span>
                </div>
                <AICallout label="◆ AI · 스키마 분석 결과" tone="accent">
                  {`${scanData.tableCount}개 테이블이 인덱싱되었습니다. 이제 자연어로 쿼리할 수 있습니다.`}
                </AICallout>
              </>
            )}

            {scanMutation.isError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  fontSize: "var(--ds-fs-13)",
                  color: "var(--ds-danger)",
                }}
              >
                <X size={14} />
                {scanMutation.error.message}
              </div>
            )}
          </div>
        )}

        {/* Global error (create failure on step 1→2 transition) */}
        {stepError && step !== "test" && step !== "scan" && (
          <div
            style={{
              marginTop: "var(--ds-sp-3)",
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-danger)",
            }}
          >
            <X size={12} />
            {stepError}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: "var(--ds-sp-2)",
            justifyContent: "flex-end",
            marginTop: "var(--ds-sp-5)",
          }}
        >
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            취소
          </Button>
          <Button
            variant="primary"
            loading={isBusy}
            onClick={() => void handleNext()}
            disabled={
              (step === "form" && (!form.name || !form.database)) ||
              (step === "test" && testMutation.isError) ||
              (step === "scan" && scanMutation.isError)
            }
          >
            {step === "scan" ? "워크스페이스로 →" : "다음"}
          </Button>
        </div>
      </div>
    </div>
  );
}
