/**
 * Date Filter Utility (Story 8.1, Task 3: 날짜 범위 검색 구현)
 *
 * 날짜 범위로 거래 필터링
 *
 * @module lib/search/date-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 날짜 범위 인터페이스 (Story 8.1, Task 3.1)
 */
export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * 날짜 범위 필터 함수 (Story 8.1, Task 3.1)
 *
 * @param transactions - 거래 목록
 * @param dateRange - 날짜 범위
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 시작일~종료일 사이
 * const filtered = filterByDateRange(transactions, {
 *   start: new Date("2024-01-01"),
 *   end: new Date("2024-12-31"),
 * });
 *
 * // 시작일만 (시작일 이후 모든 거래)
 * const filteredFrom = filterByDateRange(transactions, {
 *   start: new Date("2024-01-01"),
 * });
 *
 * // 종료일만 (종료일 이전 모든 거래)
 * const filteredTo = filterByDateRange(transactions, {
 *   end: new Date("2024-12-31"),
 * });
 * ```
 */
export function filterByDateRange(
  transactions: Transaction[],
  dateRange: DateRange
): Transaction[] {
  // 날짜 범위가 없으면 전체 반환
  if (!dateRange.start && !dateRange.end) {
    return transactions;
  }

  return transactions.filter((tx) => {
    if (!tx.transactionDate) return false;
    const txDate = new Date(tx.transactionDate);

    // 시작일 필터링 (AC2: start 이후의 모든 거래)
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      // 시간을 00:00:00으로 설정하여 날짜만 비교 (Task 3.2)
      startDate.setHours(0, 0, 0, 0);
      const txDateOnly = new Date(txDate);
      txDateOnly.setHours(0, 0, 0, 0);

      if (txDateOnly < startDate) {
        return false;
      }
    }

    // 종료일 필터링 (AC2: end 이전의 모든 거래)
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      // 시간을 23:59:59로 설정하여 날짜만 비교 (Task 3.2)
      endDate.setHours(23, 59, 59, 999);
      const txDateOnly = new Date(txDate);
      txDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(endDate);
      endDateOnly.setHours(0, 0, 0, 0);

      if (txDateOnly > endDateOnly) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 날짜 범위 검증 함수 (Story 8.1, Task 3.1 - 추가)
 *
 * @param dateRange - 날짜 범위
 * @returns 유효한 날짜 범위인지 여부
 */
export function isValidDateRange(dateRange: DateRange): boolean {
  if (dateRange.start && dateRange.end) {
    return dateRange.start <= dateRange.end;
  }
  return true;
}
