/**
 * Unit Tests for Rule-Based Classifier
 *
 * Story 4.8: Learning Feedback Loop
 *
 * Tests the rule-based classification service that applies learned rules
 * before AI API calls to reduce costs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  classifyWithRules,
  matchKeywordRule,
  matchAmountRangeRule,
  matchCreditorRule,
} from "./rule-based-classifier";
import type { RuleBasedTransactionInput } from "./rule-based-classifier";

describe("Rule-Based Classifier", () => {
  let mockDb: PrismaClient;

  beforeEach(() => {
    // Mock PrismaClient
    mockDb = {
      classificationRule: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;
  });

  describe("matchKeywordRule", () => {
    it("should match transaction with keyword in memo", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "김주택 대출 이자",
        depositAmount: null,
        withdrawalAmount: null,
      };

      const rules = [
        {
          id: "rule1",
          pattern: "김주택",
          category: "출금",
          subcategory: "대출이자",
          confidence: 0.9,
        },
      ];

      const result = matchKeywordRule(transaction, rules);

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe("rule1");
      expect(result?.category).toBe("출금");
      expect(result?.confidence).toBe(0.9);
    });

    it("should return null when no keyword matches", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "일반 거래",
        depositAmount: null,
        withdrawalAmount: null,
      };

      const rules = [
        {
          id: "rule1",
          pattern: "김주택",
          category: "출금",
          subcategory: "대출이자",
          confidence: 0.9,
        },
      ];

      const result = matchKeywordRule(transaction, rules);

      expect(result).toBeNull();
    });

    it("should match multiple keywords and return first match", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "신한카드 사용",
        depositAmount: null,
        withdrawalAmount: null,
      };

      const rules = [
        {
          id: "rule1",
          pattern: "김주택",
          category: "출금",
          subcategory: "대출이자",
          confidence: 0.9,
        },
        {
          id: "rule2",
          pattern: "신한카드",
          category: "출금",
          subcategory: "카드결제",
          confidence: 0.85,
        },
      ];

      const result = matchKeywordRule(transaction, rules);

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe("rule2");
    });
  });

  describe("matchAmountRangeRule", () => {
    it("should match transaction within amount range", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "결제",
        depositAmount: null,
        withdrawalAmount: 50000,
      };

      const rules = [
        {
          id: "rule1",
          pattern: "10000-100000",
          category: "출금",
          subcategory: "소액결제",
          confidence: 0.8,
        },
      ];

      const result = matchAmountRangeRule(transaction, rules);

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe("rule1");
    });

    it("should return null when amount is outside range", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "결제",
        depositAmount: null,
        withdrawalAmount: 5000000,
      };

      const rules = [
        {
          id: "rule1",
          pattern: "10000-100000",
          category: "출금",
          subcategory: "소액결제",
          confidence: 0.8,
        },
      ];

      const result = matchAmountRangeRule(transaction, rules);

      expect(result).toBeNull();
    });
  });

  describe("matchCreditorRule", () => {
    it("should match transaction with creditor name", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "저축은행 이체",
        depositAmount: null,
        withdrawalAmount: null,
        creditorName: "저축은행",
      };

      const rules = [
        {
          id: "rule1",
          pattern: "저축은행",
          category: "출금",
          subcategory: "금융기관",
          confidence: 0.85,
        },
      ];

      const result = matchCreditorRule(transaction, rules);

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe("rule1");
    });

    it("should return null when creditor does not match", () => {
      const transaction: RuleBasedTransactionInput = {
        id: "1",
        memo: "일반 이체",
        depositAmount: null,
        withdrawalAmount: null,
        creditorName: "다른은행",
      };

      const rules = [
        {
          id: "rule1",
          pattern: "저축은행",
          category: "출금",
          subcategory: "금융기관",
          confidence: 0.85,
        },
      ];

      const result = matchCreditorRule(transaction, rules);

      expect(result).toBeNull();
    });
  });

  describe("classifyWithRules", () => {
    it("should classify transactions using active rules", async () => {
      const transactions: RuleBasedTransactionInput[] = [
        {
          id: "1",
          memo: "김주택 대출 이자",
          depositAmount: null,
          withdrawalAmount: null,
        },
        {
          id: "2",
          memo: "일반 거래",
          depositAmount: null,
          withdrawalAmount: null,
        },
      ];

      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "rule1",
          pattern: "김주택",
          patternType: "KEYWORD",
          category: "출금",
          subcategory: "대출이자",
          confidence: 0.9,
          applyCount: 0,
          successCount: 0,
          lastAppliedAt: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({} as any);

      const results = await classifyWithRules(mockDb, transactions);

      expect(results.size).toBe(2);
      expect(results.get("1")?.matched).toBe(true);
      expect(results.get("1")?.result?.category).toBe("출금");
      expect(results.get("2")?.matched).toBe(false);
    });

    it("should update rule statistics on successful match", async () => {
      const transactions: RuleBasedTransactionInput[] = [
        {
          id: "1",
          memo: "신한카드 사용",
          depositAmount: null,
          withdrawalAmount: null,
        },
      ];

      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "rule1",
          pattern: "신한카드",
          patternType: "KEYWORD",
          category: "출금",
          subcategory: "카드결제",
          confidence: 0.85,
          applyCount: 5,
          successCount: 4,
          lastAppliedAt: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({} as any);

      await classifyWithRules(mockDb, transactions);

      expect(mockDb.classificationRule.update).toHaveBeenCalledWith({
        where: { id: "rule1" },
        data: {
          applyCount: { increment: 1 },
          successCount: { increment: 1 },
          lastAppliedAt: expect.any(Date),
        },
      });
    });

    it("should skip inactive rules", async () => {
      const transactions: RuleBasedTransactionInput[] = [
        {
          id: "1",
          memo: "김주택 대출 이자",
          depositAmount: null,
          withdrawalAmount: null,
        },
      ];

      // Mock to return empty array when filtering for active rules
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([] as any);

      const results = await classifyWithRules(mockDb, transactions);

      expect(results.get("1")?.matched).toBe(false);
    });
  });
});
