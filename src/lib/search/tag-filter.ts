/**
 * Tag Filter Utility (Story 8.1, Task 5: 태그 검색 구현)
 *
 * 태그로 거래 필터링 (다중 선택, OR 조건)
 *
 * @module lib/search/tag-filter
 */

import type { Transaction } from "~/types/search";

/**
 * 거래 태그 관계 인터페이스 (Prisma 스키마 기반)
 */
export interface TransactionTagRelation {
  tag: {
    name: string;
  };
}

/**
 * 태그가 포함된 거래 인터페이스 (Story 8.1, Task 5.1)
 */
export interface TransactionWithTags extends Transaction {
  tags?: TransactionTagRelation[];
}

/**
 * 태그 필터 함수 (Story 8.1, Task 5.1)
 *
 * @param transactions - 거래 목록
 * @param tags - 태그 이름 배열 (OR 조건)
 * @returns 필터링된 거래 목록
 *
 * @example
 * ```ts
 * // 태그로 필터링 (OR 조건: 선택한 태그 중 하나라도 있으면 표시)
 * const filtered = filterByTags(transactions, ["중요", "확인 필요"]);
 * // "중요" 또는 "확인 필요" 태그가 있는 모든 거래 반환
 * ```
 */
export function filterByTags<T extends TransactionWithTags>(
  transactions: T[],
  tags: string[]
): T[] {
  // 태그가 없으면 전체 반환
  if (!tags || tags.length === 0) {
    return transactions;
  }

  return transactions.filter((tx) => {
    // 태그가 없으면 제외
    if (!tx.tags || tx.tags.length === 0) {
      return false;
    }

    // OR 조건: 선택한 태그 중 하나라도 있으면 포함 (AC4)
    const txTagNames = tx.tags.map((t) => t.tag.name);
    const hasMatchingTag = tags.some((tag) => txTagNames.includes(tag));

    return hasMatchingTag;
  });
}

/**
 * 거래에서 고유 태그 목록 추출 (Story 8.1, Task 5.2)
 *
 * @param transactions - 거래 목록
 * @returns 고유 태그 이름 배열 (알파벳 순 정렬)
 *
 * @example
 * ```ts
 * const availableTags = extractUniqueTags(transactions);
 * // ["중요", "확인 필요", "증빙 자료"]
 * ```
 */
export function extractUniqueTags<T extends TransactionWithTags>(
  transactions: T[]
): string[] {
  const tagSet = new Set<string>();

  transactions.forEach((tx) => {
    tx.tags?.forEach((t) => {
      tagSet.add(t.tag.name);
    });
  });

  // 알파벳 순 정렬 (Task 5.2)
  return Array.from(tagSet).sort();
}

/**
 * 태그 이름 검증 함수 (Story 8.1, Task 5.1 - 추가)
 *
 * @param tagName - 태그 이름
 * @returns 유효한 태그 이름인지 여부
 */
export function isValidTagName(tagName: string): boolean {
  const trimmed = tagName.trim();
  // 빈 문자열 또는 100자 초과면 유효하지 않음
  return trimmed.length > 0 && trimmed.length <= 100;
}
