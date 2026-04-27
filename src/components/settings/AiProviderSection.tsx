"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHead } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Pill } from "@/components/ui-vs/Pill";
import {
  Plus, Trash2, Zap, CheckCircle2, XCircle, Loader2, Settings2, ChevronDown, ChevronUp
} from "lucide-react";

// ── Provider metadata ────────────────────────────────────────────────────────

export type AiProviderType = "anthropic" | "openai" | "google" | "lmstudio" | "ollama" | "vllm" | "openai_compat";

const PROVIDER_META: Record<AiProviderType, {
  label: string;
  defaultBaseUrl?: string;
  defaultModel: string;
  needsBaseUrl: boolean;
  needsApiKey: boolean;
  models: string[];
}> = {
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-6",
    needsBaseUrl: false,
    needsApiKey: true,
    models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  },
  openai: {
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o",
    needsBaseUrl: false,
    needsApiKey: true,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  google: {
    label: "Google AI Studio (Gemini)",
    defaultModel: "gemini-1.5-pro",
    needsBaseUrl: false,
    needsApiKey: true,
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"],
  },
  lmstudio: {
    label: "LM Studio",
    defaultBaseUrl: "http://localhost:1234",
    defaultModel: "local-model",
    needsBaseUrl: true,
    needsApiKey: false,
    models: ["local-model"],
  },
  ollama: {
    label: "Ollama",
    defaultBaseUrl: "http://localhost:11434",
    defaultModel: "llama3.1",
    needsBaseUrl: true,
    needsApiKey: false,
    models: ["llama3.1", "llama3.1:70b", "mistral", "codellama", "deepseek-coder-v2", "qwen2.5-coder"],
  },
  vllm: {
    label: "vLLM",
    defaultBaseUrl: "http://localhost:8000",
    defaultModel: "Qwen/Qwen2.5-Coder-7B-Instruct",
    needsBaseUrl: true,
    needsApiKey: false,
    models: ["Qwen/Qwen2.5-Coder-7B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
  },
  openai_compat: {
    label: "OpenAI 호환 (커스텀)",
    defaultModel: "custom-model",
    needsBaseUrl: true,
    needsApiKey: false,
    models: ["custom-model"],
  },
};

interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
  baseUrl?: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  hasApiKey: boolean;
  lastTestedAt?: string | null;
  lastTestedOk?: boolean | null;
}

// ── Add/Edit Form ────────────────────────────────────────────────────────────

function ProviderForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: Partial<AiProvider & { apiKey?: string }>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const type = (initial?.type ?? "anthropic") as AiProviderType;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: type,
    baseUrl: initial?.baseUrl ?? PROVIDER_META[type].defaultBaseUrl ?? "",
    apiKey: "",
    model: initial?.model ?? PROVIDER_META[type].defaultModel,
    temperature: initial?.temperature ?? 0.3,
    maxTokens: initial?.maxTokens ?? 2048,
  });

  const meta = PROVIDER_META[form.type as AiProviderType];

  function set(key: string, value: unknown) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "type") {
        const m = PROVIDER_META[value as AiProviderType];
        next.baseUrl = m.defaultBaseUrl ?? "";
        next.model = m.defaultModel;
        if (!prev.name || Object.values(PROVIDER_META).some((x) => x.label === prev.name)) {
          next.name = m.label;
        }
      }
      return next;
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "var(--ds-sp-2) var(--ds-sp-3)",
    border: "1px solid var(--ds-border)",
    borderRadius: "var(--ds-r-6)",
    background: "var(--ds-fill)",
    color: "var(--ds-text)",
    fontSize: "var(--ds-fs-13)",
    outline: "none",
    fontFamily: "var(--ds-font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--ds-fs-11)",
    color: "var(--ds-text-mute)",
    fontWeight: "var(--ds-fw-medium)",
    marginBottom: "var(--ds-sp-1)",
    display: "block",
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>
      {/* Provider Type */}
      <div style={fieldStyle}>
        <label style={labelStyle}>프로바이더 유형</label>
        <select aria-label="프로바이더 유형" value={form.type} onChange={(e) => set("type", e.target.value)} style={inputStyle}>
          {(Object.entries(PROVIDER_META) as [AiProviderType, typeof PROVIDER_META[AiProviderType]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Display Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>표시 이름</label>
        <input aria-label="표시 이름" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="예) 내 Ollama" style={inputStyle} />
      </div>

      {/* Base URL */}
      {meta.needsBaseUrl && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Base URL <span style={{ color: "var(--ds-danger)" }}>*</span></label>
          <input
            aria-label="Base URL"
            value={form.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder={meta.defaultBaseUrl ?? "http://localhost:8000"}
            style={inputStyle}
          />
        </div>
      )}

      {/* API Key */}
      {meta.needsApiKey && (
        <div style={fieldStyle}>
          <label style={labelStyle}>
            API 키 {initial?.hasApiKey && <span style={{ color: "var(--ds-text-faint)" }}>(이미 저장됨 — 변경 시만 입력)</span>}
          </label>
          <input
            type="password"
            autoComplete="off"
            aria-label="API 키"
            value={form.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder={initial?.hasApiKey ? "••••••••" : "sk-..."}
            style={inputStyle}
          />
        </div>
      )}

      {/* Model */}
      <div style={fieldStyle}>
        <label style={labelStyle}>모델</label>
        <div style={{ display: "flex", gap: "var(--ds-sp-2)" }}>
          <input
            aria-label="모델 이름"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder={meta.defaultModel}
            style={{ ...inputStyle, flex: 1 }}
          />
          {meta.models.length > 1 && (
            <select
              aria-label="모델 빠른 선택"
              onChange={(e) => { if (e.target.value) set("model", e.target.value); }}
              style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
            >
              <option value="">빠른 선택</option>
              {meta.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Temperature + MaxTokens */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-3)" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Temperature <span style={{ color: "var(--ds-accent)" }}>{form.temperature}</span></label>
          <input
            type="range" min={0} max={2} step={0.05}
            aria-label={`Temperature: ${form.temperature}`}
            value={form.temperature}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Max Tokens</label>
          <input
            type="number" min={256} max={32768}
            aria-label="Max Tokens"
            value={form.maxTokens}
            onChange={(e) => set("maxTokens", parseInt(e.target.value, 10))}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button
          variant="accent"
          size="sm"
          loading={isPending}
          onClick={() => onSubmit({ ...form, apiKey: form.apiKey || undefined })}
        >
          저장
        </Button>
      </div>
    </div>
  );
}

// ── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  onActivate,
  onDelete,
  onTest,
  onEdit,
  testingId,
}: {
  provider: AiProvider;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onEdit: (p: AiProvider) => void;
  testingId: string | null;
}) {
  const meta = PROVIDER_META[provider.type];
  const isTesting = testingId === provider.id;

  return (
    <div
      style={{
        border: provider.isActive ? "2px solid var(--ds-accent)" : "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)",
        padding: "var(--ds-sp-4)",
        background: provider.isActive ? "var(--ds-accent-soft)" : "var(--ds-surface)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--ds-sp-3)",
      }}
    >
      {/* Status icon */}
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        {provider.lastTestedOk === true && <CheckCircle2 aria-hidden="true" size={18} style={{ color: "var(--ds-success)" }} />}
        {provider.lastTestedOk === false && <XCircle aria-hidden="true" size={18} style={{ color: "var(--ds-danger)" }} />}
        {provider.lastTestedOk == null && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--ds-border)" }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-1)" }}>
          <span style={{ fontSize: "var(--ds-fs-14)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
            {provider.name}
          </span>
          {provider.isActive && <Pill variant="success">활성</Pill>}
          <Pill variant="default">{meta.label}</Pill>
        </div>
        <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-mono)" }}>
          {provider.model}
          {provider.baseUrl && <span style={{ marginLeft: 8, color: "var(--ds-text-faint)" }}>{provider.baseUrl}</span>}
        </div>
        {provider.lastTestedAt && (
          <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
            테스트: {new Date(provider.lastTestedAt).toLocaleString("ko-KR")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          icon={isTesting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
          onClick={() => onTest(provider.id)}
          loading={isTesting}
        >
          테스트
        </Button>
        <Button variant="ghost" size="sm" icon={<Settings2 size={12} />} onClick={() => onEdit(provider)}>
          편집
        </Button>
        {!provider.isActive && (
          <Button variant="accent" size="sm" onClick={() => onActivate(provider.id)}>
            활성화
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={() => { if (confirm(`"${provider.name}" 프로바이더를 삭제할까요?`)) onDelete(provider.id); }}
        >삭제</Button>
      </div>
    </div>
  );
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function AiProviderSection() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showEnvFallback, setShowEnvFallback] = useState(false);

  const { data: providers = [], isLoading } = useQuery<AiProvider[]>({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const res = await fetch("/api/ai-providers");
      const json = await res.json() as { data: AiProvider[] };
      return json.data ?? [];
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? "생성 실패");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/ai-providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? "수정 실패");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      setEditingProvider(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-providers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-providers/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error("활성화 실패");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/ai-providers/${id}/test`, { method: "POST" });
      const json = await res.json() as { data: { ok: boolean; message: string; latencyMs: number } };
      alert(json.data.ok
        ? `연결 성공 (${json.data.latencyMs}ms)\n${json.data.message}`
        : `연결 실패\n${json.data.message}`
      );
    } finally {
      setTestingId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>
      {/* Header card */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--ds-sp-4)" }}>
          <div>
            <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
              AI 프로바이더
            </div>
            <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", marginTop: 2 }}>
              SQL 생성에 사용할 AI 모델을 설정하세요. 활성화된 프로바이더가 NL→SQL에 사용됩니다.
            </div>
          </div>
          <Button variant="accent" size="sm" icon={<Plus size={13} />} onClick={() => { setShowAdd(true); setEditingProvider(null); }}>
            추가
          </Button>
        </div>

        {/* Add form */}
        {showAdd && !editingProvider && (
          <div style={{ borderTop: "1px solid var(--ds-border)", paddingTop: "var(--ds-sp-4)" }}>
            <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>
              새 프로바이더 추가
            </div>
            <ProviderForm
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setShowAdd(false)}
              isPending={createMutation.isPending}
            />
          </div>
        )}

        {/* Provider list */}
        {isLoading ? (
          <div style={{ color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-13)", padding: "var(--ds-sp-4) 0" }}>
            불러오는 중...
          </div>
        ) : providers.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-6)",
              textAlign: "center",
              color: "var(--ds-text-faint)",
              fontSize: "var(--ds-fs-13)",
            }}
          >
            등록된 AI 프로바이더가 없습니다. 위의 [추가] 버튼으로 첫 번째 프로바이더를 설정하세요.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            {providers.map((p) => (
              editingProvider?.id === p.id ? (
                <div key={p.id} style={{ border: "1px solid var(--ds-accent)", borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-4)" }}>
                  <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)", marginBottom: "var(--ds-sp-3)" }}>
                    프로바이더 편집 — {p.name}
                  </div>
                  <ProviderForm
                    initial={p}
                    onSubmit={(data) => updateMutation.mutate({ id: p.id, body: data })}
                    onCancel={() => setEditingProvider(null)}
                    isPending={updateMutation.isPending}
                  />
                </div>
              ) : (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onActivate={(id) => activateMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onTest={handleTest}
                  onEdit={setEditingProvider}
                  testingId={testingId}
                />
              )
            ))}
          </div>
        )}
      </Card>

      {/* Env var fallback info */}
      <Card>
        <button
          type="button"
          aria-expanded={showEnvFallback}
          aria-label="환경변수 폴백 정보"
          onClick={() => setShowEnvFallback((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-mute)", fontSize: "var(--ds-fs-13)", padding: 0 }}
        >
          <span>환경변수 폴백 정보</span>
          {showEnvFallback ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
        </button>
        {showEnvFallback && (
          <div style={{ marginTop: "var(--ds-sp-3)", fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", lineHeight: 1.7 }}>
            <p>프로바이더가 활성화되지 않은 경우 환경변수를 폴백으로 사용합니다:</p>
            <code style={{ display: "block", background: "var(--ds-fill)", padding: "var(--ds-sp-3)", borderRadius: "var(--ds-r-6)", marginTop: "var(--ds-sp-2)", fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-11)" }}>
              LMSTUDIO_BASE_URL=http://localhost:1234{"\n"}
              LMSTUDIO_API_KEY=lm-studio{"\n"}
              ANTHROPIC_API_KEY=sk-ant-...{"\n"}
              OPENAI_API_KEY=sk-...{"\n"}
              GOOGLE_AI_API_KEY=AIza...
            </code>
          </div>
        )}
      </Card>
    </div>
  );
}
