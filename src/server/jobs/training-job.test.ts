/**
 * Unit Tests for Training Job
 *
 * Story 4.8: Learning Feedback Loop
 *
 * Tests the weekly training job that extracts new classification rules
 * from user feedback.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  runTrainingJob,
  extractKeywordRules,
  extractAmountRangeRules,
} from "./training-job";
import type { RuleGenerationOptions } from "./training-job";

describe("Training Job", () => {
  let mockDb: PrismaClient;

  beforeEach(() => {
    // Mock PrismaClient
    mockDb = {
      classificationFeedback: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      classificationRule: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
    } as unknown as PrismaClient;
  });

  describe("extractKeywordRules", () => {
    it("should extract keyword rules from feedback data", async () => {
      const mockFeedbacks = Array.from({ length: 5 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "출금",
        userSubcategory: "대출이자",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue(null);

      // Mock transaction.findMany to return transactions with category "출금"
      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          memo: "김주택 대출 이자",
          category: "출금",
          isManuallyClassified: true,
        },
        {
          memo: "김주택 이체",
          category: "출금",
          isManuallyClassified: true,
        },
        {
          memo: "김주택 납부",
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.create).mockResolvedValue({} as any);

      const options: RuleGenerationOptions = {
        minConfidence: 0.7,
        minFeedbackCount: 3,
      };

      const rules = await extractKeywordRules(mockDb, options);

      expect(rules.length).toBeGreaterThan(0);
      if (rules[0]) {
        expect(rules[0].patternType).toBe("KEYWORD");
        expect(rules[0].category).toBe("출금");
      }
    });

    it("should skip existing rules", async () => {
      const mockFeedbacks = Array.from({ length: 5 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "출금",
        userSubcategory: "대출이자",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          memo: "김주택 대출 이자",
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      // Existing rule
      vi.mocked(mockDb.classificationRule.findFirst)?.mockResolvedValue({
        id: "existing-rule",
      } as any);

      const options: RuleGenerationOptions = {
        minConfidence: 0.7,
        minFeedbackCount: 3,
      };

      const rules = await extractKeywordRules(mockDb, options);

      expect(rules).toHaveLength(0);
    });

    it("should filter below minimum confidence", async () => {
      const mockFeedbacks = Array.from({ length: 2 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "출금",
        userSubcategory: "대출이자",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          memo: "김주택 대출 이자",
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      const options: RuleGenerationOptions = {
        minConfidence: 0.7,
        minFeedbackCount: 3,
      };

      const rules = await extractKeywordRules(mockDb, options);

      expect(rules).toHaveLength(0);
    });
  });

  describe("extractAmountRangeRules", () => {
    it("should extract amount range rules from feedback data", async () => {
      const mockFeedbacks = Array.from({ length: 10 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "출금",
        userSubcategory: "소액결제",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          withdrawalAmount: 50000,
          depositAmount: null,
          category: "출금",
          isManuallyClassified: true,
        },
        {
          withdrawalAmount: 75000,
          depositAmount: null,
          category: "출금",
          isManuallyClassified: true,
        },
        {
          withdrawalAmount: 100000,
          depositAmount: null,
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue(null);
      vi.mocked(mockDb.classificationRule.create).mockResolvedValue({} as any);

      const options: RuleGenerationOptions = {
        minConfidence: 0.7,
        minFeedbackCount: 3,
      };

      const rules = await extractAmountRangeRules(mockDb, options);

      expect(rules.length).toBeGreaterThan(0);
      if (rules[0]) {
        expect(rules[0].patternType).toBe("AMOUNT_RANGE");
        expect(rules[0].category).toBe("출금");
      }
    });

    it("should handle null amounts gracefully", async () => {
      const mockFeedbacks = Array.from({ length: 5 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "입금",
        userSubcategory: "기타",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          withdrawalAmount: null, // Null amount
          depositAmount: null,
          category: "입금",
          isManuallyClassified: true,
        },
      ] as any);

      const options: RuleGenerationOptions = {
        minConfidence: 0.7,
        minFeedbackCount: 3,
      };

      const rules = await extractAmountRangeRules(mockDb, options);

      // Should not crash, but might return no rules
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe("runTrainingJob", () => {
    it("should run complete training job and return statistics", async () => {
      // Mock feedback data
      const mockFeedbacks = Array.from({ length: 10 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: "출금",
        userSubcategory: "대출이자",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          memo: "김주택 대출 이자",
          withdrawalAmount: 50000,
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.findFirst)?.mockResolvedValue(null);
      vi.mocked(mockDb.classificationRule.create)?.mockResolvedValue({
        id: "new-rule",
      } as any);

      const result = await runTrainingJob(mockDb);

      expect(result).toHaveProperty("keywordRulesCount");
      expect(result).toHaveProperty("amountRangeRulesCount");
      expect(result).toHaveProperty("totalRulesCreated");
      expect(result.totalRulesCreated).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty feedback data", async () => {
      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue([]);

      const result = await runTrainingJob(mockDb);

      expect(result.keywordRulesCount).toBe(0);
      expect(result.amountRangeRulesCount).toBe(0);
      expect(result.totalRulesCreated).toBe(0);
    });
  });
});
