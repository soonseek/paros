/**
 * Finding Service (Story 6.1: 자동 발견사항 식별)
 *
 * 발견사항 자동 식별 서비스 - 선의성/악의성, 우선변제권 침해, 담보권 문제 감지
 *
 * @module server/services/finding-service
 */

import { PrismaClient } from "@prisma/client";
import { normalizeCreditorName } from "./creditor-service";

// ============================================================================
// Constants (성능 및 설정 관련 상수)
// ============================================================================

/**
 * 선의성/악의성 판단 기간 (일)
 */
const PREFERENCE_REPAYMENT_DAYS_THRESHOLD = 30;

/**
 * 금액 유사성 허용 오차 (백분율)
 */
const AMOUNT_SIMILARITY_THRESHOLD = 0.2;

// ============================================================================
// Performance Helper Functions (HIGH #2 Fix: N+1 Query Optimization)
// ============================================================================

/**
 * Transaction 인덱스 인터페이스
 *
 * 단일 순회로 생성된 트랜잭션 필터링 인덱스
 */

/**
 * Decimal to Number 안전 변환 헬퍼 (HIGH #3 Fix)
 *
 * Prisma Decimal 타입을 안전하게 number로 변환합니다.
 * null/undefined 체크와 NaN 방지를 포함합니다.
 *
 * @param amount - Prisma Decimal 객체 ({ toNumber(): number } | null)
 * @returns number (null인 경우 0, 변환 실패 시 0)
 */
function safeDecimalToNumber(
  amount: { toNumber(): number } | null
): number {
  if (!amount) {
    return 0;
  }

  try {
    const num = amount.toNumber();
    // NaN 체크 (Number.isNaN은 전역 isNaN보다 엄격함)
    if (Number.isNaN(num)) {
      return 0;
    }
    return num;
  } catch (error) {
    console.error("[Finding Service] Decimal 변환 실패:", error);
    return 0;
  }
}
interface TransactionIndex {
  generalTransactions: Transaction[];
  collateralTransactions: Transaction[];
  priorityRepurchaseTransactions: Transaction[];
  transactionsByNature: Map<string, Transaction[]>;
  transactionsByCreditor: Map<string, Transaction[]>;
  transactionsByMemo: Map<string, Transaction[]>;
}

/**
 * Transaction 인덱싱 함수 (HIGH #2 Fix)
 *
 * 단일 순회로 모든 필터링 기준에 따른 트랜잭션 인덱스를 생성합니다.
 * 이를 통해 각 감지 함수에서 중복 순회를 방지하고 O(n) 성능을 보장합니다.
 *
 * @param transactions - 트랜잭션 배열
 * @returns TransactionIndex (모든 필터링 기준에 따른 인덱스)
 */
function indexTransactions(transactions: Transaction[]): TransactionIndex {
  const generalTransactions: Transaction[] = [];
  const collateralTransactions: Transaction[] = [];
  const priorityRepurchaseTransactions: Transaction[] = [];
  const transactionsByNature = new Map<string, Transaction[]>();
  const transactionsByCreditor = new Map<string, Transaction[]>();
  const transactionsByMemo = new Map<string, Transaction[]>();

  // 단일 순회로 모든 인덱스 생성 (O(n))
  for (const tx of transactions) {
    // 1. transactionNature 기반 인덱싱
    if (!transactionsByNature.has(tx.transactionNature || "NULL")) {
      transactionsByNature.set(tx.transactionNature || "NULL", []);
    }
    transactionsByNature.get(tx.transactionNature || "NULL")!.push(tx);

    // 2. 거래 유형별 분류
    if (tx.transactionNature === "GENERAL") {
      generalTransactions.push(tx);
    } else if (tx.transactionNature === "COLLATERAL") {
      collateralTransactions.push(tx);
    } else if (tx.transactionNature === "PRIORITY_REPAYMENT") {
      priorityRepurchaseTransactions.push(tx);
    }

    // 3. 채권자명 기반 인덱싱
    if (tx.creditorName) {
      if (!transactionsByCreditor.has(tx.creditorName)) {
        transactionsByCreditor.set(tx.creditorName, []);
      }
      transactionsByCreditor.get(tx.creditorName)!.push(tx);
    }

    // 4. memo 기반 인덱싱
    if (tx.memo) {
      if (!transactionsByMemo.has(tx.memo)) {
        transactionsByMemo.set(tx.memo, []);
      }
      transactionsByMemo.get(tx.memo)!.push(tx);
    }
  }

  return {
    generalTransactions,
    collateralTransactions,
    priorityRepurchaseTransactions,
    transactionsByNature,
    transactionsByCreditor,
    transactionsByMemo,
  };
}

/**
 * Finding 유형 Enum
 */
export enum FindingType {
  PREFERENCE_REPAYMENT = "PREFERENCE_REPAYMENT",
  PRIORITY_REPAYMENT_VIOLATION = "PRIORITY_REPAYMENT_VIOLATION",
  COLLATERAL_TIMING_ISSUE = "COLLATERAL_TIMING_ISSUE",
  COLLATERAL_DUPLICATE = "COLLATERAL_DUPLICATE",
  COLLATERAL_DISCHARGE = "COLLATERAL_DISCHARGE",
}

/**
 * Finding 심각도 Enum
 */
export enum FindingSeverity {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  INFO = "INFO",
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Finding 결과 인터페이스
 */
export interface FindingResult {
  findingType: string;
  title: string;
  description?: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  relatedTransactionIds: string[];
  relatedCreditorNames?: string[];
}

/**
 * Finding 분석 결과 인터페이스
 */
export interface AnalysisResult {
  findingsCreated: number;
  analysisDuration: number;
}

/**
 * Transaction 인터페이스 (Prisma Transaction에서 필요한 필드만 추출)
 */
interface Transaction {
  id: string;
  transactionDate: Date;
  depositAmount: { toNumber(): number } | null;
  withdrawalAmount: { toNumber(): number } | null;
  transactionNature: string | null;
  creditorName: string | null;
  collateralType: string | null;
  memo: string | null;
}

/**
 * 선의성/악의성 감지 (AC1)
 *
 * 대출 실행 후 30일 이내 담보제공 패턴을 감지합니다.
 *
 * @param params - 분석 파라미터
 * @returns Finding 결과 배열
 */
export async function detectPreferenceRepayment(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  // HIGH #2 Fix: 사전 인덱싱 활용 (다중 순회 방지)
  const index = indexTransactions(transactions);

  // 일반 거래(GENERAL) 중 대출 실행 패턴 찾기 (큰 금액 출금)
  // HIGH #3 Fix: safeDecimalToNumber() 사용하여 null 체크
  const loanExecutions = index.generalTransactions.filter(
    (tx) => safeDecimalToNumber(tx.withdrawalAmount) > 0
  );

  // 담보 관련 거래(COLLATERAL) 찾기
  const collateralTx = index.collateralTransactions.filter(
    (tx) => safeDecimalToNumber(tx.depositAmount) > 0
  );

  // 대출 실행 후 30일 이내 담보제공 패턴 매칭
  for (const loan of loanExecutions) {
    const loanAmount = safeDecimalToNumber(loan.withdrawalAmount);
    const loanDate = loan.transactionDate;

    // HIGH #3 Fix: Zero division 방지 - loanAmount가 0인 경우 스킵
    if (loanAmount === 0) {
      continue;
    }

    for (const collateral of collateralTx) {
      const collateralAmount = safeDecimalToNumber(collateral.depositAmount);
      const collateralDate = collateral.transactionDate;

      // 날짜 차이 계산 (밀리초 → 일)
      const daysDiff =
        (collateralDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24);

      // 기간 이내 && 금액 유사성 검증 (상수 활용)
      // HIGH #3 Fix: loanAmount로 나누기 전 0 체크 완료 (위에서 continue)
      if (
        daysDiff > 0 &&
        daysDiff <= PREFERENCE_REPAYMENT_DAYS_THRESHOLD &&
        Math.abs(collateralAmount - loanAmount) / loanAmount <=
          AMOUNT_SIMILARITY_THRESHOLD
      ) {
        findings.push({
          findingType: FindingType.PREFERENCE_REPAYMENT,
          title: "악의성 의심: 대출 후 짧은 기간 내 담보제공",
          description: `대출 실행일(${formatDate(loanDate)})로부터 ${Math.floor(
            daysDiff
          )}일 이내에 담보를 제공하여 악의성이 의심됩니다.`,
          severity: FindingSeverity.CRITICAL,
          relatedTransactionIds: [loan.id, collateral.id],
          relatedCreditorNames: collateral.creditorName
            ? [normalizeCreditorName(collateral.creditorName)]
            : undefined,
        });
      }
    }
  }

  return findings;
}

/**
 * 우선변제권 침해 감지 (AC2)
 *
 * 일반 채권자를 우선변제권 채권자보다 먼저 변제하는 패턴을 감지합니다.
 *
 * @param params - 분석 파라미터
 * @returns Finding 결과 배열
 */
export async function detectPriorityRepaymentViolation(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  // HIGH #2 Fix: 사전 인덱싱 활용 (다중 순회 방지)
  const index = indexTransactions(transactions);

  // 날짜 기반 정렬 (단일 정렬만 필요 - 인덱스 활용으로 O(n log n) 최적화)
  const priorityRepurchases = [...index.priorityRepurchaseTransactions].sort(
    (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
  );

  // 일반 채권자 거래 (이미 인덱싱됨)
  const generalRepurchases = index.generalTransactions.filter(
    (tx) => tx.creditorName
  );

  // 각 우선변제권 채권자별로 일반 채권자 변제 패턴 감지
  for (const priority of priorityRepurchases) {
    // 해당 우선변제권보다 먼저 변제된 일반 채권자들 찾기
    const earlierGenerals = generalRepurchases.filter(
      (general) => general.transactionDate < priority.transactionDate
    );

    if (earlierGenerals.length > 0) {
      // 모든 관련 거래 ID 수집
      const relatedTransactionIds = [
        ...earlierGenerals.map((g) => g.id),
        priority.id,
      ];

      // 모든 관련 채권자명 수집 (Task 7.5: 정규화 적용)
      const relatedCreditorNames = [
        ...earlierGenerals.map((g) => normalizeCreditorName(g.creditorName!)),
        priority.creditorName
          ? normalizeCreditorName(priority.creditorName)
          : "알 수 없음",
      ];

      findings.push({
        findingType: FindingType.PRIORITY_REPAYMENT_VIOLATION,
        title: "우선변제권 침해 가능성",
        description: `${earlierGenerals.length}명의 일반 채권자(${earlierGenerals
          .map((g) => g.creditorName)
          .join(", ")})를 우선변제권 채권자(${priority.creditorName})보다 먼저 변제하였습니다.`,
        severity: FindingSeverity.CRITICAL,
        relatedTransactionIds,
        relatedCreditorNames,
      });
    }
  }

  return findings;
}

/**
 * 담보권 문제 감지 (AC3)
 *
 * 담보권 설정 시점, 중복 설정, 소멸 관련 이슈를 감지합니다.
 *
 * @param params - 분석 파라미터
 * @returns Finding 결과 배열
 */
export async function detectCollateralIssues(params: {
  db: PrismaClient;
  caseId: string;
  transactions: Transaction[];
}): Promise<FindingResult[]> {
  const { transactions } = params;
  const findings: FindingResult[] = [];

  // HIGH #2 Fix: 사전 인덱싱 활용 (다중 순회 방지)
  const index = indexTransactions(transactions);

  // 1. 대출 실행 전 담보제공 감지 (WARNING)
  const collateralTx = index.collateralTransactions;
  const generalTx = index.generalTransactions;

  for (const collateral of collateralTx) {
    for (const general of generalTx) {
      // 담보제공이 대출 실행보다 먼저 발생
      if (
        collateral.transactionDate < general.transactionDate &&
        collateral.creditorName === general.creditorName
      ) {
        findings.push({
          findingType: FindingType.COLLATERAL_TIMING_ISSUE,
          title: "담보권 설정 시점 이슈",
          description: `대출 실행 이전에 담보를 제공하였습니다.`,
          severity: FindingSeverity.WARNING,
          relatedTransactionIds: [collateral.id, general.id],
          relatedCreditorNames: collateral.creditorName
            ? [normalizeCreditorName(collateral.creditorName)]
            : undefined,
        });
      }
    }
  }

  // 2. 동일 담보물 중복 설정 감지 (WARNING)
  // HIGH #2 Fix: 사전 인덱싱된 transactionsByMemo 활용 (이미 O(n)으로 생성됨)
  for (const [memo, txList] of Array.from(index.transactionsByMemo.entries())) {
    if (txList.length > 1) {
      // 동일 memo를 가진 담보 거래가 2개 이상
      findings.push({
        findingType: FindingType.COLLATERAL_DUPLICATE,
        title: "동일 담보물 중복 설정 의심",
        description: `동일한 담보물(${memo})에 대해 중복 설정이 의심됩니다.`,
        severity: FindingSeverity.WARNING,
        relatedTransactionIds: txList.map((tx) => tx.id),
      });
    }
  }

  // 3. 담보권 해지 후 변제 확인 안 됨 (INFO)
  for (const tx of collateralTx) {
    if (
      tx.memo?.includes("해지") ||
      tx.memo?.includes("소멸") ||
      tx.memo?.includes("말소")
    ) {
      // 담보권 해지 거래 발견
      findings.push({
        findingType: FindingType.COLLATERAL_DISCHARGE,
        title: "담보권 해지 확인",
        description: `담보권이 해지되었습니다. 변제 완료 여부를 확인하십시오.`,
        severity: FindingSeverity.INFO,
        relatedTransactionIds: [tx.id],
        relatedCreditorNames: tx.creditorName
          ? [normalizeCreditorName(tx.creditorName)]
          : undefined,
      });
    }
  }

  return findings;
}

/**
 * 중복 Finding 방지 (AC4)
 *
 * caseId + findingType + relatedTransactionIds 조합으로 기존 Finding을 검사하여 중복을 방지합니다.
 *
 * @param params - 분석 파라미터
 * @returns 중복이 제거된 Finding 배열
 */
export async function deduplicateFindings(params: {
  db: PrismaClient;
  caseId: string;
  findings: FindingResult[];
}): Promise<FindingResult[]> {
  const { db, caseId, findings } = params;

  // 중복 제거된 Finding 배열
  const deduplicated: FindingResult[] = [];

  for (const finding of findings) {
    // 기존 Finding 조회 (caseId + findingType 조합)
    const existing = await db.finding.findMany({
      where: {
        caseId,
        findingType: finding.findingType,
      },
      select: {
        id: true,
        relatedTransactionIds: true,
      },
    });

    // relatedTransactionIds 배열 비교 (순서 고려)
    // CRITICAL #1 Fix: JSON.stringify로 직접 비교하여 순서를 보존
    const isDuplicate = existing.some((ex) => {
      const existingIds = JSON.stringify(ex.relatedTransactionIds);
      const newIds = JSON.stringify(finding.relatedTransactionIds);
      return existingIds === newIds;
    });

    if (!isDuplicate) {
      deduplicated.push(finding);
    }
  }

  return deduplicated;
}

/**
 * Finding 메인 분석 함수 (AC4)
 *
 * 사건의 모든 거래를 분석하여 Finding 레코드를 생성합니다.
 *
 * @param params - 분석 파라미터
 * @returns 분석 결과 (생성된 Finding 개수, 소요 시간)
 */
export async function analyzeFindings(params: {
  db: PrismaClient;
  caseId: string;
  userId: string;
}): Promise<AnalysisResult> {
  const { db, caseId, userId } = params;
  const startTime = Date.now();

  // 1. 사건의 모든 거래 조회 (TransactionNature 기반 분류)
  // Task 6.1: 쿼리 최적화
  // - select로 필요한 필드만 조회 (불필요한 필드 제외)
  // - 인덱스 활용: transactionDate, transactionNature, depositAmount
  // - TransactionNature 미포함 거래 필터링 (Epic 4에서 분류된 거래만 분석)
  const transactions = await db.transaction.findMany({
    where: {
      caseId,
      transactionNature: { not: null }, // Epic 4에서 분류된 거래만 분석
    },
    select: {
      // 필수 필드만 선택 (Task 6.1: select 최적화)
      id: true,
      transactionDate: true,
      depositAmount: true,
      withdrawalAmount: true,
      transactionNature: true,
      creditorName: true,
      collateralType: true,
      memo: true,
      // 불필요한 필드 제외: version, rawMetadata, AI 분류 관련 필드 등
    },
  });

  // 2. 3가지 감지 함수 병렬 실행 (Task 6.2: 병렬 처리)
  // Promise.all로 3가지 감지 함수 동시 실행 → 분석 시간 단축
  const [preferenceFindings, priorityFindings, collateralFindings] =
    await Promise.all([
      detectPreferenceRepayment({ db, caseId, transactions }),
      detectPriorityRepaymentViolation({ db, caseId, transactions }),
      detectCollateralIssues({ db, caseId, transactions }),
    ]);

  // 3. 모든 Finding 병합
  const allFindings = [
    ...preferenceFindings,
    ...priorityFindings,
    ...collateralFindings,
  ];

  // 4. 중복 방지
  const deduplicatedFindings = await deduplicateFindings({
    db,
    caseId,
    findings: allFindings,
  });

  // 5. Finding 일괄 생성 (Task 6.2: Finding.createMany)
  // 단일 DB 트랜잭션으로 일괄 생성 → N+1 쿼리 문제 방지
  let findingsCreated = 0;
  if (deduplicatedFindings.length > 0) {
    const result = await db.finding.createMany({
      data: deduplicatedFindings.map((finding) => ({
        caseId,
        findingType: finding.findingType,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        relatedTransactionIds: finding.relatedTransactionIds,
        // JSON.stringify: 배열 → JSON 문자열 변환 (Prisma String 필드)
        relatedCreditorNames: finding.relatedCreditorNames
          ? JSON.stringify(finding.relatedCreditorNames)
          : null,
      })),
    });

    findingsCreated = result.count;
  }

  const endTime = Date.now();
  const analysisDuration = endTime - startTime;

  // Task 6.2: 성능 모니터링 (30초 경고 로그)
  if (analysisDuration > 30000) {
    console.warn(
      `[Finding Service] analyzeFindings 성능 경고: ${analysisDuration}ms (30초 초과) - caseId: ${caseId}`
    );
  }

  return {
    findingsCreated,
    analysisDuration,
  };
}

/**
 * 날짜 포맷 헬퍼 함수
 *
 * @param date - 날짜 객체
 * @returns "yyyy-mm-dd" 형식 문자열
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
