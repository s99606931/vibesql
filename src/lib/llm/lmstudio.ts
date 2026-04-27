// LM Studio provider — uses OpenAI-compatible REST API
// Endpoint: ${LMSTUDIO_BASE_URL}/v1/{chat/completions, embeddings, models}

import OpenAI from "openai";
import {
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type EmbeddingOptions,
  type EmbeddingResult,
  type LLMProvider,
  LLMProviderError,
} from "./provider";

export interface LMStudioConfig {
  baseUrl: string;
  apiKey: string;
  defaultChatModel?: string;
  defaultColumnEmbedModel?: string;
  defaultTableEmbedModel?: string;
}

export class LMStudioProvider implements LLMProvider {
  readonly name = "lmstudio";
  private client: OpenAI;
  private config: LMStudioConfig;

  constructor(config: LMStudioConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: `${config.baseUrl.replace(/\/+$/, "")}/v1`,
      apiKey: config.apiKey || "lm-studio",
      timeout: 120_000,
      maxRetries: 1,
    });
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const start = Date.now();
    // Same retry strategy as embed: cold model swap can return 500
    const maxAttempts = 3;
    const backoffMs = [0, 3000, 8000];
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, backoffMs[attempt - 1] ?? 8000));
      }
      try {
        // Note: LM Studio rejects `response_format: { type: "json_object" }`.
        // We rely on prompt-level JSON instructions and lenient parsing in callers.
        const resp = await this.client.chat.completions.create(
          {
            model: opts.model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: opts.temperature ?? 0.3,
            max_tokens: opts.maxTokens ?? 2048,
          },
          { signal: opts.signal },
        );
        const choice = resp.choices[0];
        const content = choice?.message?.content ?? "";
        const usage = resp.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        return {
          content,
          usage: {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          },
          durationMs: Date.now() - start,
          model: resp.model ?? opts.model,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw new LLMProviderError(
      `LM Studio chat failed after ${maxAttempts} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
      this.name,
      lastErr,
    );
  }

  async embed(texts: string[], opts: EmbeddingOptions): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], usage: { totalTokens: 0 }, model: opts.model, dimensions: 0 };
    }
    // LM Studio just-in-time loads models; cold swap can return 500.
    // Retry with longer backoff (model load can take 5-15s).
    const maxAttempts = 4;
    const backoffMs = [0, 2000, 5000, 10000];
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, backoffMs[attempt - 1] ?? 10000));
      }
      try {
        const resp = await this.client.embeddings.create(
          { model: opts.model, input: texts },
          { signal: opts.signal },
        );
        const embeddings = resp.data.map((d) => d.embedding as number[]);
        return {
          embeddings,
          usage: { totalTokens: resp.usage?.total_tokens ?? 0 },
          model: resp.model ?? opts.model,
          dimensions: embeddings[0]?.length ?? 0,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw new LLMProviderError(
      `LM Studio embed failed after ${maxAttempts} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
      this.name,
      lastErr,
    );
  }

  async listModels(): Promise<string[]> {
    try {
      const resp = await this.client.models.list();
      return resp.data.map((m) => m.id);
    } catch (err) {
      throw new LLMProviderError(
        `LM Studio listModels failed: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
        err,
      );
    }
  }
}

// Singleton accessor
let defaultProvider: LMStudioProvider | null = null;

export function getLMStudio(): LMStudioProvider {
  if (defaultProvider) return defaultProvider;
  const baseUrl = process.env.LMSTUDIO_BASE_URL;
  const apiKey = process.env.LMSTUDIO_API_KEY ?? "lm-studio";
  if (!baseUrl) {
    throw new LLMProviderError(
      "LMSTUDIO_BASE_URL is not set. Add it to apps/web/.env.local",
      "lmstudio",
    );
  }
  defaultProvider = new LMStudioProvider({
    baseUrl,
    apiKey,
    defaultChatModel: process.env.LMSTUDIO_MODEL ?? "gemma-4-e4b-it",
    defaultColumnEmbedModel:
      process.env.LMSTUDIO_EMBED_COLUMN_MODEL ?? "text-embedding-nomic-embed-text-v1.5",
    defaultTableEmbedModel:
      process.env.LMSTUDIO_EMBED_TABLE_MODEL ?? "text-embedding-qwen3-embedding-0.6b",
  });
  return defaultProvider;
}

// Model selection driven by env to allow quick swapping (large = better quality, small = faster).
// Default to mid-size for M1 baseline measurement (large 27B is too slow on cold load).
export const LMSTUDIO_MODELS = {
  LINKER: process.env.LMSTUDIO_MODEL_LINKER ?? "gemma-4-e4b-it",
  GENERATOR_PRIMARY: process.env.LMSTUDIO_MODEL_GENERATOR ?? "qwen/qwen3.5-9b",
  GENERATOR_BACKUP: process.env.LMSTUDIO_MODEL_GENERATOR_BACKUP ?? "google/gemma-4-26b-a4b",
  REFINER: process.env.LMSTUDIO_MODEL_REFINER ?? "qwen/qwen3.5-9b",
  EMBED_TABLE: process.env.LMSTUDIO_EMBED_TABLE_MODEL ?? "text-embedding-qwen3-embedding-0.6b",
  EMBED_COLUMN: process.env.LMSTUDIO_EMBED_COLUMN_MODEL ?? "text-embedding-nomic-embed-text-v1.5",
} as const;
