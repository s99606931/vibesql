import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Next.js server module
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      json: async () => body,
      status: init?.status ?? 200,
    })),
  },
}));

// Isolate the in-memory store between tests by re-importing the module
// fresh each time via vi.resetModules().
// DATABASE_URL is unset so routes use in-memory store.

describe("GET /api/connections — in-memory store", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("초기 상태에서 빈 배열 반환", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    const body = await (res as { json: () => Promise<unknown> }).json();
    expect((body as { data: unknown[] }).data).toEqual([]);
  });

  it("연결 추가 후 목록에 포함", async () => {
    const { addConnection } = await import("@/lib/connections/store");
    addConnection({
      id: "conn-1",
      name: "로컬 PG",
      type: "postgresql",
      database: "testdb",
      ssl: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("../route");
    const res = await GET();
    const body = await (res as { json: () => Promise<unknown> }).json();
    const data = (body as { data: { id: string }[] }).data;
    expect(data.some((c) => c.id === "conn-1")).toBe(true);
  });

  it("비밀번호 필드(passwordBase64)는 응답에서 제거", async () => {
    const { addConnection } = await import("@/lib/connections/store");
    addConnection({
      id: "conn-secret",
      name: "비밀 연결",
      type: "mysql",
      database: "secdb",
      ssl: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      passwordBase64: "c2VjcmV0",
    });

    const { GET } = await import("../route");
    const res = await GET();
    const body = await (res as { json: () => Promise<unknown> }).json();
    const data = (body as { data: Record<string, unknown>[] }).data;
    const conn = data.find((c) => c["id"] === "conn-secret");
    expect(conn).toBeDefined();
    expect(conn!["passwordBase64"]).toBeUndefined();
  });
});

describe("POST /api/connections — 유효성 검사", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("필수 필드 누락 → 400 반환", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      body: JSON.stringify({ name: "테스트" }), // type, database 누락
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
    const body = await (res as { json: () => Promise<unknown> }).json();
    expect((body as { error: string }).error).toBeTruthy();
  });

  it("올바른 연결 생성 → 201 + 연결 정보 반환", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      body: JSON.stringify({
        name: "신규 연결",
        type: "postgresql",
        host: "localhost",
        port: 5432,
        database: "mydb",
        username: "admin",
        ssl: false,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(201);
    const body = await (res as { json: () => Promise<unknown> }).json();
    const data = (body as { data: Record<string, unknown> }).data;
    expect(data["name"]).toBe("신규 연결");
    expect(data["id"]).toBeTruthy();
    expect(data["passwordBase64"]).toBeUndefined();
  });

  it("password 포함 시 응답에서 제거", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      body: JSON.stringify({
        name: "비밀번호 연결",
        type: "mysql",
        database: "db",
        password: "secret123",
        ssl: false,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await (res as { json: () => Promise<unknown> }).json();
    const data = (body as { data: Record<string, unknown> }).data;
    expect(data["password"]).toBeUndefined();
    expect(data["passwordBase64"]).toBeUndefined();
  });

  it("지원하지 않는 dialect → 400", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      body: JSON.stringify({
        name: "몽고",
        type: "mongodb", // 지원 안 함
        database: "db",
        ssl: false,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });
});
