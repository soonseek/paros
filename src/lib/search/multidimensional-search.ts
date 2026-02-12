/**
 * Multidimensional Search Utility (Story 8.1: 기본 검색, Story 8.2: 복합 필터링)
 *
 * 모든 필터를 조합하여 다차원 검색 실행
 *
 * @module lib/search/multidimensional-search
 */

import { filterByKeyword } from "./keyword-search";
import { filterByDateRange } from "./date-filter";
import { filterByAmountRange } from "./amount-filter";
import { filterByTags } from "./tag-filter";
import type { SearchFilters, SearchResultMetadata, ExtendedSearchFilters, Transaction as BaseTransaction } from "~/types/search";

// Story 8.2: 추가 필터 함수들
import { filterByTransactionType } from "./transaction-type-filter";
import { filterByTransactionNature } from "./transaction-nature-filter";
import { filterByImportance } from "./important-filter";
import { filterByConfidenceRange } from "./confidence-filter";

/**
 * 거래 인터페이스 (Prisma Transaction 기반)
 */
export interface Transaction extends BaseTransaction {
  id: string;
  transactionDate: Date;
  depositAmount: string | null;
  withdrawalAmount: string | null;
  memo: string | null;
  tags?: Array<{
    tag: {
      name: string;
    };
  }>;
}

/**
 * 다차원 검색 함수 (Story 8.1, Task 6.1)
 *
 * 모든 필터를 순차적으로 적용 (AND 조건)
 *
 * @param transactions - 거래 목록
 * @param filters - 검색 필터
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * const filtered = applySearchFilters(transactions, {
 *   keyword: "이자",
 *   dateRange: { start: new Date("2024-01-01"), end: new Date("2024-12-31") },
 *   amountRange: { min: 1000000, max: 5000000 },
 *   tags: ["중요", "확인 필요"],
 * });
 * // 키워드 AND 날짜 AND 금액 AND 태그(OR 조건)로 필터링
 * ```
 */
export function applySearchFilters(
  transactions: Transaction[],
  filters: SearchFilters
): Transaction[] {
  let filtered: Transaction[] = transactions;

  // 키워드 검색 (Task 2)
  if (filters.keyword) {
    filtered = filterByKeyword(filtered, filters.keyword) as Transaction[];
  }

  // 날짜 범위 검색 (Task 3)
  if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
    filtered = filterByDateRange(filtered, filters.dateRange) as Transaction[];
  }

  // 금액 범위 검색 (Task 4)
  if (
    filters.amountRange &&
    (filters.amountRange.min !== undefined ||
      filters.amountRange.max !== undefined)
  ) {
    filtered = filterByAmountRange(filtered, filters.amountRange) as Transaction[];
  }

  // 태그 검색 (Task 5) - OR 조건
  if (filters.tags && filters.tags.length > 0) {
    filtered = filterByTags(filtered, filters.tags) as Transaction[];
  }

  return filtered;
}

/**
 * 다차원 검색 함수 (메타데이터 포함) (Story 8.1, Task 6.2, AC6)
 *
 * 검색 실행 시간과 NFR-003 준수 여부를 반환
 *
 * @param transactions - 거래 목록
 * @param filters - 검색 필터
 * @returns 필터링된 거래 목록과 메타데이터
 *
 * @example
 * ```ts
 * const { filteredTransactions, metadata } = applySearchFiltersWithMetadata(transactions, filters);
 *
 * console.log(`검색 결과: ${metadata.filteredCount}개`);
 * console.log(`검색 시간: ${metadata.searchTime}ms`);
 * console.log(`SLA 준수: ${metadata.withinSLA ? "예" : "아니오"}`);
 * ```
 */
export function applySearchFiltersWithMetadata(
  transactions: Transaction[],
  filters: SearchFilters
): {
  filteredTransactions: Transaction[];
  metadata: SearchResultMetadata;
} {
  const startTime = performance.now();

  // 필터링 실행
  const filteredTransactions = applySearchFilters(transactions, filters);

  const endTime = performance.now();
  const searchTime = endTime - startTime;

  // 메타데이터 생성 (AC6: 3초 이내 응답 확인)
  const metadata: SearchResultMetadata = {
    totalCount: transactions.length,
    filteredCount: filteredTransactions.length,
    searchTime,
    withinSLA: searchTime <= 3000, // NFR-003: 3초 이내 응답
  };

  return {
    filteredTransactions,
    metadata,
  };
}

/**
 * 필터 활성화 상태 확인 함수 (Story 8.1, Task 6 - 추가)
 *
 * @param filters - 검색 필터
 * @returns 필터가 하나라도 활성화되어 있는지 여부
 */
export function hasActiveFilters(filters: SearchFilters): boolean {
  return !!(
    filters.keyword ||
    (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) ||
    (filters.amountRange &&
      (filters.amountRange.min !== undefined ||
        filters.amountRange.max !== undefined)) ||
    (filters.tags && filters.tags.length > 0)
  );
}

/**
 * 확장 필터 활성화 상태 확인 함수 (Story 8.2, Task 7 - 추가)
 *
 * @param filters - 확장 검색 필터
 * @returns 필터가 하나라도 활성화되어 있는지 여부
 */
export function hasActiveExtendedFilters(filters: ExtendedSearchFilters): boolean {
  // Story 8.1 기본 필터 확인
  const hasBasicFilters = hasActiveFilters(filters);

  // Story 8.2 추가 필터 확인
  const hasExtendedFilters =
    (filters.transactionType && filters.transactionType.length > 0) ||
    (filters.transactionNature && filters.transactionNature.length > 0) ||
    filters.isImportantOnly ||
    (filters.confidenceRange &&
      (filters.confidenceRange.min !== undefined ||
        filters.confidenceRange.max !== undefined));

  return !!(hasBasicFilters || hasExtendedFilters);
}

/**
 * 확장 다차원 검색 함수 (Story 8.2, Task 7.1)
 *
 * Story 8.1 기본 4개 필터 + Story 8.2 추가 4개 필터를 순차적으로 적용 (AND 조건)
 *
 * @param transactions - 거래 목록
 * @param filters - 확장 검색 필터
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * const filtered = applyExtendedSearchFilters(transactions, {
 *   keyword: "이자",
 *   transactionType: ["DEPOSIT"],
 *   transactionNature: ["CREDITOR"],
 *   isImportantOnly: true,
 *   confidenceRange: { min: 0.8 },
 *   // ... 나머지 필터
 * });
 * // 키워드 AND 입금 AND 채권자 AND 중요 AND 신뢰도 0.8이상
 * ```
 */
export function applyExtendedSearchFilters(
  transactions: Transaction[],
  filters: ExtendedSearchFilters
): Transaction[] {
  let filtered = transactions;

  // Story 8.1: 기본 4개 필터 적용
  filtered = applySearchFilters(filtered, filters);

  // Story 8.2: 추가 필터 적용

  // 거래 유형 필터 (Task 3) - OR 조건
  if (filters.transactionType && filters.transactionType.length > 0) {
    filtered = filterByTransactionType(filtered, filters.transactionType);
  }

  // 거래 성격 필터 (Task 4) - OR 조건
  if (filters.transactionNature && filters.transactionNature.length > 0) {
    filtered = filterByTransactionNature(filtered, filters.transactionNature);
  }

  // 중요 거래 필터 (Task 5)
  if (filters.isImportantOnly) {
    filtered = filterByImportance(filtered, true);
  }

  // AI 신뢰도 범위 필터 (Task 6)
  if (
    filters.confidenceRange &&
    (filters.confidenceRange.min !== undefined ||
      filters.confidenceRange.max !== undefined)
  ) {
    filtered = filterByConfidenceRange(filtered, filters.confidenceRange);
  }

  return filtered;
}
