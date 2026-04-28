import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "av-test@vibesql.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestPass123!";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
// Wait for sidebar useCurrentUser to settle
await page.waitForResponse((r) => r.url().includes("/api/auth/me"), { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1000);

const sidebarHrefs = await page.evaluate(() => {
  const aside = document.querySelector("aside, nav");
  return aside
    ? Array.from(aside.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/"))
    : [];
});

const userInfo = await page.evaluate(async () => {
  const r = await fetch("/api/auth/me");
  return r.ok ? await r.json() : { error: r.status };
});

const adminMenuItems = sidebarHrefs.filter((h) =>
  ["/ai-providers", "/ai-context", "/admin/users", "/audit-logs", "/errors"].includes(h)
);

const aiGroupVisible = await page.locator("text=AI 설정").count();
const adminGroupVisible = await page.locator("text=관리자").count();

console.log(JSON.stringify({
  user: userInfo.data,
  sidebarHrefs,
  adminMenuItemsFound: adminMenuItems,
  aiGroupHeaderVisible: aiGroupVisible > 0,
  adminGroupHeaderVisible: adminGroupVisible > 0,
}, null, 2));

await browser.close();
