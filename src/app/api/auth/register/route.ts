import { NextResponse } from "next/server";
import { z } from "zod";
import { signSession, SESSION_COOKIE } from "@/lib/auth/jwt";
import { memUsers, hashPassword } from "@/lib/db/mem-users";
import type { UserRole } from "@/lib/auth/jwt";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(1).max(50),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const pwHash = hashPassword(password);

  let userId: string;
  let userRole: UserRole = "USER";

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
      }
      const user = await prisma.user.create({
        data: { email, name, passwordHash: pwHash, role: "USER" },
        select: { id: true, role: true },
      });
      userId = user.id;
      userRole = user.role as UserRole;
    } catch {
      return NextResponse.json({ error: "회원가입 중 오류가 발생했습니다." }, { status: 500 });
    }
  } else {
    // In-memory
    const exists = memUsers.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    const id = `user-${Date.now()}`;
    // First registered user in dev mode becomes admin
    if (memUsers.length === 0) userRole = "ADMIN";
    memUsers.push({ id, email, name, passwordHash: pwHash, role: userRole, createdAt: new Date() });
    userId = id;
  }

  const token = await signSession({ userId, email, name, role: userRole });
  const res = NextResponse.json({ data: { id: userId, email, name, role: userRole } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
