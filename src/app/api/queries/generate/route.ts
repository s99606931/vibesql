import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSql } from "@/lib/claude/nl2sql";
import { guardSql } from "@/lib/sql-guard";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/auth/require-user";

const BodySchema = z.object({
  nl: z.string().min(1).max(2000),
  dialect: z
    .enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"])
    .default("postgresql"),
  connectionId: z.string().optional(),
  schemaContext: z
    .string()
    .default("No schema provided — generate generic SQL"),
  glossary: z.string().optional(),
});

// 20 requests per minute per IP
const GENERATE_LIMIT = 20;
const GENERATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip, GENERATE_LIMIT, GENERATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-RateLimit-Limit": String(GENERATE_LIMIT),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    // Fetch active AI context rules for this user
    let aiContextRules: { ruleType: string; key: string; value: string }[] = [];
    try {
      if (process.env.DATABASE_URL) {
        const { prisma } = await import("@/lib/db/prisma");
        aiContextRules = await prisma.aiContextRule.findMany({
          where: { userId, isActive: true },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          select: { ruleType: true, key: true, value: true },
        });
      } else {
        const { memAiContextRules } = await import("@/lib/db/mem-ai-context");
        aiContextRules = memAiContextRules
          .filter((r) => r.userId === userId && r.isActive)
          .sort((a, b) => b.priority - a.priority)
          .map(({ ruleType, key, value }) => ({ ruleType, key, value }));
      }
    } catch { /* non-fatal — proceed without context rules */ }

    const result = await generateSql({ ...parsed.data, userId, aiContextRules });

    // Validate generated SQL is safe
    const guard = guardSql(result.sql);
    if (!guard.allowed) {
      return NextResponse.json(
        { error: `Unsafe SQL generated: ${guard.reason}` },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SQL 생성에 실패했습니다.";
    console.error("[generate] error:", message);
    const status = message.includes("설정되지 않았습니다") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
