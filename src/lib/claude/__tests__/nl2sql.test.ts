import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Nl2SqlOptions } from "../nl2sql";

// Ensure no active DB providers bleed in from on-disk state
vi.mock("@/lib/db/mem-ai-providers", () => ({ memAiProviders: [] }));

// Mock fetch globally for LM Studio tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const BASE_OPTIONS: Nl2SqlOptions = {
  nl: "사용자 목록을 조회해줘",
  dialect: "postgresql",
  schemaContext: "TABLE users (id INT, name TEXT, email TEXT)",
};

const VALID_RESULT = {
  sql: "SELECT id, name, email FROM users",
  explanation: "사용자 테이블의 모든 레코드를 조회합니다",
  confidence: "high" as const,
};

describe("generateSql — LM Studio 경로", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("LMSTUDIO_BASE_URL", "http://localhost:1234");
    vi.stubEnv("LMSTUDIO_API_KEY", "test-key");
    vi.stubEnv("LMSTUDIO_MODEL", "test-model");
    mockFetch.mockReset();
  });

  it("정상 응답에서 Nl2SqlResult 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }],
      }),
    });

    const { generateSql } = await import("../nl2sql");
    const result = await generateSql(BASE_OPTIONS);
    expect(result.sql).toBe(VALID_RESULT.sql);
    expect(result.confidence).toBe("high");
    expect(result.explanation).toBeTruthy();
  });

  it("JSON을 마크다운 코드블록으로 감싸도 파싱 성공", async () => {
    const wrapped = "```json\n" + JSON.stringify(VALID_RESULT) + "\n```";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: wrapped } }],
      }),
    });

    const { generateSql } = await import("../nl2sql");
    const result = await generateSql(BASE_OPTIONS);
    expect(result.sql).toBe(VALID_RESULT.sql);
  });

  it("서버 에러(non-ok) → Error throw", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const { generateSql } = await import("../nl2sql");
    await expect(generateSql(BASE_OPTIONS)).rejects.toThrow(/500/);
  });

  it("JSON 없는 응답 → Error throw", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "죄송합니다, SQL을 생성할 수 없습니다." } }],
      }),
    });

    const { generateSql } = await import("../nl2sql");
    await expect(generateSql(BASE_OPTIONS)).rejects.toThrow(/No JSON/);
  });

  it("스키마 누락 필드 JSON → Error throw", async () => {
    const invalid = { sql: "SELECT 1" }; // explanation, confidence 없음
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(invalid) } }],
      }),
    });

    const { generateSql } = await import("../nl2sql");
    await expect(generateSql(BASE_OPTIONS)).rejects.toThrow(/expected schema/);
  });

  it("glossary 옵션이 있을 때도 정상 처리", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }],
      }),
    });

    const { generateSql } = await import("../nl2sql");
    const result = await generateSql({ ...BASE_OPTIONS, glossary: "MAU=월간 활성 사용자" });
    expect(result.sql).toBeTruthy();
  });
});

describe("generateSql — LLM 미설정", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // 환경변수 없음
  });

  it("LLM 설정 없으면 Error throw", async () => {
    const { generateSql } = await import("../nl2sql");
    await expect(generateSql(BASE_OPTIONS)).rejects.toThrow();
  });
});

describe("generateSqlStream", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("LMSTUDIO_BASE_URL", "http://localhost:1234");
    mockFetch.mockReset();
  });

  it("스트리밍 제너레이터가 SQL을 yield", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }],
      }),
    });

    const { generateSqlStream } = await import("../nl2sql");
    const chunks: string[] = [];
    for await (const chunk of generateSqlStream(BASE_OPTIONS)) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("SELECT");
  });
});
