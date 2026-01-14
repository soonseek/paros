/**
 * Transaction Nature Filter Utility (Story 8.2, Task 4: 거래 성격 필터 구현)
 *
 * 거래 성격(채권자/담보/우선변제)으로 거래 필터링
 *
 * @module lib/search/transaction-nature-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 거래 성격 enum (Epic 4 TransactionNature)
 */
export type TransactionNature = "CREDITOR" | "COLLATERAL" | "PRIORITY_REPAYMENT";

/**
 * 거래 성격 필터 함수 (Story 8.2, Task 4.1)
 *
 * @param transactions - 거래 목록
 * @param natures - 필터링할 거래 성격 배열 (OR 조건)
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 채권자 관련 거래만 필터링
 * const filtered = filterByTransactionNature(transactions, ["CREDITOR"]);
 *
 * // 채권자 OR 담보 필터링 (OR 조건)
 * const filtered2 = filterByTransactionNature(transactions, ["CREDITOR", "COLLATERAL"]);
 * ```
 */
export function filterByTransactionNature(
  transactions: Transaction[],
  natures: TransactionNature[]
): Transaction[] {
  // 빈 배열이면 전체 반환 (필터 미적용)
  if (!natures || natures.length === 0) {
    return transactions;
  }

  return transactions.filter((tx) => {
    // transactionNature가 있고 선택된 성격에 포함되면 필터링
    if (tx.transactionNature) {
      return natures.includes(tx.transactionNature as TransactionNature);
    }
    return false;
  });
}

/**
 * 거래 성격 한글 라벨 반환 (UI용)
 *
 * @param nature - 거래 성격
 * @returns 한글 라벨
 */
export function getTransactionNatureLabel(nature: TransactionNature): string {
  const labels: Record<TransactionNature, string> = {
    CREDITOR: "채권자",
    COLLATERAL: "담보",
    PRIORITY_REPAYMENT: "우선변제",
  };
  return labels[nature];
}
