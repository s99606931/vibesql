# vibeSQL PM 메뉴 구조 & 기능 갭 분석

> 작성: 2026-04-26 · PM 팀장 (PM Agent Team) · vibeSQL Enterprise

## Executive Summary

| 관점 | 핵심 메시지 |
|------|-------------|
| **Problem** | 12개 메뉴가 평면(flat) 구조로 나열되어 사용자가 워크플로우(연결 → 스키마 이해 → 쿼리 → 결과 → 공유)를 따라가기 어렵고, 핵심 기능(워크스페이스)과 보조 기능(에러/프로필)이 시각적 위계 없이 동등하게 노출됨. |
| **Solution** | 5개 그룹(Workspace / Knowledge / Insights / Sources / Account)으로 재조직, 사용 빈도와 워크플로우 순서에 맞춰 재배치하고, 협업·신뢰성·관측성 기능을 전략적으로 추가. |
| **Function UX Effect** | 신규 사용자는 "연결 → 워크스페이스" 경로가 명확해지고, 파워 유저는 자주 쓰는 7개 메뉴가 상단에 모여 클릭 수 30%↓ 예상. |
| **Core Value** | 비개발자/분석가가 SQL 없이 데이터에 도달하는 시간을 단축하고, AI 결과의 신뢰성·재현성·공유 가능성을 보장해 Metabase·Redash 대비 "AI-native + Trust" 차별점을 확보. |

---

## 1. 현재 메뉴 구조 진단

### 1.1 평면 12개 메뉴 (As-Is)

```
홈 · 워크스페이스 · 스키마 · 용어 사전 · 결과·차트 · 대시보드
히스토리 · 저장됨 · 연결 · 프로필 · 상태·에러 · 설정
```

### 1.2 발견된 UX 문제

| # | 문제 | 영향도 | 근거 |
|---|------|--------|------|
| P1 | **워크플로우 역순** — "워크스페이스(2)"가 "연결(9)"보다 먼저 노출. 첫 사용자는 연결 없이 워크스페이스에 진입해 빈 화면을 마주함 | High | 신규 가입 funnel의 일반적 이탈 지점 |
| P2 | **그룹핑 부재** — 12개 항목이 동등 위계로 나열, 인지 부하(cognitive load) 과다. Miller's Law(7±2) 위반 | High | UX 표준 |
| P3 | **이질적 항목 혼재** — "프로필"(개인 설정)과 "상태·에러"(운영 모니터링)가 같은 리스트에 위치 | Medium | 정보 아키텍처 원칙 위반 |
| P4 | **"결과·차트"의 모호함** — 차트는 "결과"의 한 표현 방식인데 별도 메뉴로 존재. 대시보드/저장됨과 의미적 중복 | Medium | 사용자 멘탈 모델 충돌 |
| P5 | **"홈"의 역할 불명** — 대시보드/시작 페이지/통계 중 어느 것인지 불분명 | Medium | 첫 인상 약화 |
| P6 | **"용어 사전" 단독 위치** — 스키마 이해를 보강하는 보조 도구인데 워크플로우 흐름과 분리됨 | Low | Discovery 마찰 |
| P7 | **협업/공유 메뉴 부재** — 팀, 권한, 공유 링크가 없어 Enterprise 전제와 맞지 않음 | High | 시장 기대치 미달 |
| P8 | **카운트 표시는 "저장됨"만** — 히스토리/에러/대시보드의 변경 알림이 없어 변화 인지 불가 | Low | 재방문율 저하 |

### 1.3 워크플로우 vs 메뉴 순서 불일치

사용자의 자연스러운 흐름:

```
① 회원가입 → ② DB 연결 → ③ 스키마 파악 → ④ 용어 정의(선택)
→ ⑤ 자연어 질문(워크스페이스) → ⑥ 결과 확인 → ⑦ 저장/차트/대시보드 → ⑧ 공유
```

현재 메뉴는 **②⑤**의 순서를 뒤집고 **⑧**이 아예 없으며, ⑦이 3개 메뉴(차트·대시보드·저장됨)로 분산됩니다.

---

## 2. 개선된 메뉴 구조 (To-Be)

### 2.1 5개 그룹 재구성

```
┌─ Workspace ──────────────── (매일 사용)
│  • 홈 (대시보드 위젯)        High
│  • 워크스페이스               High  ★ Primary
│  • 히스토리                   High
│  • 저장됨                     High
│
├─ Insights ──────────────── (분석·공유)
│  • 대시보드                   High
│  • 차트 갤러리                Medium
│  • 리포트 (신규)              Medium
│
├─ Knowledge ─────────────── (데이터 컨텍스트)
│  • 스키마                     Medium
│  • 용어 사전                  Medium
│  • 데이터 카탈로그 (신규)     Medium
│
├─ Sources ──────────────── (데이터 원천·운영)
│  • 연결                       High
│  • 권한·역할 (신규)            Medium
│  • 스케줄 작업 (신규)          Medium
│  • 상태·에러                  Low
│
└─ Account ──────────────── (개인·시스템)
   • 팀 (신규)                  Medium
   • 프로필                     Low
   • 설정                       Low
   • 알림 (신규)                Low
```

### 2.2 우선순위 결정 근거

| 그룹 | 사용 빈도 | 워크플로우 위치 | 근거 |
|------|-----------|-----------------|------|
| **Workspace** | 매일 다회 | 핵심 활동 | 70/20/10 법칙: 70%의 사용 시간이 이 그룹에 집중됨 |
| **Insights** | 주 단위 | 결과 활용 | 분석가→소비자 가치 전달 단계 |
| **Knowledge** | 처음/주기적 | 정확도 향상 | 스키마·용어 정확도가 NL2SQL 품질을 좌우 |
| **Sources** | 셋업/관리 | 인프라 | 변경 빈도는 낮으나 신뢰성에 직결 |
| **Account** | 드물게 | 보조 | 일반적 사이드바 하단 위치 관행 |

### 2.3 메뉴별 우선순위 지정

| 항목 | 우선순위 | 비고 |
|------|----------|------|
| 워크스페이스 | **High** | 핵심 가치 전달 entry point |
| 연결 | **High** | 첫 사용 prerequisite |
| 히스토리 / 저장됨 / 대시보드 | **High** | 재방문 동인 |
| 홈 / 스키마 / 용어 사전 / 차트 갤러리 | **Medium** | 보조 가치 |
| 권한·역할 / 스케줄 / 팀 / 리포트 / 데이터 카탈로그 | **Medium** | 신규 — Enterprise 필수 |
| 프로필 / 설정 / 상태·에러 / 알림 | **Low** | 운영 보조 |

---

## 3. 추가 필요 기능 도출

### 3.1 핵심 기능 (즉시 구현 — M2, 4-6주)

| # | 기능명 | 설명 | 비즈니스 가치 | 복잡도 | 메뉴 위치 |
|---|--------|------|----------------|--------|-----------|
| C1 | **공유 링크 (Share)** | 쿼리/결과/대시보드를 URL 한 줄로 공유, 만료·권한 설정 가능 | 협업 마찰 제거. 분석가→PM/CEO에게 결과 전달 시간 분→초 | Medium | 결과 헤더 액션 |
| C2 | **AI 결과 검증 (Confidence Score)** | LLM이 생성한 SQL의 신뢰도(스키마 일치율·구문 안전성·예상 결과 사이즈)를 점수화 | "AI가 거짓말하는 거 아닐까?" 의심을 해소. 유료 전환의 핵심 trust signal | High | 워크스페이스 패널 |
| C3 | **쿼리 설명 모드 (Explain)** | 생성된 SQL의 각 절(SELECT/JOIN/WHERE)을 자연어로 설명, 비개발자 학습 보조 | 비개발자 진입 장벽 제거. NL2SQL의 본질적 가치 강화 | Low | 워크스페이스 탭 |
| C4 | **권한·역할 관리 (RBAC)** | 사용자/팀별 연결·테이블·컬럼 단위 접근 제어 (READ/WRITE/MASK) | Enterprise 도입 필수 조건. PII 컬럼 마스킹 필요 | High | Sources/권한 |
| C5 | **감사 로그 (Audit Log)** | 누가·언제·어떤 쿼리를 실행했는지 변경 불가 로그 | GDPR/SOC2 컴플라이언스. Enterprise 입찰 요건 | Medium | Sources/상태·에러 |

### 3.2 중요 기능 (단기 로드맵 — M3, 6-10주)

| # | 기능명 | 설명 | 비즈니스 가치 | 복잡도 | 메뉴 위치 |
|---|--------|------|----------------|--------|-----------|
| I1 | **스케줄 작업 (Scheduled Queries)** | 쿼리/대시보드를 정기 실행해 결과를 Slack/Email로 발송 | "매일 9시 매출 리포트" 자동화. 재방문 유도 | Medium | Sources/스케줄 |
| I2 | **데이터 카탈로그 (Data Catalog)** | 테이블 설명·소유자·태그·인기도, 검색 가능한 메타데이터 허브 | 대규모 스키마(100+ 테이블)에서 발견성 확보. AI 컨텍스트 품질 ↑ | High | Knowledge/카탈로그 |
| I3 | **알림 센터 (Notifications)** | 쿼리 실패, 스키마 변경, 공유 링크 활동, 임계치 초과를 인박스화 | 능동적 운영 가능. 재참여 채널 확보 | Low | Account/알림 |
| I4 | **팀 워크스페이스 (Team)** | 팀 단위 폴더·권한·구독료 분리, 멤버 초대 | B2B SaaS 멀티 테넌트 표준. 매출 모델의 기본 단위 | Medium | Account/팀 |
| I5 | **버전 관리 (Query Versioning)** | 저장된 쿼리의 변경 이력, diff 보기, 롤백 | 중요 쿼리(KPI 정의)의 무결성 보장 | Medium | 저장됨/상세 |
| I6 | **AI 컨텍스트 튜너** | 도메인별 few-shot 예시·금지 패턴·테이블 별칭을 사용자가 등록, 프롬프트에 자동 주입 | NL2SQL 정확도 +15-25% (SOTA 기법) | High | Knowledge/용어 사전 확장 |
| I7 | **결과 데이터 다운로드 / Export 대시보드** | CSV뿐 아니라 Parquet, Excel(서식), Google Sheets 직접 push | 분석가 워크플로우 통합. 마찰점 제거 | Low | 결과 헤더 |
| I8 | **벡터 기반 스키마 검색** | 자연어로 "고객 결제 실패 관련 테이블" 검색. pgvector 활용 | 대규모 스키마 발견성. M1 잔여 TODO에 이미 명시됨 | High | 스키마 검색바 |
| I9 | **차트 갤러리 → 시각화 빌더** | 차트를 선택형이 아닌 드래그 빌더로 (X/Y/색/필터). Recharts 기반 | 비개발자 자율성. Metabase 패리티 | High | Insights/차트 갤러리 |

### 3.3 부가 기능 (장기 로드맵 — M4+, 10주+)

| # | 기능명 | 설명 | 비즈니스 가치 | 복잡도 | 메뉴 위치 |
|---|--------|------|----------------|--------|-----------|
| L1 | **임베디드 분석 (Embedding SDK)** | iframe/JS SDK로 외부 앱에 차트·쿼리 임베드 | B2B 매출 채널(임베드형 라이선스). Metabase Embedding 패리티 | High | Insights/공유 |
| L2 | **AI 에이전트 (Agentic Analysis)** | "지난주 이상 매출 원인 분석해줘" → 멀티 쿼리 자동 실행·해석 | 분석가 대체급 가치. 차세대 차별점 | Very High | 워크스페이스 모드 토글 |
| L3 | **데이터 품질 모니터링** | 컬럼 NULL률·분포·이상치 추적, 알림 | 데이터 신뢰성 보강. dbt-tests 영역 진입 | High | Knowledge/카탈로그 |
| L4 | **써드파티 통합 허브** | Slack/Notion/Linear/Tableau로 결과 push, OAuth 토큰 관리 | 워크플로우 endpoint 다양화 | Medium | Account/통합 |
| L5 | **모바일 / 임베디드 알림 뷰** | 핵심 KPI를 모바일로 푸시, 탭하면 차트 풀스크린 | 의사결정자 도달성 (CEO/임원) | High | 모바일 앱 |
| L6 | **Git-style Sync** | 쿼리/대시보드를 Git 리포지토리와 양방향 동기화 | 데이터 엔지니어용 IaC 워크플로우 | High | 설정/통합 |
| L7 | **자체 SLM 호스팅 옵션** | Claude API 외 OnPrem LLM(Llama/Mistral) 선택 가능, 데이터 외부 전송 0% | 금융/의료/공공 시장 진입 키 | Very High | 설정/AI 프로바이더 |
| L8 | **A/B 실험 분석 모듈** | 실험 ID 입력 → 자동 t-test/CUPED 분석 리포트 | 그로스팀 워크플로우 commodity화 | High | Insights/리포트 |

---

## 4. 경쟁 제품 벤치마크 비교

### 4.1 기능 매트릭스

| 기능 | Metabase | Retool | Tableau | Redash | **vibeSQL (To-Be)** |
|------|:--------:|:------:|:-------:|:------:|:--------------------:|
| 자연어 → SQL | 부분 (Metabot, 베타) | X | Pulse(베타) | X | **Native** ★ |
| AI 결과 신뢰도 | X | X | X | X | **Native** ★★ |
| 차트 빌더 | O | O | O★ | O | O (M3) |
| 대시보드 공유 | O | O | O | O | O (M2) |
| RBAC / 컬럼 마스킹 | O★ | O | O★ | △ | O (M2) |
| 스케줄·알림 | O | △ | O | O | O (M3) |
| 데이터 카탈로그 | △ | X | O★ | X | O (M3) |
| 임베디드 분석 | O★ | △ | O | △ | 로드맵 (M4) |
| Self-host / OnPrem | O | O | O | O | 로드맵 (M4) |
| 자연어 컨텍스트 학습 | X | X | X | X | **Native** ★ |
| Agentic 자동 분석 | X | X | △ | X | 로드맵 (M4) ★ |
| 가격 (entry) | $85/월 | $10/사용자 | $70/사용자 | OSS | TBD |

★ = 카테고리 선두. ★★ = 시장에 없는 차별점.

### 4.2 vibeSQL이 갖춰야 할 차별점 (3개의 wedge)

#### Wedge 1: AI-native NL2SQL with Trust
- **Why**: 경쟁사는 BI 도구에 AI를 "추가"했지만 vibeSQL은 AI를 1순위로 설계
- **What**: Confidence Score (C2) + Explain Mode (C3) + Context Tuner (I6) 패키지
- **Defensibility**: 사용자 도메인 학습이 누적되며 록인 효과 발생

#### Wedge 2: Time-to-First-Insight 90초
- **Why**: Metabase 셋업은 평균 30분, Tableau는 며칠
- **What**: 연결 → 자동 스키마 인덱싱 → 추천 질문 3개 → 첫 답변까지 90초
- **Tactic**: 홈 페이지를 "예시 질문" 카드로 시작, 신규 사용자 onboarding flow

#### Wedge 3: Conversation as the Unit of Analysis
- **Why**: 기존 BI는 "쿼리"가 단위. 사용자는 "주제"로 사고함
- **What**: 워크스페이스에 대화 스레드 개념 도입, 후속 질문이 컨텍스트 누적
- **Future**: Agentic Mode (L2)의 자연스러운 진입점

### 4.3 경쟁사별 학습 포인트

| 경쟁사 | 우리가 배울 점 | 우리가 피할 점 |
|--------|----------------|----------------|
| **Metabase** | OSS 커뮤니티 빌드, 임베드 모델 매출 | 차트 빌더 UI 복잡도, 데이터 모델 추상화 부족 |
| **Retool** | 권한·앱 빌더 통합 | 코드 의존성, 비개발자 진입 어려움 |
| **Tableau** | 데이터 카탈로그·거버넌스 | 가격, 학습 곡선, 모바일 약점 |
| **Redash** | 가벼운 쿼리 실행 모델 | 대시보드 표현력 부족, 정체된 OSS 메인테넌스 |

---

## 5. 권장 실행 순서 (PDCA 연계)

| 단계 | 산출물 | 우선순위 | 다음 액션 |
|------|--------|----------|-----------|
| **즉시** | 사이드바 그룹핑 리팩터 (Sidebar.tsx) | High | `/pdca plan sidebar-grouping` |
| **2주 내** | 권한·감사 로그 PRD (C4, C5) | High | `/pdca pm rbac-audit` |
| **4주 내** | AI Confidence Score 디자인 (C2) | High | `/pdca pm ai-trust-score` |
| **6주 내** | 공유 링크 + Explain 모드 (C1, C3) | High | `/pdca plan share-explain` |
| **분기 내** | 스케줄·카탈로그·팀 (I1, I2, I4) | Medium | M3 로드맵 정식화 |

---

## 6. 메뉴 구조 마이그레이션 영향도

### 6.1 영향 받는 파일 (예상)

- `src/components/shell/Sidebar.tsx` — `navItems` 배열을 `navGroups` 구조로 전환
- `src/app/(app)/layout.tsx` — 그룹 헤더 렌더링 추가
- `src/app/page.tsx` (홈) — 위젯 레이아웃 재정의
- 신규 라우트 5개: `/team`, `/permissions`, `/schedules`, `/notifications`, `/catalog`

### 6.2 데이터 모델 영향

- `User` ↔ `Team` 다대다, `Role`, `Permission(scope, action)` 신규
- `AuditLog(actor, action, target, timestamp, ip)` 신규
- `Schedule(query_id, cron, channel, last_run)` 신규
- `CatalogEntry(table_id, owner, description, tags[], popularity)` 신규
- `Notification(user_id, type, payload, read_at)` 신규

### 6.3 비호환 변경 (Breaking)

- `/charts`, `/dashboards`, `/saved`의 시각적 위계 변경 — bookmark URL은 유지(라우트 불변)
- "결과·차트" 라벨이 "차트 갤러리"로 변경 — i18n key `charts.label` 갱신

---

## 7. 핵심 결론

1. **메뉴 구조는 정보 아키텍처 문제이자 제품 전략 문제** — 평면 12개를 5그룹으로 재편성하면 워크플로우와 일치한다.
2. **누락된 핵심 기능은 "Trust"와 "Collaboration"** — Confidence Score, Explain, 공유, RBAC, 감사 로그가 즉시 필요하다.
3. **차별점은 AI-native + 90초 onboarding + 대화형 분석** 3축. 경쟁사가 따라오기 전에 1년 내 굳혀야 한다.
4. **로드맵은 Workspace → Insights → Knowledge → Sources → Account 순으로 가치 전달이 가장 자연스럽다.**

---

## 다음 단계

```bash
# 메뉴 그룹핑 리팩터부터 시작
/pdca plan sidebar-grouping

# 또는 AI 신뢰도 기능 PM 분석
/pdca pm ai-trust-score
```

> 본 문서는 PM Agent Team 분석 결과의 압축본입니다. 각 기능별 상세 PRD는 `/pdca pm {feature}` 명령으로 생성하세요.
