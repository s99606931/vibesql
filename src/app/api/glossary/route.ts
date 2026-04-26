import { NextResponse } from "next/server";
import { z } from "zod";
import type { GlossaryTerm } from "@/types";
import { requireUserId } from "@/lib/auth/require-user";

const MAX_TERMS = 200;

const defaultTerms: GlossaryTerm[] = [
  {
    id: crypto.randomUUID(),
    term: "결제율",
    category: "매출",
    definition: "전체 방문자 중 실제 결제를 완료한 사용자의 비율",
    sql: "SELECT COUNT(DISTINCT order_id)::float / COUNT(DISTINCT session_id) AS 결제율 FROM events",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    term: "이탈률",
    category: "사용자",
    definition: "특정 페이지나 서비스에서 아무런 추가 행동 없이 이탈한 사용자 비율",
    sql: "SELECT COUNT(CASE WHEN page_views = 1 THEN 1 END)::float / COUNT(*) AS 이탈률 FROM sessions",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    term: "활성 사용자",
    category: "사용자",
    definition: "특정 기간 내에 서비스를 1회 이상 이용한 사용자 (DAU/MAU)",
    sql: "SELECT COUNT(DISTINCT user_id) AS 활성_사용자 FROM events WHERE created_at >= NOW() - INTERVAL '30 days'",
    createdAt: new Date().toISOString(),
  },
];

const terms: GlossaryTerm[] = [...defaultTerms];

// Exported for use by sub-routes (e.g. [id]/route.ts)
export const __terms = terms;

const CreateSchema = z.object({
  term: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  definition: z.string().min(1),
  sql: z.string().optional(),
});

export async function GET() {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (prisma as any).glossaryTerm.findMany({
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    } catch {
      /* fall through to in-memory */
    }
  }

  return NextResponse.json({ data: [...terms] });
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
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
      const row = await (prisma as any).glossaryTerm.create({
        data: { ...parsed.data, createdBy: userId },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch {
      /* fall through to in-memory */
    }
  }

  if (terms.length >= MAX_TERMS) {
    return NextResponse.json(
      { error: "용어 저장 한도(200개)를 초과했습니다." },
      { status: 422 }
    );
  }

  const newTerm: GlossaryTerm = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed.data,
  };

  terms.unshift(newTerm);

  return NextResponse.json({ data: newTerm }, { status: 201 });
}
