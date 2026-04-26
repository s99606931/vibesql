"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  SquareTerminal,
  Table2,
  BookOpen,
  BarChart2,
  LayoutDashboard,
  History,
  Star,
  Plug,
  Settings,
  Search,
  ArrowRight,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const navCommands = [
  { href: "/workspace", icon: SquareTerminal, label: "워크스페이스", group: "페이지" },
  { href: "/schema", icon: Table2, label: "스키마 브라우저", group: "페이지" },
  { href: "/history", icon: History, label: "히스토리", group: "페이지" },
  { href: "/saved", icon: Star, label: "저장된 쿼리", group: "페이지" },
  { href: "/charts", icon: BarChart2, label: "차트 갤러리", group: "페이지" },
  { href: "/dashboards", icon: LayoutDashboard, label: "대시보드", group: "페이지" },
  { href: "/glossary", icon: BookOpen, label: "비즈니스 용어집", group: "페이지" },
  { href: "/connections", icon: Plug, label: "DB 연결 관리", group: "설정" },
  { href: "/settings", icon: Settings, label: "설정", group: "설정" },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [value, setValue] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onClose]);

  if (!open) return null;

  const groups = Array.from(new Set(navCommands.map((c) => c.group)));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--ds-z-modal)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          background: "var(--ds-surface-2)",
          border: "1px solid var(--ds-border-strong)",
          borderRadius: "var(--ds-r-10)",
          boxShadow: "var(--ds-shadow-modal)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command value={value} onValueChange={setValue}>
          {/* Search input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              padding: "var(--ds-sp-3) var(--ds-sp-4)",
              borderBottom: "1px solid var(--ds-border)",
            }}
          >
            <Search size={15} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
            <Command.Input
              placeholder="페이지로 이동, 쿼리 검색..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-14)",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
              }}
            />
            <kbd
              style={{
                fontFamily: "var(--ds-font-mono)",
                fontSize: "var(--ds-fs-10)",
                color: "var(--ds-text-faint)",
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-r-4)",
                padding: "1px 5px",
              }}
            >
              ESC
            </kbd>
          </div>

          <Command.List
            style={{
              maxHeight: 360,
              overflowY: "auto",
              padding: "var(--ds-sp-2)",
            }}
          >
            <Command.Empty
              style={{
                padding: "var(--ds-sp-8)",
                textAlign: "center",
                fontSize: "var(--ds-fs-13)",
                color: "var(--ds-text-faint)",
              }}
            >
              결과 없음
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group}
                heading={group}
                style={{
                  ["--cmdk-group-heading-color" as string]: "var(--ds-text-faint)",
                }}
              >
                {navCommands
                  .filter((c) => c.group === group)
                  .map((cmd) => (
                    <Command.Item
                      key={cmd.href}
                      value={cmd.label}
                      onSelect={() => {
                        router.push(cmd.href);
                        onClose();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--ds-sp-3)",
                        padding: "var(--ds-sp-2) var(--ds-sp-3)",
                        borderRadius: "var(--ds-r-6)",
                        cursor: "pointer",
                        fontSize: "var(--ds-fs-13)",
                        color: "var(--ds-text)",
                        outline: "none",
                      }}
                      className="aria-selected:bg-fill"
                    >
                      <cmd.icon size={14} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      <ArrowRight size={12} style={{ color: "var(--ds-text-faint)" }} />
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
