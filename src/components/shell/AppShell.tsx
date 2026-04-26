"use client";

import { ReactNode, useState, useCallback, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { AiChatPanel } from "./AiChatPanel";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

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
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ds-bg)" }}>
      <Sidebar onOpenCommandPalette={openCmd} onOpenChat={openChat} chatOpen={chatOpen} />
      <main
        style={{
          flex: 1,
          marginLeft: "var(--ds-sidebar-w)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
          transition: "margin-right var(--ds-dur-fast) var(--ds-ease)",
        }}
      >
        {children}
      </main>
      <CommandPalette open={cmdOpen} onClose={closeCmd} />
      <AiChatPanel open={chatOpen} onClose={closeChat} />
    </div>
  );
}
