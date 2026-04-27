// JWT implementation using Web Crypto (SubtleCrypto) — compatible with Node.js 18+ and Edge runtime.

export type UserRole = "USER" | "ADMIN";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export const SESSION_COOKIE = "vs-session";

const EXPIRY_SECS = 7 * 24 * 60 * 60; // 7 days

function getSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "vibesql-dev-secret-please-change-in-production";
  return new TextEncoder().encode(secret);
}

async function importKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    getSecretBytes(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function parseB64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + EXPIRY_SECS };

  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const bodyB64 = b64url(enc.encode(JSON.stringify(claims)));
  const input = `${headerB64}.${bodyB64}`;

  const key = await importKey("sign");
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(input));

  return `${input}.${b64url(sig)}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sigB64] = parts;
    const input = `${headerB64}.${bodyB64}`;

    const key = await importKey("verify");
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      parseB64url(sigB64),
      new TextEncoder().encode(input)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(parseB64url(bodyB64))) as SessionPayload & { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
