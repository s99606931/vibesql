"use client";

import { ReactNode, useState, useCallback, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { AiChatPanel } from "./AiChatPanel";

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

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

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
      <Sidebar
        onOpenCommandPalette={openCmd}
        onOpenChat={openChat}
        chatOpen={chatOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <main
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
      />
    </div>
  );
}
