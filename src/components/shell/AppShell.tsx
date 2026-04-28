"use client";

import { ReactNode, useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { AiChatPanel } from "./AiChatPanel";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useConnections } from "@/hooks/useConnections";

const SIDEBAR_FULL = 220;
const SIDEBAR_COLLAPSED = 48;
const CHAT_DEFAULT_W = 380;
const CHAT_MIN_W = 280;
const CHAT_MAX_W = 720;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_W);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const pathname = usePathname();
  const { nlQuery, sql, activeConnectionId, setSql } = useWorkspaceStore();
  const { data: connections } = useConnections();

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const toggleChat = useCallback(() => setChatOpen((v) => !v), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const activeConnection = useMemo(
    () => (connections ?? []).find((c) => c.id === activeConnectionId),
    [connections, activeConnectionId]
  );

  const chatContext = useMemo(() => ({
    sql: sql || undefined,
    nlQuery: nlQuery || undefined,
    dialect: (activeConnection as { dialect?: string } | undefined)?.dialect ?? undefined,
    connectionName: activeConnection?.name ?? undefined,
    currentPage: pathname ?? undefined,
  }), [sql, nlQuery, activeConnection, pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;
  const transition = "margin var(--ds-dur-normal, 200ms) var(--ds-ease, ease), width var(--ds-dur-normal, 200ms) var(--ds-ease, ease)";

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ds-bg)" }}>
      <a
        href="#main-content"
        data-testid="skip-to-main"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
          zIndex: 9999,
        }}
        onFocus={(e) => { e.currentTarget.style.left = "0"; e.currentTarget.style.width = "auto"; e.currentTarget.style.height = "auto"; e.currentTarget.style.padding = "var(--ds-sp-2) var(--ds-sp-4)"; e.currentTarget.style.background = "var(--ds-accent)"; e.currentTarget.style.color = "var(--ds-accent-on)"; e.currentTarget.style.borderRadius = "var(--ds-r-6)"; }}
        onBlur={(e) => { e.currentTarget.style.left = "-9999px"; e.currentTarget.style.width = "1px"; e.currentTarget.style.height = "1px"; e.currentTarget.style.padding = ""; }}
      >
        본문으로 건너뛰기
      </a>
      <Sidebar
        onOpenCommandPalette={openCmd}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <main
        id="main-content"
        style={{
          flex: 1,
          marginLeft: sidebarW,
          marginRight: chatOpen ? chatWidth : 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
          transition,
        }}
      >
        {children}
      </main>
      {/* Global AI assistant button — fixed in top-right, aligned with TopBar height */}
      <button
        type="button"
        aria-label={chatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}
        aria-pressed={chatOpen}
        aria-keyshortcuts="Meta+i"
        onClick={toggleChat}
        title="AI 어시스턴트 (⌘I)"
        style={{
          position: "fixed",
          top: 0,
          right: chatOpen ? chatWidth : 0,
          width: 152,
          height: "var(--ds-topbar-h)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--ds-sp-2)",
          padding: "0 var(--ds-sp-4)",
          background: chatOpen ? "var(--ds-accent-soft)" : "var(--ds-surface)",
          border: "none",
          borderLeft: "1px solid var(--ds-border)",
          borderBottom: "1px solid var(--ds-border)",
          cursor: "pointer",
          color: chatOpen ? "var(--ds-accent)" : "var(--ds-text-mute)",
          fontSize: "var(--ds-fs-12)",
          fontWeight: "var(--ds-fw-medium)",
          zIndex: "calc(var(--ds-z-sticky) + 1)",
          transition: "background var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease), right var(--ds-dur-normal, 200ms) var(--ds-ease, ease)",
        }}
        className={cn(!chatOpen && "hover:bg-fill hover:text-text")}
      >
        <Bot aria-hidden="true" size={14} style={{ flexShrink: 0 }} />
        <span>AI 어시스턴트</span>
        <span style={{ fontSize: "var(--ds-fs-10)", fontFamily: "var(--ds-font-mono)", opacity: 0.6 }}>⌘I</span>
      </button>
      <CommandPalette open={cmdOpen} onClose={closeCmd} />
      <AiChatPanel
        open={chatOpen}
        onClose={closeChat}
        width={chatWidth}
        onWidthChange={setChatWidth}
        minWidth={CHAT_MIN_W}
        maxWidth={CHAT_MAX_W}
        context={chatContext}
        onApplySql={setSql}
      />
    </div>
  );
}
