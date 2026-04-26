"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  Palette,
  Cpu,
  ShieldCheck,
  Bell,
  Sun,
  Moon,
  Check,
  Plus,
  Trash2,
  Play,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─── AI Provider types ────────────────────────────────────────────────────────

type AiProviderType = "anthropic" | "openai" | "google" | "lmstudio" | "ollama" | "vllm" | "openai_compat";

interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
  baseUrl?: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  hasApiKey?: boolean;
  lastTestedAt?: string | null;
  lastTestedOk?: boolean | null;
}

const PROVIDER_LABELS: Record<AiProviderType, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google AI",
  lmstudio: "LM Studio",
  ollama: "Ollama",
  vllm: "vLLM",
  openai_compat: "OpenAI 호환",
};

const DEFAULT_MODELS: Record<AiProviderType, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-1.5-pro",
  lmstudio: "local-model",
  ollama: "llama3",
  vllm: "local-model",
  openai_compat: "local-model",
};

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

type Section = "appearance" | "ai" | "security" | "notifications";

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "appearance", label: "외관", icon: <Palette size={15} /> },
  { id: "ai", label: "AI 설정", icon: <Cpu size={15} /> },
  { id: "security", label: "보안", icon: <ShieldCheck size={15} /> },
  { id: "notifications", label: "알림", icon: <Bell size={15} /> },
];

// ─── Reusable Toggle ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
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

// ─── AI Provider add form ────────────────────────────────────────────────────

function AddProviderForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<AiProviderType>("anthropic");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleTypeChange(t: AiProviderType) {
    setType(t);
    setModel(DEFAULT_MODELS[t]);
    setBaseUrl("");
  }

  async function handleSave() {
    if (!name.trim() || !model.trim()) { setError("이름과 모델명은 필수입니다."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined, model, temperature: 0.3, maxTokens: 2048, isActive }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? "저장 실패"); return; }
      onAdded();
    } catch { setError("네트워크 오류"); } finally { setSaving(false); }
  }

  const needsBaseUrl = ["lmstudio", "ollama", "vllm", "openai_compat"].includes(type);

  return (
    <div style={{ border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-4)", background: "var(--ds-fill)", marginTop: "var(--ds-sp-3)" }}>
      <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>새 AI 프로바이더 추가</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-3)" }}>
        <div>
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: 4 }}>종류</div>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value as AiProviderType)} style={{ width: "100%", padding: "var(--ds-sp-1) var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-sans)", outline: "none" }}>
            {(Object.keys(PROVIDER_LABELS) as AiProviderType[]).map((t) => (
              <option key={t} value={t}>{PROVIDER_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: 4 }}>이름</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="프로바이더 이름" style={{ width: "100%", padding: "var(--ds-sp-1) var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-sans)", outline: "none" }} />
        </div>
        <div>
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: 4 }}>모델</div>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="모델 ID" style={{ width: "100%", padding: "var(--ds-sp-1) var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-mono)", outline: "none" }} />
        </div>
        <div>
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: 4 }}>API 키 (선택)</div>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." style={{ width: "100%", padding: "var(--ds-sp-1) var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-mono)", outline: "none" }} />
        </div>
        {needsBaseUrl && (
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)", marginBottom: 4 }}>Base URL</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234" style={{ width: "100%", padding: "var(--ds-sp-1) var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", fontFamily: "var(--ds-font-mono)", outline: "none" }} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-3)" }}>
        <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <label htmlFor="isActive" style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", cursor: "pointer" }}>기본 AI로 활성화</label>
      </div>
      {error && <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-danger)", marginBottom: "var(--ds-sp-2)" }}>{error}</div>}
      <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
        <Button variant="accent" size="sm" loading={saving} onClick={handleSave}>저장</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("appearance");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
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

  // AI Providers
  const { data: providers = [], isLoading: providersLoading } = useQuery<AiProvider[]>({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const res = await fetch("/api/ai-providers");
      if (!res.ok) return [];
      const j = await res.json() as { data: AiProvider[] };
      return Array.isArray(j.data) ? j.data : [];
    },
    staleTime: 30_000,
    enabled: activeSection === "ai",
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/ai-providers/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });

  async function handleTestProvider(id: string) {
    setTestingId(id);
    try {
      const r = await fetch(`/api/ai-providers/${id}/test`, { method: "POST" });
      await r.json();
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    } finally { setTestingId(null); }
  }

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
            <span style={{ fontSize: "var(--ds-fs-12)", color: saveStatus === "saved" ? "var(--ds-success)" : "var(--ds-text-faint)" }}>
              {saveStatus === "saving" ? "저장 중..." : "저장됨"}
            </span>
          ) : undefined
        }
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <nav
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
                {item.icon}
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
                          {selected && <Check size={14} color="#fff" />}
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
                    {mode === "dark" ? <Moon size={13} /> : <Sun size={13} />}
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
              </Card>
            </>
          )}

          {/* ── AI SETTINGS ────────────────────────────────────────────────── */}
          {activeSection === "ai" && (
            <>
              <Card>
                <CardHead title="AI 설정" />

                <SettingRow label="기본 SQL 방언" description="AI가 생성하는 SQL의 기본 방언">
                  <select
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

                <SettingRow label="SQL 생성 온도" description={`창의성 수준을 조정합니다 — 현재: ${temperature.toFixed(1)}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>0.0</span>
                    <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => { setTemperature(Number(e.target.value)); persistSettings(); }} style={{ accentColor: "var(--ds-accent)", width: 120, cursor: "pointer" }} />
                    <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>1.0</span>
                    <span className="ds-num" style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-accent)", fontWeight: "var(--ds-fw-semibold)", minWidth: 24, textAlign: "right" }}>{temperature.toFixed(1)}</span>
                  </div>
                </SettingRow>

                <SettingRow label="항상 결과 설명 포함" description="AI가 쿼리 결과를 자동으로 설명합니다" last>
                  <Toggle checked={alwaysExplain} onChange={() => { toggle("alwaysExplain"); persistSettings(); }} />
                </SettingRow>
              </Card>

              {/* AI Providers */}
              <Card>
                <CardHead
                  title="AI 프로바이더"
                  meta={`${providers.length}개`}
                  actions={
                    <Button variant="accent" size="sm" icon={<Plus size={12} />} onClick={() => setShowAddProvider((v) => !v)}>
                      {showAddProvider ? "취소" : "추가"}
                    </Button>
                  }
                />
                {showAddProvider && (
                  <AddProviderForm
                    onClose={() => setShowAddProvider(false)}
                    onAdded={() => { setShowAddProvider(false); queryClient.invalidateQueries({ queryKey: ["ai-providers"] }); }}
                  />
                )}
                {providersLoading && (
                  <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", padding: "var(--ds-sp-2)" }}>불러오는 중...</div>
                )}
                {!providersLoading && providers.length === 0 && !showAddProvider && (
                  <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", padding: "var(--ds-sp-2) 0" }}>
                    AI 프로바이더가 없습니다. Anthropic, OpenAI, Ollama 등을 추가하세요.
                  </div>
                )}
                {providers.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", padding: "var(--ds-sp-3) 0", borderTop: "1px solid var(--ds-border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: 2 }}>
                        <span style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>{p.name}</span>
                        {p.isActive && <Pill variant="success">활성</Pill>}
                      </div>
                      <div style={{ display: "flex", gap: "var(--ds-sp-2)", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)" }}>{PROVIDER_LABELS[p.type]}</span>
                        <span className="ds-mono" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{p.model}</span>
                        {p.lastTestedOk === true && <Pill variant="success" dot="ok">테스트 성공</Pill>}
                        {p.lastTestedOk === false && <Pill variant="danger" dot="err">테스트 실패</Pill>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={testingId === p.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={11} />}
                        disabled={testingId === p.id}
                        onClick={() => handleTestProvider(p.id)}
                      >
                        테스트
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={11} />}
                        disabled={deleteProviderMutation.isPending && deleteProviderMutation.variables === p.id}
                        onClick={() => { if (confirm(`"${p.name}" 프로바이더를 삭제할까요?`)) deleteProviderMutation.mutate(p.id); }}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
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
                  onChange={() => { toggle("notifySuccess"); persistSettings(); }}
                />
              </SettingRow>

              <SettingRow
                label="쿼리 오류 알림"
                description="쿼리 실행 중 오류가 발생하면 알림을 표시합니다"
              >
                <Toggle
                  checked={notifyError}
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
                  onChange={() => { toggle("notifyLong"); persistSettings(); }}
                />
              </SettingRow>
            </Card>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
