/**
 * In-memory AI provider store shared across all API routes.
 * Persists to .bkit/state/ai-providers.json so hot-reloads don't wipe state.
 */
import fs from "fs";
import path from "path";

export type AiProviderType =
  | "anthropic"
  | "openai"
  | "google"
  | "lmstudio"
  | "ollama"
  | "vllm"
  | "openai_compat";

export interface MemAiProvider {
  id: string;
  userId: string;
  name: string;
  type: AiProviderType;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestedOk: boolean | null;
  createdAt: string;
  updatedAt: string;
}

const PERSIST_PATH = path.resolve(process.cwd(), ".bkit/state/ai-providers.json");

function loadFromDisk(): MemAiProvider[] {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as MemAiProvider[];
  } catch { /* file missing or corrupt — start empty */ }
  return [];
}

async function saveToDisk(providers: MemAiProvider[]) {
  try {
    const dir = path.dirname(PERSIST_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(PERSIST_PATH, JSON.stringify(providers, null, 2), "utf8");
  } catch { /* non-fatal */ }
}

// Singleton array — loaded once on first import, persisted on every mutation
export const memAiProviders: MemAiProvider[] = loadFromDisk();

export function persistAiProviders(): void {
  void saveToDisk(memAiProviders);
}
