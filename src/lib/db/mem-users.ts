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

function hashPwd(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + (process.env.JWT_SECRET ?? "vibesql-dev-secret"))
    .digest("hex");
}

export const memUsers: MemUser[] = [
  {
    id: "admin-1",
    email: "admin@vibesql.dev",
    name: "관리자",
    passwordHash: hashPwd("admin123"),
    role: "ADMIN",
    createdAt: new Date(),
  },
  {
    id: "dev-user",
    email: "user@vibesql.dev",
    name: "일반사용자",
    passwordHash: hashPwd("user123"),
    role: "USER",
    createdAt: new Date(),
  },
];

export function hashPassword(password: string): string {
  return hashPwd(password);
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPwd(password) === hash;
}
