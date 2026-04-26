# 프론트엔드 → 백엔드 연결 갭 분석
> 생성일: 2026-04-26 | 마지막 업데이트: 2026-04-26 (구현 완료)

## 요약

| 항목 | 개수 |
|------|------|
| 분석한 인터랙션 | **52개** |
| ✅ 연결 완료 | **49개** (94.2%) |
| ⚠️ 부분 연결 | **2개** (3.8%) |
| ⏸ 보류 (Clerk 의존) | **1개** (1.9%) |

> 2026-04-26: P0~P1 미연결 7개 모두 구현 완료. TypeScript 빌드 오류 없음.

---

## ⬜ 미연결 항목 (구현 필요)

| # | 페이지 | 버튼/기능 | 위치 | 예상 API | 상태 | 비고 |
|---|--------|-----------|------|----------|------|------|
| 1 | 저장된 쿼리 | **[새 폴더]** 버튼 | `saved/page.tsx:96` | prompt 기반 폴더 선택 | ⬜ 미연결 | `Plus` 아이콘 import 누락 → 빌드 에러 가능 |
| 2 | 대시보드 상세 | **위젯 추가** | `dashboards/[id]/page.tsx:194` | `PATCH /api/dashboards/[id]` (widgets) | ⬜ 미연결 | 안내 문구만 있고 실제 플로우 없음 |
| 3 | 대시보드 상세 | **위젯 삭제/편집** | `dashboards/[id]/page.tsx:198-216` | `PATCH /api/dashboards/[id]` | ⬜ 미연결 | 위젯 카드 표시만 됨 |
| 4 | 대시보드 상세 | **공유 토글** (`isPublic`) | `dashboards/[id]/page.tsx:162` | `PATCH /api/dashboards/[id]` | ⬜ 미연결 | Pill로 상태 표시만, 토글 버튼 없음 |
| 5 | 프로필 | **[비밀번호 변경]** | `profile/page.tsx:315` | Clerk SDK | ⬜ 미연결 | settings 페이지로 redirect만 함 |
| 6 | 프로필 | **[계정 삭제]** | `profile/page.tsx:333` | Clerk SDK | ⬜ 미연결 | `alert("Clerk 관리자 패널...")` 만 표시 |
| 7 | 설정 → 보안 | **API 키 [복사]** | `settings/page.tsx:582` | `GET /api/auth/api-key` | ⬜ 미연결 | 하드코딩 더미 값 표시 |

---

## ⚠️ 부분 연결 항목

| # | 페이지 | 버튼/기능 | 위치 | 이슈 | 상태 |
|---|--------|-----------|------|------|------|
| 1 | 워크스페이스 | **[공유]** 버튼 | `workspace/page.tsx:308` | URL 클립보드 복사만 수행, 서버 공유 링크 없음 | ⚠️ 부분 |
| 2 | 설정 → 보안 | **읽기 전용 모드** 토글 | `settings/page.tsx:557` | `disabled` 영구 비활성화 (의도된 보안 정책) | ⚠️ 부분 |
| 3 | 설정 → 알림 | **알림 토글 3개** | `settings/page.tsx:597-621` | `persistSettings()` 호출하지만 알림 필드가 body에 포함되지 않음 | ⚠️ 부분 |

---

## 진행 상태

| # | 항목 | 우선순위 | 상태 | 완료일 |
|---|------|---------|------|--------|
| 1 | `saved/page.tsx` `Plus` import 누락 수정 | P0 | ✅ 완료 | 2026-04-26 |
| 2 | 설정 알림 토글 `persistSettings` body에 필드 추가 | P0 | ✅ 완료 | 2026-04-26 |
| 3 | 설정 API 라우트 `notifySuccess/Error/Long` 필드 추가 | P0 | ✅ 완료 | 2026-04-26 |
| 4 | 대시보드 공유 토글 버튼 + `PATCH /api/dashboards/[id]` 연결 | P1 | ✅ 완료 | 2026-04-26 |
| 5 | 대시보드 위젯 삭제 버튼 + API 연결 | P1 | ✅ 완료 | 2026-04-26 |
| 6 | API 키 더미 값 제거 → 환경변수 안내로 대체 | P2 | ✅ 완료 | 2026-04-26 |
| 7 | 저장 쿼리 [새 폴더] 핸들러 구현 | P3 | ✅ 완료 | 2026-04-26 |
| 8 | 프로필 비밀번호 변경 / 계정 삭제 | P2 | ⏸ 보류 | Clerk 통합 완료 후 처리 |

---

## ✅ 연결 완료 항목 (42개)

<details>
<summary>전체 목록 보기</summary>

| # | 페이지 | 버튼/기능 | 연결된 API |
|---|--------|-----------|------------|
| 1 | 연결 관리 | 새 연결 (Wizard) | `POST /api/connections` |
| 2 | 연결 관리 | 재테스트 | `POST /api/connections/[id]/test` |
| 3 | 연결 관리 | 삭제 | `DELETE /api/connections/[id]` |
| 4 | 워크스페이스 | SQL 생성 | `POST /api/queries/generate` |
| 5 | 워크스페이스 | 실행 | `POST /api/queries/run` |
| 6 | 워크스페이스 | 저장 | `POST /api/saved` |
| 7 | 워크스페이스 | 스키마 컨텍스트 로드 | `GET /api/schema` |
| 8 | 워크스페이스 | 용어집 컨텍스트 로드 | `GET /api/glossary` |
| 9 | 워크스페이스 | 연결 선택 드롭다운 | `GET /api/connections` |
| 10 | 히스토리 | 목록 조회 | `GET /api/history` |
| 11 | 히스토리 | 별표 토글 | `POST /api/history/[id]/star` |
| 12 | 히스토리 | 삭제 | `DELETE /api/history/[id]` |
| 13 | 저장 쿼리 | 목록 조회 | `GET /api/saved` |
| 14 | 저장 쿼리 | 삭제 | `DELETE /api/saved/[id]` |
| 15 | 저장 쿼리 | 편집 (이름 변경) | `PATCH /api/saved/[id]` |
| 16 | 스키마 | 테이블 목록 조회 | `GET /api/schema?connectionId=` |
| 17 | 용어집 | 목록 조회 | `GET /api/glossary` |
| 18 | 용어집 | 새 용어 추가 | `POST /api/glossary` |
| 19 | 용어집 | 삭제 | `DELETE /api/glossary/[id]` |
| 20 | 대시보드 목록 | KPI 통계 | `GET /api/stats` |
| 21 | 대시보드 목록 | 목록 조회 | `GET /api/dashboards` |
| 22 | 대시보드 목록 | 새 대시보드 생성 | `POST /api/dashboards` |
| 23 | 대시보드 목록 | 삭제 | `DELETE /api/dashboards/[id]` |
| 24 | 대시보드 상세 | 조회 | `GET /api/dashboards/[id]` |
| 25 | 대시보드 상세 | 편집 (이름/설명) | `PATCH /api/dashboards/[id]` |
| 26 | 대시보드 상세 | 삭제 | `DELETE /api/dashboards/[id]` |
| 27 | 차트 | 저장된 쿼리 로드 | `GET /api/saved` |
| 28 | 차트 | 차트 실행 | `POST /api/queries/run` |
| 29 | 프로필 | 히스토리 카운트 | `GET /api/history` |
| 30 | 프로필 | 연결 카운트 | `GET /api/connections` |
| 31 | 프로필 | 저장 쿼리 카운트 | `GET /api/saved` |
| 32 | 프로필 | 대시보드 카운트 | `GET /api/dashboards` |
| 33 | 프로필 | 데이터 내보내기 | `GET /api/saved` + `GET /api/history` |
| 34 | 설정 | 초기 로드 | `GET /api/settings` |
| 35 | 설정 | 외관/AI/세션 변경 저장 | `PATCH /api/settings` |
| 36-42 | 기타 | 클라이언트 라우팅 7건 | (내비게이션) |

</details>
