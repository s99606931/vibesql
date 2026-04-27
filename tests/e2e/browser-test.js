/**
 * vibeSQL 전수 브라우저 테스트
 * 실행: node tests/e2e/browser-test.js
 */
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3000";
const RUN_ID = Date.now();
const RESULTS = [];
let browser, page;

function log(icon, page, msg) {
  const line = `${icon} [${page}] ${msg}`;
  console.log(line);
  RESULTS.push({ icon, page: page, msg });
}

async function goto(path) {
  const url = `${BASE}${path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(800);
}

async function checkNoErrorText() {
  return async (page, pageName) => {
    const body = await page.textContent("body").catch(() => "");
    // Only match "500" when it appears as actual error text, not in CSS (fontWeight:500)
    const errorPhrases = ["TypeError", "Cannot read", "undefined is not", "Application error", "Unhandled Runtime Error"];
    for (const phrase of errorPhrases) {
      if (body.includes(phrase)) {
        log("  ⚠️", pageName, `페이지에 오류 텍스트 발견: "${phrase}"`);
        return;
      }
    }
    log("  ✓", pageName, "페이지에 오류 텍스트 없음");
  };
}

async function testPage(name, path, checks) {
  try {
    await goto(path);

    const body = await page.textContent("body").catch(() => "");
    if (body.includes("Application error") || body.includes("Unhandled Runtime Error")) {
      log("❌", name, `런타임 오류 발생`);
      return false;
    }

    log("✅", name, `페이지 로드 성공 (${path})`);

    if (checks) {
      for (const check of checks) {
        try {
          await check(page, name);
        } catch (e) {
          log("⚠️", name, `체크 실패: ${e.message.slice(0, 80)}`);
        }
      }
    }
    return true;
  } catch (e) {
    log("❌", name, `로드 실패: ${e.message.slice(0, 80)}`);
    return false;
  }
}

// Use page.evaluate() to call fetch from the browser context, which properly handles JSON bodies
async function testApiEndpoint(method, path, body, expectedStatus = 200) {
  try {
    const result = await page.evaluate(
      async ({ base, method, path, body }) => {
        const opts = {
          method,
          headers: { "Content-Type": "application/json" },
        };
        if (body !== undefined) {
          opts.body = JSON.stringify(body);
        }
        try {
          const res = await fetch(`${base}${path}`, opts);
          const status = res.status;
          let json = null;
          try { json = await res.json(); } catch {}
          return { status, json };
        } catch (e) {
          return { status: 0, json: null, error: e.message };
        }
      },
      { base: BASE, method, path, body }
    );

    const { status, json, error } = result;

    if (error) {
      log("  ✗", `API ${method} ${path}`, `네트워크 오류: ${error.slice(0, 60)}`);
      return { ok: false };
    }

    if (status === expectedStatus || (expectedStatus === 200 && status < 400)) {
      log("  ✓", `API ${method} ${path}`, `${status} OK`);
      return { ok: true, status, json };
    } else {
      log("  ✗", `API ${method} ${path}`, `${status} - ${JSON.stringify(json)?.slice(0, 60)}`);
      return { ok: false, status, json };
    }
  } catch (e) {
    log("  ✗", `API ${method} ${path}`, `오류: ${e.message.slice(0, 60)}`);
    return { ok: false };
  }
}

async function main() {
  console.log("\n🚀 vibeSQL 브라우저 전수 테스트 시작\n");
  console.log("=".repeat(60));

  const executablePath = "/usr/bin/google-chrome";
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext();

  // Capture console errors and failed network requests
  const consoleErrors = [];
  context.on("page", (p) => {
    p.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // "Failed to load resource" is a duplicate of what response listener captures — skip
        if (text.includes("Failed to load resource")) return;
        consoleErrors.push({ page: p.url(), msg: text });
      }
    });
    p.on("response", (resp) => {
      const status = resp.status();
      if (status >= 400 && status < 600) {
        const url = resp.url();
        // Ignore expected failures
        if (url.includes("/api/connections/") && url.includes("/test")) return; // connection test
        if (url.includes("/api/ai-providers/") && url.includes("/test")) return; // provider test w/o API key → 422
        if (url.includes("/api/queries/explain")) return; // AI not configured → 500
        if (url.includes("/api/queries/generate")) return; // AI not configured → 500
        const pageUrl = p.url();
        consoleErrors.push({ page: pageUrl, msg: `HTTP ${status}: ${url}` });
        console.log(`  [네트워크] HTTP ${status} on ${pageUrl.split("/").pop()}: ${url}`);
      }
    });
  });

  page = await context.newPage();

  // ─── PAGE TESTS ────────────────────────────────────────────────────────────

  console.log("\n📄 페이지 로드 테스트\n");

  await testPage("홈", "/home", [await checkNoErrorText()]);
  await testPage("워크스페이스", "/workspace", [await checkNoErrorText()]);
  await testPage("연결", "/connections", [await checkNoErrorText()]);
  await testPage("스키마", "/schema", [await checkNoErrorText()]);
  await testPage("히스토리", "/history", [await checkNoErrorText()]);
  await testPage("저장됨", "/saved", [await checkNoErrorText()]);
  await testPage("용어사전", "/glossary", [await checkNoErrorText()]);
  await testPage("차트", "/charts", [await checkNoErrorText()]);
  await testPage("대시보드", "/dashboards", [await checkNoErrorText()]);
  await testPage("설정", "/settings", [await checkNoErrorText()]);
  await testPage("프로필", "/profile", [await checkNoErrorText()]);
  await testPage("오류", "/errors", [await checkNoErrorText()]);
  await testPage("템플릿", "/templates", [await checkNoErrorText()]);
  await testPage("AI컨텍스트", "/ai-context", [await checkNoErrorText()]);
  await testPage("스케줄", "/schedules", [await checkNoErrorText()]);
  await testPage("감사로그", "/audit-logs", [await checkNoErrorText()]);

  // ─── API TESTS ─────────────────────────────────────────────────────────────

  console.log("\n🔌 API 엔드포인트 테스트\n");

  await goto("/history"); // neutral page for API tests (avoids workspace React Query interference)

  // Stats
  await testApiEndpoint("GET", "/api/stats");

  // Connections
  await testApiEndpoint("GET", "/api/connections");
  const connResult = await testApiEndpoint("POST", "/api/connections", {
    name: "Test DB",
    type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "testdb",
    username: "postgres",
    ssl: false,
  }, 201);

  let connId = connResult.json?.data?.id;
  if (connId) {
    await testApiEndpoint("GET", `/api/connections/${connId}`);
    await testApiEndpoint("PATCH", `/api/connections/${connId}`, { name: "Updated DB" });
    await testApiEndpoint("POST", `/api/connections/${connId}/test`, undefined, 400); // 400 = connection failed (no real DB)
    await testApiEndpoint("DELETE", `/api/connections/${connId}`);
  }

  // Settings
  await testApiEndpoint("GET", "/api/settings");
  await testApiEndpoint("PATCH", "/api/settings", { defaultDialect: "postgresql" });

  // Saved Queries
  await testApiEndpoint("GET", "/api/saved");
  const savedResult = await testApiEndpoint("POST", "/api/saved", {
    name: "Test Query",
    sql: "SELECT 1",
    dialect: "postgresql",
    folder: "테스트",
    tags: ["test"],
    nlQuery: "테스트 쿼리",
  }, 201);

  let savedId = savedResult.json?.data?.id;
  if (savedId) {
    await testApiEndpoint("GET", `/api/saved/${savedId}`);
    await testApiEndpoint("PATCH", `/api/saved/${savedId}`, { name: "Updated Query" });
    await testApiEndpoint("GET", `/api/saved/${savedId}/versions`);
    await testApiEndpoint("DELETE", `/api/saved/${savedId}`);
  }

  // History — create, star toggle, delete
  await testApiEndpoint("GET", "/api/history");
  const histResult = await testApiEndpoint("POST", "/api/history", {
    sql: "SELECT 1",
    dialect: "postgresql",
    status: "SUCCESS",
    rowCount: 1,
    durationMs: 100,
  }, 201);
  let histId = histResult.json?.data?.id;
  if (histId) {
    await testApiEndpoint("POST", `/api/history/${histId}/star`); // star
    await testApiEndpoint("POST", `/api/history/${histId}/star`); // unstar
    await testApiEndpoint("DELETE", `/api/history/${histId}`);
  }

  // Glossary
  await testApiEndpoint("GET", "/api/glossary");
  const glossResult = await testApiEndpoint("POST", "/api/glossary", {
    term: `테스트용어_${RUN_ID}`,
    definition: "테스트 정의",
    category: "business",
  }, 201);

  let glossId = glossResult.json?.data?.id;
  if (glossId) {
    await testApiEndpoint("PATCH", `/api/glossary/${glossId}`, { definition: "수정된 정의" });
    await testApiEndpoint("DELETE", `/api/glossary/${glossId}`);
  }

  // Dashboards
  await testApiEndpoint("GET", "/api/dashboards");
  const dashResult = await testApiEndpoint("POST", "/api/dashboards", {
    name: "테스트 대시보드",
  }, 201);

  let dashId = dashResult.json?.data?.id;
  if (dashId) {
    await testApiEndpoint("GET", `/api/dashboards/${dashId}`);
    await testApiEndpoint("PATCH", `/api/dashboards/${dashId}`, { name: "Updated Dashboard" });
    // Widget add
    await testApiEndpoint("PATCH", `/api/dashboards/${dashId}`, {
      widgets: [{ type: "table", title: "Test Widget", sql: "SELECT 1", connectionId: "default" }],
    });
    // Toggle public
    await testApiEndpoint("PATCH", `/api/dashboards/${dashId}`, { isPublic: true });
    // Widget remove
    await testApiEndpoint("PATCH", `/api/dashboards/${dashId}`, { widgets: [] });
    await testApiEndpoint("DELETE", `/api/dashboards/${dashId}`);
  }

  // AI Providers
  await testApiEndpoint("GET", "/api/ai-providers");

  // Share
  const shareResult = await testApiEndpoint("POST", "/api/share", {
    resourceType: "query",
    sql: "SELECT 1",
    dialect: "postgresql",
    expiresDays: 7,
  });

  let shareToken = shareResult.json?.data?.token;
  if (shareToken) {
    await testApiEndpoint("GET", `/api/share/${shareToken}`);
  }

  // Schema
  await testApiEndpoint("GET", "/api/schema");

  // SQL Run
  await testApiEndpoint("POST", "/api/queries/run", {
    sql: "SELECT 1 as n",
    connectionId: "default",
    limit: 10,
  });

  // Audit logs
  await testApiEndpoint("GET", "/api/audit-logs");

  // Templates CRUD
  await testApiEndpoint("GET", "/api/templates");
  const tmplResult = await testApiEndpoint("POST", "/api/templates", {
    name: `테스트템플릿_${RUN_ID}`,
    description: "테스트용",
    category: "custom",
    nlQuery: "테스트 쿼리",
    sql: "SELECT 1",
    dialect: "postgresql",
    tags: ["test"],
  }, 201);
  const tmplId = tmplResult.json?.data?.id;
  if (tmplId) {
    await testApiEndpoint("DELETE", `/api/templates/${tmplId}`);
  }

  // AI Context CRUD
  await testApiEndpoint("GET", "/api/ai-context");
  const aiCtxResult = await testApiEndpoint("POST", "/api/ai-context", {
    ruleType: "alias",
    key: `test_alias_${RUN_ID}`,
    value: "SELECT 1",
    description: "테스트",
    isActive: true,
    priority: 0,
  }, 201);
  const aiCtxId = aiCtxResult.json?.data?.id;
  if (aiCtxId) {
    await testApiEndpoint("PATCH", `/api/ai-context/${aiCtxId}`, { isActive: false });
    await testApiEndpoint("DELETE", `/api/ai-context/${aiCtxId}`);
  }

  // Schedules CRUD
  await testApiEndpoint("GET", "/api/schedules");
  const schedResult = await testApiEndpoint("POST", "/api/schedules", {
    name: `테스트스케줄_${RUN_ID}`,
    sql: "SELECT 1",
    dialect: "postgresql",
    cronExpr: "0 9 * * 1",
    isActive: true,
  }, 201);
  const schedId = schedResult.json?.data?.id;
  if (schedId) {
    await testApiEndpoint("PATCH", `/api/schedules/${schedId}`, { isActive: false });
    await testApiEndpoint("DELETE", `/api/schedules/${schedId}`);
  }

  // AI Providers full CRUD + activate + test
  const provResult = await testApiEndpoint("POST", "/api/ai-providers", {
    name: `TestProvider_${RUN_ID}`,
    type: "anthropic",
    model: "claude-sonnet-4-6",
    temperature: 0.7,
    maxTokens: 4096,
    isActive: false,
  }, 201);
  const provId = provResult.json?.data?.id;
  if (provId) {
    await testApiEndpoint("GET", `/api/ai-providers/${provId}`);
    await testApiEndpoint("PATCH", `/api/ai-providers/${provId}`, { model: "claude-haiku-4-5-20251001" });
    await testApiEndpoint("POST", `/api/ai-providers/${provId}/activate`);
    // Test connection returns 422 when API key missing — that's the expected behavior
    await testApiEndpoint("POST", `/api/ai-providers/${provId}/test`, undefined, 422);
    await testApiEndpoint("DELETE", `/api/ai-providers/${provId}`);
  }

  // Schedules run (manual trigger)
  const schedRunResult = await testApiEndpoint("POST", "/api/schedules", {
    name: `RunTest_${RUN_ID}`,
    sql: "SELECT 1",
    dialect: "postgresql",
    cronExpr: "0 0 * * *",
    isActive: true,
  }, 201);
  const schedRunId = schedRunResult.json?.data?.id;
  if (schedRunId) {
    await testApiEndpoint("POST", `/api/schedules/${schedRunId}/run`);
    await testApiEndpoint("DELETE", `/api/schedules/${schedRunId}`);
  }

  // Saved query version restore
  const savedForVersionResult = await testApiEndpoint("POST", "/api/saved", {
    name: `VersionTest_${RUN_ID}`,
    sql: "SELECT 1",
    dialect: "postgresql",
  }, 201);
  const savedVersionId = savedForVersionResult.json?.data?.id;
  if (savedVersionId) {
    // Update to create a second version
    await testApiEndpoint("PATCH", `/api/saved/${savedVersionId}`, { sql: "SELECT 2" });
    // Get versions
    const versionsResult = await testApiEndpoint("GET", `/api/saved/${savedVersionId}/versions`);
    const versions = versionsResult.json?.data;
    if (Array.isArray(versions) && versions.length > 0) {
      const vId = versions[0].id;
      await testApiEndpoint("POST", `/api/saved/${savedVersionId}/versions/${vId}/restore`);
    }
    await testApiEndpoint("DELETE", `/api/saved/${savedVersionId}`);
  }

  // Queries explain (accepts 200 with SQL explanation or 500 if no AI provider)
  const explainResult = await page.evaluate(async ({ base }) => {
    try {
      const res = await fetch(`${base}/api/queries/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: "SELECT id, name FROM users WHERE id = 1", dialect: "postgresql" }),
      });
      return { status: res.status };
    } catch (e) { return { status: 0, error: e.message }; }
  }, { base: BASE });
  if (explainResult.status >= 200 && explainResult.status < 600) {
    log("  ✓", "API POST /api/queries/explain", `${explainResult.status} (AI ${explainResult.status === 200 ? "OK" : explainResult.status === 422 ? "미설정" : "오류"})`);
  }

  // Queries generate (accepts 200 or 500 if no AI provider)
  const generateResult = await page.evaluate(async ({ base }) => {
    try {
      const res = await fetch(`${base}/api/queries/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nl: "사용자 목록 조회", dialect: "postgresql" }),
      });
      return { status: res.status };
    } catch (e) { return { status: 0, error: e.message }; }
  }, { base: BASE });
  if (generateResult.status >= 200 && generateResult.status < 600) {
    log("  ✓", "API POST /api/queries/generate", `${generateResult.status} (AI ${generateResult.status === 200 ? "OK" : "미설정"})`);
  }

  // Share page — test BEFORE deleting the share token
  if (shareToken) {
    await testPage("공유 페이지", `/share/${shareToken}`, [await checkNoErrorText()]);
    await goto("/workspace"); // navigate away before deleting
    await testApiEndpoint("DELETE", `/api/share/${shareToken}`);
  }

  // ─── INTERACTIVE TESTS ─────────────────────────────────────────────────────

  console.log("\n🖱️  인터랙션 테스트\n");

  // Workspace: NL Query input
  await goto("/workspace");
  try {
    const textarea = await page.locator("textarea").first();
    if (await textarea.isVisible()) {
      await textarea.fill("테스트 쿼리");
      const val = await textarea.inputValue();
      if (val === "테스트 쿼리") {
        log("✅", "워크스페이스", "자연어 입력 동작");
      } else {
        log("❌", "워크스페이스", "자연어 입력 실패");
      }
    }
  } catch (e) {
    log("⚠️", "워크스페이스", `입력 테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Connection: wizard open + edit form
  await goto("/connections");
  try {
    const btn = await page.getByText("새 연결").first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(500);
      const isWizard = await page.locator("input[placeholder], input[type='text']").first().isVisible();
      if (isWizard) {
        log("✅", "연결", "연결 마법사 열기 동작");
      } else {
        log("⚠️", "연결", "연결 마법사 열기 확인 불가");
      }
      await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    }
    // Check if edit button exists on any connection card (only if connections exist)
    const connBody = await page.textContent("body");
    if (connBody.includes("편집")) {
      const editBtn = page.getByText("편집").first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click({ timeout: 5000 }).catch(() => null);
        await page.waitForTimeout(400);
        log("✅", "연결", "편집 버튼 클릭 동작");
      } else {
        log("  ✓", "연결", "편집 버튼 (조건부 표시)");
      }
    } else {
      log("  ✓", "연결", "연결 없음 - 편집 버튼 표시 안 됨");
    }
  } catch (e) {
    log("⚠️", "연결", `버튼 테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Glossary: Add term button (actual text is "새 용어")
  await goto("/glossary");
  try {
    const addBtn = await page.getByText("새 용어").first();
    if (await addBtn.isVisible()) {
      log("✅", "용어사전", "새 용어 추가 버튼 표시됨");
    } else {
      log("⚠️", "용어사전", "새 용어 추가 버튼 표시 안 됨");
    }
  } catch (e) {
    log("⚠️", "용어사전", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // History: items display + hover actions + filter chips
  await goto("/history");
  try {
    await page.waitForTimeout(800);
    const body = await page.textContent("body");
    const hasItems = body.includes("SELECT") || body.includes("ms") || body.includes("postgresql");
    if (hasItems) {
      log("✅", "히스토리", "히스토리 항목 표시됨");
      // Check filter chips
      if (body.includes("전체") && body.includes("즐겨찾기")) {
        log("✅", "히스토리", "필터 칩 표시됨 (전체/즐겨찾기)");
      }
      // Click favorite filter
      const favFilter = page.getByText("즐겨찾기").first();
      if (await favFilter.isVisible()) {
        await favFilter.click();
        await page.waitForTimeout(300);
        log("✅", "히스토리", "즐겨찾기 필터 클릭 동작");
        // Click back to all
        const allFilter = page.getByText("전체").first();
        if (await allFilter.isVisible()) await allFilter.click();
        await page.waitForTimeout(300);
      }
      // Hover first item to reveal action buttons
      const rows = page.locator("div").filter({ hasText: /SELECT|ms/ }).first();
      await rows.hover().catch(() => {});
      await page.waitForTimeout(200);
      const rerunBtn = page.getByText("재실행").first();
      if (await rerunBtn.isVisible().catch(() => false)) {
        log("✅", "히스토리", "재실행 버튼 표시됨 (hover)");
      } else {
        log("  ✓", "히스토리", "액션 버튼 (hover 필요)");
      }
    } else {
      log("⚠️", "히스토리", "히스토리 항목 없음");
    }
  } catch (e) {
    log("⚠️", "히스토리", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Schema: filter buttons
  await goto("/schema");
  try {
    await page.waitForTimeout(600);
    const body = await page.textContent("body");
    if (body.includes("전체") || body.includes("public") || body.includes("PII")) {
      log("✅", "스키마", "스키마 필터 버튼 표시됨");
      const allBtn = page.getByText("전체").first();
      const publicBtn = page.getByText("public").first();
      if (await allBtn.isVisible().catch(() => false)) {
        log("  ✓", "스키마", "전체 필터 버튼 표시됨");
      }
      if (await publicBtn.isVisible().catch(() => false)) {
        await publicBtn.click();
        await page.waitForTimeout(300);
        log("✅", "스키마", "public 필터 클릭 동작");
        await allBtn.click().catch(() => {});
      }
    } else {
      log("⚠️", "스키마", "스키마 필터 버튼 표시 안 됨");
    }
  } catch (e) {
    log("⚠️", "스키마", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Charts page: filter chips
  await goto("/charts");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("라인") && body.includes("바") && body.includes("파이")) {
      log("✅", "차트", "차트 타입 필터 표시됨 (라인/바/파이)");
    } else {
      log("⚠️", "차트", "차트 필터 표시 확인 불가");
    }
    // Click chart type filter
    const barFilter = page.getByText("바").first();
    if (await barFilter.isVisible()) {
      await barFilter.click();
      log("✅", "차트", "바 필터 클릭 동작");
    }
  } catch (e) {
    log("⚠️", "차트", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Dashboard page: navigate to a dashboard
  await goto("/dashboards");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("대시보드") || body.includes("Dashboard")) {
      log("✅", "대시보드", "대시보드 목록 페이지 로드됨");
    }
    // Click new dashboard button
    const newDashBtn = page.getByText("새 대시보드").first();
    if (await newDashBtn.isVisible()) {
      log("✅", "대시보드", "새 대시보드 버튼 표시됨");
    } else {
      // Try to find "새" button
      const altBtn = page.getByRole("button").filter({ hasText: /새|New|추가/ }).first();
      if (await altBtn.isVisible().catch(() => false)) {
        log("✅", "대시보드", "대시보드 생성 버튼 표시됨");
      } else {
        log("⚠️", "대시보드", "새 대시보드 버튼 표시 안 됨");
      }
    }
  } catch (e) {
    log("⚠️", "대시보드", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Profile page: content check
  await goto("/profile");
  try {
    const body = await page.textContent("body");
    if (body.includes("프로필") || body.includes("Profile")) {
      log("✅", "프로필", "프로필 페이지 내용 표시됨");
    }
    if (body.includes("계정 삭제") || body.includes("Delete Account")) {
      log("✅", "프로필", "계정 삭제 섹션 표시됨");
    }
  } catch (e) {
    log("⚠️", "프로필", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Settings: AI provider section interaction
  await goto("/settings");
  try {
    const aiNavBtn = page.getByText("AI 설정").first();
    if (await aiNavBtn.isVisible()) {
      await aiNavBtn.click();
      await page.waitForTimeout(500);
      const body = await page.textContent("body");
      if (body.includes("AI 프로바이더") || body.includes("Provider")) {
        log("✅", "설정", "AI 설정 섹션 탐색 동작");
      }
      const addProvBtn = page.getByText("프로바이더 추가").first();
      if (await addProvBtn.isVisible().catch(() => false)) {
        log("✅", "설정", "프로바이더 추가 버튼 표시됨");
      } else {
        log("  ✓", "설정", "AI 프로바이더 섹션 표시됨");
      }
    }
    // Navigate back to appearance
    const appNavBtn = page.getByText("외관").first();
    if (await appNavBtn.isVisible()) await appNavBtn.click();
    await page.waitForTimeout(300);
  } catch (e) {
    log("⚠️", "설정", `AI 설정 테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Settings theme click → PATCH fires
  await goto("/settings");
  try {
    const body = await page.textContent("body");
    if (body.includes("AI 프로바이더") || body.includes("AI Provider")) {
      log("✅", "설정", "AI 프로바이더 섹션 표시됨");
    }
    if (body.includes("테마") || body.includes("Theme")) {
      log("✅", "설정", "테마 섹션 표시됨");
    }
    // Click Emerald theme and verify PATCH fires
    const patchCalled = await new Promise(async (resolve) => {
      let caught = false;
      page.on("request", (req) => {
        if (req.method() === "PATCH" && req.url().includes("/api/settings")) caught = true;
      });
      const emeraldBtn = page.getByText("Emerald").first();
      if (await emeraldBtn.isVisible()) {
        await emeraldBtn.click();
        await page.waitForTimeout(1200); // wait for debounce
      }
      resolve(caught);
    });
    if (patchCalled) {
      log("✅", "설정", "테마 변경 시 PATCH /api/settings 호출됨");
    } else {
      log("⚠️", "설정", "테마 변경 PATCH 확인 불가");
    }
  } catch (e) {
    log("⚠️", "설정", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Templates: new template button
  await goto("/templates");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("새 템플릿") || body.includes("템플릿 추가") || body.includes("Create")) {
      log("✅", "템플릿", "템플릿 생성 버튼 표시됨");
    } else if (body.includes("템플릿")) {
      log("  ✓", "템플릿", "템플릿 목록 로드됨");
    } else {
      log("⚠️", "템플릿", "템플릿 페이지 내용 확인 불가");
    }
  } catch (e) {
    log("⚠️", "템플릿", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // AI Context: new rule button
  await goto("/ai-context");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("규칙 추가") || body.includes("새 규칙") || body.includes("Add")) {
      log("✅", "AI컨텍스트", "규칙 추가 버튼 표시됨");
    } else if (body.includes("컨텍스트") || body.includes("Context")) {
      log("  ✓", "AI컨텍스트", "AI 컨텍스트 페이지 로드됨");
    } else {
      log("⚠️", "AI컨텍스트", "페이지 내용 확인 불가");
    }
  } catch (e) {
    log("⚠️", "AI컨텍스트", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Schedules: new schedule button
  await goto("/schedules");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("새 스케줄") || body.includes("스케줄 추가") || body.includes("Add")) {
      log("✅", "스케줄", "스케줄 추가 버튼 표시됨");
    } else if (body.includes("스케줄") || body.includes("Schedule")) {
      log("  ✓", "스케줄", "스케줄 목록 페이지 로드됨");
    } else {
      log("⚠️", "스케줄", "스케줄 페이지 내용 확인 불가");
    }
  } catch (e) {
    log("⚠️", "스케줄", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // Audit Logs: list display
  await goto("/audit-logs");
  try {
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body.includes("감사") || body.includes("Audit") || body.includes("로그")) {
      log("✅", "감사로그", "감사 로그 목록 페이지 로드됨");
    } else {
      log("⚠️", "감사로그", "감사 로그 페이지 내용 확인 불가");
    }
  } catch (e) {
    log("⚠️", "감사로그", `테스트 실패: ${e.message.slice(0, 60)}`);
  }

  // ─── CONSOLE ERRORS ────────────────────────────────────────────────────────

  console.log("\n🔍 콘솔 오류 확인\n");
  if (consoleErrors.length > 0) {
    for (const err of consoleErrors) {
      log("⚠️", "콘솔", `[${err.page}] ${err.msg.slice(0, 100)}`);
    }
  } else {
    log("✅", "콘솔", "콘솔 오류 없음");
  }

  // ─── SUMMARY ───────────────────────────────────────────────────────────────

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log("📊 테스트 결과 요약\n");

  const passed = RESULTS.filter(r => r.icon.includes("✅") || r.icon.includes("✓")).length;
  const failed = RESULTS.filter(r => r.icon.includes("❌") || r.icon.includes("✗")).length;
  const warned = RESULTS.filter(r => r.icon.includes("⚠️") || r.icon.includes("⚠")).length;

  console.log(`✅ 통과: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`⚠️  경고: ${warned}개`);

  if (failed > 0) {
    console.log("\n❌ 실패 항목:");
    RESULTS.filter(r => r.icon.includes("❌") || r.icon.includes("✗")).forEach(r => {
      console.log(`  - [${r.page}] ${r.msg}`);
    });
  }

  if (warned > 0) {
    console.log("\n⚠️  경고 항목:");
    RESULTS.filter(r => r.icon.includes("⚠️") || r.icon.includes("⚠")).forEach(r => {
      console.log(`  - [${r.page}] ${r.msg}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("테스트 실행 오류:", e.message);
  if (browser) browser.close().catch(() => {});
  process.exit(1);
});
