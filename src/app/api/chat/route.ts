import { NextResponse } from "next/server";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

const SYSTEM_PROMPT = `당신은 vibeSQL의 AI 어시스턴트입니다.
SQL, 데이터베이스, 데이터 분석에 대한 전문 지식을 가지고 있습니다.

도움이 되는 답변을 한국어로 제공하세요. 다음을 지원합니다:
- SQL 쿼리 작성 및 최적화
- 데이터베이스 스키마 설계 조언
- 데이터 분석 방법 안내
- vibeSQL 사용법 설명
- 일반적인 기술 질문

간결하고 명확하게 답변하세요.`;

async function getActiveProvider(userId?: string) {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const where = userId ? { userId, isActive: true } : { isActive: true };
      return await prisma.aiProvider.findFirst({ where });
    } catch {
      return null;
    }
  }
  try {
    const { memProviders } = await import("@/app/api/ai-providers/route");
    const p = userId
      ? memProviders.find((x) => x.userId === userId && x.isActive)
      : memProviders.find((x) => x.isActive);
    return p ?? null;
  } catch {
    return null;
  }
}

function validateUrl(rawUrl: string) {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error("Invalid provider URL"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL must use http or https");
  if (/^169\.254\./.test(parsed.hostname.toLowerCase())) throw new Error("Forbidden URL");
}

type OaiMessage = { role: string; content: string };

async function streamWithAnthropic(
  messages: OaiMessage[],
  apiKey: string | null,
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<ReadableStream<Uint8Array>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: apiKey ?? undefined });

  const stream = client.messages.stream({
    model,
    system: SYSTEM_PROMPT,
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
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
): Promise<ReadableStream<Uint8Array>> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { messages } = parsed.data;

  try {
    const provider = await getActiveProvider();

    let stream: ReadableStream<Uint8Array>;

    if (provider) {
      const { type, baseUrl, apiKey, model, temperature, maxTokens } = provider;
      const temp = (temperature as number) ?? 0.7;
      const tokens = (maxTokens as number) ?? 1024;

      if (type === "anthropic") {
        stream = await streamWithAnthropic(messages, apiKey as string | null, model as string, temp, tokens);
      } else if (type === "google") {
        if (!apiKey) throw new Error("Google AI 프로바이더에 API 키가 없습니다.");
        stream = await streamWithGoogle(messages, apiKey as string, model as string, temp, tokens);
      } else {
        const url = (baseUrl as string | null) ?? "https://api.openai.com";
        stream = await streamWithOpenAiCompat(messages, url, apiKey as string | null, model as string, temp, tokens);
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      stream = await streamWithAnthropic(messages, null, "claude-sonnet-4-6", 0.7, 1024);
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
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
