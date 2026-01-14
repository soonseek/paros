/**
 * Amount Filter Utility (Story 8.1, Task 4: 금액 범위 검색 구현)
 *
 * 금액 범위로 거래 필터링
 *
 * @module lib/search/amount-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 금액 범위 인터페이스 (Story 8.1, Task 4.1)
 */
export interface AmountRange {
  min?: number;
  max?: number;
}

/**
 * 금액 범위 필터 함수 (Story 8.1, Task 4.1)
 *
 * @param transactions - 거래 목록
 * @param amountRange - 금액 범위
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 최소~최대 금액 사이
 * const filtered = filterByAmountRange(transactions, {
 *   min: 1000000,
 *   max: 5000000,
 * });
 *
 * // 최소금액만 (최소금액 이상 모든 거래)
 * const filteredMin = filterByAmountRange(transactions, {
 *   min: 1000000,
 * });
 *
 * // 최대금액만 (최대금액 이하 모든 거래)
 * const filteredMax = filterByAmountRange(transactions, {
 *   max: 5000000,
 * });
 * ```
 */
export function filterByAmountRange(
  transactions: Transaction[],
  amountRange: AmountRange
): Transaction[] {
  // 금액 범위가 없으면 전체 반환
  if (
    amountRange.min === undefined &&
    amountRange.max === undefined
  ) {
    return transactions;
  }

  return transactions.filter((tx) => {
    // 입금액 또는 출금액 중 하나라도 범위 내에 있으면 포함 (AC3)
    const depositAmount = tx.depositAmount ? Number(tx.depositAmount) : null;
    const withdrawalAmount = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : null;

    // 최소금액 필터링 (AC3: min 이상인 거래)
    if (amountRange.min !== undefined) {
      const meetsMinRequirement =
        (depositAmount !== null && depositAmount >= amountRange.min) ||
        (withdrawalAmount !== null && withdrawalAmount >= amountRange.min);

      if (!meetsMinRequirement) {
        return false;
      }
    }

    // 최대금액 필터링 (AC3: max 이하인 거래)
    if (amountRange.max !== undefined) {
      const meetsMaxRequirement =
        (depositAmount !== null && depositAmount <= amountRange.max) ||
        (withdrawalAmount !== null && withdrawalAmount <= amountRange.max);

      if (!meetsMaxRequirement) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 금액 문자열 파싱 함수 (Story 8.1, Task 4.2 - 추가)
 *
 * 천 단위 구분 기호(,) 제거하고 숫자로 변환
 *
 * @param amountStr - 금액 문자열 (예: "1,000,000")
 * @returns 파싱된 숫자 또는 null
 *
 * @example
 * ```ts
 * parseAmountString("1,000,000"); // 1000000
 * parseAmountString("invalid"); // null
 * ```
 */
export function parseAmountString(amountStr: string): number | null {
  // 천 단위 구분 기호 제거 (Task 4.2)
  const cleaned = amountStr.replace(/,/g, "");

  const parsed = Number.parseFloat(cleaned);

  // 숫자가 아니거나 음수이면 null 반환 (Task 4.2)
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * 금액 범위 검증 함수 (Story 8.1, Task 4.1 - 추가)
 *
 * @param amountRange - 금액 범위
 * @returns 유효한 금액 범위인지 여부
 */
export function isValidAmountRange(amountRange: AmountRange): boolean {
  if (
    amountRange.min !== undefined &&
    amountRange.max !== undefined
  ) {
    return amountRange.min <= amountRange.max;
  }
  return true;
}
