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

describe("memAiContextRules — 기본 동작", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
    mockReadFileSync.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("초기 상태는 빈 배열", async () => {
    const { memAiContextRules } = await import("../mem-ai-context");
    expect(Array.isArray(memAiContextRules)).toBe(true);
    expect(memAiContextRules.length).toBe(0);
  });

  it("persistAiContextRules 에러 없이 실행", async () => {
    const { persistAiContextRules } = await import("../mem-ai-context");
    expect(() => persistAiContextRules()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("규칙 추가 후 배열에 반영", async () => {
    const { memAiContextRules } = await import("../mem-ai-context");
    const item = {
      id: "rule1", userId: "u1", ruleType: "few_shot" as const,
      key: "사용자 목록", value: "SELECT * FROM users",
      description: null, isActive: true, priority: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    memAiContextRules.push(item);
    expect(memAiContextRules.length).toBe(1);
    memAiContextRules.splice(0, 1);
    expect(memAiContextRules.length).toBe(0);
  });

  it("persistAiContextRules — fs 오류 시 무시", async () => {
    mockWriteFile.mockRejectedValue(new Error("disk error"));
    const { persistAiContextRules } = await import("../mem-ai-context");
    expect(() => persistAiContextRules()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });
});

describe("memAiContextRules — 디스크 파일 파싱", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
  });

  it("유효한 JSON 배열 로드", async () => {
    const mockRules = [{
      id: "r1", userId: "u1", ruleType: "alias", key: "유저", value: "users",
      description: null, isActive: true, priority: 0,
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    }];
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(mockRules));

    const { memAiContextRules } = await import("../mem-ai-context");
    expect(Array.isArray(memAiContextRules)).toBe(true);
    expect(memAiContextRules.length).toBe(1);
    expect(memAiContextRules[0].ruleType).toBe("alias");
  });

  it("corrupt JSON → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce("{{BAD");

    const { memAiContextRules } = await import("../mem-ai-context");
    expect(memAiContextRules.length).toBe(0);
  });

  it("비배열 JSON → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ rules: [] }));

    const { memAiContextRules } = await import("../mem-ai-context");
    expect(memAiContextRules.length).toBe(0);
  });
});
