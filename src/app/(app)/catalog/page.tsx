import { TopBar } from "@/components/shell/TopBar";
import { Database } from "lucide-react";

export default function CatalogPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="데이터 카탈로그"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "데이터 카탈로그" }]}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "var(--ds-sp-4)", color: "var(--ds-text-faint)" }}>
        <Database size={40} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>데이터 카탈로그 — 준비 중</div>
          <div style={{ fontSize: "var(--ds-fs-13)" }}>테이블·컬럼 메타데이터와 데이터 사전을 통합 관리하는 기능을 개발 중입니다.</div>
        </div>
      </div>
    </div>
  );
}
