/**
 * Reset Filters Utility (Story 8.1, Task 8: 필터 초기화 기능 구현)
 *
 * 검색 필터 초기화
 *
 * @module lib/search/reset-filters
 */

import type { SearchFilters } from "~/types/search";

/**
 * 필터 초기화 함수 (Story 8.1, Task 8.1)
 *
 * 모든 필터 상태를 초기화하여 빈 필터 객체 반환
 *
 * @returns 초기화된 검색 필터
 *
 * @example
 * ```ts
 * const resetFilters = resetSearchFilters();
 * // { keyword: undefined, dateRange: undefined, amountRange: undefined, tags: undefined }
 *
 * // 검색 필터 상태 초기화
 * setFilters(resetFilters);
 * ```
 */
export function resetSearchFilters(): SearchFilters {
  return {
    keyword: undefined,
    dateRange: undefined,
    amountRange: undefined,
    tags: undefined,
  };
}

/**
 * 특정 필터만 초기화하는 함수 (Story 8.1, Task 8 - 추가)
 *
 * @param currentFilters - 현재 필터 상태
 * @param keysToReset - 초기화할 필터 키 배열
 * @returns 일부 필터가 초기화된 검색 필터
 *
 * @example
 * ```ts
 * const filters = {
 *   keyword: "이자",
 *   dateRange: { start: new Date("2024-01-01") },
 *   amountRange: { min: 1000000 },
 *   tags: ["중요"],
 * };
 *
 * // 키워드와 태그만 초기화
 * const reset = resetSpecificFilters(filters, ["keyword", "tags"]);
 * // { keyword: undefined, dateRange: { start: ... }, amountRange: { min: ... }, tags: undefined }
 * ```
 */
export function resetSpecificFilters(
  currentFilters: SearchFilters,
  keysToReset: (keyof SearchFilters)[]
): SearchFilters {
  const reset = { ...currentFilters };

  keysToReset.forEach((key) => {
    reset[key] = undefined;
  });

  return reset;
}

/**
 * 필터가 비어있는지 확인하는 함수 (Story 8.1, Task 8 - 추가)
 *
 * @param filters - 검색 필터
 * @returns 필터가 비어있는지 여부
 */
export function isFiltersEmpty(filters: SearchFilters): boolean {
  return (
    !filters.keyword &&
    !filters.dateRange?.start &&
    !filters.dateRange?.end &&
    filters.amountRange?.min === undefined &&
    filters.amountRange?.max === undefined &&
    (!filters.tags || filters.tags.length === 0)
  );
}
