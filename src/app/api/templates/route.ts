import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/require-user";

export type TemplateCategory =
  | "analytics"
  | "operations"
  | "reporting"
  | "debugging"
  | "custom";

export interface QueryTemplate {
  id: string;
  userId: string | null; // null = built-in
  name: string;
  description: string;
  category: TemplateCategory;
  nlQuery: string;
  sql: string;
  dialect: string;
  tags: string[];
  usageCount: number;
  isBuiltIn: boolean;
  createdAt: string;
}

// ─── Built-in templates ───────────────────────────────────────────────────────

const BUILT_IN: QueryTemplate[] = [
  {
    id: "builtin-1",
    userId: null,
    name: "테이블 목록 조회",
    description: "현재 데이터베이스의 모든 테이블과 행 수를 조회합니다.",
    category: "operations",
    nlQuery: "모든 테이블 목록과 행 수를 보여줘",
    sql: "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC;",
    dialect: "mysql",
    tags: ["schema", "metadata"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-2",
    userId: null,
    name: "최근 7일 활동 요약",
    description: "지난 7일간 날짜별 레코드 생성 수를 집계합니다.",
    category: "analytics",
    nlQuery: "최근 7일간 일별 신규 데이터 수를 보여줘",
    sql: "SELECT DATE(created_at) AS day, COUNT(*) AS count FROM your_table WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY GROUP BY day ORDER BY day DESC;",
    dialect: "postgresql",
    tags: ["time-series", "aggregation"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-3",
    userId: null,
    name: "상위 10개 항목",
    description: "특정 기준으로 상위 10개 레코드를 조회합니다.",
    category: "analytics",
    nlQuery: "상위 10개 항목을 조회해줘",
    sql: "SELECT * FROM your_table ORDER BY value_column DESC LIMIT 10;",
    dialect: "postgresql",
    tags: ["top-n", "ranking"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-4",
    userId: null,
    name: "중복 데이터 탐지",
    description: "특정 컬럼에서 중복된 값을 찾아냅니다.",
    category: "debugging",
    nlQuery: "email 컬럼에서 중복된 데이터를 찾아줘",
    sql: "SELECT email, COUNT(*) AS cnt FROM users GROUP BY email HAVING COUNT(*) > 1 ORDER BY cnt DESC;",
    dialect: "postgresql",
    tags: ["data-quality", "duplicates"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-5",
    userId: null,
    name: "월별 집계 보고서",
    description: "월별로 데이터를 집계하여 트렌드를 파악합니다.",
    category: "reporting",
    nlQuery: "월별 매출 합계를 보여줘",
    sql: "SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS total, COUNT(*) AS transactions FROM orders GROUP BY month ORDER BY month DESC;",
    dialect: "postgresql",
    tags: ["monthly", "aggregation", "reporting"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-6",
    userId: null,
    name: "NULL 값 현황",
    description: "각 컬럼별 NULL 값 개수와 비율을 확인합니다.",
    category: "debugging",
    nlQuery: "각 컬럼에 NULL 값이 얼마나 있는지 보여줘",
    sql: "SELECT column_name, COUNT(*) - COUNT(column_name) AS null_count, ROUND((COUNT(*) - COUNT(column_name)) * 100.0 / COUNT(*), 2) AS null_pct FROM your_table GROUP BY column_name;",
    dialect: "postgresql",
    tags: ["data-quality", "null-check"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-7",
    userId: null,
    name: "JOIN으로 관련 데이터 조회",
    description: "두 테이블을 JOIN하여 연관 데이터를 함께 조회합니다.",
    category: "analytics",
    nlQuery: "사용자와 주문 정보를 함께 보여줘",
    sql: "SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count, SUM(o.amount) AS total_spent FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name, u.email ORDER BY total_spent DESC NULLS LAST;",
    dialect: "postgresql",
    tags: ["join", "aggregation"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-8",
    userId: null,
    name: "시간대별 분포",
    description: "데이터가 하루 중 몇 시에 집중되어 있는지 파악합니다.",
    category: "analytics",
    nlQuery: "시간대별 데이터 분포를 보여줘",
    sql: "SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS count FROM your_table GROUP BY hour ORDER BY hour;",
    dialect: "postgresql",
    tags: ["time-series", "distribution"],
    usageCount: 0,
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

// ─── in-memory user templates ─────────────────────────────────────────────────

export const memTemplates: QueryTemplate[] = [];

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).default(""),
  category: z.enum(["analytics", "operations", "reporting", "debugging", "custom"]).default("custom"),
  nlQuery: z.string().min(1).max(500),
  sql: z.string().min(1),
  dialect: z.string().min(1).max(30).default("postgresql"),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

// ─── GET /api/templates ───────────────────────────────────────────────────────

export async function GET(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search")?.toLowerCase() ?? "";

  let templates: QueryTemplate[] = [...BUILT_IN];

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const rows = await prisma.queryTemplate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      templates = [
        ...BUILT_IN,
        ...rows.map((r: {
          id: string;
          userId: string | null;
          name: string;
          description: string | null;
          category: string;
          nlQuery: string;
          sql: string;
          dialect: string;
          tags: unknown;
          usageCount: number;
          createdAt: Date;
        }) => ({
          id: r.id,
          userId: r.userId,
          name: r.name,
          description: r.description ?? "",
          category: r.category as TemplateCategory,
          nlQuery: r.nlQuery,
          sql: r.sql,
          dialect: r.dialect,
          tags: (r.tags as string[]) ?? [],
          usageCount: r.usageCount,
          isBuiltIn: false,
          createdAt: r.createdAt.toISOString(),
        })),
      ];
    } catch { /* fall through */ }
  } else {
    const userTemplates = memTemplates.filter((t) => t.userId === userId);
    templates = [...BUILT_IN, ...userTemplates];
  }

  if (category && category !== "all") {
    templates = templates.filter((t) => t.category === category);
  }
  if (search) {
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.nlQuery.toLowerCase().includes(search) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ data: templates, meta: { total: templates.length } });
}

// ─── POST /api/templates ──────────────────────────────────────────────────────

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

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.queryTemplate.create({
        data: { ...parsed.data, userId, usageCount: 0 },
      });
      return NextResponse.json({ data: row }, { status: 201 });
    } catch { /* fall through */ }
  }

  const template: QueryTemplate = {
    id: crypto.randomUUID(),
    userId,
    ...parsed.data,
    usageCount: 0,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  };
  memTemplates.push(template);
  return NextResponse.json({ data: template }, { status: 201 });
}
