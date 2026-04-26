/**
 * LLM provider abstraction — supports:
 *   1. DB-configured AiProvider (active provider from settings menu)
 *   2. LM Studio (OpenAI-compatible)  → LMSTUDIO_BASE_URL env var
 *   3. Anthropic Claude              → ANTHROPIC_API_KEY env var
 *
 * DB-configured provider takes priority when DATABASE_URL is set.
 */

export interface Nl2SqlOptions {
  nl: string;
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  schemaContext: string;
  glossary?: string;
  userId?: string;
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

export function buildPrompts(options: Nl2SqlOptions): { system: string; user: string } {
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

export function extractJson(text: string): Nl2SqlResult {
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

// ── OpenAI-compatible (LM Studio / Ollama / vLLM / openai_compat / OpenAI) ──

interface OaiMessage { role: "system" | "user" | "assistant"; content: string; }
interface OaiChoice { message: OaiMessage; }
interface OaiResponse { choices: OaiChoice[]; }

async function generateWithOpenAiCompat(
  options: Nl2SqlOptions,
  baseUrl: string,
  apiKey: string | null,
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<Nl2SqlResult> {
  const { system, user } = buildPrompts(options);
  const url = baseUrl.replace(/\/$/, "");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Provider error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = (await res.json()) as OaiResponse;
  const text = json.choices?.[0]?.message?.content ?? "";
  return extractJson(text);
}

// ── Google AI Studio (Gemini) ───────────────────────────────────────────────

async function generateWithGoogle(
  options: Nl2SqlOptions,
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<Nl2SqlResult> {
  const { system, user } = buildPrompts(options);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI error ${res.status}: ${err.slice(0, 200)}`);
  }

  interface GeminiResponse {
    candidates: { content: { parts: { text: string }[] } }[];
  }
  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return extractJson(text);
}

// ── Anthropic Claude ────────────────────────────────────────────────────────

async function generateWithAnthropic(
  options: Nl2SqlOptions,
  apiKey: string | null,
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<Nl2SqlResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: apiKey ?? undefined });
  const { system, user } = buildPrompts(options);

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: user }],
    system,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return extractJson(content.text);
}

// ── Active DB provider lookup ───────────────────────────────────────────────

interface DbProvider {
  type: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
}

async function getActiveProvider(userId?: string): Promise<DbProvider | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const where = userId
      ? { userId, isActive: true }
      : { isActive: true };
    const provider = await prisma.aiProvider.findFirst({ where });
    return provider as DbProvider | null;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateSql(options: Nl2SqlOptions): Promise<Nl2SqlResult> {
  // 1. Try DB-configured active provider
  const dbProvider = await getActiveProvider(options.userId);
  if (dbProvider) {
    const { type, baseUrl, apiKey, model, temperature, maxTokens } = dbProvider;

    if (type === "anthropic") {
      return generateWithAnthropic(options, apiKey, model, temperature, maxTokens);
    }
    if (type === "google") {
      if (!apiKey) throw new Error("Google AI 프로바이더에 API 키가 없습니다.");
      return generateWithGoogle(options, apiKey, model, temperature, maxTokens);
    }
    // openai | lmstudio | ollama | vllm | openai_compat
    if (!baseUrl && type !== "openai") throw new Error(`${type} 프로바이더에 Base URL이 없습니다.`);
    const url = baseUrl ?? "https://api.openai.com";
    return generateWithOpenAiCompat(options, url, apiKey, model, temperature, maxTokens);
  }

  // 2. Legacy env-var fallback
  if (process.env.LMSTUDIO_BASE_URL) {
    return generateWithOpenAiCompat(
      options,
      process.env.LMSTUDIO_BASE_URL,
      process.env.LMSTUDIO_API_KEY ?? "lm-studio",
      process.env.LMSTUDIO_MODEL ?? "local-model",
      0.2,
      1024,
    );
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithAnthropic(options, null, "claude-sonnet-4-6", 0.3, 1024);
  }

  throw new Error(
    "AI 프로바이더가 설정되지 않았습니다. 설정 > AI 프로바이더 메뉴에서 프로바이더를 추가하세요."
  );
}

export async function* generateSqlStream(
  options: Nl2SqlOptions
): AsyncGenerator<string> {
  const result = await generateSql(options);
  yield result.sql;
}
