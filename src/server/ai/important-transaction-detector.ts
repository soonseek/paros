/**
 * Important Transaction Detector Service
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * 기능:
 * - 키워드 기반 중요 거래 감지
 * - 중요 거래 유형 분류 (대출 실행, 변제, 담보, 압류)
 * - 매칭된 키워드 추출
 * - AI 분류 서비스와 통합 (Story 4.1)
 *
 * @example
 * const result = await detectImportantTransaction(memo);
 * console.log(result.isImportant); // true
 * console.log(result.type); // "LOAN_EXECUTION"
 */

import type {
  ImportantTransactionDetectionResult,
  TransactionInput,
} from "./types";
import {
  detectImportantTransactionType,
  extractMatchedKeywords,
} from "~/lib/constants/important-keywords";

/**
 * 단일 거래에서 중요 거래를 감지합니다.
 *
 * @param memo - 거래 메모/적요
 * @returns 중요 거래 감지 결과
 *
 * @example
 * const result = detectImportantTransaction("대출 실행 500만원");
 * // result.isImportant = true
 * // result.type = "LOAN_EXECUTION"
 * // result.matchedKeywords = ["대출 실행", "실행"]
 */
export function detectImportantTransaction(
  memo: string | null
): ImportantTransactionDetectionResult {
  // 메모가 없으면 중요 거래가 아님
  if (!memo || memo.trim().length === 0) {
    return {
      isImportant: false,
      type: null,
      matchedKeywords: [],
      confidence: 1.0, // 키워드 기반은 100% 신뢰도
    };
  }

  // 중요 거래 유형 감지
  const detectedType = detectImportantTransactionType(memo);

  // 중요 거래가 아니면
  if (!detectedType) {
    return {
      isImportant: false,
      type: null,
      matchedKeywords: [],
      confidence: 1.0,
    };
  }

  // 매칭된 키워드 추출
  const matchedKeywords = extractMatchedKeywords(memo);

  return {
    isImportant: true,
    type: detectedType,
    matchedKeywords,
    confidence: 1.0, // 키워드 기반은 100% 신뢰도
  };
}

/**
 * 다중 거래에서 중요 거래를 일괄 감지합니다.
 *
 * @param transactions - 거래 배열
 * @param onProgress - 진행률 콜백 (선택적)
 * @returns 중요 거래 감지 결과 Map
 *
 * @example
 * const transactions = [
 *   { id: "1", memo: "대출 실행 500만원", depositAmount: 5000000, withdrawalAmount: null },
 *   { id: "2", memo: "변제 100만원", depositAmount: null, withdrawalAmount: 1000000 }
 * ];
 *
 * const results = await detectImportantTransactions(transactions, (progress) => {
 *   console.log(`진행률: ${progress}%`);
 * });
 *
 * // Map<string, ImportantTransactionDetectionResult>
 * // results.get("1") = { isImportant: true, type: "LOAN_EXECUTION", ... }
 */
export function detectImportantTransactions(
  transactions: TransactionInput[],
  onProgress?: (current: number, total: number) => void
): Map<string, ImportantTransactionDetectionResult> {
  const results = new Map<string, ImportantTransactionDetectionResult>();
  let importantCount = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    if (!tx) {
      continue;
    }

    const result = detectImportantTransaction(tx.memo);
    results.set(tx.id, result);

    if (result.isImportant) {
      importantCount++;
    }

    // 진행률 콜백
    if (onProgress) {
      onProgress(i + 1, transactions.length);
    }
  }

  console.log(
    `[Important Transaction Detection] ${transactions.length}건 중 ${importantCount}건의 중요 거래 감지됨`
  );

  return results;
}

/**
 * 중요 거래 감지 결과를 Prisma JSON 형식으로 변환합니다.
 *
 * @param matchedKeywords - 매칭된 키워드 배열
 * @returns Prisma Json 형식 (JSON string)
 *
 * @example
 * const json = serializeMatchedKeywords(["대출 실행", "실행"]);
 * // '["대출 실행", "실행"]'
 */
export function serializeMatchedKeywords(
  matchedKeywords: string[]
): string | null {
  if (matchedKeywords.length === 0) {
    return null;
  }

  return JSON.stringify(matchedKeywords);
}

/**
 * Prisma Json 형식을 키워드 배열로 변환합니다.
 *
 * @param jsonStr - Prisma Json 필드 값
 * @returns 매칭된 키워드 배열
 *
 * @example
 * const keywords = deserializeMatchedKeywords('["대출 실행", "실행"]');
 * // ["대출 실행", "실행"]
 */
export function deserializeMatchedKeywords(
  jsonStr: string | null
): string[] {
  if (!jsonStr) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch (error) {
    console.error("[Important Transaction Detection] 키워드 역직렬화 실패:", error);
    return [];
  }
}

/**
 * AI 분류와 중요 거래 감지를 결합한 결과를 생성합니다.
 *
 * Story 4.3: Story 4.1의 AI 분류 서비스와 통합
 *
 * @param txId - 거래 ID
 * @param memo - 거래 메모
 * @param aiClassificationResult - AI 분류 결과 (Story 4.1)
 * @returns 결합된 분류 결과
 *
 * @example
 * const aiResult = await classifyTransaction(memo);
 * const combined = combineClassificationResults("tx-1", memo, aiResult);
 * // combined.category = "입금" (AI)
 * // combined.isImportant = true (Keyword)
 * // combined.type = "LOAN_EXECUTION" (Keyword)
 */
export function combineClassificationResults(
  txId: string,
  memo: string | null,
  aiClassificationResult: {
    category: string;
    subcategory: string;
    confidenceScore: number;
    reasoning?: string;
  }
): {
  txId: string;
  memo: string | null;
  category: string;
  subcategory: string;
  confidenceScore: number;
  reasoning?: string;
  isImportant: boolean;
  importantTransactionType: string | null;
  importantTransactionKeywords: string[] | null;
} {
  const importantResult = detectImportantTransaction(memo);

  return {
    txId,
    memo,
    category: aiClassificationResult.category,
    subcategory: aiClassificationResult.subcategory,
    confidenceScore: aiClassificationResult.confidenceScore,
    reasoning: aiClassificationResult.reasoning,
    isImportant: importantResult.isImportant,
    importantTransactionType: importantResult.type,
    importantTransactionKeywords: importantResult.matchedKeywords.length > 0
      ? importantResult.matchedKeywords
      : null,
  };
}

/**
 * 중요 거래 감지 통계를 계산합니다.
 *
 * @param results - 중요 거래 감지 결과 Map
 * @returns 통계 정보
 *
 * @example
 * const results = await detectImportantTransactions(transactions);
 * const stats = calculateDetectionStats(results);
 * // stats.total = 100
 * // stats.importantCount = 15
 * // stats.byType.LOAN_EXECUTION = 8
 */
export function calculateDetectionStats(
  results: Map<string, ImportantTransactionDetectionResult>
): {
  total: number;
  importantCount: number;
  byType: Record<string, number>;
} {
  const stats = {
    total: results.size,
    importantCount: 0,
    byType: {} as Record<string, number>,
  };

  for (const result of Array.from(results.values())) {
    if (result.isImportant) {
      stats.importantCount++;

      if (result.type) {
        stats.byType[result.type] = (stats.byType[result.type] ?? 0) + 1;
      }
    }
  }

  return stats;
}
