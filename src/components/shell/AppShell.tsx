"use client";

import { ReactNode, useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ds-bg)" }}>
      <Sidebar onOpenCommandPalette={openCmd} />
      <main
        style={{
          flex: 1,
          marginLeft: "var(--ds-sidebar-w)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {children}
      </main>
      <CommandPalette open={cmdOpen} onClose={closeCmd} />
    </div>
  );
}
