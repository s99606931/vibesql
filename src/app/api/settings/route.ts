import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

const PatchSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  aiModel: z.string().min(1).optional(),
  aiTemperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  defaultDialect: z
    .enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"])
    .optional(),
  autoRunQuery: z.boolean().optional(),
  resultPageSize: z.number().int().min(10).max(500).optional(),
  showSqlPreview: z.boolean().optional(),
  showExplanation: z.boolean().optional(),
  enableGlossary: z.boolean().optional(),
  notifySuccess: z.boolean().optional(),
  notifyError: z.boolean().optional(),
  notifyLong: z.boolean().optional(),
  sessionTimeout: z.number().int().min(5).max(480).optional(),
});

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: defaultSettings(userId) });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return NextResponse.json({ data: settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "설정을 불러오는 중 오류가 발생했습니다.", detail: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청입니다.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: { userId, ...parsed.data } });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...parsed.data },
      update: parsed.data,
    });

    return NextResponse.json({ data: settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "설정 저장 중 오류가 발생했습니다.", detail: message },
      { status: 500 }
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultSettings(userId: string) {
  return {
    id: "local",
    userId,
    theme: "system",
    density: "comfortable",
    aiModel: "claude-sonnet-4-6",
    aiTemperature: 0.3,
    maxTokens: 2048,
    defaultDialect: "postgresql",
    autoRunQuery: false,
    resultPageSize: 50,
    showSqlPreview: true,
    showExplanation: true,
    enableGlossary: true,
  };
}
