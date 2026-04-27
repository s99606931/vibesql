---
template: plan
version: 1.3
feature: vibesql-sprint3
date: 2026-04-27
---

# vibesql-sprint3 Plan

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | vibesql-upgrade Sprint 1+2 이후 workspace + dashboards/[id] 페이지에 native prompt() 4건이 남아 "모든 prompt() 0건" PRD 목표 미달 |
| **Solution** | 두 페이지의 prompt() 4건을 인라인 디자인 시스템 모달로 교체 |
| **Function/UX Effect** | 브라우저 팝업 차단 걱정 없음 · 키보드 접근성(Enter/Escape) · 다크모드 완전 지원 |
| **Core Value** | "모든 native 다이얼로그 0건" PRD KR-3 완전 달성 |

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | PRD KR-3: UI 에러/불편 신고 0건 목표 — workspace + dashboard 페이지 prompt() 잔존이 마지막 장애물 |
| **WHO** | 일반 사용자 (대시보드 위젯 추가), 대시보드 소유자 (이름 편집) |
| **RISK** | workspace 위젯 추가 흐름 복잡 (2단계: 대시보드 선택 → 위젯명 입력) |
| **SUCCESS** | 앱 전체 prompt() 0건 · TypeScript 오류 없음 · 두 모달 autoFocus + Enter/Escape 지원 |
| **SCOPE** | workspace/page.tsx (2건) + dashboards/[id]/page.tsx (2건) |

## Requirements

| # | Requirement | Priority |
|---|-------------|----------|
| R-01 | workspace 위젯 추가: 대시보드 선택 + 위젯명 입력 인라인 모달 | Must |
| R-02 | dashboards/[id] 이름 편집: 이름 + 설명 인라인 모달 | Must |
| R-03 | autoFocus, Enter 제출, Escape 닫기 | Must |
| R-04 | DS 토큰 사용 (var(--ds-*)) | Must |

## Success Criteria

| Criterion | Metric |
|-----------|--------|
| SC-01 | app 내 prompt() 0건 |
| SC-02 | TypeScript --noEmit 오류 0건 |
| SC-03 | 모든 모달 autoFocus + Enter/Escape 지원 |
