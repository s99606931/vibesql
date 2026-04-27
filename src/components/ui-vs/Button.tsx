import { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "default" | "primary" | "accent" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, object> = {
  default: {
    background: "var(--ds-surface)",
    color: "var(--ds-text)",
    border: "1px solid var(--ds-border)",
  },
  primary: {
    background: "var(--ds-text)",
    color: "var(--ds-bg)",
    border: "1px solid var(--ds-text)",
  },
  accent: {
    background: "var(--ds-accent)",
    color: "var(--ds-accent-on)",
    border: "1px solid var(--ds-accent)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ds-text-mute)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--ds-surface)",
    color: "var(--ds-danger)",
    border: "1px solid var(--ds-danger)",
  },
};

const sizeStyles: Record<ButtonSize, object> = {
  sm: { fontSize: "var(--ds-fs-11)", padding: "4px 8px" },
  md: { fontSize: "var(--ds-fs-12)", padding: "6px 12px" },
  lg: { fontSize: "var(--ds-fs-13)", padding: "8px 14px" },
};

export function Button({
  variant = "default",
  size = "md",
  loading,
  icon,
  children,
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--ds-sp-1)",
        borderRadius: "var(--ds-r-6)",
        fontFamily: "var(--ds-font-sans)",
        fontWeight: "var(--ds-fw-medium)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: `background var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)`,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {loading ? (
        <Loader2
          size={12}
          style={{ animation: "spin 1s linear infinite" }}
        />
      ) : (
        icon && <span style={{ display: "inline-flex" }}>{icon}</span>
      )}
      {children}
    </button>
  );
}
