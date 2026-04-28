// NL2SQL Evaluation Runner
// Loads golden set, runs through generator pipeline, scores results.
// Design Ref: docs/01-plan/features/nl2sql-architecture.plan.md §3 Phase A-2

import * as fs from "node:fs";
import * as path from "node:path";
import {
  normalizeSqlForCompare,
  buildCatalog,
  type SqlDialect,
  type ValidationResult,
} from "../sql/validate";

export interface GoldenItem {
  goldenId: string;
  language: "ko" | "en";
  dialect: SqlDialect;
  schemaFixture: string;
  category: string;
  question: string;
  expectedTables: string[];
  expectedColumnsMust: string[];
  expectedSql?: string;
  validator: "ast_normalize_match" | "result_set_match" | "row_count_match" | "column_subset_match";
  notes?: string;
}

export interface PipelineRunner {
  /**
   * Generate SQL from a natural-language question.
   * The pipeline must use the same connection/schema fixture as golden item.
   */
  generate(item: GoldenItem): Promise<{
    sql: string;
    rationale?: string;
    usedTables?: string[];
    usedColumns?: string[];
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    refinerAttempts: number;
    validation?: ValidationResult;
    pipelineErrors?: string[]; // surface upstream errors (linker/embed/etc)
  }>;
}

export interface ScoredResult {
  goldenId: string;
  language: string;
  category: string;
  question: string;
  expected: { tables: string[]; columnsMust: string[]; sql?: string };
  actual: { sql: string; tables: string[]; columns: string[] };
  // Scoring axes
  tableMatch: boolean;          // expectedTables ⊆ actualTables
  columnsMatch: boolean;        // expectedColumnsMust ⊆ actualColumns (any case-insensitive)
  astMatch: boolean | null;     // null when no expectedSql
  validationOk: boolean;
  hallucinationFound: boolean;  // any UNKNOWN_TABLE / UNKNOWN_COLUMN
  // Final pass/fail (depends on validator type)
  pass: boolean;
  // Metrics
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  refinerAttempts: number;
  errors: string[];
}

export interface EvalReport {
  startedAt: string;
  durationMs: number;
  totalItems: number;
  passed: number;
  failed: number;
  passRate: number;
  hallucinationRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byCategory: Record<string, { total: number; passed: number; passRate: number }>;
  byLanguage: Record<string, { total: number; passed: number; passRate: number }>;
  results: ScoredResult[];
  meta: {
    runner: string;
    nodeEnv: string;
    promptVersion?: string;
  };
}

export function loadGoldenSet(file: string): GoldenItem[] {
  const raw = fs.readFileSync(file, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse golden set ${file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Golden set ${file} must be a JSON array`);
  }
  // Validate minimum required fields
  for (const item of parsed) {
    if (
      !item || typeof item !== "object" ||
      typeof (item as GoldenItem).goldenId !== "string" ||
      typeof (item as GoldenItem).question !== "string" ||
      !Array.isArray((item as GoldenItem).expectedTables)
    ) {
      throw new Error(`Invalid GoldenItem shape in ${file}: ${JSON.stringify(item).slice(0, 200)}`);
    }
  }
  return parsed as GoldenItem[];
}

export async function runEvaluation(
  items: GoldenItem[],
  runner: PipelineRunner,
  opts: { promptVersion?: string } = {},
): Promise<EvalReport> {
  const startedAt = Date.now();
  const results: ScoredResult[] = [];

  for (const item of items) {
    let scored: ScoredResult;
    try {
      const out = await runner.generate(item);
      scored = scoreItem(item, out);
    } catch (err) {
      scored = {
        goldenId: item.goldenId,
        language: item.language,
        category: item.category,
        question: item.question,
        expected: { tables: item.expectedTables, columnsMust: item.expectedColumnsMust, sql: item.expectedSql },
        actual: { sql: "", tables: [], columns: [] },
        tableMatch: false,
        columnsMatch: false,
        astMatch: null,
        validationOk: false,
        hallucinationFound: false,
        pass: false,
        durationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        refinerAttempts: 0,
        errors: [`runner_error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    results.push(scored);
  }

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;

  const byCategory: Record<string, { total: number; passed: number; passRate: number }> = {};
  const byLanguage: Record<string, { total: number; passed: number; passRate: number }> = {};
  for (const r of results) {
    byCategory[r.category] ??= { total: 0, passed: 0, passRate: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].passed++;
    byLanguage[r.language] ??= { total: 0, passed: 0, passRate: 0 };
    byLanguage[r.language].total++;
    if (r.pass) byLanguage[r.language].passed++;
  }
  for (const k of Object.keys(byCategory)) {
    byCategory[k].passRate = byCategory[k].total > 0 ? byCategory[k].passed / byCategory[k].total : 0;
  }
  for (const k of Object.keys(byLanguage)) {
    byLanguage[k].passRate = byLanguage[k].total > 0 ? byLanguage[k].passed / byLanguage[k].total : 0;
  }

  return {
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    totalItems: total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? passed / total : 0,
    hallucinationRate:
      total > 0 ? results.filter((r) => r.hallucinationFound).length / total : 0,
    p50DurationMs: durations[Math.floor(durations.length / 2)] ?? 0,
    p95DurationMs: durations[Math.floor(durations.length * 0.95)] ?? 0,
    totalInputTokens: results.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: results.reduce((s, r) => s + r.outputTokens, 0),
    byCategory,
    byLanguage,
    results,
    meta: {
      runner: "vibesql-eval-runner",
      nodeEnv: process.env.NODE_ENV ?? "development",
      promptVersion: opts.promptVersion,
    },
  };
}

function scoreItem(
  item: GoldenItem,
  out: Awaited<ReturnType<PipelineRunner["generate"]>>,
): ScoredResult {
  const errors: string[] = [];
  const expectedTablesLower = item.expectedTables.map((t) => t.toLowerCase());
  const actualTables = out.usedTables ?? [];
  const actualTablesLower = actualTables.map((t) => t.toLowerCase());

  const expectedColumnsLower = item.expectedColumnsMust.map((c) => c.toLowerCase());
  const actualColumns = out.usedColumns ?? [];
  const actualColumnsLower = actualColumns.map((c) => c.toLowerCase());

  const tableMatch = expectedTablesLower.every((t) =>
    actualTablesLower.some((a) => a === t || a.endsWith(`.${t}`)),
  );

  const columnsMatch = expectedColumnsLower.every((cExpected) => {
    return actualColumnsLower.some((cActual) => {
      // expected may be "customers.name", actual may be "customers.name" or "name"
      if (cActual === cExpected) return true;
      // Match if expected = "customers.name" and actual ends with .name AND from a related table
      const [, colName] = cExpected.includes(".") ? cExpected.split(".") : [null, cExpected];
      return cActual === colName || cActual.endsWith(`.${colName}`);
    });
  });

  let astMatch: boolean | null = null;
  if (item.expectedSql) {
    const a = normalizeSqlForCompare(out.sql, item.dialect);
    const b = normalizeSqlForCompare(item.expectedSql, item.dialect);
    astMatch = a != null && b != null && a === b;
  }

  // Validation pass = parse OK + valid SELECT + no forbidden function
  // hallucination = unknown_table OR unknown_column errors (only computed if catalog provided)
  const validation = out.validation;
  const validationOk = validation ? validation.valid : true;
  const hallucinationFound = validation
    ? validation.errors.some(
        (e) => e.code === "UNKNOWN_TABLE" || e.code === "UNKNOWN_COLUMN",
      )
    : false;

  if (validation?.errors) {
    for (const e of validation.errors) errors.push(`${e.code}: ${e.message}`);
  }
  // Surface upstream pipeline errors (e.g., linker LLM/embed failures)
  if (out.pipelineErrors) {
    for (const e of out.pipelineErrors) errors.push(`pipeline: ${e}`);
  }

  // Pass logic per validator
  let pass = false;
  switch (item.validator) {
    case "ast_normalize_match":
      pass = astMatch === true && !hallucinationFound;
      break;
    case "column_subset_match":
      pass = tableMatch && columnsMatch && !hallucinationFound && validationOk;
      break;
    case "row_count_match":
    case "result_set_match":
      // Without execution we approximate: must hit expected tables + columns + no hallucination
      pass = tableMatch && columnsMatch && !hallucinationFound && validationOk;
      break;
  }

  return {
    goldenId: item.goldenId,
    language: item.language,
    category: item.category,
    question: item.question,
    expected: {
      tables: item.expectedTables,
      columnsMust: item.expectedColumnsMust,
      sql: item.expectedSql,
    },
    actual: { sql: out.sql, tables: actualTables, columns: actualColumns },
    tableMatch,
    columnsMatch,
    astMatch,
    validationOk,
    hallucinationFound,
    pass,
    durationMs: out.durationMs,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    refinerAttempts: out.refinerAttempts,
    errors,
  };
}

export function writeReport(report: EvalReport, outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = report.startedAt.replace(/[:.]/g, "-");
  const file = path.join(outDir, `${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

export function summarizeReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(70));
  lines.push(`NL2SQL Evaluation Report — ${report.startedAt}`);
  lines.push("=".repeat(70));
  lines.push(`Items:        ${report.totalItems}`);
  lines.push(`Passed:       ${report.passed}  (${(report.passRate * 100).toFixed(1)}%)`);
  lines.push(`Failed:       ${report.failed}`);
  lines.push(`Hallucination: ${(report.hallucinationRate * 100).toFixed(1)}%`);
  lines.push(`p50 / p95:    ${report.p50DurationMs}ms / ${report.p95DurationMs}ms`);
  lines.push(`Tokens (in/out): ${report.totalInputTokens} / ${report.totalOutputTokens}`);
  lines.push(`Total runtime: ${(report.durationMs / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push("By Category:");
  for (const [k, v] of Object.entries(report.byCategory)) {
    lines.push(`  ${k.padEnd(15)} ${v.passed}/${v.total} (${(v.passRate * 100).toFixed(0)}%)`);
  }
  lines.push("By Language:");
  for (const [k, v] of Object.entries(report.byLanguage)) {
    lines.push(`  ${k.padEnd(15)} ${v.passed}/${v.total} (${(v.passRate * 100).toFixed(0)}%)`);
  }
  lines.push("");
  lines.push("Failed items:");
  const fails = report.results.filter((r) => !r.pass).slice(0, 10);
  for (const f of fails) {
    lines.push(`  ✗ ${f.goldenId} [${f.category}] ${f.question.slice(0, 50)}`);
    if (f.errors.length > 0) lines.push(`      ${f.errors.slice(0, 2).join(" / ")}`);
    if (!f.tableMatch) lines.push(`      table mismatch: expected=${f.expected.tables.join(",")} actual=${f.actual.tables.join(",")}`);
  }
  return lines.join("\n");
}

export { buildCatalog };
