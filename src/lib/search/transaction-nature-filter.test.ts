/**
 * Transaction Nature Filter Utility Tests (Story 8.2, Task 11.1)
 *
 * @module lib/search/transaction-nature-filter.test
 */

import { describe, it, expect } from "vitest";
import {
  filterByTransactionNature,
  getTransactionNatureLabel,
  type TransactionNature,
} from "./transaction-nature-filter";
import type { Transaction } from "~/types/search";

describe("transaction-nature-filter", () => {
  describe("filterByTransactionNature", () => {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "1000000",
        withdrawalAmount: null,
        memo: null,
        transactionNature: "CREDITOR",
      },
      {
        id: "2",
        transactionDate: new Date(),
        depositAmount: null,
        withdrawalAmount: "500000",
        memo: null,
        transactionNature: "COLLATERAL",
      },
      {
        id: "3",
        transactionDate: new Date(),
        depositAmount: "2000000",
        withdrawalAmount: null,
        memo: null,
        transactionNature: "PRIORITY_REPAYMENT",
      },
      {
        id: "4",
        transactionDate: new Date(),
        depositAmount: "3000000",
        withdrawalAmount: null,
        memo: null,
        transactionNature: null,
      },
    ];

    it("CREDITOR 필터링", () => {
      const filtered = filterByTransactionNature(mockTransactions, ["CREDITOR"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("COLLATERAL 필터링", () => {
      const filtered = filterByTransactionNature(mockTransactions, ["COLLATERAL"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("PRIORITY_REPAYMENT 필터링", () => {
      const filtered = filterByTransactionNature(mockTransactions, ["PRIORITY_REPAYMENT"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("3");
    });

    it("다중 필터링 (CREDITOR OR COLLATERAL)", () => {
      const filtered = filterByTransactionNature(mockTransactions, ["CREDITOR", "COLLATERAL"]);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id).sort()).toEqual(["1", "2"]);
    });

    it("transactionNature이 null인 거래는 제외", () => {
      const filtered = filterByTransactionNature(mockTransactions, ["CREDITOR", "COLLATERAL"]);
      expect(filtered.some((t) => t.id === "4")).toBe(false);
    });

    it("빈 배열이면 전체 반환", () => {
      const filtered = filterByTransactionNature(mockTransactions, []);
      expect(filtered).toHaveLength(4);
    });
  });

  describe("getTransactionNatureLabel", () => {
    it("CREDITOR -> '채권자'", () => {
      expect(getTransactionNatureLabel("CREDITOR")).toBe("채권자");
    });

    it("COLLATERAL -> '담보'", () => {
      expect(getTransactionNatureLabel("COLLATERAL")).toBe("담보");
    });

    it("PRIORITY_REPAYMENT -> '우선변제'", () => {
      expect(getTransactionNatureLabel("PRIORITY_REPAYMENT")).toBe("우선변제");
    });
  });
});
