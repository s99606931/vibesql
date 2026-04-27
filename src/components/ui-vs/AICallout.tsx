import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AICalloutProps {
  label?: string;
  tone?: "accent" | "danger" | "default";
  children: ReactNode;
  className?: string;
  streaming?: boolean;
}

export function AICallout({
  label = "◆ AI",
  tone = "default",
  children,
  className,
  streaming,
}: AICalloutProps) {
  const toneStyles =
    tone === "accent"
      ? { borderColor: "var(--ds-accent)", background: "var(--ds-accent-soft)" }
      : tone === "danger"
      ? { borderColor: "var(--ds-danger)", background: "var(--ds-danger-soft)" }
      : { borderColor: "var(--ds-border)", background: "var(--ds-surface)" };

  const labelColor =
    tone === "danger" ? "var(--ds-danger)" : "var(--ds-accent)";

  return (
    <div
      className={cn(className)}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : streaming ? "polite" : "polite"}
      style={{
        border: "1px dashed",
        borderRadius: "var(--ds-r-6)",
        padding: "var(--ds-sp-3)",
        ...toneStyles,
      }}
    >
      <div
        style={{
          fontFamily: "var(--ds-font-mono)",
          fontSize: "var(--ds-fs-10)",
          color: labelColor,
          marginBottom: "var(--ds-sp-1)",
          fontWeight: "var(--ds-fw-medium)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--ds-fs-12)",
          lineHeight: 1.6,
          color: "var(--ds-text-mute)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AIBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("ds-ai-badge", className)}
      style={{
        fontFamily: "var(--ds-font-mono)",
        fontSize: "var(--ds-fs-9)",
        color: "var(--ds-accent)",
        border: "1px solid var(--ds-accent)",
        borderRadius: "var(--ds-r-4)",
        padding: "1px 5px",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      AI
    </span>
  );
}
