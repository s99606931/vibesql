// AuditTrace persistence — records full NL2SQL pipeline trace for debugging/auditing.
// Design Ref: docs/02-design/features/nl2sql-architecture.design.md DR-1

import { Pool } from "pg";

export interface TraceRecord {
  userId?: string | null;
  connectionId?: string | null;
  question: string;
  language?: string | null;
  promptVersion?: string | null;
  // Stage outputs
  clarification?: unknown;
  linkerInput?: unknown;
  linkerOutput?: unknown;
  generatorInput?: unknown;
  generatorOutput?: unknown;
  sql?: string | null;
  rationale?: string | null;
  validationResult?: unknown;
  executionResult?: unknown;
  refinerAttempts?: number;
  // Metrics
  tokenInputTotal?: number;
  tokenOutputTotal?: number;
  durationMs?: number;
  status:
    | "success"
    | "clarification_needed"
    | "linker_failed"
    | "validation_failed"
    | "execution_failed"
    | "refiner_exhausted";
  errorMessage?: string | null;
}

export async function persistTrace(pool: Pool, rec: TraceRecord): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO audit_traces (
      id, user_id, connection_id, question, language, prompt_version,
      clarification, linker_input, linker_output, generator_input, generator_output,
      sql, rationale, validation_result, execution_result,
      refiner_attempts, token_input_total, token_output_total, duration_ms,
      status, error_message, created_at
    ) VALUES (
      gen_random_uuid()::text, $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17, $18,
      $19, $20, NOW()
    ) RETURNING id`,
    [
      rec.userId ?? null,
      rec.connectionId ?? null,
      rec.question,
      rec.language ?? null,
      rec.promptVersion ?? null,
      rec.clarification ? JSON.stringify(rec.clarification) : null,
      rec.linkerInput ? JSON.stringify(rec.linkerInput) : null,
      rec.linkerOutput ? JSON.stringify(rec.linkerOutput) : null,
      rec.generatorInput ? JSON.stringify(rec.generatorInput) : null,
      rec.generatorOutput ? JSON.stringify(rec.generatorOutput) : null,
      rec.sql ?? null,
      rec.rationale ?? null,
      rec.validationResult ? JSON.stringify(rec.validationResult) : null,
      rec.executionResult ? JSON.stringify(rec.executionResult) : null,
      rec.refinerAttempts ?? 0,
      rec.tokenInputTotal ?? null,
      rec.tokenOutputTotal ?? null,
      rec.durationMs ?? null,
      rec.status,
      rec.errorMessage ?? null,
    ],
  );
  return res.rows[0].id;
}
