"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Card } from "@/components/ui-vs/Card";
import { Pill } from "@/components/ui-vs/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, Pencil, Zap, CheckCircle2, XCircle, Clock,
  Wifi, WifiOff, Eye, EyeOff, Copy, Check,
} from "lucide-react";
import type { AiProviderType } from "@/app/api/ai-providers/route";

// ─── types ────────────────────────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  name: string;
  type: AiProviderType;
  model: string;
  baseUrl?: string | null;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  hasApiKey: boolean;
  lastTestedAt?: string | null;
  lastTestedOk?: boolean | null;
  createdAt: string;
}

// ─── provider meta ────────────────────────────────────────────────────────────

const PROVIDER_META: Record<AiProviderType, { label: string; needsKey: boolean; needsBase: boolean; defaultModel: string }> = {
  anthropic:     { label: "Anthropic",      needsKey: true,  needsBase: false, defaultModel: "claude-sonnet-4-6" },
  openai:        { label: "OpenAI",         needsKey: true,  needsBase: false, defaultModel: "gpt-4o" },
  google:        { label: "Google AI",      needsKey: true,  needsBase: false, defaultModel: "gemini-1.5-pro" },
  lmstudio:      { label: "LM Studio",      needsKey: false, needsBase: true,  defaultModel: "local-model" },
  ollama:        { label: "Ollama",         needsKey: false, needsBase: true,  defaultModel: "llama3" },
  vllm:          { label: "vLLM",           needsKey: false, needsBase: true,  defaultModel: "mistral-7b" },
  openai_compat: { label: "OpenAI 호환",   needsKey: true,  needsBase: true,  defaultModel: "local-model" },
};

const TYPE_OPTIONS = Object.entries(PROVIDER_META).map(([k, v]) => ({ value: k as AiProviderType, label: v.label }));

function formatRelativeElapsed(iso: string | null | undefined): string {
  if (!iso) return "테스트 안 함";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "방금 전";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffMs / 86_400_000);
  return `${diffDay}일 전`;
}

// ─── form data ────────────────────────────────────────────────────────────────

interface ProviderForm {
  name: string;
  type: AiProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

const DEFAULT_FORM: ProviderForm = {
  name: "",
  type: "anthropic",
  model: "claude-sonnet-4-6",
  apiKey: "",
  baseUrl: "",
  temperature: 0.3,
  maxTokens: 2048,
  isActive: false,
};

// ─── ProviderModal ────────────────────────────────────────────────────────────

function ProviderModal({
  initial,
  editId,
  onSave,
  onClose,
  saving,
}: {
  initial: ProviderForm;
  editId: string | null;
  onSave: (data: ProviderForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProviderForm>(initial);
  const [showKey, setShowKey] = useState(false);
  const meta = PROVIDER_META[form.type];

  function set<K extends keyof ProviderForm>(k: K, v: ProviderForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function onTypeChange(type: AiProviderType) {
    setForm((prev) => ({
      ...prev,
      type,
      model: PROVIDER_META[type].defaultModel,
      baseUrl: PROVIDER_META[type].needsBase ? (prev.baseUrl || "") : "",
    }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 프로바이더 설정"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        style={{
          background: "var(--ds-surface)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-8)",
          padding: "var(--ds-sp-5)",
          width: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
          <h2 style={{ flex: 1, fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: 0 }}>
            {editId ? "AI 프로바이더 수정" : "AI 프로바이더 추가"}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", fontSize: 18, lineHeight: 1, transition: "color var(--ds-dur-fast) var(--ds-ease)" }} className="hover:text-text">×</button>
        </div>

        {/* Type */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="prov-type" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>프로바이더 유형</label>
          <select
            id="prov-type"
            aria-label="프로바이더 유형"
            value={form.type}
            onChange={(e) => onTypeChange(e.target.value as AiProviderType)}
            style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="prov-name" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>이름</label>
          <input
            id="prov-name"
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={`예: 내 ${meta.label} 계정`}
            style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
          />
        </div>

        {/* Model */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
          <label htmlFor="prov-model" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>모델명</label>
          <input
            id="prov-model"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder={meta.defaultModel}
            style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-mono)", width: "100%" }}
          />
        </div>

        {/* API Key */}
        {meta.needsKey && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label htmlFor="prov-apikey" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>
              API 키 {editId && <span style={{ color: "var(--ds-text-faint)", fontWeight: "normal" }}>(변경 시에만 입력)</span>}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                id="prov-apikey"
                aria-label="API 키"
                value={form.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
                placeholder="sk-..."
                style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", paddingRight: "var(--ds-sp-6)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-mono)", width: "100%" }}
              />
              <button
                type="button"
                aria-label={showKey ? "API 키 숨기기" : "API 키 보기"}
                aria-pressed={showKey}
                onClick={() => setShowKey((v) => !v)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", display: "flex", alignItems: "center", transition: "opacity var(--ds-dur-fast) var(--ds-ease)" }}
                className="hover:opacity-70"
              >
                {showKey ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Base URL */}
        {(meta.needsBase || form.type === "openai_compat") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label htmlFor="prov-baseurl" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>Base URL</label>
            <input
              id="prov-baseurl"
              value={form.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              placeholder="http://localhost:1234"
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontFamily: "var(--ds-font-mono)", width: "100%" }}
            />
          </div>
        )}

        {/* Temperature + MaxTokens */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-sp-3)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label htmlFor="prov-temp" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>Temperature</label>
            <input
              id="prov-temp"
              aria-label="Temperature"
              type="number" min={0} max={2} step={0.1}
              value={form.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value) || 0)}
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-1)" }}>
            <label htmlFor="prov-maxtokens" style={{ fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)" }}>Max Tokens</label>
            <input
              id="prov-maxtokens"
              aria-label="Max Tokens"
              type="number" min={256} max={32768} step={256}
              value={form.maxTokens}
              onChange={(e) => set("maxTokens", parseInt(e.target.value) || 2048)}
              style={{ background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", padding: "var(--ds-sp-2)", color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", width: "100%" }}
            />
          </div>
        </div>

        {/* isActive */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
          <input
            type="checkbox"
            id="modal-active"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="modal-active" style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", cursor: "pointer" }}>
            활성화 (기존 활성 프로바이더는 비활성화됨)
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)", marginTop: "var(--ds-sp-1)" }}>
          <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
          <Button
            size="sm"
            disabled={saving || !form.name.trim() || !form.model.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? "저장 중..." : editId ? "수정" : "추가"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ProviderCard ─────────────────────────────────────────────────────────────

interface TestFeedback {
  status: "running" | "success" | "error";
  latencyMs?: number;
  message?: string;
}

function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
  onActivate,
  testing,
  feedback,
}: {
  provider: ProviderRow;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onActivate: () => void;
  testing: boolean;
  feedback?: TestFeedback;
}) {
  const meta = PROVIDER_META[provider.type];
  const [copiedModel, setCopiedModel] = useState(false);

  function TestIcon() {
    if (provider.lastTestedOk === null || provider.lastTestedOk === undefined) {
      return <Clock aria-hidden="true" size={12} style={{ color: "var(--ds-text-faint)" }} />;
    }
    return provider.lastTestedOk
      ? <CheckCircle2 aria-hidden="true" size={12} style={{ color: "var(--ds-success)" }} />
      : <XCircle aria-hidden="true" size={12} style={{ color: "var(--ds-danger)" }} />;
  }

  function FeedbackLine() {
    if (!feedback) return null;
    if (feedback.status === "running") {
      return (
        <div role="status" aria-live="polite" style={{ marginTop: "var(--ds-sp-2)", fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)" }}>
          테스트 중...
        </div>
      );
    }
    if (feedback.status === "success") {
      return (
        <div role="status" aria-live="polite" style={{ marginTop: "var(--ds-sp-2)", fontSize: "var(--ds-fs-11)", color: "var(--ds-success)", display: "flex", alignItems: "center", gap: "var(--ds-sp-1)" }}>
          <CheckCircle2 aria-hidden="true" size={12} />
          <span>연결 성공{typeof feedback.latencyMs === "number" ? ` · ${feedback.latencyMs}ms` : ""}</span>
        </div>
      );
    }
    return (
      <div role="alert" aria-live="assertive" style={{ marginTop: "var(--ds-sp-2)", fontSize: "var(--ds-fs-11)", color: "var(--ds-danger)", display: "flex", alignItems: "center", gap: "var(--ds-sp-1)" }}>
        <XCircle aria-hidden="true" size={12} />
        <span>{feedback.message ?? "연결 실패"}</span>
      </div>
    );
  }

  return (
    <Card style={{ padding: "var(--ds-sp-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--ds-sp-3)" }}>
        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-1)" }}>
            <span style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)" }}>
              {provider.name}
            </span>
            {provider.isActive && (
              <Pill variant="success">활성</Pill>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-3)", flexWrap: "wrap" }}>
            <Pill variant="info">{meta.label}</Pill>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)" }}>
              <span style={{ fontSize: "var(--ds-fs-11)", fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-mute)" }}>
                {provider.model}
              </span>
              <button
                type="button"
                aria-label={copiedModel ? "복사됨" : "모델명 복사"}
                onClick={() => {
                  void navigator.clipboard.writeText(provider.model);
                  setCopiedModel(true);
                  setTimeout(() => setCopiedModel(false), 1500);
                }}
                style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-faint)", padding: 2, borderRadius: "var(--ds-r-6)", transition: "color var(--ds-dur-fast) var(--ds-ease), opacity var(--ds-dur-fast) var(--ds-ease)" }}
                className="hover:opacity-70"
              >
                {copiedModel ? <Check aria-hidden="true" size={11} style={{ color: "var(--ds-success)" }} /> : <Copy aria-hidden="true" size={11} />}
              </button>
            </span>
            {provider.baseUrl && (
              <span style={{ fontSize: "var(--ds-fs-11)", fontFamily: "var(--ds-font-mono)", color: "var(--ds-text-faint)" }}>
                {provider.baseUrl}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginTop: "var(--ds-sp-2)" }}>
            <TestIcon />
            <span
              title={provider.lastTestedAt ? new Date(provider.lastTestedAt).toLocaleString("ko-KR") : undefined}
              style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", cursor: "default" }}
            >
              {provider.lastTestedAt
                ? `${provider.lastTestedOk ? "연결 성공" : "연결 실패"} · ${formatRelativeElapsed(provider.lastTestedAt)}`
                : "테스트 안 함"}
            </span>
            <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
              · temp {provider.temperature} · {provider.maxTokens.toLocaleString()} tokens
            </span>
            {provider.hasApiKey && (
              <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>· API 키 ✓</span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
          <Button
            variant="ghost" size="sm"
            onClick={onTest}
            disabled={testing}
            title="연결 테스트"
          >
            {testing ? <WifiOff aria-hidden="true" size={13} /> : <Wifi aria-hidden="true" size={13} />}
            <span style={{ marginLeft: 4 }}>{testing ? "테스트 중" : "테스트"}</span>
          </Button>
          {!provider.isActive && (
            <Button variant="ghost" size="sm" onClick={onActivate}>
              <Zap aria-hidden="true" size={13} />
              <span style={{ marginLeft: 4 }}>활성화</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="수정">
            <Pencil aria-hidden="true" size={13} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="삭제">
            <Trash2 aria-hidden="true" size={13} style={{ color: "var(--ds-danger)" }} />
          </Button>
        </div>
      </div>
      <FeedbackLine />
    </Card>
  );
}

// ─── DeleteModal ──────────────────────────────────────────────────────────────

function DeleteModal({
  provider,
  onCancel,
  onConfirm,
  deleting,
}: {
  provider: ProviderRow;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="프로바이더 삭제"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div
        style={{
          background: "var(--ds-surface)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-8)",
          padding: "var(--ds-sp-5)",
          width: 440,
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-3)",
        }}
      >
        <h2 style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: 0 }}>
          AI 프로바이더 삭제
        </h2>
        <p style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", margin: 0 }}>
          <strong style={{ color: "var(--ds-text)" }}>&quot;{provider.name}&quot;</strong> 프로바이더를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
        {provider.isActive && (
          <div
            style={{
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-warn)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              border: "1px solid var(--ds-warn)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-warn-soft)",
            }}
          >
            ⚠️ 이 프로바이더는 현재 활성 상태입니다. 삭제 시 AI 기능이 중단됩니다.
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)", marginTop: "var(--ds-sp-1)" }}>
          <Button autoFocus variant="ghost" size="sm" onClick={onCancel} disabled={deleting}>취소</Button>
          <Button size="sm" onClick={onConfirm} disabled={deleting}>
            {deleting ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiProvidersPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null; initial: ProviderForm }>({
    open: false, editId: null, initial: DEFAULT_FORM,
  });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<Record<string, TestFeedback>>({});
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null);
  const feedbackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const { data: providers = [], isLoading } = useQuery<ProviderRow[]>({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const res = await fetch("/api/ai-providers");
      const json = await res.json() as { data?: ProviderRow[] };
      return json.data ?? [];
    },
    staleTime: 10_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ editId, form }: { editId: string | null; form: ProviderForm }) => {
      const body: Record<string, unknown> = {
        name: form.name, type: form.type, model: form.model,
        temperature: form.temperature, maxTokens: form.maxTokens, isActive: form.isActive,
      };
      if (form.apiKey) body.apiKey = form.apiKey;
      if (form.baseUrl) body.baseUrl = form.baseUrl;

      const url = editId ? `/api/ai-providers/${editId}` : "/api/ai-providers";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "저장 실패");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai-providers"] });
      setModal({ open: false, editId: null, initial: DEFAULT_FORM });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-providers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai-providers"] });
      setDeleteTarget(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-providers/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error("활성화 실패");
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ai-providers"] }); },
  });

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

  async function handleTest(id: string) {
    setTestingId(id);
    // Clear any pending auto-dismiss timer while a new test runs
    if (feedbackTimers.current[id]) {
      clearTimeout(feedbackTimers.current[id]);
      delete feedbackTimers.current[id];
    }
    setTestFeedback((prev) => ({ ...prev, [id]: { status: "running" } }));
    try {
      const res = await fetch(`/api/ai-providers/${id}/test`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { ok?: boolean; latencyMs?: number; message?: string };
        error?: string;
      };
      const payload = json.data;
      if (res.ok && payload?.ok) {
        setTestFeedback((prev) => ({
          ...prev,
          [id]: {
            status: "success",
            latencyMs: payload.latencyMs,
            message: payload.message,
          },
        }));
      } else {
        setTestFeedback((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            message: payload?.message ?? json.error ?? "연결 실패",
          },
        }));
      }
      await qc.invalidateQueries({ queryKey: ["ai-providers"] });
    } catch (err) {
      setTestFeedback((prev) => ({
        ...prev,
        [id]: {
          status: "error",
          message: err instanceof Error ? err.message : "네트워크 오류",
        },
      }));
    } finally {
      setTestingId(null);
      scheduleFeedbackClear(id);
    }
  }

  function openAdd() {
    setModal({ open: true, editId: null, initial: DEFAULT_FORM });
  }

  function openEdit(p: ProviderRow) {
    setModal({
      open: true,
      editId: p.id,
      initial: {
        name: p.name, type: p.type, model: p.model,
        apiKey: "", baseUrl: p.baseUrl ?? "",
        temperature: p.temperature, maxTokens: p.maxTokens, isActive: p.isActive,
      },
    });
  }

  const active = providers.filter((p) => p.isActive);
  const inactive = providers.filter((p) => !p.isActive);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="AI 프로바이더"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "AI 설정" }, { label: "AI 프로바이더" }]}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus aria-hidden="true" size={13} />
            <span style={{ marginLeft: 4 }}>프로바이더 추가</span>
          </Button>
        }
      />

      <div aria-busy={isLoading} aria-live="polite" style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Stat row */}
        <div style={{ display: "flex", gap: "var(--ds-sp-3)", marginBottom: "var(--ds-sp-5)" }}>
          {[
            { label: "전체", value: providers.length },
            { label: "활성", value: active.length },
            { label: "비활성", value: inactive.length },
            { label: "테스트 성공", value: providers.filter((p) => p.lastTestedOk === true).length },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--ds-surface)", border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-3) var(--ds-sp-4)",
                minWidth: 80, textAlign: "center",
              }}
            >
              <div style={{ fontSize: "var(--ds-fs-20)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", fontFamily: "var(--ds-font-mono)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Provider list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--ds-border)", borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-6)", textAlign: "center",
            }}
          >
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-3)" }}>
              등록된 AI 프로바이더가 없습니다.
            </div>
            <Button size="sm" onClick={openAdd}>
              <Plus aria-hidden="true" size={13} />
              <span style={{ marginLeft: 4 }}>첫 프로바이더 추가</span>
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {/* Active first */}
            {active.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteTarget(p)}
                onTest={() => handleTest(p.id)}
                onActivate={() => activateMutation.mutate(p.id)}
                testing={testingId === p.id}
                feedback={testFeedback[p.id]}
              />
            ))}
            {inactive.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteTarget(p)}
                onTest={() => handleTest(p.id)}
                onActivate={() => activateMutation.mutate(p.id)}
                testing={testingId === p.id}
                feedback={testFeedback[p.id]}
              />
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <ProviderModal
          initial={modal.initial}
          editId={modal.editId}
          onSave={(form) => saveMutation.mutate({ editId: modal.editId, form })}
          onClose={() => setModal({ open: false, editId: null, initial: DEFAULT_FORM })}
          saving={saveMutation.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          provider={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
