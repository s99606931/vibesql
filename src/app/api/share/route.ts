import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";

const CreateShareSchema = z.object({
  resourceType: z.enum(["query", "dashboard"]),
  resourceId: z.string().optional(),
  sql: z.string().optional(),
  nlQuery: z.string().optional(),
  dialect: z.string().optional(),
  title: z.string().optional(),
  expiresDays: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  try {
    const body = await req.json();
    const parsed = CreateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { resourceType, resourceId, sql, nlQuery, dialect, title, expiresDays } =
      parsed.data;

    const token = crypto.randomUUID();
    const expiresAt =
      expiresDays != null
        ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
        : null;

    const sharedLink = await prisma.sharedLink.create({
      data: {
        token,
        resourceType,
        resourceId: resourceId ?? null,
        sql: sql ?? null,
        nlQuery: nlQuery ?? null,
        dialect: dialect ?? "postgresql",
        title: title ?? null,
        expiresAt,
        userId,
      },
    });

    const url = `/share/${sharedLink.token}`;

    return NextResponse.json({
      data: {
        token: sharedLink.token,
        url,
        expiresAt: sharedLink.expiresAt,
      },
    });
  } catch (error) {
    console.error("[share POST] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "공유 링크 생성에 실패했습니다." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  void req;

  try {
    const sharedLinks = await prisma.sharedLink.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: sharedLinks });
  } catch (error) {
    console.error("[share GET] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "목록 조회에 실패했습니다." }, { status: 500 });
  }
}
