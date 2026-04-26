import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { memSchedules, persistSchedules } from "@/lib/db/mem-schedules";

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sql: z.string().min(1).max(50_000).optional(),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]).optional(),
  cronExpr: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.scheduledQuery.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
      }
      const updated = await prisma.scheduledQuery.update({ where: { id }, data: parsed.data });
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const schedule = memSchedules.find((s) => s.id === id && s.userId === userId);
  if (!schedule) {
    return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
  }
  Object.assign(schedule, { ...parsed.data, updatedAt: new Date().toISOString() });
  persistSchedules();
  return NextResponse.json({ data: schedule });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.scheduledQuery.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
      }
      await prisma.scheduledQuery.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch { /* fall through */ }
  }

  const idx = memSchedules.findIndex((s) => s.id === id && s.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
  }
  memSchedules.splice(idx, 1);
  persistSchedules();
  return NextResponse.json({ data: { id } });
}
