export interface GuardResult {
  allowed: boolean;
  reason?: string;
  normalizedSql?: string;
}

// Simple state-machine to strip SQL string literals before keyword scanning
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

// SQL keywords that must not appear (word-boundary matched, case-insensitive)
const BLOCKED_WORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
  "TRUNCATE", "EXEC", "EXECUTE", "GRANT", "REVOKE", "CALL",
];

// Literal string fragments that must not appear in the string-stripped SQL.
// Checked AFTER stripping so that e.g. SELECT 'a;b' is not falsely blocked.
const BLOCKED_LITERALS = ["--", "/*", "*/", ";"];

export function guardSql(sql: string): GuardResult {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { allowed: false, reason: "Only SELECT queries are allowed" };
  }

  // Strip string literals first so checks below cannot be fooled by literal
  // content, and so valid queries whose string values contain these sequences
  // are not falsely rejected.
  const stripped = stripStringLiterals(upper);

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

  return { allowed: true, normalizedSql: trimmed };
}
