import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/signin", { waitUntil: "domcontentloaded", timeout: 15000 });

// Try form fill — log if any selector fails
console.log("URL after signin nav:", p.url());
const emailLoc = p.locator('input[type="email"]').first();
const pwLoc = p.locator('input[type="password"]').first();
const btnLoc = p.locator('button[type="submit"]').first();
console.log("email visible:", await emailLoc.isVisible().catch(()=>false));
console.log("pw visible:", await pwLoc.isVisible().catch(()=>false));
console.log("button text:", await btnLoc.textContent().catch(()=>'?'));

await emailLoc.fill("av-admin@vibesql.local");
await pwLoc.fill("TestPass123!");
await Promise.all([
  p.waitForResponse(r => r.url().includes("/api/auth/login") && r.request().method() === "POST", { timeout: 8000 }),
  btnLoc.click(),
]);
await p.waitForLoadState("domcontentloaded", { timeout: 5000 });
console.log("After login URL:", p.url());

// Check cookies on context
const cookies = await ctx.cookies();
console.log("Cookies:", cookies.map(c=>c.name+"="+c.value.slice(0,12)+"...").join(","));

// Navigate to /admin/users
const r = await p.goto("http://localhost:3000/admin/users", { waitUntil: "domcontentloaded", timeout: 15000 });
console.log("/admin/users → status="+r?.status()+" finalUrl="+p.url());

// Navigate to /workspace
const r2 = await p.goto("http://localhost:3000/workspace", { waitUntil: "domcontentloaded", timeout: 15000 });
console.log("/workspace → status="+r2?.status()+" finalUrl="+p.url());

await browser.close();
