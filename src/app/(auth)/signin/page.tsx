import Link from "next/link";
import { Zap } from "lucide-react";

export default function SignInPage() {
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
            <Zap size={16} color="white" />
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

        <h1
          style={{
            fontSize: "var(--ds-fs-22)",
            fontWeight: "var(--ds-fw-semibold)",
            color: "var(--ds-text)",
            marginBottom: "var(--ds-sp-1)",
          }}
        >
          다시 만나서 반가워요
        </h1>
        <p
          style={{
            fontSize: "var(--ds-fs-13)",
            color: "var(--ds-text-mute)",
            marginBottom: "var(--ds-sp-6)",
          }}
        >
          자연어로 데이터에 질문하세요
        </p>

        <form style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-3)" }}>
          <div>
            <label className="ds-label">이메일</label>
            <input
              type="email"
              placeholder="you@company.com"
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
              }}
            />
          </div>
          <div>
            <label className="ds-label">비밀번호</label>
            <input
              type="password"
              placeholder="••••••••"
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
              }}
            />
          </div>

          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--ds-sp-2) var(--ds-sp-4)",
              background: "var(--ds-text)",
              color: "#ffffff",
              borderRadius: "var(--ds-r-6)",
              fontSize: "var(--ds-fs-13)",
              fontWeight: "var(--ds-fw-medium)",
              textDecoration: "none",
              border: "1px solid var(--ds-text)",
              transition: "opacity var(--ds-dur-fast) var(--ds-ease)",
              marginTop: "var(--ds-sp-1)",
            }}
          >
            로그인
          </Link>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-3)",
            margin: "var(--ds-sp-4) 0",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--ds-border)" }} />
          <span style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)" }}>또는</span>
          <div style={{ flex: 1, height: 1, background: "var(--ds-border)" }} />
        </div>

        {/* OAuth */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
          {["Google로 계속", "GitHub로 계속"].map((label) => (
            <button
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--ds-sp-2) var(--ds-sp-4)",
                background: "var(--ds-surface)",
                color: "var(--ds-text)",
                borderRadius: "var(--ds-r-6)",
                fontSize: "var(--ds-fs-13)",
                fontWeight: "var(--ds-fw-medium)",
                border: "1px solid var(--ds-border)",
                cursor: "pointer",
                fontFamily: "var(--ds-font-sans)",
                width: "100%",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: "var(--ds-fs-12)",
            color: "var(--ds-text-mute)",
            marginTop: "var(--ds-sp-5)",
          }}
        >
          계정이 없으신가요?{" "}
          <Link
            href="/signin?tab=signup"
            style={{ color: "var(--ds-accent)", textDecoration: "none" }}
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
