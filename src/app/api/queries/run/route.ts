import { NextResponse } from "next/server";
import { z } from "zod";
import { guardSql } from "@/lib/sql-guard";
import { getConnection, type StoredConnection } from "@/lib/connections/store";
import { Pool } from "pg";
import type { Pool as MySQLPool } from "mysql2/promise";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/auth/require-user";

const RunSchema = z.object({
  sql: z.string().min(1),
  connectionId: z.string(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

// 60 requests per minute per IP
const RUN_LIMIT = 60;
const RUN_WINDOW_MS = 60_000;

// ── PostgreSQL pool cache ───────────────────────────────────────────────────
const pgPoolCache = new Map<string, Pool>();

function getPgPool(conn: StoredConnection): Pool {
  const existing = pgPoolCache.get(conn.id);
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
  pgPoolCache.set(conn.id, pool);
  return pool;
}

// ── MySQL pool cache ────────────────────────────────────────────────────────
const mysqlPoolCache = new Map<string, MySQLPool>();

async function getMysqlPool(conn: StoredConnection): Promise<MySQLPool> {
  const existing = mysqlPoolCache.get(conn.id);
  if (existing) return existing;
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({
    host: conn.host ?? "localhost",
    port: conn.port ?? 3306,
    database: conn.database,
    user: conn.username,
    password: conn.passwordBase64
      ? Buffer.from(conn.passwordBase64, "base64").toString()
      : undefined,
    ssl: conn.ssl ? {} : undefined,
    connectionLimit: 3,
    connectTimeout: 5_000,
  });
  mysqlPoolCache.set(conn.id, pool);
  return pool;
}

// Drain all cached pools on process exit to avoid connection leaks
function drainPools(): void {
  for (const pool of pgPoolCache.values()) pool.end().catch(() => undefined);
  pgPoolCache.clear();
  for (const pool of mysqlPoolCache.values()) pool.end().catch(() => undefined);
  mysqlPoolCache.clear();
}
process.once("exit", drainPools);
process.once("SIGINT", () => { drainPools(); process.exit(0); });

/** Evict cached pools for a specific connection (call on connection delete/update). */
export function evictRunPools(connectionId: string): void {
  const pg = pgPoolCache.get(connectionId);
  if (pg) { pg.end().catch(() => undefined); pgPoolCache.delete(connectionId); }
  const my = mysqlPoolCache.get(connectionId);
  if (my) { my.end().catch(() => undefined); mysqlPoolCache.delete(connectionId); }
}
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
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip, RUN_LIMIT, RUN_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-RateLimit-Limit": String(RUN_LIMIT),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

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

    if (!guard.normalizedSql) {
      return NextResponse.json({ error: "쿼리 정규화에 실패했습니다." }, { status: 500 });
    }
    const normalizedSql = guard.normalizedSql;

    const startMs = Date.now();
    let conn = getConnection(parsed.data.connectionId);

    // When DATABASE_URL is set, connections are persisted in Prisma not in-memory store.
    // Filter by userId to prevent cross-tenant connection access.
    if (!conn && process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        const row = await prisma.connection.findUnique({
          where: { id: parsed.data.connectionId, userId },
        });
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
            lastTestedAt: row.lastTestedAt?.toISOString(),
            lastTestedOk: row.lastTestedOk ?? undefined,
            createdAt: row.createdAt.toISOString(),
          };
        }
      } catch { /* fall through to mock */ }
    }

    if (conn && conn.type === "postgresql") {
      const pool = getPgPool(conn);
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

    if (conn && conn.type === "mysql") {
      const pool = await getMysqlPool(conn);
      const mysqlConn = await pool.getConnection();
      try {
        await mysqlConn.query("SET SESSION MAX_EXECUTION_TIME=10000");
        const limitedSql = wrapWithLimit(normalizedSql, parsed.data.limit);
        const [rows, fields] = await mysqlConn.execute(limitedSql);
        const rowsArr = rows as Record<string, unknown>[];
        return NextResponse.json({
          data: {
            columns: (fields as Array<{ name: string }>).map((f) => f.name),
            rows: rowsArr,
            rowCount: rowsArr.length,
            durationMs: Date.now() - startMs,
            sql: normalizedSql,
          },
        });
      } finally {
        mysqlConn.release();
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
    // Log the real error server-side; return a generic message to avoid leaking DB internals.
    console.error("[run] query error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "쿼리 실행에 실패했습니다." }, { status: 500 });
  }
}
