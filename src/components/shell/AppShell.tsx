"use client";

import { ReactNode, useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
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
  const openChat = useCallback(() => setChatOpen(true), []);
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
        onOpenChat={openChat}
        chatOpen={chatOpen}
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
