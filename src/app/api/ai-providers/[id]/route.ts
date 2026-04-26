import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";
import { memProviders, type AiProvider } from "../route";

function sanitize(p: AiProvider | Record<string, unknown>) {
  const { apiKey: _k, ...safe } = p as AiProvider;
  return { ...safe, hasApiKey: !!_k };
}

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")).transform((v) => v === "" ? null : v),
  apiKey: z.string().optional().transform((v) => v === "" ? null : (v ?? undefined)),
  model: z.string().min(1).max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(32768).optional(),
});

// ─── GET /api/ai-providers/[id] ──────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.aiProvider.findFirst({ where: { id, userId } });
      if (!row) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ data: sanitize(row as unknown as AiProvider) });
    } catch { /* fall through */ }
  }

  const p = memProviders.find((x) => x.id === id && x.userId === userId);
  if (!p) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ data: sanitize(p) });
}

// ─── PATCH /api/ai-providers/[id] ────────────────────────────────────────────

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다.", issues: parsed.error.issues }, { status: 400 });
  }

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.aiProvider.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      const updated = await prisma.aiProvider.update({ where: { id }, data });
      return NextResponse.json({ data: updated });
    } catch { /* fall through */ }
  }

  const idx = memProviders.findIndex((x) => x.id === id && x.userId === userId);
  if (idx === -1) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  Object.assign(memProviders[idx], data, { updatedAt: new Date().toISOString() });
  return NextResponse.json({ data: memProviders[idx] });
}

// ─── DELETE /api/ai-providers/[id] ───────────────────────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.aiProvider.findFirst({ where: { id, userId } });
      if (!existing) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      await prisma.aiProvider.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch { /* fall through */ }
  }

  const idx = memProviders.findIndex((x) => x.id === id && x.userId === userId);
  if (idx === -1) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  memProviders.splice(idx, 1);
  return NextResponse.json({ data: { id } });
}
