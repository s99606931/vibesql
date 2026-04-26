import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

// --- Mock next/navigation ---
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/workspace"),
}));

// --- Mock next/link to render a plain anchor ---
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// --- Mock @tanstack/react-query ---
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: 0 })),
}));

// --- Mock @/hooks/useConnections ---
vi.mock("@/hooks/useConnections", () => ({
  useConnections: vi.fn(() => ({ data: [] })),
}));

// --- Mock @/store/useWorkspaceStore ---
vi.mock("@/store/useWorkspaceStore", () => ({
  useWorkspaceStore: vi.fn((selector: (s: { activeConnectionId: null }) => unknown) =>
    selector({ activeConnectionId: null })
  ),
}));

// --- Import mocked modules for per-test reconfiguration ---
import { usePathname } from "next/navigation";
const mockUsePathname = vi.mocked(usePathname);

function resetToDefaultMocks() {
  mockUsePathname.mockReturnValue("/workspace");
}

describe("Sidebar — 6-group structure", () => {
  beforeEach(() => {
    resetToDefaultMocks();
  });

  it("renders all 6 group headers", () => {
    render(<Sidebar />);

    // Group header buttons contain the label inside a flex span.
    // "워크스페이스" also appears as a nav link so we look for buttons that
    // contain each group label text.
    const buttons = screen.getAllByRole("button");
    const buttonTexts = buttons.map((b) => b.textContent ?? "");

    const groupLabels = ["워크스페이스", "인사이트", "지식베이스", "AI 설정", "데이터 소스", "계정"];
    groupLabels.forEach((label) => {
      const found = buttonTexts.some((t) => t.includes(label));
      expect(found, `Expected a button containing "${label}"`).toBe(true);
    });
  });

  it("all groups are open by default — nav items from every group are visible", () => {
    render(<Sidebar />);

    // Workspace group items
    expect(screen.getByText("템플릿")).toBeInTheDocument();
    expect(screen.getByText("히스토리")).toBeInTheDocument();
    expect(screen.getByText("저장됨")).toBeInTheDocument();

    // Insights group items
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("차트")).toBeInTheDocument();

    // Knowledge group items
    expect(screen.getByText("스키마")).toBeInTheDocument();
    expect(screen.getByText("용어 사전")).toBeInTheDocument();

    // AI 설정 group items
    expect(screen.getByText("AI 프로바이더")).toBeInTheDocument();
    expect(screen.getByText("AI 컨텍스트")).toBeInTheDocument();

    // Sources group items
    expect(screen.getByText("연결")).toBeInTheDocument();
    expect(screen.getByText("상태 · 에러")).toBeInTheDocument();

    // Account group items
    expect(screen.getByText("프로필")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getByText("감사 로그")).toBeInTheDocument();
  });

  it("clicking a non-active group header toggles it closed", () => {
    // Pathname is /workspace so "워크스페이스" group is active.
    // "인사이트" group has no active item → it can be collapsed.
    render(<Sidebar />);

    // Verify "대시보드" (an insights item) is visible before toggle
    expect(screen.getByText("대시보드")).toBeInTheDocument();

    // Find the group header button for 인사이트.
    // The group header buttons contain the label text as a <span> child.
    const groupButtons = screen.getAllByRole("button");
    const insightsButton = groupButtons.find((btn) => btn.textContent?.includes("인사이트"));
    expect(insightsButton).toBeTruthy();

    fireEvent.click(insightsButton!);

    // After collapsing, 대시보드 should no longer be in the DOM
    expect(screen.queryByText("대시보드")).not.toBeInTheDocument();
    expect(screen.queryByText("차트")).not.toBeInTheDocument();
  });

  it("active group cannot be collapsed — clicking its header keeps items visible", () => {
    // /workspace makes the "워크스페이스" group active
    render(<Sidebar />);

    // The workspace group header button
    const groupButtons = screen.getAllByRole("button");
    const workspaceButton = groupButtons.find((btn) => {
      // The button spans contain the Korean label; filter by text content
      // but avoid matching the nav link labeled "워크스페이스" inside the group
      return btn.textContent?.trim().startsWith("워크스페이스");
    });
    expect(workspaceButton).toBeTruthy();

    // 히스토리 is inside the workspace group and should be visible
    expect(screen.getByText("히스토리")).toBeInTheDocument();

    fireEvent.click(workspaceButton!);

    // Items should STILL be visible because the group is active
    expect(screen.getByText("히스토리")).toBeInTheDocument();
    expect(screen.getByText("저장됨")).toBeInTheDocument();
  });

  it("navigation links render with correct hrefs within groups", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /히스토리/ })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: /저장됨/ })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: /대시보드/ })).toHaveAttribute("href", "/dashboards");
    expect(screen.getByRole("link", { name: /차트/ })).toHaveAttribute("href", "/charts");
    expect(screen.getByRole("link", { name: /스키마/ })).toHaveAttribute("href", "/schema");
    expect(screen.getByRole("link", { name: /용어 사전/ })).toHaveAttribute("href", "/glossary");
    expect(screen.getByRole("link", { name: /템플릿/ })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: /AI 프로바이더/ })).toHaveAttribute("href", "/ai-providers");
    expect(screen.getByRole("link", { name: /AI 컨텍스트/ })).toHaveAttribute("href", "/ai-context");
    expect(screen.getByRole("link", { name: /연결/ })).toHaveAttribute("href", "/connections");
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: /설정/ })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /감사 로그/ })).toHaveAttribute("href", "/audit-logs");
  });

  it("re-clicking a collapsed non-active group reopens it", () => {
    render(<Sidebar />);

    const groupButtons = screen.getAllByRole("button");
    const accountButton = groupButtons.find((btn) => btn.textContent?.includes("계정"));
    expect(accountButton).toBeTruthy();

    // Collapse account group
    fireEvent.click(accountButton!);
    expect(screen.queryByText("프로필")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(accountButton!);
    expect(screen.getByText("프로필")).toBeInTheDocument();
  });
});
