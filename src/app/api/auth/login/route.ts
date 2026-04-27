import { NextResponse } from "next/server";
import { z } from "zod";
import { signSession, SESSION_COOKIE } from "@/lib/auth/jwt";
import { memUsers, verifyPassword } from "@/lib/db/mem-users";
import type { UserRole } from "@/lib/auth/jwt";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "이메일 또는 비밀번호를 확인해주세요." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  let userId: string | null = null;
  let userEmail = email;
  let userName = "";
  let userRole: UserRole = "USER";

  // Try DB first
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, passwordHash: true },
      });
      if (user && user.passwordHash && verifyPassword(password, user.passwordHash)) {
        userId = user.id;
        userEmail = user.email;
        userName = user.name ?? email;
        userRole = user.role as UserRole;
      }
    } catch { /* fall through to in-memory */ }
  }

  // In-memory fallback
  if (!userId) {
    const mem = memUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (mem && verifyPassword(password, mem.passwordHash)) {
      userId = mem.id;
      userEmail = mem.email;
      userName = mem.name;
      userRole = mem.role;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await signSession({ userId, email: userEmail, name: userName, role: userRole });

  const res = NextResponse.json({
    data: { id: userId, email: userEmail, name: userName, role: userRole },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
