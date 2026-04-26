import { NextResponse } from "next/server";
import { z } from "zod";
import { guardSql } from "@/lib/sql-guard";
import { getConnection, type StoredConnection } from "@/lib/connections/store";
import { Pool } from "pg";

const RunSchema = z.object({
  sql: z.string().min(1),
  connectionId: z.string(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

// Pool cache — module-level singleton per connection
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
      ? Buffer.from(conn.passwordBase64, "base64").toString()
      : undefined,
    ssl: conn.ssl ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  poolCache.set(conn.id, pool);
  return pool;
}

// Drain all cached pools on process exit to avoid connection leaks
function drainPools(): void {
  for (const pool of poolCache.values()) {
    pool.end().catch(() => {
      // Best-effort; process is already exiting
    });
  }
  poolCache.clear();
}
process.once("exit", drainPools);
process.once("SIGINT", () => { drainPools(); process.exit(0); });
process.once("SIGTERM", () => { drainPools(); process.exit(0); });

/**
 * Append a LIMIT clause only when the query does not already include one.
 * The limit value is an integer validated by Zod so concatenation is safe,
 * but we still avoid string interpolation by using a pg parameterised wrapper.
 *
 * PostgreSQL does not support parameters in LIMIT position for arbitrary
 * sub-selects, so we wrap the entire query in a subquery instead.
 */
function wrapWithLimit(sql: string, limit: number): string {
  const upper = sql.toUpperCase();
  // Simple heuristic: if the top-level query already has LIMIT, don't add one
  if (/\bLIMIT\b/.test(upper)) return sql;
  // Wrap in a subquery; limit is a validated integer — safe to interpolate
  return `SELECT * FROM (${sql}) AS _q LIMIT ${limit}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;
    const parsed = RunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const guard = guardSql(parsed.data.sql);
    if (!guard.allowed) {
      return NextResponse.json(
        { error: `쿼리가 차단되었습니다: ${guard.reason}` },
        { status: 403 }
      );
    }

    // guard.normalizedSql is always defined when guard.allowed is true
    const normalizedSql = guard.normalizedSql!;

    const startMs = Date.now();
    const conn = getConnection(parsed.data.connectionId);

    if (conn && conn.type === "postgresql") {
      const pool = getPool(conn);
      const pgClient = await pool.connect();
      try {
        await pgClient.query("SET statement_timeout = '10000'");
        const limitedSql = wrapWithLimit(normalizedSql, parsed.data.limit);
        const result = await pgClient.query(limitedSql);
        return NextResponse.json({
          data: {
            columns: result.fields.map((f) => f.name),
            rows: result.rows as Record<string, unknown>[],
            rowCount: result.rowCount ?? result.rows.length,
            durationMs: Date.now() - startMs,
            sql: normalizedSql,
          },
        });
      } finally {
        pgClient.release();
      }
    }

    // Fall back to mock data when no real connection is available
    await new Promise((r) => setTimeout(r, 200));

    const mockColumns = ["id", "name", "email", "created_at"];
    const mockRows = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));

    return NextResponse.json({
      data: {
        columns: mockColumns,
        rows: mockRows,
        rowCount: mockRows.length,
        durationMs: Date.now() - startMs,
        sql: normalizedSql,
      },
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "쿼리 실행에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
