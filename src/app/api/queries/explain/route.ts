import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const BodySchema = z.object({
  sql: z.string().min(1).max(5000),
  dialect: z.string().optional().default("postgresql"),
});

// 20 requests per minute per IP (same as /api/queries/generate)
const EXPLAIN_LIMIT = 20;
const EXPLAIN_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`explain:${ip}`, EXPLAIN_LIMIT, EXPLAIN_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-RateLimit-Limit": String(EXPLAIN_LIMIT),
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
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sql, dialect } = parsed.data;

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a SQL expert. Explain what the following ${dialect} SQL query does in plain Korean (한국어).
Be concise: 2-3 sentences max. Focus on WHAT data is returned and WHY.
Do NOT explain SQL syntax basics. Format as plain text, no markdown.

SQL:
${sql}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from AI." }, { status: 500 });
    }

    return NextResponse.json({ data: { explanation: content.text.trim() } });
  } catch (error) {
    console.error("[explain] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "SQL 설명 생성에 실패했습니다." }, { status: 500 });
  }
}
