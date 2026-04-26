import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ---- next/navigation ----
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/workspace"),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

// ---- next/link ----
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ---- next/dynamic ---- (SqlEditor / ResultChart use dynamic imports)
vi.mock("next/dynamic", () => ({
  default: (_loader: unknown, _opts: unknown) => {
    // Return a simple stub component for every dynamic import
    const Stub = ({ children }: { children?: React.ReactNode }) => <div data-testid="dynamic-stub">{children}</div>;
    Stub.displayName = "DynamicStub";
    return Stub;
  },
}));

// ---- @tanstack/react-query ----
// Keep a reference to mutationFn so tests can invoke it
let _generateMutationFn: ((payload: unknown) => Promise<unknown>) | null = null;

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: [] })),
  useMutation: vi.fn(({ mutationFn }: { mutationFn: (payload: unknown) => Promise<unknown> }) => {
    _generateMutationFn = mutationFn;
    return {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
    };
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    fetchQuery: vi.fn().mockResolvedValue([]),
  })),
}));

// ---- @/store/useWorkspaceStore ----
// We need the real store so state mutations work during tests
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

// ---- @/store/useSettingsStore ----
vi.mock("@/store/useSettingsStore", () => ({
  useSettingsStore: vi.fn(() => ({ dialect: "postgresql" })),
}));

// ---- @/hooks/useConnections ----
vi.mock("@/hooks/useConnections", () => ({
  useConnections: vi.fn(() => ({ data: [] })),
}));

// ---- workspace sub-components (heavy / unneeded in these tests) ----
vi.mock("@/components/workspace/ResultTable", () => ({
  ResultTable: () => <div data-testid="result-table" />,
}));

vi.mock("@/components/workspace/ResultChart", () => ({
  default: () => <div data-testid="result-chart" />,
}));

vi.mock("@/components/workspace/SqlEditor", () => ({
  SqlEditor: ({ value }: { value: string }) => (
    <textarea data-testid="sql-editor" readOnly value={value} />
  ),
}));

// ---- now import the page (after all mocks are declared) ----
import WorkspacePage from "../page";

// ---- helpers ----

function renderPage() {
  return render(<WorkspacePage />);
}

// Simulate what WorkspacePage.handleGenerate does after the API responds:
// It calls setSql, setExplanation, setConfidence, setStatus via the store.
// We drive that directly to avoid mocking fetch with complex orchestration.
function simulateGenerate(confidence: "high" | "medium" | "low") {
  act(() => {
    useWorkspaceStore.getState().setSql("SELECT 1");
    useWorkspaceStore.getState().setStatus("ready");
  });

  // The confidence badge lives in component local state (useState) so we need
  // to trigger the real handleGenerate. We do that by:
  // 1. Typing in the textarea
  // 2. Mocking global fetch to return the confidence value
  // 3. Clicking "SQL 생성"
  // The store-based simulation above covers the SQL display part;
  // confidence state is purely local → we must actually click through.
}

// ---------------------------------------------------------------------------
// We control confidence by mocking global.fetch to return a controlled JSON
// payload when /api/queries/generate is called.
// ---------------------------------------------------------------------------
function mockFetchForGenerate(confidence: "high" | "medium" | "low") {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    // schema / glossary parallel fetches
    if (typeof url === "string" && (url.includes("/api/schema") || url.includes("/api/glossary"))) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    // generate endpoint
    if (typeof url === "string" && url.includes("/api/queries/generate")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => null) },
        json: () =>
          Promise.resolve({
            data: {
              sql: "SELECT 1",
              explanation: "This selects one",
              confidence,
            },
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }) as typeof global.fetch;
}

describe("WorkspacePage — confidence score badge", () => {
  beforeEach(() => {
    // Reset workspace store to idle before each test
    useWorkspaceStore.getState().reset();
    _generateMutationFn = null;
    vi.clearAllMocks();
  });

  it("shows no confidence badge initially (idle state)", () => {
    renderPage();
    // The badge text values
    expect(screen.queryByText("신뢰도 높음")).not.toBeInTheDocument();
    expect(screen.queryByText("신뢰도 중간")).not.toBeInTheDocument();
    expect(screen.queryByText("신뢰도 낮음")).not.toBeInTheDocument();
  });

  it("shows green 신뢰도 높음 badge after SQL generation with confidence=high", async () => {
    mockFetchForGenerate("high");
    renderPage();

    // Type a query
    const textarea = screen.getByPlaceholderText(/결제 사용자에 대해/);
    fireEvent.change(textarea, { target: { value: "오늘 활성 사용자" } });

    // Click generate
    const generateButton = screen.getByRole("button", { name: /SQL 생성/ });
    fireEvent.click(generateButton);

    // Wait for the badge to appear
    const badge = await screen.findByText("신뢰도 높음");
    expect(badge).toBeInTheDocument();

    // Color should use ds-success token
    expect(badge).toHaveStyle({ color: "var(--ds-success)" });
  });

  it("shows yellow 신뢰도 중간 badge after SQL generation with confidence=medium", async () => {
    mockFetchForGenerate("medium");
    renderPage();

    const textarea = screen.getByPlaceholderText(/결제 사용자에 대해/);
    fireEvent.change(textarea, { target: { value: "주간 매출 추이" } });

    const generateButton = screen.getByRole("button", { name: /SQL 생성/ });
    fireEvent.click(generateButton);

    const badge = await screen.findByText("신뢰도 중간");
    expect(badge).toBeInTheDocument();

    expect(badge).toHaveStyle({ color: "var(--ds-warn)" });
  });

  it("shows red 신뢰도 낮음 badge after SQL generation with confidence=low", async () => {
    mockFetchForGenerate("low");
    renderPage();

    const textarea = screen.getByPlaceholderText(/결제 사용자에 대해/);
    fireEvent.change(textarea, { target: { value: "결제 실패율" } });

    const generateButton = screen.getByRole("button", { name: /SQL 생성/ });
    fireEvent.click(generateButton);

    const badge = await screen.findByText("신뢰도 낮음");
    expect(badge).toBeInTheDocument();

    expect(badge).toHaveStyle({ color: "var(--ds-danger)" });
  });
});
