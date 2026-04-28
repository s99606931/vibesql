// LLM provider router — selects provider based on env
// Default: LM Studio (local). Fallback: Anthropic Claude.

import { getLMStudio, LMSTUDIO_MODELS } from "./lmstudio";
import { type LLMProvider } from "./provider";

export { LMSTUDIO_MODELS };
export type { LLMProvider, ChatMessage, ChatOptions, ChatResult, EmbeddingOptions, EmbeddingResult } from "./provider";

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;
  // Strategy: prefer LM Studio if configured. Anthropic fallback wired in later phases.
  if (process.env.LMSTUDIO_BASE_URL) {
    cached = getLMStudio();
    return cached;
  }
  throw new Error(
    "No LLM provider configured. Set LMSTUDIO_BASE_URL or ANTHROPIC_API_KEY in apps/web/.env.local",
  );
}

export function resetLLMCache() {
  cached = null;
}
