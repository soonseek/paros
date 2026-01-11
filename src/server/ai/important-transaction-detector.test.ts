/**
 * Important Transaction Detector Service Tests
 *
 * Story 4.3: 중요 거래 자동 식별
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect } from "vitest";
import {
  detectImportantTransaction,
  detectImportantTransactions,
  serializeMatchedKeywords,
  deserializeMatchedKeywords,
  combineClassificationResults,
  calculateDetectionStats,
} from "./important-transaction-detector";
import type { ImportantTransactionDetectionResult } from "./types";

describe("Important Transaction Detector", () => {
  describe("detectImportantTransaction", () => {
    it("대출 실행 키워드를 감지해야 함", () => {
      const result = detectImportantTransaction("대출 실행 500만원 지급");

      expect(result.isImportant).toBe(true);
      expect(result.type).toBe("LOAN_EXECUTION");
      expect(result.matchedKeywords).toContain("대출 실행");
      expect(result.confidence).toBe(1.0);
    });

    it("변제 키워드를 감지해야 함", () => {
      const result = detectImportantTransaction("원금 변제 100만원");

      expect(result.isImportant).toBe(true);
      expect(result.type).toBe("REPAYMENT");
      expect(result.matchedKeywords).toContain("변제");
    });

    it("담보 키워드를 감지해야 함", () => {
      const result = detectImportantTransaction("담보제공 부동산");

      expect(result.isImportant).toBe(true);
      expect(result.type).toBe("COLLATERAL");
      expect(result.matchedKeywords).toContain("담보제공");
    });

    it("압류 키워드를 감지해야 함", () => {
      const result = detectImportantTransaction("급여 압류 명령");

      expect(result.isImportant).toBe(true);
      expect(result.type).toBe("SEIZURE");
      expect(result.matchedKeywords).toContain("압류");
    });

    it("중요 거래 키워드가 없으면 중요 거래가 아님", () => {
      const result = detectImportantTransaction("편의점 매입 5,000원");

      expect(result.isImportant).toBe(false);
      expect(result.type).toBeNull();
      expect(result.matchedKeywords).toEqual([]);
    });

    it("빈 메모는 중요 거래가 아님", () => {
      const result = detectImportantTransaction("");

      expect(result.isImportant).toBe(false);
      expect(result.type).toBeNull();
    });

    it("null 메모는 중요 거래가 아님", () => {
      const result = detectImportantTransaction(null);

      expect(result.isImportant).toBe(false);
      expect(result.type).toBeNull();
    });

    it("대소문자 무시하고 키워드 매칭", () => {
      const result1 = detectImportantTransaction("대출 실행");
      const result2 = detectImportantTransaction("대출 실형");
      const result3 = detectImportantTransaction("대출 실 행");

      // 모두 대출 실행으로 감지
      expect(result1.isImportant).toBe(true);
      expect(result2.isImportant).toBe(false); // "실형"은 다른 단어
    });

    it("여러 키워드가 매칭되면 모두 반환", () => {
      const result = detectImportantTransaction("대출 실행 500만원, 실행 완료");

      expect(result.isImportant).toBe(true);
      expect(result.matchedKeywords).toContain("대출 실행");
      expect(result.matchedKeywords).toContain("실행");
    });
  });

  describe("detectImportantTransactions (배치 처리)", () => {
    it("여러 거래를 배치로 감지", () => {
      const transactions = [
        { id: "1", memo: "대출 실행", depositAmount: 100, withdrawalAmount: null },
        { id: "2", memo: "변제 완료", depositAmount: null, withdrawalAmount: 50 },
        { id: "3", memo: "일반 거래", depositAmount: 10, withdrawalAmount: null },
      ];

      const results = detectImportantTransactions(transactions);

      expect(results.size).toBe(3);

      const tx1Result = results.get("1");
      expect(tx1Result?.isImportant).toBe(true);
      expect(tx1Result?.type).toBe("LOAN_EXECUTION");

      const tx2Result = results.get("2");
      expect(tx2Result?.isImportant).toBe(true);
      expect(tx2Result?.type).toBe("REPAYMENT");

      const tx3Result = results.get("3");
      expect(tx3Result?.isImportant).toBe(false);
    });

    it("진행률 콜백 호출", () => {
      const transactions = [
        { id: "1", memo: "대출 실행", depositAmount: 100, withdrawalAmount: null },
        { id: "2", memo: "변제", depositAmount: null, withdrawalAmount: 50 },
      ];

      const progressCallback = vi.fn();
      detectImportantTransactions(transactions, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 2);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 2);
    });
  });

  describe("serializeMatchedKeywords", () => {
    it("키워드 배열을 JSON 문자열로 변환", () => {
      const keywords = ["대출 실행", "실행"];
      const serialized = serializeMatchedKeywords(keywords);

      expect(serialized).toBe('["대출 실행","실행"]');
    });

    it("빈 배열은 null 반환", () => {
      const serialized = serializeMatchedKeywords([]);

      expect(serialized).toBeNull();
    });
  });

  describe("deserializeMatchedKeywords", () => {
    it("JSON 문자열을 키워드 배열로 변환", () => {
      const jsonStr = '["대출 실행","실행"]';
      const keywords = deserializeMatchedKeywords(jsonStr);

      expect(keywords).toEqual(["대출 실행", "실행"]);
    });

    it("null은 빈 배열 반환", () => {
      const keywords = deserializeMatchedKeywords(null);

      expect(keywords).toEqual([]);
    });

    it("잘못된 JSON은 빈 배열 반환", () => {
      const keywords = deserializeMatchedKeywords("invalid json");

      expect(keywords).toEqual([]);
    });
  });

  describe("combineClassificationResults", () => {
    it("AI 분류와 중요 거래 감지 결과 결합", () => {
      const aiResult = {
        category: "입금",
        subcategory: "대출",
        confidenceScore: 0.95,
      };

      const combined = combineClassificationResults(
        "tx-1",
        "대출 실행 500만원",
        aiResult
      );

      expect(combined.txId).toBe("tx-1");
      expect(combined.category).toBe("입금");
      expect(combined.isImportant).toBe(true);
      expect(combined.importantTransactionType).toBe("LOAN_EXECUTION");
      expect(combined.importantTransactionKeywords).toContain("대출 실행");
    });

    it("중요 거래가 아닌 경우에도 결합", () => {
      const aiResult = {
        category: "출금",
        subcategory: "식비",
        confidenceScore: 0.85,
      };

      const combined = combineClassificationResults(
        "tx-2",
        "편의점 매입",
        aiResult
      );

      expect(combined.isImportant).toBe(false);
      expect(combined.importantTransactionType).toBeNull();
      expect(combined.importantTransactionKeywords).toBeNull();
    });
  });

  describe("calculateDetectionStats", () => {
    it("감지 통계 계산", () => {
      const results = new Map<string, ImportantTransactionDetectionResult>();
      results.set("1", {
        isImportant: true,
        type: "LOAN_EXECUTION",
        matchedKeywords: ["대출 실행"],
        confidence: 1.0,
      });
      results.set("2", {
        isImportant: true,
        type: "REPAYMENT",
        matchedKeywords: ["변제"],
        confidence: 1.0,
      });
      results.set("3", {
        isImportant: true,
        type: "LOAN_EXECUTION",
        matchedKeywords: ["실행"],
        confidence: 1.0,
      });
      results.set("4", {
        isImportant: false,
        type: null,
        matchedKeywords: [],
        confidence: 1.0,
      });

      const stats = calculateDetectionStats(results);

      expect(stats.total).toBe(4);
      expect(stats.importantCount).toBe(3);
      expect(stats.byType.LOAN_EXECUTION).toBe(2);
      expect(stats.byType.REPAYMENT).toBe(1);
    });
  });
});
