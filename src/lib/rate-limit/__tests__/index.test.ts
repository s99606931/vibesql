import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, getClientIp } from "../index";

// Rate limiter uses a module-scoped Map — isolate by using unique keys per test.

describe("rateLimit — 허용 케이스", () => {
  it("한도 이하 요청은 허용", () => {
    const key = `test-allow-${Date.now()}-${Math.random()}`;
    const r = rateLimit(key, 5, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("한도까지의 연속 요청은 모두 허용", () => {
    const key = `test-consecutive-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    }
  });

  it("remaining 값이 감소하는지 확인", () => {
    const key = `test-remaining-${Date.now()}-${Math.random()}`;
    const r1 = rateLimit(key, 5, 60_000);
    const r2 = rateLimit(key, 5, 60_000);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });
});

describe("rateLimit — 차단 케이스", () => {
  it("한도 초과 요청 차단", () => {
    const key = `test-block-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);
    const r = rateLimit(key, 5, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetMs).toBeGreaterThan(0);
  });

  it("한도 1인 경우 두 번째 요청 차단", () => {
    const key = `test-limit1-${Date.now()}-${Math.random()}`;
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false);
  });
});

describe("rateLimit — 윈도우 만료", () => {
  it("윈도우가 지나면 카운트 리셋", () => {
    const key = `test-window-${Date.now()}-${Math.random()}`;
    // Fill up limit with window = 1ms (already expired after Date.now() advances)
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    rateLimit(key, 1, 100);
    rateLimit(key, 1, 100); // blocked

    // Advance past window
    vi.setSystemTime(now + 200);
    const r = rateLimit(key, 1, 100);
    expect(r.allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("getClientIp", () => {
  it("X-Forwarded-For 헤더에서 첫 번째 IP 반환", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("X-Real-IP 헤더 fallback", () => {
    const headers = new Headers({ "x-real-ip": "9.10.11.12" });
    expect(getClientIp(headers)).toBe("9.10.11.12");
  });

  it("헤더 없을 때 anonymous 반환", () => {
    expect(getClientIp(new Headers())).toBe("anonymous");
  });
});
