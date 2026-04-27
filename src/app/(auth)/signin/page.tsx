"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Eye, EyeOff, AlertCircle } from "lucide-react";

type Tab = "login" | "register";

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login"
        ? { email, password }
        : { email, password, name };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "오류가 발생했습니다.");
        return;
      }

      router.push("/workspace");
      router.refresh();
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ds-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--ds-sp-6)",
      }}
    >
      <div
        style={{
          background: "var(--ds-surface)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-r-10)",
          padding: "var(--ds-sp-8)",
          width: "100%",
          maxWidth: 360,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            marginBottom: "var(--ds-sp-6)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap aria-hidden="true" size={16} color="white" />
          </div>
          <span
            style={{
              fontSize: "var(--ds-fs-16)",
              fontWeight: "var(--ds-fw-semibold)",
              color: "var(--ds-text)",
            }}
          >
            vibeSQL
          </span>
        </div>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="로그인 / 회원가입"
          style={{
            display: "flex",
            background: "var(--ds-fill)",
            borderRadius: "var(--ds-r-8)",
            padding: 3,
            marginBottom: "var(--ds-sp-5)",
          }}
        >
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`signin-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="signin-form"
              onClick={() => { setTab(t); setError(null); }}
              style={{
                flex: 1,
                padding: "var(--ds-sp-1) var(--ds-sp-2)",
                borderRadius: "var(--ds-r-6)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--ds-fs-12)",
                fontWeight: "var(--ds-fw-medium)",
                background: tab === t ? "var(--ds-surface)" : "transparent",
                color: tab === t ? "var(--ds-text)" : "var(--ds-text-mute)",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all var(--ds-dur-fast) var(--ds-ease)",
                fontFamily: "var(--ds-font-sans)",
              }}
            >
              {t === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <h1
          style={{
            fontSize: "var(--ds-fs-18)",
            fontWeight: "var(--ds-fw-semibold)",
            color: "var(--ds-text)",
            marginBottom: "var(--ds-sp-4)",
          }}
        >
          {tab === "login" ? "다시 만나서 반가워요" : "새 계정 만들기"}
        </h1>

        {/* Error */}
        {error && (
          <div
            id="signin-error"
            role="alert"
            aria-live="assertive"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-2)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              background: "var(--ds-danger-soft, rgba(239,68,68,0.1))",
              border: "1px solid var(--ds-danger, #ef4444)",
              borderRadius: "var(--ds-r-6)",
              marginBottom: "var(--ds-sp-3)",
            }}
          >
            <AlertCircle aria-hidden="true" size={14} style={{ color: "var(--ds-danger)", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-danger)" }}>{error}</span>
          </div>
        )}

        <form id="signin-form" role="tabpanel" aria-labelledby={`signin-tab-${tab}`} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
          {tab === "register" && (
            <div>
              <label htmlFor="signin-name" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)", display: "block", marginBottom: "var(--ds-sp-1)" }}>
                이름
              </label>
              <input
                type="text"
                id="signin-name"
                aria-label="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
                style={{
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
                }}
              />
            </div>
          )}

          <div>
            <label htmlFor="signin-email" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)", display: "block", marginBottom: "var(--ds-sp-1)" }}>
              이메일
            </label>
            <input
              type="email"
              id="signin-email"
              aria-label="이메일"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "signin-error" : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{
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
              }}
            />
          </div>

          <div>
            <label htmlFor="signin-password" style={{ fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text-mute)", display: "block", marginBottom: "var(--ds-sp-1)" }}>
              비밀번호
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                id="signin-password"
                aria-label="비밀번호"
                aria-describedby={[tab === "register" ? "signin-pw-hint" : undefined, error ? "signin-error" : undefined].filter(Boolean).join(" ") || undefined}
                aria-invalid={error ? true : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={tab === "register" ? 8 : 1}
                style={{
                  width: "100%",
                  padding: "var(--ds-sp-2) 40px var(--ds-sp-2) var(--ds-sp-3)",
                  border: "1px solid var(--ds-border)",
                  borderRadius: "var(--ds-r-6)",
                  background: "var(--ds-surface-2)",
                  color: "var(--ds-text)",
                  fontSize: "var(--ds-fs-13)",
                  outline: "none",
                  fontFamily: "var(--ds-font-sans)",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ds-text-faint)", padding: 2,
                  transition: "color var(--ds-dur-fast) var(--ds-ease)",
                }}
              >
                {showPassword ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
              </button>
            </div>
            {tab === "register" && (
              <p id="signin-pw-hint" style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: "var(--ds-sp-1)" }}>
                8자 이상
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--ds-sp-2) var(--ds-sp-4)",
              background: loading ? "var(--ds-fill)" : "var(--ds-accent)",
              color: loading ? "var(--ds-text-mute)" : "#ffffff",
              borderRadius: "var(--ds-r-6)",
              fontSize: "var(--ds-fs-13)",
              fontWeight: "var(--ds-fw-medium)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
              marginTop: "var(--ds-sp-1)",
              fontFamily: "var(--ds-font-sans)",
            }}
          >
            {loading ? "처리 중..." : (tab === "login" ? "로그인" : "계정 만들기")}
          </button>
        </form>

        {/* Dev mode hint */}
        {process.env.NODE_ENV !== "production" && (
          <div
            style={{
              marginTop: "var(--ds-sp-4)",
              padding: "var(--ds-sp-2) var(--ds-sp-3)",
              background: "var(--ds-accent-soft)",
              borderRadius: "var(--ds-r-6)",
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-accent)",
            }}
          >
            <strong>개발 모드 계정</strong>
            <br />
            관리자: admin@vibesql.dev / admin123
            <br />
            사용자: user@vibesql.dev / user123
          </div>
        )}
      </div>
    </div>
  );
}
