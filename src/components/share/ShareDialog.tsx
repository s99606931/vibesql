"use client";

import { useState, useRef, useEffect } from "react";
import { X, Copy, Check, Link } from "lucide-react";
import { Button } from "@/components/ui-vs/Button";

export interface ShareDialogProps {
  sql: string;
  nlQuery?: string;
  dialect: string;
  open: boolean;
  onClose: () => void;
}

type ExpireDays = 1 | 7 | 30 | null;

const EXPIRE_OPTIONS: { label: string; value: ExpireDays }[] = [
  { label: "1일", value: 1 },
  { label: "7일", value: 7 },
  { label: "30일", value: 30 },
  { label: "만료 없음", value: null },
];

export function ShareDialog({ sql, nlQuery, dialect, open, onClose }: ShareDialogProps) {
  const [expireDays, setExpireDays] = useState<ExpireDays>(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!open) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setShareUrl(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: "query",
          sql,
          nlQuery,
          dialect,
          expiresDays: expireDays,
        }),
      });
      const json = (await res.json()) as { data?: { token: string }; error?: string };
      if (!res.ok || !json.data?.token) {
        throw new Error(json.error ?? "링크 생성에 실패했습니다.");
      }
      setShareUrl(`${window.location.origin}/share/${json.data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select text for manual copy
    }
  }

  function handleClose() {
    setShareUrl(null);
    setError(null);
    setCopied(false);
    onClose();
  }

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="공유 링크 생성"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--ds-overlay-bg, color-mix(in srgb, var(--ds-bg) 40%, black))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--ds-sp-4)",
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--ds-surface)",
          borderRadius: "var(--ds-r-8)",
          border: "1px solid var(--ds-border)",
          padding: "var(--ds-sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-4)",
          boxShadow: "var(--ds-shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
            <Link size={16} style={{ color: "var(--ds-accent)" }} />
            <span
              style={{
                fontSize: "var(--ds-fs-16)",
                fontWeight: "var(--ds-fw-bold)",
                color: "var(--ds-text)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              공유 링크 생성
            </span>
          </div>
          <button
            onClick={handleClose}
            aria-label="닫기"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--ds-r-6)",
              border: "none",
              background: "transparent",
              color: "var(--ds-text-faint)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* SQL preview */}
        <div
          title={sql}
          style={{
            background: "var(--ds-fill)",
            border: "1px solid var(--ds-border)",
            borderRadius: "var(--ds-r-6)",
            padding: "var(--ds-sp-3)",
            fontSize: "var(--ds-fs-11)",
            fontFamily: "var(--ds-font-mono)",
            color: "var(--ds-text-mute)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sql.slice(0, 120)}{sql.length > 120 ? "..." : ""}
        </div>

        {/* Expiry selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
          <label
            htmlFor="share-expire"
            style={{
              fontSize: "var(--ds-fs-12)",
              fontWeight: "var(--ds-fw-medium)",
              color: "var(--ds-text-mute)",
              fontFamily: "var(--ds-font-sans)",
            }}
          >
            만료 기간
          </label>
          <select
            id="share-expire"
            value={expireDays === null ? "null" : String(expireDays)}
            onChange={(e) => {
              const v = e.target.value;
              setExpireDays(v === "null" ? null : (parseInt(v, 10) as 1 | 7 | 30));
            }}
            style={{
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-6)",
              background: "var(--ds-fill)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-13)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              fontFamily: "var(--ds-font-sans)",
              outline: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {EXPIRE_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-danger)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              background: "color-mix(in srgb, var(--ds-danger) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ds-danger) 30%, transparent)",
              borderRadius: "var(--ds-r-6)",
              fontFamily: "var(--ds-font-sans)",
            }}
          >
            {error}
          </div>
        )}

        {/* Generated URL */}
        {shareUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            <span
              style={{
                fontSize: "var(--ds-fs-12)",
                fontWeight: "var(--ds-fw-medium)",
                color: "var(--ds-text-mute)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              공유 링크
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-6)",
                background: "var(--ds-fill)",
                padding: "var(--ds-sp-2) var(--ds-sp-3)",
              }}
            >
              <span
                title={shareUrl}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "var(--ds-fs-12)",
                  fontFamily: "var(--ds-font-mono)",
                  color: "var(--ds-accent)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shareUrl}
              </span>
              <button
                onClick={handleCopy}
                aria-label="클립보드에 복사"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "var(--ds-r-6)",
                  border: "1px solid var(--ds-border)",
                  background: "var(--ds-surface)",
                  color: copied ? "var(--ds-success)" : "var(--ds-text-mute)",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "color var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            {copied && (
              <span
                style={{
                  fontSize: "var(--ds-fs-11)",
                  color: "var(--ds-success)",
                  fontFamily: "var(--ds-font-sans)",
                }}
              >
                클립보드에 복사되었습니다.
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--ds-sp-2)" }}>
          <Button variant="ghost" size="md" onClick={handleClose}>
            닫기
          </Button>
          {!shareUrl && (
            <Button
              variant="accent"
              size="md"
              loading={loading}
              icon={<Link size={13} />}
              onClick={handleGenerate}
            >
              링크 생성
            </Button>
          )}
          {shareUrl && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShareUrl(null);
                setError(null);
              }}
            >
              다시 생성
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
