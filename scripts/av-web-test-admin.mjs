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
const PER_ROUTE_DEADLINE_MS = 180_000; // 3 min cap per route — prevents whole-run hangs on a single page

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
  { path: "/templates",       slug: "templates",       cat: "ops",    feature: "쿼리 템플릿", maxClicks: 8 },
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

    // Enumerate interactive elements via DOM (snapshot label data — never holds element handles)
    const enumeration = await page.evaluate(() => {
      // Ignore elements whose ancestor is aria-hidden=true or off-viewport via transform
      // (closed AI chat panel uses translateX(100%) + aria-hidden — its children should
      //  not be considered clickable). Without this, Playwright click hangs on
      //  "scroll into view" for elements that can never become visible.
      const inHiddenAncestor = (el) => {
        for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
          if (cur.getAttribute && cur.getAttribute("aria-hidden") === "true") return true;
        }
        return false;
      };
      const inViewport = (el) => {
        const r = el.getBoundingClientRect();
        return r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
      };
      const visible = (el) => {
        if (inHiddenAncestor(el)) return false;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0
          && s.visibility !== "hidden" && s.display !== "none"
          && s.pointerEvents !== "none"
          && inViewport(el);
      };
      const out = { items: [] };
      const all = document.querySelectorAll('button:not([disabled]), a[href], [role="button"]');
      Array.from(all).slice(0, 80).forEach((el) => {
        if (!visible(el)) return;
        const tag = el.tagName.toLowerCase();
        const text = (el.innerText || el.textContent || "").trim().slice(0, 50);
        const ariaLabel = el.getAttribute("aria-label") || "";
        const dataTestid = el.getAttribute("data-testid") || "";
        const href = el.getAttribute("href") || "";
        if (href && /^https?:\/\//.test(href) && !href.includes("localhost")) return;
        out.items.push({ tag, text, ariaLabel, dataTestid, href });
      });
      return out;
    }).catch(() => ({ items: [] }));

    // Dedupe by (tag, text, ariaLabel, href, testid) — same logical button repeated
    // across N cards (template cards, history rows, etc.) collapses to one entry,
    // since `.first()` selector would target the same DOM node anyway.
    const seenKeys = new Set();
    enumeration.items = enumeration.items.filter((it) => {
      const k = `${it.tag}|${it.text}|${it.ariaLabel}|${it.href}|${it.dataTestid}`;
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      return true;
    });
    result.interactiveCount = enumeration.items.length;

    // Click strategy: re-resolve fresh selector each iteration (testid → aria-label → text → href).
    // This avoids the stale-element class of false alarms that cropped up in iter2.
    const startUrl = page.url();
    let clicksDone = 0;
    const cap = route.maxClicks ?? MAX_CLICKS_PER_PAGE;
    for (const item of enumeration.items) {
      if (clicksDone >= cap) break;
      const label = item.text || item.ariaLabel || item.href;
      if (!label) continue;
      if (isDestructive(label)) continue;
      result.clicksAttempted++;

      let loc = null;
      if (item.dataTestid) {
        loc = page.locator(`[data-testid="${item.dataTestid.replace(/"/g, '\\"')}"]:visible`).first();
      } else if (item.ariaLabel) {
        loc = page.locator(`${item.tag}[aria-label="${item.ariaLabel.replace(/"/g, '\\"')}"]:visible`).first();
      } else if (item.text) {
        loc = page.locator(`${item.tag}:visible`, { hasText: item.text }).first();
      } else if (item.href) {
        loc = page.locator(`a[href="${item.href.replace(/"/g, '\\"')}"]:visible`).first();
      }
      if (!loc) continue;

      try {
        await loc.click({ timeout: ACTION_TIMEOUT });
        result.clicksSucceeded++;
        clicksDone++;
        await page.waitForTimeout(150);
        const dialog = page.locator('[role="dialog"]:visible');
        if (await dialog.count() > 0) {
          result.modalsOpened++;
          await page.keyboard.press("Escape").catch(() => {});
          await page.waitForTimeout(80);
        }
        if (page.url() !== startUrl) {
          await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch { /* click missed (re-render or stale) — proceed */ }
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

  const summary = { base: BASE, email: EMAIL, role: "ADMIN", loginMethod, startedAt: new Date().toISOString(), routes: [], partial: false };

  // Persist partial summary on any abnormal exit (SIGTERM, SIGINT, unhandled rejection)
  const writePartial = async (note) => {
    try {
      summary.partial = true;
      summary.partialReason = note;
      summary.finishedAt = new Date().toISOString();
      await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
    } catch { /* best-effort */ }
  };
  process.on("SIGTERM", () => writePartial("SIGTERM").then(() => process.exit(143)));
  process.on("SIGINT",  () => writePartial("SIGINT").then(() => process.exit(130)));
  process.on("unhandledRejection", async (r) => { await writePartial("unhandledRejection: " + (r?.message ?? r)); process.exit(1); });

  for (const route of ROUTES) {
    process.stdout.write(`[admin-deep] ${route.path.padEnd(20)} ... `);
    // Race deepTest against per-route deadline so one bad page can't hang the whole run
    const deadline = new Promise((resolve) => setTimeout(() => resolve({
      path: route.path, slug: route.slug, cat: route.cat, feature: route.feature,
      finalUrl: null, httpStatus: null,
      interactiveCount: 0, clicksAttempted: 0, clicksSucceeded: 0,
      inputsFound: 0, inputsTyped: 0, modalsOpened: 0,
      consoleErrors: 0, network4xx: 0, network5xx: 0,
      durationMs: PER_ROUTE_DEADLINE_MS,
      verdict: "⚠️ timeout",
      issues: [`route deadline ${PER_ROUTE_DEADLINE_MS}ms exceeded`],
    }), PER_ROUTE_DEADLINE_MS));
    const r = await Promise.race([deepTest(context, route, OUT_DIR), deadline]);
    summary.routes.push(r);
    console.log(`${r.verdict.padEnd(8)} clicks=${r.clicksSucceeded}/${r.clicksAttempted} inputs=${r.inputsTyped}/${r.inputsFound} modals=${r.modalsOpened} consoleErr=${r.consoleErrors} 4xx=${r.network4xx} 5xx=${r.network5xx} (${r.durationMs}ms)`);
    // Persist after every route so an external kill leaves a usable file
    summary.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2)).catch(() => {});
  }

  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log(`\n[admin] DONE. Summary: ${OUT_DIR}/summary.json`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
