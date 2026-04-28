#!/usr/bin/env node
// Robust tracer: which interactive element on /home triggers /api/auth/logout?
// - Per-click 1.5s timeout, dialog dismiss, force back to /home
// - Real-time progress to stdout (no head/tail buffering)
// - Stops on first cookie-loss event
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "av-admin@vibesql.local";
const PASSWORD = "TestPass123!";
const DESTRUCTIVE_RX = /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate|취소|cancel|정지|suspend|deactivate/i;
const PER_CLICK_TIMEOUT = 1500;
const POST_CLICK_WAIT = 100;

function log(...a) { process.stdout.write(a.join(" ") + "\n"); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await Promise.all([
  page.waitForResponse(r => r.url().includes("/api/auth/login"), { timeout: 12000 }),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
log("[login]", (await ctx.cookies()).some(c => c.name === "vs-session") ? "OK" : "FAIL");

let logoutCalledOn = null;
let lastClick = "(none)";
page.on("request", r => {
  if (r.url().includes("/api/auth/logout")) {
    logoutCalledOn = lastClick;
    log("\n>>> /api/auth/logout TRIGGERED right after click:", lastClick);
  }
});

// Page errors / dialogs auto-dismiss
page.on("dialog", d => d.dismiss().catch(() => {}));

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 10000 });
await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});

const buttons = await page.locator('button:visible, a[href]:visible, [role=button]:visible').all();
log(`[interactive count] ${buttons.length}`);

// Snapshot all label+text first to avoid stale element refs
const items = [];
for (let i = 0; i < buttons.length; i++) {
  const b = buttons[i];
  const text = (await b.textContent().catch(()=>"") || "").trim();
  const aria = (await b.getAttribute("aria-label").catch(()=>"") || "").trim();
  const href = (await b.getAttribute("href").catch(()=>"") || "").trim();
  const dataTestid = (await b.getAttribute("data-testid").catch(()=>"") || "").trim();
  const label = (text || aria || href).slice(0, 80);
  if (!label) continue;
  if (DESTRUCTIVE_RX.test(label)) continue;
  if (href && href.startsWith("http") && !href.includes("localhost")) continue;
  items.push({ idx: i, text: text.slice(0, 60), aria, href, dataTestid, label });
}
log(`[clickable items after filter] ${items.length}`);

for (let k = 0; k < items.length; k++) {
  if (logoutCalledOn) break;
  const it = items[k];
  lastClick = `[${k}/${items.length}] label="${it.label}" text="${it.text}" aria="${it.aria}" href="${it.href}" testid="${it.dataTestid}"`;
  log("[click]", lastClick);

  // Re-resolve fresh nth element each iteration to avoid stale refs after re-renders
  // Re-navigate to home before each click (cheap; /home loads fast)
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);

  const els = await page.locator('button:visible, a[href]:visible, [role=button]:visible').all();
  const target = els[it.idx];
  if (!target) { log("  (skip: idx out of range after rerender)"); continue; }

  try {
    await target.click({ timeout: PER_CLICK_TIMEOUT });
    await page.waitForTimeout(POST_CLICK_WAIT);
    // Dismiss any dialog
    const dlg = page.locator('[role=dialog]:visible');
    if (await dlg.count() > 0) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(50);
    }
    const stillLoggedIn = (await ctx.cookies()).some(c => c.name === "vs-session");
    if (!stillLoggedIn) {
      log(">>> COOKIE GONE after click:", lastClick);
      logoutCalledOn = lastClick;
      break;
    }
  } catch (e) {
    log("  (click failed: " + (e.message?.slice(0, 80) || "?") + ")");
  }
}

log("\n=== RESULT ===");
log("logoutCalledOn:", logoutCalledOn || "(none in " + items.length + " items)");
log("final cookie:", (await ctx.cookies()).some(c => c.name === "vs-session") ? "PRESENT" : "GONE");
await browser.close();
