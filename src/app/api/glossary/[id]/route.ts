import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

// Re-use the same module-scoped terms array from the parent route via dynamic import.
// Because Next.js compiles each route file as a separate module, we rely on the
// parent route module being cached after the first request. In production/Edge the
// in-memory store is ephemeral across cold starts — use DATABASE_URL for durability.

const PatchSchema = z.object({
  term: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  definition: z.string().min(1).optional(),
  sql: z.string().optional(),
});

import type { GlossaryTerm } from "@/types";

async function getTermsArray(): Promise<GlossaryTerm[]> {
  try {
    const mod: { __terms?: GlossaryTerm[] } = await import("../route");
    if (Array.isArray(mod.__terms)) return mod.__terms;
  } catch {
    /* ignore */
  }
  return [];
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).glossaryTerm.delete({ where: { id } });
      return NextResponse.json({ data: { id } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Record to delete does not exist")) {
        return NextResponse.json(
          { error: "용어를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      /* fall through */
    }
  }

  // In-memory: mutate the shared array from the parent route
  const arr = await getTermsArray();
  const idx = arr.findIndex((t) => t.id === id);
  if (idx === -1) {
    return NextResponse.json(
      { error: "용어를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  arr.splice(idx, 1);
  return NextResponse.json({ data: { id } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청입니다.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (prisma as any).glossaryTerm.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json({ data: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Record to update does not exist")) {
        return NextResponse.json(
          { error: "용어를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      /* fall through */
    }
  }

  // In-memory
  const arr = await getTermsArray();
  const term = arr.find((t) => t.id === id);
  if (!term) {
    return NextResponse.json(
      { error: "용어를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  Object.assign(term, parsed.data);
  return NextResponse.json({ data: { ...term } });
}
