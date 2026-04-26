import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllConnections,
  addConnection,
  type StoredConnection,
} from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";

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
    } catch {
      /* fall through */
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

  const body = await req.json();
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
          passwordHash: password
            ? Buffer.from(password).toString("base64")
            : undefined,
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
      return NextResponse.json({ data: conn }, { status: 201 });
    } catch {
      /* fall through */
    }
  }

  const conn: StoredConnection = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
    ...rest,
    passwordBase64: password
      ? Buffer.from(password).toString("base64")
      : undefined,
    userId,
  };
  addConnection(conn);

  // Return without sensitive fields
  const { passwordBase64: _pw, ...safeConn } = conn;
  return NextResponse.json({ data: safeConn }, { status: 201 });
}
