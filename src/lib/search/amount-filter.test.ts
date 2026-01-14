/**
 * Amount Filter Utility Tests (Story 8.1, Task 10.1)
 *
 * 금액 범위 필터 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  filterByAmountRange,
  parseAmountString,
  isValidAmountRange,
} from "./amount-filter";
import type { Transaction } from "@/types/search";

describe("filterByAmountRange", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-01"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "거래 1",
      tags: [],
    },
    {
      id: "2",
      transactionDate: new Date("2024-01-02"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "거래 2",
      tags: [],
    },
    {
      id: "3",
      transactionDate: new Date("2024-01-03"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "거래 3",
      tags: [],
    },
    {
      id: "4",
      transactionDate: new Date("2024-01-04"),
      depositAmount: null,
      withdrawalAmount: "300000",
      memo: "거래 4",
      tags: [],
    },
    {
      id: "5",
      transactionDate: new Date("2024-01-05"),
      depositAmount: "1500000",
      withdrawalAmount: null,
      memo: "거래 5",
      tags: [],
    },
  ];

  it("AC3: 최소금액과 최대금액 사이의 거래를 필터링해야 한다", () => {
    const filtered = filterByAmountRange(mockTransactions, {
      min: 1000000,
      max: 2000000,
    });
    expect(filtered).toHaveLength(3);
    expect(filtered.map((tx) => tx.id)).toEqual(["1", "3", "5"]);
  });

  it("AC3: 최소금액만 지정하면 최소금액 이상의 거래를 반환해야 한다", () => {
    const filtered = filterByAmountRange(mockTransactions, {
      min: 1500000,
    });
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("3");
    expect(filtered[1].id).toBe("5");
  });

  it("AC3: 최대금액만 지정하면 최대금액 이하의 거래를 반환해야 한다", () => {
    const filtered = filterByAmountRange(mockTransactions, {
      max: 500000,
    });
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("2");
    expect(filtered[1].id).toBe("4");
  });

  it("AC3: 입금액 또는 출금액이 범위 내에 있으면 포함해야 한다", () => {
    // 입금액 1,500,000은 범위 내
    const filtered = filterByAmountRange(mockTransactions, {
      min: 1400000,
      max: 1600000,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("5");
  });

  it("Task 4.1: 경계값을 정확하게 처리해야 한다", () => {
    // 최소금액 == 최대금액
    const filtered = filterByAmountRange(mockTransactions, {
      min: 1000000,
      max: 1000000,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("빈 금액 범위이면 전체 거래를 반환해야 한다", () => {
    const filtered = filterByAmountRange(mockTransactions, {});
    expect(filtered).toHaveLength(5);
  });

  it("일치하는 거래가 없으면 빈 배열을 반환해야 한다", () => {
    const filtered = filterByAmountRange(mockTransactions, {
      min: 50000000,
      max: 100000000,
    });
    expect(filtered).toHaveLength(0);
  });
});

describe("parseAmountString", () => {
  it("Task 4.2: 천 단위 구분 기호를 제거하고 숫자로 변환해야 한다", () => {
    expect(parseAmountString("1,000,000")).toBe(1000000);
    expect(parseAmountString("10,000")).toBe(10000);
    expect(parseAmountString("1,234,567")).toBe(1234567);
  });

  it("Task 4.2: 숫자 문자열을 숫자로 변환해야 한다", () => {
    expect(parseAmountString("1000000")).toBe(1000000);
    expect(parseAmountString("0")).toBe(0);
  });

  it("Task 4.2: 음수이면 null을 반환해야 한다", () => {
    expect(parseAmountString("-1000")).toBeNull();
  });

  it("Task 4.2: 유효하지 않은 문자열이면 null을 반환해야 한다", () => {
    expect(parseAmountString("invalid")).toBeNull();
    expect(parseAmountString("")).toBeNull();
    expect(parseAmountString("abc123")).toBeNull();
  });
});

describe("isValidAmountRange", () => {
  it("유효한 금액 범위이면 true를 반환해야 한다", () => {
    expect(
      isValidAmountRange({
        min: 1000,
        max: 10000,
      })
    ).toBe(true);
  });

  it("최소금액만 있어도 유효해야 한다", () => {
    expect(
      isValidAmountRange({
        min: 1000,
      })
    ).toBe(true);
  });

  it("최대금액만 있어도 유효해야 한다", () => {
    expect(
      isValidAmountRange({
        max: 10000,
      })
    ).toBe(true);
  });

  it("최소금액이 최대금액보다 크면 유효하지 않아야 한다", () => {
    expect(
      isValidAmountRange({
        min: 10000,
        max: 1000,
      })
    ).toBe(false);
  });

  it("빈 금액 범위이면 유효해야 한다", () => {
    expect(isValidAmountRange({})).toBe(true);
  });
});
