/**
 * mem-ai-providers 테스트
 * ESM 환경에서 fs named export는 vi.spyOn 불가 → vi.mock 사용
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock("fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
    promises: { mkdir: mockMkdir, writeFile: mockWriteFile },
  },
  readFileSync: mockReadFileSync,
  promises: { mkdir: mockMkdir, writeFile: mockWriteFile },
}));

describe("memAiProviders — 기본 동작 (파일 없음 fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
    mockReadFileSync.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("초기 상태는 빈 배열", async () => {
    const { memAiProviders } = await import("../mem-ai-providers");
    expect(Array.isArray(memAiProviders)).toBe(true);
    expect(memAiProviders.length).toBe(0);
  });

  it("persistAiProviders 에러 없이 실행", async () => {
    const { persistAiProviders } = await import("../mem-ai-providers");
    expect(() => persistAiProviders()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("memAiProviders 배열에 항목 추가/삭제 가능", async () => {
    const { memAiProviders } = await import("../mem-ai-providers");
    const item = {
      id: "test-id", userId: "user1", name: "Test", type: "anthropic" as const,
      baseUrl: null, apiKey: "sk-test", model: "claude-sonnet-4-6",
      temperature: 0.3, maxTokens: 1024, isActive: true,
      lastTestedAt: null, lastTestedOk: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    memAiProviders.push(item);
    expect(memAiProviders.length).toBe(1);
    memAiProviders.splice(0, 1);
    expect(memAiProviders.length).toBe(0);
  });

  it("persistAiProviders — fs 오류 시 무시", async () => {
    mockMkdir.mockRejectedValue(new Error("disk full"));
    const { persistAiProviders } = await import("../mem-ai-providers");
    expect(() => persistAiProviders()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });
});

describe("memAiProviders — 디스크 파일 파싱", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
  });

  it("유효한 JSON 배열 로드", async () => {
    const mockData = [{
      id: "p1", userId: "u1", name: "LM Studio", type: "lmstudio",
      baseUrl: "http://localhost:1234", apiKey: null,
      model: "gemma-4", temperature: 0.2, maxTokens: 512,
      isActive: true, lastTestedAt: null, lastTestedOk: null,
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    }];
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(mockData));

    const { memAiProviders } = await import("../mem-ai-providers");
    expect(Array.isArray(memAiProviders)).toBe(true);
    expect(memAiProviders.length).toBe(1);
    expect(memAiProviders[0].type).toBe("lmstudio");
  });

  it("corrupt JSON → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce("INVALID{{{{");

    const { memAiProviders } = await import("../mem-ai-providers");
    expect(Array.isArray(memAiProviders)).toBe(true);
    expect(memAiProviders.length).toBe(0);
  });

  it("배열이 아닌 JSON → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ providers: [] }));

    const { memAiProviders } = await import("../mem-ai-providers");
    expect(Array.isArray(memAiProviders)).toBe(true);
    expect(memAiProviders.length).toBe(0);
  });

  it("ENOENT → 빈 배열 fallback", async () => {
    mockReadFileSync.mockImplementationOnce(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    const { memAiProviders } = await import("../mem-ai-providers");
    expect(memAiProviders.length).toBe(0);
  });
});
