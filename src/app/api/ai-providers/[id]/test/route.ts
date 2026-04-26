import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { memProviders } from "../../route";
import type { AiProvider } from "../../route";

interface OaiResponse { choices: { message: { content: string } }[] }

async function testProvider(provider: AiProvider): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();

  try {
    if (provider.type === "anthropic") {
      const key = provider.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!key) return { ok: false, latencyMs: 0, message: "API 키가 없습니다." };
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: key });
      await client.messages.create({
        model: provider.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Hi" }],
      });
      return { ok: true, latencyMs: Date.now() - start, message: "연결 성공" };
    }

    if (provider.type === "google") {
      const key = provider.apiKey ?? process.env.GOOGLE_AI_API_KEY;
      if (!key) return { ok: false, latencyMs: 0, message: "API 키가 없습니다." };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }], generationConfig: { maxOutputTokens: 8 } }),
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, latencyMs: Date.now() - start, message: `오류 ${res.status}: ${err.slice(0, 120)}` };
      }
      return { ok: true, latencyMs: Date.now() - start, message: "연결 성공" };
    }

    // OpenAI-compatible: openai | lmstudio | ollama | vllm | openai_compat
    const baseUrl = (provider.baseUrl ?? (provider.type === "openai" ? "https://api.openai.com" : "")).replace(/\/$/, "");
    if (!baseUrl) return { ok: false, latencyMs: 0, message: "Base URL이 없습니다." };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = provider.apiKey ?? (provider.type === "openai" ? process.env.OPENAI_API_KEY : undefined);
    if (key) headers["Authorization"] = `Bearer ${key}`;

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, latencyMs: Date.now() - start, message: `오류 ${res.status}: ${err.slice(0, 120)}` };
    }

    const json = await res.json() as OaiResponse;
    const reply = json.choices?.[0]?.message?.content ?? "(응답 없음)";
    return { ok: true, latencyMs: Date.now() - start, message: `연결 성공 — 응답: "${reply.slice(0, 40)}"` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  let provider: AiProvider | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.aiProvider.findFirst({ where: { id, userId } });
      if (!row) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      provider = row as unknown as AiProvider;
    } catch { /* fall through */ }
  }

  if (!provider) {
    provider = memProviders.find((x) => x.id === id && x.userId === userId) ?? null;
  }
  if (!provider) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  const result = await testProvider(provider);

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.aiProvider.update({
        where: { id },
        data: { lastTestedAt: new Date(), lastTestedOk: result.ok },
      });
    } catch { /* ignore */ }
  } else {
    const p = memProviders.find((x) => x.id === id);
    if (p) { p.lastTestedAt = new Date().toISOString(); p.lastTestedOk = result.ok; }
  }

  return NextResponse.json({ data: result }, { status: result.ok ? 200 : 422 });
}
