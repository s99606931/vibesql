import { describe, it, expect } from "vitest";
import { guardSql } from "../index";

describe("guardSql — 허용 케이스", () => {
  it("단순 SELECT 허용", () => {
    const r = guardSql("SELECT * FROM users");
    expect(r.allowed).toBe(true);
  });

  it("WITH CTE SELECT 허용", () => {
    const r = guardSql("WITH cte AS (SELECT id FROM users) SELECT * FROM cte");
    expect(r.allowed).toBe(true);
  });

  it("소문자 select 허용", () => {
    const r = guardSql("select id, name from users where id = 1");
    expect(r.allowed).toBe(true);
  });

  it("후행 세미콜론 하나는 자동 제거 후 허용", () => {
    const r = guardSql("SELECT 1;");
    expect(r.allowed).toBe(true);
    expect(r.normalizedSql).toBe("SELECT 1");
  });

  it("문자열 리터럴 안의 위험 키워드는 무시", () => {
    const r = guardSql("SELECT * FROM logs WHERE msg = 'DROP TABLE users'");
    expect(r.allowed).toBe(true);
  });

  it("문자열 리터럴 안의 -- 주석 시퀀스는 무시", () => {
    const r = guardSql("SELECT * FROM logs WHERE msg = '-- comment'");
    expect(r.allowed).toBe(true);
  });

  it("복잡한 JOIN + WHERE SELECT 허용", () => {
    const r = guardSql(
      "SELECT u.id, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100"
    );
    expect(r.allowed).toBe(true);
  });
});

describe("guardSql — 차단 케이스", () => {
  it("INSERT 차단", () => {
    const r = guardSql("INSERT INTO users VALUES (1, 'a')");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/SELECT/);
  });

  it("UPDATE 차단", () => {
    const r = guardSql("UPDATE users SET name='x' WHERE id=1");
    expect(r.allowed).toBe(false);
  });

  it("DELETE 차단", () => {
    const r = guardSql("DELETE FROM users WHERE id=1");
    expect(r.allowed).toBe(false);
  });

  it("DROP TABLE 차단", () => {
    const r = guardSql("DROP TABLE users");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/SELECT/);
  });

  it("TRUNCATE 차단", () => {
    const r = guardSql("TRUNCATE users");
    expect(r.allowed).toBe(false);
  });

  it("SELECT 내부에 DROP 키워드 포함 → 차단", () => {
    const r = guardSql("SELECT id FROM users; DROP TABLE users");
    expect(r.allowed).toBe(false);
    // semicolon in middle (not trailing) should block
  });

  it("-- 라인 주석 차단", () => {
    const r = guardSql("SELECT * FROM users -- injected comment");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("--");
  });

  it("/* 블록 주석 차단", () => {
    const r = guardSql("SELECT /* comment */ * FROM users");
    expect(r.allowed).toBe(false);
  });

  it("세미콜론 멀티 스테이트먼트 차단", () => {
    const r = guardSql("SELECT 1; SELECT 2");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain(";");
  });

  it("EXEC 차단", () => {
    const r = guardSql("EXEC sp_something");
    expect(r.allowed).toBe(false);
  });

  it("빈 쿼리 차단", () => {
    const r = guardSql("   ");
    expect(r.allowed).toBe(false);
  });
});
