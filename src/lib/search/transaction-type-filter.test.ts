/**
 * Transaction Type Filter Utility Tests (Story 8.2, Task 11.1)
 *
 * @module lib/search/transaction-type-filter.test
 */

import { describe, it, expect } from "vitest";
import {
  filterByTransactionType,
  getTransactionType,
  getTransactionTypeLabel,
} from "./transaction-type-filter";
import type { Transaction } from "~/types/search";

describe("transaction-type-filter", () => {
  describe("getTransactionType", () => {
    it("DEPOSIT: 입금만 있는 경우", () => {
      const tx: Transaction = {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "1000000",
        withdrawalAmount: null,
        memo: null,
      };
      expect(getTransactionType(tx)).toBe("DEPOSIT");
    });

    it("WITHDRAWAL: 출금만 있는 경우", () => {
      const tx: Transaction = {
        id: "1",
        transactionDate: new Date(),
        depositAmount: null,
        withdrawalAmount: "500000",
        memo: null,
      };
      expect(getTransactionType(tx)).toBe("WITHDRAWAL");
    });

    it("TRANSFER: 입금과 출금이 모두 있는 경우", () => {
      const tx: Transaction = {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "1000000",
        withdrawalAmount: "500000",
        memo: null,
      };
      expect(getTransactionType(tx)).toBe("TRANSFER");
    });

    it("WITHDRAWAL: 입금/출금이 모두 없는 경우 (기본값)", () => {
      const tx: Transaction = {
        id: "1",
        transactionDate: new Date(),
        depositAmount: null,
        withdrawalAmount: null,
        memo: null,
      };
      expect(getTransactionType(tx)).toBe("WITHDRAWAL");
    });

    it("WITHDRAWAL: 0원 입금의 경우", () => {
      const tx: Transaction = {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "0",
        withdrawalAmount: "500000",
        memo: null,
      };
      expect(getTransactionType(tx)).toBe("WITHDRAWAL");
    });
  });

  describe("filterByTransactionType", () => {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        transactionDate: new Date(),
        depositAmount: "1000000",
        withdrawalAmount: null,
        memo: null,
      },
      {
        id: "2",
        transactionDate: new Date(),
        depositAmount: null,
        withdrawalAmount: "500000",
        memo: null,
      },
      {
        id: "3",
        transactionDate: new Date(),
        depositAmount: "2000000",
        withdrawalAmount: "1000000",
        memo: null,
      },
    ];

    it("DEPOSIT 필터링", () => {
      const filtered = filterByTransactionType(mockTransactions, ["DEPOSIT"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("WITHDRAWAL 필터링", () => {
      const filtered = filterByTransactionType(mockTransactions, ["WITHDRAWAL"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("TRANSFER 필터링", () => {
      const filtered = filterByTransactionType(mockTransactions, ["TRANSFER"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("3");
    });

    it("다중 필터링 (DEPOSIT OR TRANSFER)", () => {
      const filtered = filterByTransactionType(mockTransactions, ["DEPOSIT", "TRANSFER"]);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id).sort()).toEqual(["1", "3"]);
    });

    it("빈 배열이면 전체 반환", () => {
      const filtered = filterByTransactionType(mockTransactions, []);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("getTransactionTypeLabel", () => {
    it("DEPOSIT -> '입금'", () => {
      expect(getTransactionTypeLabel("DEPOSIT")).toBe("입금");
    });

    it("WITHDRAWAL -> '출금'", () => {
      expect(getTransactionTypeLabel("WITHDRAWAL")).toBe("출금");
    });

    it("TRANSFER -> '이체'", () => {
      expect(getTransactionTypeLabel("TRANSFER")).toBe("이체");
    });
  });
});
