import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { memUsers } from "@/lib/db/mem-users";

const PatchSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { role } = parsed.data;

  // Prevent self-demotion
  if (id === auth.userId && role === "USER") {
    return NextResponse.json({ error: "자기 자신의 관리자 권한을 해제할 수 없습니다." }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, name: true, role: true },
      });
      return NextResponse.json({ data: updated });
    } catch {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const idx = memUsers.findIndex((u) => u.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }
  memUsers[idx].role = role;
  const { passwordHash: _, ...safe } = memUsers[idx];
  return NextResponse.json({ data: safe });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { id } = await params;

  if (id === auth.userId) {
    return NextResponse.json({ error: "자기 자신을 삭제할 수 없습니다." }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ data: { ok: true } });
    } catch {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const idx = memUsers.findIndex((u) => u.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }
  memUsers.splice(idx, 1);
  return NextResponse.json({ data: { ok: true } });
}
