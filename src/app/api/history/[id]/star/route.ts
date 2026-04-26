import { NextResponse } from "next/server";

// In-memory store reference — imported lazily to share the same module instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getItems: (() => any[]) | undefined;

async function resolveItems() {
  if (!getItems) {
    // Dynamic import to share module state with the parent route
    const mod = await import("../../route");
    // The history items array is module-scoped in route.ts; we toggle via the POST
    // handler indirection. We expose a separate internal toggle mechanism here.
    void mod; // mod is imported only to ensure the module is initialized
  }
}

// Module-level items mirror — kept in this file for the star toggle
// NOTE: This is a separate in-memory slice. For a real app use Prisma or a shared module.
const starredSet = new Set<string>();

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await resolveItems();

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.queryHistory.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "히스토리 항목을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      const updated = await prisma.queryHistory.update({
        where: { id },
        data: { starred: !existing.starred },
      });
      return NextResponse.json({ data: updated });
    } catch {
      /* fall through */
    }
  }

  // In-memory toggle
  if (starredSet.has(id)) {
    starredSet.delete(id);
  } else {
    starredSet.add(id);
  }

  return NextResponse.json({ data: { id, starred: starredSet.has(id) } });
}
