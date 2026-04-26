import { NextResponse } from "next/server";
import { z } from "zod";
import type { SavedQuery, DbDialect } from "@/types";
import { requireUserId } from "@/lib/auth/require-user";

const MAX_ITEMS = 200;

// Internal storage type — userId field kept private to this module tree
type _StoredItem = SavedQuery & { _userId: string };
const items: _StoredItem[] = [];

// Exported for sub-routes; they must check _userId for ownership
export const __items: _StoredItem[] = items;

const SaveSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  folder: z.string().default("기본"),
  tags: z.array(z.string()).default([]),
  nlQuery: z.string().default(""),
  sql: z.string().min(1),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]),
  connectionId: z.string().optional(),
});

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.savedQuery.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    } catch {
      /* fall through */
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return NextResponse.json({ data: items.filter((i) => i._userId === userId).map(({ _userId, ...q }) => q) });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청입니다.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      // connectionId is not in the Prisma SavedQuery model; omit it
      const { connectionId: _cid, ...prismaData } = parsed.data;
      const row = await prisma.savedQuery.create({
        data: { ...prismaData, userId },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through */
    }
  }

  const item: _StoredItem = {
    id: crypto.randomUUID(),
    _userId: userId,
    createdAt: new Date().toISOString(),
    ...parsed.data,
    dialect: parsed.data.dialect as DbDialect,
  };

  items.unshift(item);
  if (items.length > MAX_ITEMS) items.pop();

  return NextResponse.json({ data: item }, { status: 201 });
}
