"use client";

import { useState, useId } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AICallout } from "@/components/ui-vs/AICallout";

type ChartKind = "bar" | "line" | "area";

interface ResultChartInnerProps {
  rows: Record<string, unknown>[];
  columns: string[];
}

function detectColumnTypes(rows: Record<string, unknown>[], columns: string[]) {
  const numericCols: string[] = [];
  const stringCols: string[] = [];
  const dateCols: string[] = [];

  for (const col of columns) {
    const samples = rows.slice(0, 20).map((r) => r[col]);
    const nonNull = samples.filter((v) => v !== null && v !== undefined);
    if (nonNull.length === 0) continue;

    const isDate = nonNull.every((v) => {
      if (typeof v === "string") {
        return /date|time|created|updated|at$/i.test(col) || !isNaN(Date.parse(v));
      }
      return false;
    });

    const isNumeric = nonNull.every(
      (v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)))
    );

    if (isDate) dateCols.push(col);
    else if (isNumeric) numericCols.push(col);
    else stringCols.push(col);
  }

  return { numericCols, stringCols, dateCols };
}

function detectDefaultKind(
  dateCols: string[],
  stringCols: string[],
  numericCols: string[]
): ChartKind {
  if (dateCols.length > 0 && numericCols.length > 0) return "line";
  if (stringCols.length > 0 && numericCols.length > 0) return "bar";
  return "bar";
}

const tooltipStyle = {
  background: "var(--ds-surface)",
  border: "1px solid var(--ds-border)",
  borderRadius: "var(--ds-r-6)",
  fontSize: 12,
  color: "var(--ds-text)",
};

const CHART_TYPES: { key: ChartKind; label: string }[] = [
  { key: "bar", label: "바" },
  { key: "line", label: "라인" },
  { key: "area", label: "면적" },
];

export default function ResultChartInner({ rows, columns }: ResultChartInnerProps) {
  const uid = useId();
  const gradientId = `areaGrad-${uid.replace(/:/g, "")}`;
  const { numericCols, stringCols, dateCols } = detectColumnTypes(rows, columns);

  const defaultKind = detectDefaultKind(dateCols, stringCols, numericCols);
  const [kind, setKind] = useState<ChartKind>(defaultKind);

  if (numericCols.length === 0) {
    return (
      <div style={{ padding: "var(--ds-sp-4)" }}>
        <AICallout tone="default">차트를 그리려면 숫자 컬럼이 필요합니다</AICallout>
      </div>
    );
  }

  const labelCol = dateCols[0] ?? stringCols[0] ?? columns[0];
  const valueCol = numericCols[0];
  const sliced = rows.length > 100 ? rows.slice(0, 100) : rows;

  const data = sliced.map((row) => ({
    label: String(row[labelCol] ?? ""),
    value:
      typeof row[valueCol] === "number"
        ? row[valueCol]
        : Number(row[valueCol] ?? 0),
  }));

  const commonAxisProps = {
    tick: {
      fontSize: 11,
      fill: "var(--ds-text-mute)",
      fontFamily: "var(--ds-font-sans)",
    },
    tickLine: false,
    axisLine: { stroke: "var(--ds-border)" },
  };

  const gridProps = {
    stroke: "var(--ds-border)",
    strokeDasharray: "3 3",
  };

  return (
    <div style={{ padding: "var(--ds-sp-3) var(--ds-sp-4)" }}>
      {/* Warning banner */}
      {rows.length > 100 && (
        <div
          style={{
            fontSize: "var(--ds-fs-11)",
            color: "var(--ds-warn)",
            marginBottom: "var(--ds-sp-2)",
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-1)",
          }}
        >
          상위 100개 행만 표시됩니다
        </div>
      )}

      {/* Toggle pills */}
      <div
        style={{
          display: "flex",
          gap: "var(--ds-sp-1)",
          marginBottom: "var(--ds-sp-3)",
        }}
      >
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.key}
            onClick={() => setKind(ct.key)}
            style={{
              padding: "2px 10px",
              borderRadius: "var(--ds-r-full)",
              border:
                kind === ct.key
                  ? "1px solid var(--ds-accent)"
                  : "1px solid var(--ds-border)",
              background:
                kind === ct.key ? "var(--ds-accent-soft)" : "var(--ds-surface)",
              color:
                kind === ct.key ? "var(--ds-accent)" : "var(--ds-text-mute)",
              fontSize: "var(--ds-fs-11)",
              cursor: "pointer",
              fontFamily: "var(--ds-font-sans)",
              fontWeight: "var(--ds-fw-medium)",
            }}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="label" {...commonAxisProps} />
            <YAxis {...commonAxisProps} width={48} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--ds-fill)" }} />
            <Bar dataKey="value" fill="var(--ds-accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...commonAxisProps} />
            <YAxis {...commonAxisProps} width={48} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--ds-accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--ds-accent)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--ds-accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--ds-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...commonAxisProps} />
            <YAxis {...commonAxisProps} width={48} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--ds-accent)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
