import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Requires 32-byte hex key: CONNECTION_ENCRYPTION_KEY=<openssl rand -hex 32>
// Falls back to base64 encoding when key is not set (development only).
const KEY_HEX = process.env.CONNECTION_ENCRYPTION_KEY ?? "";

function isKeyConfigured(): boolean {
  return KEY_HEX.length === 64;
}

export function encryptPassword(plaintext: string): string {
  if (!plaintext) return "";
  if (!isKeyConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CONNECTION_ENCRYPTION_KEY must be set in production. " +
          "Generate one with: openssl rand -hex 32"
      );
    }
    // Development fallback — not cryptographically secure
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
    // Legacy base64 — decode directly
    return Buffer.from(stored, "base64").toString("utf8");
  }
  if (!isKeyConfigured()) {
    throw new Error("CONNECTION_ENCRYPTION_KEY is required to decrypt passwords");
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
