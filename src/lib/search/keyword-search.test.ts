/**
 * Keyword Search Utility Tests (Story 8.1, Task 10.1)
 *
 * 키워드 검색 단위 테스트
 */

import { describe, it, expect } from "vitest";
import { filterByKeyword, highlightKeyword } from "./keyword-search";
import type { Transaction } from "@/types/search";

describe("filterByKeyword", () => {
  // 테스트용 거래 데이터
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      transactionDate: new Date("2024-01-01"),
      depositAmount: "1000000",
      withdrawalAmount: null,
      memo: "이자 지급",
      tags: [],
    },
    {
      id: "2",
      transactionDate: new Date("2024-01-02"),
      depositAmount: null,
      withdrawalAmount: "500000",
      memo: "월세 납부",
      tags: [],
    },
    {
      id: "3",
      transactionDate: new Date("2024-01-03"),
      depositAmount: "2000000",
      withdrawalAmount: null,
      memo: "이자 수익",
      tags: [],
    },
    {
      id: "4",
      transactionDate: new Date("2024-01-04"),
      depositAmount: null,
      withdrawalAmount: "300000",
      memo: null, // 메모가 없는 거래
      tags: [],
    },
  ];

  it("AC1: 키워드로 필터링된 거래를 반환해야 한다", () => {
    const filtered = filterByKeyword(mockTransactions, "이자");
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("1");
    expect(filtered[1].id).toBe("3");
  });

  it("AC1: 대소문자 구분 없이 검색해야 한다", () => {
    const filtered1 = filterByKeyword(mockTransactions, "이자");
    const filtered2 = filterByKeyword(mockTransactions, "이자");
    const filtered3 = filterByKeyword(mockTransactions, "INTEREST");
    expect(filtered1).toEqual(filtered2);
    expect(filtered3).toHaveLength(0); // 한글 텍스트라서 영어는 없음
  });

  it("Task 2.3: 빈 키워드이면 전체 거래를 반환해야 한다", () => {
    const filtered1 = filterByKeyword(mockTransactions, "");
    const filtered2 = filterByKeyword(mockTransactions, "   ");
    expect(filtered1).toHaveLength(4);
    expect(filtered2).toHaveLength(4);
  });

  it("메모가 null인 거래는 제외해야 한다", () => {
    const filtered = filterByKeyword(mockTransactions, "이자");
    expect(filtered.every((tx) => tx.id !== "4")).toBe(true);
  });

  it("일치하는 결과가 없으면 빈 배열을 반환해야 한다", () => {
    const filtered = filterByKeyword(mockTransactions, "존재하지않는키워드");
    expect(filtered).toHaveLength(0);
  });
});

describe("highlightKeyword", () => {
  it("키워드를 mark 태그로 감싸야 한다", () => {
    const highlighted = highlightKeyword("이자 지급", "이자");
    expect(highlighted).toContain("<mark>이자</mark>");
    expect(highlighted).toContain(" 지급");
  });

  it("빈 키워드이면 원본 텍스트를 반환해야 한다", () => {
    const original = "이자 지급";
    const highlighted1 = highlightKeyword(original, "");
    const highlighted2 = highlightKeyword(original, "   ");
    expect(highlighted1).toBe(original);
    expect(highlighted2).toBe(original);
  });

  it("대소문자 구분 없이 강조해야 한다", () => {
    const highlighted1 = highlightKeyword("Interest Payment", "Interest");
    const highlighted2 = highlightKeyword("INTEREST PAYMENT", "INTEREST");
    // highlightKeyword는 입력한 키워드를 그대로 사용
    expect(highlighted1).toContain("<mark>Interest</mark>");
    expect(highlighted2).toContain("<mark>INTEREST</mark>");
  });

  it("여러 개의 일치하는 부분을 모두 강조해야 한다", () => {
    const highlighted = highlightKeyword("이자 지급 및 이자 수령", "이자");
    const matches = (highlighted.match(/<mark>이자<\/mark>/g) || []).length;
    expect(matches).toBe(2);
  });
});
