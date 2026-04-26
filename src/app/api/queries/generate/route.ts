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

    const result = await generateSql(parsed.data);

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
    console.error("[generate] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "SQL 생성에 실패했습니다." }, { status: 500 });
  }
}
