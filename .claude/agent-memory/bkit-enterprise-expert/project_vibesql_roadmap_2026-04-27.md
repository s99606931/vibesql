---
name: VibeSQL UX/Admin Roadmap (2026-04-27 CTO Review)
description: 18개 항목(USER 10 + ADMIN 8) 3-Tier 분류 결정 — Tier 1 보안 4건, Tier 2 Easy 12건, Tier 3 설계 2건
type: project
---

2026-04-27 CTO 리뷰에서 USER/ADMIN 페르소나 18개 항목을 3-Tier로 분류 결정.

**Why:** PDCA Check 98% 단계의 vibeSQL이 보안 Critical 3건(self-delete, audit log 권한, 전체 오류 가시성)을 안고 있어 즉시 처리 필요. 나머지 Easy 항목은 공통 모달 1개 만들고 일괄 처리하면 회귀 리스크 최소화.

**How to apply:**
- Tier 1 (즉시, 195분): U2(FAILURE/ERROR 버그), A1(self-delete 가드), A2(audit log ADMIN 권한), A3(ADMIN 오류 이력 엔드포인트)
- Tier 2 (이번 스프린트, 540분): U1/U10/A5는 공통 ConfirmModal/PromptModal 만든 뒤 재사용. A7은 A2 선행 의존.
- Tier 3 (다음 스프린트, 270분): A8(AI 컨텍스트 export/import)는 설계 문서 `docs/01-development/ai-context-portability.md` 선행 필수, U10은 Tier 2 공통 모달 사용.
- 총 17시간, 2일 작업량. 인프라 비용 변화 없음.
- 검증 grep: `grep -r "window\.\(prompt\|confirm\|alert\)\|\balert(" apps/web/` 결과 0건이 U1 완료 기준.
