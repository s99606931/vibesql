---
name: av-browser-test
description: Browser-only Auto-Vibe — exhaustive UI smoke + button-click sweep across every app route using Playwright MCP. Authenticates, enumerates routes, clicks every non-destructive button/link, and captures console/network errors. Triggers when the user asks to "browser test", "전수 테스트", "버튼 전수 클릭", "click everything", or runs /av-browser-test.
---

# /av-browser-test — Browser Test Auto-Vibe

> **Version**: 1.0.0 | Project-local skill for vibeSQL
> **Scope**: vibeSQL Next.js 16 app (`/data/vibesql/apps/web`)
> **Tool**: Playwright MCP (`mcp__plugin_everything-claude-code_playwright__*`)

자연어로 "전수 테스트해줘" 한 줄이면, 로그인 → 22개 라우트 → 모든 버튼 클릭 →
콘솔/네트워크 에러 수집 → 보고서까지 자동으로 처리한다.

---

## 실행 흐름 (8단계)

### STEP 1: 옵션 파싱
- `--smoke`: 라우트 진입 + 콘솔 에러만 (버튼 클릭 생략, 빠름)
- `--deep`: 폼 입력 + 워크플로우까지 (느림, DB 쓰기 위험)
- `--routes <글롭>`: 특정 라우트만 (예: `--routes /charts,/dashboards`)
- `--no-auth`: 로그인 우회, public 라우트만
- 기본: smoke + 버튼 전수 클릭

### STEP 2: 사전 점검
1. dev 서버 ready 확인: `curl -sf http://localhost:3000/api/health` (없으면 `/`로 폴백)
2. 미기동 시 사용자에게 알림: "npm run dev 가 필요합니다. 백그라운드 시작할까요?"
3. Playwright MCP 가용성 확인 (browser_navigate 호출 가능 여부)

### STEP 3: 라우트 인벤토리
다음 명령으로 라우트 자동 수집:
```bash
ls src/app/'(app)'/ | grep -v '\.tsx$\|\.ts$' | sort
ls src/app/'(auth)'/ | sort
```
동적 라우트(`[id]`)는 시드 데이터가 있으면 1건 샘플, 없으면 스킵.

### STEP 4: 인증
- `--no-auth` 가 아니면 `/signin` 으로 이동
- 개발 계정 `admin@vibesql.dev` / `admin123` 사용 (signin 페이지 dev hint 기준)
- `browser_fill_form` 으로 이메일/비밀번호 입력 → 로그인 버튼 클릭
- `browser_wait_for` 로 `/workspace` URL 확인
- 실패 시 `user@vibesql.dev` / `user123` 재시도

### STEP 5: 라우트 순회 (main loop)

각 라우트마다:

```
1. browser_navigate(url)
2. browser_wait_for(text="...", time=2)  // load
3. browser_console_messages(onlyErrors=true)  → routeErrors[]
4. browser_snapshot()  → ARIA tree
5. snapshot에서 button + a[href] 추출
   - destructive 패턴 제외: 로그아웃/Logout/Delete/삭제/Drop/Reset 텍스트
   - 외부 링크 제외: target=_blank, http(s)://
6. 각 버튼 ref에 대해:
   a. browser_click(ref)
   b. browser_wait_for(time=1)
   c. browser_console_messages → buttonErrors[]
   d. URL 변경되었으면 원래 라우트로 복귀 (browser_navigate)
   e. 모달 떠있으면 ESC 또는 닫기
7. browser_network_requests(filter=4xx,5xx)  → networkErrors[]
8. results[route] = { errors, buttonsClicked, navigations, screenshots? }
```

**중단 조건**: 한 라우트에서 콘솔 에러 10개 이상 → 다음 라우트로 진행 (전체 중단 X)

### STEP 6: 결과 집계

수집 데이터:
- 라우트별: 진입 성공/실패, 콘솔 에러 수, 클릭한 버튼 수, 네트워크 4xx/5xx 수
- 전역: 총 라우트, 통과/실패, 발견된 이슈 카테고리

이슈 분류:
- **CRITICAL**: 페이지 로드 실패, 500 에러
- **HIGH**: 콘솔 에러 (Error, TypeError, ReferenceError)
- **MEDIUM**: 네트워크 4xx/5xx, hydration warning
- **LOW**: console.warn, deprecation

### STEP 7: 보고서

`docs/04-reports/browser-test-{YYYY-MM-DD-HHmm}.md` 에 기록:

```markdown
# 브라우저 전수 테스트 보고서

**일시**: {timestamp}
**대상**: vibeSQL @ localhost:3000
**테스트 깊이**: {smoke|deep}
**라우트**: {N}개 / 통과 {pass} / 실패 {fail}
**버튼**: {clicked}개 클릭 / {failed}개 실패

## Executive Summary
| 라우트 | 진입 | 콘솔 에러 | 4xx/5xx | 버튼 클릭 | 결과 |
|-------|------|-----------|---------|-----------|------|
| /workspace | ✅ | 0 | 0 | 12/12 | ✅ |
| /charts | ✅ | 2 | 0 | 5/8 | ⚠️ |
| ... |

## CRITICAL 이슈
- ...

## HIGH 이슈
- ...

## 권장 다음 단계
- {/pdca iterate, /pdca report 등}
```

### STEP 8: 다음 단계 제안

| 발견된 이슈 | 다음 단계 |
|-----------|----------|
| CRITICAL/HIGH 0개 | `/pdca report` — 완료 보고서 |
| CRITICAL > 0 | 즉시 수정 필요. 영향받는 파일 grep 후 fix 제안 |
| HIGH > 0 | `/pdca iterate` — 자동 개선 |
| MEDIUM 다수 | 다음 스프린트 백로그 추가 권장 |

---

## 안전 가드

1. **destructive 클릭 금지**: 로그아웃/삭제/Drop/Reset 텍스트 또는 `data-destructive="true"` 속성 보유 버튼 스킵
2. **DB 쓰기 금지**: `--deep` 명시 없으면 폼 submit 클릭은 스킵 (text input은 채우지 않음)
3. **외부 링크 금지**: `target=_blank` 또는 `http(s)://` 시작 href 스킵
4. **시간 제한**: 라우트당 최대 60초, 전체 최대 30분

---

## 사용 예시

```bash
# 전수 테스트 (기본)
/av-browser-test

# 빠른 smoke만
/av-browser-test --smoke

# 특정 라우트만
/av-browser-test --routes /charts,/dashboards,/reports

# 인증 없이
/av-browser-test --no-auth

# Deep 모드 (폼 입력 포함, 위험)
/av-browser-test --deep
```

---

## vibeSQL 특화 주의사항

- **SQL 실행 금지**: workspace 페이지의 "Run" 버튼은 destructive 패턴에 추가 (DB 부하)
- **Connection 추가/삭제 금지**: connections 페이지 form submit 스킵
- **Schedule 활성화 금지**: schedules 페이지의 "Activate" 토글은 스킵
- **Audit logs 페이지**: 읽기 전용이므로 자유롭게 클릭 가능
- **Charts 페이지**: 차트 렌더링이 무거우니 wait time 3초로 늘림
