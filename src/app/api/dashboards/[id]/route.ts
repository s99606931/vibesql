import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import type { Prisma } from ".prisma/client";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  widgets: z.array(z.record(z.string(), z.unknown())).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;
  const { id } = await params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.dashboard.findFirst({ where: { id, userId } });
      if (!row) return NextResponse.json({ error: "대시보드를 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ data: row });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;
  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.dashboard.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "대시보드를 찾을 수 없습니다." }, { status: 404 });
      const { widgets, ...rest } = parsed.data;
      const updated = await prisma.dashboard.update({
        where: { id },
        data: { ...rest, ...(widgets !== undefined ? { widgets: widgets as Prisma.InputJsonValue[] } : {}) },
      });
      return NextResponse.json({ data: updated });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;
  const { id } = await params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.dashboard.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "대시보드를 찾을 수 없습니다." }, { status: 404 });
      await prisma.dashboard.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
