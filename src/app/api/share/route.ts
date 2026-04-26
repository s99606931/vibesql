import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit/log-action";

// ─── in-memory fallback ───────────────────────────────────────────────────────

export interface MemSharedLink {
  id: string;
  token: string;
  resourceType: string;
  resourceId: string | null;
  sql: string | null;
  nlQuery: string | null;
  dialect: string;
  title: string | null;
  expiresAt: Date | null;
  userId: string;
  viewCount: number;
  revokedAt: Date | null;
  createdAt: Date;
}

export const memSharedLinks: MemSharedLink[] = [];

const SHARE_LIMIT = 30;
const SHARE_WINDOW_MS = 60_000;

const CreateShareSchema = z.object({
  resourceType: z.enum(["query", "dashboard"]),
  resourceId: z.string().optional(),
  sql: z.string().max(50_000).optional(),
  nlQuery: z.string().max(1000).optional(),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql"]).optional().default("postgresql"),
  title: z.string().max(200).optional(),
  expiresDays: z.number().int().positive().max(365).optional(),
}).refine((d) => d.sql != null || d.resourceId != null, {
  message: "sql 또는 resourceId 중 하나는 필수입니다.",
});

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`share:${userId}:${ip}`, SHARE_LIMIT, SHARE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

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

    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
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
        void logAction({
          action: "share.created",
          userId,
          ipAddress: ip,
          metadata: { token: sharedLink.token, resourceType },
        });
        return NextResponse.json({ data: { token: sharedLink.token, url: `/share/${sharedLink.token}`, expiresAt: sharedLink.expiresAt } });
      } catch { /* fall through to in-memory */ }
    }

    // In-memory fallback
    const link: MemSharedLink = {
      id: crypto.randomUUID(),
      token,
      resourceType,
      resourceId: resourceId ?? null,
      sql: sql ?? null,
      nlQuery: nlQuery ?? null,
      dialect: dialect ?? "postgresql",
      title: title ?? null,
      expiresAt,
      userId,
      viewCount: 0,
      revokedAt: null,
      createdAt: new Date(),
    };
    memSharedLinks.push(link);
    void logAction({
      action: "share.created",
      userId,
      ipAddress: ip,
      metadata: { token, resourceType },
    });
    return NextResponse.json({ data: { token, url: `/share/${token}`, expiresAt } });
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

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const sharedLinks = await prisma.sharedLink.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: sharedLinks });
    } catch { /* fall through */ }
  }

  return NextResponse.json({
    data: memSharedLinks.filter((l) => l.userId === userId && l.revokedAt === null),
  });
}
