import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { memAiContextRules, persistAiContextRules } from "@/lib/db/mem-ai-context";

const CreateSchema = z.object({
  ruleType: z.enum(["few_shot", "forbidden", "alias"]),
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
});

export async function GET(_req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rules = await prisma.aiContextRule.findMany({
        where: { userId },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
      return NextResponse.json({ data: rules });
    } catch { /* fall through */ }
  }

  return NextResponse.json({
    data: memAiContextRules
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.priority - a.priority),
  });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rule = await prisma.aiContextRule.create({
        data: { ...parsed.data, userId },
      });
      return NextResponse.json({ data: rule }, { status: 201 });
    } catch { /* fall through */ }
  }

  const now = new Date().toISOString();
  const rule = {
    id: crypto.randomUUID(),
    userId,
    ...parsed.data,
    description: parsed.data.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  memAiContextRules.push(rule);
  persistAiContextRules();
  return NextResponse.json({ data: rule }, { status: 201 });
}
