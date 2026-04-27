/**
 * Run NL2SQL evaluation against the golden set.
 *
 * Usage:
 *   tsx scripts/run-eval.ts                  # full pipeline
 *   tsx scripts/run-eval.ts --inline-only    # skip RAG, inline schema
 *
 * Setup (one-time):
 *   1. docker compose up -d postgres
 *   2. Apply pgvector migration (already done)
 *   3. tsx scripts/setup-eval-fixture.ts     # creates fixture connection + seeds RAG
 */
import { Pool } from "pg";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  loadGoldenSet,
  runEvaluation,
  writeReport,
  summarizeReport,
  buildCatalog,
  type GoldenItem,
  type PipelineRunner,
} from "../src/lib/eval/runner";
import { runPipeline } from "../src/lib/nl2sql/pipeline";
import {
  introspectPgSchema,
  saveFkEdges,
  type FkEdge,
} from "../src/lib/schema/introspect-pg";
import { embedAndUpsertCards } from "../src/lib/embed/pipeline";

const FIXTURE_SCHEMA = "ecommerce_mini";
const FIXTURE_CONNECTION_ID = "eval-ecommerce-mini";

async function ensureFixtureConnection(pool: Pool): Promise<string> {
  // Find or create a Connection row for the fixture (so audit_traces FK works)
  const findRes = await pool.query<{ id: string }>(
    `SELECT id FROM public.connections WHERE id = $1`,
    [FIXTURE_CONNECTION_ID],
  );
  if (findRes.rows.length > 0) return findRes.rows[0].id;
  // Need a user_id — pick any user or create a system user
  const userRes = await pool.query<{ id: string }>(
    `SELECT id FROM public.users LIMIT 1`,
  );
  let userId = userRes.rows[0]?.id;
  if (!userId) {
    const createUser = await pool.query<{ id: string }>(
      `INSERT INTO public.users (id, email, role, "createdAt", "updatedAt")
       VALUES ('eval-system-user', 'eval@vibesql.local', 'ADMIN', NOW(), NOW())
       RETURNING id`,
    );
    userId = createUser.rows[0].id;
  }
  await pool.query(
    `INSERT INTO public.connections (id, name, type, host, port, database, username, ssl, is_active, user_id, created_at, updated_at)
     VALUES ($1, 'eval-ecommerce-mini', 'postgresql', 'localhost', 5432, 'vibesql', 'vibesql', false, true, $2, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [FIXTURE_CONNECTION_ID, userId],
  );
  return FIXTURE_CONNECTION_ID;
}

async function ensureFixture(pool: Pool): Promise<void> {
  const exists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = 'customers'
     ) AS exists`,
    [FIXTURE_SCHEMA],
  );
  if (exists.rows[0]?.exists) {
    console.log(`✓ Fixture schema '${FIXTURE_SCHEMA}' already exists`);
    return;
  }
  const sqlPath = path.join(__dirname, "../tests/eval/fixtures/ecommerce-mini/schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log(`Loading fixture schema from ${sqlPath}...`);
  await pool.query(sql);
  // Reset search_path which the fixture sets to ecommerce_mini
  await pool.query("SET search_path TO public");
  console.log(`✓ Fixture schema loaded`);
}

async function ensureRagIndex(pool: Pool, connectionId: string): Promise<{ fkEdges: FkEdge[]; tableNames: string[] }> {
  // Check if cards already exist
  const cardCount = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM table_cards WHERE connection_id = $1`,
    [connectionId],
  );
  if (cardCount.rows[0].n > 0) {
    console.log(`✓ Found ${cardCount.rows[0].n} table_cards already indexed for connection ${connectionId}`);
  } else {
    console.log(`Indexing schema '${FIXTURE_SCHEMA}' for RAG...`);
    const { tables, fkEdges } = await introspectPgSchema(pool, FIXTURE_SCHEMA, { sampleSize: 3 });
    console.log(`  Introspected ${tables.length} tables, ${fkEdges.length} FK edges`);
    await embedAndUpsertCards(connectionId, tables, pool);
    console.log(`✓ Embedded ${tables.length} table_cards`);
    await saveFkEdges(pool, connectionId, fkEdges);
    console.log(`✓ Saved ${fkEdges.length} FK edges`);
  }

  // Always reload FK edges and table list
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

  const tablesRes = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM table_cards WHERE connection_id = $1`,
    [connectionId],
  );
  return { fkEdges, tableNames: tablesRes.rows.map((r) => r.table_name) };
}

async function buildSchemaCatalogForFixture(pool: Pool) {
  // Load all columns of fixture for the validator catalog
  const res = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = $1`,
    [FIXTURE_SCHEMA],
  );
  const map: { [tableName: string]: string[] } = {};
  for (const row of res.rows) {
    map[row.table_name] ??= [];
    map[row.table_name].push(row.column_name);
  }
  return buildCatalog(map);
}

async function main() {
  const goldenPath = path.join(__dirname, "../tests/eval/golden/ecommerce-mini.golden.json");
  const items: GoldenItem[] = loadGoldenSet(goldenPath);
  console.log(`Loaded ${items.length} golden items from ${path.basename(goldenPath)}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://vibesql:vibesql_dev@localhost:5432/vibesql",
  });

  await ensureFixture(pool);
  const connectionId = await ensureFixtureConnection(pool);
  const { fkEdges } = await ensureRagIndex(pool, connectionId);
  const catalog = await buildSchemaCatalogForFixture(pool);

  const runner: PipelineRunner = {
    async generate(item) {
      const out = await runPipeline({
        connectionId,
        question: item.question,
        dialect: item.dialect,
        catalog,
        fkEdges,
        pool,
      });
      return {
        sql: out.sql,
        rationale: out.rationale,
        usedTables: out.usedTables,
        usedColumns: out.usedColumns,
        durationMs: out.durationMs,
        inputTokens: out.inputTokens,
        outputTokens: out.outputTokens,
        refinerAttempts: out.refinerAttempts,
        validation: out.validation,
        pipelineErrors: out.errors,
      };
    },
  };

  console.log("\nRunning evaluation...\n");
  const report = await runEvaluation(items, runner, { promptVersion: "M1-baseline" });
  console.log(summarizeReport(report));
  const reportFile = writeReport(report, path.join(__dirname, "../tests/eval/reports"));
  console.log(`\nReport written: ${reportFile}`);

  await pool.end();
  process.exit(report.passRate >= 0.5 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
