// LLM Provider interface — abstracts Claude / LM Studio / OpenAI / Ollama
// Design Ref: docs/02-design/features/nl2sql-architecture.design.md DR-4

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  thinkingBudget?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  thinking?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  model: string;
}

export interface EmbeddingOptions {
  model: string;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  embeddings: number[][];
  usage: { totalTokens: number };
  model: string;
  dimensions: number;
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult>;
  embed(texts: string[], opts: EmbeddingOptions): Promise<EmbeddingResult>;
  listModels?(): Promise<string[]>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
