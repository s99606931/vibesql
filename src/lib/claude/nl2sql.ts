import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface Nl2SqlOptions {
  nl: string;
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  schemaContext: string; // DDL or description of available tables
  glossary?: string; // business term definitions
}

export interface Nl2SqlResult {
  sql: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

const DIALECT_HINTS: Record<string, string> = {
  postgresql:
    "Use PostgreSQL syntax. Use LIMIT not TOP. Use ILIKE for case-insensitive matching.",
  mysql:
    "Use MySQL syntax. Use LIMIT not TOP. Use IFNULL not COALESCE when possible.",
  sqlite:
    "Use SQLite syntax. No FULL OUTER JOIN. Use strftime for dates.",
  mssql:
    "Use SQL Server syntax. Use TOP not LIMIT. Use GETDATE() not NOW().",
  oracle:
    "Use Oracle syntax. Use ROWNUM or FETCH FIRST for limiting rows.",
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

export async function generateSql(options: Nl2SqlOptions): Promise<Nl2SqlResult> {
  const { nl, dialect, schemaContext, glossary } = options;

  const systemPrompt = `You are an expert SQL generator for ${dialect} databases.
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

  // Wrap user input in XML tags to prevent prompt injection
  const userPrompt = `Convert this natural language request to ${dialect} SQL:
<query>${nl.replace(/<\/?query>/g, "")}</query>

Respond in JSON format:
{
  "sql": "SELECT ...",
  "explanation": "brief explanation in Korean",
  "confidence": "high|medium|low",
  "warnings": ["optional warning if query might be slow or return too many rows"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  // Extract JSON from response (Claude might wrap in code blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

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

export async function* generateSqlStream(
  options: Nl2SqlOptions
): AsyncGenerator<string> {
  const { nl, dialect, schemaContext, glossary } = options;

  const systemPrompt = `You are an expert SQL generator for ${dialect} databases.
${DIALECT_HINTS[dialect] ?? ""}
Available schema:\n${schemaContext}
${glossary ? `Business terms:\n${glossary}` : ""}
Generate ONLY SELECT queries. Return raw SQL with no markdown fences.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: `Convert to ${dialect} SQL: "${nl}"` }],
    system: systemPrompt,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
