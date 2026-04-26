import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { id } = await params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.queryHistory.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "히스토리 항목을 찾을 수 없습니다." }, { status: 404 });
      }
      await prisma.queryHistory.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch {
      /* fall through */
    }
  }

  // In-memory: mutate the shared items array
  try {
    const mod: { items?: Array<{ id: string; userId: string }> } = await import("../route");
    const arr = mod.items;
    if (Array.isArray(arr)) {
      const idx = arr.findIndex((i) => i.id === id && i.userId === userId);
      if (idx === -1) {
        return NextResponse.json({ error: "히스토리 항목을 찾을 수 없습니다." }, { status: 404 });
      }
      arr.splice(idx, 1);
    }
  } catch { /* ignore */ }

  return NextResponse.json({ data: { id } });
}
