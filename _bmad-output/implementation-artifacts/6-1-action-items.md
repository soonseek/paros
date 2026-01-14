# Story 6.1 Action Items
## 코드 리뷰 및 개선 사항

**Created**: 2026-01-13  
**Story**: 6.1 - Auto Finding Identification (자동 발견사항 식별)  
**Total Issues**: 8 (1 CRITICAL, 3 HIGH, 4 MEDIUM)  
**Estimated Total Effort**: 7 days (5-6 days with parallel execution)  
**Phase**: CRITICAL & HIGH fixes required before release; MEDIUM fixes recommended

---

## Priority Matrix

```
                High
            Impact
                |
                | [CRITICAL] #1
                | [HIGH] #2, #3, #4
         [MEDIUM] #5-8
                |
                +------------ Effort -------->
            Low                              High
```

### Recommended Phase Execution
- **Phase 1 (Release Blocker)**: Issue #1 (1-2 days) → Must complete before merge
- **Phase 2 (Pre-Release)**: Issue #2, #3, #4 (2-3 days) → Must complete before release
- **Phase 3 (Post-Release)**: Issue #5-8 (2-3 days) → Sprint backlog for next iteration

---

## CRITICAL ISSUES

### [CRITICAL] Issue #1: Duplicate Finding Prevention Logic - Missing Transaction Ordering

**ID**: ACTION-6.1-1
**Severity**: 🔴 CRITICAL
**Category**: Logic / Data Integrity
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 1.5 days

#### Problem Statement
`deduplicateFindings()` 함수는 `relatedTransactionIds` 배열의 순서를 무시하고 중복을 판단합니다. 동일한 거래들이지만 순서가 다른 경우 중복으로 판단되어 중요한 Finding이 누락될 수 있습니다.

**Example Case**:
- Finding A: relatedTransactionIds = ["tx-1", "tx-2", "tx-3"]
- Finding B: relatedTransactionIds = ["tx-3", "tx-2", "tx-1"]
- 현재 코드: 배열 sort → 동일하다고 판단 → Finding B 스킵 (중복 제거)
- 문제: 만약 A와 B가 서로 다른 패턴(선의성 vs 담보권)을 나타낼 수 있음

**Files Affected**:
- `src/server/services/finding-service.ts` (lines 330-355)

#### Root Cause Analysis
`deduplicateFindings()` 구현:
```typescript
const isDuplicate = existing.some((ex) => {
  const existingIds = [...ex.relatedTransactionIds].sort();
  const newIds = [...finding.relatedTransactionIds].sort();
  return (
    existingIds.length === newIds.length &&
    existingIds.every((id, idx) => id === newIds[idx])
  );
});
```

문제점:
1. **거래 순서 무시**: sort()를 사용하여 원본 순서 손실
2. **패턴 차이 미반영**: 예: 대출→담보 vs 담보→대출 은 다른 의미지만 동일하다고 판단
3. **Story 6.1 AC4 위반**: "caseId + findingType + relatedTransactionIds 조합" → 순서가 포함되어야 함

#### Business/Technical Impact
- **Business**: 우선변제권 침해 패턴 누락 → 법적 위험 증가
- **Technical**: 데이터 무결성 문제 → 고객이 중요한 Finding을 놓칠 수 있음
- **Severity**: CRITICAL - 코어 로직 오류

#### Acceptance Criteria
- AC1: 동일한 거래 집합이지만 **순서가 다르면** 서로 다른 Finding으로 생성
- AC2: 중복 판단: caseId + findingType + **순서가 포함된** relatedTransactionIds
- AC3: 테스트 추가 (순서 다른 케이스)
- AC4: 기존 Finding 조회 시 JSON 문자열로 비교 (배열 아님)

#### Implementation Plan

**Step 1: relatedTransactionIds 비교 로직 수정**

```typescript
// 수정 전: sort() 사용 (순서 무시)
const isDuplicate = existing.some((ex) => {
  const existingIds = [...ex.relatedTransactionIds].sort();
  const newIds = [...finding.relatedTransactionIds].sort();
  return existingIds.length === newIds.length && 
         existingIds.every((id, idx) => id === newIds[idx]);
});

// 수정 후: 순서 고려 (JSON 문자열 직접 비교)
const isDuplicate = existing.some((ex) => {
  const existingIds = JSON.stringify(ex.relatedTransactionIds);
  const newIds = JSON.stringify(finding.relatedTransactionIds);
  return existingIds === newIds; // 순서 포함, 간단함
});
```

**Step 2: 테스트 추가**

```typescript
it("should NOT deduplicate findings with same IDs but different order", async () => {
  const existingFinding = {
    caseId: "case-1",
    findingType: "PRIORITY_REPAYMENT_VIOLATION",
    relatedTransactionIds: ["tx-1", "tx-2", "tx-3"],
  };
  
  const newFinding = {
    caseId: "case-1",
    findingType: "PRIORITY_REPAYMENT_VIOLATION",
    relatedTransactionIds: ["tx-3", "tx-2", "tx-1"], // 순서 다름
  };

  // 중복 제거 후 2개 모두 포함되어야 함
  const result = await deduplicateFindings({
    db: mockDb,
    caseId: "case-1",
    findings: [newFinding],
  });

  expect(result.length).toBe(1); // 중복 아님, 모두 생성
});
```

**Step 3: Code Review Checklist**
- [ ] JSON.stringify 비교로 순서 정확성 확인
- [ ] 기존 Finding 조회 쿼리 검증 (relatedTransactionIds 타입)
- [ ] 테스트 케이스 추가 (순서 다른 경우 2개 생성)
- [ ] 성능 영향 확인 (대량 Finding 중복 검사)

---

## HIGH PRIORITY ISSUES

### [HIGH] Issue #2: Transaction Query Performance - N+1 문제 미제거

**ID**: ACTION-6.1-2
**Severity**: 🟠 HIGH
**Category**: Performance / Database
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 1 day

#### Problem Statement
`analyzeFindings()` → `detectPreferenceRepayment()` → `detectPriorityRepaymentViolation()` → `detectCollateralIssues()` 함수들이 각각 transaction 배열을 필터링하며 여러 번 순회합니다. 메모리 효율성이 낮고 불필요한 반복 연산이 있습니다.

**Current Implementation**:
```typescript
// 각 함수에서 필터링 반복
const loanExecutions = transactions.filter((tx) => 
  tx.transactionNature === "GENERAL" && tx.withdrawalAmount
);
const collateralTransactions = transactions.filter((tx) =>
  tx.transactionNature === "COLLATERAL" && tx.depositAmount
);
// → 거래 배열을 3번 순회 (각 detect* 함수마다)
```

**Impact**: 10,000건 거래 × 3함수 = 30,000회 필터링 → 100-300ms 지연

#### Root Cause Analysis
1. **불필요한 재필터링**: 동일한 조건으로 반복 필터링
2. **메모리 사용**: 임시 배열 생성 (loanExecutions, collateralTransactions 등)
3. **정렬 반복**: detectPriorityRepaymentViolation에서 매번 정렬

#### Business/Technical Impact
- **Performance**: NFR-002 30초 요구사항 초과 위험 (현재 100-300ms → 누적 가능)
- **Scalability**: 거래 수 증가 시 선형 성능 저하

#### Acceptance Criteria
- AC1: Transaction 배열 단일 순회로 모든 필터 생성
- AC2: 정렬 결과 캐싱 (재사용)
- AC3: 메모리 사용량 50% 감소
- AC4: 성능 테스트 (1,000건 < 10ms)

#### Implementation Plan

**Step 1: 사전 처리 함수 추가**

```typescript
interface TransactionIndex {
  loanExecutions: Transaction[];
  collateralTransactions: Transaction[];
  generalRepayments: Transaction[];
  priorityRepayments: Transaction[];
  sortedByDate: Transaction[];
}

function indexTransactions(transactions: Transaction[]): TransactionIndex {
  const loanExecutions: Transaction[] = [];
  const collateralTransactions: Transaction[] = [];
  const generalRepayments: Transaction[] = [];
  const priorityRepayments: Transaction[] = [];

  // 단일 순회: O(n)
  for (const tx of transactions) {
    if (tx.transactionNature === "GENERAL") {
      if (tx.withdrawalAmount && tx.withdrawalAmount.toNumber() > 0) {
        loanExecutions.push(tx);
      }
      if (tx.creditorName) {
        generalRepayments.push(tx);
      }
    } else if (tx.transactionNature === "COLLATERAL" && tx.depositAmount?.toNumber() > 0) {
      collateralTransactions.push(tx);
    } else if (tx.transactionNature === "PRIORITY_REPAYMENT") {
      priorityRepayments.push(tx);
    }
  }

  // 정렬: O(n log n) 단 1회
  const sortedByDate = [...transactions].sort(
    (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
  );

  return {
    loanExecutions,
    collateralTransactions,
    generalRepayments,
    priorityRepayments,
    sortedByDate,
  };
}
```

**Step 2: 각 detect* 함수 수정**

```typescript
export async function detectPreferenceRepayment(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  // 사전 처리된 인덱스 사용
  const { loanExecutions, collateralTransactions } = indexTransactions(transactions);

  // 이전 코드와 동일하지만 이미 필터링된 배열 사용
  for (const loan of loanExecutions) {
    // ... 기존 로직
  }

  return findings;
}

export async function detectPriorityRepaymentViolation(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  // 사전 처리된 인덱스 사용 (정렬 결과 재사용)
  const { priorityRepayments, generalRepayments, sortedByDate } = indexTransactions(transactions);

  for (const priority of priorityRepayments) {
    // ... 기존 로직
  }

  return findings;
}
```

**Step 3: analyzeFindings 수정**

```typescript
export async function analyzeFindings(params: {
  db: PrismaClient;
  caseId: string;
  userId: string;
}): Promise<AnalysisResult> {
  const { db, caseId, userId } = params;
  const startTime = Date.now();

  const transactions = await db.transaction.findMany({
    where: {
      caseId,
      transactionNature: { not: null },
    },
    select: {
      id: true,
      transactionDate: true,
      depositAmount: true,
      withdrawalAmount: true,
      transactionNature: true,
      creditorName: true,
      collateralType: true,
      memo: true,
    },
  });

  // 사전 인덱싱 (단일 순회)
  const index = indexTransactions(transactions);

  // detect* 함수에 인덱스된 결과 전달 (재필터링 방지)
  const [preferenceFindings, priorityFindings, collateralFindings] =
    await Promise.all([
      detectPreferenceRepayment({ db, caseId, transactions: index.loanExecutions.concat(index.collateralTransactions) }),
      detectPriorityRepaymentViolation({ db, caseId, transactions: index.priorityRepayments.concat(index.generalRepayments) }),
      detectCollateralIssues({ db, caseId, transactions: index.collateralTransactions }),
    ]);

  // ... 나머지 코드
}
```

**Step 4: 성능 테스트 추가**

```typescript
it("should analyze 1000 transactions in less than 10ms", async () => {
  const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
    id: `tx-${i}`,
    transactionDate: new Date("2024-01-01"),
    depositAmount: i % 2 === 0 ? { toNumber: () => 1000000 } : null,
    withdrawalAmount: i % 2 === 1 ? { toNumber: () => 1000000 } : null,
    transactionNature: ["GENERAL", "COLLATERAL", "PRIORITY_REPAYMENT"][i % 3],
    creditorName: `creditor-${i}`,
    collateralType: i % 2 === 0 ? "저당권" : null,
    memo: "test memo",
  }));

  const startTime = performance.now();
  await analyzeFindings({
    db: mockDb,
    caseId: "case-1",
    userId: "user-1",
  });
  const duration = performance.now() - startTime;

  expect(duration).toBeLessThan(10);
});
```

---

### [HIGH] Issue #3: Error Handling - Missing Null Checks in Detect Functions

**ID**: ACTION-6.1-3
**Severity**: 🟠 HIGH
**Category**: Robustness / Error Handling
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 1 day

#### Problem Statement
`detectPreferenceRepayment()`, `detectCollateralIssues()` 등에서 `depositAmount.toNumber()`와 `withdrawalAmount.toNumber()` 호출 시 null/undefined 체크가 불충분합니다. 만약 Decimal 필드가 예상과 다르게 null이면 런타임 에러가 발생할 수 있습니다.

**Current Code**:
```typescript
const loanAmount = loan.withdrawalAmount!.toNumber(); // Non-null assertion 사용
if (
  daysDiff > 0 &&
  daysDiff <= PREFERENCE_REPAYMENT_DAYS_THRESHOLD &&
  Math.abs(collateralAmount - loanAmount) / loanAmount <= // loanAmount이 0이면 ZeroDivisionError
    AMOUNT_SIMILARITY_THRESHOLD
)
```

**Issues**:
1. Non-null assertion (`!`) 사용 → TypeScript 안전성 우회
2. Zero division 체크 없음
3. 예외 처리 부재

#### Root Cause Analysis
1. **필터 신뢰**: filter()에서 이미 null 체크했다고 가정
2. **임시 해결책**: `!` 사용으로 타입 체커 무시
3. **비즈니스 로직 부재**: 금액 0인 거래 처리 안 함

#### Business/Technical Impact
- **Reliability**: 런타임 크래시 가능
- **Data Quality**: 비정상 거래(금액 0)에 대한 처리 필요

#### Acceptance Criteria
- AC1: 모든 Decimal.toNumber() 호출 전 유효성 검사
- AC2: Zero division 체크 추가
- AC3: 예외 처리 (try-catch 또는 early return)
- AC4: 테스트 (edge case: 금액 0, null 값)

#### Implementation Plan

**Step 1: Helper 함수 추가**

```typescript
/**
 * Decimal 안전 변환
 */
function safeDecimalToNumber(
  value: { toNumber(): number } | null | undefined,
  fallback = 0
): number {
  if (!value) return fallback;
  try {
    const num = value.toNumber();
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

/**
 * 금액 유사성 검증 (안전한 division)
 */
function isSimilarAmount(
  amount1: number,
  amount2: number,
  threshold: number = 0.2
): boolean {
  // Zero division 방지
  if (amount1 === 0 || amount2 === 0) {
    return amount1 === amount2; // 둘 다 0이거나 같은 값만 유사
  }

  const ratio = Math.abs(amount1 - amount2) / Math.max(amount1, amount2);
  return ratio <= threshold;
}
```

**Step 2: 각 함수 수정**

```typescript
export async function detectPreferenceRepayment(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  const loanExecutions = transactions.filter((tx) => {
    const withdrawalAmount = safeDecimalToNumber(tx.withdrawalAmount);
    return (
      tx.transactionNature === "GENERAL" &&
      withdrawalAmount > 0 // 금액 > 0만 대출 실행으로 판단
    );
  });

  for (const loan of loanExecutions) {
    const loanAmount = safeDecimalToNumber(loan.withdrawalAmount, 0);
    
    if (loanAmount <= 0) continue; // 비정상 거래 스킵

    for (const collateral of collateralTransactions) {
      const collateralAmount = safeDecimalToNumber(collateral.depositAmount, 0);
      
      if (collateralAmount <= 0) continue; // 비정상 거래 스킵

      const daysDiff = (collateral.transactionDate.getTime() - 
                       loan.transactionDate.getTime()) / (1000 * 60 * 60 * 24);

      // 안전한 금액 비교
      if (
        daysDiff > 0 &&
        daysDiff <= PREFERENCE_REPAYMENT_DAYS_THRESHOLD &&
        isSimilarAmount(loanAmount, collateralAmount, AMOUNT_SIMILARITY_THRESHOLD)
      ) {
        findings.push({
          findingType: FindingType.PREFERENCE_REPAYMENT,
          title: "악의성 의심: 대출 후 짧은 기간 내 담보제공",
          description: `대출 실행일(${formatDate(loan.transactionDate)})로부터 ${Math.floor(
            daysDiff
          )}일 이내에 담보를 제공하여 악의성이 의심됩니다.`,
          severity: FindingSeverity.CRITICAL,
          relatedTransactionIds: [loan.id, collateral.id],
          relatedCreditorNames: collateral.creditorName
            ? [collateral.creditorName]
            : undefined,
        });
      }
    }
  }

  return findings;
}
```

**Step 3: 테스트 추가**

```typescript
it("should handle zero amount safely", async () => {
  const findings = await detectPreferenceRepayment({
    db: mockDb,
    caseId: "case-1",
    transactions: [
      {
        id: "tx-1",
        withdrawalAmount: { toNumber: () => 0 }, // 금액 0
        depositAmount: null,
        transactionNature: "GENERAL",
        // ...
      },
      {
        id: "tx-2",
        withdrawalAmount: null,
        depositAmount: { toNumber: () => 0 }, // 금액 0
        transactionNature: "COLLATERAL",
        // ...
      },
    ],
  });

  // Zero 금액 거래는 Finding 미생성
  expect(findings.length).toBe(0);
});

it("should not throw error on null amount", async () => {
  const findings = await detectPreferenceRepayment({
    db: mockDb,
    caseId: "case-1",
    transactions: [
      {
        id: "tx-1",
        withdrawalAmount: null, // null
        depositAmount: null,
        transactionNature: "GENERAL",
        // ...
      },
    ],
  });

  expect(findings.length).toBe(0);
});
```

---

### [HIGH] Issue #4: Missing i18n Keys for Finding Types

**ID**: ACTION-6.1-4
**Severity**: 🟠 HIGH
**Category**: Internationalization / UX
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 0.5 days

#### Problem Statement
Story 6.1에서 추가된 Finding 유형들 (`PREFERENCE_REPAYMENT`, `PRIORITY_REPAYMENT_VIOLATION`, `COLLATERAL_TIMING_ISSUE` 등)에 대한 i18n 메시지 키가 누락되었습니다. 프론트엔드에서 findingType을 그대로 표시하게 되어 사용자 경험이 떨어집니다.

**Missing Translations**:
- `finding.type.PREFERENCE_REPAYMENT`
- `finding.type.PRIORITY_REPAYMENT_VIOLATION`
- `finding.type.COLLATERAL_TIMING_ISSUE`
- `finding.type.COLLATERAL_DUPLICATE`
- `finding.type.COLLATERAL_DISCHARGE`

**Current Code**:
```tsx
<CardDescription className="text-xs">
  {t("finding.type")}: {finding.findingType} // 원본 영어 string 출력
</CardDescription>
```

#### Root Cause Analysis
1. Story 6.1 개발 중 i18n 메시지 작성 누락
2. Story 4.3에서만 `IMPORTANT_TRANSACTION` 타입 메시지 추가됨

#### Acceptance Criteria
- AC1: 5가지 Finding 유형별 한글/영어 메시지 추가
- AC2: 프론트엔드에서 i18n 키로 표시
- AC3: 모든 로케일(ko, en)에 일관성 있는 메시지

#### Implementation Plan

**Step 1: i18n 메시지 추가**

```json
// src/lib/i18n/locales/ko.json
{
  "finding": {
    "type": "발견사항 유형",
    "types": {
      "IMPORTANT_TRANSACTION": "중요 거래",
      "PREFERENCE_REPAYMENT": "악의성 의심 (선의성/악의성)",
      "PRIORITY_REPAYMENT_VIOLATION": "우선변제권 침해 가능성",
      "COLLATERAL_TIMING_ISSUE": "담보권 설정 시점 이슈",
      "COLLATERAL_DUPLICATE": "담보권 중복 설정",
      "COLLATERAL_DISCHARGE": "담보권 해지 확인"
    }
  }
}

// src/lib/i18n/locales/en.json
{
  "finding": {
    "type": "Finding Type",
    "types": {
      "IMPORTANT_TRANSACTION": "Important Transaction",
      "PREFERENCE_REPAYMENT": "Suspected Malicious Intent (Preference Repayment)",
      "PRIORITY_REPAYMENT_VIOLATION": "Priority Repayment Right Violation Risk",
      "COLLATERAL_TIMING_ISSUE": "Collateral Setting Timing Issue",
      "COLLATERAL_DUPLICATE": "Collateral Duplicate Setting",
      "COLLATERAL_DISCHARGE": "Collateral Discharge Confirmation"
    }
  }
}
```

**Step 2: 프론트엔드 컴포넌트 수정**

```tsx
// src/components/finding-card.tsx
export function FindingCard({ finding, onResolve, onUnresolve }: FindingCardProps) {
  const { t, formatDate, formatCurrency } = useI18n();

  const getFindingTypeLabel = (type: string): string => {
    const key = `finding.types.${type}`;
    const translated = t(key);
    // i18n 키가 없으면 원본 문자열 반환
    return translated === key ? type : translated;
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-xs">
          {t("finding.type")}: {getFindingTypeLabel(finding.findingType)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// src/components/molecules/finding-list.tsx
export function FindingList({ findings, onUpdate }: FindingListProps) {
  const { t } = useI18n();

  const getFindingTypeLabel = (type: string): string => {
    const key = `finding.types.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  // findingType 필터 드롭다운에서도 번역된 레이블 표시
  return (
    <div>
      {/* ... */}
      <Select value={findingTypeFilter} onValueChange={setFindingTypeFilter}>
        <SelectTrigger>
          <SelectValue placeholder="유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          {uniqueFindingTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {getFindingTypeLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 3: 테스트 추가**

```typescript
it("should have i18n keys for all finding types", () => {
  const findingTypes = [
    "PREFERENCE_REPAYMENT",
    "PRIORITY_REPAYMENT_VIOLATION",
    "COLLATERAL_TIMING_ISSUE",
    "COLLATERAL_DUPLICATE",
    "COLLATERAL_DISCHARGE",
  ];

  for (const type of findingTypes) {
    const key = `finding.types.${type}`;
    expect(t(key)).not.toBe(key); // 번역이 있으면 원본과 다른 값 반환
  }
});
```

---

## MEDIUM PRIORITY ISSUES

### [MEDIUM] Issue #5: Test Coverage - Missing Integration Tests for Deduplication

**ID**: ACTION-6.1-5
**Severity**: 🟡 MEDIUM
**Category**: Testing / Quality Assurance
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 0.5 days

#### Problem Statement
`deduplicateFindings()` 함수의 통합 테스트가 부족합니다. 특히 다음 시나리오가 테스트되지 않았습니다:
- 기존 Finding과 새 Finding의 조합
- 대량의 Finding 중복 검사 (성능 영향)
- Prisma의 실제 JSON 저장 및 조회

#### Acceptance Criteria
- AC1: 기존 Finding과 새 Finding 조합 테스트
- AC2: 성능 테스트 (100개 Finding 중복 검사 < 100ms)
- AC3: Edge case: 동일 Finding 2개 연속 분석

#### Implementation Plan

추가 테스트 케이스:

```typescript
describe("deduplicateFindings - Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle duplicate detection with existing findings", async () => {
    // Mock: 기존 Finding 1개
    mockDb.finding.findMany.mockResolvedValue([
      {
        id: "finding-1",
        relatedTransactionIds: ["tx-1", "tx-2"],
      },
    ]);

    const newFindings = [
      {
        findingType: "PREFERENCE_REPAYMENT",
        relatedTransactionIds: ["tx-1", "tx-2"], // 중복
        title: "test",
        severity: "CRITICAL",
      },
      {
        findingType: "PREFERENCE_REPAYMENT",
        relatedTransactionIds: ["tx-3", "tx-4"], // 새로운 거래
        title: "test2",
        severity: "CRITICAL",
      },
    ];

    const result = await deduplicateFindings({
      db: mockDb,
      caseId: "case-1",
      findings: newFindings,
    });

    // 첫 번째는 중복 제거, 두 번째만 생성
    expect(result).toHaveLength(1);
    expect(result[0]?.relatedTransactionIds).toEqual(["tx-3", "tx-4"]);
  });

  it("should deduplicate performance with 100 findings", async () => {
    // Mock: 100개의 기존 Finding
    const existingFindings = Array.from({ length: 100 }, (_, i) => ({
      id: `finding-${i}`,
      relatedTransactionIds: [`tx-${i}`, `tx-${i + 1}`],
    }));

    mockDb.finding.findMany.mockResolvedValue(existingFindings);

    const newFindings = Array.from({ length: 10 }, (_, i) => ({
      findingType: "PREFERENCE_REPAYMENT",
      relatedTransactionIds: [`tx-${1000 + i}`, `tx-${1001 + i}`],
      title: "test",
      severity: "CRITICAL",
    }));

    const startTime = performance.now();
    const result = await deduplicateFindings({
      db: mockDb,
      caseId: "case-1",
      findings: newFindings,
    });
    const duration = performance.now() - startTime;

    expect(result).toHaveLength(10); // 중복 없음
    expect(duration).toBeLessThan(100); // < 100ms
  });

  it("should deduplicate findings from same analysis run", async () => {
    // 동일한 분석에서 동일한 패턴 2회 감지
    const findings = [
      {
        findingType: "PRIORITY_REPAYMENT_VIOLATION",
        relatedTransactionIds: ["tx-1", "tx-2"],
        title: "test",
        severity: "CRITICAL",
      },
      {
        findingType: "PRIORITY_REPAYMENT_VIOLATION",
        relatedTransactionIds: ["tx-1", "tx-2"], // 동일
        title: "test",
        severity: "CRITICAL",
      },
    ];

    mockDb.finding.findMany.mockResolvedValue([]); // 기존 Finding 없음

    const result = await deduplicateFindings({
      db: mockDb,
      caseId: "case-1",
      findings,
    });

    // 현재 로직에서는 새 Finding으로만 비교 (기존 Finding과만 비교)
    // → 동일한 새 Finding은 모두 생성됨
    // 개선 필요: 새 Finding 간의 중복도 검사
    expect(result).toHaveLength(2); // 문제: 동일한 2개 모두 생성됨
  });
});
```

---

### [MEDIUM] Issue #6: Formatting - Description Text Parsing

**ID**: ACTION-6.1-6
**Severity**: 🟡 MEDIUM
**Category**: UX / Text Rendering
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 0.5 days

#### Problem Statement
`Finding.description` 필드가 긴 텍스트로 줄바꿈이 포함되어 있는데, 프론트엔드에서 `whitespace-pre-wrap`으로만 처리합니다. 마크다운 형식의 description (예: `**굵은 글씨**`, `- 목록`)이 제대로 렌더링되지 않습니다.

**Example**:
```
description: "우선변제권 침해 가능성\n\n## 상세 정보\n- 일반 채권자: OOO\n- 우선변제권 채권자: OOO"
```

UI에서:
```
우선변제권 침해 가능성

## 상세 정보
- 일반 채권자: OOO
```
(마크다운 형식 그대로 표시)

#### Acceptance Criteria
- AC1: 마크다운 형식 description 지원 (또는 plain text 통일)
- AC2: 프론트엔드에서 markdown parser 적용 (선택사항)
- AC3: 텍스트 길이 제한 (과도하게 긴 description 방지)

#### Implementation Plan

선택지 1: Plain text로 통일

```typescript
// src/server/services/finding-service.ts
const description = [
  `대출 실행일: ${formatDate(loanDate)}`,
  `담보제공일: ${formatDate(collateralDate)}`,
  `기간: ${Math.floor(daysDiff)}일 (30일 이내)`,
  `악의성 가능성이 있으니 확인이 필요합니다.`,
].join("\n");
```

선택지 2: 마크다운 지원 (react-markdown)

```tsx
// src/components/finding-card.tsx
import ReactMarkdown from "react-markdown";

export function FindingCard({ finding }: FindingCardProps) {
  return (
    <Card>
      <CardContent>
        {finding.description && (
          <div className="text-sm text-gray-700">
            <ReactMarkdown className="prose prose-sm">
              {finding.description}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

권장: 선택지 1 (plain text) - 간단함 + 성능 우선

---

### [MEDIUM] Issue #7: Logging - Finding Analysis Audit Trail

**ID**: ACTION-6.1-7
**Severity**: 🟡 MEDIUM
**Category**: Observability / Compliance
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 0.5 days

#### Problem Statement
`analyzeFindings()` 호출 시 console.log()로만 기록되고, 데이터베이스에 감사 로그가 저장되지 않습니다. Story 4.5 (Manual Classification Edit)에서 구현된 AuditLog 모델을 재사용해야 합니다.

#### Acceptance Criteria
- AC1: analyzeFindings 호출 시 AuditLog 생성
- AC2: 로깅 정보: userId, caseId, findingsCreated, analysisDuration
- AC3: Finding 생성 추적 가능 (분석 이력)

#### Implementation Plan

```typescript
// src/server/services/finding-service.ts
export async function analyzeFindings(params: {
  db: PrismaClient;
  caseId: string;
  userId: string;
}): Promise<AnalysisResult> {
  const { db, caseId, userId } = params;
  const startTime = Date.now();

  // ... 기존 로직

  const endTime = Date.now();
  const analysisDuration = endTime - startTime;

  // 감사 로그 생성 (Story 4.5에서 구현된 패턴)
  await db.auditLog.create({
    data: {
      entityType: "FINDING_ANALYSIS",
      action: "AUTO_IDENTIFY",
      entityId: caseId,
      userId,
      changes: JSON.stringify({
        findingsCreated: result.findingsCreated,
        analysisDuration,
        detectionMethods: [
          "PREFERENCE_REPAYMENT",
          "PRIORITY_REPAYMENT_VIOLATION",
          "COLLATERAL_ISSUES",
        ],
      }),
    },
  });

  console.log(
    `[Finding Service] Finding 분석 완료: ${findingsCreated}개 생성 (${analysisDuration}ms) by ${userId}`
  );

  return {
    findingsCreated,
    analysisDuration,
  };
}
```

---

### [MEDIUM] Issue #8: Type Safety - Finding relatedCreditorNames JSON Parsing

**ID**: ACTION-6.1-8
**Severity**: 🟡 MEDIUM
**Category**: Type Safety / Robustness
**Status**: ⏳ NOT STARTED
**Effort Estimate**: 0.5 days

#### Problem Statement
프론트엔드에서 `finding.relatedCreditorNames`를 JSON.parse()하는데 에러 처리가 부족합니다. 만약 저장된 JSON이 손상되면 crash가 발생합니다.

**Current Code**:
```tsx
{(() => {
  try {
    const creditors = JSON.parse(finding.relatedCreditorNames) as string[];
    return creditors.map((creditor, idx) => (
      <span key={idx}>{creditor}</span>
    ));
  } catch {
    return (
      <span className="text-xs text-gray-500">
        {finding.relatedCreditorNames}
      </span>
    );
  }
})()}
```

문제: catch 블록에서 파싱 실패한 JSON 문자열을 그대로 표시 → UI 깨짐

#### Acceptance Criteria
- AC1: Zod 스키마로 relatedCreditorNames 타입 검증
- AC2: 파싱 실패 시 empty array 또는 fallback
- AC3: 백엔드: 저장 전 유효성 검사

#### Implementation Plan

**Step 1: Zod 스키마 추가**

```typescript
// src/server/services/finding-service.ts
import { z } from "zod";

const FindingResultSchema = z.object({
  findingType: z.string(),
  title: z.string(),
  description: z.string().optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  relatedTransactionIds: z.array(z.string()),
  relatedCreditorNames: z.array(z.string()).optional(),
});

export async function analyzeFindings(params: {
  db: PrismaClient;
  caseId: string;
  userId: string;
}): Promise<AnalysisResult> {
  // ... 기존 코드

  // Finding.createMany 이전 검증
  const validatedFindings = deduplicatedFindings.map((finding) => {
    const validated = FindingResultSchema.parse(finding);
    return {
      ...validated,
      relatedCreditorNames: finding.relatedCreditorNames
        ? JSON.stringify(finding.relatedCreditorNames)
        : null,
    };
  });

  if (validatedFindings.length > 0) {
    const result = await db.finding.createMany({
      data: validatedFindings,
    });
    findingsCreated = result.count;
  }
}
```

**Step 2: 프론트엔드 헬퍼 함수**

```tsx
// src/lib/finding-parser.ts
export function parseCreditorNames(creditorNamesJson: string | null): string[] {
  if (!creditorNamesJson) return [];
  
  try {
    const parsed = JSON.parse(creditorNamesJson);
    // 배열 검증
    if (!Array.isArray(parsed)) {
      console.warn("relatedCreditorNames is not an array:", parsed);
      return [];
    }
    // 모든 요소가 문자열인지 확인
    const validated = parsed.filter((item) => typeof item === "string");
    return validated;
  } catch (error) {
    console.error("Failed to parse relatedCreditorNames:", error);
    return [];
  }
}

// src/components/finding-card.tsx
import { parseCreditorNames } from "~/lib/finding-parser";

export function FindingCard({ finding }: FindingCardProps) {
  const creditors = parseCreditorNames(finding.relatedCreditorNames);

  return (
    <Card>
      {creditors.length > 0 && (
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Users className="w-4 h-4" aria-hidden="true" />
            관련 채권자
          </div>
          <div className="flex flex-wrap gap-2">
            {creditors.map((creditor, idx) => (
              <span key={idx} className="inline-flex ... px-2 py-1">
                {creditor}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
```

**Step 3: 테스트**

```typescript
it("should safely parse malformed JSON creditor names", () => {
  const malformedJson = "not a valid json";
  const result = parseCreditorNames(malformedJson);
  expect(result).toEqual([]);
});

it("should filter non-string creditors", () => {
  const json = JSON.stringify(["creditor1", 123, "creditor2", null]);
  const result = parseCreditorNames(json);
  expect(result).toEqual(["creditor1", "creditor2"]);
});
```

---

## Summary Table

| # | Issue | Severity | Category | Effort | Status |
|---|-------|----------|----------|--------|--------|
| 1 | Duplicate Finding Logic - Missing Order | 🔴 CRITICAL | Logic | 1.5d | ⏳ |
| 2 | Transaction Query Performance | 🟠 HIGH | Performance | 1d | ⏳ |
| 3 | Error Handling - Null Checks | 🟠 HIGH | Robustness | 1d | ⏳ |
| 4 | Missing i18n Keys | 🟠 HIGH | UX | 0.5d | ⏳ |
| 5 | Test Coverage - Deduplication | 🟡 MEDIUM | Testing | 0.5d | ⏳ |
| 6 | Description Text Formatting | 🟡 MEDIUM | UX | 0.5d | ⏳ |
| 7 | Audit Logging | 🟡 MEDIUM | Observability | 0.5d | ⏳ |
| 8 | Type Safety - JSON Parsing | 🟡 MEDIUM | Type Safety | 0.5d | ⏳ |

**Total Effort**: 7 days (5-6 days with parallel execution)

**Critical Path**:
1. Issue #1 (1.5d) → Issue #2-4 (2-3d parallel) → Phase 2
2. Phase 1 must complete before merge
3. Phase 2 must complete before release
4. Phase 3 optional (next sprint)

---

## Next Steps

### Immediate (Today)
- [ ] Assign Issue #1 to developer (CRITICAL - Release blocker)
- [ ] Code review approval of deduplication logic
- [ ] Sprint planning for Phase 1 issues

### Phase 1 (1-2 days)
- [ ] Fix duplicate Finding logic (Issue #1)
- [ ] Add comprehensive deduplication tests
- [ ] Validate 30-second performance requirement

### Phase 2 (2-3 days - Pre-Release)
- [ ] Performance optimization (Issue #2)
- [ ] Error handling improvements (Issue #3)
- [ ] i18n implementation (Issue #4)

### Phase 3 (2-3 days - Post-Release Backlog)
- [ ] Integration tests (Issue #5)
- [ ] Text formatting (Issue #6)
- [ ] Audit logging (Issue #7)
- [ ] Type safety enhancements (Issue #8)

---

## Code Review Summary

**Overall Assessment**: ✅ **Functional Implementation with Critical Issues**

**Strengths**:
- ✅ Comprehensive Finding detection (3 patterns implemented)
- ✅ RBAC controls properly enforced
- ✅ Good component structure (FindingCard, FindingList)
- ✅ Parallel processing for 3 detection functions
- ✅ Test coverage for happy paths (627 lines of tests)

**Weaknesses**:
- 🔴 **CRITICAL**: Duplicate detection ignores transaction order
- 🟠 **HIGH**: N+1 filtering problem (3 detection functions × filtering)
- 🟠 **HIGH**: Insufficient null/error handling
- 🟠 **HIGH**: Missing i18n translations
- 🟡 **MEDIUM**: Edge case test coverage gaps

**Recommendation**: ✅ **APPROVE with Critical Issues Fix Required**

Merge only after Issue #1 (duplicate logic) is resolved. Issues #2-4 should be resolved before production release.
