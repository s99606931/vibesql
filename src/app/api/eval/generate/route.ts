// /api/eval/generate — Dev-only endpoint that exposes the new RAG-First NL2SQL pipeline.
//
// Auth: bypassed when NODE_ENV=development OR header `x-eval-token` matches process.env.EVAL_TOKEN.
// This route is purely for browser/E2E verification of the new pipeline. Production traffic
// continues to use /api/queries/generate (single-shot Claude) until the route swap is approved.
//
// Body: { question, connectionId?, dialect? }
// Response: { data: { sql, rationale, usedTables, usedColumns, validation, status, durationMs, refinerAttempts, traceId } }

import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import { runPipeline } from "@/lib/nl2sql/pipeline";
import { buildCatalog, type SqlDialect } from "@/lib/sql/validate";
import { persistTrace } from "@/lib/audit/trace";

const BodySchema = z.object({
  question: z.string().min(1).max(2000),
  connectionId: z.string().optional().default("eval-ecommerce-mini"),
  dialect: z
    .enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"])
    .default("postgresql"),
  schemaName: z.string().optional().default("ecommerce_mini"),
});

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = req.headers.get("x-eval-token");
  if (process.env.EVAL_TOKEN && token === process.env.EVAL_TOKEN) return true;
  return false;
}

let cachedPool: Pool | null = null;
function getPool(): Pool {
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://vibesql:vibesql_dev@localhost:5432/vibesql",
    });
  }
  return cachedPool;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { question, connectionId, dialect, schemaName } = parsed.data;
  const pool = getPool();

  try {
    // 1. Load FK edges for the connection
    const fkRes = await pool.query<{
      from_schema: string;
      from_table: string;
      from_columns: string[];
      to_schema: string;
      to_table: string;
      to_columns: string[];
      constraint_name: string;
    }>(
      `SELECT from_schema, from_table, from_columns, to_schema, to_table, to_columns, constraint_name
       FROM fk_edges WHERE connection_id = $1`,
      [connectionId],
    );
    const fkEdges = fkRes.rows.map((r) => ({
      fromSchema: r.from_schema,
      fromTable: r.from_table,
      fromColumns: r.from_columns,
      toSchema: r.to_schema,
      toTable: r.to_table,
      toColumns: r.to_columns,
      constraintName: r.constraint_name,
    }));

    // 2. Build catalog from information_schema for the target schema
    const colsRes = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1`,
      [schemaName],
    );
    if (colsRes.rows.length === 0) {
      return NextResponse.json(
        {
          error: `No tables found in schema '${schemaName}'. Run the eval fixture first: npx tsx scripts/run-eval.ts`,
        },
        { status: 503 },
      );
    }
    const map: Record<string, string[]> = {};
    for (const r of colsRes.rows) {
      map[r.table_name] ??= [];
      map[r.table_name].push(r.column_name);
    }
    const catalog = buildCatalog(map);

    // 3. Run the NL2SQL pipeline
    const out = await runPipeline({
      connectionId,
      question,
      dialect: dialect as SqlDialect,
      catalog,
      fkEdges,
      pool,
    });

    // 4. Persist trace (best-effort, non-fatal)
    let traceId: string | null = null;
    try {
      traceId = await persistTrace(pool, {
        connectionId,
        question,
        promptVersion: process.env.GIT_SHA ?? "dev",
        sql: out.sql,
        rationale: out.rationale,
        validationResult: out.validation,
        refinerAttempts: out.refinerAttempts,
        tokenInputTotal: out.inputTokens,
        tokenOutputTotal: out.outputTokens,
        durationMs: out.durationMs,
        status: out.status,
        errorMessage: out.errors.length > 0 ? out.errors.join("; ") : null,
        linkerOutput: out.trace.linker,
        generatorOutput: { tokens: out.trace.generator },
      });
    } catch (err) {
      console.error("[eval/generate] trace persist failed:", err);
    }

    return NextResponse.json({
      data: {
        sql: out.sql,
        rationale: out.rationale,
        usedTables: out.usedTables,
        usedColumns: out.usedColumns,
        confidence: out.confidence,
        needsClarification: out.needsClarification,
        validation: {
          valid: out.validation.valid,
          errors: out.validation.errors,
          tables: out.validation.tables,
          columns: out.validation.columns,
        },
        status: out.status,
        refinerAttempts: out.refinerAttempts,
        durationMs: out.durationMs,
        tokens: {
          input: out.inputTokens,
          output: out.outputTokens,
        },
        trace: {
          selectedTables: out.trace.linker.selectedTables,
          linkerDurationMs: out.trace.linker.durationMs,
          generatorDurationMs: out.trace.generator.durationMs,
        },
        traceId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[eval/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "eval/generate",
    purpose: "Dev/E2E endpoint exposing the RAG-First NL2SQL pipeline",
    method: "POST",
    body: {
      question: "string (required)",
      connectionId: "string (default: eval-ecommerce-mini)",
      dialect: "postgresql | mysql | sqlite | mssql | oracle (default: postgresql)",
      schemaName: "string (default: ecommerce_mini)",
    },
    auth: "Bypassed in development; requires x-eval-token header in production",
  });
}
