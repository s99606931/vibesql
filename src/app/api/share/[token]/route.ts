import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  void req;

  const { token } = await context.params;

  try {
    const sharedLink = await prisma.sharedLink.findUnique({
      where: { token },
    });

    if (!sharedLink) {
      return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
    }

    if (sharedLink.revokedAt !== null) {
      return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 404 });
    }

    if (sharedLink.expiresAt !== null && sharedLink.expiresAt < new Date()) {
      return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 404 });
    }

    // fire-and-forget view count increment
    prisma.sharedLink
      .update({
        where: { token },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err: unknown) => {
        console.error("[share token GET] viewCount update failed:", err instanceof Error ? err.message : err);
      });

    return NextResponse.json({
      data: {
        sql: sharedLink.sql,
        nlQuery: sharedLink.nlQuery,
        dialect: sharedLink.dialect,
        title: sharedLink.title,
        viewCount: sharedLink.viewCount,
      },
    });
  } catch (error) {
    console.error("[share token GET] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  void req;

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { token } = await context.params;

  try {
    const sharedLink = await prisma.sharedLink.findUnique({
      where: { token },
    });

    if (!sharedLink) {
      return NextResponse.json({ error: "링크가 존재하지 않습니다." }, { status: 404 });
    }

    if (sharedLink.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.sharedLink.update({
      where: { token },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[share token DELETE] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "링크 삭제에 실패했습니다." }, { status: 500 });
  }
}
