import { useMutation } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { DbDialect } from "@/types";

export interface GenerateOptions {
  nl: string;
  dialect?: DbDialect;
  connectionId?: string;
  schemaContext?: string;
  glossary?: string;
}

export interface GenerateResult {
  sql: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

export interface RunOptions {
  sql: string;
  connectionId: string;
  limit?: number;
}

export interface RunResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
}

async function generateSql(options: GenerateOptions): Promise<GenerateResult> {
  const res = await fetch("/api/queries/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const json = (await res.json()) as ApiEnvelope<GenerateResult>;
  if (!res.ok || !json.data) throw new Error(json.error ?? "SQL generation failed");
  return json.data;
}

async function runQuery(options: RunOptions): Promise<RunResult> {
  const res = await fetch("/api/queries/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const json = (await res.json()) as ApiEnvelope<RunResult>;
  if (!res.ok || !json.data) throw new Error(json.error ?? "Query execution failed");
  return json.data;
}

export function useGenerateSql() {
  const { setStatus, setSql, setError } = useWorkspaceStore();
  return useMutation({
    mutationFn: generateSql,
    onMutate: () => setStatus("generating"),
    onSuccess: (data) => {
      setSql(data.sql);
      setStatus("ready");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStatus("error");
    },
  });
}

export function useRunQuery() {
  const { setStatus, setResults, setError } = useWorkspaceStore();
  return useMutation({
    mutationFn: runQuery,
    onMutate: () => setStatus("running"),
    onSuccess: (data) => {
      setResults(data.rows, data.rowCount, data.durationMs);
      setStatus("success");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStatus("error");
    },
  });
}
