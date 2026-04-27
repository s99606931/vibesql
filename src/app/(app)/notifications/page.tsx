import { TopBar } from "@/components/shell/TopBar";
import { Zap } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="알림"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "알림" }]}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "var(--ds-sp-4)", color: "var(--ds-text-faint)" }}>
        <Zap size={40} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>알림 — 준비 중</div>
          <div style={{ fontSize: "var(--ds-fs-13)" }}>쿼리 완료·실패·장시간 실행 알림을 실시간으로 받는 기능을 개발 중입니다.</div>
        </div>
      </div>
    </div>
  );
}
