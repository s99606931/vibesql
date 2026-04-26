import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

export interface MemQueryVersion {
  id: string;
  queryId: string;
  versionNo: number;
  sql: string;
  nlQuery: string;
  note: string | null;
  createdAt: string;
}

export const memQueryVersions: MemQueryVersion[] = [];

const PostSchema = z.object({
  sql: z.string().min(1),
  nlQuery: z.string().default(""),
  note: z.string().max(200).optional(),
});

export async function GET(
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
      const query = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!query) {
        return NextResponse.json({ error: "쿼리를 찾을 수 없습니다." }, { status: 404 });
      }
      const versions = await prisma.queryVersion.findMany({
        where: { queryId: id },
        orderBy: { versionNo: "desc" },
      });
      return NextResponse.json({ data: versions });
    } catch { /* fall through */ }
  }

  const versions = memQueryVersions
    .filter((v) => v.queryId === id)
    .sort((a, b) => b.versionNo - a.versionNo);
  return NextResponse.json({ data: versions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const query = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!query) {
        return NextResponse.json({ error: "쿼리를 찾을 수 없습니다." }, { status: 404 });
      }
      const lastVersion = await prisma.queryVersion.findFirst({
        where: { queryId: id },
        orderBy: { versionNo: "desc" },
      });
      const versionNo = (lastVersion?.versionNo ?? 0) + 1;
      const version = await prisma.queryVersion.create({
        data: {
          queryId: id,
          versionNo,
          sql: parsed.data.sql,
          nlQuery: parsed.data.nlQuery,
          note: parsed.data.note ?? null,
        },
      });
      return NextResponse.json({ data: version }, { status: 201 });
    } catch { /* fall through */ }
  }

  const existing = memQueryVersions.filter((v) => v.queryId === id);
  const versionNo = existing.length > 0 ? Math.max(...existing.map((v) => v.versionNo)) + 1 : 1;
  const version: MemQueryVersion = {
    id: crypto.randomUUID(),
    queryId: id,
    versionNo,
    sql: parsed.data.sql,
    nlQuery: parsed.data.nlQuery,
    note: parsed.data.note ?? null,
    createdAt: new Date().toISOString(),
  };
  memQueryVersions.push(version);
  return NextResponse.json({ data: version }, { status: 201 });
}
