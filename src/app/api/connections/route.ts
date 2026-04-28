import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllConnections,
  addConnection,
  type StoredConnection,
} from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import { encryptPassword } from "@/lib/connections/encrypt";
import { logAction } from "@/lib/audit/log-action";

const ConnectionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
});

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (hasDatabaseUrl()) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const conns = await prisma.connection.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          host: true,
          port: true,
          database: true,
          username: true,
          ssl: true,
          isActive: true,
          lastTestedAt: true,
          lastTestedOk: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: conns });
    } catch (err) {
      console.error("[connections] GET prisma error:", err instanceof Error ? err.message : err);
      /* fall through to in-memory */
    }
  }

  const conns = getAllConnections()
    .filter((c) => c.userId === undefined || c.userId === userId)
    .map(({ passwordBase64: _pw, ...rest }) => rest);
  return NextResponse.json({ data: conns });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "올바른 JSON이 아닙니다." }, { status: 400 });
  }
  const parsed = ConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 연결 설정입니다." },
      { status: 400 }
    );
  }
  const { password, ...rest } = parsed.data;

  if (hasDatabaseUrl()) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const conn = await prisma.connection.create({
        data: {
          ...rest,
          passwordHash: password ? encryptPassword(password) : undefined,
          userId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          host: true,
          port: true,
          database: true,
          username: true,
          ssl: true,
          isActive: true,
          createdAt: true,
        },
      });
      void logAction({
        action: "connection.created",
        userId,
        metadata: { connectionId: conn.id, name: conn.name },
      });
      return NextResponse.json({ data: conn }, { status: 201 });
    } catch (err) {
      console.error("[connections] POST prisma error:", err instanceof Error ? err.message : err);
      /* fall through to in-memory */
    }
  }

  const conn: StoredConnection = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
    ...rest,
    passwordBase64: password ? encryptPassword(password) : undefined,
    userId,
  };
  addConnection(conn);

  // Return without sensitive fields
  const { passwordBase64: _pw, ...safeConn } = conn;
  void logAction({
    action: "connection.created",
    userId,
    metadata: { connectionId: safeConn.id, name: safeConn.name },
  });
  return NextResponse.json({ data: safeConn }, { status: 201 });
}
