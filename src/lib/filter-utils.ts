/**
 * Filter Utility Functions (Story 5.5: 추적 필터링)
 *
 * 자금 흐름 추적 결과 필터링을 위한 유틸리티 함수들
 *
 * @module lib/filter-utils
 */

import type { TransactionNature } from "@prisma/client";
import { z } from "zod";

/**
 * 자금 흐름 필터 상태 인터페이스 (Story 5.5, Task 1.2)
 */
export interface FundFlowFilters {
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

/**
 * Zod 스키마: 필터 입력값 검증 (Story 5.5, Task 1.2)
 */
export const fundFlowFiltersSchema = z.object({
  dateRange: z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .optional(),
  amountRange: z
    .object({
      min: z.coerce.number().nonnegative(),
      max: z.coerce.number().nonnegative(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  transactionNature: z.array(z.enum(["CREDITOR", "COLLATERAL", "PRIORITY_REPAYMENT", "GENERAL"])).optional(),
  importantOnly: z.boolean().optional(),
});

export type FundFlowFiltersInput = z.infer<typeof fundFlowFiltersSchema>;

/**
 * 날짜 범위 필터링 (Story 5.5, Task 2.1)
 *
 * MEDIUM #1: UTC 기반으로 정규화하여 시간대 처리 버그 수정
 *
 * @param transactions - 필터링할 거래 목록
 * @param dateRange - 날짜 범위 (start, end)
 * @returns 날짜 범위 내의 거래들
 */
export function filterTransactionsByDateRange<T extends { transactionDate: Date }>(
  transactions: T[],
  dateRange?: { start: Date; end: Date }
): T[] {
  if (!dateRange) return transactions;

  const { start, end } = dateRange;

  // MEDIUM #1: UTC 기반으로 정규화 (DB와 동일한 기준)
  const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999));

  return transactions.filter((tx) => {
    const txDate = new Date(tx.transactionDate);
    return txDate >= startDate && txDate <= endDate;
  });
}

/**
 * 금액 범위 필터링 (Story 5.5, Task 2.1)
 *
 * MEDIUM #2: Decimal 타입 안전 변환 처리
 *
 * 입금액 또는 출금액이 범위 내인 거래만 필터링
 *
 * @param transactions - 필터링할 거래 목록
 * @param amountRange - 금액 범위 (min, max)
 * @returns 금액 범위 내의 거래들
 */
export function filterTransactionsByAmountRange<
  T extends { depositAmount: number | null; withdrawalAmount: number | null }
>(transactions: T[], amountRange?: { min: number; max: number }): T[] {
  if (!amountRange) return transactions;

  const { min, max } = amountRange;

  return transactions.filter((tx) => {
    // MEDIUM #2: Decimal → number 안전 변환
    let amount = 0;
    if (tx.depositAmount !== null) {
      amount = typeof tx.depositAmount === 'number' ? tx.depositAmount : Number(tx.depositAmount);
    } else if (tx.withdrawalAmount !== null) {
      amount = typeof tx.withdrawalAmount === 'number' ? tx.withdrawalAmount : Number(tx.withdrawalAmount);
    }

    return amount >= min && amount <= max;
  });
}

/**
 * 태그 필터링 (Story 5.5, Task 2.1)
 *
 * 여러 태그는 OR 조건으로 적용 (태그1 OR 태그2)
 *
 * @param transactions - 필터링할 거래 목록
 * @param tags - 필터링할 태그 목록
 * @returns 해당 태그가 있는 거래들
 */
export function filterTransactionsByTags<T extends { tags: Array<{ tag: { name: string } }> }>(
  transactions: T[],
  tags?: string[]
): T[] {
  if (!tags || tags.length === 0) return transactions;

  const tagSet = new Set(tags);

  return transactions.filter((tx) =>
    tx.tags.some((tagRelation) => tagSet.has(tagRelation.tag.name))
  );
}

/**
 * 거래 성격 필터링 (Story 5.5, Task 2.1)
 *
 * @param transactions - 필터링할 거래 목록
 * @param natures - 필터링할 거래 성격 목록
 * @returns 해당 성격을 가진 거래들
 */
export function filterTransactionsByNature<T extends { transactionNature: TransactionNature | null }>(
  transactions: T[],
  natures?: TransactionNature[]
): T[] {
  if (!natures || natures.length === 0) return transactions;

  const natureSet = new Set(natures);

  return transactions.filter((tx) => tx.transactionNature !== null && natureSet.has(tx.transactionNature));
}

/**
 * 중요 거래 필터링 (Story 5.5, Task 2.1)
 *
 * @param transactions - 필터링할 거래 목록
 * @param importantOnly - 중요 거래만 필터링 여부
 * @returns 중요 거래들 또는 전체 거래
 */
export function filterImportantTransactions<T extends { importantTransaction: boolean | null }>(
  transactions: T[],
  importantOnly?: boolean
): T[] {
  if (!importantOnly) return transactions;

  return transactions.filter((tx) => tx.importantTransaction === true);
}

/**
 * 복합 필터 적용 (Story 5.5, Task 2.1)
 *
 * 모든 필터를 AND 조건으로 결합하여 적용
 *
 * @param transactions - 필터링할 거래 목록
 * @param filters - 필터 조합
 * @returns 모든 조건을 만족하는 거래들
 */
export function applyFilters<T extends {
  transactionDate: Date;
  depositAmount: number | null;
  withdrawalAmount: number | null;
  tags: Array<{ tag: { name: string } }>;
  transactionNature: TransactionNature | null;
  importantTransaction: boolean | null;
}>(
  transactions: T[],
  filters: FundFlowFilters
): T[] {
  let filtered = transactions;

  // AC5: 복합 필터 (AND 조건)
  filtered = filterTransactionsByDateRange(filtered, filters.dateRange);
  filtered = filterTransactionsByAmountRange(filtered, filters.amountRange);
  filtered = filterTransactionsByTags(filtered, filters.tags);
  filtered = filterTransactionsByNature(filtered, filters.transactionNature);
  filtered = filterImportantTransactions(filtered, filters.importantOnly);

  return filtered;
}
