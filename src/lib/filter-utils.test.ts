/**
 * Filter Utility Tests (Story 5.5: 추적 필터링)
 *
 * TDD: Red-Green-Refactor Cycle
 * - Red: Write failing tests first
 * - Green: Implement minimal code to pass tests
 * - Refactor: Improve code quality
 *
 * @module lib/filter-utils.test
 */

import { describe, it, expect } from "vitest";
import type { TransactionNature } from "@prisma/client";
import {
  filterTransactionsByDateRange,
  filterTransactionsByAmountRange,
  filterTransactionsByTags,
  filterTransactionsByNature,
  filterImportantTransactions,
  applyFilters,
  type FundFlowFilters,
} from "./filter-utils";

// Mock transaction type for testing
interface MockTransaction {
  id: string;
  transactionDate: Date;
  depositAmount: number | null;
  withdrawalAmount: number | null;
  tags: Array<{ tag: { name: string } }>;
  transactionNature: TransactionNature | null;
  importantTransaction: boolean | null;
}

describe("filter-utils (Story 5.5)", () => {
  describe("filterTransactionsByDateRange", () => {
    it("should filter transactions within date range (AC2)", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date("2024-01-01"), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "2", transactionDate: new Date("2024-01-15"), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "3", transactionDate: new Date("2024-02-01"), depositAmount: 3000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByDateRange(transactions, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      });

      expect(result).toHaveLength(2);
      expect(result.map((tx) => tx.id)).toEqual(["1", "2"]);
    });

    it("should return all transactions when dateRange is undefined", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date("2024-01-01"), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByDateRange(transactions, undefined);

      expect(result).toHaveLength(1);
    });

    it("should handle boundary dates correctly", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date("2024-01-01"), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "2", transactionDate: new Date("2024-01-31"), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByDateRange(transactions, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("filterTransactionsByAmountRange", () => {
    it("should filter transactions by deposit amount (AC3)", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "2", transactionDate: new Date(), depositAmount: 5000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "3", transactionDate: new Date(), depositAmount: 10000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByAmountRange(transactions, { min: 2000, max: 8000 });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("should filter transactions by withdrawal amount", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: null, withdrawalAmount: 1000, tags: [], transactionNature: null, importantTransaction: null },
        { id: "2", transactionDate: new Date(), depositAmount: null, withdrawalAmount: 5000, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByAmountRange(transactions, { min: 2000, max: 8000 });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("should return all transactions when amountRange is undefined", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByAmountRange(transactions, undefined);

      expect(result).toHaveLength(1);
    });

    it("should handle null amounts as 0", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: null, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByAmountRange(transactions, { min: 0, max: 100 });

      expect(result).toHaveLength(1);
    });
  });

  describe("filterTransactionsByTags", () => {
    it("should filter transactions by tags (AC4: OR 조건)", () => {
      const transactions: MockTransaction[] = [
        {
          id: "1",
          transactionDate: new Date(),
          depositAmount: 1000,
          withdrawalAmount: null,
          tags: [{ tag: { name: "loan" } }],
          transactionNature: null,
          importantTransaction: null,
        },
        {
          id: "2",
          transactionDate: new Date(),
          depositAmount: 2000,
          withdrawalAmount: null,
          tags: [{ tag: { name: "collateral" } }],
          transactionNature: null,
          importantTransaction: null,
        },
        {
          id: "3",
          transactionDate: new Date(),
          depositAmount: 3000,
          withdrawalAmount: null,
          tags: [{ tag: { name: "repayment" } }],
          transactionNature: null,
          importantTransaction: null,
        },
      ];

      const result = filterTransactionsByTags(transactions, ["loan", "collateral"]);

      expect(result).toHaveLength(2);
      expect(result.map((tx) => tx.id)).toEqual(["1", "2"]);
    });

    it("should return all transactions when tags is undefined or empty", () => {
      const transactions: MockTransaction[] = [
        {
          id: "1",
          transactionDate: new Date(),
          depositAmount: 1000,
          withdrawalAmount: null,
          tags: [],
          transactionNature: null,
          importantTransaction: null,
        },
      ];

      expect(filterTransactionsByTags(transactions, undefined)).toHaveLength(1);
      expect(filterTransactionsByTags(transactions, [])).toHaveLength(1);
    });
  });

  describe("filterTransactionsByNature", () => {
    it("should filter transactions by transaction nature", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: "CREDITOR", importantTransaction: null },
        { id: "2", transactionDate: new Date(), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: "COLLATERAL", importantTransaction: null },
        { id: "3", transactionDate: new Date(), depositAmount: 3000, withdrawalAmount: null, tags: [], transactionNature: "GENERAL", importantTransaction: null },
      ];

      const result = filterTransactionsByNature(transactions, ["CREDITOR", "COLLATERAL"]);

      expect(result).toHaveLength(2);
      expect(result.map((tx) => tx.id)).toEqual(["1", "2"]);
    });

    it("should return all transactions when natures is undefined or empty", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      expect(filterTransactionsByNature(transactions, undefined)).toHaveLength(1);
      expect(filterTransactionsByNature(transactions, [])).toHaveLength(1);
    });

    it("should exclude null transactionNature when filtering", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
        { id: "2", transactionDate: new Date(), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: "CREDITOR", importantTransaction: null },
      ];

      const result = filterTransactionsByNature(transactions, ["CREDITOR"]);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });
  });

  describe("filterImportantTransactions", () => {
    it("should filter important transactions only", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: true },
        { id: "2", transactionDate: new Date(), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: false },
        { id: "3", transactionDate: new Date(), depositAmount: 3000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterImportantTransactions(transactions, true);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("should return all transactions when importantOnly is false or undefined", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: true },
        { id: "2", transactionDate: new Date(), depositAmount: 2000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: false },
      ];

      expect(filterImportantTransactions(transactions, false)).toHaveLength(2);
      expect(filterImportantTransactions(transactions, undefined)).toHaveLength(2);
    });
  });

  describe("applyFilters (AC5: 복합 필터)", () => {
    const mockTransactions: MockTransaction[] = [
      {
        id: "1",
        transactionDate: new Date("2024-01-15"),
        depositAmount: 5000,
        withdrawalAmount: null,
        tags: [{ tag: { name: "loan" } }],
        transactionNature: "CREDITOR",
        importantTransaction: true,
      },
      {
        id: "2",
        transactionDate: new Date("2024-01-20"),
        depositAmount: 10000,
        withdrawalAmount: null,
        tags: [{ tag: { name: "collateral" } }],
        transactionNature: "COLLATERAL",
        importantTransaction: false,
      },
      {
        id: "3",
        transactionDate: new Date("2024-02-01"),
        depositAmount: 3000,
        withdrawalAmount: null,
        tags: [{ tag: { name: "repayment" } }],
        transactionNature: "GENERAL",
        importantTransaction: null,
      },
    ];

    it("should apply date range and amount range filters (AND 조건)", () => {
      const filters: FundFlowFilters = {
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
        amountRange: {
          min: 4000,
          max: 8000,
        },
      };

      const result = applyFilters(mockTransactions, filters);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("should apply tag filter with OR condition", () => {
      const filters: FundFlowFilters = {
        tags: ["loan", "collateral"],
      };

      const result = applyFilters(mockTransactions, filters);

      expect(result).toHaveLength(2);
      expect(result.map((tx) => tx.id)).toEqual(["1", "2"]);
    });

    it("should apply all filters with AND condition between different filter types", () => {
      const filters: FundFlowFilters = {
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
        tags: ["loan"],
        transactionNature: ["CREDITOR"],
        importantOnly: true,
      };

      const result = applyFilters(mockTransactions, filters);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("should return all transactions when no filters are applied", () => {
      const filters: FundFlowFilters = {};

      const result = applyFilters(mockTransactions, filters);

      expect(result).toHaveLength(3);
    });

    it("should return empty array when no transactions match", () => {
      const filters: FundFlowFilters = {
        amountRange: { min: 100000, max: 200000 },
      };

      const result = applyFilters(mockTransactions, filters);

      expect(result).toHaveLength(0);
    });
  });

  describe("Edge cases and boundary values", () => {
    it("should handle empty transaction array", () => {
      const result = filterTransactionsByDateRange([], { start: new Date(), end: new Date() });
      expect(result).toHaveLength(0);
    });

    it("should handle null transactionNature in applyFilters", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date(), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const filters: FundFlowFilters = {
        transactionNature: ["CREDITOR"],
      };

      const result = applyFilters(transactions, filters);

      expect(result).toHaveLength(0);
    });

    it("should handle date range with same start and end", () => {
      const transactions: MockTransaction[] = [
        { id: "1", transactionDate: new Date("2024-01-01"), depositAmount: 1000, withdrawalAmount: null, tags: [], transactionNature: null, importantTransaction: null },
      ];

      const result = filterTransactionsByDateRange(transactions, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-01"),
      });

      expect(result).toHaveLength(1);
    });
  });
});
