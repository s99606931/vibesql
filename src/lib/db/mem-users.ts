import crypto from "crypto";
import type { UserRole } from "@/lib/auth/jwt";

export interface MemUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

// scrypt parameters — deliberately slow for brute-force resistance
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${salt}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// Default accounts — only loaded in non-production or when DATABASE_URL is absent.
// Passwords use scrypt so the hashes below are generated at module init.
const seedAccounts: Array<Omit<MemUser, "passwordHash"> & { plainPassword: string }> =
  process.env.NODE_ENV !== "production"
    ? [
        { id: "admin-1", email: "admin@vibesql.dev", name: "관리자", role: "ADMIN", plainPassword: "admin123", createdAt: new Date() },
        { id: "dev-user", email: "user@vibesql.dev", name: "일반사용자", role: "USER", plainPassword: "user123", createdAt: new Date() },
      ]
    : [];

export const memUsers: MemUser[] = seedAccounts.map(({ plainPassword, ...rest }) => ({
  ...rest,
  passwordHash: hashPassword(plainPassword),
}));
