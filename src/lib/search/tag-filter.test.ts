/**
 * Tag Filter Utility Tests (Story 8.1, Task 10.1)
 *
 * 태그 필터 단위 테스트
 */

import { describe, it, expect } from "vitest";
import { filterByTags, extractUniqueTags, isValidTagName } from "./tag-filter";
import type { Transaction } from "@/types/search";

describe("filterByTags", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-01"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "거래 1",
      tags: [{ tag: { name: "중요" } }, { tag: { name: "확인 필요" } }],
    },
    {
      id: "2",
      transactionDate: new Date("2024-01-02"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "거래 2",
      tags: [{ tag: { name: "증빙 자료" } }],
    },
    {
      id: "3",
      transactionDate: new Date("2024-01-03"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "거래 3",
      tags: [{ tag: { name: "중요" } }],
    },
    {
      id: "4",
      transactionDate: new Date("2024-01-04"),
      depositAmount: null,
      withdrawalAmount: "300000",
      memo: "거래 4",
      tags: [],
    },
  ];

  it("AC4: 특정 태그가 있는 거래를 필터링해야 한다", () => {
    const filtered = filterByTags(mockTransactions, ["중요"]);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("1");
    expect(filtered[1].id).toBe("3");
  });

  it("AC4: 여러 태그 선택 시 OR 조건으로 적용해야 한다", () => {
    const filtered = filterByTags(mockTransactions, ["중요", "증빙 자료"]);
    expect(filtered).toHaveLength(3);
    expect(filtered.map((tx) => tx.id)).toEqual(["1", "2", "3"]);
  });

  it("태그가 없는 거래는 제외해야 한다", () => {
    const filtered = filterByTags(mockTransactions, ["중요"]);
    expect(filtered.every((tx) => tx.id !== "4")).toBe(true);
  });

  it("빈 태그 배열이면 전체 거래를 반환해야 한다", () => {
    const filtered = filterByTags(mockTransactions, []);
    expect(filtered).toHaveLength(4);
  });

  it("일치하는 태그가 없으면 빈 배열을 반환해야 한다", () => {
    const filtered = filterByTags(mockTransactions, ["존재하지않는태그"]);
    expect(filtered).toHaveLength(0);
  });
});

describe("extractUniqueTags", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-01"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "거래 1",
      tags: [
        { tag: { name: "중요" } },
        { tag: { name: "확인 필요" } },
        { tag: { name: "증빙 자료" } },
      ],
    },
    {
      id: "2",
      transactionDate: new Date("2024-01-02"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "거래 2",
      tags: [{ tag: { name: "중요" } }, { tag: { name: "우선" } }],
    },
    {
      id: "3",
      transactionDate: new Date("2024-01-03"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "거래 3",
      tags: [{ tag: { name: "확인 필요" } }],
    },
    {
      id: "4",
      transactionDate: new Date("2024-01-04"),
      depositAmount: null,
      withdrawalAmount: "300000",
      memo: "거래 4",
      tags: [],
    },
  ];

  it("Task 5.2: 고유한 태그 목록을 추출해야 한다", () => {
    const uniqueTags = extractUniqueTags(mockTransactions);
    expect(uniqueTags).toHaveLength(4);
    expect(uniqueTags).toEqual(
      expect.arrayContaining(["중요", "확인 필요", "증빙 자료", "우선"])
    );
  });

  it("Task 5.2: 태그를 알파벳 순으로 정렬해야 한다 (한글은 가나다순)", () => {
    const uniqueTags = extractUniqueTags(mockTransactions);
    // 한글 정렬 순서 확인
    expect(uniqueTags[0]).toBe("우선");
    expect(uniqueTags[1]).toBe("중요");
    expect(uniqueTags[2]).toBe("증빙 자료");
    expect(uniqueTags[3]).toBe("확인 필요");
  });

  it("태그가 없는 거래 목록이면 빈 배열을 반환해야 한다", () => {
    const emptyTransactions: Transaction[] = [
      {
        id: "1",
        transactionDate: new Date("2024-01-01"),
        depositAmount: "1000000",
        withdrawalAmount: null,
        memo: "거래 1",
        tags: [],
      },
    ];
    const uniqueTags = extractUniqueTags(emptyTransactions);
    expect(uniqueTags).toHaveLength(0);
  });
});

describe("isValidTagName", () => {
  it("유효한 태그 이름이면 true를 반환해야 한다", () => {
    expect(isValidTagName("중요")).toBe(true);
    expect(isValidTagName("Important")).toBe(true);
    expect(isValidTagName("확인 필요")).toBe(true);
  });

  it("빈 문자열이면 유효하지 않아야 한다", () => {
    expect(isValidTagName("")).toBe(false);
    expect(isValidTagName("   ")).toBe(false);
  });

  it("100자를 초과하면 유효하지 않아야 한다", () => {
    const longTagName = "a".repeat(101);
    expect(isValidTagName(longTagName)).toBe(false);
  });

  it("100자 이하이면 유효해야 한다", () => {
    const validTagName = "a".repeat(100);
    expect(isValidTagName(validTagName)).toBe(true);
  });
});
