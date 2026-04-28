# Security Policy

> 🇰🇷 한국어 안내는 아래 [한국어](#한국어) 섹션을 참고하세요.

## Supported versions

Only the `main` branch is actively maintained. Older tagged releases receive security fixes only on a best-effort basis.

| Version | Status |
|---|---|
| `main` | ✅ Active |
| Previous tags | ⚠ Best-effort |
| `stg` | 🚧 Pre-release |

## Reporting a vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

To report:

1. Open a [private security advisory](https://github.com/s99606931/vibesql/security/advisories/new) on GitHub, **or**
2. Email the maintainers (see commit history for contact addresses).

When reporting include:

- Affected version / commit hash
- Steps to reproduce, ideally a minimal proof-of-concept
- Impact assessment (data exposure, RCE, privilege escalation, …)
- Any suggested fix

We aim to:

- Acknowledge your report within **3 business days**
- Confirm the issue and provide an initial assessment within **7 days**
- Issue a fix within **30 days** for high/critical severity, **60 days** for medium

You'll be credited in the release notes unless you ask to remain anonymous. We do not currently run a paid bug-bounty program.

## What's in scope

- Authentication, authorization, session handling (`vs-session` cookie, JWT)
- SQL guard bypass — anything that lets a non-`SELECT` statement reach the database
- Encryption at rest of stored connection passwords (`CONNECTION_ENCRYPTION_KEY`)
- AI prompt-injection that leaks data across tenants/users
- CSRF, SSRF, XSS, IDOR
- Information disclosure via API responses or error messages
- Dependency vulnerabilities that affect production code paths

## Out of scope

- Self-XSS (you control the input AND the victim is yourself)
- Volumetric DoS (rate-limiting handled at the infra layer)
- Issues requiring physical access to the user's device
- Vulnerabilities in dependencies that don't reach production code paths
- Missing security headers on dev/test endpoints
- Findings that are already documented as known limitations in this file

## Security model — quick reference

| Surface | Protection |
|---|---|
| User-issued SQL | `src/lib/sql-guard` AST validation: rejects anything that isn't a single `SELECT`/`WITH`/`SHOW`/`EXPLAIN` |
| Stored DB passwords | AES-256-GCM with `CONNECTION_ENCRYPTION_KEY` (64-char hex, 32 random bytes). Base64 fallback ONLY when `VIBESQL_DEV_AUTH_BYPASS=1` AND `NODE_ENV ∈ {development, test}` |
| Session | `httpOnly` cookie `vs-session`, JWT signed with `JWT_SECRET`, 7-day expiry |
| Cross-tenant access | Every authenticated query passes through `requireUserId()` and `userId` is injected into all `WHERE` clauses for owned resources |
| Inputs | Zod validation at every API boundary; `safeParse` + 400 on failure |
| Rate limiting | Token-bucket on `/api/queries/*` and auth endpoints |

## Known limitations / by-design choices

- **First registered user becomes ADMIN.** Designed for self-hosted single-tenant use. If you operate a multi-tenant fork, gate this with an env flag.
- **In-memory mode** (no `DATABASE_URL`) seeds a known dev account `admin@vibesql.dev` / `admin123` and prints the credentials to logs. This branch only fires when `NODE_ENV ∈ {development, test}`. **Production must set `DATABASE_URL`.**
- **No password reset flow yet.** Use a real email you control.
- **Schema introspection** runs as the connection's DB user and exposes the `information_schema.columns` listing it can see. Use a least-privilege DB user.

---

## 한국어

### 지원 버전

`main` 브랜치만 능동적으로 유지보수합니다. 과거 태그된 릴리스는 best-effort 로만 보안 수정이 제공됩니다.

### 취약점 보고 방법

**공개 issue를 열지 말아주세요.** 다음 중 한 가지로 알려주세요:

1. GitHub의 [private security advisory](https://github.com/s99606931/vibesql/security/advisories/new) 사용, 또는
2. 메인테이너에게 이메일 (커밋 히스토리에서 주소 확인)

보고에 포함해주세요:

- 영향받는 버전/커밋 해시
- 재현 절차, 가능하면 최소 PoC
- 영향 평가(데이터 노출, RCE, 권한 상승 등)
- 권장 수정 방향

처리 목표:
- 영업일 기준 **3일** 내 접수 확인
- **7일** 내 초기 평가
- 고위험/심각: **30일** 내 수정. 중간: **60일**

릴리스 노트에 보고자를 명시합니다(익명 요청 가능). 현재 유료 버그 바운티 프로그램은 운영하지 않습니다.

### 보안 모델 요약

| 대상 | 보호 |
|---|---|
| 사용자 SQL | `src/lib/sql-guard` AST 검증, `SELECT`/`WITH`/`SHOW`/`EXPLAIN` 외 거부 |
| 저장된 DB 비밀번호 | `CONNECTION_ENCRYPTION_KEY` (64자 hex)로 AES-256-GCM. 개발 모드에서만 base64 fallback |
| 세션 | `httpOnly` 쿠키 `vs-session`, `JWT_SECRET` 서명, 7일 만료 |
| 테넌트 격리 | 모든 인증된 요청에서 `requireUserId()` 호출, 자원 소유 검증 시 `userId` WHERE 강제 |
| 입력 | Zod로 모든 API 경계 검증, 실패 시 400 |
| 레이트 리밋 | `/api/queries/*` 와 auth endpoint에 토큰 버킷 |

### 알려진 제약 / 설계상 선택

- **첫 가입자가 ADMIN.** 셀프호스팅 단일 테넌트를 가정한 설계. 멀티테넌트 포크라면 env 플래그로 차단 필요
- **인메모리 모드** (`DATABASE_URL` 없음)는 알려진 dev 계정 `admin@vibesql.dev` / `admin123` 을 시드하고 로그에 출력함. `NODE_ENV ∈ {development, test}` 일 때만 동작. **프로덕션은 반드시 `DATABASE_URL` 설정**
- **비밀번호 재설정 기능 미구현.** 본인이 통제하는 실제 이메일을 사용하세요
- **스키마 introspection** 은 연결의 DB 사용자 권한으로 실행되며 그 사용자가 볼 수 있는 `information_schema.columns` 만 노출. 최소 권한 DB 사용자 사용을 권장합니다
