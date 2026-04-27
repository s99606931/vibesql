// Schema Linker — 3-step retrieval (column-filter → table-select → column-refine)
// Design Ref: docs/01-plan/features/nl2sql-architecture.plan.md §3 Phase C

import { Pool } from "pg";
import { embedQuery } from "../embed/pipeline";
import { getLLM, LMSTUDIO_MODELS, type ChatMessage } from "../llm";
import { expandFkOneHop, type FkEdge } from "../schema/introspect-pg";

export interface RetrievedColumn {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  description: string | null;
  sampleValues: unknown[] | null;
  score: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface RetrievedTable {
  schema: string;
  table: string;
  description: string | null;
  columnsSummary: string | null;
  sampleRow: Record<string, unknown> | null;
  score: number;
}

export interface LinkerResult {
  selectedTables: string[]; // table names (with FK 1-hop expansion)
  schemaCards: string;       // compact schema card text for the generator
  retrieval: {
    columnTopK: RetrievedColumn[];
    tableTopK: RetrievedTable[];
  };
  durationMs: number;
}

/**
 * Step 1: Column Filtering — vector retrieval over column_cards.
 */
export async function retrieveColumns(
  pool: Pool,
  connectionId: string,
  question: string,
  topK: number = 40,
): Promise<RetrievedColumn[]> {
  const queryEmb = await embedQuery(question, "column");
  const vec = `[${queryEmb.join(",")}]`;
  const res = await pool.query<{
    schema_name: string;
    table_name: string;
    column_name: string;
    data_type: string;
    description: string | null;
    sample_values: unknown;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    score: number;
  }>(
    `SELECT
       schema_name, table_name, column_name, data_type, description, sample_values,
       is_primary_key, is_foreign_key,
       1 - (embedding <=> $2::vector) AS score
     FROM column_cards
     WHERE connection_id = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [connectionId, vec, topK],
  );
  return res.rows.map((r) => ({
    schema: r.schema_name,
    table: r.table_name,
    column: r.column_name,
    dataType: r.data_type,
    description: r.description,
    sampleValues: Array.isArray(r.sample_values) ? r.sample_values : null,
    score: Number(r.score),
    isPrimaryKey: r.is_primary_key,
    isForeignKey: r.is_foreign_key,
  }));
}

/**
 * Optional: retrieve top tables directly. Useful when columns are sparse.
 */
export async function retrieveTables(
  pool: Pool,
  connectionId: string,
  question: string,
  topK: number = 10,
): Promise<RetrievedTable[]> {
  const queryEmb = await embedQuery(question, "table");
  const vec = `[${queryEmb.join(",")}]`;
  const res = await pool.query<{
    schema_name: string;
    table_name: string;
    description: string | null;
    columns_summary: string | null;
    sample_row: unknown;
    score: number;
  }>(
    `SELECT
       schema_name, table_name, description, columns_summary, sample_row,
       1 - (embedding <=> $2::vector) AS score
     FROM table_cards
     WHERE connection_id = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [connectionId, vec, topK],
  );
  return res.rows.map((r) => ({
    schema: r.schema_name,
    table: r.table_name,
    description: r.description,
    columnsSummary: r.columns_summary,
    sampleRow: typeof r.sample_row === "object" && r.sample_row !== null
      ? (r.sample_row as Record<string, unknown>)
      : null,
    score: Number(r.score),
  }));
}

/**
 * Step 2: Table Selection — LLM picks core tables from candidate columns.
 */
export async function selectTables(
  question: string,
  retrievedColumns: RetrievedColumn[],
  retrievedTables: RetrievedTable[],
): Promise<{ tables: string[]; reason: string; rawOutput: string }> {
  const llm = getLLM();
  // Aggregate candidate tables from retrieved columns
  const tableScores = new Map<string, number>();
  for (const c of retrievedColumns) {
    tableScores.set(c.table, (tableScores.get(c.table) ?? 0) + c.score);
  }
  for (const t of retrievedTables) {
    tableScores.set(t.table, (tableScores.get(t.table) ?? 0) + t.score * 1.5); // table-level boost
  }
  const candidates = Array.from(tableScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);

  if (candidates.length === 0) {
    return { tables: [], reason: "no_candidates", rawOutput: "" };
  }

  const candidateSummary = candidates.map((t) => {
    const tinfo = retrievedTables.find((rt) => rt.table === t);
    const cols = retrievedColumns.filter((rc) => rc.table === t).slice(0, 6);
    return [
      `### ${t}`,
      tinfo?.description ? `Purpose: ${tinfo.description}` : "",
      `Top columns: ${cols.map((c) => c.column).join(", ")}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a SQL schema-linking assistant. Given a user question and candidate tables, pick the MINIMUM tables required to answer the question. Return strict JSON: {"tables": ["t1", "t2"], "reason": "..."}. Only include tables actually needed. Prefer fewer over more. Output JSON only.`,
    },
    {
      role: "user",
      content: `Question: ${question}\n\nCandidates:\n${candidateSummary}\n\nReturn JSON.`,
    },
  ];
  const res = await llm.chat(messages, {
    model: LMSTUDIO_MODELS.LINKER,
    temperature: 0,
    maxTokens: 400,
    jsonMode: true,
  });

  let parsed: { tables?: string[]; reason?: string };
  try {
    parsed = JSON.parse(res.content);
  } catch {
    // Lenient: extract from braces
    const m = res.content.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = {};
      }
    } else {
      parsed = {};
    }
  }
  const tables = Array.isArray(parsed.tables) ? parsed.tables.filter((t): t is string => typeof t === "string") : [];
  // Validate against candidates
  const valid = tables.filter((t) => candidates.includes(t));
  return {
    tables: valid.length > 0 ? valid : candidates.slice(0, 2),
    reason: parsed.reason ?? "",
    rawOutput: res.content,
  };
}

/**
 * Step 3: Compact schema cards for the generator.
 */
export function buildSchemaCards(
  selectedTables: string[],
  retrievedColumns: RetrievedColumn[],
): string {
  const byTable = new Map<string, RetrievedColumn[]>();
  for (const c of retrievedColumns) {
    if (!selectedTables.includes(c.table)) continue;
    const arr = byTable.get(c.table) ?? [];
    arr.push(c);
    byTable.set(c.table, arr);
  }
  const sections: string[] = [];
  for (const t of selectedTables) {
    const cols = byTable.get(t) ?? [];
    const colLines = cols.slice(0, 20).map((c) => {
      const flags: string[] = [];
      if (c.isPrimaryKey) flags.push("PK");
      if (c.isForeignKey) flags.push("FK");
      const samples = Array.isArray(c.sampleValues) && c.sampleValues.length > 0
        ? ` ex: ${c.sampleValues.slice(0, 3).map((v) => JSON.stringify(v).slice(0, 18)).join(", ")}`
        : "";
      return `  - ${c.column} (${c.dataType}${flags.length > 0 ? `, ${flags.join(",")}` : ""})${samples}`;
    });
    sections.push(`Table: ${t}\n${colLines.join("\n")}`);
  }
  return sections.join("\n\n");
}

/**
 * Full 3-step pipeline.
 */
export async function runLinker(
  pool: Pool,
  connectionId: string,
  question: string,
  fkEdges: FkEdge[],
  opts: { columnTopK?: number; tableTopK?: number } = {},
): Promise<LinkerResult> {
  const start = Date.now();
  // Step 1: column + table retrieval in parallel (independent embedding models)
  const [cols, tabs] = await Promise.all([
    retrieveColumns(pool, connectionId, question, opts.columnTopK ?? 40),
    retrieveTables(pool, connectionId, question, opts.tableTopK ?? 10),
  ]);

  // Step 2: Table selection (LLM)
  const sel = await selectTables(question, cols, tabs);

  // Step 2b: FK 1-hop expansion (only if FK edges exist between selected tables and candidates)
  const expanded = expandFkOneHop(sel.tables, fkEdges).filter((t) => {
    // Only include expanded tables if they appeared in retrieval (otherwise too noisy)
    return sel.tables.includes(t) || cols.some((c) => c.table === t) || tabs.some((rt) => rt.table === t);
  });

  // Step 3: Build compact schema cards (use ALL columns of selected tables if we have them)
  const schemaCards = buildSchemaCards(expanded, cols);

  return {
    selectedTables: expanded,
    schemaCards,
    retrieval: { columnTopK: cols, tableTopK: tabs },
    durationMs: Date.now() - start,
  };
}
