import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getConnection, type StoredConnection } from "@/lib/connections/store";
import { requireUserId } from "@/lib/auth/require-user";
import { decryptPassword } from "@/lib/connections/encrypt";

interface TableMeta {
  name: string;
  rows: string;
  columns: number;
  description: string;
  cols: string[];
  fks: string[];
  pii: boolean;
}

// ---------------------------------------------------------------------------
// Pool cache — module-level singleton per connection (mirrors run route)
// ---------------------------------------------------------------------------
const poolCache = new Map<string, Pool>();

function getPool(conn: StoredConnection): Pool {
  const existing = poolCache.get(conn.id);
  if (existing) return existing;

  const pool = new Pool({
    host: conn.host ?? "localhost",
    port: conn.port ?? 5432,
    database: conn.database,
    user: conn.username,
    password: conn.passwordBase64
      ? decryptPassword(conn.passwordBase64)
      : undefined,
    ssl: conn.ssl ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  poolCache.set(conn.id, pool);
  return pool;
}

/** Evict cached schema pool for a specific connection (call on connection delete/update). */
export function evictSchemaPool(connectionId: string): void {
  const pool = poolCache.get(connectionId);
  if (pool) { pool.end().catch(() => undefined); poolCache.delete(connectionId); }
}

// Drain all pools on process exit
function drainSchemaPools(): void {
  for (const pool of poolCache.values()) pool.end().catch(() => undefined);
  poolCache.clear();
}
process.once("exit", drainSchemaPools);
process.once("SIGINT", () => { drainSchemaPools(); process.exit(0); });
process.once("SIGTERM", () => { drainSchemaPools(); process.exit(0); });

// ---------------------------------------------------------------------------
// Real introspection query
// ---------------------------------------------------------------------------

interface ColumnsRow {
  table_name: string;
  column_name: string;
}

interface RowCountRow {
  table_name: string;
  approx_rows: number;
}

function formatRowCount(count: number): string {
  if (count < 0) return "—";
  if (count < 1_000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

async function introspectPostgres(conn: StoredConnection): Promise<TableMeta[]> {
  const pool = getPool(conn);
  const client = await pool.connect();
  try {
    const columnsResult = await client.query<ColumnsRow>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`
    );

    const rowCountResult = await client.query<RowCountRow>(
      `SELECT relname AS table_name, reltuples::bigint AS approx_rows
         FROM pg_class
         JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public' AND pg_class.relkind = 'r'`
    );

    const rowCountMap = new Map<string, number>();
    for (const row of rowCountResult.rows) {
      rowCountMap.set(row.table_name, row.approx_rows);
    }

    // Group rows by table name, preserving insertion order
    const tableMap = new Map<string, string[]>();
    for (const row of columnsResult.rows) {
      const cols = tableMap.get(row.table_name);
      if (cols) {
        cols.push(row.column_name);
      } else {
        tableMap.set(row.table_name, [row.column_name]);
      }
    }

    const tables: TableMeta[] = [];
    for (const [tableName, cols] of tableMap) {
      const approxRows = rowCountMap.get(tableName);
      const rows =
        approxRows === undefined || approxRows === -1
          ? "—"
          : formatRowCount(approxRows);
      tables.push({
        name: tableName,
        rows,
        columns: cols.length,
        description: "",
        cols,
        fks: [],
        pii: false,
      });
    }
    return tables;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Demo schema (shown in schema browser before a connection is selected)
// ---------------------------------------------------------------------------

const mockTables: TableMeta[] = [
  { name: "users", rows: "12.4K", columns: 5, description: "", cols: ["id", "email", "name", "created_at", "updated_at"], fks: [], pii: true },
  { name: "orders", rows: "84.3K", columns: 6, description: "", cols: ["id", "user_id", "amount", "status", "created_at", "updated_at"], fks: ["user_id → users.id"], pii: false },
  { name: "products", rows: "1.2K", columns: 5, description: "", cols: ["id", "name", "price", "stock", "category"], fks: [], pii: false },
  { name: "sessions", rows: "5.8K", columns: 4, description: "", cols: ["id", "user_id", "token", "expires_at"], fks: ["user_id → users.id"], pii: true },
];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  if (connectionId) {
    let conn = getConnection(connectionId);
    if (conn && conn.userId !== undefined && conn.userId !== userId) {
      conn = undefined;
    }
    if (!conn && process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        const row = await prisma.connection.findFirst({ where: { id: connectionId, userId } });
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
        const tables = await introspectPostgres(conn);
        return NextResponse.json({ data: tables });
      } catch {
        // DB unreachable — return empty list
      }
    }
  }

  return NextResponse.json({ data: mockTables });
}
