/**
 * 관리자 사용자 관리 API 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/mem-ai-providers", () => ({ memAiProviders: [] }));

const mockRequireUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => mockRequireUser(),
  requireUserId: async () => "admin-1",
}));

import { memUsers } from "@/lib/db/mem-users";
import { GET } from "../users/route";
import { PATCH, DELETE } from "../users/[id]/route";

function adminSession() {
  return { userId: "admin-1", email: "admin@vibesql.dev", name: "관리자", role: "ADMIN" as const };
}
function userSession() {
  return { userId: "dev-user", email: "user@vibesql.dev", name: "사용자", role: "USER" as const };
}

beforeEach(() => {
  mockRequireUser.mockResolvedValue(adminSession());
  // Remove any extra users added during tests
  while (memUsers.length > 2) memUsers.pop();
  // Ensure dev-user role is USER
  const devUser = memUsers.find((u) => u.id === "dev-user");
  if (devUser) devUser.role = "USER";
});

describe("GET /api/admin/users", () => {
  it("관리자 → 사용자 목록 반환", async () => {
    const res = await GET() as { status: number; json: () => Promise<unknown> };
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("일반 사용자 → 403", async () => {
    mockRequireUser.mockResolvedValueOnce(userSession());
    const res = await GET() as { status: number };
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("USER → ADMIN 역할 변경 성공", async () => {
    const req = new Request("http://localhost/api/admin/users/dev-user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "dev-user" }) }) as { status: number };
    expect(res.status).toBe(200);
    const devUser = memUsers.find((u) => u.id === "dev-user");
    expect(devUser?.role).toBe("ADMIN");
  });

  it("자기 자신 강등 → 400", async () => {
    const req = new Request("http://localhost/api/admin/users/admin-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "USER" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) }) as { status: number };
    expect(res.status).toBe(400);
  });

  it("일반 사용자 → 403", async () => {
    mockRequireUser.mockResolvedValueOnce(userSession());
    const req = new Request("http://localhost/api/admin/users/dev-user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "dev-user" }) }) as { status: number };
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  let tempId: string;

  beforeEach(() => {
    tempId = `temp-del-${Date.now()}`;
    memUsers.push({ id: tempId, email: `del-${tempId}@test.com`, name: "삭제테스트", passwordHash: "x", role: "USER", createdAt: new Date() });
  });

  afterEach(() => {
    const idx = memUsers.findIndex((u) => u.id === tempId);
    if (idx !== -1) memUsers.splice(idx, 1);
  });

  it("사용자 삭제 성공 → 200", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: tempId }) }) as { status: number };
    expect(res.status).toBe(200);
    expect(memUsers.find((u) => u.id === tempId)).toBeUndefined();
  });

  it("자기 자신 삭제 → 400", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "admin-1" }) }) as { status: number };
    expect(res.status).toBe(400);
  });

  it("없는 사용자 삭제 → 404", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "no-such-id-xyz" }) }) as { status: number };
    expect(res.status).toBe(404);
  });
});
