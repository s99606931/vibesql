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

function getSecretBytes(): Uint8Array<ArrayBuffer> {
  const secret = process.env.JWT_SECRET;
  // JWT_SECRET is required in ALL environments — a leaked default secret
  // lets attackers forge arbitrary session tokens regardless of NODE_ENV.
  // Throw lazily (not at module load) so Next.js build-time analysis doesn't crash.
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  const encoded = new TextEncoder().encode(secret);
  return new Uint8Array(encoded.buffer.slice(0) as ArrayBuffer);
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

function b64url(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function toBytes(str: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(str);
  return new Uint8Array(encoded.buffer.slice(0) as ArrayBuffer);
}

function parseB64url(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + EXPIRY_SECS };

  const headerB64 = b64url(toBytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const bodyB64 = b64url(toBytes(JSON.stringify(claims)));
  const input = `${headerB64}.${bodyB64}`;

  const key = await importKey("sign");
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, toBytes(input));

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
      toBytes(input)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(parseB64url(bodyB64))) as SessionPayload & { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
