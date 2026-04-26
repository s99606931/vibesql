export interface GuardResult {
  allowed: boolean;
  reason?: string;
  normalizedSql?: string;
}

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

// SQL keywords that must not appear (word-boundary matched, case-insensitive)
const BLOCKED_WORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
  "TRUNCATE", "EXEC", "EXECUTE", "GRANT", "REVOKE", "CALL",
  "MERGE", "REPLACE", "LOAD", "LOCK", "UNLOCK",
];

// Literal string fragments that must not appear in the string-stripped SQL.
// Checked AFTER stripping so that e.g. SELECT 'a;b' is not falsely blocked.
const BLOCKED_LITERALS = ["--", "/*", "*/", ";"];

export function guardSql(sql: string): GuardResult {
  // Strip a single trailing semicolon — harmless statement terminator that
  // many LLMs append but which would otherwise trigger the ; blocked-literal check.
  const trimmed = sql.trim().replace(/;$/, "");
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { allowed: false, reason: "Only SELECT queries are allowed" };
  }

  // Strip literals (quoted strings and dollar-quoted blocks) before keyword scanning
  // so checks cannot be bypassed by embedding blocked keywords inside string values.
  const stripped = stripDollarQuotes(stripStringLiterals(upper));

  // Check for comment markers and multi-statement separator
  for (const lit of BLOCKED_LITERALS) {
    if (stripped.includes(lit)) {
      return { allowed: false, reason: `Forbidden sequence: ${lit}` };
    }
  }

  // Word-boundary keyword scan on the stripped version
  for (const kw of BLOCKED_WORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(stripped)) {
      return { allowed: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  // Block dangerous PostgreSQL built-in functions that can exfiltrate files or
  // execute commands even inside a SELECT (pg_read_file, dblink_exec, lo_export…)
  const BLOCKED_FUNCTIONS = [
    "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_stat_file",
    "lo_export", "lo_read", "lo_get",
    "dblink", "dblink_exec", "dblink_connect",
    "pg_sleep",
  ];
  for (const fn of BLOCKED_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\s*\\(`, "i").test(stripped)) {
      return { allowed: false, reason: `Forbidden function: ${fn}` };
    }
  }

  return { allowed: true, normalizedSql: trimmed };
}
