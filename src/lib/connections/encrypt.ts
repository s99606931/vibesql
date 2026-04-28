import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Requires 32-byte hex key: CONNECTION_ENCRYPTION_KEY=<openssl rand -hex 32>
// The base64 fallback is REMOVED — it stores passwords in plaintext-equivalent form
// and is a critical security vulnerability in any environment.
//
// Exception: VIBESQL_DEV_AUTH_BYPASS=1 + NODE_ENV=development allows running
// without a key (local dev without a real DB). A warning is always printed.
const KEY_HEX = process.env.CONNECTION_ENCRYPTION_KEY ?? "";

function isKeyConfigured(): boolean {
  return KEY_HEX.length === 64;
}

function isDevBypassAllowed(): boolean {
  // Allow base64 fallback when:
  //   - explicitly opted in via VIBESQL_DEV_AUTH_BYPASS=1, AND
  //   - NODE_ENV is development OR test (vitest sets NODE_ENV=test).
  // Production never qualifies because NODE_ENV=production.
  return (
    process.env.VIBESQL_DEV_AUTH_BYPASS === "1" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
  );
}

export function encryptPassword(plaintext: string): string {
  if (!plaintext) return "";
  if (!isKeyConfigured()) {
    if (!isDevBypassAllowed()) {
      throw new Error(
        "CONNECTION_ENCRYPTION_KEY must be set. " +
          "Generate one with: openssl rand -hex 32"
      );
    }
    // Development-only fallback when dev-bypass is explicitly enabled.
    // NOT cryptographically secure — migrate to a real key before connecting real DBs.
    console.warn(
      "[vibeSQL] WARNING: CONNECTION_ENCRYPTION_KEY is not set. " +
        "Passwords are stored as base64 (not encrypted). " +
        "Set CONNECTION_ENCRYPTION_KEY in .env.local to enable real encryption."
    );
    return Buffer.from(plaintext).toString("base64");
  }
  const key = Buffer.from(KEY_HEX, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes256gcm:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith("aes256gcm:")) {
    // Legacy base64 path — warn and migrate-encourage, but still decode for backwards compat.
    console.warn(
      "[vibeSQL] WARNING: A connection password is stored in legacy base64 format (not encrypted). " +
        "Re-save the connection after setting CONNECTION_ENCRYPTION_KEY to encrypt it properly."
    );
    return Buffer.from(stored, "base64").toString("utf8");
  }
  if (!isKeyConfigured()) {
    throw new Error("CONNECTION_ENCRYPTION_KEY is required to decrypt AES-encrypted passwords");
  }
  const [, ivHex, tagHex, dataHex] = stored.split(":");
  const key = Buffer.from(KEY_HEX, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}
