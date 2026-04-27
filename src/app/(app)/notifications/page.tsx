"use client";

import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { CheckCircle2, Circle, Zap, Settings, ArrowRight } from "lucide-react";

export default function NotificationsPage() {
  const { notifySuccess, notifyError, notifyLong } = useSettingsStore();

  const notifSettings = [
    {
      label: "쿼리 성공 알림",
      desc: "쿼리가 성공적으로 완료되면 알림을 표시합니다.",
      enabled: notifySuccess,
    },
    {
      label: "쿼리 오류 알림",
      desc: "쿼리 실행 중 오류가 발생하면 알림을 표시합니다.",
      enabled: notifyError,
    },
    {
      label: "장시간 실행 알림",
      desc: "쿼리가 5초 이상 실행되면 알림을 표시합니다.",
      enabled: notifyLong,
    },
  ];

  const enabledCount = notifSettings.filter((n) => n.enabled).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="알림"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "알림" }]}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>

          {/* Status banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              padding: "var(--ds-sp-4)",
              borderRadius: "var(--ds-r-8)",
              background: enabledCount > 0 ? "var(--ds-accent-soft)" : "var(--ds-fill)",
              border: `1px solid ${enabledCount > 0 ? "var(--ds-accent)" : "var(--ds-border)"}`,
              transition: "background var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease)",
            }}
          >
            <Zap size={20} style={{ color: enabledCount > 0 ? "var(--ds-accent)" : "var(--ds-text-faint)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-semibold)", color: enabledCount > 0 ? "var(--ds-accent)" : "var(--ds-text-mute)" }}>
                {enabledCount > 0 ? `${enabledCount}개 알림 활성화됨` : "모든 알림이 꺼져 있습니다"}
              </div>
              <div style={{ fontSize: "var(--ds-fs-12)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                알림은 설정 페이지에서 켜고 끌 수 있습니다.
              </div>
            </div>
            <Link href="/settings" style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="ghost" size="sm" icon={<Settings size={12} />}>
                설정
                <ArrowRight size={12} style={{ marginLeft: 4 }} />
              </Button>
            </Link>
          </div>

          {/* Notification settings summary */}
          <Card padding={0}>
            {notifSettings.map((item, i) => (
              <div
                key={item.label}
                className="hover:bg-fill transition-colors"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-sp-3)",
                  padding: "var(--ds-sp-4)",
                  borderBottom: i < notifSettings.length - 1 ? "1px solid var(--ds-border)" : "none",
                }}
              >
                {item.enabled
                  ? <CheckCircle2 size={16} style={{ color: "var(--ds-success)", flexShrink: 0 }} />
                  : <Circle size={16} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", color: item.enabled ? "var(--ds-text)" : "var(--ds-text-mute)" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                    {item.desc}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "var(--ds-fs-11)",
                    fontWeight: "var(--ds-fw-semibold)",
                    color: item.enabled ? "var(--ds-success)" : "var(--ds-text-faint)",
                    flexShrink: 0,
                  }}
                >
                  {item.enabled ? "켜짐" : "꺼짐"}
                </span>
              </div>
            ))}
          </Card>

          {/* Coming soon note */}
          <div
            style={{
              padding: "var(--ds-sp-3) var(--ds-sp-4)",
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)",
              fontSize: "var(--ds-fs-12)",
              color: "var(--ds-text-faint)",
              textAlign: "center",
            }}
          >
            푸시 알림 · 이메일 알림 기능을 개발 중입니다.
          </div>

        </div>
      </div>
    </div>
  );
}
