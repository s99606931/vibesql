import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { memUsers } from "@/lib/db/mem-users";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ data: users });
    } catch { /* fall through */ }
  }

  return NextResponse.json({
    data: memUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
    })),
  });
}
