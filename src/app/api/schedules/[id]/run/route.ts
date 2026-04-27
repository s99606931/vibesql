import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { memSchedules, memScheduleRuns, persistSchedules } from "@/lib/db/mem-schedules";
import { getAllConnections, type StoredConnection } from "@/lib/connections/store";
import { guardSql } from "@/lib/sql-guard";
import { decryptPassword } from "@/lib/connections/encrypt";
import { Pool } from "pg";
import type { DbDialect } from "@/types";

// ─── 연결 탐색 헬퍼 ──────────────────────────────────────────────────────────

/**
 * userId에 속하는 인메모리 연결 중 dialect가 일치하는 첫 번째 활성 연결을 반환한다.
 * (userId가 없는 연결은 공유 연결로 간주해 허용)
 */
function findMemConnection(userId: string, dialect: DbDialect): StoredConnection | undefined {
  return getAllConnections().find(
    (c) =>
      c.isActive &&
      c.type === dialect &&
      (c.userId === undefined || c.userId === userId)
  );
}

/** Prisma Connection row를 StoredConnection으로 변환한다. */
function prismaRowToStored(row: {
  id: string;
  name: string;
  type: string;
  host: string | null;
  port: number | null;
  database: string;
  username: string | null;
  passwordHash: string | null;
  ssl: boolean;
  isActive: boolean;
  lastTestedAt: Date | null;
  lastTestedOk: boolean | null;
  createdAt: Date;
}): StoredConnection {
  return {
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

// ─── SQL 실행 헬퍼 ───────────────────────────────────────────────────────────

interface RunResult {
  rowCount: number;
  durationMs: number;
}

/** PostgreSQL: 새 Pool을 생성해 쿼리를 실행하고 반환 후 닫는다 (30초 timeout). */
async function runPostgres(conn: StoredConnection, sql: string): Promise<RunResult> {
  const pool = new Pool({
    host: conn.host ?? "localhost",
    port: conn.port ?? 5432,
    database: conn.database,
    user: conn.username,
    password: conn.passwordBase64 ? decryptPassword(conn.passwordBase64) : undefined,
    ssl: conn.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  });

  const client = await pool.connect();
  const startMs = Date.now();
  try {
    await client.query("SET statement_timeout = '30000'");
    const result = await client.query(sql);
    const durationMs = Date.now() - startMs;
    return { rowCount: result.rowCount ?? result.rows.length, durationMs };
  } finally {
    client.release();
    pool.end().catch(() => undefined);
  }
}

/** MySQL: 새 pool을 생성해 쿼리를 실행하고 반환 후 닫는다 (30초 timeout). */
async function runMysql(conn: StoredConnection, sql: string): Promise<RunResult> {
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({
    host: conn.host ?? "localhost",
    port: conn.port ?? 3306,
    database: conn.database,
    user: conn.username,
    password: conn.passwordBase64 ? decryptPassword(conn.passwordBase64) : undefined,
    ssl: conn.ssl ? {} : undefined,
    connectionLimit: 1,
    connectTimeout: 5_000,
  });

  const mysqlConn = await pool.getConnection();
  const startMs = Date.now();
  try {
    await mysqlConn.query("SET SESSION MAX_EXECUTION_TIME=30000");
    const [rows] = await mysqlConn.execute(sql);
    const durationMs = Date.now() - startMs;
    const rowsArr = rows as unknown[];
    return { rowCount: rowsArr.length, durationMs };
  } finally {
    mysqlConn.release();
    pool.end().catch(() => undefined);
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult;

  // ── Prisma 경로 (DATABASE_URL 설정 시) ──────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const schedule = await prisma.scheduledQuery.findFirst({ where: { id, userId } });
      if (!schedule) {
        return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
      }

      // ScheduleRun 레코드 생성 (running 상태)
      const run = await prisma.scheduleRun.create({
        data: { scheduleId: id, status: "running" },
      });

      // ── SQL 가드 확인 ────────────────────────────────────────────────────────
      const guard = guardSql(schedule.sql);
      if (!guard.allowed) {
        await prisma.scheduleRun.update({
          where: { id: run.id },
          data: { status: "error", errorMsg: `쿼리가 차단되었습니다: ${guard.reason}` },
        });
        return NextResponse.json(
          { error: `쿼리가 차단되었습니다: ${guard.reason}` },
          { status: 403 }
        );
      }
      const normalizedSql = guard.normalizedSql!;

      // ── 연결 탐색 (인메모리 → Prisma 순) ────────────────────────────────────
      let conn: StoredConnection | undefined = findMemConnection(userId, schedule.dialect as DbDialect);

      if (!conn) {
        const dbConn = await prisma.connection.findFirst({
          where: { userId, type: schedule.dialect, isActive: true },
        });
        if (dbConn) conn = prismaRowToStored(dbConn);
      }

      if (!conn) {
        await prisma.scheduleRun.update({
          where: { id: run.id },
          data: { status: "error", errorMsg: "실행할 데이터베이스 연결을 찾을 수 없습니다." },
        });
        return NextResponse.json(
          { error: "실행할 데이터베이스 연결을 찾을 수 없습니다." },
          { status: 400 }
        );
      }

      // ── 실제 SQL 실행 ────────────────────────────────────────────────────────
      try {
        let result: RunResult;
        if (conn.type === "postgresql") {
          result = await runPostgres(conn, normalizedSql);
        } else if (conn.type === "mysql") {
          result = await runMysql(conn, normalizedSql);
        } else {
          throw new Error(`지원하지 않는 데이터베이스 타입입니다: ${conn.type}`);
        }

        await prisma.scheduleRun.update({
          where: { id: run.id },
          data: { status: "success", durationMs: result.durationMs, rowCount: result.rowCount },
        });
        await prisma.scheduledQuery.update({
          where: { id },
          data: { lastRunAt: new Date(), lastRunStatus: "success" },
        });

        return NextResponse.json({
          data: { runId: run.id, status: "success", durationMs: result.durationMs, rowCount: result.rowCount },
        });
      } catch (execError) {
        const errMsg =
          execError instanceof Error ? execError.message : "쿼리 실행 중 오류가 발생했습니다.";
        // DB 내부 구조 노출 방지: 스택 없이 메시지만 서버에 기록
        console.error("[schedule/run] execution error:", errMsg);
        await prisma.scheduleRun.update({
          where: { id: run.id },
          data: { status: "error", errorMsg: "쿼리 실행에 실패했습니다. 연결 정보를 확인하세요." },
        });
        await prisma.scheduledQuery.update({
          where: { id },
          data: { lastRunAt: new Date(), lastRunStatus: "error" },
        });
        return NextResponse.json(
          { error: "쿼리 실행에 실패했습니다. 연결 정보를 확인하세요." },
          { status: 500 }
        );
      }
    } catch (outerError) {
      // Prisma 연결 실패 등 — 인메모리로 fall through
      console.error("[schedule/run] prisma error:", outerError instanceof Error ? outerError.message : outerError);
      /* fall through */
    }
  }

  // ── 인메모리 경로 (DATABASE_URL 미설정 또는 Prisma 오류 시) ──────────────────
  const schedule = memSchedules.find((s) => s.id === id && s.userId === userId);
  if (!schedule) {
    return NextResponse.json({ error: "스케줄을 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();

  // ── SQL 가드 확인 ──────────────────────────────────────────────────────────
  const guard = guardSql(schedule.sql);
  if (!guard.allowed) {
    const errRun: (typeof memScheduleRuns)[number] = {
      id: crypto.randomUUID(),
      scheduleId: id,
      status: "error",
      rowCount: null,
      durationMs: null,
      errorMsg: `쿼리가 차단되었습니다: ${guard.reason}`,
      createdAt: now,
    };
    memScheduleRuns.push(errRun);
    schedule.lastRunAt = now;
    schedule.lastRunStatus = "error";
    schedule.updatedAt = now;
    persistSchedules();
    return NextResponse.json(
      { error: `쿼리가 차단되었습니다: ${guard.reason}` },
      { status: 403 }
    );
  }
  const normalizedSql = guard.normalizedSql!;

  // ── 연결 탐색 ──────────────────────────────────────────────────────────────
  const conn = findMemConnection(userId, schedule.dialect);

  if (!conn) {
    const errRun: (typeof memScheduleRuns)[number] = {
      id: crypto.randomUUID(),
      scheduleId: id,
      status: "error",
      rowCount: null,
      durationMs: null,
      errorMsg: "실행할 데이터베이스 연결을 찾을 수 없습니다.",
      createdAt: now,
    };
    memScheduleRuns.push(errRun);
    schedule.lastRunAt = now;
    schedule.lastRunStatus = "error";
    schedule.updatedAt = now;
    persistSchedules();
    return NextResponse.json(
      { error: "실행할 데이터베이스 연결을 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  // ── 실제 SQL 실행 ──────────────────────────────────────────────────────────
  try {
    let result: RunResult;
    if (conn.type === "postgresql") {
      result = await runPostgres(conn, normalizedSql);
    } else if (conn.type === "mysql") {
      result = await runMysql(conn, normalizedSql);
    } else {
      throw new Error(`지원하지 않는 데이터베이스 타입입니다: ${conn.type}`);
    }

    const successRun: (typeof memScheduleRuns)[number] = {
      id: crypto.randomUUID(),
      scheduleId: id,
      status: "success",
      rowCount: result.rowCount,
      durationMs: result.durationMs,
      errorMsg: null,
      createdAt: now,
    };
    memScheduleRuns.push(successRun);
    schedule.lastRunAt = now;
    schedule.lastRunStatus = "success";
    schedule.updatedAt = now;
    persistSchedules();

    return NextResponse.json({
      data: { runId: successRun.id, status: "success", durationMs: result.durationMs, rowCount: result.rowCount },
    });
  } catch (execError) {
    const errMsg =
      execError instanceof Error ? execError.message : "쿼리 실행 중 오류가 발생했습니다.";
    console.error("[schedule/run] execution error:", errMsg);

    const errRun: (typeof memScheduleRuns)[number] = {
      id: crypto.randomUUID(),
      scheduleId: id,
      status: "error",
      rowCount: null,
      durationMs: null,
      errorMsg: "쿼리 실행에 실패했습니다. 연결 정보를 확인하세요.",
      createdAt: now,
    };
    memScheduleRuns.push(errRun);
    schedule.lastRunAt = now;
    schedule.lastRunStatus = "error";
    schedule.updatedAt = now;
    persistSchedules();

    return NextResponse.json(
      { error: "쿼리 실행에 실패했습니다. 연결 정보를 확인하세요." },
      { status: 500 }
    );
  }
}
