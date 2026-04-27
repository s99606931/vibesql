// SQL Generator — calls LM Studio with schema cards, returns structured JSON.
// Design Ref: docs/01-plan/features/nl2sql-architecture.plan.md §3 Phase D-1

import { getLLM, LMSTUDIO_MODELS, type ChatMessage } from "../llm";

export interface GeneratorInput {
  question: string;
  schemaCards: string;       // from linker
  dialect: string;           // "postgresql" | "mysql" | ...
  glossary?: string;          // optional, key/value lines
  fewShotExamples?: Array<{ question: string; sql: string }>;
  errorHint?: string;         // populated by refiner on retry
  previousSql?: string;       // populated by refiner on retry
  now?: string;
}

export interface GeneratorOutput {
  sql: string;
  rationale: string;
  usedTables: string[];
  usedColumns: string[];
  confidence: number;
  needsClarification: boolean;
  raw: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = (dialect: string) => `You are a senior data analyst. Generate a single, safe, read-only SELECT statement to answer the user's question.

CONSTRAINTS:
- Dialect: ${dialect}
- ONLY SELECT statements. NO INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/COPY.
- Use ONLY tables/columns shown in the provided schema. Do NOT invent identifiers.
- Add LIMIT 1000 for unbounded queries.
- Use proper joins via existing FK columns when crossing tables.
- For dates, use the dialect's standard functions.

OUTPUT FORMAT — Strict JSON ONLY:
{
  "sql": "SELECT ...",
  "rationale": "1-2 sentence explanation of the approach (in the user's language)",
  "used_tables": ["table1", "table2"],
  "used_columns": ["table1.col1", "table2.col2"],
  "confidence": 0.0-1.0,
  "needs_clarification": false
}

If the question is too ambiguous to answer confidently, set "needs_clarification": true and explain in rationale.`;

export async function generate(input: GeneratorInput): Promise<GeneratorOutput> {
  const llm = getLLM();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT(input.dialect) },
  ];

  const userParts: string[] = [];
  userParts.push("## Available Schema");
  userParts.push(input.schemaCards);
  if (input.glossary) {
    userParts.push("\n## Glossary");
    userParts.push(input.glossary);
  }
  if (input.fewShotExamples && input.fewShotExamples.length > 0) {
    userParts.push("\n## Examples");
    for (const ex of input.fewShotExamples.slice(0, 3)) {
      userParts.push(`Q: ${ex.question}\nSQL: ${ex.sql}`);
    }
  }
  if (input.errorHint && input.previousSql) {
    userParts.push("\n## Previous attempt (failed)");
    userParts.push(`SQL: ${input.previousSql}`);
    userParts.push(`Error: ${input.errorHint}`);
    userParts.push("Fix the issue. Do not repeat the same mistake.");
  }
  userParts.push(`\n## Question\n${input.question}`);
  userParts.push(`\n## Now\n${input.now ?? new Date().toISOString().slice(0, 10)}`);
  userParts.push("\nReturn ONLY the JSON object.");

  messages.push({ role: "user", content: userParts.join("\n") });

  const res = await llm.chat(messages, {
    model: LMSTUDIO_MODELS.GENERATOR_PRIMARY,
    temperature: 0.2,
    maxTokens: 1024,
    jsonMode: true,
  });

  // Parse JSON, lenient
  let parsed: Partial<{
    sql: string;
    rationale: string;
    used_tables: string[];
    used_columns: string[];
    confidence: number;
    needs_clarification: boolean;
  }> = {};
  try {
    parsed = JSON.parse(res.content);
  } catch {
    const m = res.content.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
    }
  }

  return {
    sql: typeof parsed.sql === "string" ? parsed.sql.trim() : "",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    usedTables: Array.isArray(parsed.used_tables) ? parsed.used_tables.filter((x): x is string => typeof x === "string") : [],
    usedColumns: Array.isArray(parsed.used_columns) ? parsed.used_columns.filter((x): x is string => typeof x === "string") : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    needsClarification: parsed.needs_clarification === true,
    raw: res.content,
    durationMs: res.durationMs,
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
  };
}
