/**
 * Auth API 유닛 테스트
 *
 * 커버:
 *  [로그인]    올바른 자격증명 → 200 + 쿠키
 *  [로그인]    잘못된 비밀번호 → 401
 *  [로그인]    이메일 없음 → 401
 *  [로그인]    입력 검증 실패 → 400
 *  [회원가입]  새 사용자 → 201
 *  [회원가입]  중복 이메일 → 409
 *  [회원가입]  짧은 비밀번호 → 400
 *  [me]       쿠키 없음 → dev fallback
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/server
vi.mock("next/server", () => {
  class MockNextResponse {
    private _body: unknown;
    status: number;
    headers = new Map<string, string>();
    cookies = {
      _store: new Map<string, string>(),
      set: function(name: string, value: string, _opts?: unknown) { this._store.set(name, value); },
      get: function(name: string) { return this._store.get(name); },
    };
    constructor(body: unknown, init?: ResponseInit) {
      this._body = body;
      this.status = init?.status ?? 200;
    }
    async json() { return this._body; }
    static json(body: unknown, init?: ResponseInit) { return new MockNextResponse(body, init); }
  }
  return { NextResponse: MockNextResponse };
});

// Mock mem-ai-providers (used by other routes transitively)
vi.mock("@/lib/db/mem-ai-providers", () => ({ memAiProviders: [] }));

// Shared mutable in-memory users — reset between tests
import { memUsers } from "@/lib/db/mem-users";
const ORIGINAL_USER_COUNT = memUsers.length;

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    // restore to default users
    memUsers.splice(0);
    // re-import to get fresh hashed defaults
  });

  it("관리자 계정 로그인 성공 → 200 + 쿠키 설정", async () => {
    const { memUsers: mu } = await import("@/lib/db/mem-users");
    // ensure default admin exists
    const admin = mu.find((u) => u.email === "admin@vibesql.dev");
    expect(admin).toBeTruthy();

    const { POST } = await import("../login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@vibesql.dev", password: "admin123" }),
    });
    const res = await POST(req) as unknown as { status: number; json: () => Promise<unknown>; cookies: { _store: Map<string, string> } };
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { role: string } };
    expect(body.data.role).toBe("ADMIN");
    expect(res.cookies._store.has("vs-session")).toBe(true);
  });

  it("일반 사용자 로그인 → role USER", async () => {
    const { POST } = await import("../login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@vibesql.dev", password: "user123" }),
    });
    const res = await POST(req) as { status: number; json: () => Promise<unknown> };
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { role: string } };
    expect(body.data.role).toBe("USER");
  });

  it("잘못된 비밀번호 → 401", async () => {
    const { POST } = await import("../login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@vibesql.dev", password: "wrongpassword" }),
    });
    const res = await POST(req) as { status: number };
    expect(res.status).toBe(401);
  });

  it("없는 이메일 → 401", async () => {
    const { POST } = await import("../login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "password" }),
    });
    const res = await POST(req) as { status: number };
    expect(res.status).toBe(401);
  });

  it("이메일 형식 오류 → 400", async () => {
    const { POST } = await import("../login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "notanemail", password: "password" }),
    });
    const res = await POST(req) as { status: number };
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", ""); // force in-memory path — register tests operate on memUsers
    vi.resetModules();
    // Remove any test-created users, keep defaults
    memUsers.splice(ORIGINAL_USER_COUNT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("새 사용자 등록 → 201", async () => {
    const { POST } = await import("../register/route");
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newuser@test.com", password: "password123", name: "신규" }),
    });
    const res = await POST(req) as { status: number; json: () => Promise<unknown> };
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string } };
    expect(body.data.email).toBe("newuser@test.com");
  });

  it("짧은 비밀번호 → 400", async () => {
    const { POST } = await import("../register/route");
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "short@test.com", password: "1234567", name: "테스트" }),
    });
    const res = await POST(req) as { status: number };
    expect(res.status).toBe(400);
  });

  it("중복 이메일 → 409", async () => {
    const { POST } = await import("../register/route");
    // first registration
    const req1 = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@test.com", password: "password123", name: "첫번째" }),
    });
    await POST(req1);

    // second registration with same email
    const req2 = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@test.com", password: "password456", name: "두번째" }),
    });
    const res = await POST(req2) as { status: number };
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/logout", () => {
  it("로그아웃 → 쿠키 만료", async () => {
    const { POST } = await import("../logout/route");
    const res = await POST() as unknown as { status: number; cookies: { _store: Map<string, string> } };
    expect(res.status).toBe(200);
    // vs-session cookie should be set to empty (maxAge 0 = expire)
    expect(res.cookies._store.get("vs-session")).toBe("");
  });
});
