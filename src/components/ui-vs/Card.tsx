import { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  dashed?: boolean;
  hoverable?: boolean;
  padding?: string | number;
  children: ReactNode;
}

export function Card({
  dashed,
  hoverable,
  padding = "var(--ds-sp-4)",
  children,
  className,
  style,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--ds-surface)",
        border: `1px ${dashed ? "dashed" : "solid"} var(--ds-border)`,
        borderRadius: "var(--ds-r-8)",
        padding,
        cursor: hoverable && onClick ? "pointer" : undefined,
        transition: hoverable
          ? `border-color var(--ds-dur-fast) var(--ds-ease), box-shadow var(--ds-dur-fast) var(--ds-ease)`
          : undefined,
        ...style,
      }}
      className={cn(
        hoverable && "hover:border-border-strong hover:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeadProps {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function CardHead({ title, meta, actions }: CardHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "var(--ds-sp-3)",
        gap: "var(--ds-sp-2)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--ds-fs-13)",
            fontWeight: "var(--ds-fw-semibold)",
            color: "var(--ds-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {meta && (
          <div
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-faint)",
              marginTop: 2,
            }}
          >
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
