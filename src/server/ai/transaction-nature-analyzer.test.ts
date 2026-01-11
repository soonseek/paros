/**
 * Transaction Nature Analyzer Service Tests
 *
 * Story 4.4: 거래 성격 판단
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from "vitest";
import {
  analyzeTransactionNature,
  analyzeTransactionNatureInBatch,
  type TransactionNatureAnalysis,
} from "./transaction-nature-analyzer";

describe("Transaction Nature Analyzer", () => {
  describe("analyzeTransactionNature", () => {
    describe("채권자 관련 거래 감지", () => {
      it("김주택 채권자명 추출", () => {
        const result = analyzeTransactionNature("김주택 대출금 변제", 1000000, new Date());

        expect(result.nature).toBe("CREDITOR");
        expect(result.creditorName).toBe("김주택");
        expect(result.confidenceScore).toBeGreaterThan(0.7);
      });

      it("신한카드 채권자명 추출", () => {
        const result = analyzeTransactionNature("신한카드 출금", 50000, new Date());

        expect(result.nature).toBe("CREDITOR");
        expect(result.creditorName).toContain("신한카드");
      });

      it("캐피탈 채권자명 추출", () => {
        const result = analyzeTransactionNature("삼성캐피탈 이자 납부", 150000, new Date());

        expect(result.nature).toBe("CREDITOR");
        expect(result.creditorName).toContain("캐피탈");
      });

      it("저축은행 채권자명 추출", () => {
        const result = analyzeTransactionNature("저축은행 대출 상환", 200000, new Date());

        expect(result.nature).toBe("CREDITOR");
        expect(result.creditorName).toContain("저축은행");
      });
    });

    describe("담보 관련 거래 감지", () => {
      it("저당권 설정 감지", () => {
        const result = analyzeTransactionNature("부동산 저당권 설정", 0, new Date());

        expect(result.nature).toBe("COLLATERAL");
        expect(result.collateralType).toBe("MORTGAGE");
        expect(result.matchedKeywords).toContain("저당권");
      });

      it("질권 설정 감지", () => {
        const result = analyzeTransactionNature("동산 질권 설정", 0, new Date());

        expect(result.nature).toBe("COLLATERAL");
        expect(result.collateralType).toBe("LIEN");
      });

      it("유치권 감지", () => {
        const result = analyzeTransactionNature("차량 유치권 발생", 0, new Date());

        expect(result.nature).toBe("COLLATERAL");
        expect(result.collateralType).toBe("POSSESSION");
      });

      it("근저당 감지", () => {
        const result = analyzeTransactionNature("근저당 설정금", 5000000, new Date());

        expect(result.nature).toBe("COLLATERAL");
        expect(result.collateralType).toBe("MORTGAGE");
      });
    });

    describe("우선변제 관련 거래 감지", () => {
      it("임차권 감지", () => {
        const result = analyzeTransactionNature("임차권 설정료", 500000, new Date());

        expect(result.nature).toBe("PRIORITY_REPAYMENT");
        expect(result.matchedKeywords).toContain("임차권");
      });

      it("대항력 감지", () => {
        const result = analyzeTransactionNature("대항력 확정", 0, new Date());

        expect(result.nature).toBe("PRIORITY_REPAYMENT");
        expect(result.matchedKeywords).toContain("대항력");
      });

      it("우선변제 감지", () => {
        const result = analyzeTransactionNature("우선변제권 행사", 1000000, new Date());

        expect(result.nature).toBe("PRIORITY_REPAYMENT");
        expect(result.matchedKeywords).toContain("우선변제");
      });

      it("임차권+대항력 조합 감지 (CRITICAL)", () => {
        const result = analyzeTransactionNature(
          "임차권+대항력 확보 보증금",
          3000000,
          new Date()
        );

        expect(result.nature).toBe("PRIORITY_REPAYMENT");
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe("일반 거래 분류", () => {
      it("편의점 매입은 일반 거래", () => {
        const result = analyzeTransactionNature("편의점 매입", 5000, new Date());

        expect(result.nature).toBe("GENERAL");
        expect(result.creditorName).toBeUndefined();
        expect(result.collateralType).toBeUndefined();
      });

      it("식비는 일반 거래", () => {
        const result = analyzeTransactionNature("점심 식비", 8000, new Date());

        expect(result.nature).toBe("GENERAL");
      });

      it("교통비는 일반 거래", () => {
        const result = analyzeTransactionNature("지하철 교통비", 2000, new Date());

        expect(result.nature).toBe("GENERAL");
      });
    });

    describe("엣지 케이스", () => {
      it("빈 문자열은 GENERAL", () => {
        const result = analyzeTransactionNature("", 0, new Date());

        expect(result.nature).toBe("GENERAL");
        expect(result.confidenceScore).toBe(0);
      });

      it("null 메모는 GENERAL", () => {
        const result = analyzeTransactionNature(null, 0, new Date());

        expect(result.nature).toBe("GENERAL");
        expect(result.confidenceScore).toBe(0);
      });

      it("undefined 메모는 GENERAL", () => {
        const result = analyzeTransactionNature(undefined, 0, new Date());

        expect(result.nature).toBe("GENERAL");
        expect(result.confidenceScore).toBe(0);
      });

      it("대소문자 무시 키워드 매칭", () => {
        const result1 = analyzeTransactionNature("김주택 대출금", 1000000, new Date());
        const result2 = analyzeTransactionNature("김주택 대출금".toLowerCase(), 1000000, new Date());

        expect(result1.nature).toBe(result2.nature);
      });
    });

    describe("신뢰도 점수 계산", () => {
      it("명확한 키워드 매칭은 높은 신뢰도", () => {
        const result = analyzeTransactionNature("김주택 대출금 변제", 1000000, new Date());

        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
      });

      it("여러 키워드 매칭은 더 높은 신뢰도", () => {
        const result = analyzeTransactionNature(
          "임차권 설정 및 대항력 확정",
          500000,
          new Date()
        );

        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      });

      it("일반 거래는 낮은 신뢰도", () => {
        const result = analyzeTransactionNature("일반 거래", 10000, new Date());

        expect(result.confidenceScore).toBeLessThan(0.5);
      });
    });
  });

  describe("analyzeTransactionNatureInBatch", () => {
    it("여러 거래를 배치로 분석", () => {
      const transactions = [
        { id: "1", memo: "김주택 대출금", amount: 100000, date: new Date() },
        { id: "2", memo: "저당권 설정", amount: 0, date: new Date() },
        { id: "3", memo: "편의점", amount: 5000, date: new Date() },
      ];

      const results = analyzeTransactionNatureInBatch(transactions);

      expect(results.size).toBe(3);
      expect(results.get("1")?.nature).toBe("CREDITOR");
      expect(results.get("2")?.nature).toBe("COLLATERAL");
      expect(results.get("3")?.nature).toBe("GENERAL");
    });

    it("진행률 콜백 호출", () => {
      const transactions = [
        { id: "1", memo: "대출", amount: 100, date: new Date() },
        { id: "2", memo: "변제", amount: 50, date: new Date() },
      ];

      const progressCallback = vi.fn();
      analyzeTransactionNatureInBatch(transactions, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 2);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 2);
    });
  });
});
