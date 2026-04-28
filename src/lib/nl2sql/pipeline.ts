// NL2SQL Pipeline orchestrator
// Combines: linker → generator → validator → refiner
// Design Ref: docs/02-design/features/nl2sql-architecture.design.md §2

import { Pool } from "pg";
import { runLinker } from "../linker";
import { generate, type GeneratorOutput } from "../llm/generator";
import {
  validateSql,
  buildCatalog,
  type SchemaCatalog,
  type SqlDialect,
  type ValidationResult,
} from "../sql/validate";
import type { FkEdge } from "../schema/introspect-pg";

export interface PipelineInput {
  connectionId: string;
  question: string;
  dialect: SqlDialect;
  catalog: SchemaCatalog;     // for whitelist
  fkEdges: FkEdge[];
  glossary?: string;
  pool: Pool;
}

export interface PipelineOutput {
  sql: string;
  rationale: string;
  usedTables: string[];
  usedColumns: string[];
  confidence: number;
  needsClarification: boolean;
  validation: ValidationResult;
  refinerAttempts: number;
  status: "success" | "validation_failed" | "refiner_exhausted" | "linker_failed";
  errors: string[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  // Stage outputs (for audit_traces)
  trace: {
    linker: { selectedTables: string[]; durationMs: number };
    generator: { durationMs: number; inputTokens: number; outputTokens: number };
    validation: ValidationResult;
  };
}

const MAX_REFINER_ATTEMPTS = 2;

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const start = Date.now();
  const errors: string[] = [];
  let refinerAttempts = 0;

  // Stage 1: Linker
  let linker;
  try {
    linker = await runLinker(input.pool, input.connectionId, input.question, input.fkEdges);
  } catch (err) {
    return {
      sql: "",
      rationale: "",
      usedTables: [],
      usedColumns: [],
      confidence: 0,
      needsClarification: false,
      validation: { valid: false, tables: [], columns: [], errors: [{ code: "PARSE_FAILED", message: "linker_failed" }] },
      refinerAttempts: 0,
      status: "linker_failed",
      errors: [`linker: ${err instanceof Error ? err.message : String(err)}`],
      durationMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      trace: {
        linker: { selectedTables: [], durationMs: 0 },
        generator: { durationMs: 0, inputTokens: 0, outputTokens: 0 },
        validation: { valid: false, tables: [], columns: [], errors: [] },
      },
    };
  }

  // Stage 2: Generator (initial)
  let gen: GeneratorOutput = await generate({
    question: input.question,
    schemaCards: linker.schemaCards,
    dialect: input.dialect,
    glossary: input.glossary,
  });

  let validation = validateSql(gen.sql, input.dialect, input.catalog);

  // Stage 3: Self-correct refiner (up to MAX_REFINER_ATTEMPTS)
  while (!validation.valid && refinerAttempts < MAX_REFINER_ATTEMPTS) {
    const errHint = validation.errors.map((e) => `${e.code}: ${e.message}`).join("; ");
    refinerAttempts++;
    const refined = await generate({
      question: input.question,
      schemaCards: linker.schemaCards,
      dialect: input.dialect,
      glossary: input.glossary,
      errorHint: errHint,
      previousSql: gen.sql,
    });
    gen = refined;
    validation = validateSql(gen.sql, input.dialect, input.catalog);
  }

  let status: PipelineOutput["status"];
  if (validation.valid) {
    status = "success";
  } else if (refinerAttempts >= MAX_REFINER_ATTEMPTS) {
    status = "refiner_exhausted";
  } else {
    status = "validation_failed";
  }

  return {
    sql: gen.sql,
    rationale: gen.rationale,
    usedTables: gen.usedTables,
    usedColumns: gen.usedColumns,
    confidence: gen.confidence,
    needsClarification: gen.needsClarification,
    validation,
    refinerAttempts,
    status,
    errors,
    durationMs: Date.now() - start,
    inputTokens: gen.inputTokens,
    outputTokens: gen.outputTokens,
    trace: {
      linker: { selectedTables: linker.selectedTables, durationMs: linker.durationMs },
      generator: { durationMs: gen.durationMs, inputTokens: gen.inputTokens, outputTokens: gen.outputTokens },
      validation,
    },
  };
}

export { buildCatalog };
