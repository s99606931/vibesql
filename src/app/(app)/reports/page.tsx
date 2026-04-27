import { TopBar } from "@/components/shell/TopBar";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="리포트"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "리포트" }]}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "var(--ds-sp-4)", color: "var(--ds-text-faint)" }}>
        <FileText size={40} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>리포트 — 준비 중</div>
          <div style={{ fontSize: "var(--ds-fs-13)" }}>저장된 쿼리 결과를 자동으로 보고서로 만드는 기능을 개발 중입니다.</div>
        </div>
      </div>
    </div>
  );
}
