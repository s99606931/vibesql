#!/usr/bin/env node
// Deep exhaustive browser test — v2.
// Clicks ALL non-destructive interactive elements on every route.
// Tests forms (typing only, no submit), tabs, dropdowns, modals.
// Per-page "feature health" verdict: ✅ healthy / ⚠️ degraded / ❌ broken.
//
// Usage: node scripts/av-web-test-v2.mjs <output-dir>

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "av-test@vibesql.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestPass123!";
const OUT_DIR = process.argv[2] ?? "docs/03-analysis/web-test-v2";
const NAV_TIMEOUT = 20_000;
const ACTION_TIMEOUT = 4_000;
const MAX_CLICKS_PER_PAGE = 25;
const PER_ROUTE_DEADLINE_MS = 180_000; // 3 min cap per route — prevents whole-run hangs on a single page

const ROUTES = [
  { path: "/home",            slug: "home",            cat: "core",   feature: "워크플로 카드 + 빠른 시작 CTA" },
  { path: "/workspace",       slug: "workspace",       cat: "core",   feature: "NL→SQL 입력창 + 연결 선택 dropdown" },
  { path: "/dashboards",      slug: "dashboards",      cat: "core",   feature: "대시보드 목록 + 신규 작성 버튼" },
  { path: "/charts",          slug: "charts",          cat: "core",   feature: "차트 라이브러리 그리드" },
  { path: "/connections",     slug: "connections",     cat: "data",   feature: "연결 목록 + 신규 연결 추가" },
  { path: "/schema",          slug: "schema",          cat: "data",   feature: "스키마 트리 탐색기" },
  { path: "/catalog",         slug: "catalog",         cat: "data",   feature: "데이터 카탈로그 (soon)" },
  { path: "/glossary",        slug: "glossary",        cat: "data",   feature: "용어 사전 검색 + 신규 추가" },
  { path: "/history",         slug: "history",         cat: "ops",    feature: "쿼리 이력 목록 + 별표/공유" },
  { path: "/saved",           slug: "saved",           cat: "ops",    feature: "저장된 쿼리 + 버전 관리" },
  { path: "/templates",       slug: "templates",       cat: "ops",    feature: "쿼리 템플릿 라이브러리" },
  { path: "/schedules",       slug: "schedules",       cat: "ops",    feature: "스케줄 목록 + 즉시 실행" },
  { path: "/reports",         slug: "reports",         cat: "ops",    feature: "리포트 (soon)" },
  { path: "/profile",         slug: "profile",         cat: "user",   feature: "프로필 정보 + 비밀번호 변경" },
  { path: "/settings",        slug: "settings",        cat: "user",   feature: "환경설정 (테마/언어 등)" },
  { path: "/notifications",   slug: "notifications",   cat: "user",   feature: "알림 (soon)" },
  // admin routes — non-admin will redirect to /home (skip in deep test, verify via auth-block check)
];

const ADMIN_ONLY = ["/admin/users", "/audit-logs", "/errors", "/ai-providers", "/ai-context"];

const DESTRUCTIVE_RX = /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate|취소|cancel/i;

function isDestructive(text) {
  return text && DESTRUCTIVE_RX.test(text);
}

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
    // Verify form login actually set the session cookie; if not, fall through to API fallback.
    const cookies = await page.context().cookies();
    if (cookies.some((c) => c.name === "vs-session")) return "form";
  } catch { /* fall through */ }
  // API fallback — explicitly propagate Set-Cookie to the browser context
  const r = await page.context().request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (r.status() !== 200) throw new Error(`login failed: ${r.status()}`);
  // Extract Set-Cookie value and inject into browser context so page navigations carry it
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
    formsFound: 0,
    modalsOpened: 0,
    consoleErrors: 0,
    network4xx: 0,
    network5xx: 0,
    pageErrors: 0,
    skippedDestructive: [],
    notes: [],
    verdict: "unknown",
    durationMs: null,
  };

  const start = Date.now();
  try {
    const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    result.httpStatus = resp?.status() ?? "no-resp";
    result.finalUrl = page.url().replace(BASE, "");
    result.title = (await page.title().catch(() => "")).slice(0, 80);
    result.h1 = await page.locator("h1, h2").first().innerText({ timeout: 2000 }).catch(() => "");
    result.h1 = (result.h1 || "").slice(0, 100);

    if (result.finalUrl.startsWith("/signin")) {
      result.notes.push("redirected to /signin (auth lost)");
      result.verdict = "broken";
    }

    // Screenshot
    await page.screenshot({ path: path.join(outDir, `${route.slug}.png`), fullPage: true, timeout: 8000 }).catch((e) => {
      result.notes.push(`screenshot fail: ${e.message?.slice(0, 60)}`);
    });

    // Enumerate interactive elements + counts
    const enumeration = await page.evaluate(() => {
      const out = { buttons: [], links: [], inputs: 0, textareas: 0, selects: 0, forms: 0, hasDialog: false };
      out.forms = document.querySelectorAll("form").length;
      out.hasDialog = !!document.querySelector('[role="dialog"], dialog[open]');
      document.querySelectorAll("input:not([type=hidden]):not([disabled])").forEach((i) => out.inputs++);
      document.querySelectorAll("textarea:not([disabled])").forEach(() => out.textareas++);
      document.querySelectorAll("select:not([disabled])").forEach(() => out.selects++);
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      Array.from(document.querySelectorAll('button:not([disabled])')).slice(0, 80).forEach((b, i) => {
        if (!visible(b)) return;
        out.buttons.push({
          i,
          text: (b.innerText || b.getAttribute("aria-label") || b.title || "").trim().slice(0, 50),
          ariaLabel: b.getAttribute("aria-label") || null,
          dataTestid: b.getAttribute("data-testid") || null,
        });
      });
      Array.from(document.querySelectorAll("a[href]")).slice(0, 80).forEach((a, i) => {
        if (!visible(a)) return;
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#") || href.startsWith("mailto:")) return;
        if (/^https?:\/\//.test(href) && !href.includes("localhost")) return;
        out.links.push({
          i,
          text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 50),
          href,
        });
      });
      return out;
    }).catch(() => null);

    if (!enumeration) {
      result.notes.push("enumeration failed");
      result.verdict = "broken";
    } else {
      result.interactiveCount = enumeration.buttons.length + enumeration.links.length;
      result.inputsFound = enumeration.inputs + enumeration.textareas + enumeration.selects;
      result.formsFound = enumeration.forms;

      // Type into safe inputs (text only, do not submit)
      const inputLocs = await page.locator('input[type="text"], input[type="search"], input[type="email"]:not([readonly]), textarea').all().catch(() => []);
      for (const loc of inputLocs.slice(0, 5)) {
        try {
          await loc.fill("test", { timeout: ACTION_TIMEOUT });
          result.inputsTyped++;
        } catch (_) { /* ignore */ }
      }

      // Click buttons (non-destructive, with text or aria-label)
      let clicksDone = 0;
      const beforeUrl = page.url();
      for (const btn of enumeration.buttons) {
        if (clicksDone >= MAX_CLICKS_PER_PAGE) break;
        const txt = btn.text || btn.ariaLabel || "";
        if (!txt) continue;
        if (isDestructive(txt)) {
          result.skippedDestructive.push(txt);
          continue;
        }
        result.clicksAttempted++;
        try {
          // Prefer testid → aria-label → text
          let loc;
          if (btn.dataTestid) {
            loc = page.locator(`[data-testid="${btn.dataTestid}"]`).first();
          } else if (btn.ariaLabel) {
            loc = page.getByLabel(btn.ariaLabel, { exact: true }).first();
            const cnt = await loc.count().catch(() => 0);
            if (cnt === 0) loc = page.locator(`button[aria-label="${btn.ariaLabel.replace(/"/g, '\\"')}"]`).first();
          } else {
            loc = page.locator(`button:has-text(${JSON.stringify(txt.slice(0, 30))})`).first();
          }
          await loc.click({ timeout: ACTION_TIMEOUT, trial: false });
          result.clicksSucceeded++;
          clicksDone++;
          // Brief settle
          await page.waitForTimeout(200);
          // Detect modal opened
          const modalNow = await page.locator('[role="dialog"], dialog[open]').count().catch(() => 0);
          if (modalNow > 0) {
            result.modalsOpened++;
            // Try to close via Escape
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(150);
          }
          // If navigated, return to original page
          if (page.url() !== beforeUrl) {
            await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(500);
          }
        } catch (e) {
          // Quietly track failure rate (don't spam notes)
        }
      }
    }
  } catch (e) {
    result.notes.push(`nav fail: ${e.message?.slice(0, 200)}`);
    result.verdict = "broken";
  } finally {
    result.durationMs = Date.now() - start;
    result.consoleErrors = consoleLogs.filter((m) => m.type === "error").length;
    result.network4xx = networkLogs.filter((n) => n.status >= 400 && n.status < 500).length;
    result.network5xx = networkLogs.filter((n) => n.status >= 500).length;
    result.pageErrors = pageErrors.length;

    // Verdict computation — based on real errors, not click ratio (clicks fail naturally
    // when buttons navigate away or open transient overlays; that's not a product bug).
    if (result.verdict === "unknown") {
      if (result.network5xx > 0 || result.pageErrors > 0 || result.httpStatus >= 500) result.verdict = "broken";
      else if (result.consoleErrors > 0 || result.network4xx > 0) result.verdict = "degraded";
      else result.verdict = "healthy";
    }

    await fs.writeFile(path.join(outDir, `${route.slug}.raw.json`), JSON.stringify({ result, consoleLogs, networkLogs, pageErrors }, null, 2));
    await page.close();
  }
  return result;
}

async function authBlockCheck(context, paths) {
  const out = [];
  const page = await context.newPage();
  for (const p of paths) {
    try {
      const resp = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      const finalUrl = page.url().replace(BASE, "");
      out.push({ path: p, httpStatus: resp?.status() ?? null, finalUrl, blocked: finalUrl !== p });
    } catch (e) {
      out.push({ path: p, error: e.message?.slice(0, 100) });
    }
  }
  await page.close();
  return out;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`[v2] BASE=${BASE} OUT_DIR=${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Guard: block logout endpoint so accidental clicks during deep test can't kill the session
  await context.route("**/api/auth/logout", (r) => r.abort());
  const lp = await context.newPage();
  const loginMethod = await login(lp);
  await lp.close();

  const summary = { base: BASE, email: EMAIL, loginMethod, startedAt: new Date().toISOString(), routes: [], adminBlockCheck: [], partial: false };

  // Persist partial summary on abnormal exit so an external kill leaves usable data
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
    process.stdout.write(`[deep] ${route.path.padEnd(20)} ... `);
    const deadline = new Promise((resolve) => setTimeout(() => resolve({
      path: route.path, slug: route.slug,
      finalUrl: null, httpStatus: null,
      interactiveCount: 0, clicksAttempted: 0, clicksSucceeded: 0,
      inputsFound: 0, inputsTyped: 0, modalsOpened: 0,
      consoleErrors: 0, network4xx: 0, network5xx: 0, pageErrors: 0,
      durationMs: PER_ROUTE_DEADLINE_MS,
      verdict: "timeout",
      notes: [`route deadline ${PER_ROUTE_DEADLINE_MS}ms exceeded`],
    }), PER_ROUTE_DEADLINE_MS));
    const r = await Promise.race([deepTest(context, route, OUT_DIR), deadline]);
    summary.routes.push(r);
    console.log(`${(r.verdict || "?").padEnd(8)} clicks=${r.clicksSucceeded}/${r.clicksAttempted} inputs=${r.inputsTyped}/${r.inputsFound} modals=${r.modalsOpened} consoleErr=${r.consoleErrors} 4xx=${r.network4xx} 5xx=${r.network5xx} (${r.durationMs}ms)`);
    summary.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2)).catch(() => {});
  }

  console.log(`[adminBlockCheck] verifying admin routes redirect for USER role`);
  summary.adminBlockCheck = await authBlockCheck(context, ADMIN_ONLY);
  for (const a of summary.adminBlockCheck) {
    console.log(`  ${a.path} -> ${a.finalUrl} (blocked=${a.blocked})`);
  }

  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log(`\n[v2] DONE. Summary: ${OUT_DIR}/summary.json`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
