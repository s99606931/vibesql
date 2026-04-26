/**
 * 통합 테스트: 쿼리 템플릿 API 플로우
 *
 * 커버:
 *  [목록 조회]  → GET  /api/templates (built-in + user)
 *  [템플릿 추가] → POST /api/templates
 *  [삭제]       → DELETE /api/templates/{id}
 *  [필터]       → GET  /api/templates?category=analytics
 *  [검색]       → GET  /api/templates?search=...
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/mem-ai-providers", () => ({ memAiProviders: [] }));

beforeEach(() => {
  vi.resetModules();
  delete process.env.DATABASE_URL;
});

type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };
function body(res: ApiResponse) { return res._body as Record<string, unknown>; }

async function listTemplates(params = "") {
  const { GET } = await import("../route");
  const res = (await GET(new Request(`http://localhost/api/templates${params ? `?${params}` : ""}`))) as unknown as ApiResponse;
  return res;
}

async function createTemplate(overrides: Record<string, unknown> = {}) {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "테스트 템플릿",
      nlQuery: "사용자 목록 보여줘",
      sql: "SELECT id, name FROM users LIMIT 10",
      ...overrides,
    }),
  });
  return (await POST(req)) as unknown as ApiResponse;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("[목록 조회] GET /api/templates", () => {
  it("기본 제공 템플릿 포함 → 200 + 배열", async () => {
    const res = await listTemplates();
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0); // built-in templates exist
  });

  it("기본 제공 템플릿은 isBuiltIn: true", async () => {
    const res = await listTemplates();
    const data = body(res)["data"] as Record<string, unknown>[];
    const builtIns = data.filter((t) => t["isBuiltIn"] === true);
    expect(builtIns.length).toBeGreaterThan(0);
  });

  it("category 필터 적용", async () => {
    const res = await listTemplates("category=analytics");
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    data.forEach((t) => expect(t["category"]).toBe("analytics"));
  });

  it("search 필터 — 이름/NL 쿼리에서 매칭", async () => {
    const res = await listTemplates("search=중복");
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.length).toBeGreaterThan(0);
  });

  it("존재하지 않는 검색어 → 빈 배열", async () => {
    const res = await listTemplates("search=절대없는검색어xyz123");
    const data = body(res)["data"] as unknown[];
    expect(data.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[템플릿 추가] POST /api/templates", () => {
  it("사용자 템플릿 생성 → 201 + id", async () => {
    const res = await createTemplate();
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["isBuiltIn"]).toBe(false);
  });

  it("카테고리 지정 → 저장됨", async () => {
    const res = await createTemplate({ category: "reporting" });
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["category"]).toBe("reporting");
  });

  it("태그 배열 저장", async () => {
    const res = await createTemplate({ tags: ["monthly", "sales"] });
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["tags"]).toEqual(["monthly", "sales"]);
  });

  it("필수 필드(name) 누락 → 400", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nlQuery: "보여줘", sql: "SELECT 1" }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("필수 필드(sql) 누락 → 400", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "이름", nlQuery: "보여줘" }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
  });

  it("추가 후 목록에 포함됨", async () => {
    await createTemplate({ name: "내 특별 템플릿" });
    const res = await listTemplates();
    const data = body(res)["data"] as Record<string, unknown>[];
    const found = data.find((t) => t["name"] === "내 특별 템플릿");
    expect(found).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[삭제] DELETE /api/templates/{id}", () => {
  it("사용자 템플릿 삭제 → 200", async () => {
    const created = await createTemplate({ name: "삭제용 템플릿" });
    const id = (body(created)["data"] as Record<string, unknown>)["id"] as string;

    const { DELETE } = await import("../[id]/route");
    const res = (await DELETE(new Request(`http://localhost/api/templates/${id}`), {
      params: Promise.resolve({ id }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(200);
  });

  it("삭제 후 목록에서 제거됨", async () => {
    const created = await createTemplate({ name: "제거 확인용" });
    const id = (body(created)["data"] as Record<string, unknown>)["id"] as string;

    const { DELETE } = await import("../[id]/route");
    await DELETE(new Request(`http://localhost/api/templates/${id}`), {
      params: Promise.resolve({ id }),
    });

    const listRes = await listTemplates();
    const data = body(listRes)["data"] as Record<string, unknown>[];
    expect(data.find((t) => t["id"] === id)).toBeUndefined();
  });

  it("존재하지 않는 id → 404", async () => {
    const { DELETE } = await import("../[id]/route");
    const res = (await DELETE(new Request("http://localhost/api/templates/ghost"), {
      params: Promise.resolve({ id: "ghost" }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(404);
  });
});
