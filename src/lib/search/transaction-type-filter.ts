/**
 * Transaction Type Filter Utility (Story 8.2, Task 3: 거래 유형 필터 구현)
 *
 * 거래 유형(입금/출금/이체)으로 거래 필터링
 *
 * @module lib/search/transaction-type-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 거래 유형 enum (Story 8.2, AC3)
 */
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

/**
 * 거래 유형 판단 함수 (Story 8.2, Task 3.1)
 *
 * @param tx - 거래
 * @returns 거래 유형
 *
 * @example
 * ```ts
 * getTransactionType({ depositAmount: "1000", withdrawalAmount: null }); // "DEPOSIT"
 * getTransactionType({ depositAmount: null, withdrawalAmount: "500" }); // "WITHDRAWAL"
 * getTransactionType({ depositAmount: "1000", withdrawalAmount: "500" }); // "TRANSFER"
 * ```
 */
export function getTransactionType(tx: Transaction): TransactionType {
  const deposit = tx.depositAmount ? Number(tx.depositAmount) : 0;
  const withdrawal = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;

  if (deposit > 0 && withdrawal > 0) {
    return "TRANSFER";
  }
  if (deposit > 0) {
    return "DEPOSIT";
  }
  if (withdrawal > 0) {
    return "WITHDRAWAL";
  }
  // 둘 다 0이거나 null인 경우 (입출금 없는 거래)
  return "WITHDRAWAL"; // 기본값 (또는 별도 타입 정의 가능)
}

/**
 * 거래 유형 필터 함수 (Story 8.2, Task 3.1)
 *
 * @param transactions - 거래 목록
 * @param types - 필터링할 거래 유형 배열 (OR 조건)
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 입금만 필터링
 * const filtered = filterByTransactionType(transactions, ["DEPOSIT"]);
 *
 * // 입금 OR 출금 필터링 (OR 조건)
 * const filtered2 = filterByTransactionType(transactions, ["DEPOSIT", "WITHDRAWAL"]);
 *
 * // 전체 필터링
 * const filtered3 = filterByTransactionType(transactions, ["DEPOSIT", "WITHDRAWAL", "TRANSFER"]);
 * ```
 */
export function filterByTransactionType(
  transactions: Transaction[],
  types: TransactionType[]
): Transaction[] {
  // 빈 배열이면 전체 반환 (필터 미적용)
  if (!types || types.length === 0) {
    return transactions;
  }

  return transactions.filter((tx) => {
    const txType = getTransactionType(tx);
    return types.includes(txType);
  });
}

/**
 * 거래 유형 한글 라벨 반환 (UI용)
 *
 * @param type - 거래 유형
 * @returns 한글 라벨
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    DEPOSIT: "입금",
    WITHDRAWAL: "출금",
    TRANSFER: "이체",
  };
  return labels[type];
}
