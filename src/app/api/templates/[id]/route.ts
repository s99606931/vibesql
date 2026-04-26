import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { memTemplates } from "../route";

// ─── DELETE /api/templates/[id] ───────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.queryTemplate.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      await prisma.queryTemplate.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch { /* fall through */ }
  }

  const idx = memTemplates.findIndex((t) => t.id === id && t.userId === userId);
  if (idx === -1) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  memTemplates.splice(idx, 1);
  return NextResponse.json({ data: { id } });
}

// ─── POST /api/templates/[id]/use — increment usage count ─────────────────────
// Handled via sub-route; not needed here.
