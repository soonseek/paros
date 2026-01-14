/**
 * URL Parameter Conversion Utilities (Story 8.2, Task 8: URL 파라미터 동기화)
 *
 * ExtendedSearchFilters와 URL 쿼리 파라미터 간 변환
 *
 * @module lib/search/url-params
 */

import type { ExtendedSearchFilters } from "~/types/search";
import type { TransactionType, TransactionNature } from "~/types/search";

/**
 * URL 파라미터 키 상수 (Story 8.2, Task 8.1)
 */
export const URL_PARAM_KEYS = {
  KEYWORD: "keyword",
  START_DATE: "startDate",
  END_DATE: "endDate",
  AMOUNT_MIN: "amountMin",
  AMOUNT_MAX: "amountMax",
  TAGS: "tags",
  TRANSACTION_TYPE: "transactionType",
  TRANSACTION_NATURE: "transactionNature",
  IMPORTANT_ONLY: "importantOnly",
  CONFIDENCE_MIN: "confidenceMin",
  CONFIDENCE_MAX: "confidenceMax",
} as const;

/**
 * 필터를 URL 쿼리 파라미터로 변환 (Story 8.2, Task 8.1)
 *
 * @param filters - 확장 검색 필터
 * @returns URLSearchParams 객체
 *
 * @example
 * ```ts
 * const params = filtersToUrlParams({
 *   keyword: "이자",
 *   transactionType: ["DEPOSIT"],
 *   amountRange: { min: 1000000 },
 * });
 * // ?keyword=이자&transactionType=DEPOSIT&amountMin=1000000
 * ```
 */
export function filtersToUrlParams(filters: ExtendedSearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  // 키워드
  if (filters.keyword) {
    params.set(URL_PARAM_KEYS.KEYWORD, filters.keyword);
  }

  // 날짜 범위
  if (filters.dateRange?.start) {
    params.set(URL_PARAM_KEYS.START_DATE, filters.dateRange.start.toISOString());
  }
  if (filters.dateRange?.end) {
    params.set(URL_PARAM_KEYS.END_DATE, filters.dateRange.end.toISOString());
  }

  // 금액 범위
  if (filters.amountRange?.min !== undefined) {
    params.set(URL_PARAM_KEYS.AMOUNT_MIN, filters.amountRange.min.toString());
  }
  if (filters.amountRange?.max !== undefined) {
    params.set(URL_PARAM_KEYS.AMOUNT_MAX, filters.amountRange.max.toString());
  }

  // 태그 (다중 선택: 쉼표로 구분)
  if (filters.tags && filters.tags.length > 0) {
    params.set(URL_PARAM_KEYS.TAGS, filters.tags.join(","));
  }

  // 거래 유형 (다중 선택: 쉼표로 구분)
  if (filters.transactionType && filters.transactionType.length > 0) {
    params.set(URL_PARAM_KEYS.TRANSACTION_TYPE, filters.transactionType.join(","));
  }

  // 거래 성격 (다중 선택: 쉼표로 구분)
  if (filters.transactionNature && filters.transactionNature.length > 0) {
    params.set(URL_PARAM_KEYS.TRANSACTION_NATURE, filters.transactionNature.join(","));
  }

  // 중요 거래만
  if (filters.isImportantOnly) {
    params.set(URL_PARAM_KEYS.IMPORTANT_ONLY, "true");
  }

  // 신뢰도 범위
  if (filters.confidenceRange?.min !== undefined) {
    params.set(URL_PARAM_KEYS.CONFIDENCE_MIN, filters.confidenceRange.min.toString());
  }
  if (filters.confidenceRange?.max !== undefined) {
    params.set(URL_PARAM_KEYS.CONFIDENCE_MAX, filters.confidenceRange.max.toString());
  }

  return params;
}

/**
 * URL 쿼리 파라미터를 필터로 변환 (Story 8.2, Task 8.1)
 *
 * @param params - URLSearchParams 객체
 * @returns ExtendedSearchFilters 객체
 *
 * @example
 * ```ts
 * const urlParams = new URLSearchParams(window.location.search);
 * const filters = urlParamsToFilters(urlParams);
 * ```
 */
export function urlParamsToFilters(params: URLSearchParams): ExtendedSearchFilters {
  const filters: ExtendedSearchFilters = {};

  // 키워드
  const keyword = params.get(URL_PARAM_KEYS.KEYWORD);
  if (keyword) {
    filters.keyword = keyword;
  }

  // 날짜 범위
  const startDate = params.get(URL_PARAM_KEYS.START_DATE);
  const endDate = params.get(URL_PARAM_KEYS.END_DATE);
  if (startDate || endDate) {
    filters.dateRange = {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(endDate) : undefined,
    };
  }

  // 금액 범위
  const amountMin = params.get(URL_PARAM_KEYS.AMOUNT_MIN);
  const amountMax = params.get(URL_PARAM_KEYS.AMOUNT_MAX);
  if (amountMin || amountMax) {
    filters.amountRange = {
      min: amountMin ? Number(amountMin) : undefined,
      max: amountMax ? Number(amountMax) : undefined,
    };
  }

  // 태그 (쉼표로 구분된 문자열을 배열로 변환)
  const tags = params.get(URL_PARAM_KEYS.TAGS);
  if (tags) {
    filters.tags = tags.split(",").filter(Boolean);
  }

  // 거래 유형 (쉼표로 구분된 문자열을 배열로 변환)
  const transactionType = params.get(URL_PARAM_KEYS.TRANSACTION_TYPE);
  if (transactionType) {
    const types = transactionType.split(",").filter(Boolean) as TransactionType[];
    // 유효한 값만 필터링
    const validTypes: TransactionType[] = [];
    for (const type of types) {
      if (type === "DEPOSIT" || type === "WITHDRAWAL" || type === "TRANSFER") {
        validTypes.push(type);
      }
    }
    if (validTypes.length > 0) {
      filters.transactionType = validTypes;
    }
  }

  // 거래 성격 (쉼표로 구분된 문자열을 배열로 변환)
  const transactionNature = params.get(URL_PARAM_KEYS.TRANSACTION_NATURE);
  if (transactionNature) {
    const natures = transactionNature.split(",").filter(Boolean) as TransactionNature[];
    // 유효한 값만 필터링
    const validNatures: TransactionNature[] = [];
    for (const nature of natures) {
      if (nature === "CREDITOR" || nature === "COLLATERAL" || nature === "PRIORITY_REPAYMENT") {
        validNatures.push(nature);
      }
    }
    if (validNatures.length > 0) {
      filters.transactionNature = validNatures;
    }
  }

  // 중요 거래만
  const importantOnly = params.get(URL_PARAM_KEYS.IMPORTANT_ONLY);
  if (importantOnly === "true") {
    filters.isImportantOnly = true;
  }

  // 신뢰도 범위
  const confidenceMin = params.get(URL_PARAM_KEYS.CONFIDENCE_MIN);
  const confidenceMax = params.get(URL_PARAM_KEYS.CONFIDENCE_MAX);
  if (confidenceMin || confidenceMax) {
    filters.confidenceRange = {
      min: confidenceMin ? Number(confidenceMin) : undefined,
      max: confidenceMax ? Number(confidenceMax) : undefined,
    };
  }

  return filters;
}

/**
 * 필터를 URL 쿼리 문자열로 변환 (Story 8.2, Task 8.2)
 *
 * @param filters - 확장 검색 필터
 * @returns URL 쿼리 문자열 (? 제외)
 *
 * @example
 * ```ts
 * const queryString = filtersToQueryString(filters);
 * const url = `/cases/${caseId}?${queryString}`;
 * ```
 */
export function filtersToQueryString(filters: ExtendedSearchFilters): string {
  const params = filtersToUrlParams(filters);
  return params.toString();
}

/**
 * URL 쿼리 문자열을 필터로 변환 (Story 8.2, Task 8.2)
 *
 * @param queryString - URL 쿼리 문자열 (? 제외)
 * @returns ExtendedSearchFilters 객체
 *
 * @example
 * ```ts
 * const queryString = window.location.search.slice(1); // ? 제거
 * const filters = queryStringToFilters(queryString);
 * ```
 */
export function queryStringToFilters(queryString: string): ExtendedSearchFilters {
  const params = new URLSearchParams(queryString);
  return urlParamsToFilters(params);
}
