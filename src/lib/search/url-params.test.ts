/**
 * URL Parameter Conversion Utilities Tests (Story 8.2, Task 11.2)
 *
 * @module lib/search/url-params.test
 */

import { describe, it, expect } from "vitest";
import {
  filtersToUrlParams,
  urlParamsToFilters,
  filtersToQueryString,
  queryStringToFilters,
} from "./url-params";
import type { ExtendedSearchFilters } from "~/types/search";

describe("url-params", () => {
  describe("filtersToUrlParams", () => {
    it("기본 필터 변환: 키워드", () => {
      const filters: ExtendedSearchFilters = {
        keyword: "이자",
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("keyword")).toBe("이자");
    });

    it("날짜 범위 변환", () => {
      const filters: ExtendedSearchFilters = {
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31"),
        },
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("startDate")).toBe("2024-01-01T00:00:00.000Z");
      expect(params.get("endDate")).toBe("2024-12-31T00:00:00.000Z");
    });

    it("금액 범위 변환", () => {
      const filters: ExtendedSearchFilters = {
        amountRange: {
          min: 1000000,
          max: 5000000,
        },
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("amountMin")).toBe("1000000");
      expect(params.get("amountMax")).toBe("5000000");
    });

    it("태그 배열 변환 (쉼표로 구분)", () => {
      const filters: ExtendedSearchFilters = {
        tags: ["중요", "확인 필요"],
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("tags")).toBe("중요,확인 필요");
    });

    it("거래 유형 배열 변환", () => {
      const filters: ExtendedSearchFilters = {
        transactionType: ["DEPOSIT", "WITHDRAWAL"],
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("transactionType")).toBe("DEPOSIT,WITHDRAWAL");
    });

    it("거래 성격 배열 변환", () => {
      const filters: ExtendedSearchFilters = {
        transactionNature: ["CREDITOR", "COLLATERAL"],
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("transactionNature")).toBe("CREDITOR,COLLATERAL");
    });

    it("중요 거래만 변환", () => {
      const filters: ExtendedSearchFilters = {
        isImportantOnly: true,
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("importantOnly")).toBe("true");
    });

    it("신뢰도 범위 변환", () => {
      const filters: ExtendedSearchFilters = {
        confidenceRange: {
          min: 0.8,
          max: 1.0,
        },
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("confidenceMin")).toBe("0.8");
      expect(params.get("confidenceMax")).toBe("1");
    });

    it("복합 필터 변환", () => {
      const filters: ExtendedSearchFilters = {
        keyword: "이자",
        amountRange: { min: 1000000 },
        transactionType: ["DEPOSIT"],
        isImportantOnly: true,
      };
      const params = filtersToUrlParams(filters);
      expect(params.get("keyword")).toBe("이자");
      expect(params.get("amountMin")).toBe("1000000");
      expect(params.get("transactionType")).toBe("DEPOSIT");
      expect(params.get("importantOnly")).toBe("true");
    });
  });

  describe("urlParamsToFilters", () => {
    it("키워드 파싱", () => {
      const params = new URLSearchParams("keyword=이자");
      const filters = urlParamsToFilters(params);
      expect(filters.keyword).toBe("이자");
    });

    it("날짜 범위 파싱", () => {
      const params = new URLSearchParams(
        "startDate=2024-01-01T00:00:00.000Z&endDate=2024-12-31T00:00:00.000Z"
      );
      const filters = urlParamsToFilters(params);
      expect(filters.dateRange?.start).toEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(filters.dateRange?.end).toEqual(new Date("2024-12-31T00:00:00.000Z"));
    });

    it("금액 범위 파싱", () => {
      const params = new URLSearchParams("amountMin=1000000&amountMax=5000000");
      const filters = urlParamsToFilters(params);
      expect(filters.amountRange?.min).toBe(1000000);
      expect(filters.amountRange?.max).toBe(5000000);
    });

    it("태그 파싱 (쉼표로 구분된 문자열을 배열로 변환)", () => {
      const params = new URLSearchParams("tags=중요,확인 필요");
      const filters = urlParamsToFilters(params);
      expect(filters.tags).toEqual(["중요", "확인 필요"]);
    });

    it("거래 유형 파싱", () => {
      const params = new URLSearchParams("transactionType=DEPOSIT,WITHDRAWAL");
      const filters = urlParamsToFilters(params);
      expect(filters.transactionType).toEqual(["DEPOSIT", "WITHDRAWAL"]);
    });

    it("거래 성격 파싱", () => {
      const params = new URLSearchParams("transactionNature=CREDITOR,COLLATERAL");
      const filters = urlParamsToFilters(params);
      expect(filters.transactionNature).toEqual(["CREDITOR", "COLLATERAL"]);
    });

    it("중요 거래만 파싱", () => {
      const params = new URLSearchParams("importantOnly=true");
      const filters = urlParamsToFilters(params);
      expect(filters.isImportantOnly).toBe(true);
    });

    it("신뢰도 범위 파싱", () => {
      const params = new URLSearchParams("confidenceMin=0.8&confidenceMax=1.0");
      const filters = urlParamsToFilters(params);
      expect(filters.confidenceRange?.min).toBe(0.8);
      expect(filters.confidenceRange?.max).toBe(1.0);
    });

    it("빈 파라미터는 빈 필터 반환", () => {
      const params = new URLSearchParams("");
      const filters = urlParamsToFilters(params);
      expect(Object.keys(filters)).toHaveLength(0);
    });

    it("유효하지 않은 거래 유형은 필터링", () => {
      const params = new URLSearchParams("transactionType=DEPOSIT,INVALID,WITHDRAWAL");
      const filters = urlParamsToFilters(params);
      expect(filters.transactionType).toEqual(["DEPOSIT", "WITHDRAWAL"]);
    });

    it("유효하지 않은 거래 성격은 필터링", () => {
      const params = new URLSearchParams("transactionNature=CREDITOR,INVALID,COLLATERAL");
      const filters = urlParamsToFilters(params);
      expect(filters.transactionNature).toEqual(["CREDITOR", "COLLATERAL"]);
    });
  });

  describe("filtersToQueryString", () => {
    it("필터를 쿼리 문자열로 변환", () => {
      const filters: ExtendedSearchFilters = {
        keyword: "이자",
        amountRange: { min: 1000000 },
      };
      const queryString = filtersToQueryString(filters);
      // URLSearchParams는 한글을 자동으로 URL 인코딩함
      expect(queryString).toContain("keyword=%EC%9D%B4%EC%9E%90"); // "이자"의 URL 인코딩
      expect(queryString).toContain("amountMin=1000000");
    });
  });

  describe("queryStringToFilters", () => {
    it("쿼리 문자열을 필터로 변환", () => {
      const queryString = "keyword=이자&amountMin=1000000";
      const filters = queryStringToFilters(queryString);
      expect(filters.keyword).toBe("이자");
      expect(filters.amountRange?.min).toBe(1000000);
    });
  });

  describe("변환 왕복 테스트", () => {
    it("필터 -> URL 파라미터 -> 필터", () => {
      const originalFilters: ExtendedSearchFilters = {
        keyword: "이자",
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31"),
        },
        amountRange: {
          min: 1000000,
          max: 5000000,
        },
        tags: ["중요", "확인 필요"],
        transactionType: ["DEPOSIT", "WITHDRAWAL"],
        transactionNature: ["CREDITOR"],
        isImportantOnly: true,
        confidenceRange: {
          min: 0.8,
          max: 1.0,
        },
      };

      const params = filtersToUrlParams(originalFilters);
      const restoredFilters = urlParamsToFilters(params);

      expect(restoredFilters.keyword).toBe(originalFilters.keyword);
      expect(restoredFilters.dateRange?.start?.toISOString()).toBe(
        originalFilters.dateRange?.start?.toISOString()
      );
      expect(restoredFilters.dateRange?.end?.toISOString()).toBe(
        originalFilters.dateRange?.end?.toISOString()
      );
      expect(restoredFilters.amountRange?.min).toBe(originalFilters.amountRange?.min);
      expect(restoredFilters.amountRange?.max).toBe(originalFilters.amountRange?.max);
      expect(restoredFilters.tags).toEqual(originalFilters.tags);
      expect(restoredFilters.transactionType).toEqual(originalFilters.transactionType);
      expect(restoredFilters.transactionNature).toEqual(originalFilters.transactionNature);
      expect(restoredFilters.isImportantOnly).toBe(originalFilters.isImportantOnly);
      expect(restoredFilters.confidenceRange?.min).toBe(originalFilters.confidenceRange?.min);
      expect(restoredFilters.confidenceRange?.max).toBe(originalFilters.confidenceRange?.max);
    });
  });
});
