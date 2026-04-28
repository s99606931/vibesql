import fs from "fs";
import path from "path";
import type { AiContextRuleType } from "@/types";

export interface MemAiContextRule {
  id: string;
  userId: string;
  ruleType: AiContextRuleType;
  key: string;
  value: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

const STATE_DIR =
  process.env.VIBESQL_STATE_DIR ?? path.resolve(process.cwd(), ".vibesql");
const PERSIST_PATH = path.join(STATE_DIR, "ai-context-rules.json");

function loadFromDisk(): MemAiContextRule[] {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as MemAiContextRule[];
  } catch { /* start empty */ }
  return [];
}

async function saveToDisk(items: MemAiContextRule[]) {
  try {
    const dir = path.dirname(PERSIST_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(PERSIST_PATH, JSON.stringify(items, null, 2), "utf8");
  } catch { /* non-fatal */ }
}

export const memAiContextRules: MemAiContextRule[] = loadFromDisk();

export function persistAiContextRules(): void {
  void saveToDisk(memAiContextRules);
}
