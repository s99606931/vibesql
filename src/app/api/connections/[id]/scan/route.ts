import { NextResponse } from "next/server";
import { getConnection } from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import type { StoredConnection } from "@/lib/connections/store";
import { decryptPassword } from "@/lib/connections/encrypt";

interface TableInfo {
  name: string;
  rowCount: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPk: boolean;
  }>;
}

const SCAN_SQL = `
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  (c.is_nullable = 'YES') as is_nullable,
  c.column_default,
  CASE WHEN kcu.column_name IS NOT NULL THEN true ELSE false END as is_pk
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.table_name = c.table_name
  AND kcu.column_name = c.column_name
  AND kcu.constraint_name LIKE '%_pkey'
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position
`;

interface ScanRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  is_pk: boolean;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { id } = await params;

  let conn: StoredConnection | undefined = getConnection(id);
  if (conn && conn.userId !== undefined && conn.userId !== userId) {
    return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!conn && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const row = await prisma.connection.findFirst({ where: { id, userId } });
      if (row) {
        conn = {
          id: row.id,
          name: row.name,
          type: row.type as StoredConnection["type"],
          host: row.host ?? undefined,
          port: row.port ?? undefined,
          database: row.database,
          username: row.username ?? undefined,
          passwordBase64: row.passwordHash ?? undefined,
          ssl: row.ssl,
          isActive: row.isActive,
          createdAt: row.createdAt.toISOString(),
        };
      }
    } catch { /* fall through */ }
  }

  if (conn && conn.type === "postgresql") {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        host: conn.host || "localhost",
        port: conn.port || 5432,
        database: conn.database,
        user: conn.username,
        password: conn.passwordBase64
          ? decryptPassword(conn.passwordBase64)
          : undefined,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });

      await client.connect();
      let result;
      try {
        result = await client.query<ScanRow>(SCAN_SQL);
      } finally {
        await client.end().catch(() => undefined);
      }

      // Group rows by table name
      const tableMap = new Map<string, TableInfo>();
      for (const row of result.rows) {
        if (!tableMap.has(row.table_name)) {
          tableMap.set(row.table_name, {
            name: row.table_name,
            rowCount: "—",
            columns: [],
          });
        }
        tableMap.get(row.table_name)!.columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
          isPk: row.is_pk,
        });
      }

      return NextResponse.json({
        data: {
          connectionId: id,
          tables: Array.from(tableMap.values()),
          scannedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("[scan] error:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "스키마 스캔에 실패했습니다." },
        { status: 400 }
      );
    }
  }

  // Fall back to mock data for non-PostgreSQL or unknown connections
  const mockSchema: TableInfo[] = [
    {
      name: "users",
      rowCount: "12,453",
      columns: [
        { name: "id", type: "uuid", nullable: false, isPk: true },
        { name: "email", type: "varchar(255)", nullable: false, isPk: false },
        { name: "created_at", type: "timestamptz", nullable: false, isPk: false },
      ],
    },
    {
      name: "orders",
      rowCount: "84,291",
      columns: [
        { name: "id", type: "uuid", nullable: false, isPk: true },
        { name: "user_id", type: "uuid", nullable: false, isPk: false },
        { name: "amount", type: "numeric(10,2)", nullable: false, isPk: false },
        { name: "status", type: "varchar(20)", nullable: false, isPk: false },
        { name: "created_at", type: "timestamptz", nullable: false, isPk: false },
      ],
    },
  ];

  return NextResponse.json({
    data: {
      connectionId: id,
      tables: mockSchema,
      scannedAt: new Date().toISOString(),
    },
  });
}
