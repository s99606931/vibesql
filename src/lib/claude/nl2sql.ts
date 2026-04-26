/**
 * LLM provider abstraction — supports:
 *   1. LM Studio (OpenAI-compatible)  → LMSTUDIO_BASE_URL + LMSTUDIO_API_KEY + LMSTUDIO_MODEL
 *   2. Anthropic Claude              → ANTHROPIC_API_KEY
 *
 * LM Studio takes priority when LMSTUDIO_BASE_URL is set.
 */

export interface Nl2SqlOptions {
  nl: string;
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  schemaContext: string;
  glossary?: string;
}

export interface Nl2SqlResult {
  sql: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

const DIALECT_HINTS: Record<string, string> = {
  postgresql: "Use PostgreSQL syntax. Use LIMIT not TOP. Use ILIKE for case-insensitive matching.",
  mysql:      "Use MySQL syntax. Use LIMIT not TOP. Use IFNULL not COALESCE when possible.",
  sqlite:     "Use SQLite syntax. No FULL OUTER JOIN. Use strftime for dates.",
  mssql:      "Use SQL Server syntax. Use TOP not LIMIT. Use GETDATE() not NOW().",
  oracle:     "Use Oracle syntax. Use ROWNUM or FETCH FIRST for limiting rows.",
};

function isNl2SqlResult(value: unknown): value is Nl2SqlResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sql === "string" &&
    typeof v.explanation === "string" &&
    (v.confidence === "high" || v.confidence === "medium" || v.confidence === "low")
  );
}

function buildPrompts(options: Nl2SqlOptions): { system: string; user: string } {
  const { nl, dialect, schemaContext, glossary } = options;

  const system = `You are an expert SQL generator for ${dialect} databases.
${DIALECT_HINTS[dialect] ?? ""}

Rules:
1. Generate ONLY SELECT queries (read-only)
2. Return valid, executable ${dialect} SQL
3. Use proper JOINs when needed
4. Add helpful comments for complex queries
5. Keep queries efficient — avoid SELECT *

Available schema:
${schemaContext}
${glossary ? `\nBusiness terms:\n${glossary}` : ""}`;

  const user = `Convert this natural language request to ${dialect} SQL:
<query>${nl.replace(/<\/?query>/g, "")}</query>

Respond ONLY in JSON format (no markdown, no explanation outside JSON):
{
  "sql": "SELECT ...",
  "explanation": "brief explanation in Korean",
  "confidence": "high|medium|low",
  "warnings": ["optional warning"]
}`;

  return { system, user };
}

function extractJson(text: string): Nl2SqlResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in model response");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]) as unknown;
  } catch {
    throw new Error("Failed to parse JSON from model response");
  }
  if (!isNl2SqlResult(parsed)) {
    throw new Error("Model response did not match expected schema");
  }
  return parsed;
}

// ── LM Studio (OpenAI-compatible) ──────────────────────────────────────────

interface OaiMessage { role: "system" | "user" | "assistant"; content: string; }
interface OaiChoice { message: OaiMessage; }
interface OaiResponse { choices: OaiChoice[]; }

async function generateWithLmStudio(options: Nl2SqlOptions): Promise<Nl2SqlResult> {
  const baseUrl = process.env.LMSTUDIO_BASE_URL!.replace(/\/$/, "");
  const apiKey  = process.env.LMSTUDIO_API_KEY ?? "lm-studio";
  const model   = process.env.LMSTUDIO_MODEL   ?? "local-model";

  const { system, user } = buildPrompts(options);

  const messages: OaiMessage[] = [
    { role: "system",    content: system },
    { role: "user",      content: user   },
  ];

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LM Studio error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as OaiResponse;
  const text = json.choices?.[0]?.message?.content ?? "";
  return extractJson(text);
}

// ── Anthropic Claude ────────────────────────────────────────────────────────

async function generateWithAnthropic(options: Nl2SqlOptions): Promise<Nl2SqlResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const { system, user } = buildPrompts(options);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: user }],
    system,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return extractJson(content.text);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateSql(options: Nl2SqlOptions): Promise<Nl2SqlResult> {
  if (process.env.LMSTUDIO_BASE_URL) {
    return generateWithLmStudio(options);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithAnthropic(options);
  }
  throw new Error(
    "LLM not configured. Set LMSTUDIO_BASE_URL (+ LMSTUDIO_API_KEY, LMSTUDIO_MODEL) or ANTHROPIC_API_KEY in .env.local"
  );
}

export async function* generateSqlStream(
  options: Nl2SqlOptions
): AsyncGenerator<string> {
  // For now, non-streaming fallback — yield full result as one chunk
  const result = await generateSql(options);
  yield result.sql;
}
