"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui-vs/Button";
import { TriangleAlert } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--ds-sp-4)",
        padding: "var(--ds-sp-6)",
        color: "var(--ds-text)",
      }}
    >
      <TriangleAlert size={32} style={{ color: "var(--ds-danger)", opacity: 0.8 }} />
      <div style={{ fontSize: "var(--ds-fs-16)", fontWeight: "var(--ds-fw-semibold)" }}>
        오류가 발생했습니다
      </div>
      <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", textAlign: "center", maxWidth: 400 }}>
        {error.message ?? "알 수 없는 오류입니다. 다시 시도해주세요."}
      </div>
      <Button variant="primary" size="sm" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
