# PDCA Check: vibesql-upgrade Analysis

**Feature**: vibesql-upgrade
**Phase**: Check
**Date**: 2026-04-27
**Analyst**: gap-detector + static analysis

---

## Context Anchor

| Dimension | Content |
|-----------|---------|
| **WHY** | 비개발자가 SQL 없이 데이터 인사이트를 얻는 과정의 마찰 제거 + UX 일관성 확보 |
| **WHO** | 다나(데이터 분석가), 준호(팀장/기획자), 소은(DB 관리자/ADMIN) |
| **RISK** | 다크모드 회귀, prompt() 잔존, Claude API 비용 |
| **SUCCESS** | 모든 Sprint 1+2 US 구현 완료, 하드코딩 색상 0건, prompt() 0건 (스코프 내) |
| **SCOPE** | Sprint 1 (US-01~04) + Sprint 2 (US-05~08) |

---

## 1. Strategic Alignment Check

### PRD Core Goal vs Implementation
| PRD Goal | Delivered? | Evidence |
|----------|-----------|----------|
| 모든 native prompt() 제거 (스코프 내) | ✅ | saved, dashboards list 페이지 완전 교체 |
| 다크모드 완전 지원 (토큰화) | ✅ | settings 테마 타일 `var(--ds-accent-on)` |
| RBAC 3-레이어 유지 | ✅ | 모든 API 401 정상 반환 |
| 감사 로그 필터링·페이지네이션 | ✅ | dateFrom/dateTo + PAGE_SIZE=50 |
| AI 컨텍스트 이동성 | ✅ | JSON export/import 구현 |

---

## 2. Plan Success Criteria — Final Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| US-01: 대시보드 생성 인라인 폼 | ✅ Met | `dashboards/page.tsx:88` newDashModal state |
| US-02: 프로필 실제 사용자 데이터 | ✅ Met | `profile/page.tsx:82` useCurrentUser() |
| US-03: 감사 로그 날짜 필터 | ✅ Met | `audit-logs/page.tsx:129-152` dateFrom/dateTo |
| US-04: 설정 테마 타일 DS 토큰 | ✅ Met | `settings/page.tsx:329` var(--ds-accent-on) |
| US-05: /errors 감사 탭 리디렉트 | ✅ Met | `errors/page.tsx:237` router.push("/audit-logs") |
| US-06: AI 컨텍스트 JSON 내보내기/가져오기 | ✅ Met | `ai-context/page.tsx:343,354` handleExport/Import |
| US-07: AI 컨텍스트 전체 보기 | ✅ Met | `ai-context/page.tsx:42` ValuePreview component |
| US-08: 감사 로그 페이지네이션 | ✅ Met | `audit-logs/page.tsx:124,156-157` PAGE_SIZE=50 |

**Overall**: 8/8 criteria met ✅

---

## 3. Gap Analysis

### 3.1 Structural Match (스코프 내 파일 존재 여부)

| File | Expected | Exists | Notes |
|------|----------|--------|-------|
| `src/app/(app)/dashboards/page.tsx` | ✅ | ✅ | Modal 구현 완료 |
| `src/app/(app)/profile/page.tsx` | ✅ | ✅ | useCurrentUser() 적용 |
| `src/app/(app)/settings/page.tsx` | ✅ | ✅ | DS 토큰 적용 |
| `src/app/(app)/audit-logs/page.tsx` | ✅ | ✅ | 필터+페이지네이션 완료 |
| `src/app/(app)/errors/page.tsx` | ✅ | ✅ | 감사 탭 → 리디렉트 |
| `src/app/(app)/ai-context/page.tsx` | ✅ | ✅ | ValuePreview + export/import |
| `src/app/(app)/saved/page.tsx` | ✅ | ✅ | prompt() 제거 완료 |

**Structural Score**: 7/7 = **100%**

### 3.2 Functional Match (기능 동작 완성도)

| Feature | Implementation Quality | Notes |
|---------|----------------------|-------|
| Dashboard 인라인 폼 | ✅ Complete | autoFocus + Enter/Escape 지원 |
| Profile 실제 사용자 | ✅ Complete | name → email → fallback 체인 |
| Settings 토큰화 | ✅ Complete | var(--ds-accent-on) |
| Audit 날짜 필터 | ✅ Complete | client-side date range |
| Audit userId 필터 | ✅ Complete | server-side query param |
| Audit 페이지네이션 | ✅ Complete | PAGE_SIZE=50, page number nav |
| /errors 리디렉트 | ✅ Complete | Button + icon + router.push |
| AI Context export | ✅ Complete | id/createdAt/updatedAt 제외 |
| AI Context import | ✅ Complete | JSON parse + POST per rule |
| ValuePreview 확장 | ✅ Complete | 100자 트런케이션 + expand/collapse |

**Functional Score**: 10/10 = **100%**

### 3.3 API Contract (3-way: Design ↔ Server Route ↔ Client Fetch)

| Endpoint | Auth Guard | Response Format | Client Usage |
|----------|-----------|-----------------|-------------|
| GET /api/audit-logs | ✅ 401 | { data: [] } | useQuery ✅ |
| GET /api/audit-logs?userId= | ✅ 401 | { data: [] } | server-side filter ✅ |
| POST /api/dashboards | ✅ 401 | { data: {} } | createMutation ✅ |
| GET /api/user/me | ✅ 401 | { data: user } | useCurrentUser ✅ |
| GET /api/ai-context | ✅ 401 | { data: [] } | useQuery ✅ |

**Contract Score**: 5/5 = **100%**

---

## 4. Issues Found

### Critical (0건)
없음.

### Important (2건)

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| I-01 | `workspace/page.tsx:467,470` | prompt() 2건 잔존 (위젯 추가/이름 입력) | PRD 목표 "모든 prompt() 제거" 미달 — 범위 외 |
| I-02 | `dashboards/[id]/page.tsx:465,467` | prompt() 2건 잔존 (대시보드 이름 편집) | PRD 목표 "모든 prompt() 제거" 미달 — 범위 외 |

> **참고**: I-01, I-02는 Sprint 1+2 스코프 밖 페이지이므로 현재 Match Rate 계산에서 제외. Sprint 3 항목으로 이관 권장.

### Minor (0건)
없음.

---

## 5. Match Rate Calculation (Static-Only — Auth 필요)

> 서버 실행 중이나 인증 필요 API — L1 curl은 모두 401 (auth guard 정상 작동 확인)
> Static-only 공식 적용: (Structural × 0.2) + (Functional × 0.4) + (Contract × 0.4)

| Axis | Score | Weight | Weighted |
|------|-------|--------|---------|
| Structural | 100% | 0.20 | 20% |
| Functional | 100% | 0.40 | 40% |
| Contract | 100% | 0.40 | 40% |
| **Overall** | | | **100%** |

**Match Rate: 100%** (스코프 내 기준)

---

## 6. TypeScript Check

```
npx tsc --noEmit → No errors
```

---

## 7. Recommendations

### Sprint 3 추가 항목 (Important 이슈 → 다음 스프린트 이관)

1. **workspace/page.tsx** — 위젯 추가 시 대시보드 선택 + 이름 입력 prompt() → 인라인 Select + Input 모달
2. **dashboards/[id]/page.tsx** — 대시보드 이름/설명 편집 prompt() → 인라인 편집 폼

### 추가 개선 권장 (Could)
- 감사 로그 CSV 내보내기 (US-09 candidate)
- 쿼리 결과 CSV 내보내기
- 워크스페이스 멀티탭

---

## 8. Conclusion

Sprint 1 Must (US-01~04) + Sprint 2 Should (US-05~08) 모두 구현 완료.
Match Rate **100%** (스코프 내). TypeScript 오류 없음.
