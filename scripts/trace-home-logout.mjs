#!/usr/bin/env node
// Trace which interactive element on /home triggers /api/auth/logout
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "av-admin@vibesql.local";
const PASSWORD = "TestPass123!";
const DESTRUCTIVE_RX = /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate|취소|cancel|정지|suspend|deactivate/i;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Form login
await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await Promise.all([
  page.waitForResponse(r => r.url().includes("/api/auth/login")),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForLoadState("domcontentloaded");
console.log("login OK, cookie set:", (await ctx.cookies()).some(c => c.name === "vs-session"));

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(()=>{});

let lastClickedLabel = "(none)";
page.on("request", r => {
  if (r.url().includes("/api/auth/logout")) {
    console.log("\n>>> LOGOUT TRIGGERED after click on:", lastClickedLabel);
  }
});

const buttons = await page.locator('button:visible, a[href]:visible, [role=button]:visible').all();
console.log("interactive count:", buttons.length);

for (let i = 0; i < buttons.length; i++) {
  const b = buttons[i];
  const text = (await b.textContent().catch(()=>"") || "").trim();
  const aria = (await b.getAttribute("aria-label").catch(()=>"") || "").trim();
  const href = (await b.getAttribute("href").catch(()=>"") || "").trim();
  const label = (text || aria || href).slice(0, 60);
  if (!label) continue;
  if (DESTRUCTIVE_RX.test(label)) continue;
  if (href && href.startsWith("http") && !href.includes("localhost")) continue;
  lastClickedLabel = `[${i}] "${label}" text="${text.slice(0,30)}" aria="${aria.slice(0,30)}" href="${href.slice(0,30)}"`;
  try {
    await b.click({ timeout: 2000 });
    await page.waitForTimeout(200);
    // Check if cookie still exists
    const stillLoggedIn = (await ctx.cookies()).some(c => c.name === "vs-session");
    if (!stillLoggedIn) {
      console.log("\n>>> COOKIE GONE after click on:", lastClickedLabel);
      break;
    }
    // back to home if navigated
    if (!page.url().includes("/home")) {
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 5000 }).catch(()=>{});
    }
    // close modal
    const dialog = page.locator('[role=dialog]:visible');
    if (await dialog.count() > 0) await page.keyboard.press("Escape").catch(()=>{});
  } catch (e) {
    // skip click failures silently
  }
}

console.log("\nFinal cookie state:", (await ctx.cookies()).some(c => c.name === "vs-session") ? "STILL LOGGED IN" : "LOGGED OUT");
await browser.close();
