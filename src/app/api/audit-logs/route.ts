import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-user";

export interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO string
}

export async function GET(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: [] as AuditLogItem[] });
  }

  const { searchParams } = new URL(req.url);
  const filterUserId = searchParams.get("userId") || undefined;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const logs = await prisma.auditLog.findMany({
      // ADMIN sees all users; optional userId filter for drill-down
      where: filterUserId ? { userId: filterUserId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
    });

    const data: AuditLogItem[] = logs.map((log: {
      id: string;
      action: string;
      userId: string | null;
      ipAddress: string | null;
      metadata: unknown;
      createdAt: Date;
    }) => ({
      id: log.id,
      action: log.action,
      userId: log.userId,
      ipAddress: log.ipAddress,
      metadata: (log.metadata as Record<string, unknown> | null) ?? null,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] as AuditLogItem[] });
  }
}
