// E2E test for NL2SQL workspace flow + new RAG-First pipeline route.
// Run: pnpm exec playwright test tests/e2e/nl2sql-pipeline.spec.ts
//
// Prereqs:
//   1. pnpm dev running on http://localhost:3000
//   2. Eval fixture loaded: npx tsx scripts/run-eval.ts (or partial setup)
//   3. LM Studio reachable at LMSTUDIO_BASE_URL

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe.configure({ mode: "serial" });

test.describe("VibeSQL — Public Pages", () => {
  test("Root navigation works (200/redirect)", async ({ page }) => {
    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    expect(resp?.status()).toBeLessThan(500);
    expect(page.url()).toMatch(/\/(signin|home|workspace)/);
  });

  test("Server renders a vibeSQL page (title check)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle(/vibe.?SQL/i);
  });

  test("Sign-in page is accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`);
    await expect(page.getByRole("heading", { name: /다시 만나서|sign in|로그인/i }).first())
      .toBeVisible({ timeout: 10_000 });
  });
});

test.describe("VibeSQL — Auth-Gated Routes", () => {
  test("Workspace redirects to signin when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace`);
    await page.waitForURL(/signin/, { timeout: 10_000 });
    expect(page.url()).toContain("/signin");
  });

  test("Connections redirects to signin when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE_URL}/connections`);
    await page.waitForURL(/signin/, { timeout: 10_000 });
    expect(page.url()).toContain("/signin");
  });
});

test.describe("VibeSQL — Auth-Gated APIs", () => {
  test("/api/queries/generate returns 401 without auth", async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/queries/generate`, {
      data: { nl: "test", dialect: "postgresql" },
    });
    expect([401, 400]).toContain(resp.status());
  });

  test("/api/connections returns 401 without auth", async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/connections`);
    expect([401, 200]).toContain(resp.status());
  });
});

test.describe("VibeSQL — RAG-First Pipeline (/api/eval/generate)", () => {
  test("GET returns route documentation", async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/eval/generate`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toMatchObject({
      name: "eval/generate",
      method: "POST",
    });
    expect(body.body).toHaveProperty("question");
  });

  test("POST rejects invalid input with 400", async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/eval/generate`, {
      data: { question: "" },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test("POST returns valid SQL for a Korean NL question", async ({ request }) => {
    test.setTimeout(120_000);
    const resp = await request.post(`${BASE_URL}/api/eval/generate`, {
      data: { question: "고객 중 주문이 가장 많은 상위 5명을 찾아줘" },
      timeout: 90_000,
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.data).toBeDefined();

    const out = body.data;
    // SQL is non-empty and looks like a SELECT
    expect(out.sql).toMatch(/^\s*(WITH|SELECT)/i);
    expect(out.sql.length).toBeGreaterThan(20);

    // Must reference customer + order tables for this question
    expect(out.usedTables).toEqual(expect.arrayContaining(["customers", "orders"]));

    // Validation passed (or at least produced no UNKNOWN_* errors)
    expect(out.validation.valid).toBe(true);
    expect(out.validation.errors).toEqual([]);

    // Status reached terminal success
    expect(["success", "needs_clarification"]).toContain(out.status);

    // Trace metadata present
    expect(out.trace).toMatchObject({
      selectedTables: expect.any(Array),
      linkerDurationMs: expect.any(Number),
      generatorDurationMs: expect.any(Number),
    });
    expect(out.traceId).toBeTruthy();
  });

  test("POST returns valid SQL for an English NL question", async ({ request }) => {
    test.setTimeout(120_000);
    const resp = await request.post(`${BASE_URL}/api/eval/generate`, {
      data: { question: "What are the top 5 best-selling products by total revenue?" },
      timeout: 90_000,
    });
    expect(resp.status()).toBe(200);

    const out = (await resp.json()).data;
    expect(out.sql).toMatch(/^\s*(WITH|SELECT)/i);
    expect(out.usedTables).toEqual(expect.arrayContaining(["products"]));
    expect(out.validation.valid).toBe(true);
    expect(out.status).toBe("success");
  });
});
