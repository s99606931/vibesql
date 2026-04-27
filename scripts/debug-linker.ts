import { Pool } from "pg";
import { runLinker } from "../src/lib/linker";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const fkRes = await pool.query(
      "SELECT * FROM fk_edges WHERE connection_id = $1",
      ["eval-ecommerce-mini"],
    );
    const fkEdges = fkRes.rows.map((r) => ({
      fromSchema: r.from_schema, fromTable: r.from_table, fromColumns: r.from_columns,
      toSchema: r.to_schema, toTable: r.to_table, toColumns: r.to_columns,
      constraintName: r.constraint_name,
    }));
    console.log("fk_edges:", fkEdges.length);
    const cardCount = await pool.query<{ tc: number; cc: number }>(
      "SELECT (SELECT COUNT(*) FROM table_cards WHERE connection_id = $1)::int AS tc, (SELECT COUNT(*) FROM column_cards WHERE connection_id = $1)::int AS cc",
      ["eval-ecommerce-mini"],
    );
    console.log("cards:", cardCount.rows[0]);

    const result = await runLinker(pool, "eval-ecommerce-mini", "이번 달 신규 가입자 수는?", fkEdges);
    console.log("\n=== LINKER RESULT ===");
    console.log("selectedTables:", result.selectedTables);
    console.log("topK columns (top 5):", result.retrieval.columnTopK.slice(0, 5).map((c) => `${c.table}.${c.column}=${c.score.toFixed(3)}`));
    console.log("topK tables (top 3):", result.retrieval.tableTopK.slice(0, 3).map((t) => `${t.table}=${t.score.toFixed(3)}`));
    console.log("schemaCards length:", result.schemaCards.length);
    console.log("durationMs:", result.durationMs);
    console.log("\n=== SCHEMA CARDS (first 800) ===\n", result.schemaCards.slice(0, 800));
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.stack : e);
  } finally {
    await pool.end();
  }
}

main();
