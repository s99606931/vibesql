import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { memSchedules, persistSchedules } from "@/lib/db/mem-schedules";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  savedQueryId: z.string().optional(),
  sql: z.string().min(1).max(50_000),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]).default("postgresql"),
  cronExpr: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
});

export async function GET(_req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const schedules = await prisma.scheduledQuery.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: schedules });
    } catch { /* fall through */ }
  }

  return NextResponse.json({
    data: memSchedules
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
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
      const schedule = await prisma.scheduledQuery.create({
        data: {
          ...parsed.data,
          savedQueryId: parsed.data.savedQueryId ?? null,
          userId,
        },
      });
      return NextResponse.json({ data: schedule }, { status: 201 });
    } catch { /* fall through */ }
  }

  const now = new Date().toISOString();
  const schedule = {
    id: crypto.randomUUID(),
    userId,
    ...parsed.data,
    savedQueryId: parsed.data.savedQueryId ?? null,
    lastRunAt: null,
    lastRunStatus: null,
    nextRunAt: null,
    createdAt: now,
    updatedAt: now,
  };
  memSchedules.push(schedule);
  persistSchedules();
  return NextResponse.json({ data: schedule }, { status: 201 });
}
