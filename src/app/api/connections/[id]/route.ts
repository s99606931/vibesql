import { NextResponse } from "next/server";
import { getConnection, deleteConnection } from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import { evictRunPools } from "@/app/api/queries/run/route";
import { evictSchemaPool } from "@/app/api/schema/route";

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
