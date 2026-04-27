"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

export function TopBar({ title, breadcrumbs, actions }: TopBarProps) {
  return (
    <header
      style={{
        height: "var(--ds-topbar-h)",
        background: "var(--ds-surface)",
        borderBottom: "1px solid var(--ds-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 var(--ds-sp-6)",
        gap: "var(--ds-sp-4)",
        position: "sticky",
        top: 0,
        zIndex: "var(--ds-z-sticky)",
        flexShrink: 0,
      }}
    >
      {/* Title + breadcrumb */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--ds-fs-14)",
            fontWeight: "var(--ds-fw-semibold)",
            color: "var(--ds-text)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="탐색경로"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-1)",
              marginTop: 1,
            }}
          >
            {breadcrumbs.map((crumb, i) => (
              <span
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-1)",
                }}
              >
                {i > 0 && (
                  <ChevronRight
                    size={10}
                    style={{ color: "var(--ds-text-faint)" }}
                  />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-mute)",
                      textDecoration: "none",
                    }}
                    className="hover:text-text transition-colors duration-[var(--ds-dur-fast)]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}
                    style={{
                      fontSize: "var(--ds-fs-11)",
                      color: "var(--ds-text-mute)",
                    }}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
