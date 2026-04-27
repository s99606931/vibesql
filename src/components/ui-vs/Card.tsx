import { ReactNode, HTMLAttributes, KeyboardEvent } from "react";
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
  onKeyDown,
  tabIndex,
  ...props
}: CardProps) {
  const isInteractive = !!(hoverable && onClick);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isInteractive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(e);
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
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
        <h2
          title={typeof title === "string" ? title : undefined}
          style={{
            fontSize: "var(--ds-fs-13)",
            fontWeight: "var(--ds-fw-semibold)",
            color: "var(--ds-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            margin: 0,
          }}
        >
          {title}
        </h2>
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
