// Single-sample pipeline debug — validates that gen→validate→refine works end to end.
import { Pool } from "pg";
import { runPipeline } from "../src/lib/nl2sql/pipeline";
import { buildCatalog } from "../src/lib/sql/validate";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Build catalog from fixture
  const colsRes = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'ecommerce_mini'`,
  );
  const map: { [k: string]: string[] } = {};
  for (const r of colsRes.rows) {
    map[r.table_name] ??= [];
    map[r.table_name].push(r.column_name);
  }
  const catalog = buildCatalog(map);

  const fkRes = await pool.query(
    "SELECT * FROM fk_edges WHERE connection_id = $1",
    ["eval-ecommerce-mini"],
  );
  const fkEdges = fkRes.rows.map((r) => ({
    fromSchema: r.from_schema, fromTable: r.from_table, fromColumns: r.from_columns,
    toSchema: r.to_schema, toTable: r.to_table, toColumns: r.to_columns,
    constraintName: r.constraint_name,
  }));

  const tests = [
    "VIP 고객 명단을 보여줘",
    "How many products are out of stock?",
  ];

  for (const q of tests) {
    console.log(`\n=== Q: ${q} ===`);
    const t0 = Date.now();
    try {
      const out = await runPipeline({
        connectionId: "eval-ecommerce-mini",
        question: q,
        dialect: "postgresql",
        catalog,
        fkEdges,
        pool,
      });
      console.log(`  [${Date.now() - t0}ms]`);
      console.log(`  status: ${out.status}, refiner: ${out.refinerAttempts}`);
      if (out.errors.length > 0) console.log(`  errors[]: ${out.errors.join(" | ")}`);
      console.log(`  selected tables: ${out.trace.linker.selectedTables.join(", ")}`);
      console.log(`  used tables: ${out.usedTables.join(", ")}`);
      console.log(`  SQL: ${out.sql.slice(0, 200)}`);
      console.log(`  rationale: ${out.rationale.slice(0, 150)}`);
      console.log(`  validation valid: ${out.validation.valid}`);
      if (!out.validation.valid) {
        console.log(`  errors: ${out.validation.errors.map((e) => `${e.code}:${e.message}`).join("; ")}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
