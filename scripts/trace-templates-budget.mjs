// Verify ADMIN /templates fits inside the per-route budget after maxClicks=8 cap.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route("**/api/auth/logout", r => r.abort());
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + (e.message || "?").slice(0,200)));
page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0,200)); });

const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: "av-admin@vibesql.local", password: "TestPass123!" } });
const cookie = (r.headers()["set-cookie"] || "").match(/vs-session=([^;]+)/)?.[1];
if (cookie) await ctx.addCookies([{ name: "vs-session", value: cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);

const t0 = Date.now();
await page.goto(`${BASE}/templates`, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(()=>{});

// Run the same enumeration as av-web-test-admin
const items = await page.evaluate(() => {
  const inHidden = (el) => { for (let c=el;c&&c!==document.body;c=c.parentElement) if (c.getAttribute&&c.getAttribute("aria-hidden")==="true") return true; return false; };
  const inVp = (el) => { const r = el.getBoundingClientRect(); return r.right>0 && r.left<window.innerWidth && r.bottom>0 && r.top<window.innerHeight; };
  const visible = (el) => { if (inHidden(el)) return false; const r=el.getBoundingClientRect(); const s=window.getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=="hidden" && s.display!=="none" && s.pointerEvents!=="none" && inVp(el); };
  return Array.from(document.querySelectorAll('button:not([disabled]), a[href], [role="button"]')).slice(0,80).filter(visible).length;
});
console.log("[items enumerated]", items);

const DESTRUCTIVE = /삭제|delete|remove|drop|초기화|reset|disconnect|로그아웃|logout|sign\s*out|revoke|terminate|취소|cancel|정지|suspend|deactivate/i;
const cap = 8;
let clicked = 0;
const all = await page.evaluate(() => {
  const inHidden=(el)=>{for(let c=el;c&&c!==document.body;c=c.parentElement)if(c.getAttribute&&c.getAttribute("aria-hidden")==="true")return true;return false};
  const inVp=(el)=>{const r=el.getBoundingClientRect();return r.right>0&&r.left<window.innerWidth&&r.bottom>0&&r.top<window.innerHeight};
  const v=(el)=>{if(inHidden(el))return false;const r=el.getBoundingClientRect();const s=window.getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&s.pointerEvents!=="none"&&inVp(el)};
  return Array.from(document.querySelectorAll('button:not([disabled]), a[href], [role="button"]')).slice(0,80).filter(v).map(el => ({
    tag: el.tagName.toLowerCase(),
    text: (el.innerText||el.textContent||"").trim().slice(0,40),
    aria: el.getAttribute("aria-label")||"",
    testid: el.getAttribute("data-testid")||"",
    href: el.getAttribute("href")||"",
  }));
});

for (const it of all) {
  if (clicked >= cap) break;
  const label = it.text || it.aria || it.href;
  if (!label || DESTRUCTIVE.test(label)) continue;
  let loc;
  if (it.testid) loc = page.locator(`[data-testid="${it.testid}"]:visible`).first();
  else if (it.aria) loc = page.locator(`${it.tag}[aria-label="${it.aria.replace(/"/g,'\\"')}"]:visible`).first();
  else if (it.text) loc = page.locator(`${it.tag}:visible`, { hasText: it.text }).first();
  else if (it.href) loc = page.locator(`a[href="${it.href.replace(/"/g,'\\"')}"]:visible`).first();
  try {
    await loc.click({ timeout: 4000 });
    clicked++;
    await page.waitForTimeout(150);
    const dlg = await page.locator('[role="dialog"]:visible').count();
    if (dlg > 0) await page.keyboard.press("Escape").catch(()=>{});
    if (page.url() !== `${BASE}/templates`) { await page.goto(`${BASE}/templates`, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(()=>{}); await page.waitForTimeout(150); }
  } catch (e) { console.log("click skip:", label.slice(0,30)); }
}

const elapsed = Date.now() - t0;
console.log(`[done] elapsed=${elapsed}ms clicks=${clicked}/${cap} pageerrors=${errs.length}`);
errs.forEach(e => console.log("  " + e));
await browser.close();
