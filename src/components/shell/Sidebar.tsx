"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  Home,
  SquareTerminal,
  Table2,
  BookOpen,
  BarChart2,
  LayoutDashboard,
  History,
  Star,
  Plug,
  User,
  AlertTriangle,
  Settings,
  ChevronDown,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/home", icon: Home, label: "홈" },
  { href: "/workspace", icon: SquareTerminal, label: "워크스페이스" },
  { href: "/schema", icon: Table2, label: "스키마" },
  { href: "/glossary", icon: BookOpen, label: "용어 사전" },
  { href: "/charts", icon: BarChart2, label: "결과 · 차트" },
  { href: "/dashboards", icon: LayoutDashboard, label: "대시보드" },
  { href: "/history", icon: History, label: "히스토리" },
  { href: "/saved", icon: Star, label: "저장됨", countKey: "saved" as const },
  { href: "/connections", icon: Plug, label: "연결" },
  { href: "/profile", icon: User, label: "프로필" },
  { href: "/errors", icon: AlertTriangle, label: "상태 · 에러" },
  { href: "/settings", icon: Settings, label: "설정" },
];

interface SidebarProps {
  onOpenCommandPalette?: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
  const pathname = usePathname();
  const activeConnectionId = useWorkspaceStore((s) => s.activeConnectionId);

  const { data: savedCount } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => {
      const res = await fetch("/api/saved");
      const json = await res.json() as { data?: unknown[] };
      return Array.isArray(json.data) ? json.data.length : 0;
    },
    staleTime: 30_000,
    select: (data) => (typeof data === "number" ? data : 0),
  });

  const { data: connections } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const res = await fetch("/api/connections");
      const json = await res.json() as { data?: Array<{ id: string; name: string }> };
      return json.data ?? [];
    },
    staleTime: 30_000,
  });

  const activeConnection = (connections ?? []).find((c) => c.id === activeConnectionId);

  return (
    <aside
      style={{
        width: "var(--ds-sidebar-w)",
        background: "var(--ds-surface)",
        borderRight: "1px solid var(--ds-border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: "var(--ds-z-sticky)",
        flexShrink: 0,
      }}
    >
      {/* Workspace selector */}
      <div
        style={{
          padding: "var(--ds-sp-2) var(--ds-sp-3)",
          borderBottom: "1px solid var(--ds-border)",
        }}
      >
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            width: "100%",
            padding: "var(--ds-sp-1) var(--ds-sp-2)",
            borderRadius: "var(--ds-r-6)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--ds-text)",
            fontSize: "var(--ds-fs-13)",
            fontWeight: "var(--ds-fw-medium)",
          }}
          className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
        >
          <Zap size={14} style={{ color: "var(--ds-accent)" }} />
          <span style={{ flex: 1, textAlign: "left" }}>vibeSQL</span>
          <ChevronDown size={12} style={{ color: "var(--ds-text-faint)" }} />
        </button>

        {/* Active connection chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-1)",
            padding: "var(--ds-sp-1) var(--ds-sp-2)",
            marginTop: "var(--ds-sp-1)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "var(--ds-r-full)",
              background: activeConnection ? "var(--ds-success)" : "var(--ds-text-faint)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "var(--ds-fs-11)",
              color: "var(--ds-text-mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeConnection ? activeConnection.name : "연결 없음"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "var(--ds-sp-2)", overflowY: "auto" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          const count = "countKey" in item && item.countKey === "saved" ? savedCount : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-sp-2)",
                padding: "var(--ds-sp-1) var(--ds-sp-3)",
                borderRadius: "var(--ds-r-6)",
                fontSize: "var(--ds-fs-12)",
                color: isActive ? "var(--ds-text)" : "var(--ds-text-mute)",
                background: isActive ? "var(--ds-fill)" : "transparent",
                borderLeft: isActive ? "2px solid var(--ds-accent)" : "2px solid transparent",
                textDecoration: "none",
                marginBottom: "1px",
                transition: `background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)`,
              }}
              className={cn("group", !isActive && "hover:bg-fill hover:text-text")}
            >
              <item.icon size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {count != null && count > 0 && (
                <span
                  style={{
                    fontSize: "var(--ds-fs-9)",
                    fontFamily: "var(--ds-font-mono)",
                    color: "var(--ds-text-faint)",
                    background: "var(--ds-fill)",
                    borderRadius: "var(--ds-r-full)",
                    padding: "1px 5px",
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div
        style={{
          borderTop: "1px solid var(--ds-border)",
          padding: "var(--ds-sp-2) var(--ds-sp-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            padding: "var(--ds-sp-1) var(--ds-sp-2)",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "var(--ds-r-full)",
              background: "var(--ds-fill-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--ds-fs-10)",
              fontWeight: "var(--ds-fw-semibold)",
              color: "var(--ds-text-mute)",
              flexShrink: 0,
            }}
          >
            U
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--ds-fs-12)",
                fontWeight: "var(--ds-fw-medium)",
                color: "var(--ds-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              사용자
            </div>
          </div>
        </div>
        <button
          onClick={onOpenCommandPalette}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            width: "100%",
            padding: "var(--ds-sp-1) var(--ds-sp-2)",
            borderRadius: "var(--ds-r-6)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--ds-text-faint)",
            fontSize: "var(--ds-fs-11)",
            fontFamily: "var(--ds-font-mono)",
            marginTop: "var(--ds-sp-1)",
          }}
          className="hover:bg-fill hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
        >
          ⌘K 명령 팔레트
        </button>
      </div>
    </aside>
  );
}
