/**
 * Confidence Filter Utility Tests (Story 8.2, Task 11.1)
 *
 * @module lib/search/confidence-filter.test
 */

import { describe, it, expect } from "vitest";
import {
  filterByConfidenceRange,
  isValidConfidenceRange,
} from "./confidence-filter";
import type { Transaction } from "~/types/search";

describe("confidence-filter", () => {
  describe("filterByConfidenceRange", () => {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "1000000",
        withdrawalAmount: null,
        memo: null,
        confidenceScore: 0.9,
      },
      {
        id: "2",
        transactionDate: new Date(),
        depositAmount: null,
        withdrawalAmount: "500000",
        memo: null,
        confidenceScore: 0.5,
      },
      {
        id: "3",
        transactionDate: new Date(),
        depositAmount: "2000000",
        withdrawalAmount: null,
        memo: null,
        confidenceScore: 0.7,
      },
      {
        id: "4",
        transactionDate: new Date(),
        depositAmount: "3000000",
        withdrawalAmount: null,
        memo: null,
        confidenceScore: null,
      },
      {
        id: "5",
        transactionDate: new Date(),
        depositAmount: "4000000",
        withdrawalAmount: null,
        memo: null,
        confidenceScore: undefined,
      },
    ];

    it("최소값 필터링 (0.8 이상)", () => {
      const filtered = filterByConfidenceRange(mockTransactions, { min: 0.8 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("최대값 필터링 (0.6 이하)", () => {
      const filtered = filterByConfidenceRange(mockTransactions, { max: 0.6 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("범위 필터링 (0.5 ~ 0.8)", () => {
      const filtered = filterByConfidenceRange(mockTransactions, { min: 0.5, max: 0.8 });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id).sort()).toEqual(["2", "3"]);
    });

    it("confidenceScore가 null인 거래는 제외", () => {
      const filtered = filterByConfidenceRange(mockTransactions, { min: 0.0, max: 1.0 });
      expect(filtered.some((t) => t.id === "4")).toBe(false);
    });

    it("confidenceScore가 undefined인 거래는 제외", () => {
      const filtered = filterByConfidenceRange(mockTransactions, { min: 0.0, max: 1.0 });
      expect(filtered.some((t) => t.id === "5")).toBe(false);
    });

    it("범위가 없으면 전체 반환", () => {
      const filtered = filterByConfidenceRange(mockTransactions, {});
      expect(filtered).toHaveLength(5);
    });
  });

  describe("isValidConfidenceRange", () => {
    it("유효한 범위: min=0.5, max=1.0", () => {
      expect(isValidConfidenceRange({ min: 0.5, max: 1.0 })).toBe(true);
    });

    it("유효한 범위: min만", () => {
      expect(isValidConfidenceRange({ min: 0.5 })).toBe(true);
    });

    it("유효한 범위: max만", () => {
      expect(isValidConfidenceRange({ max: 0.8 })).toBe(true);
    });

    it("유효한 범위: 빈 객체", () => {
      expect(isValidConfidenceRange({})).toBe(true);
    });

    it("유효하지 않은 범위: min이 음수", () => {
      expect(isValidConfidenceRange({ min: -0.1 })).toBe(false);
    });

    it("유효하지 않은 범위: max가 1.0 초과", () => {
      expect(isValidConfidenceRange({ max: 1.5 })).toBe(false);
    });

    it("유효하지 않은 범위: min > max", () => {
      expect(isValidConfidenceRange({ min: 0.8, max: 0.5 })).toBe(false);
    });

    it("유효하지 않은 범위: min=1.1", () => {
      expect(isValidConfidenceRange({ min: 1.1 })).toBe(false);
    });
  });
});
