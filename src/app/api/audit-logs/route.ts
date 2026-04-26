import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";

export interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO string
}

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: [] as AuditLogItem[] });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
    });

    const data: AuditLogItem[] = logs.map((log) => ({
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
