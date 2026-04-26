import { NextResponse } from "next/server";
import { z } from "zod";

interface HistoryItem {
  id: string;
  nlQuery?: string;
  sql: string;
  dialect: string;
  status: "SUCCESS" | "ERROR" | "BLOCKED";
  rowCount?: number;
  durationMs?: number;
  errorMsg?: string;
  starred: boolean;
  createdAt: string;
  connectionName?: string;
}

const MAX_ITEMS = 100;
const items: HistoryItem[] = [];

const SaveSchema = z.object({
  nlQuery: z.string().optional(),
  sql: z.string().min(1),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"]).default("postgresql"),
  status: z.enum(["SUCCESS", "ERROR", "BLOCKED"]).default("SUCCESS"),
  rowCount: z.number().optional(),
  durationMs: z.number().optional(),
  errorMsg: z.string().optional(),
  connectionName: z.string().optional(),
  connectionId: z.string().optional(),
});

export async function GET() {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.queryHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: rows });
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ data: [...items].slice(0, 50) });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const { connectionName: _cn, connectionId, ...rest } = parsed.data;
      const row = await prisma.queryHistory.create({
        data: { ...rest, starred: false, userId: "system", connectionId },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through */
    }
  }

  const item: HistoryItem = {
    id: crypto.randomUUID(),
    ...parsed.data,
    starred: false,
    createdAt: new Date().toISOString(),
  };

  items.unshift(item);
  if (items.length > MAX_ITEMS) items.pop();

  return NextResponse.json({ data: item }, { status: 201 });
}
