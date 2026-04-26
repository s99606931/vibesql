import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  void req;

  const { token } = await context.params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const sharedLink = await prisma.sharedLink.findUnique({ where: { token } });

      if (!sharedLink || sharedLink.revokedAt !== null) {
        return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
      }
      if (sharedLink.expiresAt !== null && sharedLink.expiresAt < new Date()) {
        return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 404 });
      }
      prisma.sharedLink
        .update({ where: { token }, data: { viewCount: { increment: 1 } } })
        .catch(() => {});
      return NextResponse.json({
        data: { sql: sharedLink.sql, nlQuery: sharedLink.nlQuery, dialect: sharedLink.dialect, title: sharedLink.title, viewCount: sharedLink.viewCount },
      });
    } catch { /* fall through */ }
  }

  // In-memory fallback
  try {
    const { memSharedLinks } = await import("../route");
    const link = memSharedLinks.find((l) => l.token === token);
    if (!link || link.revokedAt !== null) {
      return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
    }
    if (link.expiresAt !== null && link.expiresAt < new Date()) {
      return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 404 });
    }
    link.viewCount += 1;
    return NextResponse.json({
      data: { sql: link.sql, nlQuery: link.nlQuery, dialect: link.dialect, title: link.title, viewCount: link.viewCount },
    });
  } catch {
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  void req;

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { token } = await context.params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const sharedLink = await prisma.sharedLink.findUnique({ where: { token } });
      if (!sharedLink || sharedLink.userId !== userId) {
        return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
      }
      await prisma.sharedLink.update({ where: { token }, data: { revokedAt: new Date() } });
      return NextResponse.json({ data: { success: true } });
    } catch { /* fall through */ }
  }

  // In-memory fallback
  try {
    const { memSharedLinks } = await import("../route");
    const link = memSharedLinks.find((l) => l.token === token && l.userId === userId);
    if (!link) {
      return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
    }
    link.revokedAt = new Date();
    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json({ error: "링크 삭제에 실패했습니다." }, { status: 500 });
  }
}
