import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-user";
import { memAiContextRules, persistAiContextRules } from "@/lib/db/mem-ai-context";

const PatchSchema = z.object({
  key: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(2000).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.userId;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.aiContextRule.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
      }
      const updated = await prisma.aiContextRule.update({ where: { id }, data: parsed.data });
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const rule = memAiContextRules.find((r) => r.id === id && r.userId === userId);
  if (!rule) {
    return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
  }
  Object.assign(rule, { ...parsed.data, updatedAt: new Date().toISOString() });
  persistAiContextRules();
  return NextResponse.json({ data: rule });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.userId;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.aiContextRule.findFirst({ where: { id, userId } });
      if (!existing) {
        return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
      }
      await prisma.aiContextRule.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch { /* fall through */ }
  }

  const idx = memAiContextRules.findIndex((r) => r.id === id && r.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
  }
  memAiContextRules.splice(idx, 1);
  persistAiContextRules();
  return NextResponse.json({ data: { id } });
}
