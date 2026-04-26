import { NextResponse } from "next/server";
import { z } from "zod";
import type { SavedQuery, DbDialect } from "@/types";

const MAX_ITEMS = 200;
const items: SavedQuery[] = [];

// Exported for use by sub-routes (e.g. [id]/route.ts)
export const __items = items;

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
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.savedQuery.findMany({
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ data: [...items] });
}

export async function POST(req: Request) {
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
        data: { ...prismaData, userId: "system" },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through */
    }
  }

  const item: SavedQuery = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed.data,
    dialect: parsed.data.dialect as DbDialect,
  };

  items.unshift(item);
  if (items.length > MAX_ITEMS) items.pop();

  return NextResponse.json({ data: item }, { status: 201 });
}
