/**
 * Audit log utility — fire-and-forget.
 *
 * Usage:
 *   void logAction({ action: "connection.created", userId, metadata: { connectionId, name } });
 *
 * Never throws. Falls back to console.log when DATABASE_URL is absent.
 */

export interface LogActionParams {
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export function logAction(params: LogActionParams): void {
  // Intentionally not awaited — callers use `void logAction(...)`.
  void _writeLog(params);
}

async function _writeLog(params: LogActionParams): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log("[audit]", params.action, JSON.stringify(params));
      return;
    }

    const { prisma } = await import("@/lib/db/prisma");
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata as unknown as import("@prisma/client").Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.warn("[audit] failed to write log:", err instanceof Error ? err.message : err);
  }
}
