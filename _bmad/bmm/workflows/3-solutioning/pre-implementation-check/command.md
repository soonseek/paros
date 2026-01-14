---
description: Pre-Implementation Check - 실행 가능한지 3-layer 검증으로 확인
parameters:
  - name: story_id
    description: 검증할 스토리 ID (예: 8-1, 2-2)
    required: true
    type: string
---

# Pre-Implementation Check

**Story ID**: `{{ story_id }}`

사용자가 지정한 스토리가 실제로 구현 가능한지 3-layer 검증을 수행합니다.

## 검증 레이어

### Layer 1: 문서 로직 검증
- FR(Ffunctional Requirements) 커버리지 확인
- 의존성 매핑 검증
- Acceptance Criteria 완결성 확인

### Layer 2: 구현 상태 검증
- DB 스키마 (테이블, 컬럼 존재 여부)
- API 엔드포인트 (존재 여부, 응답 확인)
- 코드 아티팩트 (필요한 파일, 함수, 클래스)
- 프로젝트 특정 검증 (Web3, 블록체인 노드, 지갑 연결)

### Layer 3: 의존성 그래프 검증
- 순환 의존성 감지
- 의존성 깊이 분석
- 팬-아웃(fan-out) 확인

## 실행 방법

```bash
/bmad:bmm:workflows:pre-implementation-check 8-1
```

## 에러 처리

**Story ID가 지정되지 않은 경우:**
```
❌ Error: Story ID is required.

Usage: /bmad:bmm:workflows:pre-implementation-check <story_id>

Example: /bmad:bmm:workflows:pre-implementation-check 8-1
```

## 검증 결과

검증이 완료되면 `_bmad-output/check-reports/{{ story_id }}-pre-implementation-check.md` 리포트가 생성됩니다.

### 가능한 결과
- **PASS**: 모든 레이어 검증 통과 → 즉시 개발 가능
- **GAPS FOUND**: 누락된 기능 발견 → 보완 스토리(8-1-n) 자동 생성 제안
- **FAIL**: 치명적인 문제 발견 → 상위 Story 재검토 필요

## Gap-Filler 스토리 자동 생성

누락된 기능이 발견되면 다음 형식으로 보완 스토리를 생성합니다:

```
{{ parent_story }}-n (예: 8-1-1, 8-1-2)
```

### Gap Story 유형
- **Web3 Authentication**: JWT, 지갑 연결, 관리자 권한
- **Database Schema**: 테이블, 컬럼, 인덱스
- **API Endpoints**: 누락된 엔드포인트
- **Default**: 기타 누락 기능

## 참고 파일

- **Custom Rules**: `.bmad/custom-check-rules.yaml`
- **Story Templates**: `.bmad/templates/*-gap-story.md`
- **Check Scripts**: `.bmad/check-scripts/*.sh`
