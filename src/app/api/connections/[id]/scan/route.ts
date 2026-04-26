import { NextResponse } from "next/server";
import { getConnection } from "@/lib/connections/store";

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
  const { id } = await params;
  const conn = getConnection(id);

  if (conn && conn.type === "postgresql") {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        host: conn.host || "localhost",
        port: conn.port || 5432,
        database: conn.database,
        user: conn.username,
        password: conn.passwordBase64
          ? Buffer.from(conn.passwordBase64, "base64").toString()
          : undefined,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });

      await client.connect();
      const result = await client.query<ScanRow>(SCAN_SQL);
      await client.end();

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
      const msg = err instanceof Error ? err.message : "스키마 스캔 실패";
      return NextResponse.json(
        { error: `스키마 스캔에 실패했습니다: ${msg}` },
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
