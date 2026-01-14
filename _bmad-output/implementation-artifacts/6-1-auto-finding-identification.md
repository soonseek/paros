# Story 6.1: 자동 발견사항 식별 (Auto Finding Identification)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **시스템**,
I want **파산 사건과 관련된 중요 발견사항을 자동 식별**,
So that **사용자가 중요한 이슈를 놓치지 않고 선의성/악의성 판단, 우선변제권 침해, 담보권 문제를 조기에 발견할 수 있다**.

## Acceptance Criteria

**AC1: 선의성/악의성 판단 관련 발견사항 자동 식별**
- **Given** AI가 거래를 분석했을 때
- **When** 다음 패턴이 감지되면
  - 대출 실행(입금) 후 30일 이내 담보제공(출금)이 발생
  - 대출 금액과 유사한 금액이 담보제공으로 지출됨 (±20% 허용 오차)
- **Then** Finding 테이블에 발견사항 레코드가 자동 생성된다
- **And** findingType은 "PREFERENCE_REPAYMENT" (우선변제)
- **And** severity는 "CRITICAL"으로 설정된다
- **And** description은 "악의성 의심: 대출 후 짧은 기간 내 담보제공" 메시지가 생성된다
- **And** relatedTransactionIds에 관련된 모든 거래 ID가 저장된다 (JSON 배열)
- **And** relatedCreditorNames에 관련 채권자명이 추출되어 저장된다

**AC2: 우선변제권 침해 가능성 발견사항 자동 식별**
- **Given** 우선변제권 채권자가 식별된 상태에서
- **When** 다음 패턴이 감지되면
  - 우선변제권 채권자(채권자명 포함)가 있음에도 불구하고
  - 다른 일반 채권자에게 먼저 변제가 발생
  - 날짜 순서: 일반 채권자 변제 → 우선변제권 채권자 변제
- **Then** Finding 테이블에 발견사항 레코드가 자동 생성된다
- **And** findingType은 "PRIORITY_REPAYMENT_VIOLATION" (우선변제권 침해)
- **And** severity는 "CRITICAL"으로 설정된다
- **And** description은 "우선변제권 침해 가능성: 일반 채권자에게 먼저 변제" 메시지가 생성된다

**AC3: 담보권 설정/변경/소멸 관련 발견사항 자동 식별**
- **Given** 거래의 transactionNature가 "COLLATERAL" (담보 관련)로 분류되었을 때
- **When** 다음 패턴이 감지되면
  - 담보권 설정: 담보 관련 거래가 대출 실행 이전에 발생
  - 담보권 변경: 동일한 담보물에 대해 중복된 담보권 설정 거래
  - 담보권 소멸: 담보 관련 거래 후 변제가 없는 담보권 해지
- **Then** Finding 테이블에 발견사항 레코드가 자동 생성된다
- **And** findingType은 "COLLATERAL_ISSUE" (담보권 문제)
- **And** severity는 패턴에 따라 "WARNING" 또는 "INFO"로 설정된다
  - 담보권 설정: WARNING ("의심스러운 담보권 설정 시점")
  - 담보권 변경: WARNING ("담보권 중복 설정")
  - 담보권 소멸: INFO ("담보권 소멸 확인 필요")

**AC4: Finding 생성 서비스 트리거**
- **Given** 사용자가 "발견사항 분석"을 시작하면
- **When** analyzeFindings 서비스가 호출되면
- **Then** 사건의 모든 거래를 분석하여 Finding 레코드를 생성한다
- **And** 중복 방지: 이미 생성된 Finding은 다시 생성하지 않는다 (caseId + findingType + relatedTransactionIds 조합)
- **And** 분석 완료 후 생성된 Finding 개수를 반환한다
- **And** 분석 시간은 30초 이내여야 한다 (NFR-002: AI 분류 기준)

**AC5: Finding 조회 및 필터링**
- **Given** 생성된 Finding이 존재할 때
- **When** 사용자가 Finding 목록을 조회하면
- **Then** severity별로 정렬되어 표시된다 (CRITICAL → WARNING → INFO)
- **And** 사용자는 severity별로 필터링할 수 있다
- **And** 사용자는 findingType별로 필터링할 수 있다
- **And** 각 Finding에는 관련 거래 ID, 채권자명, 설명이 포함된다

## Requirements
- FR-038: 자동 발견사항 식별
- FR-039: 선의성/악의성 판단 관련 거래 감지
- FR-040: 우선변제권 침해 가능성 표시
- FR-041: 담보권 설정/변경/소멸 관련 거래 감지
- NFR-002: 1,000건 60초 이내 AI 분석 (Epic 4에서 이미 구현됨, 본 Story는 Finding 생성만 담당)

## Tasks / Subtasks

### Task 1: Finding 생성 서비스 구현 (AC: 1, 2, 3, 4)
- [ ] Subtask 1.1: `src/server/services/finding-service.ts` 생성
  - [ ] `analyzeFindings()` 함수 구현
    - [ ] 입력: caseId, userId
    - [ ] 사건의 모든 거래 조회 (Transaction)
    - [ ] TransactionNature 기반 분류 (Epic 4에서 이미 구현됨 활용)
    - [ ] TransactionChain 기반 체인 분석 (Epic 5에서 이미 구현됨 활용)
  - [ ] `detectPreferenceRepayment()` 함수 (AC1)
    - [ ] 대출 실행 후 30일 이내 담보제공 패턴 감지
    - [ ] 금액 유사성 검증 (±20% 허용 오차)
    - [ ] Finding 레코드 생성 (CRITICAL severity)
  - [ ] `detectPriorityRepaymentViolation()` 함수 (AC2)
    - [ ] 우선변제권 채권자 식별 (transactionNature === "PRIORITY_REPAYMENT")
    - [ ] 일반 채권자 변제 후 우선변제권 변제 순서 감지
    - [ ] Finding 레코드 생성 (CRITICAL severity)
  - [ ] `detectCollateralIssues()` 함수 (AC3)
    - [ ] 담보권 설정 시점 분석 (대출 실행 전 담보제공)
    - [ ] 담보권 변경 감지 (동일 담보물 중복 설정)
    - [ ] 담보권 소멸 확인 (담보권 해지 후 변제 확인)
    - [ ] Finding 레코드 생성 (WARNING/INFO severity)
  - [ ] `deduplicateFindings()` 함수 (AC4)
    - [ ] 중복 Finding 방지 로직
    - [ ] caseId + findingType + relatedTransactionIds 조합 검사
    - [ ] 기존 Finding이 존재하면 생성 스킵

### Task 2: Finding tRPC 라우터 구현 (AC: 4, 5)
- [ ] Subtask 2.1: `src/server/api/routers/finding.ts` 생성
  - [ ] `analyzeFindings` 프로시저 구현
    - [ ] 입력 검증 (caseId)
    - [ ] RBAC 검증 (attorneyProcedure)
    - [ ] `analyzeFindings()` 서비스 호출
    - [ ] 생성된 Finding 개수 반환
    - [ ] 성능 모니터링 (30초 경고 로그)
  - [ ] `getFindings` 프로시저 구현
    - [ ] caseId로 필터링된 Finding 목록 반환
    - [ ] severity별 정렬 (CRITICAL → WARNING → INFO)
    - [ ] severity 필터링 지원
    - [ ] findingType 필터링 지원
    - [ ] 관련 거래 정보 포함 (include: transaction, case)
  - [ ] 에러 처리
    - [ ] 사건 미발견: NOT_FOUND
    - [ ] 권한 없음: FORBIDDEN

### Task 3: 프론트엔드 Finding 분석 트리거 UI 구현 (AC: 4)
- [ ] Subtask 3.1: CaseDetail 페이지에 "발견사항 분석" 버튼 추가
  - [ ] 버튼 렌더링 (CaseDetail 컴포넌트)
  - [ ] 버튼 클릭 핸들러 연결
  - [ ] 분석 진행률 표시 (ProgressBar)
- [ ] Subtask 3.2: Finding 분석 결과 피드백
  - [ ] 성공 시: "X개의 발견사항이 생성되었습니다" 메시지
  - [ ] 실패 시: 에러 메시지 표시
  - [ ] toast로 사용자 알림

### Task 4: Finding 목록 및 필터링 UI 구현 (AC: 5)
- [ ] Subtask 4.1: FindingCard 컴포넌트 생성 (`src/components/molecules/finding-card.tsx`)
  - [ ] severity별 색상 코딩 (CRITICAL: red-600, WARNING: amber-600, INFO: orange-600)
  - [ ] findingType 아이콘 표시
  - [ ] description 렌더링
  - [ ] relatedTransactionIds 표시
  - [ ] relatedCreditorNames 표시
  - [ ] 클릭 시 상세 모달 표시
- [ ] Subtask 4.2: FindingList 컴포넌트 생성 (`src/components/molecules/finding-list.tsx`)
  - [ ] severity별로 정렬된 목록 렌더링
  - [ ] severity 필터 드롭다운 (CRITICAL, WARNING, INFO, All)
  - [ ] findingType 필터 드롭다운
  - [ ] FindingCard 컴포넌트 렌더링
- [ ] Subtask 4.3: React Query 훅
  - [ ] `api.finding.getFindings.useQuery()` 사용
  - [ ] 로딩/에러 상태 관리
  - [ ] refetchOnMount 옵션 (분석 완료 후 자동 갱신)

### Task 5: 테스트 작성 (모든 AC)
- [ ] Subtask 5.1: 단위 테스트
  - [ ] `detectPreferenceRepayment()` 함수 테스트
    - [ ] 대출 실행 후 30일 이내 담보제공 패턴 검증
    - [ ] 금액 유사성 검증 (±20%)
  - [ ] `detectPriorityRepaymentViolation()` 함수 테스트
    - [ ] 우선변제권 채권자 식별
    - [ ] 변제 순서 감지
  - [ ] `detectCollateralIssues()` 함수 테스트
    - [ ] 담보권 설정 시점 분석
    - [ ] 담보권 변경 감지
    - [ ] 담보권 소멸 확인
  - [ ] `deduplicateFindings()` 함수 테스트
    - [ ] 중복 Finding 방지 검증
- [ ] Subtask 5.2: 통합 테스트
  - [ ] tRPC 라우터 E2E 테스트 (analyzeFindings, getFindings)
  - [ ] RBAC 검증 테스트
  - [ ] Finding 생성 + 조회 통합 테스트
  - [ ] 성능 테스트 (30초 이내 확인)
- [ ] Subtask 5.3: 컴포넌트 테스트
  - [ ] FindingCard 렌더링 테스트
  - [ ] severity별 색상 테스트
  - [ ] FindingList 필터링 테스트
  - [ ] 에러 메시지 테스트

### Task 6: 성능 최적화 (AC: 4)
- [ ] Subtask 6.1: 쿼리 최적화
  - [ ] Prisma findMany에 select 최적화
  - [ ] 인덱스 활용 (transactionDate, depositAmount, transactionNature)
  - [ ] TransactionNature 미포함 거래 필터링
- [ ] Subtask 6.2: 병렬 처리
  - [ ] Promise.all로 3가지 감지 함수 병렬 실행
  - [ ] Finding.createMany로 일괄 생성

## Dev Notes

### Epic 6 준비 작업 완료 상태

Epic 5 retrospective 후 준비 작업이 완료되어 다음 파일들이 생성되었습니다:

1. **Prisma Schema** ✅
   - `Finding` 모델 (relatedTransactionIds, relatedCreditorNames 필드 포함)
   - `FindingNote` 모델 (Story 6.3에서 활용)
   - CASCADE DELETE 설정 완료
   - `prisma db push` 완료

2. **Epic 4 & 5 기반 자산 활용** ✅
   - TransactionNature enum (CREDITOR, COLLATERAL, PRIORITY_REPAYMENT, GENERAL)
   - creditorName, collateralType 필드
   - TransactionChain 모델 (path, chainType, confidenceScore)
   - 중요 거래 자동 식별 (Story 4.3)

3. **tRPC 라우터 구조** ✅
   - Epic 4에서 구현된 RBAC 헬퍼 함수 활용 가능
   - Epic 5의 fundFlow, transactionChain 라우터 패턴 재사용

### 기술 스택 및 제약사항

**백엔드:**
- **tRPC v11**: 타입 안전한 API 통신
- **Prisma 7.2.0+**: ORM, PostgreSQL
- **Node.js**: 서버 사이드 로직

**프론트엔드:**
- **Next.js 14+**: App Router, Server Components
- **React Query**: 서버 상태 관리
- **shadcn/ui**: UI 컴포넌트
- **TanStack Table v8**: 가상화 스크롤

**알고리즘:**
- **패턴 매칭**: 거래 유형, 날짜, 금액 기반
- **순서 분석**: 날짜 기반 정렬 및 순서 감지

**성능 요구사항:**
- **NFR-002**: 1,000건 60초 이내 (AI 분류, 본 Story는 Finding 생성만 담당)
- **분석 시간**: 30초 이내 (Finding 생성)

### Project Structure Notes

**디렉토리 구조:**
```
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       └── finding.ts               # ⚠️ 생성 필요
│   └── services/
│       └── finding-service.ts          # ⚠️ 생성 필요
├── components/
│   └── molecules/
│       ├── finding-card.tsx            # ⚠️ 생성 필요
│       └── finding-list.tsx            # ⚠️ 생성 필요
```

**파일 위치 규칙:**
- tRPC 라우터: `src/server/api/routers/{domain}.ts`
- 서비스 로직: `src/server/services/{service}.ts`
- 컴포넌트: Atomic Design 패턴 (atoms/molecules/organisms)

### Epic 4 & 5에서 학습한 패턴 적용

**1. RBAC 헬퍼 함수 사용**
```typescript
// src/server/lib/rbac.ts (Epic 4에서 생성)
import { assertTransactionAccess } from "~/server/lib/rbac";

// tRPC 프로시저에서
await assertTransactionAccess(ctx, caseId, "read");
```

**2. 감사 로그 서비스**
```typescript
// src/server/audit/finding-audit.ts (신규 생성 필요)
export async function logFindingAnalysis(params: {
  caseId: string;
  userId: string;
  findingsCreated: number;
  analysisDuration: number;
}) {
  await ctx.db.auditLog.create({
    data: {
      entityType: "FINDING_ANALYSIS",
      action: "AUTO_IDENTIFY",
      entityId: params.caseId,
      userId: params.userId,
      changes: JSON.stringify({
        findingsCreated: params.findingsCreated,
        analysisDuration: params.analysisDuration,
      }),
    },
  });
}
```

**3. 에러 처리 일관성**
```typescript
// TRPCError만 사용
import { TRPCError } from "@trpc/server";

throw new TRPCError({
  code: "NOT_FOUND",
  message: "사건을 찾을 수 없습니다.",
});
```

**4. 낙관적 잠금 (Optimistic Locking)**
- Finding 모델의 `version` 필드 활용
- 동시성 제어 (분석 중 Finding 수정 방지)

**5. CASCADE DELETE 마스터 (Epic 5 Retrospective Action Item)**
```prisma
// Finding 모델에 onDelete: Cascade 적용됨
model Finding {
  notes             FindingNote[] @relation("FindingNotes", onDelete: Cascade)
}
```

### 구현 시 주의사항

**성능 최적화:**
1. **데이터베이스 쿼리 최적화**
   - 인덱스 활용: `transactionDate`, `transactionNature`, `depositAmount`
   - select로 필요한 필드만 조회
   - where 조건으로 필터링 (transactionNature != null)

2. **병렬 처리**
   - Promise.all로 3가지 감지 함수 볼렬 실행
   - Finding.createMany로 일괄 생성

3. **프론트엔드 최적화**
   - React Query로 결과 캐싱
   - 가상화 스크롤로 대량 데이터 렌더링
   - 로딩 상태 표시로 UX 개선

**보안:**
- RBAC: case 접근 권한 검증
- 감사 로그: 모든 분석 기록
- 데이터 마스킹: 민감 정보 처리

**테스트:**
- 단위 테스트: 패턴 매칭 검증
- 통합 테스트: E2E 흐름 검증
- 성능 테스트: 30초 이내 확인

### References

**아키텍처:**
- [Architecture: Database Schema](../planning-artifacts/architecture.md#database-architecture) - Prisma 스키마 설계
- [Architecture: API Patterns](../planning-artifacts/architecture.md#api--communication-patterns) - tRPC 라우터 구조
- [Architecture: Performance](../planning-artifacts/architecture.md#non-functional-requirements) - NFR-002 (60초 이내)

**요구사항:**
- [Epic 6: 발견 사항 관리](../planning-artifacts/epics.md#epic-6-발견-사항-관리) - Epic 6 전체 개요
- [Story 6.1: 자동 발견사항 식별](../planning-artifacts/epics.md#story-61-자동-발견사항-식별) - 상세 AC

**Epic 4 & 5 Retrospective:**
- [Epic 4 Retrospective](epic-4-retrospective-2026-01-11.md) - RBAC, 감사 로그, 낙관적 잠금 패턴
- [Epic 5 Retrospective](epic-5-retro-2026-01-13.md) - CASCADE DELETE, TypeScript Strict Mode, 에러 처리
- [Story 4.3: Important Transaction Auto Detection](4-3-important-transaction-auto-detection.md) - 중요 거래 자동 식별
- [Story 4.4: Transaction Nature Judgment](4-4-transaction-nature-judgment.md) - 거래 성격 판단
- [Story 5.3: Transaction Chain Identification](5-3-transaction-chain-identification.md) - 체인 식별

**준비 완료 파일:**
- [Prisma Schema](../../prisma/schema.prisma) - Finding, FindingNote 모델
- [Finding Service - 신규 생성] (src/server/services/finding-service.ts) - Finding 생성 서비스
- [Finding Router - 신규 생성] (src/server/api/routers/finding.ts) - tRPC 라우터

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

Epic 5 Retrospective 완료 로그:
1. Finding/FindingNote 모델 Prisma 스키마 추가 완료 (2026-01-13)
2. CASCADE DELETE 설정 완료 (2026-01-13)
3. Epic 4에서 TransactionNature, 중요 거래 식별 구현 완료
4. Epic 5에서 TransactionChain, BFS 추적 구현 완료

### Completion Notes List

**Epic 5에서 Epic 6로 넘어가는 핵심 자산:**
1. ✅ TransactionNature enum (CREDITOR, COLLATERAL, PRIORITY_REPAYMENT, GENERAL)
2. ✅ TransactionChain 모델 (path, chainType, confidenceScore)
3. ✅ 중요 거래 자동 식별 (Story 4.3)
4. ✅ Finding/FindingNote Prisma 모델 (Epic 6 준비 작업 완료)
5. ✅ RBAC 헬퍼 함수 (Epic 4)
6. ✅ CASCADE DELETE 패턴 (Epic 5 Action Item)

**생성 필요한 파일:**
1. `src/server/services/finding-service.ts` - Finding 생성 서비스
2. `src/server/api/routers/finding.ts` - tRPC 라우터
3. `src/server/audit/finding-audit.ts` - 감사 로그 서비스
4. `src/components/molecules/finding-card.tsx` - Finding 카드 컴포넌트
5. `src/components/molecules/finding-list.tsx` - Finding 목록 컴포넌트
6. `src/server/services/finding-service.test.ts` - 단위 테스트
7. `src/server/api/routers/finding.test.ts` - 통합 테스트

### File List

**이미 생성된 파일 (Epic 4, 5, Epic 6 준비 작업):**
1. `prisma/schema.prisma` - Finding, FindingNote 모델 추가 완료
2. `src/server/lib/rbac.ts` - RBAC 헬퍼 함수 (Epic 4)
3. `src/server/services/transaction-chain-service.ts` - 체인 식별 서비스 (Epic 5)
4. `src/server/api/routers/transactionChain.ts` - 체인 tRPC 라우터 (Epic 5)

**수정 필요한 파일:**
1. `src/server/api/root.ts` - finding 라우터 등록
2. `src/app/(dashboard)/cases/[id]/page.tsx` - "발견사항 분석" 버튼 추가
