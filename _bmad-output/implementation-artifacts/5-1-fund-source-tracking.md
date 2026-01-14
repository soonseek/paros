# Story 5.1: 자금 출처 추적 (Fund Source Tracking)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **변호사 또는 법무사**,
I want **특정 입금 거래의 자금 출처를 거슬러 올라가서 최대 5단계까지 추적**,
So that **자금이 어디서 유입되었는지 파악하고 자금 흐름을 명확히 이해할 수 있다**.

## Acceptance Criteria

**AC1: 추적 시작**
- **Given** 사용자가 TransactionTable에서 특정 입금 거래를 선택했을 때
- **When** "자금 출처 추적" 버튼을 클릭하면
- **Then** 해당 금액과 일치하거나 유사한 출금 거래들을 검색한다
- **And** 검색 조건: 금액이 ±10% 이내, 날짜가 추적 대상 거래 이전

**AC2: 추적 결과 표시**
- **Given** 자금 출처가 식별되었을 때
- **When** 추적 결과가 표시되면
- **Then** 연관된 출금 거래들이 목록으로 표시된다
- **And** 각 거래에는 연관 강도(금액 일치도, 날짜 근접도)가 표시된다

**AC3: 다단계 추적**
- **Given** 다단계 추적이 필요할 때
- **When** "계속 추적" 버튼을 클릭하면
- **Then** 식별된 출금 거래의 출처를 다시 추적한다
- **And** 최대 5단계까지 거슬러 올라간다

**AC4: 추적 실패 처리**
- **Given** 추적 결과가 없을 때
- **When** 검색이 완료되면
- **Then** "자금 출처를 찾을 수 없습니다" 메시지가 표시된다

**AC5: 성능 요구사항**
- **Given** 추적 요청이 있을 때
- **When** 추적 알고리즘이 실행되면
- **Then** 3초 이내에 응답을 반환한다 (NFR-003)

## Requirements
- FR-032: 자금 출처 추적
- NFR-003: 3초 이내 응답

## Tasks / Subtasks

### Task 1: tRPC 라우터 구현 (AC1, AC5)
- [ ] Subtask 1.1: `src/server/api/routers/fundFlow.ts` 생성 ✅ (이미 완료됨)
  - [ ] `traceUpstream` 프로시저 구현
    - [ ] 입력 검증 (transactionId, caseId, maxDepth, amountTolerance)
    - [ ] RBAC 검증 (attorneyProcedure 사용)
    - [ ] 시작 거래 조회 (입금 거래 확인)
    - [ ] `traceUpstreamFunds()` 서비스 호출
    - [ ] 성능 모니터링 (3초 경고 로그)
  - [ ] Subtask 1.2: 에러 처리
    - [ ] 사건/거래 미발견: NOT_FOUND
    - [ ] 권한 없음: FORBIDDEN
    - [ ] 입금 거래 아님: BAD_REQUEST

### Task 2: 자금 출처 추적 서비스 구현 (AC1, AC2, AC3, AC5)
- [ ] Subtask 2.1: `src/server/services/fund-flow-service.ts` 생성 ✅ (이미 완료됨)
  - [ ] `traceUpstreamFunds()` 함수 구현 (BFS 알고리즘)
    - [ ] 큐(Queue) 기반 BFS 구현
    - [ ] 사이클 방지 (visited Set)
    - [ ] 깊이 제한 (최대 5단계)
    - [ ] 금액 매칭 (±10% 허용 오차)
    - [ ] 날짜 필터링 (현재 거래 이전)
    - [ ] 신뢰도 계산 (금액 일치 70% + 날짜 근접 30%)
  - [ ] Subtask 2.2: TransactionRelation 자동 생성
    - [ ] 추적된 연결 관계 저장
    - [ ] upsert로 중복 방지
    - [ ] 관계 유형 (PROBABLE_TRANSFER)
    - [ ] 연결 사유 및 신뢰도 저장

### Task 3: 프론트엔드 컴포넌트 구현 (AC1, AC2, AC4)
- [ ] Subtask 3.1: TransactionTable에 추적 버튼 추가
  - [ ] "자금 출처 추적" 버튼 렌더링 (입금 거래만)
  - [ ] 버튼 클릭 핸들러 연결
- [ ] Subtask 3.2: 추적 결과 표시 컴포넌트
  - [ ] `FundSourceTraceResult` 컴포넌트 생성
  - [ ] 추적 체인 목록 렌더링
  - [ ] 각 거래의 연관 강도 표시 (Badge)
  - [ ] "계속 추적" 버튼 (depth < 5)
  - [ ] "자금 출처를 찾을 수 없습니다" 메시지
- [ ] Subtask 3.3: React Query 훅
  - [ ] `api.fundFlow.traceUpstream.useMutation()` 사용
  - [ ] 로딩/에러 상태 관리
  - [ ] 성공 시 결과 표시

### Task 4: 프론트엔드 상태 관리 (AC3)
- [ ] Subtask 4.1: 추적 상태 관리
  - [ ] 현재 추적 깊이 추적
  - [ ] 추적 결과 캐싱
  - [ ] "계속 추적" 시 재귀적 추적

### Task 5: 테스트 작성 (모든 AC)
- [ ] Subtask 5.1: 단위 테스트
  - [ ] `isAmountMatch()` 함수 테스트
  - [ ] `calculateConfidence()` 함수 테스트
  - [ ] `traceUpstreamFunds()` 함수 테스트 (Mock DB)
  - [ ] RBAC 검증 테스트
- [ ] Subtask 5.2: 통합 테스트
  - [ ] tRPC 라우터 E2E 테스트
  - [ ] 추적 서비스 + DB 통합 테스트
  - [ ] 성능 테스트 (3초 이내 확인)
- [ ] Subtask 5.3: 컴포넌트 테스트
  - [ ] 버튼 렌더링 테스트
  - [ ] 추적 결과 표시 테스트
  - [ ] 에러 메시지 테스트

### Task 6: 성능 최적화 (AC5)
- [ ] Subtask 6.1: 쿼리 최적화
  - [ ] Prisma findMany에 select 최적화
  - [ ] 인덱스 활용 (transactionDate, depositAmount)
  - [ ] take: 10으로 결과 제한
- [ ] Subtask 6.2: N+1 쿼리 방지
  - [ ] 필요한 경우 include로 관계 로드
  - [ ] Promise.all로 병렬 쿼리 고려

## Dev Notes

### Epic 5 준비 작업 완료 상태

이미 Epic 5 준비 작업이 완료되어 다음 파일들이 생성되었습니다:

1. **Prisma Schema** ✅
   - `TransactionRelation` 모델 (자금 흐름 관계)
   - `TransactionChain` 모델 (체인 저장)
   - `TransactionRelationType` enum
   - `prisma db push` 완료

2. **tRPC Router** ✅
   - `src/server/api/routers/fundFlow.ts`
   - `traceUpstream`, `traceDownstream`, `saveChain`, `getSavedChains` 프로시저
   - RBAC 검증 완료 (attorneyProcedure)

3. **서비스 레이어** ✅
   - `src/server/services/fund-flow-service.ts`
   - BFS 알고리즘 구현
   - 사이클 감지, 신뢰도 계산
   - TransactionRelation 자동 생성

4. **React Flow PoC** ✅
   - `src/react-flow-poc.tsx`
   - 그래프 시각화 기술 검증 완료

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
- **BFS (Breadth-First Search)**: 너비 우선 탐색
- **Graph Theory**: 사이클 감지, 깊이 제한

**성능 요구사항:**
- **NFR-003**: 3초 이내 응답
- **최대 깊이**: 5단계
- **금액 허용 오차**: ±10%

### Project Structure Notes

**디렉토리 구조:**
```
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       └── fundFlow.ts          # ✅ 이미 생성됨
│   └── services/
│       └── fund-flow-service.ts     # ✅ 이미 생성됨
├── components/
│   └── molecules/
│       └── FundSourceTraceResult.tsx # ⚠️ 생성 필요
└── react-flow-poc.tsx                # ✅ PoC 완료
```

**파일 위치 규칙:**
- tRPC 라우터: `src/server/api/routers/{domain}.ts`
- 서비스 로직: `src/server/services/{service}.ts`
- 컴포넌트: Atomic Design 패턴 (atoms/molecules/organisms)

### Epic 4에서 학습한 패턴 적용

**1. RBAC 헬퍼 함수 사용**
```typescript
// src/server/lib/rbac.ts (Epic 4에서 생성)
import { assertTransactionAccess } from "~/server/lib/rbac";

// tRPC 프로시저에서
await assertTransactionAccess(ctx, transactionId, "read");
```

**2. 감사 로그 서비스**
```typescript
// src/server/audit/fund-flow-audit.ts (신규 생성 필요)
export async function logFundFlowTrace(params: {
  caseId: string;
  userId: string;
  startTransactionId: string;
  maxDepth: number;
  resultsCount: number;
}) {
  await ctx.db.auditLog.create({
    data: {
      entityType: "FUND_FLOW_TRACE",
      action: "UPSTREAM_TRACE",
      entityId: params.startTransactionId,
      userId: params.userId,
      changes: JSON.stringify({
        maxDepth: params.maxDepth,
        resultsCount: params.resultsCount,
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
  message: "거래를 찾을 수 없습니다.",
});
```

**4. 낙관적 잠금 (Optimistic Locking)**
- Transaction 모델의 `version` 필드 활용
- 동시성 제어 (추적 중 거래 수정 방지)

### 구현 시 주의사항

**성능 최적화:**
1. **데이터베이스 쿼리 최적화**
   - 인덱스 활용: `transactionDate`, `depositAmount`, `withdrawalAmount`
   - select로 필요한 필드만 조회
   - take: 10으로 결과 제한

2. **BFS 최적화**
   - visited Set으로 중복 방문 방지
   - 큐(Queue)로 메모리 효율적 관리
   - 최대 깊이 제한으로 무한 루프 방지

3. **프론트엔드 최적화**
   - React Query로 결과 캐싱
   - 가상화 스크롤로 대량 데이터 렌더링
   - 로딩 상태 표시로 UX 개선

**보안:**
- RBAC: case 접근 권한 검증
- 감사 로그: 모든 추적 기록
- 데이터 마스킹: 민감 정보 처리

**테스트:**
- 단위 테스트: 알고리즘 검증
- 통합 테스트: E2E 흐름 검증
- 성능 테스트: 3초 이내 확인

### References

**아키텍처:**
- [Architecture: Database Schema](../planning-artifacts/architecture.md#database-architecture) - Prisma 스키마 설계
- [Architecture: API Patterns](../planning-artifacts/architecture.md#api--communication-patterns) - tRPC 라우터 구조
- [Architecture: Performance](../planning-artifacts/architecture.md#non-functional-requirements) - NFR-003 (3초 이내)

**요구사항:**
- [Epic 5: 자금 흐름 추적](../planning-artifacts/epics.md#epic-5-자금-흐름-추적) - Epic 5 전체 개요
- [Story 5.1: 자금 출처 추적](../planning-artifacts/epics.md#story-51-자금-출처-추적) - 상세 AC

**Epic 4 Retrospective:**
- [Epic 4 Retrospective](epic-4-retrospective-2026-01-11.md) - RBAC, 감사 로그, 낙관적 잠금 패턴
- [Story 4.8: Learning Feedback Loop](4-8-learning-feedback-loop.md) - 규칙 기반 분류 패턴

**준비 완료 파일:**
- [Prisma Schema](../../prisma/schema.prisma) - TransactionRelation, TransactionChain 모델
- [tRPC Router](../../src/server/api/routers/fundFlow.ts) - traceUpstream 프로시저
- [Service Layer](../../src/server/services/fund-flow-service.ts) - BFS 알고리즘
- [React Flow PoC](../../src/react-flow-poc.tsx) - 그래프 시각화 기술 검증

## Code Review Findings & Action Items

### Review Summary
- **Date**: 2026-01-11
- **Reviewer**: GitHub Copilot (Code Review Agent)
- **Status**: Ready for Code Review → Review Complete
- **Issues Found**: 7 HIGH/MEDIUM issues, 8 LOW/TEST issues
- **Test Status**: 14 unit tests defined, 3/14 implemented (21%)
- **Positive Findings**: 7 (RBAC, Type Safety, Schema Design, UI/UX)

### High Priority Issues (P1 - Block Deployment)

**[HIGH #1] BFS Algorithm - Missing Start Node in Chain Path**
- **Location**: `src/server/services/fund-flow-service.ts:167-170`
- **Severity**: HIGH
- **AC Violated**: AC1 "추적 시작" - User selected transaction must be in chain
- **Description**: BFS queue initialization doesn't include start transaction in `path` array. When AC1 flow traces TX-A (입금) → TX-B (출금), the returned chain is [TX-B] without TX-A.
- **Impact**: Frontend visualization shows incomplete fund flow chain (missing origin transaction)
- **Fix**: Include start node in initial queue path with depth=0, confidence=1.0, matchReason="시작 거래"
- **Effort**: 1h

**[HIGH #2] BFS Algorithm - Cycle Detection Timing Issue**
- **Location**: `src/server/services/fund-flow-service.ts:245-250`
- **Severity**: HIGH
- **AC Violated**: AC5 "성능 요구사항" (3초 이내) - N+1 query issue
- **Description**: Duplicate transaction prevention happens AFTER DB query. Same transaction can be added to queue multiple times from different BFS depths (e.g., TX-A → TX-B → TX-A → TX-C).
- **Impact**: Query count explosion (maxDepth=3 → 105+ queries), exceeds 3-second NFR-003
- **Fix**: Add `id: {notIn: Array.from(visited)}` to Prisma WHERE clause BEFORE query
- **Effort**: 0.5h

**[HIGH #3] Confidence Calculation - Negative Date Diff Issue**
- **Location**: `src/server/services/fund-flow-service.ts:236-240`
- **Severity**: HIGH
- **AC Violated**: AC2 "추적 결과 표시" - Confidence must be 0.0~1.0
- **Description**: Date difference calculation produces negative values when `withdrawal.transactionDate > currentTx.transactionDate`. This causes `dateScore = 1 - dateDiffDays/30` to exceed 1.0 (e.g., 1 - (-5/30) = 1.167).
- **Impact**: Confidence scores exceed valid range (0-1), breaking UI badge rendering
- **Fix**: Use `Math.abs()` or add date validation `if (withdrawal.transactionDate > currentTx.transactionDate) continue`
- **Effort**: 0.5h

### Medium Priority Issues (P2 - Recommend Pre-Deployment)

**[MEDIUM #1] N+1 Query Performance Problem**
- **Location**: `src/server/services/fund-flow-service.ts:169-275`
- **Severity**: MEDIUM
- **AC Violated**: AC5 성능 요구사항 (3초 이내)
- **Description**: BFS loop executes sequential DB queries in while loop. With maxDepth=3 and 5 matches per level:
  - findUnique calls: ~15
  - findMany calls: ~15
  - upsert calls: ~75
  - **Total: 105 DB queries** vs optimal ~10 queries
- **Impact**: Database round-trip latency accumulates to 3+ seconds
- **Fix**: Use Promise.all() for parallel queries; batch upsert operations
- **Effort**: 2h

**[MEDIUM #2] Input Validation - Type Enforcement Missing**
- **Location**: `src/server/api/routers/fundFlow.ts:36-40`
- **Severity**: MEDIUM
- **Description**: Zod schema allows `maxDepth: 3.7` (float) and `amountTolerance: -0.5` (negative). Should enforce integer and proper bounds.
- **Fix**: Add `.int()` to maxDepth; validate amountTolerance >= 0
- **Effort**: 0.5h

**[MEDIUM #3] Audit Logging Missing**
- **Location**: `src/server/api/routers/fundFlow.ts:48-80`
- **Severity**: MEDIUM
- **Pattern**: Story 4.8 Retrospective emphasized audit logging importance
- **Description**: No audit log created when fund flow trace executes. Who traced which transaction when?
- **Fix**: Call `logFundFlowTrace({userId, caseId, startTransactionId, maxDepth, resultsCount})`
- **Effort**: 1h

**[MEDIUM #4] Frontend Type Mismatch - Potential Runtime Issues**
- **Location**: `src/components/molecules/FundSourceTraceResult.tsx:52` vs `src/server/api/routers/fundFlow.ts:130`
- **Severity**: MEDIUM
- **Description**: Prisma returns `Decimal`, converted to `number` in router. Verify all numeric types (amount, totalAmount, responseTimeMs) are properly converted.
- **Fix**: Add explicit type assertions; test with large numbers (>2^53)
- **Effort**: 1h

**[MEDIUM #5] Transaction Validation - Weak Error Handling**
- **Location**: `src/server/services/fund-flow-service.ts:128-130`
- **Severity**: MEDIUM
- **AC Violated**: AC4 "추적 실패 처리" - Should distinguish error types
- **Description**: Returns empty result `{chains: [], totalTransactions: 0}` for invalid deposit transaction instead of throwing error. Frontend can't distinguish "no results" from "invalid input".
- **Fix**: Throw TRPCError with code="BAD_REQUEST", message="입금 거래만 추적 가능합니다"
- **Effort**: 0.5h

### Low Priority Issues (P3 - Post-Deployment Improvements)

**[LOW #1-1 through LOW #1-6] Test Implementation - 11 Test Skeletons**
- **Location**: `src/server/services/fund-flow-service.test.ts:1-500`
- **Severity**: LOW
- **Description**: 
  - ✅ 3 tests implemented: Basic input validation
  - ❌ 11 tests incomplete: Only skeleton `async () => {...}` with comments
  - Missing: AC3 "max 5 depth", amount matching, confidence calculation, cycle detection, downstream tracing, BFS validation
- **Coverage**: 3/14 tests = 21%
- **Fix**: Complete all test cases
- **Total Effort**: 11h (1-2h each)

**[LOW #2] Frontend Error Handler - tRPC Error Structure**
- **Location**: `src/components/transaction-table.tsx:716-730`
- **Severity**: LOW
- **Description**: Catch block doesn't handle tRPC error structure properly. Should check `error?.data?.code` for BAD_REQUEST distinction.
- **Fix**: Enhance error message with tRPC error code awareness
- **Effort**: 1h

### Positive Findings ✅

1. **RBAC Implementation**: `caseAccessProcedure` properly validates case access in router
2. **Type Safety**: TypeScript + Zod validation protects input integrity
3. **Database Schema**: TransactionRelation and TransactionChain models well-designed with proper indexes
4. **React Flow PoC**: Technology validation complete, ready for graph visualization
5. **UI Components**: ScrollArea, Badge, Dialog components properly integrated for AC2 display
6. **TransactionTable Integration**: Trace button correctly added with depositAmount check
7. **Error Handling Foundation**: TRPCError pattern established, implements AC4 error handling

### Summary Table

| Issue | Type | Severity | AC | Status | Effort |
|-------|------|----------|----|---------|---------| 
| BFS Start Node Missing | Algo | HIGH | AC1 | Pending | 1h |
| Cycle Detection Timing | Perf | HIGH | AC5 | Pending | 0.5h |
| Confidence Negative Diff | Logic | HIGH | AC2 | Pending | 0.5h |
| N+1 Query Problem | Perf | MEDIUM | AC5 | Pending | 2h |
| Input Validation | Input | MEDIUM | - | Pending | 0.5h |
| Audit Logging Missing | Security | MEDIUM | - | Pending | 1h |
| Type Mismatch Frontend | Type | MEDIUM | - | Pending | 1h |
| Transaction Validation | Error | MEDIUM | AC4 | Pending | 0.5h |
| Test Skeletons (11) | Test | LOW | AC1-5 | Pending | 11h |
| Error Handler tRPC | UX | LOW | - | Pending | 1h |

**Total Effort**: ~19h (P1: 2h, P2: 5h, P3: 12h)

**Recommendation**: Address HIGH issues before deployment. MEDIUM issues should be resolved pre-release. LOW issues can be addressed post-launch.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

준비 작업 완료 로그:
1. Prisma Schema 적용 완료 (2026-01-11)
2. tRPC Router 구조 준비 완료 (2026-01-11)
3. BFS 알고리즘 구현 완료 (2026-01-11)
4. React Flow PoC 완료 (2026-01-11)

### Completion Notes List

- ✅ Prisma Schema: TransactionRelation, TransactionChain 모델 추가 완료
- ✅ Database Migration: prisma db push 완료
- ✅ tRPC Router: fundFlow.ts 생성 (traceUpstream, traceDownstream, saveChain, getSavedChains)
- ✅ Service Layer: fund-flow-service.ts 생성 (BFS 알고리즘, 사이클 감지, 신뢰도 계산)
- ✅ React Flow PoC: 그래프 시각화 기술 검증 완료
- ⚠️ 프론트엔드 컴포넌트: FundSourceTraceResult 생성 필요
- ⚠️ 테스트 코드: 단위/통합/컴포넌트 테스트 작성 필요

### File List

**이미 생성된 파일:**
1. `prisma/schema.prisma` - TransactionRelation, TransactionChain 모델 추가
2. `src/server/api/routers/fundFlow.ts` - tRPC 라우터 (traceUpstream 등)
3. `src/server/services/fund-flow-service.ts` - BFS 추적 서비스
4. `src/react-flow-poc.tsx` - React Flow 기술 검증

**생성 필요한 파일:**
1. `src/components/molecules/FundSourceTraceResult.tsx` - 추적 결과 컴포넌트
2. `src/server/audit/fund-flow-audit.ts` - 감사 로그 서비스
3. `src/server/services/fund-flow-service.test.ts` - 단위 테스트
4. `src/server/api/routers/fundFlow.test.ts` - 통합 테스트
5. `src/components/molecules/FundSourceTraceResult.test.tsx` - 컴포넌트 테스트

**수정 필요한 파일:**
1. `src/components/organisms/TransactionTable.tsx` - 추적 버튼 추가
2. `src/server/api/root.ts` - fundFlow 라우터 등록
