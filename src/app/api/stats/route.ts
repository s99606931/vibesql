import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";

interface StatsData {
  totalQueries: number;
  successRate: number;
  totalConnections: number;
  totalSaved: number;
  avgDurationMs: number;
}

export async function GET(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");

      const [totalQueries, successCount, totalConnections, totalSaved, agg] =
        await Promise.all([
          prisma.queryHistory.count({ where: { userId } }),
          prisma.queryHistory.count({ where: { status: "SUCCESS", userId } }),
          prisma.connection.count({ where: { userId } }),
          prisma.savedQuery.count({ where: { userId } }),
          prisma.queryHistory.aggregate({
            _avg: { durationMs: true },
            where: { status: "SUCCESS", userId },
          }),
        ]);

      const successRate =
        totalQueries > 0
          ? Math.round((successCount / totalQueries) * 100)
          : 0;

      const avgDurationMs = Math.round(agg._avg.durationMs ?? 0);

      const data: StatsData = {
        totalQueries,
        successRate,
        totalConnections,
        totalSaved,
        avgDurationMs,
      };

      return NextResponse.json({ data });
    } catch {
      /* fall through to in-memory fallback */
    }
  }

  // In-memory fallback: read from in-memory stores
  let totalQueries = 0;
  let successCount = 0;
  let sumDurationMs = 0;
  let totalConnections = 0;
  let totalSaved = 0;

  try {
    const [histMod, connMod, savedMod] = await Promise.all([
      import("@/app/api/history/route"),
      import("@/lib/connections/store"),
      import("@/app/api/saved/route"),
    ]);

    const res = await histMod.GET(new Request(`http://localhost/api/history?limit=200`));
    const json = (await res.json()) as { data: Array<{ status: string; durationMs?: number; userId: string }> };
    const rows = json.data.filter((r) => r.userId === userId);
    totalQueries = rows.length;
    for (const row of rows) {
      if (row.status === "SUCCESS") {
        successCount++;
        sumDurationMs += row.durationMs ?? 0;
      }
    }

    totalConnections = connMod.getAllConnections().filter((c) => c.userId === userId).length;
    totalSaved = savedMod.__items.filter((i: { _userId?: string }) => i._userId === userId).length;
  } catch {
    /* ignore — return zeros */
  }

  const successRate =
    totalQueries > 0 ? Math.round((successCount / totalQueries) * 100) : 0;
  const avgDurationMs =
    successCount > 0 ? Math.round(sumDurationMs / successCount) : 0;

  const data: StatsData = {
    totalQueries,
    successRate,
    totalConnections,
    totalSaved,
    avgDurationMs,
  };

  return NextResponse.json({ data });
}
