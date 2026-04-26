import dynamic from "next/dynamic";

export interface ResultChartProps {
  rows: Record<string, unknown>[];
  columns: string[];
}

export default dynamic(
  () => import("./ResultChartInner"),
  {
    ssr: false,
    loading: () => (
      <div
        className="ds-stripes"
        style={{ height: 200, margin: "var(--ds-sp-4)", borderRadius: "var(--ds-r-6)" }}
      />
    ),
  }
);
