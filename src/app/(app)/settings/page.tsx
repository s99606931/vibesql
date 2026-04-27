"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useIsAdmin } from "@/hooks/useCurrentUser";
import {
  Palette,
  Cpu,
  ShieldCheck,
  Bell,
  Sun,
  Moon,
  Check,
  ArrowRight,
  Keyboard,
} from "lucide-react";

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

type Section = "appearance" | "ai" | "security" | "notifications" | "shortcuts";

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "appearance", label: "외관", icon: <Palette size={15} /> },
  { id: "ai", label: "AI 환경설정", icon: <Cpu size={15} /> },
  { id: "security", label: "보안", icon: <ShieldCheck size={15} /> },
  { id: "notifications", label: "알림", icon: <Bell size={15} /> },
  { id: "shortcuts", label: "단축키", icon: <Keyboard size={15} /> },
];

// ─── Reusable Toggle ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 38,
        height: 22,
        borderRadius: "var(--ds-r-full)",
        border: "none",
        background: checked ? "var(--ds-accent)" : "var(--ds-fill)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background var(--ds-dur-fast) var(--ds-ease)",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 16,
          height: 16,
          borderRadius: "var(--ds-r-full)",
          background: "var(--ds-bg)",
          position: "absolute",
          top: 3,
          left: checked ? 19 : 3,
          transition: "left var(--ds-dur-fast) var(--ds-ease)",
        }}
      />
    </button>
  );
}

// ─── Row wrapper ─────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
  last,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--ds-sp-4)",
        paddingBottom: last ? 0 : "var(--ds-sp-4)",
        marginBottom: last ? 0 : "var(--ds-sp-4)",
        borderBottom: last ? "none" : "1px solid var(--ds-border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--ds-fs-13)",
            color: "var(--ds-text)",
            fontWeight: "var(--ds-fw-medium)",
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-faint)",
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ─── Theme preview tile ───────────────────────────────────────────────────────

const THEMES: {
  id: "indigo" | "emerald" | "amber" | "rose" | "slate";
  label: string;
  accent: string;
}[] = [
  { id: "indigo", label: "Indigo", accent: "#6366f1" },
  { id: "emerald", label: "Emerald", accent: "#10b981" },
  { id: "amber", label: "Amber", accent: "#f59e0b" },
  { id: "rose", label: "Rose", accent: "#f43f5e" },
  { id: "slate", label: "Slate", accent: "#64748b" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("appearance");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdmin = useIsAdmin();
  const {
    theme, mode, density,
    dialect, temperature, alwaysExplain,
    readOnly, sessionTimeout,
    notifySuccess, notifyError, notifyLong,
    setTheme, setMode, setDensity,
    setDialect, setTemperature, setSessionTimeout,
    toggle,
  } = useSettingsStore();

  // Load settings from DB on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const s = json.data;
        if (s.theme && s.theme !== theme) setTheme(s.theme);
        if (s.defaultDialect && s.defaultDialect !== dialect) setDialect(s.defaultDialect);
        if (s.aiTemperature != null && s.aiTemperature !== temperature) setTemperature(s.aiTemperature);
        if (s.showExplanation != null && s.showExplanation !== alwaysExplain) toggle("alwaysExplain");
        if (s.sessionTimeout != null && s.sessionTimeout !== sessionTimeout) setSessionTimeout(s.sessionTimeout);
      })
      .catch(() => { /* DB not configured — use localStorage only */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save to DB whenever settings change
  function persistSettings() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme,
            defaultDialect: dialect,
            aiTemperature: temperature,
            showExplanation: alwaysExplain,
            sessionTimeout,
            showSqlPreview: true,
            notifySuccess,
            notifyError,
            notifyLong,
          }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 800);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="설정"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "설정" }]}
        actions={
          saveStatus !== "idle" ? (
            <span role="status" aria-live="polite" style={{ fontSize: "var(--ds-fs-12)", color: saveStatus === "saved" ? "var(--ds-success)" : "var(--ds-text-faint)" }}>
              {saveStatus === "saving" ? "저장 중..." : "저장됨"}
            </span>
          ) : undefined
        }
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <nav
          aria-label="설정 탐색"
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid var(--ds-border)",
            padding: "var(--ds-sp-4) var(--ds-sp-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-1)",
            overflowY: "auto",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-2)",
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  borderRadius: "var(--ds-r-6)",
                  border: "none",
                  background: active ? "var(--ds-accent-soft)" : "transparent",
                  color: active ? "var(--ds-accent)" : "var(--ds-text-mute)",
                  fontSize: "var(--ds-fs-13)",
                  fontWeight: active ? "var(--ds-fw-semibold)" : "var(--ds-fw-normal)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--ds-sp-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-4)",
          }}
        >
          {/* ── APPEARANCE ─────────────────────────────────────────────────── */}
          {activeSection === "appearance" && (
            <>
              <Card>
                <CardHead title="테마 색상" />

                {/* Theme tiles */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--ds-sp-3)",
                    flexWrap: "wrap",
                    marginBottom: "var(--ds-sp-5)",
                  }}
                >
                  {THEMES.map((t) => {
                    const selected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={t.label + " 테마"}
                        onClick={() => { setTheme(t.id); persistSettings(); }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "var(--ds-sp-2)",
                          padding: "var(--ds-sp-3)",
                          border: selected
                            ? `2px solid ${t.accent}`
                            : "2px solid var(--ds-border)",
                          borderRadius: "var(--ds-r-8)",
                          background: "var(--ds-bg)",
                          cursor: "pointer",
                          minWidth: 72,
                          transition: "border-color var(--ds-dur-fast) var(--ds-ease)",
                          fontFamily: "var(--ds-font-sans)",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "var(--ds-r-full)",
                            background: t.accent,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {selected && <Check aria-hidden="true" size={14} color="var(--ds-accent-on)" />}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--ds-fs-11)",
                            color: selected ? "var(--ds-text)" : "var(--ds-text-mute)",
                            fontWeight: selected ? "var(--ds-fw-semibold)" : "var(--ds-fw-normal)",
                          }}
                        >
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Preview card */}
                <div
                  data-theme={theme}
                  data-mode={mode}
                  style={{
                    border: "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-8)",
                    padding: "var(--ds-sp-3) var(--ds-sp-4)",
                    background: "var(--ds-surface)",
                    marginBottom: "var(--ds-sp-4)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-faint)",
                      marginBottom: "var(--ds-sp-2)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: "var(--ds-fw-semibold)",
                    }}
                  >
                    테마 미리보기
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                    <Pill variant="accent">액센트</Pill>
                    <Pill variant="success" dot="ok">성공</Pill>
                    <Pill variant="danger" dot="err">오류</Pill>
                    <Pill variant="warn">경고</Pill>
                    <span
                      style={{
                        fontSize: "var(--ds-fs-13)",
                        color: "var(--ds-text)",
                        marginLeft: "var(--ds-sp-2)",
                      }}
                    >
                      텍스트 샘플
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHead title="모드 및 밀도" />
                <SettingRow
                  label="다크 모드"
                  description="밝기 모드를 전환합니다"
                >
                  <button
                    type="button"
                    aria-pressed={mode === "dark"}
                    aria-label={mode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                    onClick={() => { setMode(mode === "dark" ? "light" : "dark"); persistSettings(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--ds-sp-2)",
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
                    {mode === "dark" ? <Moon aria-hidden="true" size={13} /> : <Sun aria-hidden="true" size={13} />}
                    {mode === "dark" ? "다크" : "라이트"}
                  </button>
                </SettingRow>

                <SettingRow
                  label="밀도"
                  description="UI 요소 간격을 조정합니다"
                  last
                >
                  <div style={{ display: "flex", gap: "var(--ds-sp-1)" }}>
                    {(["compact", "regular", "comfy"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={density === d}
                        aria-label={d === "compact" ? "컴팩트 밀도" : d === "regular" ? "보통 밀도" : "넓은 밀도"}
                        onClick={() => { setDensity(d); persistSettings(); }}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid var(--ds-border)",
                          borderRadius: "var(--ds-r-6)",
                          background: density === d ? "var(--ds-accent-soft)" : "var(--ds-surface)",
                          color: density === d ? "var(--ds-accent)" : "var(--ds-text-mute)",
                          fontSize: "var(--ds-fs-12)",
                          cursor: "pointer",
                          fontFamily: "var(--ds-font-sans)",
                          fontWeight: density === d ? "var(--ds-fw-semibold)" : "var(--ds-fw-normal)",
                        }}
                      >
                        {d === "compact" ? "컴팩트" : d === "regular" ? "보통" : "넓게"}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <div
                  style={{
                    marginTop: "var(--ds-sp-3)",
                    border: "1px dashed var(--ds-border)",
                    borderRadius: "var(--ds-r-8)",
                    padding: density === "compact" ? "var(--ds-sp-2) var(--ds-sp-3)" : density === "comfy" ? "var(--ds-sp-5) var(--ds-sp-5)" : "var(--ds-sp-3) var(--ds-sp-4)",
                    background: "var(--ds-fill)",
                    transition: "padding var(--ds-dur-fast) var(--ds-ease)",
                  }}
                >
                  <div style={{ fontSize: density === "compact" ? "var(--ds-fs-11)" : density === "comfy" ? "var(--ds-fs-14)" : "var(--ds-fs-13)", color: "var(--ds-text)", marginBottom: density === "compact" ? 2 : density === "comfy" ? 6 : 4, fontWeight: "var(--ds-fw-medium)" }}>미리보기 — 쿼리 결과 행</div>
                  <div style={{ fontSize: density === "compact" ? "var(--ds-fs-11)" : density === "comfy" ? "var(--ds-fs-14)" : "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-mono)" }}>SELECT * FROM users WHERE active = true</div>
                </div>
              </Card>
            </>
          )}

          {/* ── AI SETTINGS ────────────────────────────────────────────────── */}
          {activeSection === "ai" && (
            <>
              <Card>
                <CardHead title="AI 환경설정" />

                <SettingRow label="기본 SQL 방언" description="AI가 생성하는 SQL의 기본 방언">
                  <select
                    aria-label="기본 SQL 방언"
                    value={dialect}
                    onChange={(e) => {
                      setDialect(e.target.value as "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle");
                      persistSettings();
                    }}
                    style={{ padding: "var(--ds-sp-1) var(--ds-sp-3)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-sans)", cursor: "pointer", outline: "none", minWidth: 130 }}
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                    <option value="mssql">MS SQL Server</option>
                    <option value="oracle">Oracle</option>
                  </select>
                </SettingRow>

                <SettingRow label="SQL 생성 온도" description={`낮을수록 정확·보수적, 높을수록 창의적·다양한 SQL 생성 — 현재: ${temperature.toFixed(1)}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }} title="정확·보수적">정확</span>
                    <input type="range" aria-label="SQL 생성 온도" min={0} max={1} step={0.1} value={temperature} onChange={(e) => { setTemperature(Number(e.target.value)); persistSettings(); }} style={{ accentColor: "var(--ds-accent)", width: 120, cursor: "pointer" }} />
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }} title="창의적·다양">창의</span>
                    <span className="ds-num" style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-accent)", fontWeight: "var(--ds-fw-semibold)", minWidth: 24, textAlign: "right" }}>{temperature.toFixed(1)}</span>
                  </div>
                </SettingRow>

                <SettingRow label="항상 결과 설명 포함" description="AI가 쿼리 결과를 자동으로 설명합니다" last>
                  <Toggle checked={alwaysExplain} label="항상 결과 설명 포함" onChange={() => { toggle("alwaysExplain"); persistSettings(); }} />
                </SettingRow>
              </Card>

              <Card>
                <CardHead title="AI 프로바이더" />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--ds-sp-4)",
                    padding: "var(--ds-sp-2) 0",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>
                      {isAdmin ? "AI 프로바이더 설정" : "사용 중인 AI"}
                    </div>
                    <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                      {isAdmin
                        ? "Anthropic, OpenAI, Ollama 등 AI 모델 연결을 관리합니다"
                        : "현재 Claude (Anthropic) AI로 SQL을 생성합니다. 관리자가 프로바이더를 변경할 수 있습니다."}
                    </div>
                  </div>
                  {isAdmin && (
                    <Link href="/ai-providers" style={{ textDecoration: "none" }}>
                      <Button variant="ghost" size="sm">
                        관리 페이지로
                        <ArrowRight aria-hidden="true" size={13} style={{ marginLeft: 4 }} />
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ── SECURITY ───────────────────────────────────────────────────── */}
          {activeSection === "security" && (
            <Card>
              <CardHead title="보안" />

              <SettingRow
                label="세션 타임아웃"
                description="비활성 후 자동 로그아웃까지의 시간(분)"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                  <select
                    aria-label="자동 로그아웃 시간"
                    value={sessionTimeout}
                    onChange={(e) => { setSessionTimeout(Number(e.target.value)); persistSettings(); }}
                    style={{
                      padding: "var(--ds-sp-1) var(--ds-sp-3)",
                      border: "1px solid var(--ds-border)",
                      borderRadius: "var(--ds-r-6)",
                      background: "var(--ds-surface)",
                      color: "var(--ds-text)",
                      fontSize: "var(--ds-fs-12)",
                      fontFamily: "var(--ds-font-sans)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value={15}>15분</option>
                    <option value={30}>30분</option>
                    <option value={60}>1시간</option>
                    <option value={120}>2시간</option>
                    <option value={0}>없음</option>
                  </select>
                </div>
              </SettingRow>

              <SettingRow
                label="읽기 전용 모드만 허용"
                description="SELECT 쿼리만 실행 허용 — 데이터 변경 방지"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                  <Toggle
                    checked={readOnly}
                    label="읽기 전용 모드만 허용"
                    onChange={() => toggle("readOnly")}
                    disabled
                  />
                  <Pill variant="warn">항상 켜짐</Pill>
                </div>
              </SettingRow>

              <SettingRow label="API 키" description="Anthropic API 키는 서버 환경변수(ANTHROPIC_API_KEY)로 관리됩니다" last>
                <Pill variant="default">서버 환경변수로 설정됨</Pill>
              </SettingRow>
            </Card>
          )}

          {/* ── NOTIFICATIONS ──────────────────────────────────────────────── */}
          {activeSection === "notifications" && (
            <Card>
              <CardHead title="알림 설정" />

              <SettingRow
                label="쿼리 성공 알림"
                description="쿼리가 성공적으로 완료되면 알림을 표시합니다"
              >
                <Toggle
                  checked={notifySuccess}
                  label="쿼리 성공 알림"
                  onChange={() => { toggle("notifySuccess"); persistSettings(); }}
                />
              </SettingRow>

              <SettingRow
                label="쿼리 오류 알림"
                description="쿼리 실행 중 오류가 발생하면 알림을 표시합니다"
              >
                <Toggle
                  checked={notifyError}
                  label="쿼리 오류 알림"
                  onChange={() => { toggle("notifyError"); persistSettings(); }}
                />
              </SettingRow>

              <SettingRow
                label="장시간 실행 알림"
                description="쿼리가 5초 이상 실행되면 알림을 표시합니다"
                last
              >
                <Toggle
                  checked={notifyLong}
                  label="장시간 실행 알림"
                  onChange={() => { toggle("notifyLong"); persistSettings(); }}
                />
              </SettingRow>
            </Card>
          )}
          {/* ── SHORTCUTS ──────────────────────────────────────────────────── */}
          {activeSection === "shortcuts" && (
            <Card>
              <CardHead title="키보드 단축키" />
              {[
                { keys: ["⌘", "K"], desc: "명령 팔레트 열기", section: "전체" },
                { keys: ["⌘", "F"], desc: "현재 페이지 검색 포커스", section: "전체" },
                { keys: ["⌘", "Enter"], desc: "SQL 실행", section: "워크스페이스" },
                { keys: ["⌘", "S"], desc: "쿼리 저장", section: "워크스페이스" },
                { keys: ["Alt", "Enter"], desc: "자연어 쿼리 생성", section: "워크스페이스" },
                { keys: ["Esc"], desc: "모달 / 드롭다운 닫기", section: "전체" },
                { keys: ["Tab"], desc: "SQL 자동완성 수락", section: "SQL 에디터" },
                { keys: ["⌘", "Z"], desc: "실행 취소", section: "SQL 에디터" },
              ].map((row, i, arr) => (
                <div
                  key={row.desc}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--ds-sp-4)",
                    paddingBottom: i < arr.length - 1 ? "var(--ds-sp-3)" : 0,
                    marginBottom: i < arr.length - 1 ? "var(--ds-sp-3)" : 0,
                    borderBottom: i < arr.length - 1 ? "1px solid var(--ds-border)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>{row.desc}</div>
                    <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>{row.section}</div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--ds-sp-1)", alignItems: "center", flexShrink: 0 }}>
                    {row.keys.map((k, ki) => (
                      <span key={ki} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <kbd style={{ display: "inline-block", padding: "2px 7px", borderRadius: "var(--ds-r-6)", border: "1px solid var(--ds-border)", background: "var(--ds-fill)", fontSize: "var(--ds-fs-11)", color: "var(--ds-text)", fontFamily: "var(--ds-font-mono)", fontWeight: "var(--ds-fw-semibold)", lineHeight: 1.6 }}>{k}</kbd>
                        {ki < row.keys.length - 1 && <span style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)" }}>+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
      {/* Reset section */}
      <div style={{ padding: "var(--ds-sp-4) var(--ds-sp-6)", borderTop: "1px solid var(--ds-border)", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => {
            setTheme("indigo");
            setMode("dark");
            setDensity("regular");
            setDialect("postgresql");
            setTemperature(0.3);
            setSessionTimeout(30);
            if (!notifySuccess) toggle("notifySuccess");
            if (!notifyError) toggle("notifyError");
            if (notifyLong) toggle("notifyLong");
            if (alwaysExplain) toggle("alwaysExplain");
            persistSettings();
          }}
          style={{ padding: "var(--ds-sp-1) var(--ds-sp-4)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-fill)", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-12)", cursor: "pointer", fontFamily: "var(--ds-font-sans)" }}
        >
          설정 초기화 (기본값 복원)
        </button>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
