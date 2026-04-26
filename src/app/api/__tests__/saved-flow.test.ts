/**
 * 통합 테스트: 저장 쿼리 페이지 버튼 → API → 백엔드 플로우
 *
 * 커버 버튼:
 *  [저장]                 → POST  /api/saved
 *  [목록 로드]            → GET   /api/saved
 *  [단건 조회]            → GET   /api/saved/{id}
 *  [삭제]                 → DELETE /api/saved/{id}
 *  [이름·태그 수정]       → PATCH /api/saved/{id}
 *  [실행(워크스페이스)]   → POST  /api/queries/run  (저장된 SQL 실행)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };
function body(res: ApiResponse) { return res._body as Record<string, unknown>; }

function makeSaveReq(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "월별 매출 집계",
      folder: "분석",
      tags: ["매출", "월별"],
      nlQuery: "월별 매출 집계해줘",
      sql: "SELECT DATE_TRUNC('month', created_at) AS m, SUM(amount) FROM orders GROUP BY 1",
      dialect: "postgresql",
      ...overrides,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("[저장] POST /api/saved", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("저장 성공 → 201 + 전체 필드 반환", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq())) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["name"]).toBe("월별 매출 집계");
    expect(data["folder"]).toBe("분석");
    expect(Array.isArray(data["tags"])).toBe(true);
    expect((data["tags"] as string[]).includes("매출")).toBe(true);
    expect(data["createdAt"]).toBeTruthy();
  });

  it("이름 길이 초과(201자) → 400", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq({ name: "a".repeat(201) }))) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("dialect 미지원 → 400", async () => {
    const { POST } = await import("../saved/route");
    const res = (await POST(makeSaveReq({ dialect: "redis" }))) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[목록 로드] GET /api/saved", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("초기 상태 → 빈 배열", async () => {
    const { GET } = await import("../saved/route");
    const res = (await GET()) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    expect(body(res)["data"]).toEqual([]);
  });

  it("저장 후 목록에 포함", async () => {
    const { POST, GET } = await import("../saved/route");
    await POST(makeSaveReq({ name: "목록조회테스트쿼리" }));
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((q) => q["name"] === "목록조회테스트쿼리")).toBe(true);
  });

  it("복수 저장 → 모두 목록에 포함", async () => {
    const { POST, GET } = await import("../saved/route");
    await POST(makeSaveReq({ name: "쿼리A" }));
    await POST(makeSaveReq({ name: "쿼리B" }));
    await POST(makeSaveReq({ name: "쿼리C" }));
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    const names = data.map((q) => q["name"]);
    expect(names).toContain("쿼리A");
    expect(names).toContain("쿼리B");
    expect(names).toContain("쿼리C");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[삭제] DELETE /api/saved/{id}", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("존재하는 쿼리 삭제 → 200 + id 반환", async () => {
    // id를 직접 알기 위해 store에 추가
    const { __items } = await import("../saved/route");
    const testItem = {
      id: "saved-del-001",
      _userId: "dev-user",
      name: "삭제대상쿼리",
      folder: "기본",
      tags: [],
      nlQuery: "",
      sql: "SELECT 1",
      dialect: "postgresql" as const,
      createdAt: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __items.unshift(testItem as any);

    const { DELETE } = await import("../saved/[id]/route");
    const res = (await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "saved-del-001" }),
    })) as unknown as ApiResponse;

    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBe("saved-del-001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[수정] PATCH /api/saved/{id}", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("이름·태그 수정 → 200 + 수정된 데이터", async () => {
    // Seed an item so the in-memory PATCH can find it
    const { __items } = await import("../saved/route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __items.unshift({ id: "any-id", _userId: "dev-user", name: "원래이름", folder: "기본", tags: [], nlQuery: "", sql: "SELECT 1", dialect: "postgresql", createdAt: new Date().toISOString() } as any);

    const { PATCH } = await import("../saved/[id]/route");
    const req = new Request("http://localhost/api/saved/any-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "수정된이름", tags: ["새태그"] }),
    });
    const res = (await PATCH(req, { params: Promise.resolve({ id: "any-id" }) })) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["name"]).toBe("수정된이름");
    expect(data["tags"]).toEqual(["새태그"]);
  });

  it("이름 길이 초과 → 400", async () => {
    const { PATCH } = await import("../saved/[id]/route");
    const req = new Request("http://localhost/api/saved/any-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(201) }),
    });
    const res = (await PATCH(req, { params: Promise.resolve({ id: "any-id" }) })) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[실행] POST /api/queries/run (저장 쿼리 실행)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("저장된 SQL을 실행 → 200 + 결과 반환", async () => {
    const { POST: runPost } = await import("../queries/run/route");
    const req = new Request("http://localhost/api/queries/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "50.0.0.1" },
      body: JSON.stringify({
        sql: "SELECT DATE_TRUNC('month', created_at) AS m, SUM(amount) FROM orders GROUP BY 1",
        connectionId: "saved-exec-conn",
        limit: 1000,
      }),
    });
    const res = (await runPost(req)) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(Array.isArray(data["rows"])).toBe(true);
    expect(typeof data["durationMs"]).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[전체 플로우] 저장 쿼리 사용자 여정", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("저장 → 목록 확인 → 수정 → 실행 플로우", async () => {
    const { POST: savePost, GET: savedGet, __items } = await import("../saved/route");

    // 1. 쿼리 저장
    const saveRes = (await savePost(makeSaveReq({ name: "플로우저장쿼리" }))) as unknown as ApiResponse;
    expect(saveRes.status).toBe(201);
    const savedId = (body(saveRes)["data"] as Record<string, unknown>)["id"] as string;

    // 2. 목록에서 확인
    const listRes = (await savedGet()) as unknown as ApiResponse;
    const list = body(listRes)["data"] as Record<string, unknown>[];
    expect(list.some((q) => q["id"] === savedId)).toBe(true);

    // 3. 이름 수정
    const { PATCH } = await import("../saved/[id]/route");
    const patchRes = (await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "수정된플로우쿼리" }),
      }),
      { params: Promise.resolve({ id: savedId }) }
    )) as unknown as ApiResponse;
    expect(patchRes.status).toBe(200);

    // 4. 저장된 SQL 실행
    const savedItem = __items.find((i) => i.id === savedId);
    const { POST: runPost } = await import("../queries/run/route");
    const runRes = (await runPost(
      new Request("http://localhost/api/queries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "60.0.0.1" },
        body: JSON.stringify({
          sql: savedItem?.sql ?? "SELECT 1",
          connectionId: "flow-conn",
          limit: 100,
        }),
      })
    )) as unknown as ApiResponse;
    expect(runRes.status).toBe(200);
  });
});
