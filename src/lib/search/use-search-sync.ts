/**
 * Search URL Synchronization Hook (Story 8.2, Task 8.2: 클라이언트 URL 동기화)
 *
 * URL 파라미터와 검색 필터 상태 동기화
 *
 * @module lib/search/use-search-sync
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ExtendedSearchFilters } from "~/types/search";
import {
  filtersToUrlParams,
  urlParamsToFilters,
  filtersToQueryString,
} from "./url-params";

/**
 * URL 동기화 옵션 (Story 8.2, Task 8.2)
 */
export interface UseSearchSyncOptions {
  /** URL 업데이트 활성화 여부 (기본값: true) */
  enableUrlUpdate?: boolean;
  /** 디바운스 시간 (ms, 기본값: 300) */
  debounceMs?: number;
}

/**
 * URL 파라미터와 검색 필터 동기화 훅 (Story 8.2, Task 8.2)
 *
 * @param initialFilters - 초기 필터 상태
 * @param options - 동기화 옵션
 * @returns [filters, setFilters] 튜플
 *
 * @example
 * ```tsx
 * function TransactionSearchPage() {
 *   const [filters, setFilters] = useSearchSync({
 *     keyword: "",
 *     transactionType: ["DEPOSIT"],
 *   });
 *
 *   // 필터 변경 시 URL 자동 업데이트
 *   const handleFilterChange = (newFilters: ExtendedSearchFilters) => {
 *     setFilters(newFilters);
 *   };
 *
 *   return <FilterPanel filters={filters} onChange={handleFilterChange} />;
 * }
 * ```
 */
export function useSearchSync(
  initialFilters: ExtendedSearchFilters,
  options: UseSearchSyncOptions = {}
): [ExtendedSearchFilters, (filters: ExtendedSearchFilters) => void] {
  const { enableUrlUpdate = true, debounceMs = 300 } = options;

  // Next.js App Router의 searchParams 사용
  const searchParams = useSearchParams();

  // URL에서 초기 필터 로드
  const getInitialFiltersFromUrl = (): ExtendedSearchFilters => {
    if (typeof window === "undefined") {
      return initialFilters;
    }

    const params = new URLSearchParams(window.location.search);
    const urlFilters = urlParamsToFilters(params);

    // URL 파라미터가 있으면 우선 사용, 없으면 initialFilters 사용
    return Object.keys(urlFilters).length > 0 ? urlFilters : initialFilters;
  };

  const [filters, setFiltersState] = useState<ExtendedSearchFilters>(
    getInitialFiltersFromUrl()
  );

  // 디바운스 타이머
  let debounceTimer: NodeJS.Timeout | null = null;

  // URL 업데이트 함수
  const updateUrl = (newFilters: ExtendedSearchFilters) => {
    if (!enableUrlUpdate) return;

    if (typeof window === "undefined") return;

    const params = filtersToUrlParams(newFilters);
    const queryString = params.toString();

    // Next.js Router 사용 (pushState로 URL 업데이트)
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl
    );
  };

  // 필터 설정 함수 (디바운싱 포함)
  const setFilters = (newFilters: ExtendedSearchFilters) => {
    setFiltersState(newFilters);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      updateUrl(newFilters);
    }, debounceMs);
  };

  // 컴포넌트 마운트 시 URL에서 필터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlFilters = urlParamsToFilters(params);

    if (Object.keys(urlFilters).length > 0) {
      setFiltersState(urlFilters);
    }
  }, []);

  // 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return [filters, setFilters];
}

/**
 * URL 공유 링크 생성 함수 (Story 8.2, Task 8.2)
 *
 * @param filters - 검색 필터
 * @param baseUrl - 기본 URL (기본값: 현재 URL)
 * @returns 공유 가능한 전체 URL
 *
 * @example
 * ```tsx
 * const shareUrl = createShareableUrl(filters);
 *
 * <button onClick={() => navigator.clipboard.writeText(shareUrl)}>
 *   검색 링크 복사
 * </button>
 * ```
 */
export function createShareableUrl(
  filters: ExtendedSearchFilters,
  baseUrl?: string
): string {
  if (typeof window === "undefined") {
    return "";
  }

  const base = baseUrl || window.location.pathname;
  const queryString = filtersToQueryString(filters);

  return queryString ? `${base}?${queryString}` : base;
}

/**
 * 필터 리셋 함수 (Story 8.2, Task 8.2)
 *
 * @returns 빈 필터 객체
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useSearchSync(initialFilters);
 *
 * const handleReset = () => {
 *   setFilters(resetFilters());
 * };
 * ```
 */
export function resetFilters(): ExtendedSearchFilters {
  return {};
}
