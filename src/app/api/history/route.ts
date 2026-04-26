import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

interface HistoryItem {
  id: string;
  userId: string;
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
export const items: HistoryItem[] = [];

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

export async function GET(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") as "SUCCESS" | "ERROR" | "BLOCKED" | null;
  const starred = searchParams.get("starred") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const where = {
        userId,
        ...(search ? { OR: [
          { sql: { contains: search } },
          { nlQuery: { contains: search } },
        ] } : {}),
        ...(status ? { status } : {}),
        ...(starred ? { starred: true } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.queryHistory.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: { connection: { select: { name: true } } },
        }),
        prisma.queryHistory.count({ where }),
      ]);
      const mapped = rows.map(({ connection, ...r }) => ({
        ...r,
        connectionName: connection?.name ?? undefined,
      }));
      return NextResponse.json({ data: mapped, meta: { total, limit, offset } });
    } catch {
      /* fall through */
    }
  }

  let filtered = items.filter((i) => i.userId === userId);
  if (search) filtered = filtered.filter((i) =>
    i.sql.toLowerCase().includes(search.toLowerCase()) ||
    (i.nlQuery ?? "").toLowerCase().includes(search.toLowerCase())
  );
  if (status) filtered = filtered.filter((i) => i.status === status);
  if (starred) filtered = filtered.filter((i) => i.starred);

  return NextResponse.json({
    data: filtered.slice(offset, offset + limit),
    meta: { total: filtered.length, limit, offset },
  });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

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
        data: {
          ...rest,
          starred: false,
          userId,
          ...(connectionId ? { connectionId } : {}),
        },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through */
    }
  }

  const item: HistoryItem = {
    id: crypto.randomUUID(),
    userId,
    ...parsed.data,
    starred: false,
    createdAt: new Date().toISOString(),
  };

  items.unshift(item);
  if (items.length > MAX_ITEMS) items.pop();

  return NextResponse.json({ data: item }, { status: 201 });
}
