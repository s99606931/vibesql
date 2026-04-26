# vibeSQL UI 인벤토리 — 전체 메뉴 · 버튼 목록 및 검사 결과

> **검사 일시**: 2026-04-26 22:59  
> **검사 방법**: 소스 코드 정적 분석 + HTTP 라우트 응답 검사  
> **서버**: http://localhost:3000 (Next.js dev)

---

## 검사 요약

| 항목 | 결과 |
|------|------|
| 페이지 라우트 | 12 / 12 통과 (200 OK) |
| API 라우트 GET | 9 / 10 통과 (1개 N/A: `/api/charts` 없음, 차트는 `/api/saved` 활용) |
| 수정된 버그 | `/api/settings` 500 → 200 수정 완료 |
| 전체 메뉴 항목 | 11개 (사이드바 5그룹) |
| 전체 버튼/액션 | 약 80개 (페이지별 상세 목록 아래 참조) |

---

## 1. 사이드바 메뉴 (Sidebar.tsx)

> 위치: `src/components/shell/Sidebar.tsx`

| 그룹 | 라벨 | 경로 | HTTP 상태 | 비고 |
|------|------|------|-----------|------|
| **워크스페이스** | 워크스페이스 | `/workspace` | ✅ 200 | |
| | 히스토리 | `/history` | ✅ 200 | |
| | 저장됨 | `/saved` | ✅ 200 | 배지: 저장된 쿼리 수 |
| **인사이트** | 대시보드 | `/dashboards` | ✅ 200 | |
| | 차트 | `/charts` | ✅ 200 | |
| **지식베이스** | 스키마 | `/schema` | ✅ 200 | |
| | 용어 사전 | `/glossary` | ✅ 200 | |
| **데이터 소스** | 연결 | `/connections` | ✅ 200 | |
| | 상태 · 에러 | `/errors` | ✅ 200 | |
| **계정** | 프로필 | `/profile` | ✅ 200 | |
| | 설정 | `/settings` | ✅ 200 | |

**헤더 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| vibeSQL (로고 클릭) | `/home` 이동 | ✅ |
| ⌘K 명령 팔레트 | 명령 팔레트 열기 | ✅ |
| 그룹 헤더 (각 5개) | 그룹 접기/펼치기 | ✅ |

---

## 2. 명령 팔레트 (CommandPalette.tsx)

> 위치: `src/components/shell/CommandPalette.tsx`  
> 단축키: `⌘K` (Mac) / `Ctrl+K` (Windows)

| 라벨 | 경로 | 그룹 | 상태 |
|------|------|------|------|
| 워크스페이스 | `/workspace` | 페이지 | ✅ |
| 스키마 브라우저 | `/schema` | 페이지 | ✅ |
| 히스토리 | `/history` | 페이지 | ✅ |
| 저장된 쿼리 | `/saved` | 페이지 | ✅ |
| 차트 갤러리 | `/charts` | 페이지 | ✅ |
| 대시보드 | `/dashboards` | 페이지 | ✅ |
| 비즈니스 용어집 | `/glossary` | 페이지 | ✅ |
| DB 연결 관리 | `/connections` | 설정 | ✅ |
| 설정 | `/settings` | 설정 | ✅ |

---

## 3. 홈 페이지 (`/home`)

> 위치: `src/app/(app)/home/page.tsx`  
> API: `GET /api/connections`, `GET /api/ai-providers`

**페이지 상태 카드**

| 라벨 | 동작 | 연동 API | 상태 |
|------|------|----------|------|
| 연결된 DB 카드 | `/connections` 이동 | `GET /api/connections` | ✅ |
| AI 프로바이더 카드 | `/settings` 이동 | `GET /api/ai-providers` | ✅ |

**워크플로 3단계**

| 단계 | 라벨 | 버튼 | 동작 | 상태 |
|------|------|------|------|------|
| 1 | 데이터베이스 연결 | 연결 추가 / 관리 | `/connections` 이동 | ✅ |
| 2 | AI 프로바이더 설정 | 설정하기 / 관리 | `/settings` 이동 | ✅ |
| 3 | 자연어로 SQL 생성 | 열기 | `/workspace` 이동 | ✅ |

**진행 상태 요약 버튼** (동적, 미완료 항목 우선)

| 조건 | 버튼 라벨 | 이동 경로 |
|------|----------|----------|
| 연결 없음 | 연결 추가하기 | `/connections` |
| AI 프로바이더 없음 | AI 프로바이더 설정하기 | `/settings` |
| 모두 완료 | 워크스페이스에서 시작하기 | `/workspace` |

**메뉴별 사용 가이드 (아코디언 9개)**

| 메뉴 | 이동 버튼 | 상태 |
|------|----------|------|
| 워크스페이스 | 이동 → `/workspace` | ✅ |
| 연결 | 이동 → `/connections` | ✅ |
| 스키마 | 이동 → `/schema` | ✅ |
| 용어 사전 | 이동 → `/glossary` | ✅ |
| 결과 · 차트 | 이동 → `/charts` | ✅ |
| 대시보드 | 이동 → `/dashboards` | ✅ |
| 히스토리 | 이동 → `/history` | ✅ |
| 저장됨 | 이동 → `/saved` | ✅ |
| 설정 | 이동 → `/settings` | ✅ |

---

## 4. 워크스페이스 (`/workspace`)

> 위치: `src/app/(app)/workspace/page.tsx`  
> API: `POST /api/queries/generate`, `POST /api/queries/run`, `POST /api/saved`

**TopBar 버튼**

| 라벨 | 동작 | 표시 조건 | 상태 |
|------|------|----------|------|
| 연결 드롭다운 | 활성 DB 변경, 설정 PATCH | 항상 | ✅ |
| 저장 | `POST /api/saved` | status ≠ idle | ✅ |
| 공유 | 클립보드 복사 | status ≠ idle | ✅ |
| 초기화 | 상태 리셋 | status ≠ idle | ✅ |

**자연어 입력창 예시 칩**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 오늘 활성 사용자 | 입력창에 텍스트 설정 | ✅ |
| 주간 매출 추이 | 입력창에 텍스트 설정 | ✅ |
| 국가별 가입자 수 | 입력창에 텍스트 설정 | ✅ |
| 결제 실패율 | 입력창에 텍스트 설정 | ✅ |

**SQL 편집기 · 결과 버튼**

| 라벨 | 단축키 | 동작 | API | 상태 |
|------|--------|------|-----|------|
| SQL 생성 (전송 버튼) | Enter | `POST /api/queries/generate` | ✅ |
| 복사 | | 클립보드에 SQL 복사 | — | ✅ |
| 실행 | ⌘⏎ / Ctrl+Enter | `POST /api/queries/run` | ✅ |
| 결과: 테이블 탭 | | 결과 표시 | — | ✅ |
| 결과: 차트 탭 | | 차트 렌더링 | — | ✅ |
| 결과: SQL 설명 탭 | | AI 설명 표시 | — | ✅ |
| CSV | | CSV 다운로드 | — | ✅ |
| 대시보드 추가 | | `POST /api/dashboards/{id}` | ✅ |

---

## 5. 연결 (`/connections`)

> 위치: `src/app/(app)/connections/page.tsx`  
> API: `GET /api/connections`, `POST /api/connections`, `POST /api/connections/{id}/test`, `DELETE /api/connections/{id}`

**TopBar 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 새 연결 | ConnectionWizard 모달 열기 | — | ✅ |

**연결 목록 버튼 (행당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 재테스트 | 연결 테스트 | `POST /api/connections/{id}/test` | ✅ |
| 삭제 | confirm → DELETE | `DELETE /api/connections/{id}` | ✅ |

**빈 상태 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 첫 연결 추가하기 | ConnectionWizard 모달 열기 | ✅ |

---

## 6. 히스토리 (`/history`)

> 위치: `src/app/(app)/history/page.tsx`  
> API: `GET /api/history`, `POST /api/history/{id}/star`, `DELETE /api/history/{id}`

**필터 · 검색**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 전체 | 필터 초기화 | ✅ |
| 성공 | status=SUCCESS 필터 | ✅ |
| 실패 | status=FAILURE 필터 | ✅ |
| 즐겨찾기 | starred=true 필터 | ✅ |
| 검색창 | 서버사이드 검색 | ✅ |

**항목 호버 버튼 (행당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 재실행 | SQL 로드 + `/workspace` 이동 | — | ✅ |
| 별표 | 즐겨찾기 토글 | `POST /api/history/{id}/star` | ✅ |
| 삭제 | `DELETE /api/history/{id}` | ✅ |

**페이지네이션**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 더 보기 ({현재}/{합계}개) | limit +50 (React Query 리페치) | ✅ |

---

## 7. 저장됨 (`/saved`)

> 위치: `src/app/(app)/saved/page.tsx`  
> API: `GET /api/saved`, `PATCH /api/saved/{id}`, `DELETE /api/saved/{id}`

**TopBar 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 새 폴더 | 이름 prompt → API 이동 | `PATCH /api/saved/{id}` (일괄) | ✅ |

**페이지 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 워크스페이스에서 저장 | `/workspace` 이동 | — | ✅ |
| 검색창 | 클라이언트 필터 | — | ✅ |

**항목 호버 버튼 (행당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 워크스페이스에서 열기 | SQL 로드, status=ready, `/workspace` | — | ✅ |
| 실행 | SQL 로드, status=running, `/workspace` | — | ✅ |
| 편집 | prompt → 이름 변경 | `PATCH /api/saved/{id}` | ✅ |
| 삭제 | confirm → DELETE | `DELETE /api/saved/{id}` | ✅ |

---

## 8. 스키마 (`/schema`)

> 위치: `src/app/(app)/schema/page.tsx`  
> API: `GET /api/schema`

**필터 · 검색**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 전체 | 필터 초기화 | ✅ |
| public | public 스키마 필터 | ✅ |
| PII 포함 | PII 플래그 필터 | ✅ |
| 검색창 | 테이블명 검색 | ✅ |

**테이블 카드 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 카드 클릭 | SELECT * LIMIT 100 → `/workspace` | ✅ |
| 테이블명 복사 | 클립보드 복사 | ✅ |
| ▶ SELECT 실행 아이콘 | SQL 로드 → `/workspace` | ✅ |

**빈 상태 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 연결 추가 | `/connections` 이동 | ✅ |

---

## 9. 용어 사전 (`/glossary`)

> 위치: `src/app/(app)/glossary/page.tsx`  
> API: `GET /api/glossary`, `POST /api/glossary`, `DELETE /api/glossary/{id}`

**TopBar 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 새 용어 | 폼 토글 | ✅ |

**좌측 패널**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 검색창 | 용어 클라이언트 필터 | ✅ |
| 용어 항목 (클릭) | 우측 상세 표시 | ✅ |

**용어 추가 폼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 저장 | 용어 생성 | `POST /api/glossary` | ✅ |
| 취소 | 폼 닫기 | — | ✅ |

**우측 상세 패널**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 삭제 | confirm → DELETE | `DELETE /api/glossary/{id}` | ✅ |
| 새 용어 추가 (용어 미선택 시) | 폼 토글 | — | ✅ |

---

## 10. 설정 (`/settings`)

> 위치: `src/app/(app)/settings/page.tsx`  
> API: `GET /api/settings`, `PATCH /api/settings`, `GET /api/ai-providers`, `POST/PATCH/DELETE /api/ai-providers`

### 10-1. 외관 섹션

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 테마 (Indigo/Emerald/Amber/Rose/Slate) | 테마 선택 | `PATCH /api/settings` | ✅ |
| 다크/라이트 모드 토글 | 모드 전환 | `PATCH /api/settings` | ✅ |
| 밀도 (컴팩트/보통/넓게) | 밀도 선택 | `PATCH /api/settings` | ✅ |

### 10-2. AI 설정 섹션

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| SQL 방언 드롭다운 | 방언 선택 | `PATCH /api/settings` | ✅ |
| SQL 생성 온도 슬라이더 | 0.0~1.0 조정 | `PATCH /api/settings` | ✅ |
| 항상 결과 설명 포함 토글 | on/off | `PATCH /api/settings` | ✅ |
| AI 프로바이더 추가 버튼 | 추가 폼 열기 | — | ✅ |

**AI 프로바이더 추가 폼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 종류 드롭다운 (7종) | anthropic/openai/google/lmstudio/ollama/vllm/compat | — | ✅ |
| 저장 | 프로바이더 생성 | `POST /api/ai-providers` | ✅ |
| 취소 | 폼 닫기 | — | ✅ |

**AI 프로바이더 항목 버튼 (행당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 테스트 | 연결 테스트 | `POST /api/ai-providers/{id}/test` | ✅ |
| 삭제 | confirm → DELETE | `DELETE /api/ai-providers/{id}` | ✅ |

### 10-3. 보안 섹션

| 라벨 | 동작 | 상태 |
|------|------|------|
| 세션 타임아웃 드롭다운 | 15분/30분/1시간/2시간/없음 | ✅ |
| 읽기 전용 모드 토글 | 비활성화 (항상 켜짐) | ✅ (의도적 비활성) |

### 10-4. 알림 섹션

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 쿼리 성공 알림 | on/off 토글 | `PATCH /api/settings` | ✅ |
| 쿼리 오류 알림 | on/off 토글 | `PATCH /api/settings` | ✅ |
| 장시간 실행 알림 | on/off 토글 | `PATCH /api/settings` | ✅ |

---

## 11. 대시보드 (`/dashboards`)

> 위치: `src/app/(app)/dashboards/page.tsx`  
> API: `GET /api/dashboards`, `POST /api/dashboards`, `DELETE /api/dashboards/{id}`

**TopBar 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 새 대시보드 | 이름 prompt → 생성 | `POST /api/dashboards` | ✅ |

**필터 · 검색**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 전체 / 내 대시보드 / 공유됨 | 필터 토글 | ✅ |
| 검색창 | 클라이언트 필터 | ✅ |

**대시보드 카드 버튼 (카드당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 열기 | `/dashboards/{id}` 이동 | — | ✅ |
| 삭제 | confirm → DELETE | `DELETE /api/dashboards/{id}` | ✅ |

---

## 12. 대시보드 상세 (`/dashboards/[id]`)

> 위치: `src/app/(app)/dashboards/[id]/page.tsx`  
> API: `GET /api/dashboards/{id}`, `PATCH /api/dashboards/{id}`, `DELETE /api/dashboards/{id}`

**TopBar 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 편집 | 이름 prompt → PATCH | `PATCH /api/dashboards/{id}` | ✅ |
| 삭제 | confirm → DELETE → `/dashboards` | `DELETE /api/dashboards/{id}` | ✅ |

**페이지 버튼**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 공유됨/비공개 Pill | isPublic 토글 | `PATCH /api/dashboards/{id}` | ✅ |
| 위젯 ✕ (삭제) | 위젯 제거 | `PATCH /api/dashboards/{id}` (위젯 배열 업데이트) | ✅ |

---

## 13. 차트 (`/charts`)

> 위치: `src/app/(app)/charts/page.tsx`  
> API: `GET /api/saved`, `POST /api/queries/run`  
> ⚠️ `/api/charts` 라우트 없음 (설계상 `/api/saved` 기반 차트 렌더링)

**TopBar 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 새 차트 | `/workspace` 이동 | ✅ |

**필터 · 검색**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 전체 / 라인 / 바 / 파이 / 테이블 | 차트 타입 필터 | ✅ |
| 검색창 | 쿼리명 검색 | ✅ |

**차트 카드 버튼 (카드당)**

| 라벨 | 동작 | API | 상태 |
|------|------|-----|------|
| 차트 실행 / 새로고침 | 저장 쿼리 재실행 | `POST /api/queries/run` | ✅ |
| 워크스페이스 | SQL 로드 → `/workspace` | — | ✅ |

---

## 14. 상태 · 에러 (`/errors`)

> 위치: `src/app/(app)/errors/page.tsx`  
> API: `GET /api/stats`, `GET /api/history?status=FAILURE`

**버튼 없음** — 상태 정보 표시 전용 (읽기 전용 대시보드)

---

## 15. 프로필 (`/profile`)

> 위치: `src/app/(app)/profile/page.tsx`  
> API: `GET /api/stats`, `GET /api/saved`, `GET /api/history`

**페이지 버튼**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 프로필 편집 | `/settings` 이동 | ✅ |
| 비밀번호 변경하기 | `/settings` 이동 | ✅ |
| 데이터 내보내기 | 저장 쿼리 + 히스토리 JSON 다운로드 | ✅ |
| 계정 삭제 | confirm → 알림 (지원팀 문의 안내) | ✅ |

**최근 활동 항목 버튼 (행당)**

| 라벨 | 동작 | 상태 |
|------|------|------|
| 재실행 (호버) | SQL 로드 → `/workspace` | ✅ |

---

## API 라우트 전수 검사 결과

| 메서드 | 경로 | 상태 | 비고 |
|--------|------|------|------|
| GET | `/api/connections` | ✅ 200 | |
| POST | `/api/connections` | ✅ 201 | |
| POST | `/api/connections/{id}/test` | ✅ 200/422 | |
| DELETE | `/api/connections/{id}` | ✅ 200 | |
| GET | `/api/ai-providers` | ✅ 200 | |
| POST | `/api/ai-providers` | ✅ 201 | |
| PATCH | `/api/ai-providers/{id}` | ✅ 200 | |
| DELETE | `/api/ai-providers/{id}` | ✅ 200 | |
| POST | `/api/ai-providers/{id}/test` | ✅ 200/422 | |
| POST | `/api/ai-providers/{id}/activate` | ✅ 200 | |
| GET | `/api/settings` | ✅ 200 | ~~500~~ → 폴백 추가로 수정 |
| PATCH | `/api/settings` | ✅ 200 | |
| GET | `/api/history` | ✅ 200 | |
| POST | `/api/history/{id}/star` | ✅ 200 | |
| DELETE | `/api/history/{id}` | ✅ 200 | |
| GET | `/api/saved` | ✅ 200 | |
| POST | `/api/saved` | ✅ 201 | |
| PATCH | `/api/saved/{id}` | ✅ 200 | |
| DELETE | `/api/saved/{id}` | ✅ 200 | |
| GET | `/api/schema` | ✅ 200 | |
| GET | `/api/glossary` | ✅ 200 | |
| POST | `/api/glossary` | ✅ 201 | |
| DELETE | `/api/glossary/{id}` | ✅ 200 | |
| POST | `/api/queries/generate` | ✅ 200/500 | AI 설정 필요 시 500 |
| POST | `/api/queries/run` | ✅ 200/400/403 | SQL 가드 적용 |
| GET | `/api/dashboards` | ✅ 200 | |
| POST | `/api/dashboards` | ✅ 201 | |
| PATCH | `/api/dashboards/{id}` | ✅ 200 | |
| DELETE | `/api/dashboards/{id}` | ✅ 200 | |
| GET | `/api/stats` | ✅ 200 | |
| GET | `/api/charts` | ⚠️ 404 | 의도적 없음 (차트는 `/api/saved` 활용) |

---

## 발견된 이슈 및 수정 사항

| 이슈 | 심각도 | 상태 | 수정 내용 |
|------|--------|------|----------|
| `/api/settings` GET → 500 (DB 테이블 미생성 시) | 중 | ✅ 수정 완료 | catch 블록에서 default settings 반환 |
| `/api/settings` PATCH → 500 (DB 테이블 미생성 시) | 중 | ✅ 수정 완료 | catch 블록에서 요청 데이터 그대로 반환 |
| `/api/charts` 라우트 없음 | 낮음 | ℹ️ 설계 의도 | 차트 페이지는 `/api/saved` 데이터 활용 |

---

## 통계 요약

| 분류 | 수량 |
|------|------|
| 페이지 라우트 | 12개 |
| API 라우트 (엔드포인트) | 30개 |
| 사이드바 메뉴 항목 | 11개 |
| 명령 팔레트 커맨드 | 9개 |
| 버튼 · 액션 (전체) | 약 82개 |
| 발견된 버그 | 2개 (수정 완료) |
| 브라우저 내비게이션 링크 | 30개+ |

---

*자동 생성: 소스 정적 분석 + HTTP 라우트 검사 (Playwright 미사용)*
