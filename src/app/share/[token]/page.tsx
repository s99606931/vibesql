"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Zap, Copy, ExternalLink, Check } from "lucide-react";

interface ShareData {
  sql: string;
  nlQuery?: string | null;
  dialect?: string;
  title?: string | null;
  viewCount?: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: ShareData };

const dialectLabels: Record<string, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
  oracle: "Oracle",
};

export default function SharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = (await res.json()) as ShareData & { error?: string; data?: ShareData };
        if (!res.ok || json.error) {
          setState({ status: "error", message: json.error ?? "링크를 불러올 수 없습니다." });
        } else {
          // Support both { data: ShareData } and flat ShareData shapes
          const payload = json.data ?? (json as ShareData);
          setState({ status: "success", data: payload });
        }
      })
      .catch(() => {
        setState({ status: "error", message: "네트워크 오류가 발생했습니다." });
      });
  }, [token]);

  function handleCopy() {
    if (state.status !== "success") return;
    navigator.clipboard.writeText(state.data.sql).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenInVibeSQL() {
    if (state.status !== "success") return;
    window.location.href = `/workspace?sql=${encodeURIComponent(state.data.sql)}`;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ds-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--ds-sp-6) var(--ds-sp-4)",
        fontFamily: "var(--ds-font-sans)",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--ds-sp-6)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              color: "var(--ds-text)",
              fontSize: "var(--ds-fs-14)",
              fontWeight: "var(--ds-fw-semibold)",
            }}
          >
            <Zap size={16} style={{ color: "var(--ds-accent)" }} />
            <span>vibeSQL</span>
          </div>
        </Link>
        <span style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)" }}>
          공유된 쿼리
        </span>
      </div>

      {/* Main content */}
      <div style={{ width: "100%", maxWidth: 640, flex: 1 }}>

        {/* Loading skeleton */}
        {state.status === "loading" && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            {([80, 160, 48] as number[]).map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  background: "var(--ds-fill)",
                  borderBottom: i < 2 ? "1px solid var(--ds-border)" : undefined,
                }}
                className="ds-stripes"
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {state.status === "error" && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              padding: "var(--ds-sp-6)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "var(--ds-fs-28)", marginBottom: "var(--ds-sp-3)" }}>
              ⚠️
            </div>
            <div
              style={{
                fontSize: "var(--ds-fs-14)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text)",
                marginBottom: "var(--ds-sp-2)",
              }}
            >
              링크를 열 수 없습니다
            </div>
            <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)" }}>
              {state.message}
            </div>
          </div>
        )}

        {/* Success state */}
        {state.status === "success" && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            {/* NL Query */}
            {state.data.nlQuery && (
              <div
                style={{
                  padding: "var(--ds-sp-4) var(--ds-sp-5)",
                  borderBottom: "1px solid var(--ds-border)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: "var(--ds-text-faint)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "var(--ds-sp-1)",
                  }}
                >
                  질문
                </div>
                <div style={{ fontSize: "var(--ds-fs-14)", color: "var(--ds-text)", lineHeight: 1.5 }}>
                  {state.data.nlQuery}
                </div>
              </div>
            )}

            {/* SQL block */}
            <div style={{ padding: "var(--ds-sp-4) var(--ds-sp-5)" }}>
              <div
                style={{
                  fontSize: "var(--ds-fs-11)",
                  fontWeight: "var(--ds-fw-semibold)",
                  color: "var(--ds-text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "var(--ds-sp-2)",
                }}
              >
                SQL
              </div>
              <pre
                style={{
                  fontFamily: "var(--ds-font-mono)",
                  fontSize: "var(--ds-fs-12)",
                  color: "var(--ds-text)",
                  background: "var(--ds-fill)",
                  border: "1px solid var(--ds-border)",
                  borderRadius: "var(--ds-r-6)",
                  padding: "var(--ds-sp-3) var(--ds-sp-4)",
                  overflowX: "auto",
                  overflowY: "auto",
                  maxHeight: 480,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {state.data.sql}
              </pre>
            </div>

            {/* Actions row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                padding: "var(--ds-sp-3) var(--ds-sp-5)",
                borderTop: "1px solid var(--ds-border)",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                aria-label={copied ? "복사됨" : "SQL 복사"}
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-1)",
                  padding: "var(--ds-sp-1) var(--ds-sp-3)",
                  background: "var(--ds-fill)",
                  border: "1px solid var(--ds-border)",
                  borderRadius: "var(--ds-r-6)",
                  cursor: "pointer",
                  fontSize: "var(--ds-fs-12)",
                  color: "var(--ds-text-mute)",
                  fontFamily: "var(--ds-font-sans)",
                  transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                {copied
                  ? <Check size={13} style={{ color: "var(--ds-success)" }} />
                  : <Copy size={13} />
                }
                {copied ? "복사됨" : "복사"}
              </button>

              <button
                type="button"
                aria-label="vibeSQL에서 열기"
                onClick={handleOpenInVibeSQL}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-1)",
                  padding: "var(--ds-sp-1) var(--ds-sp-3)",
                  background: "var(--ds-accent)",
                  border: "1px solid transparent",
                  borderRadius: "var(--ds-r-6)",
                  cursor: "pointer",
                  fontSize: "var(--ds-fs-12)",
                  color: "var(--ds-accent-fg, #fff)",
                  fontFamily: "var(--ds-font-sans)",
                  fontWeight: "var(--ds-fw-medium)",
                  transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                <ExternalLink size={13} />
                vibeSQL에서 열기
              </button>

              <div style={{ flex: 1 }} />

              {state.data.dialect && (
                <span
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    fontFamily: "var(--ds-font-mono)",
                    color: "var(--ds-text-faint)",
                    background: "var(--ds-fill)",
                    border: "1px solid var(--ds-border)",
                    borderRadius: "var(--ds-r-full)",
                    padding: "1px var(--ds-sp-2)",
                  }}
                >
                  {dialectLabels[state.data.dialect] ?? state.data.dialect}
                </span>
              )}

              {state.data.viewCount != null && (
                <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>
                  조회수 {state.data.viewCount}회
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "var(--ds-sp-6)",
          fontSize: "var(--ds-fs-11)",
          color: "var(--ds-text-faint)",
          textAlign: "center",
        }}
      >
        <Link href="/" style={{ color: "var(--ds-accent)", textDecoration: "none" }}>
          vibeSQL
        </Link>
        로 만든 쿼리입니다
      </div>
    </div>
  );
}
