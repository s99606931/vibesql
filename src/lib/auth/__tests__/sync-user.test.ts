import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted at top level as required by Vitest
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: "u1", email: "test@test.com" }),
    },
    userSettings: {
      upsert: vi.fn().mockResolvedValue({ userId: "u1" }),
    },
  },
}));

describe("syncUser — DATABASE_URL 없음 (즉시 반환)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("DATABASE_URL 없으면 즉시 반환 (에러 없음)", async () => {
    const { syncUser } = await import("../sync-user");
    await expect(syncUser({ userId: "u1", email: "a@b.com" })).resolves.toBeUndefined();
  });

  it("최소 파라미터 (userId만) — 에러 없음", async () => {
    const { syncUser } = await import("../sync-user");
    await expect(syncUser({ userId: "u2" })).resolves.toBeUndefined();
  });

  it("name/avatarUrl 포함 — 에러 없음", async () => {
    const { syncUser } = await import("../sync-user");
    await expect(
      syncUser({ userId: "u3", name: "홍길동", avatarUrl: "https://cdn.example.com/avatar.png" })
    ).resolves.toBeUndefined();
  });
});

describe("syncUser — DATABASE_URL 설정 시", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  });

  it("Prisma upsert 호출 성공", async () => {
    const { syncUser } = await import("../sync-user");
    await expect(syncUser({ userId: "u4", email: "test@test.com" })).resolves.toBeUndefined();

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u4" } })
    );
    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u4" } })
    );
  });

  it("email 없으면 placeholder 이메일 사용", async () => {
    const { syncUser } = await import("../sync-user");
    await syncUser({ userId: "u5" });

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: expect.stringContaining("@placeholder.local") }),
      })
    );
  });

  it("Prisma 오류 발생해도 throw 안 함", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.user.upsert).mockRejectedValueOnce(new Error("DB down"));

    const { syncUser } = await import("../sync-user");
    await expect(syncUser({ userId: "u6" })).resolves.toBeUndefined();
  });
});
