"use client";

import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { FileText, Star, Download, LayoutDashboard, ArrowRight } from "lucide-react";

const RELATED = [
  {
    href: "/saved",
    icon: Star,
    label: "저장된 쿼리",
    desc: "저장한 쿼리 목록에서 SQL을 재사용하고 CSV로 내보냅니다.",
  },
  {
    href: "/dashboards",
    icon: LayoutDashboard,
    label: "대시보드",
    desc: "여러 차트를 묶어 대시보드를 구성하고 링크로 공유합니다.",
  },
  {
    href: "/history",
    icon: Download,
    label: "히스토리 내보내기",
    desc: "쿼리 실행 기록을 CSV로 다운로드해 외부 리포트에 활용합니다.",
  },
];

export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="리포트"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "리포트" }]}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--ds-sp-4)" }}>

          {/* Coming soon banner */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ds-sp-3)",
              padding: "var(--ds-sp-6)",
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-fill)",
              border: "1px solid var(--ds-border)",
              textAlign: "center",
            }}
          >
            <FileText aria-hidden="true" size={36} style={{ color: "var(--ds-text-faint)", opacity: 0.5 }} />
            <div>
              <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>
                리포트 — 개발 중
              </div>
              <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-faint)", lineHeight: 1.6 }}>
                저장된 쿼리 결과를 PDF·HTML 보고서로 자동 생성하고<br />
                예약 발송하는 기능을 개발 중입니다.
              </div>
            </div>
          </div>

          {/* Related features */}
          <div>
            <h2
              style={{
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 var(--ds-sp-3)",
              }}
            >
              지금 사용할 수 있는 기능
            </h2>
            <Card padding={0}>
              {RELATED.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--ds-sp-3)",
                        padding: "var(--ds-sp-4)",
                        borderBottom: i < RELATED.length - 1 ? "1px solid var(--ds-border)" : "none",
                        cursor: "pointer",
                        transition: "background var(--ds-dur-fast) var(--ds-ease)",
                      }}
                      className="hover:bg-fill"
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--ds-r-6)",
                          background: "var(--ds-accent-soft)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon aria-hidden="true" size={15} style={{ color: "var(--ds-accent)" }} />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                          {item.desc}
                        </div>
                      </div>
                      <ArrowRight aria-hidden="true" size={14} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
                    </div>
                  </Link>
                );
              })}
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
