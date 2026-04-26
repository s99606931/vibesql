/**
 * 통합 테스트: 연결 관리 페이지 버튼 → API → 백엔드 플로우
 *
 * 커버 버튼:
 *  [새 연결 추가]   → POST   /api/connections
 *  [연결 목록 로드] → GET    /api/connections
 *  [연결 테스트]    → POST   /api/connections/{id}/test
 *  [연결 삭제]      → DELETE /api/connections/{id}
 */
import { describe, it, expect, vi, beforeEach } from "vitest";


type ApiResponse = { _body: unknown; status: number; json: () => Promise<unknown> };

function body(res: ApiResponse) {
  return res._body as Record<string, unknown>;
}

// ── 헬퍼: 연결 생성 요청 (beforeEach에서 모듈 리셋 후 사용) ─────────────
async function postConnection(overrides: Record<string, unknown> = {}) {
  // vi.resetModules()은 beforeEach에서 이미 호출됨 — 여기서 중복 호출 금지
  const { POST } = await import("../connections/route");
  const req = new Request("http://localhost/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "테스트 PG",
      type: "postgresql",
      host: "localhost",
      port: 5432,
      database: "testdb",
      ssl: false,
      ...overrides,
    }),
  });
  return (await POST(req)) as unknown as ApiResponse;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("[새 연결 추가] POST /api/connections", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("연결 생성 성공 → 201 + id·name 반환", async () => {
    const res = await postConnection();
    expect(res.status).toBe(201);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBeTruthy();
    expect(data["name"]).toBe("테스트 PG");
    expect(data["type"]).toBe("postgresql");
  });

  it("비밀번호는 응답에서 제거됨", async () => {
    const res = await postConnection({ password: "secret" });
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["password"]).toBeUndefined();
    expect(data["passwordBase64"]).toBeUndefined();
  });

  it("필수 필드(database) 누락 → 400", async () => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
    const { POST } = await import("../connections/route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "없는DB", type: "postgresql", ssl: false }),
    });
    const res = (await POST(req)) as unknown as ApiResponse;
    expect(res.status).toBe(400);
    expect(body(res)["error"]).toBeTruthy();
  });

  it("미지원 dialect(mongodb) → 400", async () => {
    const res = await postConnection({ type: "mongodb" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[연결 목록 로드] GET /api/connections", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("초기 상태 → 빈 배열", async () => {
    const { GET } = await import("../connections/route");
    const res = (await GET()) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    expect(body(res)["data"]).toEqual([]);
  });

  it("연결 추가 후 목록에 포함", async () => {
    await postConnection({ name: "목록테스트DB" });
    // GET 은 같은 모듈 스코프를 공유해야 하므로 같이 reset 없이 import
    const { GET } = await import("../connections/route");
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    expect(data.some((c) => c["name"] === "목록테스트DB")).toBe(true);
  });

  it("응답 항목에 passwordBase64 필드 없음", async () => {
    // store에 직접 비밀번호 포함 연결 추가
    const { addConnection } = await import("@/lib/connections/store");
    addConnection({
      id: "pw-check-id",
      name: "비밀번호연결",
      type: "mysql",
      database: "db",
      ssl: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      passwordBase64: "c2VjcmV0",
    });
    const { GET } = await import("../connections/route");
    const res = (await GET()) as unknown as ApiResponse;
    const data = body(res)["data"] as Record<string, unknown>[];
    const conn = data.find((c) => c["id"] === "pw-check-id");
    expect(conn).toBeDefined();
    expect(conn!["passwordBase64"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[연결 삭제] DELETE /api/connections/{id}", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("존재하는 연결 삭제 → 200 + id 반환", async () => {
    const { addConnection } = await import("@/lib/connections/store");
    addConnection({
      id: "del-target",
      name: "삭제대상",
      type: "postgresql",
      database: "db",
      ssl: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const { DELETE } = await import("../connections/[id]/route");
    const res = (await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "del-target" }),
    })) as unknown as ApiResponse;

    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["id"]).toBe("del-target");
  });

  it("존재하지 않는 연결 삭제 → 404", async () => {
    const { DELETE } = await import("../connections/[id]/route");
    const res = (await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "nonexistent-id" }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("[연결 테스트] POST /api/connections/{id}/test", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("미등록 연결 → mock 성공 응답", async () => {
    // 연결 스토어에 없는 id → 폴백 mock 반환
    const { POST } = await import("../connections/[id]/test/route");
    const res = (await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "unknown-conn-id" }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["success"]).toBe(true);
    expect(typeof data["latencyMs"]).toBe("number");
  });

  it("sqlite 연결(미지원 driver) → mock 성공 응답", async () => {
    const { addConnection } = await import("@/lib/connections/store");
    addConnection({
      id: "sqlite-conn",
      name: "SQLite",
      type: "sqlite",
      database: "local.db",
      ssl: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const { POST } = await import("../connections/[id]/test/route");
    const res = (await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sqlite-conn" }),
    })) as unknown as ApiResponse;
    expect(res.status).toBe(200);
    const data = body(res)["data"] as Record<string, unknown>;
    expect(data["success"]).toBe(true);
  });
});
