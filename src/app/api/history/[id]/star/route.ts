import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { items } from "../../route";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { id } = await params;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.queryHistory.findFirst({
        where: { id, userId },
      });
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

  // In-memory toggle — mutate the shared items array directly
  const item = items.find((i) => i.id === id);
  if (!item) {
    return NextResponse.json(
      { error: "히스토리 항목을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  item.starred = !item.starred;

  return NextResponse.json({ data: { id, starred: item.starred } });
}
