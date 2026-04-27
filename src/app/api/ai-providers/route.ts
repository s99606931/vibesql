import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { memAiProviders, persistAiProviders } from "@/lib/db/mem-ai-providers";
import { validateExternalUrl } from "@/lib/ssrf-guard";

export type AiProviderType = "anthropic" | "openai" | "google" | "lmstudio" | "ollama" | "vllm" | "openai_compat";

export interface AiProvider {
  id: string;
  userId: string;
  name: string;
  type: AiProviderType;
  baseUrl?: string | null;
  apiKey?: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  lastTestedAt?: string | null;
  lastTestedOk?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["anthropic", "openai", "google", "lmstudio", "ollama", "vllm", "openai_compat"]),
  baseUrl: z.string().url().optional().or(z.literal("")).transform((v) => v || null),
  apiKey: z.string().optional().transform((v) => v || null),
  model: z.string().min(1).max(120),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(256).max(32768).default(2048),
  isActive: z.boolean().default(false),
});

// ─── in-memory fallback (shared singleton) ────────────────────────────────────

export const memProviders = memAiProviders as AiProvider[];

// ─── GET /api/ai-providers ────────────────────────────────────────────────────

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.aiProvider.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ data: rows.map(sanitize) });
    } catch { /* fall through */ }
  }

  return NextResponse.json({ data: memProviders.filter((p) => p.userId === userId).map(sanitize) });
}

// ─── POST /api/ai-providers ───────────────────────────────────────────────────

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  const { isActive, ...rest } = parsed.data;

  // H3: Block SSRF via user-supplied baseUrl at save time.
  // Local-only provider types (lmstudio, ollama, vllm) may use localhost.
  const LOCAL_PROVIDER_TYPES = new Set(["lmstudio", "ollama", "vllm"]);
  if (rest.baseUrl && !LOCAL_PROVIDER_TYPES.has(rest.type)) {
    const check = validateExternalUrl(rest.baseUrl);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      if (isActive) {
        await prisma.aiProvider.updateMany({ where: { userId }, data: { isActive: false } });
      }
      const row = await prisma.aiProvider.create({ data: { ...rest, isActive, userId } });
      return NextResponse.json({ data: sanitize(row) }, { status: 201 });
    } catch { /* fall through */ }
  }

  if (isActive) {
    memProviders.forEach((p) => { if (p.userId === userId) p.isActive = false; });
  }
  const provider: AiProvider = {
    id: crypto.randomUUID(),
    userId,
    ...rest,
    baseUrl: rest.baseUrl ?? null,
    apiKey: rest.apiKey ?? null,
    isActive,
    lastTestedAt: null,
    lastTestedOk: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memProviders.push(provider);
  persistAiProviders();
  return NextResponse.json({ data: sanitize(provider) }, { status: 201 });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function sanitize(p: AiProvider | Record<string, unknown>) {
  const { apiKey: _k, ...safe } = p as AiProvider;
  return { ...safe, hasApiKey: !!_k };
}
