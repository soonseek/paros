/**
 * Finding Generator Service
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * 기능:
 * - 중요 거래 감지 시 Finding 자동 생성
 * - Finding 유형별 제목/설명 생성
 * - 심각도(Severity) 자동 분류
 * - 중복 Finding 방지
 *
 * @example
 * await generateFindingsForTransactions(db, caseId, transactions);
 */

import type { PrismaClient } from "@prisma/client";
import type { ImportantTransactionDetectionResult } from "~/server/ai/types";
import { IMPORTANT_TRANSACTION_TYPE_LABELS } from "~/lib/constants/important-keywords";
import {
  isCriticalCombination,
  type TransactionNatureAnalysis,
} from "~/server/ai/transaction-nature-analyzer";

/**
 * Finding 유형 Enum
 */
export type FindingType =
  | "IMPORTANT_TRANSACTION"
  | "PRIORITY_REPAYMENT"
  | "COLLATERAL_CHANGE"
  | "SEIZURE"
  | "LARGE_AMOUNT"
  | "SUSPICIOUS_PATTERN";

/**
 * 심각도(Severity) Enum
 */
export type Severity = "INFO" | "WARNING" | "CRITICAL";

/**
 * Finding 생성 파라미터
 */
export interface FindingCreateParams {
  caseId: string;
  transactionId: string;
  findingType: FindingType;
  title: string;
  description?: string;
  severity: Severity;
}

/**
 * 중요 거래 유형별 Finding 생성 정보
 */
interface ImportantTransactionFindingInfo {
  findingType: FindingType;
  title: string;
  description: (memo: string, keywords: string[]) => string;
  severity: Severity;
}

/**
 * 중요 거래 유형별 Finding 생성 정보 맵
 */
const IMPORTANT_TRANSACTION_FINDING_MAP: Record<
  string,
  ImportantTransactionFindingInfo
> = {
  LOAN_EXECUTION: {
    findingType: "IMPORTANT_TRANSACTION",
    title: "대출 실행 감지",
    description: (memo, keywords) =>
      `거래 메모에서 대출 실행 관련 키워드가 감지되었습니다.\n\n메모: ${memo}\n\n매칭된 키워드: ${keywords.join(", ")}`,
    severity: "WARNING",
  },
  REPAYMENT: {
    findingType: "IMPORTANT_TRANSACTION",
    title: "변제/상환 감지",
    description: (memo, keywords) =>
      `거래 메모에서 변제/상환 관련 키워드가 감지되었습니다.\n\n메모: ${memo}\n\n매칭된 키워드: ${keywords.join(", ")}`,
    severity: "INFO",
  },
  COLLATERAL: {
    findingType: "COLLATERAL_CHANGE",
    title: "담보 제공/설정 감지",
    description: (memo, keywords) =>
      `거래 메모에서 담보 관련 키워드가 감지되었습니다.\n\n메모: ${memo}\n\n매칭된 키워드: ${keywords.join(", ")}`,
    severity: "WARNING",
  },
  SEIZURE: {
    findingType: "SEIZURE",
    title: "압류/가압류 감지",
    description: (memo, keywords) =>
      `거래 메모에서 압류 관련 키워드가 감지되었습니다.\n\n메모: ${memo}\n\n매칭된 키워드: ${keywords.join(", ")}`,
    severity: "CRITICAL",
  },
};

/**
 * 중요 거래 감지 결과를 Finding 생성 파라미터로 변환합니다.
 *
 * @param caseId - 사건 ID
 * @param transactionId - 거래 ID
 * @param memo - 거래 메모
 * @param detectionResult - 중요 거래 감지 결과
 * @returns Finding 생성 파라미터 또는 null
 *
 * @example
 * const params = convertDetectionToFindingParams(
 *   "case-1",
 *   "tx-1",
 *   "대출 실행 500만원",
 *   { isImportant: true, type: "LOAN_EXECUTION", matchedKeywords: ["대출 실행"], confidence: 1.0 }
 * );
 * // params.findingType = "IMPORTANT_TRANSACTION"
 * // params.title = "대출 실행 감지"
 * // params.severity = "WARNING"
 */
export function convertDetectionToFindingParams(
  caseId: string,
  transactionId: string,
  memo: string,
  detectionResult: ImportantTransactionDetectionResult
): FindingCreateParams | null {
  // 중요 거래가 아니면 null 반환
  if (!detectionResult.isImportant || !detectionResult.type) {
    return null;
  }

  const findingInfo = IMPORTANT_TRANSACTION_FINDING_MAP[detectionResult.type];

  if (!findingInfo) {
    console.error(
      `[Finding Generator] 알 수 없는 중요 거래 유형: ${detectionResult.type}`
    );
    return null;
  }

  return {
    caseId,
    transactionId,
    findingType: findingInfo.findingType,
    title: `${IMPORTANT_TRANSACTION_TYPE_LABELS[detectionResult.type]} - ${findingInfo.title}`,
    description: findingInfo.description(
      memo,
      detectionResult.matchedKeywords
    ),
    severity: findingInfo.severity,
  };
}

/**
 * 거래에 대한 Finding을 생성합니다.
 *
 * @param db - Prisma Client
 * @param params - Finding 생성 파라미터
 * @returns 생성된 Finding
 *
 * @example
 * const finding = await createFinding(db, {
 *   caseId: "case-1",
 *   transactionId: "tx-1",
 *   findingType: "IMPORTANT_TRANSACTION",
 *   title: "대출 실행 - 대출 실행 감지",
 *   description: "...",
 *   severity: "WARNING"
 * });
 */
export async function createFinding(
  db: PrismaClient,
  params: FindingCreateParams
) {
  // 중복 Finding 체크 (동일 transactionId + findingType)
  const existingFinding = await db.finding.findFirst({
    where: {
      transactionId: params.transactionId,
      findingType: params.findingType,
      isResolved: false,
    },
  });

  if (existingFinding) {
    console.log(
      `[Finding Generator] 이미 존재하는 Finding: ${existingFinding.id} (건너뜀)`
    );
    return existingFinding;
  }

  // Finding 생성
  const finding = await db.finding.create({
    data: {
      caseId: params.caseId,
      transactionId: params.transactionId,
      findingType: params.findingType,
      title: params.title,
      description: params.description,
      severity: params.severity,
    },
  });

  console.log(
    `[Finding Generator] Finding 생성됨: ${finding.id} (${finding.findingType})`
  );

  return finding;
}

/**
 * 다중 거래에 대한 Finding을 일괄 생성합니다.
 *
 * @param db - Prisma Client
 * @param caseId - 사건 ID
 * @param transactions - 거래 배열 (메모 포함)
 * @param detectionResults - 중요 거래 감지 결과 Map
 * @param onProgress - 진행률 콜백 (선택적)
 * @returns 생성된 Finding 배열
 *
 * @example
 * const transactions = [
 *   { id: "tx-1", memo: "대출 실행 500만원", depositAmount: 5000000, withdrawalAmount: null },
 *   { id: "tx-2", memo: "변제 100만원", depositAmount: null, withdrawalAmount: 1000000 }
 * ];
 *
 * const detectionResults = await detectImportantTransactions(transactions);
 * const findings = await generateFindingsForTransactions(
 *   db,
 *   "case-1",
 *   transactions,
 *   detectionResults
 * );
 */
export async function generateFindingsForTransactions(
  db: PrismaClient,
  caseId: string,
  transactions: Array<{
    id: string;
    memo: string | null;
  }>,
  detectionResults: Map<string, ImportantTransactionDetectionResult>,
  onProgress?: (current: number, total: number) => void | Promise<void>
) {
  const findings: Awaited<ReturnType<typeof createFinding>>[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    if (!tx) {
      continue;
    }

    const detectionResult = detectionResults.get(tx.id);

    // 중요 거래가 아니면 건너뜀
    if (!detectionResult || !detectionResult.isImportant || !tx.memo) {
      // 진행률 업데이트
      if (onProgress) {
        await onProgress(i + 1, transactions.length);
      }
      continue;
    }

    // Finding 생성 파라미터 변환
    const params = convertDetectionToFindingParams(
      caseId,
      tx.id,
      tx.memo,
      detectionResult
    );

    if (!params) {
      // 진행률 업데이트
      if (onProgress) {
        await onProgress(i + 1, transactions.length);
      }
      continue;
    }

    // Finding 생성
    const finding = await createFinding(db, params);
    findings.push(finding);

    // 진행률 업데이트
    if (onProgress) {
      await onProgress(i + 1, transactions.length);
    }
  }

  console.log(
    `[Finding Generator] ${transactions.length}건 중 ${findings.length}개의 Finding 생성됨`
  );

  return findings;
}

/**
 * Finding 생성 통계를 계산합니다.
 *
 * @param findings - 생성된 Finding 배열
 * @returns 통계 정보
 *
 * @example
 * const stats = calculateFindingStats(findings);
 * // stats.total = 15
 * // stats.byType.IMPORTANT_TRANSACTION = 10
 * // stats.bySeverity.CRITICAL = 3
 */
export function calculateFindingStats(findings: Array<{ findingType: string; severity: string }>) {
  return {
    total: findings.length,
    byType: findings.reduce((acc, finding) => {
      acc[finding.findingType] = (acc[finding.findingType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySeverity: findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

// ============================================================
// Story 4.4: 거래 성격 판단 - 우선변제 Finding 생성
// ============================================================

/**
 * 우선변제 관련 Finding 생성 정보
 */
const PRIORITY_REPAYMENT_FINDING_INFO = {
  findingType: "PRIORITY_REPAYMENT" as const,
  titleBase: "우선변제권 침해 가능성",
  description: (memo: string, keywords: string[], creditorName?: string) => {
    const creditorInfo = creditorName ? `\n\n채권자명: ${creditorName}` : "";
    return `거래 메모에서 우선변제 관련 키워드가 감지되었습니다. 우선변제권 침해 가능성이 있으니 확인이 필요합니다.${creditorInfo}\n\n메모: ${memo}\n\n매칭된 키워드: ${keywords.join(", ")}`;
  },
  severity: "WARNING" as const,
};

/**
 * 거래 성격 분석 결과를 Finding 생성 파라미터로 변환합니다.
 * Story 4.4: 우선변제 Finding 생성
 *
 * @param caseId - 사건 ID
 * @param transactionId - 거래 ID
 * @param memo - 거래 메모
 * @param natureAnalysis - 거래 성격 분석 결과
 * @returns Finding 생성 파라미터 또는 null
 *
 * @example
 * const params = convertNatureAnalysisToFindingParams(
 *   "case-1",
 *   "tx-1",
 *   "임차권+대항력 확정 보증금",
 *   { nature: "PRIORITY_REPAYMENT", confidenceScore: 1.0, matchedKeywords: ["임차권", "대항력"] }
 * );
 * // params.findingType = "PRIORITY_REPAYMENT"
 * // params.severity = "CRITICAL" (임차권+대항력 조합)
 */
export function convertNatureAnalysisToFindingParams(
  caseId: string,
  transactionId: string,
  memo: string,
  natureAnalysis: TransactionNatureAnalysis
): FindingCreateParams | null {
  // 우선변제 관련 거래만 Finding 생성
  if (natureAnalysis.nature !== "PRIORITY_REPAYMENT") {
    return null;
  }

  // CRITICAL 조합 확인 (임차권+대항력 등)
  // Story 4.4: isCriticalCombination 함수 재사용 (중복 제거)
  const isCritical = isCriticalCombination(natureAnalysis.matchedKeywords);

  return {
    caseId,
    transactionId,
    findingType: PRIORITY_REPAYMENT_FINDING_INFO.findingType,
    title: `${PRIORITY_REPAYMENT_FINDING_INFO.titleBase}${isCritical ? " (긴급)" : ""} - ${natureAnalysis.creditorName ?? "미상"}`,
    description: PRIORITY_REPAYMENT_FINDING_INFO.description(
      memo,
      natureAnalysis.matchedKeywords,
      natureAnalysis.creditorName
    ),
    severity: isCritical ? "CRITICAL" : "WARNING",
  };
}

