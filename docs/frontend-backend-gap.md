# 프론트엔드 → 백엔드 연결 갭 분석
> 생성일: 2026-04-26 | 마지막 업데이트: 2026-04-26 (2차 분석·구현 완료)

## 요약

| 항목 | 1차 분석 (이전) | 2차 분석 (현재) |
|------|--------------|--------------|
| 분석한 인터랙션 | 52개 | 60개 |
| ✅ 연결 완료 | 49개 (94.2%) | **57개 (95.0%)** |
| ⚠️ 부분 연결 | 2개 (3.8%) | 2개 |
| ⏸ 보류 (Clerk 의존) | 1개 | 1개 |

> 2차 분석 신규 발견: 스키마 필터·카드클릭, 히스토리 서버검색·페이지네이션, 저장쿼리 폴더 DB 저장, 워크스페이스 연결 설정 동기화

---

## 1차 분석 결과 (2026-04-26)

### ✅ 완료된 항목 (1차)

| # | 항목 | 적용 파일 |
|---|------|----------|
| 1 | `Plus` 아이콘 import 누락 수정 | `saved/page.tsx` |
| 2 | 알림 토글 3개 `persistSettings` body 추가 | `settings/page.tsx` |
| 3 | 알림·세션타임아웃 PatchSchema 필드 추가 | `settings/route.ts` |
| 4 | 대시보드 공유(`isPublic`) 토글 버튼 | `dashboards/[id]/page.tsx` |
| 5 | 대시보드 위젯 삭제(X) 버튼 | `dashboards/[id]/page.tsx` |
| 6 | API 키 하드코딩 더미 제거 | `settings/page.tsx` |
| 7 | 새 폴더 버튼 핸들러 연결 | `saved/page.tsx` |

---

## 2차 분석 결과 (2026-04-26 재분석)

### ✅ 완료된 항목 (2차)

| # | 항목 | 파일 | 구현 내용 |
|---|------|------|----------|
| 1 | 스키마 필터 버튼 클릭 핸들러 | `schema/page.tsx` | `SchemaFilter` 상태 + 전체/public/PII 필터 |
| 2 | 테이블 카드 클릭 → 워크스페이스 이동 | `schema/page.tsx` | `SELECT * FROM table LIMIT 100` 자동 입력 |
| 3 | 테이블명 복사 버튼 | `schema/page.tsx` | Copy 아이콘 버튼 → 클립보드 |
| 4 | 히스토리 서버사이드 검색 | `history/route.ts` + `history/page.tsx` | `?search=` 파라미터 지원 |
| 5 | 히스토리 페이지네이션 (더 보기) | `history/page.tsx` | `limit` 상태 + "더 보기 (N/M)" 버튼 |
| 6 | 저장 쿼리 새 폴더 DB 저장 | `saved/page.tsx` | 미분류 쿼리 `PATCH /api/saved/[id]` 일괄 업데이트 |
| 7 | 워크스페이스 연결 선택 → 설정 동기화 | `workspace/page.tsx` + `settings/route.ts` | `PATCH /api/settings { lastConnectionId }` |
| 8 | history GET `req` 시그니처 업데이트 | `history-flow.test.ts`, `stats/route.ts` | 테스트·stats 라우트 호출 수정 |

### ⏸ 보류 항목

| # | 항목 | 이유 |
|---|------|------|
| 1 | 프로필 계정 삭제 | Clerk SDK 통합 완료 후 처리 |

### ⚠️ 의도된 부분 연결 (변경 불필요)

| # | 항목 | 이유 |
|---|------|------|
| 1 | 워크스페이스 [공유] 버튼 | URL 클립보드 복사 — 영속 공유 링크는 추후 기능 결정 |
| 2 | 설정 읽기 전용 모드 토글 | 의도된 보안 정책 (항상 켜짐) |

---

## 테스트 결과

| 라운드 | 결과 |
|--------|------|
| 1차 구현 후 | Tests **113** passed (11 files) |
| 2차 구현 후 | Tests **113** passed (11 files) ✅ |
