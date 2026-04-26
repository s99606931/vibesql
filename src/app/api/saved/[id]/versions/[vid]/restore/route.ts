import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { memQueryVersions } from "../../route";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params;

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const query = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!query) {
        return NextResponse.json({ error: "쿼리를 찾을 수 없습니다." }, { status: 404 });
      }
      const version = await prisma.queryVersion.findFirst({ where: { id: vid, queryId: id } });
      if (!version) {
        return NextResponse.json({ error: "버전을 찾을 수 없습니다." }, { status: 404 });
      }
      const updated = await prisma.savedQuery.update({
        where: { id },
        data: { sql: version.sql, nlQuery: version.nlQuery },
      });
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const version = memQueryVersions.find((v) => v.id === vid && v.queryId === id);
  if (!version) {
    return NextResponse.json({ error: "버전을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ data: { id, sql: version.sql, nlQuery: version.nlQuery } });
}
