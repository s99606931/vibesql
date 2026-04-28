// SQL Validator — AST parsing + identifier whitelist + DML/DDL block
// Design Ref: docs/02-design/features/nl2sql-architecture.design.md §4.D-2

import { Parser } from "node-sql-parser";

export type SqlDialect = "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";

const DIALECT_MAP: Record<SqlDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "TransactSQL",
  oracle: "Oracle",
};

export interface ValidationResult {
  valid: boolean;
  // Either the AST type or "unknown" if parsing failed
  statementType?: string;
  // Identifiers extracted from the SQL
  tables: string[];
  columns: string[]; // table.column or just column when ambiguous
  // Errors found
  errors: ValidationError[];
}

export interface ValidationError {
  code:
    | "PARSE_FAILED"
    | "NOT_SELECT"
    | "MULTIPLE_STATEMENTS"
    | "UNKNOWN_TABLE"
    | "UNKNOWN_COLUMN"
    | "FORBIDDEN_FUNCTION"
    | "EMPTY";
  message: string;
  detail?: string;
}

export interface SchemaCatalog {
  // Map: lowercased fully-qualified table name -> set of lowercased column names
  // e.g. "public.customers" -> Set { "id", "name", ... }
  // Also accept just "customers" for unqualified references
  tables: Map<string, Set<string>>;
}

export function buildCatalog(schema: {
  [tableName: string]: string[]; // tableName -> column[]
}): SchemaCatalog {
  const tables = new Map<string, Set<string>>();
  for (const [name, cols] of Object.entries(schema)) {
    const set = new Set(cols.map((c) => c.toLowerCase()));
    tables.set(name.toLowerCase(), set);
  }
  return { tables };
}

const FORBIDDEN_FUNCTIONS = new Set([
  "pg_read_file",
  "pg_read_binary_file",
  "lo_export",
  "lo_import",
  "copy",
  "pg_sleep",
]);

/**
 * Validate SQL against:
 *  1. Parses successfully
 *  2. Single SELECT statement
 *  3. (optional) all referenced identifiers are in the catalog
 *  4. No forbidden functions
 */
export function validateSql(
  sql: string,
  dialect: SqlDialect = "postgresql",
  catalog?: SchemaCatalog,
): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    tables: [],
    columns: [],
    errors: [],
  };

  if (!sql || !sql.trim()) {
    result.errors.push({ code: "EMPTY", message: "SQL is empty" });
    return result;
  }

  const parser = new Parser();
  let ast;
  try {
    ast = parser.astify(sql, { database: DIALECT_MAP[dialect] });
  } catch (err) {
    result.errors.push({
      code: "PARSE_FAILED",
      message: "SQL parse failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length > 1) {
    result.errors.push({
      code: "MULTIPLE_STATEMENTS",
      message: `Only single statement allowed; got ${statements.length}`,
    });
    return result;
  }
  const stmt = statements[0];
  result.statementType = (stmt as { type?: string }).type;

  if (result.statementType !== "select") {
    result.errors.push({
      code: "NOT_SELECT",
      message: `Only SELECT allowed; got ${result.statementType}`,
    });
    return result;
  }

  // Extract identifiers
  const { tables, columns, functions } = extractIdentifiers(stmt);
  result.tables = [...new Set(tables)];
  result.columns = [...new Set(columns)];

  // Forbidden functions
  for (const fn of functions) {
    if (FORBIDDEN_FUNCTIONS.has(fn.toLowerCase())) {
      result.errors.push({
        code: "FORBIDDEN_FUNCTION",
        message: `Forbidden function: ${fn}`,
      });
    }
  }

  // Catalog whitelist
  if (catalog) {
    for (const t of result.tables) {
      const tn = t.toLowerCase();
      if (!catalog.tables.has(tn) && !catalog.tables.has(`public.${tn}`)) {
        result.errors.push({
          code: "UNKNOWN_TABLE",
          message: `Table not in catalog: ${t}`,
        });
      }
    }
    for (const c of result.columns) {
      // c may be "table.column" or just "column"
      const [t, col] = c.includes(".") ? c.split(".") : [null, c];
      if (t) {
        const tn = t.toLowerCase();
        const cols =
          catalog.tables.get(tn) ?? catalog.tables.get(`public.${tn}`);
        if (cols && !cols.has(col.toLowerCase())) {
          result.errors.push({
            code: "UNKNOWN_COLUMN",
            message: `Column ${c} not in catalog`,
          });
        }
      } else {
        // Unqualified column — check if it exists in any of the referenced tables
        const found = result.tables.some((tName) => {
          const cols =
            catalog.tables.get(tName.toLowerCase()) ??
            catalog.tables.get(`public.${tName.toLowerCase()}`);
          return cols?.has(col.toLowerCase()) ?? false;
        });
        if (!found && result.tables.length > 0) {
          result.errors.push({
            code: "UNKNOWN_COLUMN",
            message: `Column ${col} not in any referenced table`,
          });
        }
      }
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

interface IdentifierExtraction {
  tables: string[];
  columns: string[]; // table.column or just column (table = real table or alias unresolved)
  functions: string[];
}

function extractIdentifiers(node: unknown): IdentifierExtraction {
  const tables: string[] = [];
  const columns: string[] = [];
  const functions: string[] = [];
  const aliasMap = new Map<string, string>(); // alias -> real table name
  const columnAliases = new Set<string>();    // SELECT alias names (output names like "order_count")
  const cteNames = new Set<string>();         // WITH clause names

  // Pass 0: collect SELECT column aliases (e.g., COUNT(*) AS order_count)
  // and CTE names (WITH x AS (...) so x is a virtual table).
  // Aliases must NOT be flagged as UNKNOWN_COLUMN when referenced in ORDER BY/HAVING/GROUP BY.
  function collectAliases(n: unknown): void {
    if (n == null) return;
    if (Array.isArray(n)) {
      n.forEach(collectAliases);
      return;
    }
    if (typeof n !== "object") return;
    const obj = n as Record<string, unknown>;

    // SELECT entries: { expr, as: "alias_name" }
    if (Array.isArray(obj.columns)) {
      for (const c of obj.columns) {
        if (c && typeof c === "object") {
          const asName = (c as { as?: unknown }).as;
          if (typeof asName === "string" && asName.length > 0) {
            columnAliases.add(asName.toLowerCase());
          }
        }
      }
    }

    // WITH clauses: { with: [{ name: { value: "x" }, stmt: ... }] }
    if (Array.isArray(obj.with)) {
      for (const w of obj.with) {
        if (w && typeof w === "object") {
          const nameRoot = (w as { name?: unknown }).name;
          if (typeof nameRoot === "string") {
            cteNames.add(nameRoot.toLowerCase());
          } else if (nameRoot && typeof nameRoot === "object") {
            const v = (nameRoot as { value?: unknown }).value;
            if (typeof v === "string") cteNames.add(v.toLowerCase());
          }
        }
      }
    }

    for (const k of Object.keys(obj)) collectAliases(obj[k]);
  }

  // Pass 1: collect tables and aliases from FROM/JOIN clauses
  function collectFromClauses(n: unknown): void {
    if (n == null) return;
    if (Array.isArray(n)) {
      n.forEach(collectFromClauses);
      return;
    }
    if (typeof n !== "object") return;
    const obj = n as Record<string, unknown>;

    // FROM clause is `from: [{ table, as, ... }]`
    if (Array.isArray(obj.from)) {
      for (const entry of obj.from) {
        if (entry && typeof entry === "object") {
          const e = entry as { table?: unknown; as?: unknown };
          if (typeof e.table === "string" && e.table.length > 0) {
            tables.push(e.table);
            if (typeof e.as === "string" && e.as.length > 0) {
              aliasMap.set(e.as.toLowerCase(), e.table);
            } else {
              // No alias — register table name as its own alias for column refs
              aliasMap.set(e.table.toLowerCase(), e.table);
            }
          }
        }
      }
    }

    // Subqueries / unions / WITH clauses — recurse
    for (const k of Object.keys(obj)) {
      if (k !== "from") collectFromClauses(obj[k]);
    }
    // Also walk into FROM entries to find subqueries
    if (Array.isArray(obj.from)) {
      for (const entry of obj.from) collectFromClauses(entry);
    }
  }

  // Pass 2: collect column_ref and function nodes
  function collectRefs(n: unknown): void {
    if (n == null) return;
    if (Array.isArray(n)) {
      n.forEach(collectRefs);
      return;
    }
    if (typeof n !== "object") return;
    const obj = n as Record<string, unknown>;

    if (obj.type === "column_ref") {
      const tRaw = obj.table as string | null;
      // Resolve alias to real table if present
      const t = tRaw ? aliasMap.get(tRaw.toLowerCase()) ?? tRaw : null;
      let col = obj.column;
      if (col != null && typeof col === "object") {
        const inner = (col as { expr?: { value?: unknown } }).expr?.value;
        if (typeof inner === "string") col = inner;
      }
      if (typeof col === "string" && col !== "*") {
        columns.push(t ? `${t}.${col}` : col);
      }
    }

    if (obj.type === "function") {
      const nameRoot = obj.name as
        | { name?: Array<{ value?: unknown }> }
        | undefined;
      const fnName = nameRoot?.name?.[0]?.value;
      if (typeof fnName === "string") functions.push(fnName);
    }

    for (const k of Object.keys(obj)) collectRefs(obj[k]);
  }

  collectAliases(node);
  collectFromClauses(node);
  collectRefs(node);

  // Filter out CTE names from "tables" — they are virtual, not from catalog
  const realTables = tables.filter((t) => !cteNames.has(t.toLowerCase()));
  // Filter out columns that are SELECT aliases (output names referenced in ORDER BY etc.)
  const realColumns = columns.filter((c) => {
    const colName = c.includes(".") ? c.split(".")[1] : c;
    return !columnAliases.has(colName.toLowerCase());
  });

  return { tables: realTables, columns: realColumns, functions };
}

/**
 * Normalize SQL for AST-based equality comparison.
 * Returns a canonical string suitable for comparing two SQL queries.
 */
export function normalizeSqlForCompare(
  sql: string,
  dialect: SqlDialect = "postgresql",
): string | null {
  try {
    const parser = new Parser();
    const ast = parser.astify(sql, { database: DIALECT_MAP[dialect] });
    // Re-emit canonically
    const out = parser.sqlify(ast, { database: DIALECT_MAP[dialect] });
    return out.toLowerCase().replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}
