/**
 * Important Transaction Filter Utility (Story 8.2, Task 5: 중요 거래 필터 구현)
 *
 * 중요 거래 여부로 거래 필터링 (Epic 4.3)
 *
 * @module lib/search/important-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 중요 거래 필터 함수 (Story 8.2, Task 5.1)
 *
 * @param transactions - 거래 목록
 * @param isImportantOnly - 중요 거래만 보기 여부
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 중요 거래만 필터링
 * const filtered = filterByImportance(transactions, true);
 *
 * // 전체 거래 (필터 미적용)
 * const all = filterByImportance(transactions, false);
 * ```
 */
export function filterByImportance(
  transactions: Transaction[],
  isImportantOnly: boolean
): Transaction[] {
  // false이면 필터 미적용 (전체 반환)
  if (!isImportantOnly) {
    return transactions;
  }

  // true이면 중요 거래만 필터링 (Epic 4.3: importantTransaction = true)
  return transactions.filter((tx) => tx.importantTransaction === true);
}
