export interface GuardResult {
  allowed: boolean;
  reason?: string;
  normalizedSql?: string;
}

// ─── String-literal stripping ─────────────────────────────────────────────────

// State-machine to strip single/double-quoted SQL string literals
function stripStringLiterals(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < sql.length && sql[i] !== quote) {
        if (sql[i] === "\\") i++; // skip escape
        i++;
      }
      out += " ";
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

// Strip PostgreSQL dollar-quoted strings: $$...$$, $tag$...$tag$
// These bypass single-quote stripping and can hide blocked keywords.
function stripDollarQuotes(sql: string): string {
  return sql.replace(/\$([^$]*)\$[\s\S]*?\$\1\$/g, " ");
}

// ─── Block lists ──────────────────────────────────────────────────────────────

// SQL keywords that must not appear (word-boundary matched, case-insensitive)
const BLOCKED_WORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
  "TRUNCATE", "EXEC", "EXECUTE", "GRANT", "REVOKE", "CALL",
  "MERGE", "REPLACE", "LOAD", "LOCK", "UNLOCK",
  // CRITICAL-4: file-system / security DDL keywords
  "COPY", "IMPORT", "SECURITY",
];

// Literal string fragments checked AFTER literal stripping.
const BLOCKED_LITERALS = ["--", "/*", "*/", ";"];

// Dangerous functions that can exfiltrate files or execute OS commands
// even inside a SELECT statement.
const BLOCKED_FUNCTIONS = [
  // File read (existing)
  "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_stat_file",
  // Large object exfiltration (existing)
  "lo_export", "lo_read", "lo_get",
  // Cross-DB exec
  "dblink", "dblink_exec", "dblink_connect",
  // Timing side-channel
  "pg_sleep",
  // CRITICAL-4 additions — large object write / RCE
  "lo_import", "lo_create", "lo_truncate", "lo_put", "lo_from_bytea",
  "pg_write_binary_file", "pg_execute_server_program",
  "pg_reload_conf", "pg_rotate_logfile",
  "system", "exec",
];

// ─── AST-level dialect mapping ────────────────────────────────────────────────

// node-sql-parser supports PostgresQL, MySQL, SQLite.
// MSSQL and Oracle are not supported — fall back to regex-only for those.
const PARSER_DIALECT_MAP: Record<string, string> = {
  postgresql: "PostgresQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

type AstNode = { type: string };

function astGuard(sql: string, dialect: string): GuardResult | null {
  const dbOption = PARSER_DIALECT_MAP[dialect.toLowerCase()];
  if (!dbOption) {
    // Dialect not supported by parser — regex guard is the only layer.
    return null;
  }

  let Parser: new () => { astify(sql: string, opt: { database: string }): AstNode | AstNode[] };
  try {
    // Dynamic require so the module is not bundled in Edge runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ Parser } = require("node-sql-parser") as {
      Parser: new () => { astify(sql: string, opt: { database: string }): AstNode | AstNode[] };
    });
  } catch {
    // node-sql-parser not available (e.g. Edge runtime) — degrade gracefully.
    return null;
  }

  try {
    const parser = new Parser();
    const ast = parser.astify(sql, { database: dbOption });
    const nodes: AstNode[] = Array.isArray(ast) ? ast : [ast];

    // Allow only SELECT statements (CTE WITH … SELECT resolves to type "select").
    for (const node of nodes) {
      if (node.type !== "select") {
        return {
          allowed: false,
          reason: `AST validation failed: statement type '${node.type}' is not allowed`,
        };
      }
    }
    return null; // AST pass — continue to regex layer
  } catch (err) {
    // Parse error → malformed or dialect-incompatible SQL.
    // Fail open with a descriptive message rather than silently allowing.
    const msg = err instanceof Error ? err.message : String(err);
    return { allowed: false, reason: `AST parse error: ${msg}` };
  }
}

// ─── Main guard ───────────────────────────────────────────────────────────────

/**
 * Validates a SQL string.
 *
 * @param sql     The SQL string to validate.
 * @param dialect One of: postgresql | mysql | sqlite | mssql | oracle
 *                Defaults to "postgresql".  Used for AST dialect selection.
 *
 * Defense-in-depth order:
 *   1. Prefix check  — must start with SELECT or WITH
 *   2. AST check     — node-sql-parser (postgresql / mysql / sqlite)
 *   3. Regex check   — blocked keywords + blocked functions (all dialects)
 */
export function guardSql(sql: string, dialect = "postgresql"): GuardResult {
  // Strip a single trailing semicolon — harmless statement terminator that
  // many LLMs append but which would otherwise trigger the ; blocked-literal check.
  const trimmed = sql.trim().replace(/;$/, "");
  const upper = trimmed.toUpperCase();

  // 1. Prefix check
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { allowed: false, reason: "Only SELECT queries are allowed" };
  }

  // 2. AST check (returns non-null only on failure or parse error)
  const astResult = astGuard(trimmed, dialect);
  if (astResult !== null) {
    return astResult;
  }

  // 3. Regex layer — strip literals before scanning so blocked words
  //    embedded in string values cannot bypass the check.
  const stripped = stripDollarQuotes(stripStringLiterals(upper));

  for (const lit of BLOCKED_LITERALS) {
    if (stripped.includes(lit)) {
      return { allowed: false, reason: `Forbidden sequence: ${lit}` };
    }
  }

  for (const kw of BLOCKED_WORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(stripped)) {
      return { allowed: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  for (const fn of BLOCKED_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\s*\\(`, "i").test(stripped)) {
      return { allowed: false, reason: `Forbidden function: ${fn}` };
    }
  }

  return { allowed: true, normalizedSql: trimmed };
}
