import fs from "fs";
import path from "path";
import type { DbDialect } from "@/types";

export interface MemScheduledQuery {
  id: string;
  userId: string;
  name: string;
  savedQueryId: string | null;
  sql: string;
  dialect: DbDialect;
  cronExpr: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemScheduleRun {
  id: string;
  scheduleId: string;
  status: "success" | "error" | "running";
  rowCount: number | null;
  durationMs: number | null;
  errorMsg: string | null;
  createdAt: string;
}

const PERSIST_PATH = path.resolve(process.cwd(), ".bkit/state/schedules.json");

function loadFromDisk(): { schedules: MemScheduledQuery[]; runs: MemScheduleRun[] } {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      return {
        schedules: Array.isArray(p.schedules) ? (p.schedules as MemScheduledQuery[]) : [],
        runs: Array.isArray(p.runs) ? (p.runs as MemScheduleRun[]) : [],
      };
    }
  } catch { /* start empty */ }
  return { schedules: [], runs: [] };
}

function saveToDisk() {
  try {
    const dir = path.dirname(PERSIST_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify({ schedules: memSchedules, runs: memScheduleRuns }, null, 2), "utf8");
  } catch { /* non-fatal */ }
}

const loaded = loadFromDisk();
export const memSchedules: MemScheduledQuery[] = loaded.schedules;
export const memScheduleRuns: MemScheduleRun[] = loaded.runs;

export function persistSchedules() {
  saveToDisk();
}
