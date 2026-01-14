# Story 5.5: 추적 필터링 (Tracking Filtering)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **변호사 또는 법무사**,
I want **추적 범위를 날짜, 금액, 태그, 거래 성격 등으로 필터링해서**,
So that **관심 있는 자금 흐름만 집중해서 볼 수 있다**.

## Acceptance Criteria

**AC1: 필터 패널 표시**
- **Given** 사용자가 자금 흐름 추적 화면에 있을 때
- **When** FilterPanel이 표시되면
- **Then** 다음 필터 옵션이 제공된다:
  - 날짜 범위 (시작일, 종료일)
  - 금액 범위 (최소금액, 최대금액)
  - 태그 (다중 선택 가능)
  - 거래 성격 (채권자/담보/우선변제)
  - 중요 거래만 보기

**AC2: 날짜 범위 필터링**
- **Given** 사용자가 날짜 범위를 필터링할 때
- **When** 시작일과 종료일을 설정하면
- **Then** 해당 기간 내의 거래들만 추적 대상에 포함된다
- **And** 추적 결과 화면이 필터링된 결과로 업데이트된다

**AC3: 금액 범위 필터링**
- **Given** 사용자가 금액 범위를 필터링할 때
- **When** 최소금액과 최대금액을 설정하면
- **Then** 해당 범위 내의 금액을 가진 거래들만 추적된다
- **And** 입금액 또는 출금액이 범위 내인 거래만 포함된다

**AC4: 태그 필터링**
- **Given** 사용자가 태그를 필터링할 때
- **When** 특정 태그들을 선택하면
- **Then** 해당 태그가 있는 거래들만 추적된다
- **And** 여러 태그는 OR 조건으로 적용된다 (태그1 OR 태그2)

**AC5: 복합 필터**
- **Given** 사용자가 복합 필터를 적용할 때
- **When** 여러 필터를 동시에 적용하면
- **Then** 모든 조건을 만족하는 거래들만 추적된다 (AND 조건)
- **And** 날짜 AND 금액 AND 태그 등 모든 필터가 결합된다

**AC6: 필터 저장**
- **Given** 사용자가 필터를 저장하고 싶을 때
- **When** "필터 저장" 버튼을 클릭하고 이름을 입력하면
- **Then** 현재 필터 조합이 SavedFilter 테이블에 저장된다
- **And** 다음에 빠르게 불러올 수 있다

## Requirements
- FR-036: 추적 범위 필터링
- NFR-003: 3초 이내 응답

## Tasks / Subtasks

### Task 1: 필터 상태 관리 컴포넌트 구현 (AC1, AC5)
- [ ] Subtask 1.1: `FundFlowFilterPanel` 컴포넌트 생성
  - [ ] FilterPanel 레이아웃 (shadcn/ui 기반)
  - [ ] 날짜 범위 DatePicker (시작일, 종료일)
  - [ ] 금액 범위 Input (최소금액, 최대금액)
  - [ ] 태그 다중 선택 (Checkbox 또는 MultiSelect)
  - [ ] 거래 성격 Select (채권자/담보/우선변제)
  - [ ] 중요 거래 Checkbox
  - [ ] "필터 적용" 버튼
  - [ ] "필터 초기화" 버튼

- [ ] Subtask 1.2: 필터 상태 타입 정의
  - [ ] `FundFlowFilters` 인터페이스 정의
    ```typescript
    interface FundFlowFilters {
      dateRange?: { start: Date; end: Date };
      amountRange?: { min: number; max: number };
      tags?: string[];
      transactionNature?: TransactionNature[];
      importantOnly?: boolean;
    }
    ```
  - [ ] Zod 스키마 검증

### Task 2: 필터 로직 구현 (AC2, AC3, AC4, AC5)
- [ ] Subtask 2.1: `applyFilters` 함수 구현
  - [ ] 날짜 범위 필터링 로직
  - [ ] 금액 범위 필터링 로직
  - [ ] 태그 필터링 로직 (OR 조건)
  - [ ] 거래 성격 필터링 로직
  - [ ] 중요 거래 필터링 로직
  - [ ] 복합 필터 결합 (AND 조건)

- [ ] Subtask 2.2: `src/lib/filter-utils.ts` 생성
  - [ ] `filterTransactionsByDateRange()` 함수
  - [ ] `filterTransactionsByAmountRange()` 함수
  - [ ] `filterTransactionsByTags()` 함수
  - [ ] `filterTransactionsByNature()` 함수
  - [ ] `filterImportantTransactions()` 함수

### Task 3: 필터 저장 기능 구현 (AC6)
- [ ] Subtask 3.1: SavedFilter Prisma 스키마
  - [ ] `SavedFilter` 모델 정의
    ```prisma
    model SavedFilter {
      id          String   @id @default(uuid())
      userId      String
      name        String
      filters     Json     // FundFlowFilters 직렬화
      createdAt   DateTime @default(now())
      user        User     @relation(fields: [userId], references: [id])
    }
    ```
  - [ ] index: [userId, name]

- [ ] Subtask 3.2: tRPC 라우터 확장
  - [ ] `fundFlow.saveFilter` 프로시저
    - [ ] 입력 검증 (name, filters)
    - [ ] RBAC: attorneyProcedure
    - [ ] upsert로 저장/업데이트
  - [ ] `fundFlow.getSavedFilters` 프로시저
    - [ ] 사용자의 저장된 필터 목록 조회
  - [ ] `fundFlow.deleteSavedFilter` 프로시저
    - [ ] 저장된 필터 삭제

### Task 4: 추적 결과 필터링 연동 (AC2, AC3, AC4, AC5)
- [ ] Subtask 4.1: `FundSourceTraceResult` 필터링
  - [ ] `FundFlowFilterPanel`과 연동
  - [ ] 필터 적용 시 추적 결과 재계산
  - [ ] React Query로 필터 상태 관리
  - [ ] 필터 변경 시 자동 재검색 (debounce 300ms)

- [ ] Subtask 4.2: `FundDestinationTraceResult` 필터링
  - [ ] 자금 사용처 추적 결과 필터링
  - [ ] 동일한 필터 로직 재사용

### Task 5: UI/UX 개선 (모든 AC)
- [ ] Subtask 5.1: 필터 상태 표시
  - [ ] 현재 적용된 필터 개수 Badge 표시
  - [ ] 활성 필터 Chip 표시 (삭제 가능)
  - [ ] "필터 초기화" 버튼 (필터 있을 때만 활성)

- [ ] Subtask 5.2: 필터 저장/불러오기 UI
  - [ ] "필터 저장" 버튼 및 모달
  - [ ] 저장된 필터 드롭다운
  - [ ] 빠른 필터 전환

- [ ] Subtask 5.3: 반응형 디자인
  - [ ] Desktop: FilterPanel이 좌측 사이드바
  - [ ] Mobile: FilterPanel이 모달/드로워

### Task 6: 성능 최적화 (AC2, AC3, AC4, AC5)
- [ ] Subtask 6.1: 클라이언트 사이드 필터링
  - [ ] 이미 로드된 추적 결과를 클라이언트에서 필터링
  - [ ] 불필요한 서버 요청 방지
  - [ ] useMemo로 필터링 결과 캐싱

- [ ] Subtask 6.2: 디바운스
  - [ ] 필터 변경 시 300ms 디바운스 적용
  - [ ] 사용자 입력 완료 후 필터 적용

### Task 7: 테스트 작성 (모든 AC)
- [ ] Subtask 7.1: 단위 테스트
  - [ ] `filterTransactionsByDateRange()` 테스트
  - [ ] `filterTransactionsByAmountRange()` 테스트
  - [ ] `filterTransactionsByTags()` 테스트
  - [ ] 복합 필터 테스트
  - [ ] 경계값 테스트 (null, undefined)

- [ ] Subtask 7.2: 컴포넌트 테스트
  - [ ] `FundFlowFilterPanel` 렌더링 테스트
  - [ ] 필터 변경 시 상태 업데이트 테스트
  - [ ] 필터 저장/불러오기 테스트

- [ ] Subtask 7.3: 통합 테스트
  - [ ] 필터 적용 후 추적 결과 확인
  - [ ] 성능 테스트 (3초 이내 응답)

## Dev Notes

### 관련 아키텍처 패턴 및 제약사항

**Frontend Stack:**
- **Next.js 14+**: App Router
- **React Hook Form + Zod**: 폼� 상태 관리 및 검증
- **shadcn/ui**: DatePicker, Select, Checkbox, Button, Input, Label
- **React Query v5**: 서버 상태 관리 (useMutation, useQuery)
- **Zustand**: 클라이언트 필터 상태 관리
- **Tailwind CSS**: 스타일링

**Backend Stack:**
- **tRPC v11**: 타입 안전한 API
- **Prisma 7.2.0**: 데이터베이스 ORM
- **Zod v4**: 입력 검증

### 소스 트리 구성 요소

**백엔드 파일:**
- `src/server/api/routers/fundFlow.ts` - tRPC 라우터 (확장, Story 5.1에서 생성됨)
- `src/server/services/fund-flow-service.ts` - 추적 서비스 (확장, Story 5.1에서 생성됨)
- `src/lib/filter-utils.ts` - 필터 유틸 함수 (신규)
- `src/server/api/routers/savedFilter.ts` - 저장된 필터 라우터 (신규, 선택사항)

**프론트엔드 파일:**
- `src/components/molecules/fund-flow-filter-panel.tsx` - 필터 패널 (신규)
- `src/components/molecules/fund-source-trace-result.tsx` - 출처 추적 결과 (확장, Story 5.1)
- `src/components/molecules/fund-destination-trace-result.tsx` - 사용처 추적 결과 (확장, Story 5.2)
- `src/store/fundFlowFilterStore.ts` - 필터 상태 관리 (신규, Zustand)

**기존 파일 (참조):**
- `src/components/ui/datepicker.tsx` - shadcn/ui DatePicker (아직 생성되지 않음, 필요시 생성)
- `src/components/ui/select.tsx` - shadcn/ui Select
- `src/components/ui/checkbox.tsx` - shadcn/ui Checkbox
- `src/components/ui/input.tsx` - shadcn/ui Input
- `src/components/ui/label.tsx` - shadcn/ui Label
- `src/components/ui/button.tsx` - shadcn/ui Button

### Story 5.1-5.4에서 학습한 패턴 적용

**구현 완료된 패턴:**
- ✅ RBAC: `attorneyProcedure` 미들웨어로 접근 제어 (Story 5.1)
- ✅ Zod 검증: 모든 tRPC 입력 검증 (Story 5.1)
- ✅ React Query: 서버 상태 관리 (Story 5.1, 5.4)
- ✅ shadcn/ui: UI 컴포넌트 (Story 5.4)
- ✅ FilterPanel 패턴: 체인 유형 필터 (Story 5.4, ChainFilterSidebar)
- ✅ TypeScript: 인터페이스 및 타입 정의 (모든 스토리)

### Story 5.5 적용 시 주의사항

**필터 상태 관리:**
- Zustand store로 필터 상태 전역 관리 (FundFlowFilterStore)
- React Query Query Key에 필터 상태 포함 (캐싱)
- 필터 변경 시 Query 무효화 및 재검색

**성능 최적화:**
- 클라이언트 사이드 필터링 (이미 로드된 데이터 재사용)
- useMemo로 필터링 결과 캐싱
- 디바운스로 불필요한 재검색 방지

**사용자 경험:**
- 필터 저장/불러오기로 반복 작업 최소화
- 활성 필터 시각적 표시 (Chip, Badge)
- 빠른 필터 초기화

### 데이터 모델 매핑

**필터 상태 (클라이언트):**
```typescript
interface FundFlowFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
  transactionNature?: TransactionNature[];
  importantOnly?: boolean;
}
```

**저장된 필터 (서버):**
```prisma
model SavedFilter {
  id          String   @id @default(uuid())
  userId      String
  name        String
  filters     Json     // FundFlowFilters 직렬화
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, name])
  @@index([userId])
}
```

### 아키텍처 준수 사항

**Performance:**
- NFR-003: 3초 이내 응답 (필터링 포함)
- 클라이언트 사이드 필터링으로 서버 부하 감소

**Security:**
- RBAC: attorneyProcedure로 접근 제어
- SavedFilter는 사용자별로 격리 (userId)

**Data Integrity:**
- Zod 검증: 필터 입력값
- 타입 안전성: TypeScript

### 라이브러리 및 프레임워크 요구사항

**필수 패키지:**
```bash
# 이미 설치된 패키지 (T3 Stack)
# - next
# - react
# - typescript
# - tailwindcss
# - @tanstack/react-query
# - trpc
# - zod
# - zustand (클라이언트 상태)

# shadcn/ui 컴포넌트 (아직 생성되지 않은 경우)
npx shadcn-ui@latest add datepicker  # DatePicker가 필요한 경우
npx shadcn-ui@latest add select     # 이미 존재할 가능성 높음
npx shadcn-ui@latest add checkbox   # 이미 존재할 가능성 높음
npx shadcn-ui@latest add input      # 이미 존재할 가능성 높음
npx shadcn-ui@latest add label      # 이미 존재할 가능성 높음
npx shadcn-ui@latest add button     # 이미 존재할 가능성 높음
```

**shadcn/ui 컴포넌트:**
- DatePicker (날짜 범위 선택) - 필요 시 생성
- Select (거래 성격 선택)
- Checkbox (태그 다중 선택, 중요 거래)
- Input (금액 범위)
- Label (라벨)
- Button (적용, 초기화, 저장)

### 테스트 요구사항

**단위 테스트 (Vitest):**
- 필터 유틸 함수들
- 복합 필터 로직
- 경계값 테스트

**컴포넌트 테스트 (React Testing Library):**
- FundFlowFilterPanel 렌더링
- 필터 상태 변경
- 필터 저장/불러오기

**성능 테스트:**
- 필터링 응답 시간 (3초 이내)

### References

**아키텍처:**
- [Architecture: Frontend Architecture](../planning-artifacts/architecture.md#frontend-architecture) - React Query, Zustand
- [Architecture: Component Structure](../planning-artifacts/architecture.md#project-structure--boundaries) - molecules 폴더 구조

**요구사항:**
- [Epic 5: 자금 흐름 추적](../planning-artifacts/epics.md#epic-5-자금-흐름-추적) - Epic 5 전체 개요
- [Story 5.5: 추적 필터링](../planning-artifacts/epics.md#story-55-추적-필터링) - 상세 AC

**이전 스토리:**
- [Story 5.1: Fund Source Tracking](./5-1-fund-source-tracking.md) - tRPC 라우터 패턴, RBAC, React Query
- [Story 5.4: Linkage Visualization](./5-4-linkage-visualization.md) - FilterPanel 패턴, 체인 유형 필터링

---

## Code Review Findings & Action Items

**코드 리뷰 날짜:** 2026-01-12  
**리뷰어:** Claude (AI Code Reviewer)  
**상태:** REVIEW COMPLETE - 4개 이슈 발견

### 요약

Story 5.5 구현 검토 결과:
- **총 이슈 수**: 4개
- **CRITICAL**: 0개
- **HIGH**: 1개 (P1 - 이번 주)
- **MEDIUM**: 2개 (P2 - 다음 주)
- **LOW**: 1개 (P3 - 백로그)

---

### HIGH Priority Issues (P1 - 이번 주)

#### HIGH #1: 필터링 성능 - 클라이언트와 서버 필터링 혼재로 인한 비효율
- **심각도**: HIGH (P1)
- **위치**: src/server/api/routers/fundFlow.ts (L130-L170: saveFilter, getSavedFilters)
- **문제**: 
  - SavedFilter 저장 시 필터를 Json으로 직렬화했으나, 검색 결과는 서버에서 필터링하지 않고 클라이언트에서만 필터링
  - 현재: 사용자가 필터를 적용하면 → 전체 추적 결과를 로드 → 클라이언트에서 useMemo로 필터링
  - 10,000+ 거래 데이터의 경우, 모두 메모리에 로드되어 UI 반응성 저하
- **영향**: 대용량 데이터셋에서 성능 저하 (NFR-003: 3초 이내 응답 미충족 가능)
- **솔루션 패턴**:
  ```typescript
  // 방식 1: 서버 사이드 필터링 (권장)
  traceUpstream: caseAccessProcedure
    .input(z.object({
      transactionId: z.string(),
      filters: fundFlowFiltersSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await traceUpstreamFunds(...);
      // 추적 결과에 필터 적용
      if (input.filters) {
        result.chains = applyFilters(result.chains, input.filters);
      }
      return result;
    })
  ```
- **AC 체크**: AC5 (복합 필터) - 서버 사이드에서 AND 조건으로 필터 결합 필요
- **작업량**: 1.5시간

---

### MEDIUM Priority Issues (P2 - 다음 주)

#### MEDIUM #1: 날짜 범위 필터 - 시간대 처리 버그
- **심각도**: MEDIUM (P2)
- **위치**: src/lib/filter-utils.ts (L40-L60: filterTransactionsByDateRange)
- **문제**:
  ```typescript
  // 현재 코드 (버그):
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);  // 로컬 타임존 기반
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);  // 로컬 타임존 기반
  
  // 문제: 데이터베이스는 UTC 저장, 클라이언트는 로컬 타임존
  // 예: 로컬 KST 2024-01-31 자정 = UTC 2024-01-30 15:00
  // → 경계 날짜 거래가 올바르게 필터링되지 않음
  ```
- **영향**: 마지막 날짜의 거래가 필터링 결과에서 누락될 수 있음
- **솔루션**:
  ```typescript
  export function filterTransactionsByDateRange<T extends { transactionDate: Date }>(
    transactions: T[],
    dateRange?: { start: Date; end: Date }
  ): T[] {
    if (!dateRange) return transactions;
    
    const { start, end } = dateRange;
    
    // UTC 기반으로 정규화 (DB와 동일한 기준)
    const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999));
    
    return transactions.filter((tx) => {
      const txDate = new Date(tx.transactionDate);
      return txDate >= startDate && txDate <= endDate;
    });
  }
  ```
- **AC 체크**: AC2 (날짜 범위 필터링) - 경계 조건 모두 포함 필요
- **작업량**: 1시간

#### MEDIUM #2: 금액 필터 - Decimal 타입 변환 미처리
- **심각도**: MEDIUM (P2)
- **위치**: src/lib/filter-utils.ts (L80-L95: filterTransactionsByAmountRange)
- **문제**:
  ```typescript
  // 현재 코드:
  const amount = tx.depositAmount ?? tx.withdrawalAmount ?? 0;
  const numAmount = Number(amount);
  return numAmount >= min && numAmount <= max;
  
  // 문제: Prisma Decimal 타입은 Number로 자동 변환되지 않을 수 있음
  // Decimal.js 인스턴스인 경우: Number(decimal) 실패 가능
  ```
- **영향**: 필터링 로직이 제대로 작동하지 않을 수 있음 (특히 소수점 금액)
- **솔루션**:
  ```typescript
  export function filterTransactionsByAmountRange<
    T extends { depositAmount: number | null; withdrawalAmount: number | null }
  >(transactions: T[], amountRange?: { min: number; max: number }): T[] {
    if (!amountRange) return transactions;
    
    const { min, max } = amountRange;
    
    return transactions.filter((tx) => {
      // Decimal → number 안전 변환
      let amount = 0;
      if (tx.depositAmount !== null) {
        amount = typeof tx.depositAmount === 'number' ? tx.depositAmount : Number(tx.depositAmount);
      } else if (tx.withdrawalAmount !== null) {
        amount = typeof tx.withdrawalAmount === 'number' ? tx.withdrawalAmount : Number(tx.withdrawalAmount);
      }
      
      return amount >= min && amount <= max;
    });
  }
  ```
- **AC 체크**: AC3 (금액 범위 필터링) - 입금액/출금액 모두 정확히 필터링
- **작업량**: 0.5시간

---

### LOW Priority Issues (P3 - 백로그)

#### LOW #1: 필터 유효성 검증 - 입력값 범위 검증 미흡
- **심각도**: LOW (P3)
- **위치**: src/store/fundFlowFilterStore.ts (L50-L70: setAmountRange)
- **문제**: 
  - `min > max` 조건 체크 없음
  - 음수 금액 입력 가능
  - `min === max` 경우 의도 불명확
- **영향**: 사용자가 잘못된 필터 상태로 빈 결과를 얻거나 혼동할 수 있음
- **솔루션**:
  ```typescript
  setAmountRange: (min, max) =>
    set((state) => {
      // 유효성 검증
      if (min !== null && max !== null) {
        if (min < 0 || max < 0) {
          console.warn('[FundFlowFilterStore] 음수 금액은 허용되지 않습니다');
          return state;
        }
        if (min > max) {
          console.warn('[FundFlowFilterStore] 최소 금액이 최대 금액보다 클 수 없습니다');
          return state;
        }
      }
      
      return {
        filters: {
          ...state.filters,
          amountRange: min !== null && max !== null ? { min, max } : undefined,
        },
      };
    }),
  ```
- **AC 체크**: AC5 (복합 필터) - 잘못된 필터 상태 방지
- **작업량**: 0.5시간

---

### Implementation Checklist

#### P1 - 이번 주 (HIGH)
- [ ] HIGH #1: 필터링 성능 최적화 (서버 사이드 필터링)

#### P2 - 다음 주 (MEDIUM)
- [ ] MEDIUM #1: 날짜 범위 필터 시간대 처리 수정
- [ ] MEDIUM #2: 금액 필터 Decimal 타입 변환 처리

#### P3 - 백로그 (LOW)
- [ ] LOW #1: 필터 입력값 유효성 검증 강화

---

### 긍정적 발견 사항 ✓

1. **타입 안전성**: TypeScript 타입 정의 철저 (FundFlowFilters 인터페이스)
2. **Zod 검증**: 모든 필터 입력에 Zod 스키마 적용 (fundFlowFiltersSchema)
3. **테스트 커버리지**: filter-utils.test.ts에 22개 테스트 - 주요 시나리오 모두 포함
4. **RBAC 준수**: saveFilter/getSavedFilters에서 userId 기반 격리
5. **복합 필터 로직**: applyFilters에서 AND 조건으로 모든 필터 결합 (AC5 준수)
6. **Zustand 상태 관리**: 필터 상태 전역 관리, 깔끔한 API

---

**전체 상태**: REVIEW COMPLETE - 4개 이슈 발견 및 문서화  
**권장사항**: P1 이슈 1개를 먼저 해결한 후 배포

---

## Dev Agent Context

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

- Story 5.1-5.4 패턴 분석 완료
- FilterPanel 패턴 연구 완료 (Story 5.4 ChainFilterSidebar)
- Story 5.5 구현 코드 분석 완료

### Completion Notes List

### File List

---

**Story 5.5는 자금 흐름 추적 결과를 다차원으로 필터링하는 기능을 구현합니다.** Story 5.1-5.4에서 구축된 추적 인프라를 활용하여, 사용자가 관심 있는 자금 흐름만 집중해서 볼 수 있는 포괄적인 필터링 시스템을 제공합니다.
