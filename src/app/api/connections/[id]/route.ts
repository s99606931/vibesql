import { NextResponse } from "next/server";
import { z } from "zod";
import { getConnection, updateConnection, deleteConnection } from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import { evictRunPools } from "@/app/api/queries/run/route";
import { evictSchemaPool } from "@/app/api/schema/route";
import { encryptPassword } from "@/lib/connections/encrypt";

export async function GET(
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
      const conn = await prisma.connection.findFirst({
        where: { id, userId },
        select: { id: true, name: true, type: true, host: true, port: true, database: true, username: true, ssl: true, isActive: true, createdAt: true },
      });
      if (!conn) return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ data: conn });
    } catch { /* fall through */ }
  }

  const conn = getConnection(id);
  if (!conn || (conn.userId !== undefined && conn.userId !== userId)) {
    return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
  }
  const { passwordBase64: _pw, ...safeConn } = conn;
  void _pw;
  return NextResponse.json({ data: safeConn });
}

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().min(1).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.connection.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
      const updated = await prisma.connection.update({
        where: { id },
        data: {
          ...rest,
          ...(password ? { passwordHash: encryptPassword(password) } : {}),
        },
        select: { id: true, name: true, type: true, host: true, port: true, database: true, username: true, ssl: true, isActive: true, createdAt: true },
      });
      evictRunPools(id);
      evictSchemaPool(id);
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const conn = getConnection(id);
  if (!conn || (conn.userId !== undefined && conn.userId !== userId)) {
    return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
  }
  updateConnection(id, {
    ...rest,
    ...(password ? { passwordBase64: encryptPassword(password) } : {}),
  });
  evictRunPools(id);
  evictSchemaPool(id);
  const { passwordBase64: _pw, ...safeConn } = getConnection(id)!;
  return NextResponse.json({ data: safeConn });
}

export async function DELETE(
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

      // 소유권 검증
      const conn = await prisma.connection.findFirst({
        where: { id, userId },
      });
      if (!conn) {
        return NextResponse.json(
          { error: "연결을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      await prisma.connection.delete({ where: { id } });
      evictRunPools(id);
      evictSchemaPool(id);
      return NextResponse.json({ data: { id } });
    } catch {
      /* fall through to in-memory */
    }
  }

  const conn = getConnection(id);
  if (!conn || (conn.userId !== undefined && conn.userId !== userId)) {
    return NextResponse.json(
      { error: "연결을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  deleteConnection(id);
  evictRunPools(id);
  evictSchemaPool(id);
  return NextResponse.json({ data: { id } });
}
