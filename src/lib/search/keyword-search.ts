/**
 * Keyword Search Utility (Story 8.1, Task 2: 키워드 검색 구현)
 *
 * 메모 필드에서 키워드 검색
 *
 * @module lib/search/keyword-search
 */

import type { Transaction } from "~/types/search";

/**
 * 키워드 검색 함수 (Story 8.1, Task 2.1)
 *
 * @param transactions - 거래 목록
 * @param keyword - 검색 키워드
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * const filtered = filterByKeyword(transactions, "이자");
 * // 메모에 "이자"가 포함된 모든 거래 반환
 * ```
 */
export function filterByKeyword(
  transactions: Transaction[],
  keyword: string
): Transaction[] {
  // 빈 키워드 처리 (Task 2.3)
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    return transactions;
  }

  // 대소문자 구분 없이 검색 (AC1)
  const query = trimmedKeyword.toLowerCase();

  return transactions.filter((tx) => {
    const memo = tx.memo?.toLowerCase() ?? "";
    return memo.includes(query);
  });
}

/**
 * 키워드 강조 표시 함수 (Story 8.1, Task 2 - 추가 기능)
 *
 * 검색 키워드를 메모 텍스트에서 강조 표시
 *
 * @param text - 원본 텍스트
 * @param keyword - 검색 키워드
 * @returns 강조 표시된 HTML 문자열
 *
 * @example
 * ```ts
 * const highlighted = highlightKeyword("이자 지급", "이자");
 * // "<mark>이자</mark> 지급"
 * ```
 */
export function highlightKeyword(text: string, keyword: string): string {
  if (!keyword.trim()) {
    return text;
  }

  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}
