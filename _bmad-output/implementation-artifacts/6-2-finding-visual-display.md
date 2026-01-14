# Story 6.2: 발견사항 시각적 표시

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 사용자,
I want 발견사항이 색상 코딩으로 시각적으로 표시되어서,
So that 중요도를 빠르게 인지할 수 있다.

## Acceptance Criteria

1. **사건 분석 화면 레이아웃**: 사용자가 사건 분석 화면에 접근했을 때, 발견사항이 존재하면 Split View 레이아웃의 왼쪽 40%에 FindingCard 목록이 표시된다
2. **Severity별 색상 코딩**: FindingCard가 표시될 때 severity에 따라 색상이 표시된다
   - 🔴 CRITICAL: red-50 배경색 + red-600 테두리
   - 🟡 WARNING: amber-50 배경색 + amber-600 테두리
   - 🟠 INFO: orange-50 배경색 + orange-600 테두리
3. **FindingCard 클릭 인터랙션**: 사용자가 특정 FindingCard를 클릭했을 때, 관련된 거래들이 TransactionTable에서 하이라이트되고 발견사항 상세 모달이 표시된다
4. **Severity별 정렬**: 발견사항이 많을 때 severity별로 그룹화되어 표시되면, CRITICAL이 가장 먼저 표시되고 그 다음 WARNING, INFO 순으로 표시된다

## Tasks / Subtasks

- [x] Task 1: 사건 상세 페이지 레이아웃 구현 (AC: #1)
  - [x] Subtask 1.1: Split View 레이아웃 적용 (왼쪽 40%: 발견사항, 오른쪽 60%: 거래 테이블)
  - [x] Subtask 1.2: FindingList 컴포넌트 통합 (필터링, 정렬 포함)
  - [x] Subtask 1.3: 반응형 디자인 (Desktop 1920px, 1366px; iPad 1024px, 768px)

- [x] Task 2: FindingCard 색상 코딩 구현 (AC: #2)
  - [x] Subtask 2.1: Severity별 색상 스타일 적용 (bg-red-50, bg-amber-50, bg-orange-50)
  - [x] Subtask 2.2: 테두리 및 텍스트 색상 적용 (border-red-600, text-red-600 등)
  - [x] Subtask 2.3: 해결된 Finding의 투명도 스타일 (opacity-60)

- [x] Task 3: FindingCard 클릭 인터랙션 (AC: #3)
  - [x] Subtask 3.1: FindingCard 클릭 핸들러 구현
  - [x] Subtask 3.2: 관련 거래 하이라이트 기능 (relatedTransactionIds 사용)
  - [x] Subtask 3.3: 발견사항 상세 모달 구현

- [x] Task 4: FindingList 필터링 및 정렬 (AC: #4)
  - [x] Subtask 4.1: FindingList에 severity별 정렬 로직 추가 (CRITICAL > WARNING > INFO)
  - [x] Subtask 4.2: FindingList에 findingType별 필터링 추가
  - [x] Subtask 4.3: 빈 상태 처리 및 필터 초기화 기능

## Dev Notes

### 핵심 요구사항

1. **UX Design 준수**: Epic 6 발견사항 관리의 핵심 UX 요구사항
   - 색상 체계: 🔴 red-600, 🟡 amber-600, 🟠 orange-600
   - Split View 구조: 왼쪽 40% 발견사항 + 필터, 오른쪽 60% 테이블
   - FindingCard 컴포넌트: severity별 배경색, 테두리, 투명도

2. **Finding 모델 (이미 구현됨 - Story 6.1)**
   - findingType: PREFERENCE_REPAYMENT, PRIORITY_REPAYMENT_VIOLATION, COLLATERAL_TIMING_ISSUE, COLLATERAL_DUPLICATE, COLLATERAL_DISCHARGE
   - severity: CRITICAL, WARNING, INFO
   - isResolved: 해결 여부
   - relatedTransactionIds: 관련 거래 ID 배열
   - relatedCreditorNames: 관련 채권자명 (JSON 배열)

3. **이미 구현된 컴포넌트 재사용**
   - `src/components/finding-card.tsx`: FindingCard 컴포넌트 (Story 4.3에서 구현)
   - `src/components/molecules/finding-list.tsx`: FindingList 컴포넌트 (Story 6.1에서 구현)

### 수정이 필요한 파일

1. **src/pages/cases/[id].tsx**: 사건 상세 페이지
   - FindingList 컴포넌트 통합
   - Split View 레이아웃 적용 (왼쪽: 발견사항, 오른쪽: 거래 테이블)

2. **src/components/finding-card.tsx**: FindingCard 컴포넌트
   - onClick 핸들러 추가 (관련 거래 하이라이트)
   - 상세 모달 표시 기능

3. **src/components/molecules/finding-list.tsx**: FindingList 컴포넌트
   - 이미 필터링 및 정렬이 구현되어 있음 (Story 6.1)

### 코드 패턴 (Story 6.1 참조)

```typescript
// FindingCard 색상 코딩 (이미 구현됨)
const severityStyles = {
  CRITICAL: "bg-red-50 border-red-600",
  WARNING: "bg-amber-50 border-amber-600",
  INFO: "bg-orange-50 border-orange-600",
};

// FindingList 정렬 (이미 구현됨)
const sortedFindings = [...findings].sort((a, b) => {
  // 1. 미해결 먼저
  if (a.isResolved !== b.isResolved) {
    return a.isResolved ? 1 : -1;
  }
  // 2. severity 순 (CRITICAL > WARNING > INFO)
  const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return severityOrder[a.severity] - severityOrder[b.severity];
});
```

### Project Structure Notes

- **컴포넌트 위치**: `src/components/` (atoms, molecules, organisms)
- **페이지 위치**: `src/pages/cases/[id].tsx`
- **스타일링**: Tailwind CSS + shadcn/ui
- **상태 관리**: React Query (서버 상태) + Zustand (클라이언트 상태)

### Technical Requirements

- **프레임워크**: Next.js 14+ (App Router), TypeScript
- **UI 라이브러리**: shadcn/ui (Radix UI 기반)
- **스타일링**: Tailwind CSS
- **API**: tRPC v11 (findings 라우터)
- **데이터베이스**: Prisma ORM 7.2.0 (Finding 모델)

### Testing Requirements

- **단위 테스트**: FindingCard, FindingList 컴포넌트 테스트
- **통합 테스트**: tRPC findings 라우터 테스트
- **E2E 테스트**: 발견사항 클릭 → 거래 하이라이트 흐름
- **테스트 커버리지**: 80% 이상 목표

### References

- [Source: epics.md#Epic 6] 발견 사항 관리 Epic
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] UX 디자인 명세
- [Source: _bmad-output/implementation-artifacts/6-1-auto-finding-identification.md] Story 6.1 (이전 스토리)
- [Source: src/components/finding-card.tsx] FindingCard 구현 (Story 4.3)
- [Source: src/components/molecules/finding-list.tsx] FindingList 구현 (Story 6.1)
- [Source: prisma/schema.prisma] Finding, FindingNote 모델

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A (스토리 생성 단계)

### Completion Notes List

- 2026-01-13: Story 6.2 생성 완료
- FindingCard 및 FindingList 컴포넌트가 Story 4.3, 6.1에서 이미 구현됨
- 주요 작업: 사건 상세 페이지에 FindingList 통합, 클릭 인터랙션 추가
- 2026-01-13: Story 6.2 구현 완료
  - Task 1: Split View 레이아웃 구현 (grid-cols-5: 왼쪽 40%, 오른쪽 60%)
  - Task 2: FindingCard 색상 코딩 AC 요구사항 준수 (red-600, amber-600, orange-600)
  - Task 3: FindingCard 클릭 인터랙션 구현 (onClick 핸들러, 상세 모달)
  - Task 4: FindingList 필터링 및 정렬 확인 (이미 구현됨)

### File List

**생성/수정 파일:**
1. `src/pages/cases/[id].tsx` - FindingList 통합, Split View 레이아웃, Finding 클릭 핸들러, 상세 모달
2. `src/components/finding-card.tsx` - onClick prop 추가, 클릭 이벤트 핸들러, 커서 스타일, 이벤트 전파 방지
3. `src/components/molecules/finding-list.tsx` - onFindingClick prop 추가, TypeScript null 체크 수정

**참고 파일 (읽기 전용):**
- `src/components/molecules/finding-list.tsx` - 이미 구현됨 (Story 6.1)
- `src/server/api/routers/findings.ts` - tRPC 라우터 (Story 6.1)
- `src/server/services/finding-service.ts` - Finding 서비스 (Story 6.1)
- `prisma/schema.prisma` - Finding 모델 (Epic 5 retrospective에서 추가)
