#!/usr/bin/env node
// Scenario-based feature sweep for VibeSQL.
// Mirrors a realistic user flow through API endpoints to catch integration
// regressions that pure click-enumeration misses. Self-hosts the test DB by
// pointing a connection at the same Postgres the app uses (vibesql_dev).
//
// Usage: E2E_EMAIL=… E2E_PASSWORD=… node scripts/av-web-test-scenarios.mjs <out>
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "av-user@vibesql.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestPass123!";
const OUT_DIR = process.argv[2] ?? "docs/03-analysis/scenarios";

const PG_HOST = "localhost";
const PG_PORT = 5432;
const PG_DB = "vibesql";
const PG_USER = "vibesql";
const PG_PASS = "vibesql_dev";

const results = [];
let cookie = "";

function record(name, ok, info) {
  const verdict = ok ? "✅" : "❌";
  console.log(`${verdict} ${name}${info ? ` — ${info}` : ""}`);
  results.push({ name, ok, info: info ?? null });
}

async function call(method, pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && /vs-session=/.test(setCookie)) {
    cookie = setCookie.split(",").map(s => s.trim()).find(s => s.startsWith("vs-session=")).split(";")[0];
  }
  let payload = null;
  const text = await res.text();
  try { payload = JSON.parse(text); } catch { payload = text; }
  return { status: res.status, payload, headers: Object.fromEntries(res.headers.entries()) };
}

async function login() {
  const r = await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  if (r.status !== 200) {
    record("login", false, `status=${r.status} body=${JSON.stringify(r.payload).slice(0,200)}`);
    process.exit(1);
  }
  record("login", true, `role=${r.payload?.data?.role} cookie=${cookie ? "yes" : "no"}`);
}

async function whoami() {
  const r = await call("GET", "/api/auth/me");
  record("auth.me", r.status === 200, `email=${r.payload?.data?.email} role=${r.payload?.data?.role}`);
}

async function createConnection() {
  const r = await call("POST", "/api/connections", {
    name: `av-scenario-${Date.now()}`,
    type: "postgresql",
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DB,
    username: PG_USER,
    password: PG_PASS,
    ssl: false,
  });
  const ok = r.status === 200 || r.status === 201;
  const id = r.payload?.data?.id;
  record("connections.create", ok, `status=${r.status} id=${id}`);
  return ok ? id : null;
}

async function testConnection(id) {
  const r = await call("POST", `/api/connections/${id}/test`, {});
  const ok = r.status === 200 && (r.payload?.data?.ok === true || r.payload?.data?.success === true);
  record("connections.test", ok, `status=${r.status} body=${JSON.stringify(r.payload?.data ?? r.payload).slice(0,150)}`);
  return ok;
}

async function scanSchema(id) {
  const r = await call("POST", `/api/connections/${id}/scan`, {});
  const ok = r.status === 200;
  const tableCount = Array.isArray(r.payload?.data?.tables) ? r.payload.data.tables.length : (r.payload?.data?.tableCount ?? "?");
  record("connections.scan", ok, `status=${r.status} tables=${tableCount}`);
  return ok;
}

async function listConnections() {
  const r = await call("GET", "/api/connections");
  record("connections.list", r.status === 200, `status=${r.status} count=${(r.payload?.data ?? []).length}`);
}

async function runQuery(id, sql) {
  const r = await call("POST", "/api/queries/run", { sql, connectionId: id });
  const ok = r.status === 200 && r.payload?.data?.rows;
  const rowCount = r.payload?.data?.rows?.length ?? 0;
  record(`queries.run("${sql.slice(0,40)}")`, ok, `status=${r.status} rows=${rowCount}`);
  return ok ? r.payload.data : null;
}

async function postHistory(sql, connectionId) {
  const r = await call("POST", "/api/history", {
    sql,
    dialect: "postgresql",
    status: "SUCCESS",
    rowCount: 1,
    durationMs: 5,
    connectionId,
  });
  const ok = r.status === 200 || r.status === 201;
  record("history.save", ok, `status=${r.status} id=${r.payload?.data?.id}`);
  return ok ? r.payload?.data?.id : null;
}

async function listHistory() {
  const r = await call("GET", "/api/history?limit=10");
  const items = r.payload?.data ?? [];
  record("history.list", r.status === 200, `status=${r.status} items=${items.length}`);
  return items;
}

async function starHistory(id) {
  const r = await call("POST", `/api/history/${id}/star`, {});
  const ok = r.status === 200;
  record("history.star", ok, `status=${r.status} starred=${r.payload?.data?.starred}`);
  return ok;
}

async function saveQuery(sql, connectionId) {
  const r = await call("POST", "/api/saved", {
    name: `av-scenario-saved-${Date.now()}`,
    folder: "기본",
    tags: ["scenario"],
    sql,
    dialect: "postgresql",
    connectionId,
  });
  const ok = r.status === 200 || r.status === 201;
  record("saved.create", ok, `status=${r.status} id=${r.payload?.data?.id}`);
  return ok ? r.payload?.data?.id : null;
}

async function listSaved() {
  const r = await call("GET", "/api/saved");
  const items = r.payload?.data ?? [];
  record("saved.list", r.status === 200, `status=${r.status} items=${items.length}`);
}

async function deleteConnection(id) {
  const r = await call("DELETE", `/api/connections/${id}`, {});
  const ok = r.status === 200 || r.status === 204;
  record("connections.delete", ok, `status=${r.status}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`[scenarios] BASE=${BASE} EMAIL=${EMAIL}`);

  await login();
  await whoami();
  const id = await createConnection();
  if (!id) { console.log("[abort] no connection id"); await dump(); process.exit(2); }

  await testConnection(id);
  await scanSchema(id);
  await listConnections();

  // Run a couple of queries the SQL guard should accept
  const data = await runQuery(id, "SELECT 1 AS one");
  await runQuery(id, "SELECT count(*) AS c FROM users");

  // History flow
  const hid = await postHistory("SELECT 1 AS one", id);
  const hist = await listHistory();
  if (hid) await starHistory(hid);
  else if (hist.length > 0) await starHistory(hist[0].id);

  // Saved flow
  await saveQuery("SELECT 1 AS one", id);
  await listSaved();

  // Cleanup
  await deleteConnection(id);

  // Summary
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  const summary = {
    base: BASE, email: EMAIL,
    startedAt: new Date().toISOString(),
    total: results.length, passed, failedCount: failed.length,
    results,
  };
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\n[scenarios] DONE — passed=${passed}/${results.length} failed=${failed.length}`);
  if (failed.length > 0) {
    console.log("FAILURES:");
    failed.forEach(f => console.log(`  - ${f.name}: ${f.info}`));
  }
  process.exit(failed.length === 0 ? 0 : 3);
}

async function dump() {
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify({ results }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
