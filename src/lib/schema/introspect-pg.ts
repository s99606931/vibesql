// PostgreSQL schema introspection — extract tables, columns, FK edges with sample data.
// Design Ref: docs/01-plan/features/nl2sql-architecture.plan.md §3 Phase B-4

import { Pool } from "pg";
import type { ColumnSpec, TableSpec } from "../embed/pipeline";

export interface FkEdge {
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
  constraintName: string;
}

export async function introspectPgSchema(
  pool: Pool,
  schemaName: string = "public",
  opts: { sampleSize?: number; tableFilter?: string[] } = {},
): Promise<{ tables: TableSpec[]; fkEdges: FkEdge[] }> {
  const sampleSize = opts.sampleSize ?? 3;

  // 1. Tables
  const tablesRes = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName],
  );
  let tableNames = tablesRes.rows.map((r) => r.table_name);
  if (opts.tableFilter && opts.tableFilter.length > 0) {
    tableNames = tableNames.filter((t) => opts.tableFilter!.includes(t));
  }

  // 2. Columns (single query for all tables in schema)
  const colsRes = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, ordinal_position`,
    [schemaName],
  );

  // 3. Primary keys
  const pkRes = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1`,
    [schemaName],
  );
  const pkSet = new Set(pkRes.rows.map((r) => `${r.table_name}.${r.column_name}`));

  // 4. Foreign keys
  const fkRes = await pool.query<{
    constraint_name: string;
    from_table: string;
    from_column: string;
    to_schema: string;
    to_table: string;
    to_column: string;
    ordinal: number;
  }>(
    `SELECT
       tc.constraint_name,
       tc.table_name AS from_table,
       kcu.column_name AS from_column,
       ccu.table_schema AS to_schema,
       ccu.table_name AS to_table,
       ccu.column_name AS to_column,
       kcu.ordinal_position AS ordinal
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [schemaName],
  );
  const fkSet = new Set(fkRes.rows.map((r) => `${r.from_table}.${r.from_column}`));

  // Group FK edges by constraint_name
  const fkEdges: FkEdge[] = [];
  const fkGroups = new Map<string, typeof fkRes.rows>();
  for (const row of fkRes.rows) {
    const arr = fkGroups.get(row.constraint_name) ?? [];
    arr.push(row);
    fkGroups.set(row.constraint_name, arr);
  }
  for (const [constraintName, rows] of fkGroups) {
    const sorted = rows.sort((a, b) => a.ordinal - b.ordinal);
    fkEdges.push({
      fromSchema: schemaName,
      fromTable: sorted[0].from_table,
      fromColumns: sorted.map((r) => r.from_column),
      toSchema: sorted[0].to_schema,
      toTable: sorted[0].to_table,
      toColumns: sorted.map((r) => r.to_column),
      constraintName,
    });
  }

  // 5. Sample rows + sample values per column
  const tables: TableSpec[] = [];
  for (const tableName of tableNames) {
    const tableCols = colsRes.rows.filter((c) => c.table_name === tableName);
    if (tableCols.length === 0) continue;

    let sampleRow: Record<string, unknown> | undefined;
    const colSamples: Record<string, unknown[]> = {};
    try {
      // Use parameterized identifier safely via quote_ident
      const quotedSchema = `"${schemaName.replace(/"/g, '""')}"`;
      const quotedTable = `"${tableName.replace(/"/g, '""')}"`;
      const sampleRes = await pool.query(
        `SELECT * FROM ${quotedSchema}.${quotedTable} LIMIT ${sampleSize}`,
      );
      if (sampleRes.rows.length > 0) {
        sampleRow = sampleRes.rows[0];
        for (const col of tableCols) {
          colSamples[col.column_name] = sampleRes.rows
            .map((r) => r[col.column_name])
            .filter((v) => v != null);
        }
      }
    } catch {
      // Skip if sampling fails (permissions, special tables)
    }

    const columns: ColumnSpec[] = tableCols.map((c) => ({
      schema: schemaName,
      table: tableName,
      column: c.column_name,
      dataType: c.data_type,
      isNullable: c.is_nullable === "YES",
      isPrimaryKey: pkSet.has(`${tableName}.${c.column_name}`),
      isForeignKey: fkSet.has(`${tableName}.${c.column_name}`),
      sampleValues: colSamples[c.column_name],
    }));

    tables.push({ schema: schemaName, table: tableName, columns, sampleRow });
  }

  return { tables, fkEdges };
}

/**
 * Save FK edges to fk_edges table.
 */
export async function saveFkEdges(
  pool: Pool,
  connectionId: string,
  edges: FkEdge[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM fk_edges WHERE connection_id = $1`, [connectionId]);
    for (const e of edges) {
      await client.query(
        `INSERT INTO fk_edges (id, connection_id, from_schema, from_table, from_columns, to_schema, to_table, to_columns, constraint_name, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          connectionId,
          e.fromSchema,
          e.fromTable,
          e.fromColumns,
          e.toSchema,
          e.toTable,
          e.toColumns,
          e.constraintName,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Expand a set of table names by 1-hop FK neighbors.
 */
export function expandFkOneHop(
  tables: string[],
  edges: FkEdge[],
): string[] {
  const set = new Set(tables);
  for (const e of edges) {
    if (set.has(e.fromTable)) set.add(e.toTable);
    if (set.has(e.toTable)) set.add(e.fromTable);
  }
  return Array.from(set);
}
