/**
 * 통합 테스트: 스키마 탐색기 + 용어집 버튼 → API → 백엔드 플로우
 *
 * 커버 버튼:
 *  [스키마 로드]     → GET  /api/schema  (connectionId 없음: mock / 있음: DB 인트로스펙션)
 *  [용어집 로드]     → GET  /api/glossary
 *  [용어 추가]       → POST /api/glossary
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };
function body(res: ApiResponse) { return res._body as Record<string, unknown>; }

// ─────────────────────────────────────────────────────────────────────────────

describe("[스키마 로드] GET /api/schema", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("connectionId 없음 → mock 스키마 반환", async () => {
    const { GET } = await import("../schema/route");
    const req = new Request("http://localhost/api/schema");
    const res = (await GET(req)) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // 각 테이블 메타에 필수 필드 포함 확인
    const first = data[0];
    expect(typeof first["name"]).toBe("string");
    expect(typeof first["columns"]).toBe("number");
    expect(Array.isArray(first["cols"])).toBe(true);
  });

  it("미등록 connectionId → mock 스키마 반환 (DB 접속 실패 폴백)", async () => {
    const { GET } = await import("../schema/route");
    const req = new Request("http://localhost/api/schema?connectionId=nonexistent-id");
    const res = (await GET(req)) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.length).toBeGreaterThan(0);
  });

  it("mock 스키마에 PII 플래그 포함", async () => {
    const { GET } = await import("../schema/route");
    const req = new Request("http://localhost/api/schema");
    const res = (await GET(req)) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    const piiTables = data.filter((t) => t["pii"] === true);
    const nonPiiTables = data.filter((t) => t["pii"] === false);
    expect(piiTables.length).toBeGreaterThan(0);
    expect(nonPiiTables.length).toBeGreaterThan(0);
  });

  it("orders 테이블 포함 확인", async () => {
    const { GET } = await import("../schema/route");
    const req = new Request("http://localhost/api/schema");
    const res = (await GET(req)) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((t) => t["name"] === "orders")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[용어집 로드] GET /api/glossary", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("기본 용어집 반환 → 배열", async () => {
    const { GET } = await import("../glossary/route");
    const res = (await GET()) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("각 용어에 term·category·definition 포함", async () => {
    const { GET } = await import("../glossary/route");
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    for (const term of data) {
      expect(typeof term["term"]).toBe("string");
      expect(typeof term["category"]).toBe("string");
      expect(typeof term["definition"]).toBe("string");
    }
  });

  it("기본 용어 '결제율' 포함", async () => {
    const { GET } = await import("../glossary/route");
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((t) => t["term"] === "결제율")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[용어 추가] POST /api/glossary", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("신규 용어 추가 → 201 + id·term 반환", async () => {
    const { POST } = await import("../glossary/route");
    const req = new Request("http://localhost/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: "전환율",
        category: "마케팅",
        definition: "방문자 중 목표 행동을 완료한 비율",
        sql: "SELECT COUNT(*)::float / visitors AS cvr FROM sessions",
      }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["term"]).toBe("전환율");
    expect(data["category"]).toBe("마케팅");
  });

  it("필수 필드(term) 누락 → 400", async () => {
    const { POST } = await import("../glossary/route");
    const req = new Request("http://localhost/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "마케팅", definition: "설명" }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("definition 누락 → 400", async () => {
    const { POST } = await import("../glossary/route");
    const req = new Request("http://localhost/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "용어", category: "분류" }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("추가 후 목록에 포함", async () => {
    const { POST, GET } = await import("../glossary/route");
    await POST(
      new Request("http://localhost/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: "고유테스트용어X99",
          category: "테스트",
          definition: "테스트 정의",
        }),
      })
    );
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((t) => t["term"] === "고유테스트용어X99")).toBe(true);
  });

  it("올바르지 않은 JSON → 400", async () => {
    const { POST } = await import("../glossary/route");
    const req = new Request("http://localhost/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ 잘못된 JSON }",
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[전체 플로우] 스키마 탐색 → 용어집 참고 → SQL 생성 준비", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("스키마 로드 → 용어집 로드 → 새 용어 추가 플로우", async () => {
    // 1. 스키마 로드 (프론트: 스키마 탐색기 진입)
    const { GET: schemaGet } = await import("../schema/route");
    const schemaRes = (await schemaGet(new Request("http://localhost/api/schema"))) as unknown as ApiResponse;
    const tables = body(schemaRes)["data"] as Record<string, unknown>[];
    expect(tables.length).toBeGreaterThan(0);

    // 2. 용어집 로드
    const { GET: glossaryGet } = await import("../glossary/route");
    const glossaryRes = (await glossaryGet()) as unknown as ApiResponse;
    const terms = body(glossaryRes)["data"] as Record<string, unknown>[];
    expect(terms.length).toBeGreaterThan(0);

    // 3. 스키마에서 발견한 컬럼 기반 용어 추가
    const { POST: glossaryPost } = await import("../glossary/route");
    const addRes = (await glossaryPost(
      new Request("http://localhost/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: "주문금액합계",
          category: "매출",
          definition: "orders.amount 컬럼의 합계",
          sql: "SELECT SUM(amount) FROM orders",
        }),
      })
    )) as unknown as ApiResponse;
    expect(addRes.status).toBe(201);

    // 4. 추가된 용어 확인
    const updatedRes = (await glossaryGet()) as unknown as ApiResponse;
    const updatedTerms = body(updatedRes)["data"] as Record<string, unknown>[];
    expect(updatedTerms.some((t) => t["term"] === "주문금액합계")).toBe(true);
  });
});
