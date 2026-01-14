/**
 * Date Filter Utility Tests (Story 8.1, Task 10.1)
 *
 * 날짜 범위 필터 단위 테스트
 */

import { describe, it, expect } from "vitest";
import { filterByDateRange, isValidDateRange } from "./date-filter";
import type { Transaction } from "@/types/search";

describe("filterByDateRange", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-15"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "거래 1",
      tags: [],
    },
    {
      id: "2",
      transactionDate: new Date("2024-02-20"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "거래 2",
      tags: [],
    },
    {
      id: "3",
      transactionDate: new Date("2024-03-10"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "거래 3",
      tags: [],
    },
    {
      id: "4",
      transactionDate: new Date("2024-04-05"),
      depositAmount: null,
      withdrawalAmount: "300000",
      memo: "거래 4",
      tags: [],
    },
  ];

  it("AC2: 시작일과 종료일 사이의 거래를 필터링해야 한다", () => {
    const filtered = filterByDateRange(mockTransactions, {
      start: new Date("2024-02-01"),
      end: new Date("2024-03-31"),
    });
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("2");
    expect(filtered[1].id).toBe("3");
  });

  it("AC2: 시작일만 지정하면 시작일 이후의 모든 거래를 반환해야 한다", () => {
    const filtered = filterByDateRange(mockTransactions, {
      start: new Date("2024-03-01"),
    });
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("3");
    expect(filtered[1].id).toBe("4");
  });

  it("AC2: 종료일만 지정하면 종료일 이전의 모든 거래를 반환해야 한다", () => {
    const filtered = filterByDateRange(mockTransactions, {
      end: new Date("2024-02-28"),
    });
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("1");
    expect(filtered[1].id).toBe("2");
  });

  it("Task 3.2: 날짜 경계값을 정확하게 처리해야 한다", () => {
    // 시작일 포함
    const filtered1 = filterByDateRange(mockTransactions, {
      start: new Date("2024-02-20"),
      end: new Date("2024-02-20"),
    });
    expect(filtered1).toHaveLength(1);
    expect(filtered1[0].id).toBe("2");

    // 종료일 포함
    const filtered2 = filterByDateRange(mockTransactions, {
      start: new Date("2024-01-15"),
      end: new Date("2024-01-15"),
    });
    expect(filtered2).toHaveLength(1);
    expect(filtered2[0].id).toBe("1");
  });

  it("빈 날짜 범위이면 전체 거래를 반환해야 한다", () => {
    const filtered = filterByDateRange(mockTransactions, {});
    expect(filtered).toHaveLength(4);
  });

  it("일치하는 거래가 없으면 빈 배열을 반환해야 한다", () => {
    const filtered = filterByDateRange(mockTransactions, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });
    expect(filtered).toHaveLength(0);
  });
});

describe("isValidDateRange", () => {
  it("유효한 날짜 범위이면 true를 반환해야 한다", () => {
    expect(
      isValidDateRange({
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      })
    ).toBe(true);
  });

  it("시작일만 있어도 유효해야 한다", () => {
    expect(
      isValidDateRange({
        start: new Date("2024-01-01"),
      })
    ).toBe(true);
  });

  it("종료일만 있어도 유효해야 한다", () => {
    expect(
      isValidDateRange({
        end: new Date("2024-12-31"),
      })
    ).toBe(true);
  });

  it("시작일이 종료일보다 늦으면 유효하지 않아야 한다", () => {
    expect(
      isValidDateRange({
        start: new Date("2024-12-31"),
        end: new Date("2024-01-01"),
      })
    ).toBe(false);
  });

  it("빈 날짜 범위이면 유효해야 한다", () => {
    expect(isValidDateRange({})).toBe(true);
  });
});
