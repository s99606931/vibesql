"use client";

import { useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { AICallout } from "@/components/ui-vs/AICallout";
import { Plus, RefreshCw, Trash2, Check, X, Loader2 } from "lucide-react";

type DBDialect = "postgres" | "mysql" | "sqlite" | "mssql" | "oracle";
type ConnStatus = "connected" | "error" | "testing" | "idle";
type WizardStep = "form" | "test" | "scan";

const dialectLabels: Record<DBDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
  oracle: "Oracle",
};

interface Connection {
  id: string;
  name: string;
  dialect: DBDialect;
  host: string;
  lastUsed: string;
  status: ConnStatus;
}

const mockConnections: Connection[] = [
  { id: "1", name: "prod_analytics", dialect: "postgres", host: "db.example.com", lastUsed: "방금 전", status: "connected" },
  { id: "2", name: "local_dev", dialect: "sqlite", host: "local", lastUsed: "3시간 전", status: "connected" },
  { id: "3", name: "legacy_mysql", dialect: "mysql", host: "mysql.old.com", lastUsed: "2일 전", status: "error" },
];

function NewConnectionWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>("form");
  const [form, setForm] = useState({ name: "", dialect: "postgres" as DBDialect, host: "", port: "5432", db: "", user: "", password: "" });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  function handleTest() {
    setTestStatus("testing");
    setTimeout(() => setTestStatus("ok"), 1500);
  }

  function handleNext() {
    if (step === "form") { setStep("test"); handleTest(); }
    else if (step === "test") setStep("scan");
    else onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--ds-z-modal)",
        padding: "var(--ds-sp-6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--ds-surface)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-10)",
          padding: "var(--ds-sp-6)",
          width: "100%",
          maxWidth: 520,
          boxShadow: "var(--ds-shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Steps */}
        <div style={{ display: "flex", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-5)", alignItems: "center" }}>
          {(["form", "test", "scan"] as WizardStep[]).map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
              <div
                style={{
                  width: 20, height: 20,
                  borderRadius: "var(--ds-r-full)",
                  background: step === s ? "var(--ds-accent)" : "var(--ds-fill)",
                  color: step === s ? "var(--ds-accent-on)" : "var(--ds-text-mute)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--ds-fs-10)",
                  fontWeight: "var(--ds-fw-semibold)",
                }}
              >{i + 1}</div>
              <span style={{ fontSize: "var(--ds-fs-12)", color: step === s ? "var(--ds-text)" : "var(--ds-text-faint)" }}>
                {s === "form" ? "연결 정보" : s === "test" ? "테스트" : "스키마 분석"}
              </span>
              {i < 2 && <div style={{ width: 24, height: 1, background: "var(--ds-border)" }} />}
            </div>
          ))}
        </div>

        {step === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            <h2 className="ds-h4">새 연결 추가</h2>

            <div>
              <label className="ds-label">연결 이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="prod_analytics"
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)" }}
              />
            </div>

            <div>
              <label className="ds-label">DB 종류</label>
              <select
                value={form.dialect}
                onChange={(e) => setForm({ ...form, dialect: e.target.value as DBDialect })}
                style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)" }}
              >
                {Object.entries(dialectLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--ds-sp-2)" }}>
              <div>
                <label className="ds-label">호스트</label>
                <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="db.example.com" style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-mono)" }} />
              </div>
              <div style={{ width: 80 }}>
                <label className="ds-label">포트</label>
                <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="5432" style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-mono)" }} />
              </div>
            </div>

            <div>
              <label className="ds-label">데이터베이스</label>
              <input value={form.db} onChange={(e) => setForm({ ...form, db: e.target.value })} placeholder="analytics" style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-mono)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-2)" }}>
              <div>
                <label className="ds-label">사용자</label>
                <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="readonly_user" style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-mono)" }} />
              </div>
              <div>
                <label className="ds-label">비밀번호</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={{ width: "100%", padding: "var(--ds-sp-2) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", outline: "none", fontFamily: "var(--ds-font-sans)" }} />
              </div>
            </div>

            <AICallout label="◆ 보안 안내">
              자격증명은 KMS로 암호화하여 저장됩니다. 데이터 행은 AI에 전송되지 않습니다.
            </AICallout>
          </div>
        )}

        {step === "test" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            <h2 className="ds-h4">연결 테스트</h2>
            {testStatus === "testing" && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-13)" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                연결 중...
              </div>
            )}
            {testStatus === "ok" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
                {["연결 성공 — PostgreSQL 16.2", "읽기 권한 OK", "47개 테이블 발견"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", fontSize: "var(--ds-fs-13)", color: "var(--ds-success)" }}>
                    <Check size={14} />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            <h2 className="ds-h4">스키마 분석</h2>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--ds-sp-2)" }}>
                <span style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>47개 테이블 중 32개 분석 완료…</span>
                <span className="ds-num" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>68%</span>
              </div>
              <div style={{ height: 4, background: "var(--ds-fill)", borderRadius: "var(--ds-r-full)", overflow: "hidden" }}>
                <div style={{ width: "68%", height: "100%", background: "var(--ds-accent)", borderRadius: "var(--ds-r-full)" }} />
              </div>
            </div>
            <AICallout label="◆ AI · 스키마 분석 결과" tone="accent">
              주요 도메인: 주문(orders), 고객(customers), 결제(payments). PII 컬럼 12개 감지 — 마스킹 권장.
            </AICallout>
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end", marginTop: "var(--ds-sp-5)" }}>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleNext}>
            {step === "scan" ? "워크스페이스로 →" : "다음"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [connections] = useState<Connection[]>(mockConnections);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="연결"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "연결" }]}
        actions={
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowWizard(true)}>
            새 연결
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Connection table */}
        <Card padding={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ds-fill)" }}>
                  {["이름", "종류", "호스트", "마지막 사용", "상태", ""].map((col) => (
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
                        fontWeight: "var(--ds-fw-semibold)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr key={conn.id} className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                    <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                      <span style={{ fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>
                        {conn.name}
                      </span>
                    </td>
                    <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                      <Pill variant="default">{dialectLabels[conn.dialect]}</Pill>
                    </td>
                    <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                      <span className="ds-mono" style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)" }}>{conn.host}</span>
                    </td>
                    <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                      <span style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)" }}>{conn.lastUsed}</span>
                    </td>
                    <td style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
                      {conn.status === "connected"
                        ? <Pill variant="success" dot="ok">연결됨</Pill>
                        : <Pill variant="danger" dot="err">오류</Pill>
                      }
                    </td>
                    <td style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)" }}>
                      <div style={{ display: "flex", gap: "var(--ds-sp-1)", justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />}>재테스트</Button>
                        <Button variant="danger" size="sm" icon={<Trash2 size={12} />}>삭제</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {connections.length === 0 && (
          <Card dashed style={{ marginTop: "var(--ds-sp-4)", textAlign: "center", padding: "var(--ds-sp-10)" }}>
            <div style={{ color: "var(--ds-text-faint)", marginBottom: "var(--ds-sp-3)", fontSize: "var(--ds-fs-14)" }}>
              연결된 DB가 없습니다
            </div>
            <Button variant="accent" icon={<Plus size={13} />} onClick={() => setShowWizard(true)}>
              첫 연결 추가하기
            </Button>
          </Card>
        )}
      </div>

      {showWizard && <NewConnectionWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
