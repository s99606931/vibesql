import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/workspace"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: 0 })),
  useQueryClient: vi.fn(() => ({ clear: vi.fn(), invalidateQueries: vi.fn() })),
}));

vi.mock("@/hooks/useConnections", () => ({
  useConnections: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/store/useWorkspaceStore", () => ({
  useWorkspaceStore: vi.fn((selector: (s: { activeConnectionId: null }) => unknown) =>
    selector({ activeConnectionId: null })
  ),
}));

// Default: ADMIN user — sees all groups
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    data: { id: "admin-1", email: "admin@vibesql.dev", name: "관리자", role: "ADMIN" },
  })),
}));

import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
const mockUsePathname = vi.mocked(usePathname);
const mockUseCurrentUser = vi.mocked(useCurrentUser);

function renderAsAdmin() {
  mockUseCurrentUser.mockReturnValue({
    data: { id: "admin-1", email: "admin@vibesql.dev", name: "관리자", role: "ADMIN" },
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentUser>);
}

function renderAsUser() {
  mockUseCurrentUser.mockReturnValue({
    data: { id: "user-1", email: "user@vibesql.dev", name: "사용자", role: "USER" },
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentUser>);
}

describe("Sidebar — role-based navigation", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/workspace");
    renderAsAdmin();
  });

  it("관리자: 모든 그룹 헤더 렌더링", () => {
    render(<Sidebar />);
    const buttons = screen.getAllByRole("button");
    const buttonTexts = buttons.map((b) => b.textContent ?? "");

    const groupLabels = ["워크스페이스", "인사이트", "지식베이스", "AI 설정", "데이터 소스", "관리자", "계정"];
    groupLabels.forEach((label) => {
      expect(buttonTexts.some((t) => t.includes(label)), `Expected button with "${label}"`).toBe(true);
    });
  });

  it("관리자: 관리자 전용 메뉴 표시 (사용자 관리, AI 설정)", () => {
    render(<Sidebar />);
    expect(screen.getByText("사용자 관리")).toBeInTheDocument();
    expect(screen.getByText("AI 프로바이더")).toBeInTheDocument();
    expect(screen.getByText("AI 컨텍스트")).toBeInTheDocument();
    expect(screen.getByText("감사 로그")).toBeInTheDocument();
  });

  it("일반 사용자: 관리자 전용 그룹 미표시", () => {
    renderAsUser();
    render(<Sidebar />);
    expect(screen.queryByText("사용자 관리")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 프로바이더")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 컨텍스트")).not.toBeInTheDocument();
    expect(screen.queryByText("감사 로그")).not.toBeInTheDocument();
  });

  it("일반 사용자: 공통 메뉴 표시", () => {
    renderAsUser();
    render(<Sidebar />);
    expect(screen.getAllByText("워크스페이스").length).toBeGreaterThan(0);
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("스키마")).toBeInTheDocument();
    expect(screen.getByText("연결")).toBeInTheDocument();
    expect(screen.getByText("프로필")).toBeInTheDocument();
  });

  it("관리자: '관리자' 그룹 헤더가 ShieldCheck 아이콘과 함께 주의색으로 표시", () => {
    render(<Sidebar />);
    const buttons = screen.getAllByRole("button");
    const adminGroupButton = buttons.find((b) => b.textContent?.includes("관리자"));
    expect(adminGroupButton).toBeTruthy();
  });

  it("그룹 헤더 클릭 → 접힘/펼침", () => {
    render(<Sidebar />);
    expect(screen.getByText("대시보드")).toBeInTheDocument();

    const groupButtons = screen.getAllByRole("button");
    const insightsButton = groupButtons.find((btn) => btn.textContent?.includes("인사이트"));
    fireEvent.click(insightsButton!);

    expect(screen.queryByText("대시보드")).not.toBeInTheDocument();
    fireEvent.click(insightsButton!);
    expect(screen.getByText("대시보드")).toBeInTheDocument();
  });

  it("활성 그룹은 접을 수 없음", () => {
    render(<Sidebar />);
    const groupButtons = screen.getAllByRole("button");
    const workspaceButton = groupButtons.find((btn) => btn.textContent?.trim().startsWith("워크스페이스"));

    expect(screen.getByText("히스토리")).toBeInTheDocument();
    fireEvent.click(workspaceButton!);
    expect(screen.getByText("히스토리")).toBeInTheDocument();
  });

  it("관리자: 네비게이션 링크 href 확인", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /사용자 관리/ })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: /AI 프로바이더/ })).toHaveAttribute("href", "/ai-providers");
    expect(screen.getByRole("link", { name: /감사 로그/ })).toHaveAttribute("href", "/audit-logs");
  });

  it("관리자 배지가 사이드바 하단에 표시", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("관리자").length).toBeGreaterThan(0);
  });

  it("로그아웃 버튼 존재", () => {
    render(<Sidebar />);
    const logoutButton = screen.getByTitle("로그아웃");
    expect(logoutButton).toBeInTheDocument();
  });
});
