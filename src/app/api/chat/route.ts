import { NextResponse } from "next/server";
import { z } from "zod";
import { memAiProviders } from "@/lib/db/mem-ai-providers";
import { requireUserId } from "@/lib/auth/require-user";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const CHAT_LIMIT = 30;
const CHAT_WINDOW_MS = 60_000;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const ContextSchema = z.object({
  sql: z.string().max(4000).optional(),
  nlQuery: z.string().max(500).optional(),
  dialect: z.string().max(30).optional(),
  connectionName: z.string().max(100).optional(),
  schemaSnippet: z.string().max(3000).optional(),
  glossary: z.string().max(2000).optional(),
  currentPage: z.string().max(50).optional(),
}).optional();

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  context: ContextSchema,
});

export type ChatContext = z.infer<typeof ContextSchema>;

const BASE_SYSTEM_PROMPT = `당신은 vibeSQL의 AI 어시스턴트입니다.
SQL, 데이터베이스, 데이터 분석에 대한 전문 지식을 가지고 있습니다.

도움이 되는 답변을 한국어로 제공하세요. 다음을 지원합니다:
- SQL 쿼리 작성 및 최적화
- 데이터베이스 스키마 설계 조언
- 데이터 분석 방법 안내
- vibeSQL 사용법 설명
- 일반적인 기술 질문

SQL을 제안할 때는 반드시 \`\`\`sql 코드블록으로 감싸서 사용자가 바로 적용할 수 있게 하세요.
간결하고 명확하게 답변하세요.`;

function buildSystemPrompt(context?: ChatContext): string {
  if (!context) return BASE_SYSTEM_PROMPT;

  const parts: string[] = [BASE_SYSTEM_PROMPT];

  parts.push("\n\n--- 현재 사용자 컨텍스트 ---");

  if (context.connectionName || context.dialect) {
    const connInfo = [
      context.connectionName && `연결: ${context.connectionName}`,
      context.dialect && `DB 방언: ${context.dialect}`,
    ].filter(Boolean).join(" | ");
    parts.push(connInfo);
  }

  if (context.currentPage) {
    parts.push(`현재 페이지: ${context.currentPage}`);
  }

  if (context.schemaSnippet) {
    parts.push(`\n스키마 정보:\n${context.schemaSnippet}`);
  }

  if (context.glossary) {
    parts.push(`\n도메인 용어:\n${context.glossary}`);
  }

  if (context.nlQuery) {
    parts.push(`\n현재 자연어 질문: "${context.nlQuery}"`);
  }

  if (context.sql) {
    parts.push(`\n현재 SQL 편집 중:\n\`\`\`${context.dialect ?? "sql"}\n${context.sql}\n\`\`\``);
  }

  parts.push("\n위 컨텍스트를 참고하여 사용자에게 가장 관련성 높은 답변을 제공하세요.");
  return parts.join("\n");
}

async function getActiveProvider(userId?: string) {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const where = userId ? { userId, isActive: true } : { isActive: true };
      const row = await prisma.aiProvider.findFirst({ where });
      if (row) return row;
    } catch { /* fall through to in-memory */ }
  }
  const p = userId
    ? memAiProviders.find((x) => x.userId === userId && x.isActive)
    : memAiProviders.find((x) => x.isActive);
  return p ?? null;
}

function validateUrl(rawUrl: string) {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error("Invalid provider URL"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL must use http or https");
  const h = parsed.hostname.toLowerCase();
  if (
    /^169\.254\./.test(h) ||
    /^127\./.test(h) ||
    /^0\.0\.0\.0$/.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "localhost" ||
    h === "::1" ||
    h === "[::1]"
  ) throw new Error("Forbidden URL");
}

type OaiMessage = { role: string; content: string };

async function streamWithAnthropic(
  messages: OaiMessage[],
  apiKey: string | null,
  model: string,
  temperature: number,
  maxTokens: number,
  systemPrompt: string = BASE_SYSTEM_PROMPT,
): Promise<ReadableStream<Uint8Array>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: apiKey ?? undefined });

  const stream = client.messages.stream({
    model,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

async function streamWithOpenAiCompat(
  messages: OaiMessage[],
  baseUrl: string,
  apiKey: string | null,
  model: string,
  temperature: number,
  maxTokens: number,
  systemPrompt: string = BASE_SYSTEM_PROMPT,
): Promise<ReadableStream<Uint8Array>> {
  validateUrl(baseUrl);
  const url = baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Provider error ${res.status}: ${err.slice(0, 200)}`);
  }

  const encoder = new TextEncoder();
  const body = res.body!;
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
              const text = json.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

async function streamWithGoogle(
  messages: OaiMessage[],
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  systemPrompt: string = BASE_SYSTEM_PROMPT,
): Promise<ReadableStream<Uint8Array>> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI error ${res.status}: ${err.slice(0, 200)}`);
  }

  const encoder = new TextEncoder();
  const body = res.body!;
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            try {
              interface GChunk { candidates?: { content?: { parts?: { text?: string }[] } }[] }
              const json = JSON.parse(data) as GChunk;
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip */ }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip, CHAT_LIMIT, CHAT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(CHAT_LIMIT),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(Math.ceil(CHAT_WINDOW_MS / 1000)),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { messages, context } = parsed.data;
  const systemPrompt = buildSystemPrompt(context);

  try {
    const provider = await getActiveProvider(userId);

    let stream: ReadableStream<Uint8Array>;

    if (provider) {
      const { type, baseUrl, apiKey, model, temperature, maxTokens } = provider;
      const temp = (temperature as number) ?? 0.7;
      const tokens = (maxTokens as number) ?? 1024;

      if (type === "anthropic") {
        stream = await streamWithAnthropic(messages, apiKey as string | null, model as string, temp, tokens, systemPrompt);
      } else if (type === "google") {
        if (!apiKey) throw new Error("Google AI 프로바이더에 API 키가 없습니다.");
        stream = await streamWithGoogle(messages, apiKey as string, model as string, temp, tokens, systemPrompt);
      } else {
        const url = (baseUrl as string | null) ?? "https://api.openai.com";
        stream = await streamWithOpenAiCompat(messages, url, apiKey as string | null, model as string, temp, tokens, systemPrompt);
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      stream = await streamWithAnthropic(messages, null, "claude-sonnet-4-6", 0.7, 1024, systemPrompt);
    } else {
      return NextResponse.json(
        { error: "AI 프로바이더가 설정되지 않았습니다. 설정 > AI 프로바이더에서 추가하세요." },
        { status: 503 }
      );
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[chat] stream error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "AI 응답을 가져오지 못했습니다. 다시 시도해주세요." }, { status: 500 });
  }
}
