import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-user";
import { memProviders } from "../../route";
import { persistAiProviders } from "@/lib/db/mem-ai-providers";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.userId;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.aiProvider.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      await prisma.$transaction([
        prisma.aiProvider.updateMany({ where: { userId }, data: { isActive: false } }),
        prisma.aiProvider.update({ where: { id }, data: { isActive: true } }),
      ]);
      const updated = await prisma.aiProvider.findFirst({ where: { id } });
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const target = memProviders.find((x) => x.id === id && x.userId === userId);
  if (!target) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  memProviders.forEach((p) => { if (p.userId === userId) p.isActive = false; });
  target.isActive = true;
  target.updatedAt = new Date().toISOString();
  persistAiProviders();
  return NextResponse.json({ data: target });
}
