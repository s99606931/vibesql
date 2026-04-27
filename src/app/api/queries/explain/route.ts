import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const BodySchema = z.object({
  sql: z.string().min(1).max(5000),
  dialect: z.enum(["postgresql", "mysql", "sqlite", "mssql"]).optional().default("postgresql"),
});

// 20 requests per minute per IP (same as /api/queries/generate)
const EXPLAIN_LIMIT = 20;
const EXPLAIN_WINDOW_MS = 60_000;

async function buildExplainPrompt(sql: string, dialect: string): Promise<string> {
  return `You are a SQL expert. Explain what the following ${dialect} SQL query does in plain Korean (한국어).
Be concise: 2-3 sentences max. Focus on WHAT data is returned and WHY.
Do NOT explain SQL syntax basics. Format as plain text, no markdown.

SQL:
${sql}`;
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

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
    const prompt = await buildExplainPrompt(sql, dialect);

    // Use the same active provider selection as generate
    let explanation = "";

    // 1. DB-configured active provider
    let dbProvider: { type: string; baseUrl: string | null; apiKey: string | null; model: string } | null = null;
    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        const p = await prisma.aiProvider.findFirst({ where: { userId, isActive: true } });
        if (p) dbProvider = p;
      } catch { /* fall through */ }
    }
    if (!dbProvider) {
      const { memAiProviders } = await import("@/lib/db/mem-ai-providers");
      const p = memAiProviders.find((p) => p.userId === userId && p.isActive);
      if (p) dbProvider = p;
    }

    if (dbProvider) {
      const apiKey = dbProvider.apiKey;
      const model = dbProvider.model;

      if (dbProvider.type === "anthropic") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: apiKey ?? undefined });
        const msg = await client.messages.create({
          model,
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });
        const content = msg.content[0];
        if (content.type !== "text") throw new Error("Unexpected AI response");
        explanation = content.text.trim();
      } else if (dbProvider.type === "google") {
        if (!apiKey) return NextResponse.json({ error: "Google AI 프로바이더에 API 키가 없습니다." }, { status: 422 });
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const gemini = genAI.getGenerativeModel({ model });
        const result = await gemini.generateContent(prompt);
        explanation = result.response.text().trim();
      } else {
        // openai / lmstudio / ollama / vllm / openai_compat
        const baseUrl = dbProvider.baseUrl ?? "https://api.openai.com";
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ baseURL: baseUrl, apiKey: apiKey ?? "sk-local" });
        const msg = await client.chat.completions.create({
          model,
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });
        explanation = msg.choices[0]?.message?.content?.trim() ?? "";
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      // Legacy env-var fallback
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      const content = msg.content[0];
      if (content.type !== "text") throw new Error("Unexpected AI response");
      explanation = content.text.trim();
    } else {
      return NextResponse.json(
        { error: "AI 프로바이더가 설정되지 않았습니다. 설정 > AI 프로바이더 메뉴에서 프로바이더를 추가하세요." },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: { explanation } });
  } catch (error) {
    console.error("[explain] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "SQL 설명 생성에 실패했습니다." }, { status: 500 });
  }
}
