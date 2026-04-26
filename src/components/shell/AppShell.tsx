import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ds-bg)" }}>
      <Sidebar />
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
    </div>
  );
}
