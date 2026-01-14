/**
 * Multidimensional Search Utility Tests (Story 8.1, Task 10.1 + Story 8.2, Task 11.4)
 *
 * 다차원 검색 통합 테스트
 */

import { describe, it, expect } from "vitest";
import {
  applySearchFilters,
  applySearchFiltersWithMetadata,
  hasActiveFilters,
  applyExtendedSearchFilters,
  hasActiveExtendedFilters,
} from "./multidimensional-search";
import type { SearchFilters, ExtendedSearchFilters, Transaction } from "~/types/search";

describe("applySearchFilters", () => {
  const mockTransactions = [
    {
      id: "1",
      transactionDate: new Date("2024-01-15"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "이자 지급",
      tags: [{ tag: { name: "중요" } }, { tag: { name: "확인 필요" } }],
    },
    {
      id: "2",
      transactionDate: new Date("2024-02-20"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "월세 납부",
      tags: [{ tag: { name: "증빙 자료" } }],
    },
    {
      id: "3",
      transactionDate: new Date("2024-03-10"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "이자 수익",
      tags: [{ tag: { name: "중요" } }],
    },
    {
      id: "4",
      transactionDate: new Date("2024-04-05"),
      depositAmount: "1500000",
      withdrawalAmount: null,
      memo: "보험료",
      tags: [],
    },
  ];

  it("Task 6.1: 모든 필터를 AND 조건으로 적용해야 한다", () => {
    const filters: SearchFilters = {
      keyword: "이자",
      dateRange: {
        start: new Date("2024-01-01"),
        end: new Date("2024-03-31"),
      },
      amountRange: {
        min: 1000000,
      },
      tags: ["중요"],
    };

    const filtered = applySearchFilters(mockTransactions, filters);

    // 키워드 "이자" AND 날짜 1월~3월 AND 금액 100만 이상 AND 태그 "중요"
    // 거래 1과 거래 3이 모든 조건 만족
    expect(filtered).toHaveLength(2);
    expect(filtered.map((tx) => tx.id)).toEqual(["1", "3"]);
  });

  it("키워드 필터만 적용되어야 한다", () => {
    const filters: SearchFilters = {
      keyword: "이자",
    };

    const filtered = applySearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((tx) => tx.id)).toEqual(["1", "3"]);
  });

  it("날짜 범위 필터만 적용되어야 한다", () => {
    const filters: SearchFilters = {
      dateRange: {
        start: new Date("2024-02-01"),
        end: new Date("2024-03-31"),
      },
    };

    const filtered = applySearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((tx) => tx.id)).toEqual(["2", "3"]);
  });

  it("금액 범위 필터만 적용되어야 한다", () => {
    const filters: SearchFilters = {
      amountRange: {
        min: 1500000,
        max: 2000000,
      },
    };

    const filtered = applySearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((tx) => tx.id)).toEqual(["3", "4"]);
  });

  it("태그 필터(OR 조건)만 적용되어야 한다", () => {
    const filters: SearchFilters = {
      tags: ["중요", "증빙 자료"],
    };

    const filtered = applySearchFilters(mockTransactions, filters);
    // OR 조건: "중요" 또는 "증빙 자료" 태그가 있는 거래
    expect(filtered).toHaveLength(3);
    expect(filtered.map((tx) => tx.id)).toEqual(["1", "2", "3"]);
  });

  it("빈 필터이면 전체 거래를 반환해야 한다", () => {
    const filters: SearchFilters = {};
    const filtered = applySearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(4);
  });

  it("Task 6.2: 모든 조건에 일치하는 거래가 없으면 빈 배열을 반환해야 한다", () => {
    const filters: SearchFilters = {
      keyword: "존재하지않는키워드",
      dateRange: {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      },
      amountRange: {
        min: 100000000,
      },
      tags: ["존재하지않는태그"],
    };

    const filtered = applySearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(0);
  });
});

describe("applySearchFiltersWithMetadata", () => {
  const mockTransactions = [
    {
      id: "1",
      transactionDate: new Date("2024-01-15"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "이자 지급",
      tags: [{ tag: { name: "중요" } }],
    },
    {
      id: "2",
      transactionDate: new Date("2024-02-20"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "월세 납부",
      tags: [],
    },
  ];

  it("Task 6.2: 검색 메타데이터를 반환해야 한다", () => {
    const filters: SearchFilters = {
      keyword: "이자",
    };

    const { filteredTransactions, metadata } = applySearchFiltersWithMetadata(
      mockTransactions,
      filters
    );

    expect(filteredTransactions).toHaveLength(1);
    expect(metadata.totalCount).toBe(2);
    expect(metadata.filteredCount).toBe(1);
    expect(metadata.searchTime).toBeGreaterThanOrEqual(0);
    expect(metadata.withinSLA).toBe(true); // 3초 이내이면 true
  });

  it("AC6: 검색 시간이 3초 이내이면 withinSLA가 true여야 한다", () => {
    const filters: SearchFilters = {
      keyword: "이자",
    };

    const { metadata } = applySearchFiltersWithMetadata(
      mockTransactions,
      filters
    );

    expect(metadata.searchTime).toBeLessThanOrEqual(3000);
    expect(metadata.withinSLA).toBe(true);
  });
});

describe("hasActiveFilters", () => {
  it("활성화된 필터가 있으면 true를 반환해야 한다", () => {
    expect(
      hasActiveFilters({
        keyword: "이자",
      })
    ).toBe(true);

    expect(
      hasActiveFilters({
        dateRange: { start: new Date("2024-01-01") },
      })
    ).toBe(true);

    expect(
      hasActiveFilters({
        amountRange: { min: 1000000 },
      })
    ).toBe(true);

    expect(
      hasActiveFilters({
        tags: ["중요"],
      })
    ).toBe(true);
  });

  it("활성화된 필터가 없으면 false를 반환해야 한다", () => {
    expect(
      hasActiveFilters({
        keyword: undefined,
        dateRange: undefined,
        amountRange: undefined,
        tags: undefined,
      })
    ).toBe(false);

    expect(hasActiveFilters({})).toBe(false);
  });

  it("빈 필터 객체는 비활성화로 간주해야 한다", () => {
    expect(
      hasActiveFilters({
        dateRange: { start: undefined, end: undefined },
        amountRange: { min: undefined, max: undefined },
        tags: [],
      })
    ).toBe(false);
  });
});

// Story 8.2: Extended Search Tests
describe("applyExtendedSearchFilters (Story 8.2)", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-15"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "이자 지급",
      tags: [{ tag: { name: "중요" } }],
      transactionNature: "CREDITOR",
      importantTransaction: true,
      confidenceScore: 0.9,
    },
    {
      id: "2",
      transactionDate: new Date("2024-02-20"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "변호사 비용",
      tags: [{ tag: { name: "확인 필요" } }],
      transactionNature: "COLLATERAL",
      importantTransaction: false,
      confidenceScore: 0.7,
    },
    {
      id: "3",
      transactionDate: new Date("2024-03-10"),
      depositAmount: "2000000",
      withdrawalAmount: "1000000",
      memo: "자금 이체",
      tags: [{ tag: { name: "중요" } }, { tag: { name: "확인 필요" } }],
      transactionNature: "PRIORITY_REPAYMENT",
      importantTransaction: true,
      confidenceScore: 0.8,
    },
    {
      id: "4",
      transactionDate: new Date("2024-04-05"),
      depositAmount: "3000000",
      withdrawalAmount: null,
      memo: "일반 입금",
      tags: [],
      transactionNature: null,
      importantTransaction: false,
      confidenceScore: 0.5,
    },
  ];

  it("기본 필터만 적용 (키워드)", () => {
    const filters: ExtendedSearchFilters = {
      keyword: "이자",
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });

  it("거래 유형 필터링 (DEPOSIT)", () => {
    const filters: ExtendedSearchFilters = {
      transactionType: ["DEPOSIT"],
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id).sort()).toEqual(["1", "4"]);
  });

  it("거래 유형 필터링 (TRANSFER)", () => {
    const filters: ExtendedSearchFilters = {
      transactionType: ["TRANSFER"],
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("3");
  });

  it("거래 성격 필터링 (CREDITOR)", () => {
    const filters: ExtendedSearchFilters = {
      transactionNature: ["CREDITOR"],
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });

  it("거래 성격 필터링 (다중 선택)", () => {
    const filters: ExtendedSearchFilters = {
      transactionNature: ["CREDITOR", "COLLATERAL"],
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id).sort()).toEqual(["1", "2"]);
  });

  it("중요 거래 필터링", () => {
    const filters: ExtendedSearchFilters = {
      isImportantOnly: true,
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id).sort()).toEqual(["1", "3"]);
  });

  it("신뢰도 범위 필터링 (0.8 이상)", () => {
    const filters: ExtendedSearchFilters = {
      confidenceRange: { min: 0.8 },
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id).sort()).toEqual(["1", "3"]);
  });

  it("신뢰도 범위 필터링 (0.5 ~ 0.8)", () => {
    const filters: ExtendedSearchFilters = {
      confidenceRange: { min: 0.5, max: 0.8 },
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    // Transactions 2 (0.7), 3 (0.8), 4 (0.5) are in range
    expect(filtered).toHaveLength(3);
    expect(filtered.map((t) => t.id).sort()).toEqual(["2", "3", "4"]);
  });

  it("복합 필터링 (키워드 + 거래 유형 + 중요)", () => {
    const filters: ExtendedSearchFilters = {
      keyword: "이자",
      transactionType: ["DEPOSIT"],
      isImportantOnly: true,
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });

  it("복합 필터링 (거래 성격 + 신뢰도)", () => {
    const filters: ExtendedSearchFilters = {
      transactionNature: ["CREDITOR", "PRIORITY_REPAYMENT"],
      confidenceRange: { min: 0.8 },
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id).sort()).toEqual(["1", "3"]);
  });

  it("모든 필터 적용 (AND 조건)", () => {
    const filters: ExtendedSearchFilters = {
      keyword: "이자",
      dateRange: {
        start: new Date("2024-01-01"),
        end: new Date("2024-02-28"),
      },
      amountRange: { min: 500000 },
      tags: ["중요"],
      transactionType: ["DEPOSIT"],
      transactionNature: ["CREDITOR"],
      isImportantOnly: true,
      confidenceRange: { min: 0.8, max: 1.0 },
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });

  it("빈 필터는 전체 반환", () => {
    const filters: ExtendedSearchFilters = {};
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    expect(filtered).toHaveLength(4);
  });

  it("신뢰도가 있는 거래만 confidenceRange 필터링에 포함", () => {
    const filters: ExtendedSearchFilters = {
      confidenceRange: { min: 0.0, max: 1.0 },
    };
    const filtered = applyExtendedSearchFilters(mockTransactions, filters);
    // All mock transactions have confidenceScore defined (1: 0.9, 2: 0.7, 3: 0.8, 4: 0.5)
    expect(filtered).toHaveLength(4);
    expect(filtered.every((t) => t.confidenceScore !== null && t.confidenceScore !== undefined)).toBe(true);
  });
});

describe("hasActiveExtendedFilters (Story 8.2)", () => {
  it("기본 필터만 활성화 (keyword)", () => {
    const filters: ExtendedSearchFilters = {
      keyword: "테스트",
    };
    expect(hasActiveExtendedFilters(filters)).toBe(true);
  });

  it("확장 필터만 활성화 (transactionType)", () => {
    const filters: ExtendedSearchFilters = {
      transactionType: ["DEPOSIT"],
    };
    expect(hasActiveExtendedFilters(filters)).toBe(true);
  });

  it("확장 필터만 활성화 (transactionNature)", () => {
    const filters: ExtendedSearchFilters = {
      transactionNature: ["CREDITOR"],
    };
    expect(hasActiveExtendedFilters(filters)).toBe(true);
  });

  it("확장 필터만 활성화 (isImportantOnly)", () => {
    const filters: ExtendedSearchFilters = {
      isImportantOnly: true,
    };
    expect(hasActiveExtendedFilters(filters)).toBe(true);
  });

  it("확장 필터만 활성화 (confidenceRange)", () => {
    const filters: ExtendedSearchFilters = {
      confidenceRange: { min: 0.8 },
    };
    expect(hasActiveExtendedFilters(filters)).toBe(true);
  });

  it("빈 필터는 비활성화", () => {
    const filters: ExtendedSearchFilters = {};
    expect(hasActiveExtendedFilters(filters)).toBe(false);
  });

  it("모든 필터가 비활성화 상태이면 false", () => {
    const filters: ExtendedSearchFilters = {
      keyword: "",
      dateRange: { start: undefined, end: undefined },
      amountRange: { min: undefined, max: undefined },
      tags: [],
      transactionType: [],
      transactionNature: [],
      isImportantOnly: false,
      confidenceRange: { min: undefined, max: undefined },
    };
    expect(hasActiveExtendedFilters(filters)).toBe(false);
  });
});
