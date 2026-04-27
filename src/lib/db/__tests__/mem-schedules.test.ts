import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn(() => true);
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock("fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    promises: {},
  },
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  promises: {},
}));

describe("memSchedules / memScheduleRuns — 기본 동작", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
    mockReadFileSync.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockReset();
    mockWriteFileSync.mockReset();
  });

  it("초기 상태: schedules, runs 모두 빈 배열", async () => {
    const { memSchedules, memScheduleRuns } = await import("../mem-schedules");
    expect(Array.isArray(memSchedules)).toBe(true);
    expect(Array.isArray(memScheduleRuns)).toBe(true);
    expect(memSchedules.length).toBe(0);
    expect(memScheduleRuns.length).toBe(0);
  });

  it("persistSchedules 에러 없이 실행 (dir 존재)", async () => {
    const { persistSchedules } = await import("../mem-schedules");
    expect(() => persistSchedules()).not.toThrow();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("persistSchedules — dir 없으면 mkdirSync 호출", async () => {
    mockExistsSync.mockReturnValue(false);
    const { persistSchedules } = await import("../mem-schedules");
    persistSchedules();
    expect(mockMkdirSync).toHaveBeenCalled();
  });

  it("스케줄 추가 후 배열에 반영", async () => {
    const { memSchedules } = await import("../mem-schedules");
    const item = {
      id: "s1", userId: "u1", name: "Daily Report", savedQueryId: null,
      sql: "SELECT count(*) FROM orders", dialect: "postgresql" as const,
      cronExpr: "0 9 * * 1-5", isActive: true,
      lastRunAt: null, lastRunStatus: null, nextRunAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    memSchedules.push(item);
    expect(memSchedules.length).toBe(1);
    memSchedules.splice(0, 1);
    expect(memSchedules.length).toBe(0);
  });

  it("실행 결과 추가 후 배열에 반영", async () => {
    const { memScheduleRuns } = await import("../mem-schedules");
    const run = {
      id: "r1", scheduleId: "s1", status: "success" as const,
      rowCount: 42, durationMs: 120, errorMsg: null,
      createdAt: new Date().toISOString(),
    };
    memScheduleRuns.push(run);
    expect(memScheduleRuns.length).toBe(1);
    memScheduleRuns.splice(0, 1);
    expect(memScheduleRuns.length).toBe(0);
  });
});

describe("memSchedules — 디스크 파일 파싱", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFileSync.mockReset();
    mockExistsSync.mockReturnValue(true);
    mockWriteFileSync.mockReset();
  });

  it("유효한 { schedules, runs } JSON 로드", async () => {
    const mockData = {
      schedules: [{
        id: "s1", userId: "u1", name: "Test", savedQueryId: null,
        sql: "SELECT 1", dialect: "postgresql", cronExpr: "* * * * *",
        isActive: false, lastRunAt: null, lastRunStatus: null, nextRunAt: null,
        createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
      }],
      runs: [{ id: "r1", scheduleId: "s1", status: "success", rowCount: 5, durationMs: 100, errorMsg: null, createdAt: "2024-01-01T00:00:00Z" }],
    };
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(mockData));

    const { memSchedules, memScheduleRuns } = await import("../mem-schedules");
    expect(memSchedules.length).toBe(1);
    expect(memScheduleRuns.length).toBe(1);
    expect(memSchedules[0].name).toBe("Test");
  });

  it("corrupt JSON → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce("BROKEN{{{{");

    const { memSchedules, memScheduleRuns } = await import("../mem-schedules");
    expect(memSchedules.length).toBe(0);
    expect(memScheduleRuns.length).toBe(0);
  });

  it("schedules 키 없는 객체 → 빈 배열 fallback", async () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ other: [] }));

    const { memSchedules, memScheduleRuns } = await import("../mem-schedules");
    expect(memSchedules.length).toBe(0);
    expect(memScheduleRuns.length).toBe(0);
  });
});
