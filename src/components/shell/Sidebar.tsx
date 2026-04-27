"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useConnections } from "@/hooks/useConnections";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { UserRole } from "@/lib/auth/jwt";
import {
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
  ChevronLeft,
  ChevronRight,
  Zap,
  Home,
  Bot,
  Sparkles,
  CalendarClock,
  Cpu,
  FileText,
  ScrollText,
  ShieldCheck,
  Users,
  LogOut,
  Crown,
} from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  countKey?: "saved" | "schedules";
  requiredRole?: UserRole;
  badge?: "soon";
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
  requiredRole?: UserRole;
};

const navGroups: NavGroup[] = [
  {
    id: "workspace",
    label: "워크스페이스",
    items: [
      { href: "/home", icon: Home, label: "홈" },
      { href: "/workspace", icon: SquareTerminal, label: "워크스페이스" },
      { href: "/templates", icon: FileText, label: "템플릿" },
      { href: "/history", icon: History, label: "히스토리" },
      { href: "/saved", icon: Star, label: "저장됨", countKey: "saved" },
      { href: "/schedules", icon: CalendarClock, label: "스케줄러", countKey: "schedules" as const },
    ],
  },
  {
    id: "insights",
    label: "인사이트",
    items: [
      { href: "/dashboards", icon: LayoutDashboard, label: "대시보드" },
      { href: "/charts", icon: BarChart2, label: "차트" },
      { href: "/reports", icon: FileText, label: "리포트", badge: "soon" as const },
    ],
  },
  {
    id: "knowledge",
    label: "지식베이스",
    items: [
      { href: "/schema", icon: Table2, label: "스키마" },
      { href: "/glossary", icon: BookOpen, label: "용어 사전" },
      { href: "/catalog", icon: Bot, label: "데이터 카탈로그", badge: "soon" as const },
    ],
  },
  {
    id: "ai",
    label: "AI 설정",
    requiredRole: "ADMIN",
    items: [
      { href: "/ai-providers", icon: Cpu, label: "AI 프로바이더" },
      { href: "/ai-context", icon: Sparkles, label: "AI 컨텍스트" },
    ],
  },
  {
    id: "sources",
    label: "데이터 소스",
    items: [
      { href: "/connections", icon: Plug, label: "연결" },
      { href: "/errors", icon: AlertTriangle, label: "상태 · 에러", requiredRole: "ADMIN" },
    ],
  },
  {
    id: "admin",
    label: "관리자",
    requiredRole: "ADMIN",
    items: [
      { href: "/admin/users", icon: Users, label: "사용자 관리" },
      { href: "/audit-logs", icon: ScrollText, label: "감사 로그" },
    ],
  },
  {
    id: "account",
    label: "계정",
    items: [
      { href: "/profile", icon: User, label: "프로필" },
      { href: "/settings", icon: Settings, label: "설정" },
      { href: "/notifications", icon: Zap, label: "알림", badge: "soon" as const },
    ],
  },
];

interface SidebarProps {
  onOpenCommandPalette?: () => void;
  onOpenChat?: () => void;
  chatOpen?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onOpenCommandPalette, onOpenChat, chatOpen, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeConnectionId = useWorkspaceStore((s) => s.activeConnectionId);

  const { data: currentUser } = useCurrentUser();
  const userRole = currentUser?.role ?? "USER";

  const allGroupIds = navGroups.map((g) => g.id);
  const defaultOpen = Object.fromEntries(allGroupIds.map((id) => [id, true]));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vibesql:sidebar:collapsed");
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        setOpenGroups((prev) => ({ ...prev, ...saved }));
      }
    } catch { /* ignore */ }
  }, []);

  const { data: savedCount } = useQuery({
    queryKey: ["saved"],
    queryFn: async () => {
      const res = await fetch("/api/saved");
      const json = await res.json() as { data?: unknown[] };
      return Array.isArray(json.data) ? json.data : [];
    },
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? data.length : 0),
  });

  const { data: schedulesActiveCount } = useQuery({
    queryKey: ["schedules-count"],
    queryFn: async () => {
      const res = await fetch("/api/schedules");
      const json = await res.json() as { data?: Array<{ isActive: boolean }> };
      return Array.isArray(json.data) ? json.data.filter((s) => s.isActive).length : 0;
    },
    staleTime: 60_000,
  });

  const { data: connections } = useConnections();
  const activeConnection = (connections ?? []).find((c) => c.id === activeConnectionId);

  function canShow(requiredRole?: UserRole): boolean {
    if (!requiredRole) return true;
    // Treat requiredRole as minimum threshold: ADMIN satisfies ADMIN and USER.
    if (requiredRole === "ADMIN") return userRole === "ADMIN";
    return true;
  }

  const visibleGroups = navGroups
    .filter((g) => canShow(g.requiredRole))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => canShow(item.requiredRole)),
    }))
    .filter((g) => g.items.length > 0);

  const allVisibleItems = visibleGroups.flatMap((g) => g.items);

  function isGroupActive(group: NavGroup): boolean {
    return group.items.some(
      (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    );
  }

  function toggleGroup(groupId: string, hasActiveItem: boolean) {
    if (hasActiveItem) return;
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem("vibesql:sidebar:collapsed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.push("/signin");
  }

  const iconOnlyBtn = (icon: React.ReactNode, onClick?: () => void, title?: string, active?: boolean) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--ds-r-6)",
        background: active ? "var(--ds-accent-soft)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "var(--ds-accent)" : "var(--ds-text-faint)",
        transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
      }}
      className={cn(!active && "hover:bg-fill hover:text-text-mute")}
    >
      {icon}
    </button>
  );

  const userInitial = (currentUser?.name ?? currentUser?.email ?? "U").charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: collapsed ? 48 : "var(--ds-sidebar-w)",
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
        overflow: "hidden",
        transition: "width 200ms var(--ds-ease, ease)",
      }}
    >
      {/* Logo / header */}
      <div
        style={{
          padding: collapsed ? "var(--ds-sp-2)" : "var(--ds-sp-2) var(--ds-sp-3)",
          borderBottom: "1px solid var(--ds-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-1)",
        }}
      >
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ds-sp-1)" }}>
            <Link href="/" style={{ textDecoration: "none" }} title="vibeSQL 홈">
              <div
                style={{
                  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--ds-r-6)", cursor: "pointer",
                }}
                className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
              >
                <Zap size={14} style={{ color: "var(--ds-accent)" }} />
              </div>
            </Link>
            <button
              onClick={onToggleCollapse}
              title="사이드바 펼치기 (⌘\\)"
              style={{
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "var(--ds-r-6)", background: "transparent", border: "none", cursor: "pointer",
                color: "var(--ds-text-faint)",
              }}
              className="hover:bg-fill hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
            >
              <ChevronRight size={13} />
            </button>
            <span
              style={{
                width: 6, height: 6, borderRadius: "var(--ds-r-full)",
                background: activeConnection ? "var(--ds-success)" : "var(--ds-text-faint)",
                display: "inline-block", margin: "2px auto",
              }}
              title={activeConnection ? activeConnection.name : "연결 없음"}
            />
          </div>
        ) : (
          <>
            <Link href="/" style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", width: "100%",
                  padding: "var(--ds-sp-1) var(--ds-sp-2)", borderRadius: "var(--ds-r-6)",
                  color: "var(--ds-text)", fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", cursor: "pointer",
                }}
                className="hover:bg-fill transition-colors duration-[var(--ds-dur-fast)]"
              >
                <Zap size={14} style={{ color: "var(--ds-accent)" }} />
                <span style={{ flex: 1 }}>vibeSQL</span>
                <button
                  onClick={(e) => { e.preventDefault(); onToggleCollapse?.(); }}
                  title="사이드바 접기 (⌘\\)"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 20, height: 20, borderRadius: "var(--ds-r-6)",
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--ds-text-faint)", padding: 0,
                  }}
                  className="hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
                >
                  <ChevronLeft size={12} />
                </button>
              </div>
            </Link>

            {/* Active connection chip */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", padding: "var(--ds-sp-1) var(--ds-sp-2)" }}>
              <span style={{
                width: 6, height: 6, borderRadius: "var(--ds-r-full)",
                background: activeConnection ? "var(--ds-success)" : "var(--ds-text-faint)",
                display: "inline-block", flexShrink: 0,
              }} />
              <span style={{
                fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {activeConnection ? activeConnection.name : "연결 없음"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "var(--ds-sp-2)", overflowY: "auto", overflowX: "hidden" }}>
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {allVisibleItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: "var(--ds-r-6)",
                    color: isActive ? "var(--ds-text)" : "var(--ds-text-mute)",
                    background: isActive ? "var(--ds-fill)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--ds-accent)" : "2px solid transparent",
                    textDecoration: "none",
                    transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
                  }}
                  className={cn(!isActive && "hover:bg-fill hover:text-text")}
                >
                  <item.icon size={14} />
                </Link>
              );
            })}
          </div>
        ) : (
          visibleGroups.map((group) => {
            const hasActiveItem = isGroupActive(group);
            const isOpen = hasActiveItem || (openGroups[group.id] ?? true);
            const isAdminGroup = group.requiredRole === "ADMIN";

            return (
              <div key={group.id} style={{ marginBottom: "var(--ds-sp-2)" }}>
                <button
                  onClick={() => toggleGroup(group.id, hasActiveItem)}
                  aria-expanded={isOpen}
                  aria-label={group.label}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--ds-sp-1)", width: "100%",
                    padding: "2px var(--ds-sp-2)", background: "transparent", border: "none",
                    cursor: hasActiveItem ? "default" : "pointer",
                    color: isAdminGroup ? "var(--ds-warn)" : "var(--ds-text-faint)",
                    fontSize: "var(--ds-fs-10)", fontWeight: "var(--ds-fw-semibold)",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    borderRadius: "var(--ds-r-6)", userSelect: "none", marginBottom: 2,
                  }}
                  className={cn(!hasActiveItem && "hover:text-mute transition-colors duration-[var(--ds-dur-fast)]")}
                >
                  {isAdminGroup && <ShieldCheck size={9} />}
                  <span style={{ flex: 1, textAlign: "left" }}>{group.label}</span>
                  {isOpen ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                </button>

                {isOpen && (
                  <div>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                      const count = item.countKey === "saved" ? savedCount : item.countKey === "schedules" ? schedulesActiveCount : undefined;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            display: "flex", alignItems: "center", gap: "var(--ds-sp-2)",
                            padding: "var(--ds-sp-1) var(--ds-sp-3)", borderRadius: "var(--ds-r-6)",
                            fontSize: "var(--ds-fs-12)",
                            color: isActive ? "var(--ds-text)" : "var(--ds-text-mute)",
                            background: isActive ? "var(--ds-fill)" : "transparent",
                            borderLeft: isActive ? "2px solid var(--ds-accent)" : "2px solid transparent",
                            textDecoration: "none", marginBottom: 1,
                            transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
                          }}
                          className={cn("group", !isActive && "hover:bg-fill hover:text-text")}
                        >
                          <item.icon size={14} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.badge === "soon" && (
                            <span style={{
                              fontSize: "var(--ds-fs-9)", fontFamily: "var(--ds-font-sans)",
                              color: "var(--ds-text-faint)", background: "var(--ds-fill)",
                              borderRadius: "var(--ds-r-4)", padding: "1px 4px",
                              letterSpacing: "0.02em",
                            }}>
                              soon
                            </span>
                          )}
                          {count != null && count > 0 && (
                            <span style={{
                              fontSize: "var(--ds-fs-9)", fontFamily: "var(--ds-font-mono)",
                              color: "var(--ds-text-faint)", background: "var(--ds-fill)",
                              borderRadius: "var(--ds-r-full)", padding: "1px 5px",
                            }}>
                              {count}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Bottom: user card + action buttons */}
      <div
        style={{
          borderTop: "1px solid var(--ds-border)",
          padding: collapsed ? "var(--ds-sp-2)" : "var(--ds-sp-2) var(--ds-sp-3)",
          display: "flex",
          flexDirection: "column",
          alignItems: collapsed ? "center" : "stretch",
          gap: 2,
        }}
      >
        {collapsed ? (
          <>
            {iconOnlyBtn(<User size={13} />, undefined, currentUser?.name ?? "사용자")}
            {iconOnlyBtn(<Bot size={13} />, onOpenChat, "AI 어시스턴트 (⌘I)", chatOpen)}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", padding: "var(--ds-sp-1) var(--ds-sp-2)" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "var(--ds-r-full)",
                background: userRole === "ADMIN" ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "var(--ds-fs-10)", fontWeight: "var(--ds-fw-semibold)",
                color: userRole === "ADMIN" ? "var(--ds-accent)" : "var(--ds-text-mute)",
                flexShrink: 0,
              }}>
                {userRole === "ADMIN" ? <Crown size={11} /> : userInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "var(--ds-fs-12)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {currentUser?.name ?? "사용자"}
                </div>
                {userRole === "ADMIN" && (
                  <div style={{ fontSize: "var(--ds-fs-10)", color: "var(--ds-accent)" }}>관리자</div>
                )}
              </div>
              <button
                onClick={handleLogout}
                title="로그아웃"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 20, height: 20, borderRadius: "var(--ds-r-6)",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--ds-text-faint)", padding: 0,
                }}
                className="hover:text-danger transition-colors duration-[var(--ds-dur-fast)]"
              >
                <LogOut size={12} />
              </button>
            </div>
            <button
              onClick={onOpenCommandPalette}
              style={{
                display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", width: "100%",
                padding: "var(--ds-sp-1) var(--ds-sp-2)", borderRadius: "var(--ds-r-6)",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-11)", fontFamily: "var(--ds-font-mono)",
                marginTop: "var(--ds-sp-1)",
              }}
              className="hover:bg-fill hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
            >
              ⌘K 명령 팔레트
            </button>
            <button
              onClick={onOpenChat}
              style={{
                display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", width: "100%",
                padding: "var(--ds-sp-1) var(--ds-sp-2)", borderRadius: "var(--ds-r-6)",
                background: chatOpen ? "var(--ds-accent-soft)" : "transparent",
                border: "none", cursor: "pointer",
                color: chatOpen ? "var(--ds-accent)" : "var(--ds-text-faint)",
                fontSize: "var(--ds-fs-11)", marginTop: 2,
                transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)",
              }}
              className={cn(!chatOpen && "hover:bg-fill hover:text-text-mute")}
            >
              <Bot size={12} style={{ flexShrink: 0 }} />
              <span>AI 어시스턴트</span>
              <span style={{ marginLeft: "auto", fontSize: "var(--ds-fs-10)", fontFamily: "var(--ds-font-mono)", opacity: 0.6 }}>⌘I</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
