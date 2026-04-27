---
name: vibeSQL UX Review 2026-04
description: 2026-04-27 데이터 분석가 페르소나로 13개 메뉴 전수 리뷰 완료 — 플랜 생성됨
type: project
---

2026-04-27 vibeSQL 전체 메뉴(13개) UX 리뷰 완료. Plan 문서 생성됨.

**Plan 위치**: `docs/01-plan/features/ux-improvement-2026.plan.md`

**Why:** 기능은 구현되어 있으나 confirm/prompt 남용, 편집 기능 누락, 핵심 필터 버그, 대시보드 상세 미구현 등 완성도 이슈 다수 발견.

**How to apply:** 이 리뷰 결과를 Design/Do 단계에서 참조. Must 항목 5개 먼저 처리.

**핵심 발견사항**:
- confirm/prompt/alert 사용 위치: connections, history, saved(3곳), templates, dashboards, schedules, profile
- 히스토리 "실패" 필터 버그: statusParam이 `FAILURE`인데 API는 `ERROR` 사용
- 용어 사전 편집 기능 완전 부재
- 스키마 페이지에 연결 선택 드롭다운 없음 (워크스페이스 의존)
- 저장됨 새 폴더 생성 로직이 미분류 쿼리를 강제 이동시키는 버그
- 대시보드 /dashboards/[id] 상세 페이지 구현 여부 불확실
