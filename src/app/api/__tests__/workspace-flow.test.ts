/**
 * 통합 테스트: 워크스페이스 버튼 → API → 백엔드 플로우
 *
 * 커버 버튼:
 *  [SQL 실행]  → POST /api/queries/run   (SQL 실행 + SQL 가드)
 *  [저장]      → POST /api/saved         (실행 결과 저장)
 *  전체 플로우: 쿼리 생성 → 실행 → 저장
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };
function body(res: ApiResponse) { return res._body as Record<string, unknown>; }

function makeRunReq(sql: string, connectionId = "mock-conn", ip = "10.0.0.1") {
  return new Request("http://localhost/api/queries/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ sql, connectionId, limit: 100 }),
  });
}

function makeSaveReq(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "사용자 집계",
      folder: "기본",
      tags: [],
      nlQuery: "사용자 수 보여줘",
      sql: "SELECT COUNT(*) FROM users",
      dialect: "postgresql",
      ...overrides,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("[SQL 실행] POST /api/queries/run — SQL 가드 통합", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("SELECT 쿼리 → 200 + columns·rows·rowCount 포함", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("SELECT id, name FROM users"))) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(Array.isArray(data["columns"])).toBe(true);
    expect(Array.isArray(data["rows"])).toBe(true);
    expect(typeof data["rowCount"]).toBe("number");
    expect(typeof data["durationMs"]).toBe("number");
  });

  it("DROP 쿼리 → 403 차단", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("DROP TABLE users"))) as unknown as ApiResponse;
    expect(res.status).toBe(403);
    expect(body(res)["error"]).toMatch(/차단/);
  });

  it("DELETE 쿼리 → 403 차단", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("DELETE FROM users WHERE id=1"))) as unknown as ApiResponse;
    expect(res.status).toBe(403);
  });

  it("SQL 인젝션 시도(-- 주석) → 403 차단", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("SELECT * FROM users -- injected"))) as unknown as ApiResponse;
    expect(res.status).toBe(403);
  });

  it("connectionId 없는 요청 → 400", async () => {
    const { POST } = await import("../queries/run/route");
    const req = new Request("http://localhost/api/queries/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify({ sql: "SELECT 1" }), // connectionId 누락
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("후행 세미콜론 SELECT 허용", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("SELECT * FROM products;", "any-conn", "10.0.0.2"))) as unknown as ApiResponse;
    expect(res.status).toBe(200);
  });

  it("실행 결과에 sql 필드(정규화된 쿼리) 포함", async () => {
    const { POST } = await import("../queries/run/route");
    const res = (await POST(makeRunReq("SELECT 1", "any-conn", "10.0.0.3"))) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>;
    expect(typeof data["sql"]).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[저장] POST /api/saved", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("쿼리 저장 성공 → 201 + id·name 반환", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq())) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["name"]).toBe("사용자 집계");
    expect(data["sql"]).toBe("SELECT COUNT(*) FROM users");
  });

  it("필수 필드(name) 누락 → 400", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq({ name: "" }))) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("sql 누락 → 400", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq({ sql: "" }))) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("저장 후 GET 목록에 포함", async () => {
    const { POST, GET } = await import("../saved/route");
    await POST(makeSaveReq({ name: "고유저장명-abc123" }));
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((q) => q["name"] === "고유저장명-abc123")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[전체 플로우] 워크스페이스 사용자 여정", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("쿼리 실행 → 결과 확인 → 쿼리 저장 → 목록 조회 플로우", async () => {
    // 1. SQL 실행
    const { POST: runPost } = await import("../queries/run/route");
    const runRes = (await runPost(makeRunReq("SELECT id, name FROM users", "any", "20.0.0.1"))) as unknown as ApiResponse;
    expect(runRes.status).toBe(200);
    const runData = body(runRes)["data"] as Record<string, unknown>;
    expect(runData["rowCount"]).toBeGreaterThanOrEqual(0);

    // 2. 실행한 쿼리 저장
    const { POST: savePost, GET: savedGet } = await import("../saved/route");
    const saveRes = (await savePost(makeSaveReq({ name: "플로우테스트쿼리" }))) as unknown as ApiResponse;
    expect(saveRes.status).toBe(201);
    const savedId = (body(saveRes)["data"] as Record<string, unknown>)["id"] as string;
    expect(savedId).toBeTruthy();

    // 3. 저장 목록에서 확인
    const listRes = (await savedGet()) as unknown as ApiResponse;
    const list = body(listRes)["data"] as Record<string, unknown>[];
    expect(list.some((q) => q["id"] === savedId)).toBe(true);
  });
});
