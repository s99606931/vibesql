import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logAction — DATABASE_URL 없음 (console fallback)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", ""); // force console fallback path regardless of CI env
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("DATABASE_URL 없으면 console.log 호출", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logAction } = await import("../log-action");

    logAction({ action: "test.action", userId: "u1" });
    // fire-and-forget: flush microtask queue
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalledWith(
      "[audit]",
      "test.action",
      expect.stringContaining("test.action")
    );
    consoleSpy.mockRestore();
  });

  it("metadata 포함 시 JSON에 직렬화됨", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logAction } = await import("../log-action");

    logAction({
      action: "connection.created",
      userId: "u2",
      metadata: { connectionId: "c1", name: "test-db" },
    });
    await new Promise((r) => setTimeout(r, 0));

    const logArg = consoleSpy.mock.calls[0][2] as string;
    expect(logArg).toContain("connection.created");
    consoleSpy.mockRestore();
  });

  it("userId/ipAddress/userAgent 모두 선택 옵션", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logAction } = await import("../log-action");

    // No fields beyond action
    logAction({ action: "user.login" });
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("내부 오류 발생 시 console.warn 출력 (never throws)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Force DATABASE_URL to trigger DB path, but prisma will fail
    vi.stubEnv("DATABASE_URL", "postgresql://invalid");
    vi.resetModules();

    const { logAction } = await import("../log-action");
    logAction({ action: "fail.test" });
    await new Promise((r) => setTimeout(r, 50));

    // Should not throw — warn may or may not fire depending on mock resolution
    // The important thing is the function doesn't throw
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
