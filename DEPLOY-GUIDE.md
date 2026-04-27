# vibeSQL — Railway 배포 가이드

> CI/CD 파이프라인(`.github/workflows/ci-cd.yml`) + Railway Docker 배포까지 **사용자가 직접 설정해야 하는 단계**만 정리합니다.

---

## 1단계: GitHub 저장소 생성 및 코드 푸시

```bash
# 1-1. GitHub에서 새 private 저장소 생성 (github.com → New repository)
#      이름 예: vibesql  (private 권장)

# 1-2. 로컬에서 remote 연결 후 푸시
cd /data/vibesql/apps/web
git remote add origin https://github.com/<YOUR_USERNAME>/vibesql.git
git push -u origin stg      # 현재 작업 브랜치
git push origin main        # 없으면: git checkout -b main && git push -u origin main
```

> **팁**: CI/CD `deploy` job은 `main` 브랜치 푸시 시에만 실행됩니다.  
> `stg` 브랜치는 테스트(lint + build + vitest)만 실행합니다.

---

## 2단계: Railway 프로젝트 생성

1. [railway.app](https://railway.app) → 회원가입 / 로그인 (GitHub OAuth 권장)
2. **New Project** → **Deploy from GitHub repo** → 저장소 선택
3. Railway가 `railway.toml`을 감지해 **Dockerfile 빌드**로 자동 설정됩니다.
4. 서비스 이름을 메모해 두세요 (예: `vibesql-web`) → 5단계에서 필요

---

## 3단계: Railway API Token 발급

1. Railway 대시보드 → **Account Settings** → **Tokens**
2. **New Token** 생성 → 토큰 복사 (한 번만 표시됨)

---

## 4단계: GitHub Secrets 등록

GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 이름 | 값 |
|-------------|-----|
| `RAILWAY_TOKEN` | 3단계에서 발급한 Railway API 토큰 |
| `RAILWAY_SERVICE_NAME` | Railway 서비스 이름 (예: `vibesql-web`) |

---

## 5단계: Railway 환경 변수 설정

Railway 대시보드 → 서비스 선택 → **Variables** 탭에서 아래 변수 추가:

### 필수 변수

| 변수 | 값 | 설명 |
|------|----|------|
| `CONNECTION_ENCRYPTION_KEY` | `openssl rand -hex 32` 결과 | DB 비밀번호 암호화 키 (64자 hex) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude AI API 키 |
| `NEXT_PUBLIC_APP_URL` | Railway 도메인 | 예: `https://vibesql-web.up.railway.app` |

### 선택 변수 (Clerk 인증 사용 시)

| 변수 | 값 |
|------|----|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 대시보드에서 발급 |
| `CLERK_SECRET_KEY` | Clerk 대시보드에서 발급 |

> Clerk 없이 배포하면 모든 요청이 자동으로 dev-user로 처리됩니다 (단일 사용자 모드).

### 선택 변수 (OpenAI / Google AI 병용 시)

| 변수 | 값 |
|------|----|
| `OPENAI_API_KEY` | `sk-...` |
| `GOOGLE_AI_API_KEY` | Google AI Studio에서 발급 |

---

## 6단계: (선택) Railway PostgreSQL 플러그인 추가

DB 없이도 작동하지만, 데이터가 재시작 시 초기화됩니다. 영구 저장이 필요하면:

1. Railway 프로젝트 → **New** → **Database** → **PostgreSQL**
2. PostgreSQL 서비스가 생성되면 `DATABASE_URL` 환경 변수가 자동으로 앱에 주입됩니다.
3. 첫 배포 후 마이그레이션 실행:

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 마이그레이션 실행 (프로젝트 root에서)
railway run --service vibesql-web npx prisma migrate deploy
```

---

## 7단계: 배포 확인

배포 완료 후 헬스 체크:

```bash
curl https://<YOUR_RAILWAY_DOMAIN>.up.railway.app/api/health
# 정상 응답 예시:
# {"status":"ok","checks":{"api":"ok","db":"ok"},"ts":"2026-04-27T..."}
```

Railway 대시보드 → **Deployments** 탭에서 빌드 로그 확인 가능.

---

## 8단계: CI/CD 자동 배포 흐름

```
git push origin main
    │
    ▼
GitHub Actions: test job
  - npm ci
  - prisma generate
  - tsc --noEmit
  - vitest run
    │ (성공 시)
    ▼
GitHub Actions: deploy job
  - railway up --service $RAILWAY_SERVICE_NAME
    │
    ▼
Railway: Docker 빌드 → 배포 → 헬스 체크
```

`stg` 브랜치: 테스트만 실행 (배포 없음)  
`main` 브랜치: 테스트 통과 후 자동 배포

---

## 암호화 키 생성 방법

```bash
# CONNECTION_ENCRYPTION_KEY 생성 (Linux / macOS)
openssl rand -hex 32

# 출력 예시 (64자 hex 문자열):
# a3f8e2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 빌드 실패: `prisma generate` 오류 | DB URL 없음 | `DATABASE_URL` 환경 변수 확인 또는 없어도 됨 (in-memory 모드) |
| `/api/health` → `{"db":"error"}` | DB 연결 실패 | Railway PostgreSQL 플러그인 확인 |
| 502 Bad Gateway | 앱 시작 실패 | Railway Deployments 탭에서 로그 확인 |
| GitHub Actions `deploy` 스킵 | `stg` 브랜치에서 푸시 | `main` 브랜치로 PR merge 후 재실행 |
| `RAILWAY_TOKEN` 인증 오류 | 토큰 만료 또는 오타 | Railway에서 토큰 재발급 후 GitHub Secret 업데이트 |
