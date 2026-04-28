# vibeSQL

> **자연어로 데이터에 질문하세요.** 한국어/영어로 질문 → SQL 자동 생성 → 안전하게 실행 → 결과 + 차트.

vibeSQL은 일상 언어 질문("이번 주 매출 상위 10명")을 받아 Claude로 SQL을 생성하고, 연결된 데이터베이스에 읽기 전용으로 실행한 뒤 워크스페이스 UI에 결과를 보여주는 풀스택 NL2SQL 워크벤치입니다. AI 어시스턴트 패널이 SQL 컨텍스트와 함께 항상 떠 있습니다.

[![CI](https://github.com/s99606931/vibesql/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/s99606931/vibesql/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

🇬🇧 [English README](README.md) · 📖 [사용자 가이드](docs/USER_GUIDE.ko.md)

---

## 주요 기능

- **자연어 → SQL** Claude `claude-sonnet-4-6` 기반. 신뢰도 점수와 설명 패널 제공
- **읽기 전용 AST 가드** — 모든 쿼리가 `lib/sql-guard`를 통과해야 DB에 도달 (SELECT 외 차단)
- **워크스페이스** CodeMirror SQL 에디터, 결과 테이블, 차트, 저장/공유, 히스토리
- **스키마 브라우저** 컬럼 이름 휴리스틱으로 PII 자동 감지
- **연결 관리** AES-256-GCM으로 DB 비밀번호 암호화 저장, 지연시간 측정, 상태 표시
- **AI 어시스턴트 패널** 현재 SQL/스키마/방언을 컨텍스트로 받아 마크다운 + 코드 적용 지원
- **관리자** 사용자 역할(USER/ADMIN), 감사 로그, AI 프로바이더/컨텍스트 관리

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Zustand v5 · TanStack React Query v5 · Prisma 7 · PostgreSQL · CodeMirror 6 · Vitest 4 · Playwright 1.59

---

## 빠른 시작 — Docker compose

가장 빠른 실행 방법. Postgres + Next.js standalone을 한 명령으로 띄웁니다.

```bash
git clone https://github.com/s99606931/vibesql.git
cd vibesql

cp .env.docker.example .env.docker
# .env.docker 편집 — ANTHROPIC_API_KEY 설정,
# CONNECTION_ENCRYPTION_KEY와 JWT_SECRET 생성:
#   openssl rand -hex 32

docker compose up -d --build
open http://localhost:3000
```

처음 가입한 계정은 자동으로 **ADMIN** 권한이 부여됩니다. 이후 `/signin`으로 로그인하세요.

중지/제거:

```bash
docker compose down            # 데이터 보존
docker compose down -v         # postgres 볼륨까지 삭제
```

로그 확인:

```bash
docker compose logs -f web
docker compose logs -f postgres
```

---

## 빠른 시작 — 로컬 개발 (Docker 없이)

**Node.js 22+** 와 **PostgreSQL 16+** 가 필요합니다.

```bash
git clone https://github.com/s99606931/vibesql.git
cd vibesql

cp .env.example .env.local
# 필수: DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, CONNECTION_ENCRYPTION_KEY

npm install --legacy-peer-deps
npx prisma generate
npx prisma db push           # DB에 스키마 생성

npm run dev                  # http://localhost:3000
```

`DATABASE_URL`을 비워두면 인메모리 모드로 동작합니다. 시드 계정 `admin@vibesql.dev` / `admin123`으로 즉시 사용 가능 (개발 전용 — 프로덕션에서는 절대 사용 금지).

---

## 환경 변수

| 변수 | 필수 | 설명 |
|---|:---:|---|
| `DATABASE_URL` | ⚠ | PostgreSQL URL. 비우면 인메모리 모드 |
| `ANTHROPIC_API_KEY` | ✅ | SQL 생성 + 채팅용 Claude API 키 |
| `OPENAI_API_KEY` | ⚪ | 대체 프로바이더 |
| `GOOGLE_AI_API_KEY` | ⚪ | 대체 프로바이더 |
| `CONNECTION_ENCRYPTION_KEY` | ✅ | 64자 hex (`openssl rand -hex 32`). 저장된 DB 비밀번호의 AES-256-GCM 키 |
| `JWT_SECRET` | ✅ | `vs-session` 쿠키 서명용 64자 hex |
| `NEXT_PUBLIC_APP_URL` | ⚪ | 리버스 프록시 뒤에서 외부 베이스 URL |
| `VIBESQL_DEV_AUTH_BYPASS` | ⚪ | `1`이면 로컬 dev/test에서 인증 우회 (프로덕션 금지) |
| `VIBESQL_DEV_AS_ADMIN` | ⚪ | `1`이면 dev 우회 사용자에 ADMIN 권한 부여 |

전체 변수 목록: [`.env.example`](.env.example), [`.env.docker.example`](.env.docker.example)

---

## 문서

- 📖 **[사용자 가이드 (한국어)](docs/USER_GUIDE.ko.md)** — 회원가입, 연결 추가, 첫 쿼리, AI 어시스턴트 활용
- 📘 **[User Guide (English)](docs/USER_GUIDE.md)**
- 🚀 **[배포 가이드](DEPLOY-GUIDE.md)** — Railway 배포 단계별 안내
- 🔒 **[보안 정책](SECURITY.md)** — 책임 있는 취약점 보고
- 🤝 **[기여 가이드](CONTRIBUTING.md)** — 브랜칭, 커밋, 코드 스타일
- 📋 **[행동 강령](CODE_OF_CONDUCT.md)** — Contributor Covenant

## 프로젝트 구조

```
src/
  app/
    (app)/                ← 인증 필요 페이지 (workspace, schema, connections, …)
    (auth)/               ← signin / register
    api/                  ← Next.js route handlers
  components/
    shell/                ← AppShell, Sidebar, TopBar, AiChatPanel
    ui-vs/                ← vibeSQL 디자인 시스템 컴포넌트
    ui/                   ← shadcn 브릿지 (수정 금지)
    workspace/            ← SqlEditor, ResultTable, ResultChart
    connections/          ← 연결 관련 UI
  lib/
    claude/               ← Claude API 통합 (NL→SQL 파이프라인)
    sql-guard/            ← AST 가드 (SELECT 검증)
    nl2sql/               ← linker, generator, refiner
    db/                   ← Prisma 클라이언트
    connections/          ← AES-256-GCM 헬퍼
  store/                  ← Zustand 스토어
prisma/                   ← schema.prisma + migrations
tests/e2e/                ← Playwright 스윕 (vitest 실행에서 제외)
```

## npm 스크립트

```bash
npm run dev               # next dev (Turbopack)
npm run build             # next build (standalone)
npm start                 # next start
npm test                  # vitest run (단위 + 통합)
npm run test:watch        # vitest watch 모드
npm run test:coverage     # v8 coverage 리포트
npm run lint              # eslint
```

## 테스트

- **단위/통합**: `npm test` — `src/**/__tests__/**` 아래 275+ 테스트. Vitest 4. React는 jsdom, API는 node 환경
- **E2E**: `tests/e2e/` 아래 Playwright 스윕 — `npx playwright test`로 실행. CI는 단위 테스트만

CI는 프로덕션과 동일한 환경 형태(`DATABASE_URL`, `JWT_SECRET`, `CONNECTION_ENCRYPTION_KEY`)를 요구합니다. 워크플로 정의는 `.github/workflows/ci-cd.yml`에 있습니다.

---

## 라이선스

[MIT](LICENSE) © vibeSQL contributors.
