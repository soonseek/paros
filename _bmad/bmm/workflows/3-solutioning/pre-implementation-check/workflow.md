---
name: 'pre-implementation-check'
description: 'Story가 실제로 구현 가능한지 Layer1(문서) + Layer2(구현상태) + Layer3(의존성그래프)로 검증하고, 부족한 부분을 보완 Stories로 자동 생성'
web_bundle: false
---

# Pre-Implementation Check Workflow

**Goal:** Story가 개발 가능한지 사전에 검증하고, 부족한 의존성을 보완 Stories로 자동 생성하여 개발 중단을 방지

## 사용 시점

- Story가 **ready-for-dev** → **in-progress**로 변경되기 전
- 사용자가 수동으로 실행: `/bmad:bmm:workflows:pre-implementation-check`
- Story 상태가 **check**일 때 실행

## 출력물

1. **검증 리포트**: `_bmad-output/check-reports/{story_id}-pre-implementation-check.md`
2. **보완 Stories**: `_bmad-output/implementation-artifacts/{story_id}-n-*.md`
3. **업데이트된 sprint-status.yaml**

## 3겹 검증 레이어

### Layer 1: 문서 논리 검증 (Document Logic Check)
- FR 커버리지 확인
- 의존성 매핑 (어떤 Story에서 구현되었는지)
- 누락된 기능 식별

### Layer 2: 실제 구현 상태 검증 (Implementation State Check)
- DB 스키마 확인 (테이블, 컬럼)
- API 엔드포인트 확인
- 코드 구현 확인 (함수, 클래스)
- 환경 설정 확인

### Layer 3: 의존성 그래프 분석 (Dependency Graph Analysis)
- 순환 의존성 탐지
- 의존성 깊이 분석 (depth > 3은 경고)
- Fan-out 분석 (하나가 너무 많은 것에 의존하는지)

## Gap 처리 전략

### 1. 누락된 기능 (Missing)
- 새로운 Gap-Filler Story 자동 생성 (8-1-n 형태)
- 타입별 템플릿 사용 (Web3, Database, API)

### 2. 구현되지 않은 기능 (Not Done)
- 선행 Story를 먼저 완료하도록 권장
- 의존성 명시

### 3. 순환 의존성 (Circular)
- 공통 추상화 추천 (인터페이스 Story)
- Story 분리 권장

## Story 상태 전이

```
ready-for-dev
    ↓
check              ← Pre-Implementation Check 실행
    ↓
    ├→ PASS & No Gaps → check-passed
    │
    └→ FAIL or Gaps Found → Gap Stories 생성 → check-passed

check-passed
    ↓ (모든 보완 Stories done 후)
in-progress
```

## 사용자 커스터마이징

프로젝트 루트의 `.bmad/custom-check-rules.yaml`로 검증 항목을 커스터마이징할 수 있습니다.

## 자동화된 기능

1. **의존성 자동 추출**: Acceptance Criteria에서 필요한 의존성을 자동으로 찾음
2. **Gap 자동 분석**: Layer 1 + Layer 2 + Layer 3 결과를 종합하여 Gap 분석
3. **Story 자동 생성**: Gap을 해소하는 보완 Story를 템플릿에서 자동 생성
4. **Sprint 상태 자동 업데이트**: 생성된 Stories를 sprint-status.yaml에 자동 추가
