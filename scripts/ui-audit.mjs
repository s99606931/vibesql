/**
 * vibeSQL UI 전수 검사 스크립트
 * 실행: node scripts/ui-audit.mjs
 * 결과: docs/ui-audit-result.md
 */
import { chromium } from "/home/kunkin/.claude/skills/gstack/node_modules/playwright/index.mjs";
import fs from "fs";

const BASE = "http://localhost:3000";

const PAGES = [
  { path: "/home",        label: "홈" },
  { path: "/workspace",   label: "워크스페이스" },
  { path: "/connections", label: "연결" },
  { path: "/history",     label: "히스토리" },
  { path: "/saved",       label: "저장됨" },
  { path: "/schema",      label: "스키마" },
  { path: "/glossary",    label: "용어 사전" },
  { path: "/settings",    label: "설정" },
  { path: "/dashboards",  label: "대시보드" },
  { path: "/charts",      label: "차트" },
  { path: "/errors",      label: "상태 · 에러" },
  { path: "/profile",     label: "프로필" },
];

async function auditPage(page, { path, label }) {
  const url = `${BASE}${path}`;
  const result = { path, label, url, status: "unknown", buttons: [], links: [], errors: [], warnings: [] };

  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    result.httpStatus = resp?.status() ?? 0;

    if (result.httpStatus >= 400) {
      result.status = "error";
      result.errors.push(`HTTP ${result.httpStatus}`);
      return result;
    }

    // 버튼 수집
    const buttons = await page.$$eval(
      "button:not([disabled]):not([aria-hidden='true']), [role='button']:not([disabled])",
      (els) => els.map((el) => ({
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        type: el.tagName.toLowerCase(),
        disabled: el.disabled ?? false,
        ariaLabel: el.getAttribute("aria-label") ?? "",
      })).filter((b) => b.text || b.ariaLabel)
    );
    result.buttons = buttons;

    // 링크 수집 (내부 링크만)
    const links = await page.$$eval(
      "a[href^='/'], a[href^='http://localhost']",
      (els) => els.map((el) => ({
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50),
        href: el.getAttribute("href") ?? "",
      })).filter((l) => l.text || l.href)
    );
    result.links = links;

    // 콘솔 에러 감지 (이미 수집된 것)
    result.status = "ok";
  } catch (err) {
    result.status = "error";
    result.errors.push(err.message.slice(0, 120));
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 콘솔 에러 수집
  const consoleErrors = {};
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon")) {
        const key = page.url().replace(BASE, "") || "/";
        consoleErrors[key] = consoleErrors[key] ?? [];
        consoleErrors[key].push(text.slice(0, 100));
      }
    }
  });

  const results = [];
  console.log("🔍 vibeSQL UI 전수 검사 시작...\n");

  for (const pageInfo of PAGES) {
    process.stdout.write(`  검사 중: ${pageInfo.label} (${pageInfo.path})... `);
    const r = await auditPage(page, pageInfo);
    r.consoleErrors = consoleErrors[pageInfo.path] ?? [];
    results.push(r);
    const icon = r.status === "ok" ? "✅" : "❌";
    console.log(`${icon}  버튼 ${r.buttons.length}개, 링크 ${r.links.length}개${r.errors.length ? " | 오류: " + r.errors[0] : ""}${r.consoleErrors.length ? " | 콘솔 에러 " + r.consoleErrors.length + "건" : ""}`);
  }

  await browser.close();

  // ── MD 보고서 생성 ───────────────────────────────────────────────
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const okCount = results.filter((r) => r.status === "ok").length;
  const totalConsoleErrors = results.reduce((s, r) => s + r.consoleErrors.length, 0);

  let md = `# vibeSQL UI 전수 검사 결과\n\n`;
  md += `> **검사 일시**: ${now}  \n`;
  md += `> **검사 도구**: Playwright 1.59 (Chromium, 헤드리스)  \n`;
  md += `> **서버**: ${BASE}\n\n---\n\n`;
  md += `## 요약\n\n`;
  md += `| 항목 | 결과 |\n|------|------|\n`;
  md += `| 검사 페이지 | ${results.length}개 |\n`;
  md += `| 정상 렌더링 | ${okCount} / ${results.length} |\n`;
  md += `| 콘솔 에러 | ${totalConsoleErrors}건 |\n`;
  md += `| 전체 버튼 수 | ${results.reduce((s, r) => s + r.buttons.length, 0)}개 |\n`;
  md += `| 전체 내부 링크 수 | ${results.reduce((s, r) => s + r.links.length, 0)}개 |\n\n`;

  md += `## 페이지별 검사 결과\n\n`;
  md += `| 페이지 | 경로 | HTTP | 버튼 | 링크 | 콘솔 에러 | 상태 |\n`;
  md += `|--------|------|------|------|------|-----------|------|\n`;
  for (const r of results) {
    const statusIcon = r.status === "ok" ? "✅" : "❌";
    const errCell = r.consoleErrors.length ? `⚠️ ${r.consoleErrors.length}건` : "없음";
    md += `| ${r.label} | \`${r.path}\` | ${r.httpStatus ?? "—"} | ${r.buttons.length}개 | ${r.links.length}개 | ${errCell} | ${statusIcon} |\n`;
  }

  md += `\n---\n\n## 페이지별 버튼 목록\n\n`;

  for (const r of results) {
    md += `### ${r.label} (\`${r.path}\`)\n\n`;

    if (r.status !== "ok") {
      md += `> ❌ 렌더링 실패: ${r.errors.join(", ")}\n\n`;
      continue;
    }

    if (r.buttons.length === 0) {
      md += `> 버튼 없음 (읽기 전용 페이지)\n\n`;
    } else {
      md += `| 버튼 텍스트 | 비고 |\n|------------|------|\n`;
      const seen = new Set();
      for (const b of r.buttons) {
        const key = b.text || b.ariaLabel;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        md += `| ${key} | ${b.disabled ? "비활성" : ""} |\n`;
      }
      md += `\n`;
    }

    if (r.consoleErrors.length > 0) {
      md += `**콘솔 에러:**\n`;
      for (const e of r.consoleErrors) {
        md += `- \`${e}\`\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n## 사이드바 메뉴 구조 (업데이트 반영)\n\n`;
  md += `> **변경점**: 사이드바가 5개 그룹 접이식 구조로 개편됨 (홈 메뉴 항목 제거, 로고 클릭 → /home 이동)\n\n`;
  md += `| 그룹 | 메뉴 | 경로 |\n|------|------|------|\n`;
  md += `| 워크스페이스 | 워크스페이스 | /workspace |\n`;
  md += `| 워크스페이스 | 히스토리 | /history |\n`;
  md += `| 워크스페이스 | 저장됨 | /saved |\n`;
  md += `| 인사이트 | 대시보드 | /dashboards |\n`;
  md += `| 인사이트 | 차트 | /charts |\n`;
  md += `| 지식베이스 | 스키마 | /schema |\n`;
  md += `| 지식베이스 | 용어 사전 | /glossary |\n`;
  md += `| 데이터 소스 | 연결 | /connections |\n`;
  md += `| 데이터 소스 | 상태 · 에러 | /errors |\n`;
  md += `| 계정 | 프로필 | /profile |\n`;
  md += `| 계정 | 설정 | /settings |\n`;
  md += `| (로고 클릭) | vibeSQL 홈 | / → /home |\n`;

  if (totalConsoleErrors > 0) {
    md += `\n---\n\n## 콘솔 에러 상세\n\n`;
    for (const r of results) {
      if (r.consoleErrors.length > 0) {
        md += `### ${r.label}\n\n`;
        for (const e of r.consoleErrors) {
          md += `- \`${e}\`\n`;
        }
        md += `\n`;
      }
    }
  }

  md += `\n---\n*자동 생성: Playwright 헤드리스 브라우저 검사*\n`;

  fs.writeFileSync("docs/ui-audit-result.md", md, "utf8");
  console.log(`\n✅ 검사 완료! → docs/ui-audit-result.md`);
  console.log(`   정상: ${okCount}/${results.length} 페이지, 콘솔 에러: ${totalConsoleErrors}건`);
}

main().catch((e) => { console.error(e); process.exit(1); });
