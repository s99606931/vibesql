import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PillVariant = "default" | "accent" | "dashed" | "success" | "warn" | "danger" | "info";

interface PillProps {
  variant?: PillVariant;
  dot?: "ok" | "warn" | "err";
  children: ReactNode;
  className?: string;
}

const dotColors = {
  ok: "var(--ds-success)",
  warn: "var(--ds-warn)",
  err: "var(--ds-danger)",
};

const variantStyles: Record<PillVariant, object> = {
  default: {
    background: "var(--ds-surface)",
    color: "var(--ds-text-mute)",
    border: "1px solid var(--ds-border)",
  },
  accent: {
    background: "var(--ds-accent-soft)",
    color: "var(--ds-accent)",
    border: "1px solid var(--ds-accent)",
  },
  dashed: {
    background: "var(--ds-surface)",
    color: "var(--ds-text-mute)",
    border: "1px dashed var(--ds-border)",
  },
  success: {
    background: "var(--ds-success-soft)",
    color: "var(--ds-success)",
    border: "1px solid var(--ds-success)",
  },
  warn: {
    background: "var(--ds-warn-soft)",
    color: "var(--ds-warn)",
    border: "1px solid var(--ds-warn)",
  },
  danger: {
    background: "var(--ds-danger-soft)",
    color: "var(--ds-danger)",
    border: "1px solid var(--ds-danger)",
  },
  info: {
    background: "var(--ds-info-soft)",
    color: "var(--ds-info)",
    border: "1px solid var(--ds-info)",
  },
};

export function Pill({ variant = "default", dot, children, className }: PillProps) {
  return (
    <span
      className={cn(className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--ds-sp-1)",
        fontSize: "var(--ds-fs-11)",
        padding: "2px 8px",
        borderRadius: "var(--ds-r-full)",
        fontWeight: "var(--ds-fw-medium)",
        transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
        ...variantStyles[variant],
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "var(--ds-r-full)",
            background: dotColors[dot],
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
