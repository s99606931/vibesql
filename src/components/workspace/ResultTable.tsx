"use client";

import { useState, useMemo } from "react";
import { Hash, Calendar, Type, ArrowUp, ArrowDown } from "lucide-react";

type ColType = "number" | "date" | "boolean" | "string" | "null";

function detectColType(rows: Record<string, unknown>[], col: string): ColType {
  const samples = rows.slice(0, 30).map((r) => r[col]);
  const nonNull = samples.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) return "null";

  if (nonNull.every((v) => typeof v === "boolean")) return "boolean";
  if (nonNull.every((v) => typeof v === "number")) return "number";
  if (
    nonNull.every((v) => typeof v === "string" && !isNaN(Number(v)) && String(v).trim() !== "")
  )
    return "number";
  if (
    nonNull.some((v) => {
      if (typeof v !== "string") return false;
      return (
        /\d{4}-\d{2}-\d{2}/.test(v as string) &&
        !isNaN(Date.parse(v as string))
      );
    })
  )
    return "date";
  return "string";
}

function formatValue(value: unknown, type: ColType): { text: string; isNull: boolean } {
  if (value === null || value === undefined) return { text: "NULL", isNull: true };

  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return { text: isNaN(n) ? String(value) : n.toLocaleString(), isNull: false };
    }
    case "date": {
      try {
        const d = new Date(String(value));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return { text: `${yyyy}-${mm}-${dd} ${hh}:${min}`, isNull: false };
      } catch {
        return { text: String(value), isNull: false };
      }
    }
    default:
      return { text: String(value), isNull: false };
  }
}

function ColIcon({ type }: { type: ColType }) {
  const props = { size: 11, style: { flexShrink: 0 as const } };
  if (type === "number") return <Hash {...props} />;
  if (type === "date") return <Calendar {...props} />;
  return <Type {...props} />;
}

function BoolCell({ value }: { value: unknown }) {
  const bool = value === true || value === "true" || value === 1 || value === "1";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--ds-fs-11)",
        padding: "2px 7px",
        borderRadius: "var(--ds-r-full)",
        fontWeight: "var(--ds-fw-medium)",
        background: bool ? "var(--ds-success-soft)" : "var(--ds-danger-soft)",
        color: bool ? "var(--ds-success)" : "var(--ds-danger)",
        border: `1px solid ${bool ? "var(--ds-success)" : "var(--ds-danger)"}`,
      }}
    >
      {bool ? "✓" : "✗"}
    </span>
  );
}

interface ResultTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
}

export function ResultTable({ rows, columns }: ResultTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const colTypes: Record<string, ColType> = {};
  for (const col of columns) {
    colTypes[col] = detectColType(rows, col);
  }

  function handleHeaderClick(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sorted = sortCol
    ? [...rows].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--ds-fill)" }}>
            {/* Row number column */}
            <th
              style={{
                width: 36,
                minWidth: 36,
                padding: "var(--ds-sp-2) var(--ds-sp-2)",
                textAlign: "right",
                fontSize: "var(--ds-fs-10)",
                color: "var(--ds-text-faint)",
                borderBottom: "1px solid var(--ds-border)",
                fontFamily: "var(--ds-font-mono)",
                position: "sticky",
                left: 0,
                background: "var(--ds-fill)",
              }}
            >
              #
            </th>
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => handleHeaderClick(col)}
                style={{
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  textAlign: colTypes[col] === "number" ? "right" : "left",
                  fontSize: "var(--ds-fs-10)",
                  fontFamily: "var(--ds-font-mono)",
                  color: "var(--ds-text-mute)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--ds-border)",
                  fontWeight: "var(--ds-fw-semibold)",
                  whiteSpace: "nowrap" as const,
                  cursor: "pointer",
                  userSelect: "none" as const,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    justifyContent:
                      colTypes[col] === "number" ? "flex-end" : "flex-start",
                  }}
                >
                  <ColIcon type={colTypes[col]} />
                  {col}
                  {sortCol === col &&
                    (sortDir === "asc" ? (
                      <ArrowUp size={10} />
                    ) : (
                      <ArrowDown size={10} />
                    ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={`row-${i}-${String(row[columns[0]] ?? i)}`} style={{ borderBottom: "1px solid var(--ds-border)" }}>
              {/* Row number */}
              <td
                style={{
                  width: 36,
                  minWidth: 36,
                  padding: "var(--ds-sp-2) var(--ds-sp-2)",
                  textAlign: "right",
                  fontSize: "var(--ds-fs-11)",
                  color: "var(--ds-text-faint)",
                  fontFamily: "var(--ds-font-mono)",
                  position: "sticky",
                  left: 0,
                  background: "var(--ds-surface)",
                }}
              >
                {i + 1}
              </td>
              {columns.map((col) => {
                const raw = row[col];
                const type = colTypes[col];

                if (raw === null || raw === undefined) {
                  return (
                    <td
                      key={col}
                      style={{
                        padding: "var(--ds-sp-2) var(--ds-sp-3)",
                        fontSize: "var(--ds-fs-13)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--ds-font-mono)",
                          fontSize: "var(--ds-fs-11)",
                          color: "var(--ds-text-faint)",
                          opacity: 0.7,
                        }}
                      >
                        NULL
                      </span>
                    </td>
                  );
                }

                if (type === "boolean") {
                  return (
                    <td
                      key={col}
                      style={{
                        padding: "var(--ds-sp-2) var(--ds-sp-3)",
                        fontSize: "var(--ds-fs-13)",
                      }}
                    >
                      <BoolCell value={raw} />
                    </td>
                  );
                }

                const { text } = formatValue(raw, type);
                const isTruncated = text.length > 80;
                const display = isTruncated ? text.slice(0, 80) + "…" : text;

                return (
                  <td
                    key={col}
                    title={isTruncated ? text : undefined}
                    style={{
                      padding: "var(--ds-sp-2) var(--ds-sp-3)",
                      fontSize: "var(--ds-fs-13)",
                      color: "var(--ds-text)",
                      textAlign: type === "number" ? "right" : "left",
                      fontFamily:
                        type === "number" || type === "date"
                          ? "var(--ds-font-mono)"
                          : "var(--ds-font-sans)",
                      whiteSpace: "nowrap" as const,
                      maxWidth: 320,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
