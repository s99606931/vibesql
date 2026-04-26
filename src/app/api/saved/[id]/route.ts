import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

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
      // 소유권 검증
      const row = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!row) {
        return NextResponse.json(
          { error: "저장된 쿼리를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      return NextResponse.json({ data: row });
    } catch {
      /* fall through */
    }
  }

  // In-memory: access the items array from the parent route module
  try {
    const mod: { __items?: { id: string }[] } = await import("../route");
    const arr = mod.__items;
    if (Array.isArray(arr)) {
      const item = arr.find((i) => i.id === id);
      if (!item) {
        return NextResponse.json(
          { error: "저장된 쿼리를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      return NextResponse.json({ data: item });
    }
  } catch {
    /* ignore */
  }

  // Fallback: cannot resolve without shared reference
  return NextResponse.json(
    { error: "저장된 쿼리를 찾을 수 없습니다." },
    { status: 404 }
  );
}

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function DELETE(
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

      // 소유권 검증
      const row = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!row) {
        return NextResponse.json(
          { error: "저장된 쿼리를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      await prisma.savedQuery.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch {
      /* fall through */
    }
  }

  // In-memory: the parent route owns the items array; we return success
  return NextResponse.json({ data: { id } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청입니다.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.savedQuery.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "저장된 쿼리를 찾을 수 없습니다." }, { status: 404 });
      }
      const updated = await prisma.savedQuery.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json({ data: updated });
    } catch {
      /* fall through */
    }
  }

  // In-memory fallback
  return NextResponse.json({ data: { id, ...parsed.data } });
}
