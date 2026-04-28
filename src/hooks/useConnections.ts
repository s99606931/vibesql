import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Connection, DbDialect } from "@/types";

export interface ConnectionConfig {
  name: string;
  type: DbDialect;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface TestResult {
  latencyMs: number;
  serverVersion: string;
  ok: boolean;
}

export interface ScanResult {
  tableCount: number;
  scannedAt: string;
}

async function fetchConnections(): Promise<Connection[]> {
  const res = await fetch("/api/connections");
  const json = (await res.json()) as { data: Connection[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch connections");
  return json.data;
}

async function createConnection(config: ConnectionConfig): Promise<Connection> {
  const res = await fetch("/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as { data?: Connection; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Failed to create connection (HTTP ${res.status})`);
  if (!json.data) throw new Error("응답에 data가 없습니다");
  return json.data;
}

async function testConnection(id: string): Promise<TestResult> {
  const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
  const json = (await res.json()) as { data: TestResult; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Connection test failed");
  return json.data;
}

async function scanConnection(id: string): Promise<ScanResult> {
  const res = await fetch(`/api/connections/${id}/scan`, { method: "POST" });
  const json = (await res.json()) as { data: ScanResult; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Schema scan failed");
  return json.data;
}

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: fetchConnections,
    staleTime: 30_000,
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createConnection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Partial<ConnectionConfig> }) => {
      const res = await fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as { data: Connection; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update connection");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

export function useTestConnection() {
  return useMutation({ mutationFn: testConnection });
}

export function useScanConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scanConnection,
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: ["schema", id] }),
  });
}
