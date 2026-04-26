import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => {
  class MockNextResponse {
    private _body: unknown;
    status: number;
    constructor(body: unknown, init?: ResponseInit) {
      this._body = body;
      this.status = init?.status ?? 200;
    }
    async json() { return this._body; }
    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

const VALID_SQL_RESULT = {
  sql: "SELECT id, name FROM users LIMIT 10",
  explanation: "사용자 10명을 조회합니다",
  confidence: "high",
};

describe("POST /api/queries/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear rate-limit store between tests by resetting the module
  });

  it("입력 누락 → 400", async () => {
    const { POST } = await import("../generate/route");
    const req = new Request("http://localhost/api/queries/generate", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.1.1.1" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it("nl이 빈 문자열 → 400", async () => {
    const { POST } = await import("../generate/route");
    const req = new Request("http://localhost/api/queries/generate", {
      method: "POST",
      body: JSON.stringify({ nl: "", dialect: "postgresql" }),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "2.2.2.2" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it("LLM 미설정 → 500 오류 반환", async () => {
    vi.unstubAllEnvs();
    // LLM 환경변수 없음
    const { POST } = await import("../generate/route");
    const req = new Request("http://localhost/api/queries/generate", {
      method: "POST",
      body: JSON.stringify({ nl: "사용자 목록 보여줘", dialect: "postgresql" }),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "3.3.3.3" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(500);
    const body = await (res as { json: () => Promise<unknown> }).json();
    expect((body as { error: string }).error).toBeTruthy();
  });

  it("생성된 SQL이 비-SELECT → 422", async () => {
    vi.stubEnv("LMSTUDIO_BASE_URL", "http://localhost:1234");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              sql: "DROP TABLE users",
              explanation: "위험한 쿼리",
              confidence: "high",
            }),
          },
        }],
      }),
    }));

    const { POST } = await import("../generate/route");
    const req = new Request("http://localhost/api/queries/generate", {
      method: "POST",
      body: JSON.stringify({ nl: "테이블을 삭제해줘", dialect: "postgresql" }),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.4.4" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(422);
    const body = await (res as { json: () => Promise<unknown> }).json();
    expect((body as { error: string }).error).toContain("Unsafe SQL");
  });

  it("정상 SQL 생성 → 200 + data 반환", async () => {
    vi.stubEnv("LMSTUDIO_BASE_URL", "http://localhost:1234");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(VALID_SQL_RESULT) } }],
      }),
    }));

    const { POST } = await import("../generate/route");
    const req = new Request("http://localhost/api/queries/generate", {
      method: "POST",
      body: JSON.stringify({ nl: "사용자 10명 보여줘", dialect: "postgresql" }),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "5.5.5.5" },
    });
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(200);
    const body = await (res as { json: () => Promise<unknown> }).json();
    const data = (body as { data: typeof VALID_SQL_RESULT }).data;
    expect(data.sql).toContain("SELECT");
    expect(data.confidence).toBe("high");
  });
});
