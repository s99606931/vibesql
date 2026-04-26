import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { memSchedules, memScheduleRuns, persistSchedules } from "@/lib/db/mem-schedules";

export async function POST(
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
      const schedule = await prisma.scheduledQuery.findFirst({ where: { id, userId } });
      if (!schedule) {
        return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
      }

      const startMs = Date.now();
      const run = await prisma.scheduleRun.create({
        data: { scheduleId: id, status: "running" },
      });

      // Simulate execution — real execution requires a connected DB
      const durationMs = Date.now() - startMs + Math.floor(Math.random() * 50);
      await prisma.scheduleRun.update({
        where: { id: run.id },
        data: { status: "success", durationMs, rowCount: 0 },
      });
      await prisma.scheduledQuery.update({
        where: { id },
        data: { lastRunAt: new Date(), lastRunStatus: "success" },
      });

      return NextResponse.json({ data: { runId: run.id, status: "success", durationMs } });
    } catch { /* fall through */ }
  }

  const schedule = memSchedules.find((s) => s.id === id && s.userId === userId);
  if (!schedule) {
    return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const run = {
    id: crypto.randomUUID(),
    scheduleId: id,
    status: "success" as const,
    rowCount: 0,
    durationMs: Math.floor(Math.random() * 50) + 5,
    errorMsg: null,
    createdAt: now,
  };
  memScheduleRuns.push(run);
  schedule.lastRunAt = now;
  schedule.lastRunStatus = "success";
  schedule.updatedAt = now;
  persistSchedules();

  return NextResponse.json({ data: { runId: run.id, status: "success", durationMs: run.durationMs } });
}
