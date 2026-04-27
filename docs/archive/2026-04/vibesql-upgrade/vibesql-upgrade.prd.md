# PRD: vibeSQL 전체 서비스 고도화

**Feature**: vibesql-upgrade
**Version**: 1.0.0
**Date**: 2026-04-27
**Status**: PM Analysis Complete
**PM Method**: Teresa Torres OST + JTBD 6-Part + Lean Canvas + Beachhead

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 비개발자(데이터 분석가, 기획자, 운영자)가 SQL을 직접 작성하지 않고도 데이터베이스 인사이트를 얻는 과정이 불투명하고, 기존 UX에 다수의 마찰 포인트가 존재한다 |
| **Solution** | NL→SQL 워크플로우 전 주기(쿼리 생성 → 저장 → 예약 → 분석)를 일관된 디자인 시스템으로 통일하고, RBAC 3-레이어를 강화하여 비개발자도 신뢰할 수 있는 셀프서비스 데이터 플랫폼을 구현한다 |
| **Functional UX Effect** | 모든 native prompt() 제거, 다크모드 완전 지원, 인라인 피드백 시스템, 관리자 확인 모달 → 클릭 수 감소·오류율 감소 |
| **Core Value** | "데이터를 SQL 없이 조회한다"는 핵심 약속을 유지하면서, 반복 사용 (저장/예약/대시보드)과 팀 협업(관리자 통제/감사)을 안정적으로 지원 |

---

## 1. Product Vision

### 1.1 One-Line Pitch
> 자연어로 묻고, SQL로 답하고, 대시보드로 공유한다 — SQL 없이도 데이터팀처럼.

### 1.2 Target Users
| Persona | Role | Key Need |
|---------|------|----------|
| **다나 (데이터 분석가)** | 비개발 분석가, 30대 | SQL 없이 빠른 임시 쿼리; 저장/재사용; 히스토리 |
| **준호 (팀장/기획자)** | 비기술 의사결정자, 40대 | 대시보드로 공유받기; 예약 보고서; 모바일 가독성 |
| **소은 (DB 관리자/ADMIN)** | 기술적 관리자, 30대 | 사용자 권한 관리; 감사 로그 추적; AI 프로바이더 설정 |

### 1.3 Market Context
- **TAM**: 국내 BI/데이터 셀프서비스 툴 시장 ~ ₩800B (Gartner 2025)
- **SAM**: 중소기업/스타트업 대상 NL→SQL 플랫폼 ~ ₩80B
- **SOM**: 초기 3년 목표 ~ ₩8B (시장 10% 점유 목표)

---

## 2. Problem Space (Opportunity Solution Tree)

### 2.1 Outcome Goal
**비개발 사용자가 하루 1회 이상 SQL 없이 데이터 인사이트를 얻는다**

### 2.2 Opportunity Tree
```
[Outcome] 비개발자 일일 활성 데이터 접근
│
├─ [Opportunity 1] 첫 쿼리 생성의 마찰 감소
│   ├─ Sol 1a: 템플릿 라이브러리 강화 (카테고리 필터, 즐겨찾기)
│   ├─ Sol 1b: 홈 화면 최근 쿼리 원클릭 재실행 ✅ (Cycle 1 완료)
│   └─ Sol 1c: 스키마 브라우저에서 바로 SELECT 실행 ✅ (Cycle 1 완료)
│
├─ [Opportunity 2] 쿼리 재사용성 향상
│   ├─ Sol 2a: 저장 쿼리 폴더 관리 UI 고도화 ✅ (Cycle 2 완료)
│   ├─ Sol 2b: 저장 쿼리 이름 인라인 편집 ✅ (Cycle 2 완료)
│   └─ Sol 2c: 버전 히스토리 복원 기능
│
├─ [Opportunity 3] 관리자·팀 운영 효율화
│   ├─ Sol 3a: 사용자 역할 변경 확인 모달 ✅ (Cycle 1 완료)
│   ├─ Sol 3b: 감사 로그 날짜/사용자 필터 🔲 (미구현)
│   └─ Sol 3c: RBAC 3-레이어 완전 적용 ✅ (Cycle 1 완료)
│
├─ [Opportunity 4] 다크모드·접근성 완성도
│   ├─ Sol 4a: 버튼 하드코딩 색상 제거 ✅ (Cycle 1 완료)
│   ├─ Sol 4b: 설정 페이지 테마 색상 타일 토큰화 🔲 (미구현)
│   └─ Sol 4c: 프로필 페이지 실제 사용자 정보 🔲 (미구현)
│
└─ [Opportunity 5] 자동화·예약·공유 루프
    ├─ Sol 5a: 스케줄러 인라인 토글 ✅ (Cycle 2 완료)
    ├─ Sol 5b: 대시보드 prompt() 인라인 폼으로 교체 🔲 (미구현)
    └─ Sol 5c: AI 컨텍스트 JSON 내보내기/가져오기 🔲 (미구현)
```

---

## 3. Value Proposition (JTBD 6-Part)

### 3.1 Job Statement
```
When [비개발 직원이 데이터 관련 질문이 생겼을 때]
I want to [자연어로 질문을 입력하면 실행 가능한 SQL과 결과를 얻고 싶다]
So I can [개발팀에 의존하지 않고 내 업무 판단을 내릴 수 있다]
```

### 3.2 Job Map
| Stage | Activity | Current Pain | Desired Outcome |
|-------|----------|-------------|-----------------|
| **정의** | 데이터 질문 명확화 | SQL 문법 몰라서 포기 | 자연어 입력으로 즉시 시작 |
| **준비** | DB 연결 확인 | 연결 상태 불명확 | 연결 상태 배지 실시간 확인 ✅ |
| **실행** | 쿼리 생성·실행 | AI 생성 SQL 신뢰도 의문 | SQL 미리보기 + 원클릭 실행 |
| **검증** | 결과 확인 | 다크모드에서 UI 깨짐 | 어떤 테마에서도 동일 UX ✅ |
| **저장** | 쿼리 보관·정리 | prompt() 다이얼로그 불편 | 인라인 모달 폼 ✅ |
| **공유** | 팀과 공유 | 대시보드 생성이 복잡 | prompt() 제거 후 인라인 생성 🔲 |
| **자동화** | 정기 보고 | 스케줄 토글이 불명확 | 인라인 토글 + 즉시 피드백 ✅ |

---

## 4. Lean Canvas

| Block | Content |
|-------|---------|
| **Problem** | 1) SQL 작성 진입장벽, 2) 기존 BItools가 너무 복잡, 3) 개발팀 의존성 |
| **Customer Segments** | 비개발 분석가, 스타트업 기획자, SMB 운영팀 |
| **Unique Value Prop** | "한국어로 물어보면 SQL이 된다" + 팀 협업 RBAC |
| **Solution** | NL→SQL + 저장/예약/대시보드 + 관리자 통제 |
| **Channels** | 직접 영업(SMB), 개발자 커뮤니티, SaaS 마케팅 |
| **Revenue** | SaaS 구독 (사용자 수 / 쿼리 수 기반) |
| **Cost Structure** | Claude API 비용, 인프라, 개발 인건비 |
| **Key Metrics** | DAU, 쿼리 생성 수, 저장률, 예약 수, AI 비용/쿼리 |
| **Unfair Advantage** | 한국어 최적화 프롬프트 + 사내 스키마 통합 |

---

## 5. Beachhead Segment (Geoffrey Moore)

**1차 타겟**: 국내 스타트업/SMB (50-200명) 중 **비개발 데이터 담당자 1-3명** 팀

**이유**:
- SQL 교육 비용 없이 즉시 사용 가능
- 관리자(CTO/데이터 엔지니어) 1명이 ADMIN 역할 수행
- Claude API 비용을 구독료로 정당화 가능
- 피드백 루프 빠름 (소규모 팀)

**Expansion Path**: SMB → 중견기업 → Enterprise (CSAP/SSO 추가)

---

## 6. Competitive Analysis

| Product | Strength | vibeSQL Advantage |
|---------|----------|-------------------|
| **Metabase** | 시각화 강점 | NL→SQL 직접 생성; 한국어 특화 |
| **Mode Analytics** | 협업 강점 | 설치 불필요; SaaS 즉시 사용 |
| **Retool** | 커스텀 UI | 비개발자 친화적 인터페이스 |
| **ChatGPT + 직접 복사** | 범용성 | DB 연결 통합; 실행까지 원스톱 |
| **Superset** | 오픈소스 | 관리 부담 없음; 클라우드 서비스 |

---

## 7. GTM Strategy

### Phase 1 (현재): Product-Market Fit
- 타겟: 국내 스타트업 50개사 파일럿
- 목표: DAU 30%+ 유지율, NPS 40+
- 채널: 개발자 커뮤니티(GeekNews, 스택오버플로우 KR)

### Phase 2 (3개월): Growth
- 팀 플랜 출시 (ADMIN + N USER)
- 사용자 초대 / 온보딩 플로우
- 목표: MRR ₩10M

### Phase 3 (6개월): Scale
- Enterprise 플랜 (SSO, 감사 로그 확장, 전용 인스턴스)
- 파트너 채널 (SI, 클라우드 리셀러)

---

## 8. User Stories (Must / Should / Could)

### MUST (Sprint 1 — 현재 잔여 작업)
| # | As a | I want to | So that | Status |
|---|------|-----------|---------|--------|
| US-01 | 일반 사용자 | 대시보드 생성 시 인라인 폼 사용 | 브라우저 기본 prompt 없이 이름 입력 | 🔲 미구현 |
| US-02 | 일반 사용자 | 프로필 페이지에서 실제 이름/이메일 확인 | 하드코딩된 텍스트 대신 실제 정보 | 🔲 미구현 |
| US-03 | ADMIN | 감사 로그를 날짜 범위로 필터링 | 특정 기간 이벤트 추적 | 🔲 미구현 |
| US-04 | 일반 사용자 | 설정 페이지 테마 선택이 디자인 시스템 토큰 사용 | 다크모드에서도 정상 표시 | 🔲 미구현 |

### SHOULD (Sprint 2)
| # | As a | I want to | So that | Status |
|---|------|-----------|---------|--------|
| US-05 | ADMIN | /errors 페이지 감사 로그 탭이 /audit-logs로 리디렉트 | 동일 데이터 중복 표시 제거 | 🔲 미구현 |
| US-06 | 일반 사용자 | AI 컨텍스트 JSON 내보내기/가져오기 | 환경 마이그레이션 시 설정 이전 | 🔲 미구현 |
| US-07 | 일반 사용자 | AI 컨텍스트 few_shot 값을 전체 SQL 보기 | 100자 잘림 없이 전체 확인 | 🔲 미구현 |
| US-08 | ADMIN | 감사 로그 페이지네이션 | 200건 이상 로그 탐색 | 🔲 미구현 |

### COULD (Sprint 3+)
| # | As a | I want to | So that |
|---|------|-----------|---------|
| US-09 | 일반 사용자 | 쿼리 결과 CSV/Excel 내보내기 | 외부 도구에서 후속 분석 |
| US-10 | 일반 사용자 | 쿼리 결과를 슬랙으로 공유 | 팀원에게 즉시 공유 |
| US-11 | ADMIN | 사용자별 쿼리 사용량 통계 | 비용 배분 및 모니터링 |
| US-12 | 일반 사용자 | 워크스페이스 멀티탭 (여러 쿼리 동시 편집) | 비교 분석 효율 향상 |

---

## 9. Job Stories

```
When [사용자가 대시보드를 새로 만들려고 할 때]
I want to [이름 입력 폼이 페이지 내에서 열리는 것을]
So I can [브라우저 팝업 차단 걱정 없이 대시보드를 빠르게 생성할 수 있다]

When [ADMIN이 사용 패턴을 분석하려고 할 때]
I want to [감사 로그를 특정 날짜 범위와 사용자로 필터링하는 것을]
So I can [이상 행동 감지 및 규정 준수 보고를 효율적으로 처리할 수 있다]

When [사용자가 새 환경으로 이전할 때]
I want to [AI 컨텍스트 설정을 JSON으로 내보내고 가져오는 것을]
So I can [수동 재입력 없이 설정을 빠르게 복원할 수 있다]
```

---

## 10. Success Metrics (OKR)

### Objective: vibeSQL을 비개발자의 기본 데이터 접근 도구로 만든다

| KR | Metric | Baseline | Target (3M) |
|----|--------|----------|-------------|
| KR-1 | 일일 쿼리 생성 수 | 측정 중 | +40% |
| KR-2 | 저장 쿼리 재사용률 | 측정 중 | 30%+ |
| KR-3 | UI 에러 신고 (prompt/dark mode) | 다수 | 0건 |
| KR-4 | ADMIN 작업 완료율 (권한 변경/감사) | 낮음 | 95%+ |
| KR-5 | 신규 사용자 7일 리텐션 | 미측정 | 40%+ |

---

## 11. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude API 비용 급증 | 중 | 높음 | 쿼리 캐싱, 요율 제한, 비용 모니터링 |
| SQL 가드 우회 시도 | 낮음 | 높음 | AST 검증 강화, 감사 로그 |
| 다크모드 회귀 | 높음 | 중 | 디자인 시스템 토큰 lint 규칙 |
| 관리자 권한 오남용 | 낮음 | 높음 | RBAC 3-레이어, 확인 모달 |

---

## 12. Implementation Roadmap

### Sprint 1 (현재 — 2026-04-27 ~ 2026-05-04)
**Must 항목 구현**
1. 대시보드 prompt() → 인라인 폼 교체
2. 프로필 페이지 실제 사용자 정보 표시
3. 설정 페이지 테마 타일 디자인 토큰화
4. 감사 로그 날짜/사용자 필터

### Sprint 2 (2026-05-05 ~ 2026-05-18)
**Should 항목 구현**
5. /errors 감사 로그 탭 리디렉트
6. AI 컨텍스트 JSON 내보내기/가져오기
7. AI 컨텍스트 few_shot 전체 보기
8. 감사 로그 페이지네이션

### Sprint 3+ (2026-05-19~)
**Could 항목 + 신규 기능**
9. 쿼리 결과 CSV 내보내기
10. 워크스페이스 멀티탭

---

## 13. Pre-mortem

**"6개월 후 실패했다면, 이유는?"**

1. **Claude API 비용 폭발**: 요율 제한 없이 출시 → 비용 초과 → 서비스 중단
2. **다크모드 회귀 반복**: 디자인 시스템 규칙 없이 개발 → 사용자 이탈
3. **RBAC 우회**: 미들웨어 Edge 제한 무시 → 보안 사고
4. **스키마 인덱싱 블로킹**: 대용량 DB 연결 시 UI 블로킹 → 성능 불만

**대응**:
- Claude API: `staleTime` + 캐시 + 쿼리당 토큰 제한
- 다크모드: `var(--ds-*)` 토큰 lint 규칙 CI에 추가
- RBAC: `requireAdmin()` 단위 테스트 + 미들웨어 통합 테스트
- 스키마: 백그라운드 인덱싱 + 30s staleTime

---

*Generated by: PM Agent Team (pm-discovery + pm-strategy + pm-research + pm-prd)*
*Method: Teresa Torres OST + JTBD 6-Part + Lean Canvas + Geoffrey Moore Beachhead*
