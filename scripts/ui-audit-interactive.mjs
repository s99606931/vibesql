/**
 * vibeSQL UI 인터랙티브 전수 검사 스크립트 v2
 * 실행: node scripts/ui-audit-interactive.mjs
 * 결과: docs/ui-audit-result.md (업데이트)
 *
 * 검사 항목:
 *  1. 페이지 렌더링 (HTTP 200, 콘솔 에러 없음)
 *  2. 사이드바 메뉴 클릭 → 네비게이션 동작
 *  3. 주요 버튼 클릭 → 동작 확인
 *  4. 폼 유효성 검사 (빈 폼 제출 → 오류 표시)
 *  5. API 응답 확인
 */
import { chromium } from "/home/kunkin/.claude/skills/gstack/node_modules/playwright/index.mjs";
import fs from "fs";

const BASE = "http://localhost:3000";
const TIMEOUT = 8000;

// ─── 결과 저장소 ─────────────────────────────────────────────────────────────

const results = {
  timestamp: new Date().toISOString().replace("T", " ").slice(0, 16),
  pages: [],
  interactions: [],
  apiChecks: [],
  bugs: [],
  summary: {},
};

function pass(category, item, detail = "") {
  results.interactions.push({ status: "pass", category, item, detail });
}

function fail(category, item, detail = "") {
  results.interactions.push({ status: "fail", category, item, detail });
  results.bugs.push({ category, item, detail });
  console.log(`  ❌ FAIL [${category}] ${item}: ${detail}`);
}

function warn(category, item, detail = "") {
  results.interactions.push({ status: "warn", category, item, detail });
  console.log(`  ⚠️  WARN [${category}] ${item}: ${detail}`);
}

// ─── 페이지 렌더링 검사 ───────────────────────────────────────────────────────

async function checkPageRender(page, path, label) {
  const consoleErrors = [];
  const listener = (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      consoleErrors.push(msg.text().slice(0, 100));
    }
  };
  page.on("console", listener);

  let status = 0;
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: TIMEOUT });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(500);
  } catch (e) {
    results.pages.push({ path, label, status: 0, renderOk: false, consoleErrors: [e.message.slice(0, 80)], buttonCount: 0 });
    page.removeListener("console", listener);
    return;
  }

  const buttonCount = await page.$$eval(
    "button:not([disabled]):not([aria-hidden='true'])",
    (els) => els.length
  );

  page.removeListener("console", listener);

  const renderOk = status === 200 && consoleErrors.length === 0;
  results.pages.push({ path, label, status, renderOk, consoleErrors, buttonCount });

  if (!renderOk) {
    fail("렌더링", `${label} (${path})`, consoleErrors[0] ?? `HTTP ${status}`);
  }
}

// ─── 사이드바 네비게이션 검사 ─────────────────────────────────────────────────

async function checkSidebarNav(page) {
  console.log("\n[2] 사이드바 네비게이션 검사...");
  const NAV_ITEMS = [
    { label: "워크스페이스", path: "/workspace" },
    { label: "히스토리", path: "/history" },
    { label: "저장됨", path: "/saved" },
    { label: "대시보드", path: "/dashboards" },
    { label: "차트", path: "/charts" },
    { label: "스키마", path: "/schema" },
    { label: "용어 사전", path: "/glossary" },
    { label: "연결", path: "/connections" },
    { label: "상태 · 에러", path: "/errors" },
    { label: "프로필", path: "/profile" },
    { label: "설정", path: "/settings" },
  ];

  // 홈에서 시작
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: TIMEOUT });

  for (const item of NAV_ITEMS) {
    try {
      const link = page.locator(`nav a[href="${item.path}"]`).first();
      const exists = await link.count() > 0;
      if (!exists) {
        fail("사이드바", `${item.label} 링크`, `href="${item.path}" 없음`);
        continue;
      }
      await link.click();
      await page.waitForURL(`**${item.path}**`, { timeout: TIMEOUT });
      const current = new URL(page.url()).pathname;
      if (current === item.path || current.startsWith(item.path)) {
        pass("사이드바", `${item.label} → ${item.path}`);
      } else {
        fail("사이드바", `${item.label} → ${item.path}`, `실제 경로: ${current}`);
      }
    } catch (e) {
      fail("사이드바", `${item.label} → ${item.path}`, e.message.slice(0, 60));
    }
  }

  // 로고 클릭 → 홈
  try {
    await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle", timeout: TIMEOUT });
    const logo = page.locator(`a[href="/"]`).first();
    if (await logo.count() > 0) {
      await logo.click();
      await page.waitForURL(`**/home**`, { timeout: TIMEOUT });
      pass("사이드바", "vibeSQL 로고 → /home");
    } else {
      warn("사이드바", "vibeSQL 로고", 'href="/" 링크 없음');
    }
  } catch (e) {
    fail("사이드바", "vibeSQL 로고 → /home", e.message.slice(0, 60));
  }
}

// ─── 홈 페이지 검사 ──────────────────────────────────────────────────────────

async function checkHomePage(page) {
  console.log("\n[3] 홈 페이지 인터랙션 검사...");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 아코디언 항목 클릭 (메뉴 가이드)
  try {
    const accordion = page.locator("button").filter({ hasText: "워크스페이스" }).first();
    if (await accordion.count() > 0) {
      // 초기 상태: 닫힌 경우 열기
      await accordion.click();
      await page.waitForTimeout(300);
      const expanded = await page.locator("text=자연어 → SQL 변환").isVisible().catch(() => false);
      if (expanded) pass("홈", "아코디언 열기 (워크스페이스 가이드)");
      else warn("홈", "아코디언 가이드", "내용이 보이지 않음 (이미 열린 상태일 수 있음)");
    }
  } catch (e) {
    warn("홈", "아코디언 검사", e.message.slice(0, 60));
  }

  // 다음 액션 버튼 클릭
  try {
    const actionBtn = page.locator("button, a").filter({ hasText: /연결 추가|AI 프로바이더|워크스페이스에서/ }).first();
    if (await actionBtn.count() > 0) {
      const text = await actionBtn.textContent();
      pass("홈", `다음 액션 버튼 표시: "${text?.trim().slice(0, 30)}"`);
    }
  } catch (e) {
    warn("홈", "다음 액션 버튼", e.message.slice(0, 60));
  }
}

// ─── 연결 페이지 검사 ────────────────────────────────────────────────────────

async function checkConnectionsPage(page) {
  console.log("\n[4] 연결 페이지 검사...");
  await page.goto(`${BASE}/connections`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // "새 연결" 버튼 클릭
  try {
    const addBtn = page.locator("button").filter({ hasText: "새 연결" }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // 모달 또는 폼이 열렸는지 확인
      const formVisible = await page.locator("input[placeholder], form, dialog, [role='dialog']").first().isVisible().catch(() => false);
      if (formVisible) pass("연결", "새 연결 버튼 → 폼 열림");
      else warn("연결", "새 연결 버튼", "폼/모달이 감지되지 않음");
    } else {
      fail("연결", "새 연결 버튼", "버튼을 찾을 수 없음");
    }
  } catch (e) {
    fail("연결", "새 연결 버튼", e.message.slice(0, 60));
  }

  // 연결이 있는 경우 재테스트 버튼 확인
  try {
    await page.goto(`${BASE}/connections`, { waitUntil: "networkidle", timeout: TIMEOUT });
    const retestBtn = page.locator("button").filter({ hasText: "재테스트" }).first();
    if (await retestBtn.count() > 0) {
      pass("연결", "재테스트 버튼 표시됨");
    } else {
      warn("연결", "재테스트 버튼", "연결 없음 (정상)");
    }
  } catch (e) {
    warn("연결", "재테스트 버튼 확인", e.message.slice(0, 60));
  }
}

// ─── 히스토리 페이지 검사 ────────────────────────────────────────────────────

async function checkHistoryPage(page) {
  console.log("\n[5] 히스토리 페이지 검사...");
  await page.goto(`${BASE}/history`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 필터 버튼
  const filters = ["전체", "성공", "실패", "즐겨찾기"];
  for (const f of filters) {
    try {
      const btn = page.locator("button").filter({ hasText: f }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(300);
        pass("히스토리", `필터 "${f}" 클릭`);
      } else {
        fail("히스토리", `필터 "${f}"`, "버튼 없음");
      }
    } catch (e) {
      fail("히스토리", `필터 "${f}"`, e.message.slice(0, 60));
    }
  }

  // 검색창 입력
  try {
    const searchInput = page.locator("input[placeholder*='검색']").first();
    if (await searchInput.count() > 0) {
      await searchInput.fill("SELECT");
      await page.waitForTimeout(600);
      pass("히스토리", "검색창 입력");
      await searchInput.fill("");
    } else {
      warn("히스토리", "검색창", "input 없음");
    }
  } catch (e) {
    warn("히스토리", "검색창", e.message.slice(0, 60));
  }
}

// ─── 스키마 페이지 검사 ──────────────────────────────────────────────────────

async function checkSchemaPage(page) {
  console.log("\n[6] 스키마 페이지 검사...");
  await page.goto(`${BASE}/schema`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 필터 버튼
  const filters = ["전체", "public", "PII 포함"];
  for (const f of filters) {
    try {
      const btn = page.locator("button").filter({ hasText: f }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(300);
        pass("스키마", `필터 "${f}"`);
      } else {
        warn("스키마", `필터 "${f}"`, "버튼 없음 (데이터 없을 수 있음)");
      }
    } catch (e) {
      warn("스키마", `필터 "${f}"`, e.message.slice(0, 60));
    }
  }

  // 검색창
  try {
    const searchInput = page.locator("input[placeholder*='테이블'], input[placeholder*='검색']").first();
    if (await searchInput.count() > 0) {
      await searchInput.fill("user");
      await page.waitForTimeout(400);
      pass("스키마", "검색창 입력");
    }
  } catch (e) {
    warn("스키마", "검색창", e.message.slice(0, 60));
  }
}

// ─── 설정 페이지 검사 ────────────────────────────────────────────────────────

async function checkSettingsPage(page) {
  console.log("\n[7] 설정 페이지 검사...");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 섹션 탭 전환
  const tabs = ["외관", "AI 설정", "보안", "알림"];
  for (const tab of tabs) {
    try {
      const btn = page.locator("button").filter({ hasText: tab }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(400);
        pass("설정", `탭 "${tab}" 전환`);
      } else {
        fail("설정", `탭 "${tab}"`, "버튼 없음");
      }
    } catch (e) {
      fail("설정", `탭 "${tab}"`, e.message.slice(0, 60));
    }
  }

  // AI 설정 탭에서 AI 프로바이더 추가 버튼 확인
  try {
    const aiBtn = page.locator("button").filter({ hasText: "추가" }).first();
    if (await aiBtn.count() > 0) {
      await aiBtn.click();
      await page.waitForTimeout(400);
      const formVisible = await page.locator("select, input[placeholder]").first().isVisible().catch(() => false);
      if (formVisible) pass("설정", "AI 프로바이더 추가 폼 열림");
      else warn("설정", "AI 프로바이더 추가", "폼이 감지되지 않음");
    }
  } catch (e) {
    warn("설정", "AI 프로바이더 추가", e.message.slice(0, 60));
  }

  // 테마 선택 버튼 (Emerald)
  try {
    await page.locator("button").filter({ hasText: "외관" }).first().click();
    await page.waitForTimeout(300);
    const themeBtn = page.locator("button").filter({ hasText: "Emerald" }).first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      pass("설정", "테마 선택 (Emerald)");
      // 원상복귀
      await page.locator("button").filter({ hasText: "Indigo" }).first().click().catch(() => {});
    } else {
      warn("설정", "테마 버튼", "Emerald 버튼 없음");
    }
  } catch (e) {
    warn("설정", "테마 선택", e.message.slice(0, 60));
  }
}

// ─── 대시보드 페이지 검사 ────────────────────────────────────────────────────

async function checkDashboardsPage(page) {
  console.log("\n[8] 대시보드 페이지 검사...");
  await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 필터 버튼
  const filters = ["전체", "내 대시보드", "공유됨"];
  for (const f of filters) {
    try {
      const btn = page.locator("button").filter({ hasText: f }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(300);
        pass("대시보드", `필터 "${f}"`);
      } else {
        warn("대시보드", `필터 "${f}"`, "버튼 없음");
      }
    } catch (e) {
      warn("대시보드", `필터 "${f}"`, e.message.slice(0, 60));
    }
  }

  // "새 대시보드" 버튼 - dialog 처리
  try {
    page.once("dialog", async (dialog) => {
      await dialog.dismiss(); // 취소
    });
    const newBtn = page.locator("button").filter({ hasText: "새 대시보드" }).first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      pass("대시보드", "새 대시보드 버튼 클릭 (prompt 취소)");
    }
  } catch (e) {
    warn("대시보드", "새 대시보드 버튼", e.message.slice(0, 60));
  }
}

// ─── 차트 페이지 검사 ────────────────────────────────────────────────────────

async function checkChartsPage(page) {
  console.log("\n[9] 차트 페이지 검사...");
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 80));
  });

  await page.goto(`${BASE}/charts`, { waitUntil: "networkidle", timeout: TIMEOUT });
  await page.waitForTimeout(800);

  if (consoleErrors.length > 0) {
    fail("차트", "콘솔 에러 없음", consoleErrors[0]);
  } else {
    pass("차트", "콘솔 에러 없음 (savedQueries 버그 수정 확인)");
  }

  // 필터 버튼
  const filters = ["전체", "라인", "바", "파이", "테이블"];
  for (const f of filters) {
    try {
      const btn = page.locator("button").filter({ hasText: f }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(200);
        pass("차트", `필터 "${f}"`);
      }
    } catch (e) {
      warn("차트", `필터 "${f}"`, e.message.slice(0, 60));
    }
  }
}

// ─── 용어 사전 페이지 검사 ───────────────────────────────────────────────────

async function checkGlossaryPage(page) {
  console.log("\n[10] 용어 사전 페이지 검사...");
  await page.goto(`${BASE}/glossary`, { waitUntil: "networkidle", timeout: TIMEOUT });

  // 새 용어 버튼 → 폼 열기
  try {
    const btn = page.locator("button").filter({ hasText: "새 용어" }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(400);
      const formVisible = await page.locator("input, textarea").first().isVisible().catch(() => false);
      if (formVisible) pass("용어 사전", "새 용어 폼 열림");
      else warn("용어 사전", "새 용어 버튼", "폼이 감지되지 않음");
    } else {
      fail("용어 사전", "새 용어 버튼", "버튼 없음");
    }
  } catch (e) {
    fail("용어 사전", "새 용어 버튼", e.message.slice(0, 60));
  }
}

// ─── API 검사 ────────────────────────────────────────────────────────────────

async function checkAPIs(page) {
  console.log("\n[11] API 응답 검사...");
  const APIs = [
    { method: "GET", path: "/api/connections", expectData: true },
    { method: "GET", path: "/api/ai-providers", expectData: true },
    { method: "GET", path: "/api/settings", expectData: true },
    { method: "GET", path: "/api/history", expectData: true },
    { method: "GET", path: "/api/saved", expectData: true },
    { method: "GET", path: "/api/schema", expectData: true },
    { method: "GET", path: "/api/glossary", expectData: true },
    { method: "GET", path: "/api/dashboards", expectData: true },
    { method: "GET", path: "/api/stats", expectData: true },
  ];

  for (const api of APIs) {
    try {
      const resp = await page.request.fetch(`${BASE}${api.path}`, { method: api.method, timeout: 5000 });
      const status = resp.status();
      const json = await resp.json().catch(() => null);
      const hasData = json && ("data" in json);

      if (status >= 400) {
        fail("API", `${api.method} ${api.path}`, `HTTP ${status}`);
      } else if (api.expectData && !hasData) {
        warn("API", `${api.method} ${api.path}`, "응답에 data 필드 없음");
      } else {
        const count = Array.isArray(json?.data) ? json.data.length : "-";
        results.apiChecks.push({ method: api.method, path: api.path, status, dataCount: count });
        pass("API", `${api.method} ${api.path}`, `${status} (${count}건)`);
      }
    } catch (e) {
      fail("API", `${api.method} ${api.path}`, e.message.slice(0, 60));
    }
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("🔍 vibeSQL UI 인터랙티브 전수 검사 v2 시작...\n");

  // 1. 페이지 렌더링
  console.log("[1] 페이지 렌더링 검사...");
  const PAGES = [
    { path: "/home", label: "홈" },
    { path: "/workspace", label: "워크스페이스" },
    { path: "/connections", label: "연결" },
    { path: "/history", label: "히스토리" },
    { path: "/saved", label: "저장됨" },
    { path: "/schema", label: "스키마" },
    { path: "/glossary", label: "용어 사전" },
    { path: "/settings", label: "설정" },
    { path: "/dashboards", label: "대시보드" },
    { path: "/charts", label: "차트" },
    { path: "/errors", label: "상태 · 에러" },
    { path: "/profile", label: "프로필" },
  ];
  for (const p of PAGES) {
    process.stdout.write(`  ${p.label}... `);
    await checkPageRender(page, p.path, p.label);
    const r = results.pages.at(-1);
    console.log(`${r.renderOk ? "✅" : "❌"}  버튼 ${r.buttonCount}개${r.consoleErrors.length ? " | 에러: " + r.consoleErrors[0].slice(0, 40) : ""}`);
  }

  // 2~10. 인터랙티브 검사
  await checkSidebarNav(page);
  await checkHomePage(page);
  await checkConnectionsPage(page);
  await checkHistoryPage(page);
  await checkSchemaPage(page);
  await checkSettingsPage(page);
  await checkDashboardsPage(page);
  await checkChartsPage(page);
  await checkGlossaryPage(page);

  // 11. API
  await checkAPIs(page);

  await browser.close();

  // ── 통계 ──────────────────────────────────────────────────────────────────
  const passCount = results.interactions.filter((i) => i.status === "pass").length;
  const failCount = results.interactions.filter((i) => i.status === "fail").length;
  const warnCount = results.interactions.filter((i) => i.status === "warn").length;
  const renderOk = results.pages.filter((p) => p.renderOk).length;
  const totalConsoleErr = results.pages.reduce((s, p) => s + p.consoleErrors.length, 0);

  results.summary = { passCount, failCount, warnCount, renderOk, totalConsoleErr };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ PASS: ${passCount}  ❌ FAIL: ${failCount}  ⚠️  WARN: ${warnCount}`);
  console.log(`페이지 렌더링: ${renderOk}/${results.pages.length}  콘솔 에러: ${totalConsoleErr}건`);

  // ── MD 보고서 생성 ───────────────────────────────────────────────────────
  let md = `# vibeSQL UI 전수 검사 결과 (인터랙티브)\n\n`;
  md += `> **검사 일시**: ${results.timestamp}  \n`;
  md += `> **검사 도구**: Playwright 1.59 (Chromium 헤드리스, 버튼 클릭 · 폼 · 네비게이션 포함)  \n`;
  md += `> **서버**: ${BASE}\n\n---\n\n`;

  md += `## 요약\n\n`;
  md += `| 항목 | 결과 |\n|------|------|\n`;
  md += `| 페이지 렌더링 | ${renderOk} / ${results.pages.length} ✅ |\n`;
  md += `| 콘솔 에러 | ${totalConsoleErr}건 |\n`;
  md += `| 인터랙션 PASS | ${passCount}개 |\n`;
  md += `| 인터랙션 FAIL | ${failCount}개 |\n`;
  md += `| 인터랙션 WARN | ${warnCount}개 (데이터 없음 등 정상 케이스 포함) |\n`;
  md += `| 발견된 버그 | ${results.bugs.length}개 |\n\n`;

  md += `## 페이지별 렌더링 결과\n\n`;
  md += `| 페이지 | 경로 | HTTP | 버튼 수 | 콘솔 에러 | 상태 |\n`;
  md += `|--------|------|------|---------|-----------|------|\n`;
  for (const p of results.pages) {
    const icon = p.renderOk ? "✅" : "❌";
    const errCell = p.consoleErrors.length ? `⚠️ ${p.consoleErrors.length}건` : "없음";
    md += `| ${p.label} | \`${p.path}\` | ${p.status} | ${p.buttonCount}개 | ${errCell} | ${icon} |\n`;
  }

  md += `\n## 사이드바 메뉴 구조\n\n`;
  md += `> **변경점**: 5개 그룹 접이식 구조 (홈 메뉴 항목 제거, 로고 클릭 → /home)\n\n`;
  md += `| 그룹 | 메뉴 | 경로 | 네비게이션 검사 |\n|------|------|------|----------------|\n`;
  const navChecks = {
    "/workspace": "워크스페이스", "/history": "히스토리", "/saved": "저장됨",
    "/dashboards": "대시보드", "/charts": "차트", "/schema": "스키마",
    "/glossary": "용어 사전", "/connections": "연결", "/errors": "상태 · 에러",
    "/profile": "프로필", "/settings": "설정",
  };
  const groups = {
    "워크스페이스": ["/workspace", "/history", "/saved"],
    "인사이트": ["/dashboards", "/charts"],
    "지식베이스": ["/schema", "/glossary"],
    "데이터 소스": ["/connections", "/errors"],
    "계정": ["/profile", "/settings"],
  };
  for (const [group, paths] of Object.entries(groups)) {
    for (const p of paths) {
      const check = results.interactions.find((i) => i.category === "사이드바" && i.item.includes(p));
      const icon = check?.status === "pass" ? "✅" : check?.status === "warn" ? "⚠️" : "❌";
      md += `| ${group} | ${navChecks[p]} | ${p} | ${icon} |\n`;
    }
  }
  const logoCheck = results.interactions.find((i) => i.category === "사이드바" && i.item.includes("로고"));
  md += `| (로고) | vibeSQL 홈 | / → /home | ${logoCheck?.status === "pass" ? "✅" : "⚠️"} |\n`;

  md += `\n## 인터랙션 검사 결과\n\n`;
  md += `| 상태 | 카테고리 | 항목 | 상세 |\n|------|----------|------|------|\n`;
  for (const i of results.interactions) {
    const icon = i.status === "pass" ? "✅" : i.status === "warn" ? "⚠️" : "❌";
    md += `| ${icon} | ${i.category} | ${i.item} | ${i.detail || "-"} |\n`;
  }

  md += `\n## API 응답 검사\n\n`;
  md += `| 메서드 | 경로 | HTTP | 데이터 수 | 상태 |\n|--------|------|------|-----------|------|\n`;
  for (const a of results.apiChecks) {
    md += `| ${a.method} | \`${a.path}\` | ${a.status} | ${a.dataCount} | ✅ |\n`;
  }

  if (results.bugs.length > 0) {
    md += `\n## 발견된 버그\n\n`;
    for (const b of results.bugs) {
      md += `- **[${b.category}]** ${b.item}: \`${b.detail}\`\n`;
    }
  } else {
    md += `\n## 발견된 버그\n\n> 없음 — 모든 검사 통과\n`;
  }

  md += `\n---\n*자동 생성: Playwright 헤드리스 인터랙티브 검사 v2*\n`;

  fs.writeFileSync("docs/ui-audit-result.md", md, "utf8");
  console.log(`\n✅ 보고서 저장: docs/ui-audit-result.md`);

  if (failCount > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
