/**
 * Confidence Filter Utility (Story 8.2, Task 6: AI 신뢰도 범위 필터 구현)
 *
 * AI 신뢰도 범위로 거래 필터링
 *
 * @module lib/search/confidence-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 신뢰도 범위 인터페이스 (Story 8.2, Task 6.1)
 */
export interface ConfidenceRange {
  min?: number;
  max?: number;
}

/**
 * 신뢰도 범위 필터 함수 (Story 8.2, Task 6.1)
 *
 * @param transactions - 거래 목록
 * @param range - 신뢰도 범위
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 최소 0.5 ~ 최대 1.0 범위
 * const filtered = filterByConfidenceRange(transactions, { min: 0.5, max: 1.0 });
 *
 * // 최소 0.8 이상만
 * const filtered2 = filterByConfidenceRange(transactions, { min: 0.8 });
 *
 * // 최대 0.5 이하만
 * const filtered3 = filterByConfidenceRange(transactions, { max: 0.5 });
 * ```
 */
export function filterByConfidenceRange(
  transactions: Transaction[],
  range: ConfidenceRange
): Transaction[] {
  // 범위가 없으면 전체 반환
  if (range.min === undefined && range.max === undefined) {
    return transactions;
  }

  return transactions.filter((tx) => {
    // confidenceScore가 null이면 제외 (AC6: 미분류 거래 제외)
    if (tx.confidenceScore === null || tx.confidenceScore === undefined) {
      return false;
    }

    const confidence = Number(tx.confidenceScore);

    // 최소값 필터링
    if (range.min !== undefined && confidence < range.min) {
      return false;
    }

    // 최대값 필터링
    if (range.max !== undefined && confidence > range.max) {
      return false;
    }

    return true;
  });
}

/**
 * 신뢰도 범위 검증 함수 (Story 8.2, Task 6.2)
 *
 * @param range - 신뢰도 범위
 * @returns 유효한 범위인지 여부
 *
 * @example
 * ```ts
 * isValidConfidenceRange({ min: 0.5, max: 1.0 }); // true
 * isValidConfidenceRange({ min: 1.0, max: 0.5 }); // false (min > max)
 * isValidConfidenceRange({ min: -0.1 }); // false (음수)
 * isValidConfidenceRange({ max: 1.5 }); // false (1.0 초과)
 * ```
 */
export function isValidConfidenceRange(range: ConfidenceRange): boolean {
  const min = range.min ?? 0;
  const max = range.max ?? 1;

  // 음수 체크
  if (min < 0 || max < 0) {
    return false;
  }

  // 1.0 초과 체크
  if (min > 1 || max > 1) {
    return false;
  }

  // min > max 체크
  if (min > max) {
    return false;
  }

  return true;
}
