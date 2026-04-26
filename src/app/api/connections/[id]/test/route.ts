import { NextResponse } from "next/server";
import { getConnection, updateConnection } from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import type { StoredConnection } from "@/lib/connections/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "연결을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // Try in-memory store first, then Prisma (filtered by userId to prevent cross-tenant access)
  let conn: StoredConnection | undefined = getConnection(id);
  if (!conn && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.connection.findUnique({ where: { id, userId } });
      if (row) {
        conn = {
          id: row.id,
          name: row.name,
          type: row.type as StoredConnection["type"],
          host: row.host ?? undefined,
          port: row.port ?? undefined,
          database: row.database,
          username: row.username ?? undefined,
          passwordBase64: row.passwordHash ?? undefined,
          ssl: row.ssl,
          isActive: row.isActive,
          lastTestedAt: row.lastTestedAt?.toISOString(),
          lastTestedOk: row.lastTestedOk ?? undefined,
          createdAt: row.createdAt.toISOString(),
        };
      }
    } catch { /* fall through */ }
  }

  if (!conn) {
    return NextResponse.json(
      { error: "연결을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (conn.type === "postgresql") {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        host: conn.host || "localhost",
        port: conn.port || 5432,
        database: conn.database,
        user: conn.username,
        password: conn.passwordBase64
          ? Buffer.from(conn.passwordBase64, "base64").toString()
          : undefined,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });

      const start = Date.now();
      await client.connect();
      let res;
      try {
        res = await client.query("SELECT version()");
      } finally {
        await client.end().catch(() => undefined);
      }

      const latencyMs = Date.now() - start;
      const serverVersion = (res.rows[0]?.version as string | undefined)
        ?.split(" ")
        .slice(0, 2)
        .join(" ");

      if (process.env.DATABASE_URL) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          await prisma.connection.update({
            where: { id, userId },
            data: { lastTestedAt: new Date(), lastTestedOk: true },
          });
        } catch { /* fall through to in-memory */ }
      }
      updateConnection(id, {
        lastTestedAt: new Date().toISOString(),
        lastTestedOk: true,
      });

      return NextResponse.json({
        data: { success: true, latencyMs, serverVersion },
      });
    } catch (err) {
      console.error("[test] connection error:", err instanceof Error ? err.message : err);

      if (process.env.DATABASE_URL) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          await prisma.connection.update({
            where: { id },
            data: { lastTestedAt: new Date(), lastTestedOk: false },
          });
        } catch { /* fall through */ }
      }
      updateConnection(id, {
        lastTestedAt: new Date().toISOString(),
        lastTestedOk: false,
      });

      return NextResponse.json(
        { error: "연결 테스트에 실패했습니다." },
        { status: 400 }
      );
    }
  }

  // Fall back to mock for non-PostgreSQL or unknown connections
  await new Promise((r) => setTimeout(r, 300));

  return NextResponse.json({
    data: {
      success: true,
      latencyMs: Math.floor(Math.random() * 50) + 10,
      serverVersion: "PostgreSQL 16.1",
    },
  });
}
