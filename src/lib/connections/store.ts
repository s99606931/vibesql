// Shared in-memory connection store used by multiple API routes
import type { DbDialect } from "@/types";

export interface StoredConnection {
  id: string;
  name: string;
  type: DbDialect;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  passwordBase64?: string;
  ssl: boolean;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestedOk?: boolean;
  createdAt: string;
  userId?: string;
}

const store = new Map<string, StoredConnection>();

export function getAllConnections(): StoredConnection[] {
  return Array.from(store.values());
}

export function getConnection(id: string): StoredConnection | undefined {
  return store.get(id);
}

export function addConnection(conn: StoredConnection): void {
  store.set(conn.id, conn);
}

export function updateConnection(
  id: string,
  patch: Partial<StoredConnection>
): void {
  const existing = store.get(id);
  if (existing) store.set(id, { ...existing, ...patch });
}

export function deleteConnection(id: string): void {
  store.delete(id);
}
