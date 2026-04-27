// Embedding Pipeline — generates table_cards/column_cards with LM Studio embeddings
// Design Ref: docs/01-plan/features/nl2sql-architecture.plan.md §3 Phase B-2

import { Pool } from "pg";
import { getLLM, LMSTUDIO_MODELS } from "../llm";

export interface ColumnSpec {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string;
  sampleValues?: unknown[];
}

export interface TableSpec {
  schema: string;
  table: string;
  description?: string;
  columns: ColumnSpec[];
  sampleRow?: Record<string, unknown>;
}

/**
 * Build content text for embedding a table card.
 * Optimized for retrieval: name + description + key columns + sample.
 */
export function buildTableCardText(t: TableSpec): string {
  const cols = t.columns
    .map((c) => `${c.column}:${c.dataType}${c.isPrimaryKey ? " PK" : ""}${c.isForeignKey ? " FK" : ""}`)
    .slice(0, 30)
    .join(", ");
  const desc = t.description ?? "";
  const sample = t.sampleRow
    ? Object.entries(t.sampleRow)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 30)}`)
        .join(", ")
    : "";
  return [
    `Table: ${t.schema}.${t.table}`,
    desc ? `Purpose: ${desc}` : "",
    `Columns: ${cols}`,
    sample ? `Sample: ${sample}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildColumnCardText(c: ColumnSpec): string {
  const flags = [
    c.isPrimaryKey ? "primary key" : "",
    c.isForeignKey ? "foreign key" : "",
    c.isNullable ? "nullable" : "not null",
  ].filter(Boolean).join(", ");
  const samples = c.sampleValues && c.sampleValues.length > 0
    ? `e.g. ${c.sampleValues.slice(0, 3).map((v) => JSON.stringify(v).slice(0, 20)).join(", ")}`
    : "";
  return [
    `${c.schema}.${c.table}.${c.column} (${c.dataType}, ${flags})`,
    c.description ?? "",
    samples,
  ].filter(Boolean).join(" — ");
}

export interface EmbedAndUpsertResult {
  tablesProcessed: number;
  columnsProcessed: number;
  durationMs: number;
}

/**
 * Embed and upsert all cards for a connection. Uses pg client directly for vector inserts.
 */
export async function embedAndUpsertCards(
  connectionId: string,
  tables: TableSpec[],
  pool: Pool,
): Promise<EmbedAndUpsertResult> {
  const llm = getLLM();
  const start = Date.now();

  // Batch by table & column
  const tableTexts = tables.map((t) => buildTableCardText(t));
  const columnSpecs = tables.flatMap((t) => t.columns);
  const columnTexts = columnSpecs.map((c) => buildColumnCardText(c));

  // Batch embedding requests to avoid LM Studio timeouts/OOM on large schemas
  const EMBED_BATCH = 64;

  async function embedBatched(texts: string[], model: string) {
    const out: number[][] = [];
    let totalTokens = 0;
    let actualModel = model;
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const slice = texts.slice(i, i + EMBED_BATCH);
      const res = await llm.embed(slice, { model });
      out.push(...res.embeddings);
      totalTokens += res.usage.totalTokens;
      actualModel = res.model;
    }
    return { embeddings: out, model: actualModel, usage: { totalTokens } };
  }

  const tableEmbeddings = tableTexts.length > 0
    ? await embedBatched(tableTexts, LMSTUDIO_MODELS.EMBED_TABLE)
    : { embeddings: [] as number[][], model: "", usage: { totalTokens: 0 } };

  const columnEmbeddings = columnTexts.length > 0
    ? await embedBatched(columnTexts, LMSTUDIO_MODELS.EMBED_COLUMN)
    : { embeddings: [] as number[][], model: "", usage: { totalTokens: 0 } };

  // Upsert table_cards
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const emb = tableEmbeddings.embeddings[i];
      const vec = emb ? `[${emb.join(",")}]` : null;
      const colsSummary = t.columns.map((c) => c.column).join(", ");
      await client.query(
        `INSERT INTO table_cards (id, connection_id, schema_name, table_name, description, columns_summary, sample_row, embedding_model, embedding, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8::vector, NOW(), NOW())
         ON CONFLICT (connection_id, schema_name, table_name) DO UPDATE SET
           description = EXCLUDED.description,
           columns_summary = EXCLUDED.columns_summary,
           sample_row = EXCLUDED.sample_row,
           embedding_model = EXCLUDED.embedding_model,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
        [
          connectionId,
          t.schema,
          t.table,
          t.description ?? null,
          colsSummary,
          t.sampleRow ? JSON.stringify(t.sampleRow) : null,
          tableEmbeddings.model,
          vec,
        ],
      );
    }

    // Upsert column_cards
    for (let i = 0; i < columnSpecs.length; i++) {
      const c = columnSpecs[i];
      const emb = columnEmbeddings.embeddings[i];
      const vec = emb ? `[${emb.join(",")}]` : null;
      await client.query(
        `INSERT INTO column_cards (id, connection_id, schema_name, table_name, column_name, data_type, description, sample_values, is_nullable, is_primary_key, is_foreign_key, embedding_model, embedding, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, NOW(), NOW())
         ON CONFLICT (connection_id, schema_name, table_name, column_name) DO UPDATE SET
           data_type = EXCLUDED.data_type,
           description = EXCLUDED.description,
           sample_values = EXCLUDED.sample_values,
           is_nullable = EXCLUDED.is_nullable,
           is_primary_key = EXCLUDED.is_primary_key,
           is_foreign_key = EXCLUDED.is_foreign_key,
           embedding_model = EXCLUDED.embedding_model,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
        [
          connectionId,
          c.schema,
          c.table,
          c.column,
          c.dataType,
          c.description ?? null,
          c.sampleValues ? JSON.stringify(c.sampleValues) : null,
          c.isNullable,
          c.isPrimaryKey,
          c.isForeignKey,
          columnEmbeddings.model,
          vec,
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

  return {
    tablesProcessed: tables.length,
    columnsProcessed: columnSpecs.length,
    durationMs: Date.now() - start,
  };
}

/**
 * Embed a single text query for retrieval.
 */
export async function embedQuery(text: string, target: "table" | "column"): Promise<number[]> {
  const llm = getLLM();
  const model = target === "table" ? LMSTUDIO_MODELS.EMBED_TABLE : LMSTUDIO_MODELS.EMBED_COLUMN;
  const res = await llm.embed([text], { model });
  return res.embeddings[0] ?? [];
}
