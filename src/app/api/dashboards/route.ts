import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import type { Prisma } from ".prisma/client";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  widgets: z.array(z.record(z.string(), z.unknown())).default([]),
  isPublic: z.boolean().default(false),
});

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.dashboard.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ data: [] });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.dashboard.create({
        data: {
          ...parsed.data,
          widgets: parsed.data.widgets as Prisma.InputJsonValue[],
          userId,
        },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ error: "DATABASE_URL이 설정되지 않았습니다." }, { status: 503 });
}
