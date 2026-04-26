#!/usr/bin/env node
// Load .env.local if present (for standalone usage outside Next.js)
const fs = require("fs"), path = require("path");
const envFile = path.join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const optional = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
const missing = [];

// DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.log("⚠️   DATABASE_URL (optional — in-memory fallback active)");
} else {
  console.log("✅  DATABASE_URL");
}

// LLM: LM Studio takes priority over Anthropic
if (process.env.LMSTUDIO_BASE_URL) {
  console.log(`✅  LMSTUDIO_BASE_URL = ${process.env.LMSTUDIO_BASE_URL}`);
  console.log(`✅  LMSTUDIO_MODEL    = ${process.env.LMSTUDIO_MODEL ?? "(default: local-model)"}`);
  if (process.env.LMSTUDIO_API_KEY) console.log("✅  LMSTUDIO_API_KEY");
  else console.log("⚠️   LMSTUDIO_API_KEY (not set — using 'lm-studio' as default)");
} else if (process.env.ANTHROPIC_API_KEY) {
  console.log("✅  ANTHROPIC_API_KEY (Anthropic fallback active)");
} else {
  missing.push("LMSTUDIO_BASE_URL or ANTHROPIC_API_KEY");
}

for (const key of optional) {
  if (!process.env[key]) console.log(`⚠️   ${key} (optional)`);
  else console.log(`✅  ${key}`);
}

if (missing.length > 0) {
  console.error(`\n❌ LLM이 설정되지 않았습니다.`);
  console.error("  LM Studio: LMSTUDIO_BASE_URL + LMSTUDIO_MODEL + LMSTUDIO_API_KEY");
  console.error("  Anthropic: ANTHROPIC_API_KEY");
  console.error("\n.env.local 에 추가 후 재시작하세요.");
  process.exit(1);
}
console.log("\n✅ 환경 변수 체크 완료. pnpm dev 로 서버를 시작하세요.");
