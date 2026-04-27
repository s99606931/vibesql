"use client";

import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui-vs/Card";
import { Button } from "@/components/ui-vs/Button";
import { Database, Table2, BookOpen, ArrowRight } from "lucide-react";

const RELATED = [
  {
    href: "/schema",
    icon: Table2,
    label: "스키마 탐색기",
    desc: "연결된 DB의 테이블과 컬럼 구조를 조회합니다.",
  },
  {
    href: "/glossary",
    icon: BookOpen,
    label: "용어 사전",
    desc: "비즈니스 용어 정의와 SQL 별칭을 관리합니다.",
  },
];

export default function CatalogPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="데이터 카탈로그"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "데이터 카탈로그" }]}
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
            <Database size={36} style={{ color: "var(--ds-text-faint)", opacity: 0.5 }} />
            <div>
              <div style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text-mute)", marginBottom: "var(--ds-sp-1)" }}>
                데이터 카탈로그 — 개발 중
              </div>
              <div style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-faint)", lineHeight: 1.6 }}>
                테이블·컬럼 메타데이터, 데이터 계보(lineage), 품질 지표를<br />
                통합 관리하는 기능을 개발 중입니다.
              </div>
            </div>
          </div>

          {/* Related features */}
          <div>
            <div
              style={{
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "var(--ds-sp-3)",
              }}
            >
              지금 사용할 수 있는 기능
            </div>
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
                        <Icon size={15} style={{ color: "var(--ds-accent)" }} />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "var(--ds-fs-13)", fontWeight: "var(--ds-fw-medium)", color: "var(--ds-text)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "var(--ds-fs-11)", color: "var(--ds-text-faint)", marginTop: 2 }}>
                          {item.desc}
                        </div>
                      </div>
                      <ArrowRight size={14} style={{ color: "var(--ds-text-faint)", flexShrink: 0 }} />
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
