/**
 * 통합 테스트: 히스토리 페이지 버튼 → API → 백엔드 플로우
 *
 * 커버 버튼:
 *  [히스토리 로드]    → GET  /api/history
 *  [히스토리 기록]    → POST /api/history  (쿼리 실행 후 자동 저장)
 *  [별표 토글]        → POST /api/history/{id}/star
 *  [재실행]           → POST /api/queries/run  (기존 SQL 재실행)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };
function body(res: ApiResponse) { return res._body as Record<string, unknown>; }

// 히스토리 저장 헬퍼 — 실제 쿼리 실행 후 히스토리 기록 시나리오
function makeHistoryReq(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: "SELECT COUNT(*) FROM orders",
      dialect: "postgresql",
      status: "SUCCESS",
      rowCount: 42,
      durationMs: 120,
      connectionName: "프로덕션DB",
      ...overrides,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("[히스토리 기록] POST /api/history", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("쿼리 실행 성공 기록 → 201 + starred:false", async () => {
    const { POST } = await import("../history/route");
    const res = (await POST(makeHistoryReq())) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["starred"]).toBe(false);
    expect(data["status"]).toBe("SUCCESS");
    expect(data["rowCount"]).toBe(42);
  });

  it("ERROR 상태 기록 → 201", async () => {
    const { POST } = await import("../history/route");
    const res = (await POST(makeHistoryReq({ status: "ERROR", errorMsg: "connection refused", rowCount: undefined }))) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["status"]).toBe("ERROR");
  });

  it("BLOCKED 상태 기록 → 201", async () => {
    const { POST } = await import("../history/route");
    const res = (await POST(makeHistoryReq({ status: "BLOCKED", sql: "DROP TABLE users" }))) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["status"]).toBe("BLOCKED");
  });

  it("sql 누락 → 400", async () => {
    const { POST } = await import("../history/route");
    const res = (await POST(makeHistoryReq({ sql: "" }))) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[히스토리 로드] GET /api/history", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("초기 상태 → 빈 배열", async () => {
    const { GET } = await import("../history/route");
    const res = (await GET()) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    expect(body(res)["data"]).toEqual([]);
  });

  it("기록 후 목록에 포함", async () => {
    const { POST, GET } = await import("../history/route");
    await POST(makeHistoryReq({ sql: "SELECT 고유플로우SQL FROM t" }));
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((h) => String(h["sql"]).includes("고유플로우SQL"))).toBe(true);
  });

  it("최신 항목이 먼저 옴 (DESC 정렬)", async () => {
    const { POST, GET } = await import("../history/route");
    await POST(makeHistoryReq({ sql: "SELECT 1" }));
    await POST(makeHistoryReq({ sql: "SELECT 2" }));
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.length).toBeGreaterThanOrEqual(2);
    // 마지막 추가된 항목이 첫 번째
    expect(data[0]["sql"]).toBe("SELECT 2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[별표 토글] POST /api/history/{id}/star", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("존재하는 항목 별표 토글 → starred: true", async () => {
    const { POST: histPost, items } = await import("../history/route");
    const createRes = (await histPost(makeHistoryReq())) as unknown as ApiResponse;
    const id = (body(createRes)["data"] as Record<string, unknown>)["id"] as string;

    // items 배열과 같은 모듈 스코프 공유 필요
    const { POST: starPost } = await import("../history/[id]/star/route");
    const res = (await starPost(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    })) as unknown as ApiResponse;

    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["starred"]).toBe(true);

    // items 배열에서도 업데이트 확인
    const item = items.find((i) => i["id"] === id);
    expect(item?.["starred"]).toBe(true);
  });

  it("두 번 토글 → starred: false (토글 확인)", async () => {
    const { POST: histPost, items } = await import("../history/route");
    const createRes = (await histPost(makeHistoryReq())) as unknown as ApiResponse;
    const id = (body(createRes)["data"] as Record<string, unknown>)["id"] as string;

    const { POST: starPost } = await import("../history/[id]/star/route");
    await starPost(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    await starPost(new Request("http://localhost"), { params: Promise.resolve({ id }) });

    const item = items.find((i) => i["id"] === id);
    expect(item?.["starred"]).toBe(false);
  });

  it("존재하지 않는 id → 404", async () => {
    const { POST: starPost } = await import("../history/[id]/star/route");
    const res = (await starPost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "nonexistent-history-id" }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(404);
    expect(body(res)["error"]).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[재실행] POST /api/queries/run (히스토리 재실행)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("히스토리 SQL 재실행 → 200 + 결과 반환", async () => {
    // 히스토리에서 SQL을 꺼내 재실행하는 버튼 시나리오
    const { POST: histPost } = await import("../history/route");
    await histPost(makeHistoryReq({ sql: "SELECT * FROM customers LIMIT 10" }));

    const { POST: runPost } = await import("../queries/run/route");
    const req = new Request("http://localhost/api/queries/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "30.0.0.1" },
      body: JSON.stringify({
        sql: "SELECT * FROM customers LIMIT 10",
        connectionId: "any-conn",
        limit: 1000,
      }),
    });
    const res = (await runPost(req)) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(Array.isArray(data["rows"])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[전체 플로우] 쿼리 실행 → 히스토리 기록 → 별표 → 재실행", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("완전한 히스토리 사용자 여정", async () => {
    // 1. 쿼리 실행
    const { POST: runPost } = await import("../queries/run/route");
    const runReq = new Request("http://localhost/api/queries/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "40.0.0.1" },
      body: JSON.stringify({ sql: "SELECT * FROM users LIMIT 5", connectionId: "c1", limit: 100 }),
    });
    const runRes = (await runPost(runReq)) as unknown as ApiResponse;
    expect(runRes.status).toBe(200);

    // 2. 히스토리에 실행 기록
    const { POST: histPost, items } = await import("../history/route");
    const histRes = (await histPost(makeHistoryReq({ sql: "SELECT * FROM users LIMIT 5", rowCount: 5 }))) as unknown as ApiResponse;
    const histId = (body(histRes)["data"] as Record<string, unknown>)["id"] as string;

    // 3. 별표 추가
    const { POST: starPost } = await import("../history/[id]/star/route");
    const starRes = (await starPost(new Request("http://localhost"), {
      params: Promise.resolve({ id: histId }),
    })) as unknown as ApiResponse;
    expect(starRes.status).toBe(200);
    const item = items.find((i) => i["id"] === histId);
    expect(item?.["starred"]).toBe(true);

    // 4. 히스토리 목록에서 별표 항목 확인
    const { GET: histGet } = await import("../history/route");
    const listRes = (await histGet()) as unknown as ApiResponse;
    const list = body(listRes)["data"] as Record<string, unknown>[];
    const starred = list.filter((h) => h["starred"] === true);
    expect(starred.length).toBeGreaterThan(0);
  });
});
