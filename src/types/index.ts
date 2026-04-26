export type DbDialect = "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
export type WorkspaceStatus =
  | "idle"
  | "generating"
  | "ready"
  | "running"
  | "success"
  | "error";
export type ConnectionStatus = "untested" | "ok" | "error" | "testing";

export interface Connection {
  id: string;
  name: string;
  type: DbDialect;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  ssl: boolean;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestedOk?: boolean;
  createdAt: string;
}

export interface SchemaTable {
  name: string;
  rowCount?: string;
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPk: boolean;
  isFk?: boolean;
  references?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  sql: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  folder: string;
  tags: string[];
  nlQuery: string;
  sql: string;
  dialect: DbDialect;
  connectionId?: string;
  createdAt: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  sql?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface QueryVersion {
  id: string;
  queryId: string;
  versionNo: number;
  sql: string;
  nlQuery: string;
  note?: string;
  createdAt: string;
}

export type AiContextRuleType = "few_shot" | "forbidden" | "alias";

export interface AiContextRule {
  id: string;
  ruleType: AiContextRuleType;
  key: string;
  value: string;
  description?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledQuery {
  id: string;
  name: string;
  savedQueryId?: string;
  sql: string;
  dialect: DbDialect;
  cronExpr: string;
  isActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRun {
  id: string;
  scheduleId: string;
  status: "success" | "error" | "running";
  rowCount?: number;
  durationMs?: number;
  errorMsg?: string;
  createdAt: string;
}
