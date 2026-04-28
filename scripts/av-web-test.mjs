#!/usr/bin/env node
// Exhaustive browser test for VibeSQL web — all 22 UI routes.
// Usage: node scripts/av-web-test.mjs <output-dir>
// Reads creds from env or defaults to av-test@vibesql.local / TestPass123!

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "av-test@vibesql.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestPass123!";
const OUT_DIR = process.argv[2] ?? "docs/03-analysis/web-test";
const NAV_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 5_000;

const ROUTES = [
  { path: "/home",            slug: "home",            cat: "core" },
  { path: "/workspace",       slug: "workspace",       cat: "core" },
  { path: "/dashboards",      slug: "dashboards",      cat: "core" },
  { path: "/charts",          slug: "charts",          cat: "core" },
  { path: "/connections",     slug: "connections",     cat: "data" },
  { path: "/schema",          slug: "schema",          cat: "data" },
  { path: "/catalog",         slug: "catalog",         cat: "data" },
  { path: "/glossary",        slug: "glossary",        cat: "data" },
  { path: "/ai-providers",    slug: "ai-providers",    cat: "ai" },
  { path: "/ai-context",      slug: "ai-context",      cat: "ai" },
  { path: "/history",         slug: "history",         cat: "ops" },
  { path: "/saved",           slug: "saved",           cat: "ops" },
  { path: "/templates",       slug: "templates",       cat: "ops" },
  { path: "/schedules",       slug: "schedules",       cat: "ops" },
  { path: "/reports",         slug: "reports",         cat: "ops" },
  { path: "/profile",         slug: "profile",         cat: "user" },
  { path: "/settings",        slug: "settings",        cat: "user" },
  { path: "/notifications",   slug: "notifications",   cat: "user" },
  { path: "/admin/users",     slug: "admin-users",     cat: "admin" },
  { path: "/audit-logs",      slug: "audit-logs",      cat: "ops-log" },
  { path: "/errors",          slug: "errors",          cat: "ops-log" },
];

const DESTRUCTIVE_PATTERNS = [
  /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate/i,
];

function isDestructive(text) {
  const t = (text ?? "").trim();
  if (!t) return false;
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(t));
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function login(page) {
  console.log(`[login] navigate /signin`);
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  // Try form first (more realistic), fall back to API call if form fails
  try {
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL, { timeout: 3000 });
    await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD, { timeout: 3000 });
    const submitBtn = page.locator('button[type="submit"]').first();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST", { timeout: 8000 }).catch(() => null),
      submitBtn.click({ timeout: 3000 }),
    ]);
    if (resp && resp.status() === 200) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      console.log(`[login] form login OK, url=${page.url()}`);
      return "form";
    }
  } catch (e) {
    console.log(`[login] form login failed: ${e.message?.slice(0, 100)}`);
  }
  // Fallback: API call to set cookie
  console.log(`[login] fallback to API`);
  const apiResp = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (apiResp.status() !== 200) throw new Error(`API login failed: ${apiResp.status()}`);
  return "api";
}

async function testRoute(context, route, outDir) {
  const page = await context.newPage();
  const consoleLogs = [];
  const networkLogs = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ message: err.message?.slice(0, 500), stack: err.stack?.slice(0, 1000) });
  });
  page.on("response", (resp) => {
    const url = resp.url();
    const status = resp.status();
    if (status >= 400 && !url.startsWith("data:")) {
      networkLogs.push({ url: url.replace(BASE, ""), status, method: resp.request().method() });
    }
  });

  const result = {
    path: route.path,
    slug: route.slug,
    cat: route.cat,
    finalUrl: null,
    status: "unknown",
    loadOk: false,
    title: null,
    consoleErrors: 0,
    consoleWarnings: 0,
    network4xx: 0,
    network5xx: 0,
    pageErrors: 0,
    interactiveCount: 0,
    clicksAttempted: 0,
    clicksSucceeded: 0,
    skippedDestructive: [],
    notes: [],
    durationMs: null,
    screenshot: null,
  };

  const start = Date.now();
  try {
    const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    result.loadOk = !!resp && resp.status() < 500;
    result.status = resp?.status() ?? "no-response";
    result.finalUrl = page.url().replace(BASE, "");
    result.title = (await page.title().catch(() => "")).slice(0, 100);

    // Detect redirect to /signin (auth gate)
    if (result.finalUrl.startsWith("/signin")) {
      result.notes.push("redirected to /signin — auth lost");
    }

    // Screenshot
    const shotPath = path.join(outDir, `${route.slug}.png`);
    await page.screenshot({ path: shotPath, fullPage: true, timeout: 8000 }).catch((e) => {
      result.notes.push(`screenshot fail: ${e.message?.slice(0, 80)}`);
    });
    result.screenshot = path.basename(shotPath);

    // Enumerate clickable elements
    const interactives = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
      return els.slice(0, 100).map((el, idx) => ({
        idx,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.getAttribute("aria-label") || el.title || "").trim().slice(0, 60),
        href: el.getAttribute("href") || null,
        disabled: el.disabled || el.getAttribute("aria-disabled") === "true",
      }));
    }).catch(() => []);
    result.interactiveCount = interactives.length;

    // Click safe non-destructive elements (max 3 per page to keep it bounded)
    const candidates = interactives.filter((el) => {
      if (el.disabled) return false;
      if (isDestructive(el.text)) {
        result.skippedDestructive.push(el.text);
        return false;
      }
      // Skip external links
      if (el.href && /^https?:\/\//.test(el.href) && !el.href.includes("localhost")) return false;
      // Skip empty buttons (likely icons we can't reason about)
      if (!el.text) return false;
      return true;
    }).slice(0, 3);

    for (const cand of candidates) {
      result.clicksAttempted++;
      try {
        const sel = cand.tag === "a"
          ? `a:has-text(${JSON.stringify(cand.text.slice(0, 30))})`
          : `${cand.tag}:has-text(${JSON.stringify(cand.text.slice(0, 30))})`;
        const beforeUrl = page.url();
        await page.locator(sel).first().click({ timeout: ACTION_TIMEOUT, trial: false });
        await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
        result.clicksSucceeded++;
        // If page navigated away, go back
        if (page.url() !== beforeUrl) {
          await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {});
        }
      } catch (e) {
        result.notes.push(`click "${cand.text}" fail: ${e.message?.slice(0, 60)}`);
      }
    }
  } catch (e) {
    result.notes.push(`nav fail: ${e.message?.slice(0, 200)}`);
  } finally {
    result.durationMs = Date.now() - start;
    result.consoleErrors = consoleLogs.filter((m) => m.type === "error").length;
    result.consoleWarnings = consoleLogs.filter((m) => m.type === "warning").length;
    result.network4xx = networkLogs.filter((n) => n.status >= 400 && n.status < 500).length;
    result.network5xx = networkLogs.filter((n) => n.status >= 500).length;
    result.pageErrors = pageErrors.length;
    // Persist raw logs
    const rawPath = path.join(outDir, `${route.slug}.raw.json`);
    await fs.writeFile(rawPath, JSON.stringify({ result, consoleLogs, networkLogs, pageErrors }, null, 2));
    await page.close();
  }
  return result;
}

async function main() {
  await ensureDir(OUT_DIR);
  console.log(`[main] BASE=${BASE} OUT_DIR=${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Login on a dedicated page
  const loginPage = await context.newPage();
  const loginMethod = await login(loginPage);
  await loginPage.close();

  const summary = { base: BASE, email: EMAIL, loginMethod, startedAt: new Date().toISOString(), routes: [] };

  for (const route of ROUTES) {
    process.stdout.write(`[test] ${route.path} ... `);
    const r = await testRoute(context, route, OUT_DIR);
    summary.routes.push(r);
    console.log(`status=${r.status} consoleErr=${r.consoleErrors} 4xx=${r.network4xx} 5xx=${r.network5xx} clicks=${r.clicksSucceeded}/${r.clicksAttempted} (${r.durationMs}ms)`);
  }

  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log(`\n[main] DONE. Summary: ${OUT_DIR}/summary.json`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
