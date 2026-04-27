import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const VALID_KEY_HEX = "a".repeat(64); // 32 bytes as hex

describe("encryptPassword / decryptPassword — key 미설정 (dev fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("CONNECTION_ENCRYPTION_KEY", ""); // force base64 fallback regardless of CI env
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("빈 문자열 → 빈 문자열 반환", async () => {
    const { encryptPassword } = await import("../encrypt");
    expect(encryptPassword("")).toBe("");
  });

  it("key 없으면 base64로 인코딩", async () => {
    const { encryptPassword } = await import("../encrypt");
    const result = encryptPassword("my-password");
    expect(result).toBe(Buffer.from("my-password").toString("base64"));
    expect(result).not.toContain("aes256gcm:");
  });

  it("base64 저장값 복호화 → 원문 반환", async () => {
    const { encryptPassword, decryptPassword } = await import("../encrypt");
    const stored = encryptPassword("hello123");
    expect(decryptPassword(stored)).toBe("hello123");
  });

  it("decryptPassword 빈 문자열 → 빈 문자열", async () => {
    const { decryptPassword } = await import("../encrypt");
    expect(decryptPassword("")).toBe("");
  });

  it("aes256gcm: 접두사 없는 값은 base64로 디코딩", async () => {
    const { decryptPassword } = await import("../encrypt");
    const b64 = Buffer.from("test-pass").toString("base64");
    expect(decryptPassword(b64)).toBe("test-pass");
  });
});

describe("encryptPassword / decryptPassword — AES-256-GCM key 설정", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("CONNECTION_ENCRYPTION_KEY", VALID_KEY_HEX);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("AES 암호화 결과는 aes256gcm: 접두사를 가짐", async () => {
    const { encryptPassword } = await import("../encrypt");
    const result = encryptPassword("secret");
    expect(result).toMatch(/^aes256gcm:/);
  });

  it("AES 암호화 후 복호화 → 원문 복원", async () => {
    const { encryptPassword, decryptPassword } = await import("../encrypt");
    const encrypted = encryptPassword("my-db-password");
    expect(decryptPassword(encrypted)).toBe("my-db-password");
  });

  it("빈 문자열은 AES 경로에서도 빈 문자열 반환", async () => {
    const { encryptPassword } = await import("../encrypt");
    expect(encryptPassword("")).toBe("");
  });

  it("특수문자 포함 패스워드도 정확히 복원", async () => {
    const { encryptPassword, decryptPassword } = await import("../encrypt");
    const original = "P@ssw0rd!#$%^&*()한글포함";
    expect(decryptPassword(encryptPassword(original))).toBe(original);
  });

  it("key 없이 aes256gcm: 값 복호화 시도 → Error", async () => {
    vi.unstubAllEnvs(); // key 제거
    vi.resetModules();
    const { encryptPassword } = (() => {
      // aes256gcm: 접두사가 있는 더미 값 생성
      return { encryptPassword: () => "aes256gcm:aabbcc:ddeeff:001122" };
    })();
    const { decryptPassword } = await import("../encrypt");
    expect(() => decryptPassword("aes256gcm:aabbcc:ddeeff:001122")).toThrow(
      /CONNECTION_ENCRYPTION_KEY/
    );
  });
});
