#!/usr/bin/env node
// Admin-role exhaustive browser test — extends v2 with admin-only routes.
// Logs in as ADMIN, deep-tests USER routes + 5 admin-only routes
// (/admin/users, /audit-logs, /errors, /ai-providers, /ai-context).
//
// Usage: E2E_EMAIL=av-admin@vibesql.local E2E_PASSWORD=TestPass123! \
//        node scripts/av-web-test-admin.mjs <output-dir>

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "av-admin@vibesql.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestPass123!";
const OUT_DIR = process.argv[2] ?? "docs/03-analysis/web-test-admin";
const NAV_TIMEOUT = 20_000;
const ACTION_TIMEOUT = 4_000;
const MAX_CLICKS_PER_PAGE = 25;

const ROUTES = [
  { path: "/home",            slug: "home",            cat: "core",   feature: "워크플로 카드 + 빠른 시작 CTA (admin: ai-providers fetch enabled)" },
  { path: "/workspace",       slug: "workspace",       cat: "core",   feature: "NL→SQL 입력창" },
  { path: "/dashboards",      slug: "dashboards",      cat: "core",   feature: "대시보드 목록" },
  { path: "/charts",          slug: "charts",          cat: "core",   feature: "차트 라이브러리" },
  { path: "/connections",     slug: "connections",     cat: "data",   feature: "연결 목록" },
  { path: "/schema",          slug: "schema",          cat: "data",   feature: "스키마 트리" },
  { path: "/catalog",         slug: "catalog",         cat: "data",   feature: "데이터 카탈로그" },
  { path: "/glossary",        slug: "glossary",        cat: "data",   feature: "용어 사전" },
  { path: "/history",         slug: "history",         cat: "ops",    feature: "쿼리 이력" },
  { path: "/saved",           slug: "saved",           cat: "ops",    feature: "저장된 쿼리" },
  { path: "/templates",       slug: "templates",       cat: "ops",    feature: "쿼리 템플릿" },
  { path: "/schedules",       slug: "schedules",       cat: "ops",    feature: "스케줄 목록" },
  { path: "/reports",         slug: "reports",         cat: "ops",    feature: "리포트" },
  { path: "/profile",         slug: "profile",         cat: "user",   feature: "프로필" },
  { path: "/settings",        slug: "settings",        cat: "user",   feature: "환경설정" },
  { path: "/notifications",   slug: "notifications",   cat: "user",   feature: "알림" },
  // ADMIN-only deep tests
  { path: "/admin/users",     slug: "admin-users",     cat: "admin",  feature: "사용자 관리 (목록/role 변경/삭제)" },
  { path: "/audit-logs",      slug: "audit-logs",      cat: "admin",  feature: "감사 로그 뷰어" },
  { path: "/errors",          slug: "errors",          cat: "admin",  feature: "에러 로그 뷰어" },
  { path: "/ai-providers",    slug: "ai-providers",    cat: "admin",  feature: "AI 프로바이더 관리" },
  { path: "/ai-context",      slug: "ai-context",      cat: "admin",  feature: "AI 컨텍스트 룰" },
];

const DESTRUCTIVE_RX = /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate|취소|cancel|정지|suspend|deactivate/i;

function isDestructive(text) { return text && DESTRUCTIVE_RX.test(text); }

async function login(page) {
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  try {
    await page.locator('input[type="email"]').first().fill(EMAIL, { timeout: 3000 });
    await page.locator('input[type="password"]').first().fill(PASSWORD, { timeout: 3000 });
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST", { timeout: 12000 }),
      page.locator('button[type="submit"]').first().click({ timeout: 3000 }),
    ]);
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    const cookies = await page.context().cookies();
    if (cookies.some((c) => c.name === "vs-session")) return "form";
  } catch { /* fall through */ }
  const r = await page.context().request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (r.status() !== 200) throw new Error(`login failed: ${r.status()}`);
  const setCookie = r.headers()["set-cookie"] ?? "";
  const m = /vs-session=([^;]+)/.exec(setCookie);
  if (m) {
    await page.context().addCookies([{ name: "vs-session", value: m[1], domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  }
  return "api";
}

async function deepTest(context, route, outDir) {
  const page = await context.newPage();
  const consoleLogs = [];
  const networkLogs = [];
  const pageErrors = [];

  page.on("console", (m) => consoleLogs.push({ type: m.type(), text: m.text().slice(0, 400) }));
  page.on("pageerror", (e) => pageErrors.push({ message: e.message?.slice(0, 400) }));
  page.on("response", (r) => {
    const status = r.status();
    if (status >= 400 && !r.url().startsWith("data:") && !/_next\/static/.test(r.url())) {
      networkLogs.push({ url: r.url().replace(BASE, ""), status, method: r.request().method() });
    }
  });

  const result = {
    path: route.path,
    slug: route.slug,
    cat: route.cat,
    feature: route.feature,
    finalUrl: null,
    httpStatus: null,
    title: null,
    h1: null,
    interactiveCount: 0,
    clicksAttempted: 0,
    clicksSucceeded: 0,
    inputsFound: 0,
    inputsTyped: 0,
    modalsOpened: 0,
    consoleErrors: 0,
    network4xx: 0,
    network5xx: 0,
    durationMs: 0,
    verdict: "✅ healthy",
    issues: [],
  };

  const t0 = Date.now();
  try {
    const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    result.httpStatus = resp?.status() ?? null;
    result.finalUrl = page.url().replace(BASE, "");
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});

    // Admin redirect check: if admin route redirected away, mark as broken (admin should NOT be redirected)
    if (route.cat === "admin" && !result.finalUrl.startsWith(route.path)) {
      result.issues.push(`ADMIN role redirected from ${route.path} to ${result.finalUrl}`);
      result.verdict = "❌ broken";
    }

    result.title = await page.title();
    result.h1 = await page.locator("h1, [role=heading][aria-level='1']").first().textContent({ timeout: 1500 }).catch(() => null);

    // Screenshot
    await page.screenshot({ path: path.join(outDir, `${route.slug}.png`), fullPage: false }).catch(() => {});

    // Enumerate interactive elements
    const buttons = await page.locator('button:visible, a[href]:visible, [role=button]:visible').all();
    result.interactiveCount = buttons.length;

    const safeButtons = [];
    for (const b of buttons.slice(0, 80)) {
      const text = (await b.textContent().catch(() => "") || "").trim();
      const aria = (await b.getAttribute("aria-label").catch(() => "") || "").trim();
      const href = (await b.getAttribute("href").catch(() => "") || "").trim();
      const label = text || aria || href;
      if (!label) continue;
      if (isDestructive(label)) continue;
      if (href && (href.startsWith("http") && !href.includes("localhost"))) continue;
      safeButtons.push({ el: b, label: label.slice(0, 60) });
    }

    // Click safe buttons (max N, navigate-back if route changes)
    const startUrl = page.url();
    for (let i = 0; i < Math.min(safeButtons.length, MAX_CLICKS_PER_PAGE); i++) {
      const { el, label } = safeButtons[i];
      result.clicksAttempted++;
      try {
        await el.click({ timeout: ACTION_TIMEOUT, trial: false });
        result.clicksSucceeded++;
        await page.waitForTimeout(150);
        // close any opened dialog
        const dialog = page.locator('[role=dialog]:visible');
        if (await dialog.count() > 0) {
          result.modalsOpened++;
          await page.keyboard.press("Escape").catch(() => {});
        }
        if (page.url() !== startUrl) {
          await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
        }
      } catch { /* click failed silently */ }
    }

    // Find all text inputs and type a probe value (no submit)
    const inputs = await page.locator('input[type="text"]:visible, input[type="search"]:visible, input:not([type]):visible, textarea:visible').all();
    result.inputsFound = inputs.length;
    for (const inp of inputs.slice(0, 8)) {
      try {
        await inp.fill("av-probe", { timeout: 1500 });
        result.inputsTyped++;
      } catch { /* skip */ }
    }

    result.consoleErrors = consoleLogs.filter((l) => l.type === "error").length + pageErrors.length;
    result.network4xx = networkLogs.filter((n) => n.status >= 400 && n.status < 500).length;
    result.network5xx = networkLogs.filter((n) => n.status >= 500).length;
    result.consoleSamples = consoleLogs.filter((l) => l.type === "error").slice(0, 5);
    result.networkSamples = networkLogs.slice(0, 8);

    if (result.network5xx > 0 || result.consoleErrors > 0) result.verdict = "❌ broken";
    else if (result.network4xx > 0 && route.cat !== "admin") result.verdict = "⚠️ degraded";
    // For admin role, 4xx on admin endpoints might be expected (e.g., empty state) — still flag
    else if (result.network4xx > 0) result.verdict = "⚠️ degraded";
  } catch (e) {
    result.verdict = "❌ broken";
    result.issues.push(`navigate error: ${e.message?.slice(0, 200)}`);
  }
  result.durationMs = Date.now() - t0;
  await page.close();
  return result;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`[admin] BASE=${BASE} EMAIL=${EMAIL} OUT_DIR=${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Guard: block logout endpoint so accidental clicks during deep test can't kill the session
  await context.route("**/api/auth/logout", (r) => r.abort());
  const lp = await context.newPage();
  const loginMethod = await login(lp);
  await lp.close();

  const summary = { base: BASE, email: EMAIL, role: "ADMIN", loginMethod, startedAt: new Date().toISOString(), routes: [] };

  for (const route of ROUTES) {
    process.stdout.write(`[admin-deep] ${route.path.padEnd(20)} ... `);
    const r = await deepTest(context, route, OUT_DIR);
    summary.routes.push(r);
    console.log(`${r.verdict.padEnd(8)} clicks=${r.clicksSucceeded}/${r.clicksAttempted} inputs=${r.inputsTyped}/${r.inputsFound} modals=${r.modalsOpened} consoleErr=${r.consoleErrors} 4xx=${r.network4xx} 5xx=${r.network5xx} (${r.durationMs}ms)`);
  }

  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log(`\n[admin] DONE. Summary: ${OUT_DIR}/summary.json`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
