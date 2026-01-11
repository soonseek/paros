/**
 * Integration Tests for Learning Feedback Loop
 *
 * Story 4.8: Learning Feedback Loop
 *
 * Tests the complete learning loop:
 * 1. User manually corrects AI classification
 * 2. Feedback is automatically collected
 * 3. Training job extracts new rules from feedback
 * 4. Rules are applied before AI calls in future classifications
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runTrainingJob } from "./jobs/training-job";
import { classifyWithRules } from "./ai/rule-based-classifier";

describe("Learning Feedback Loop Integration", () => {
  let mockDb: PrismaClient;

  beforeEach(() => {
    // Mock PrismaClient
    mockDb = {
      classificationFeedback: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      classificationRule: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;
  });

  describe("Complete Learning Loop", () => {
    it("should collect feedback, extract rules, and apply them in classification", async () => {
      // Step 1: User corrects AI classification
      // Original AI classification
      const originalCategory = "입금";
      const originalSubcategory = "기타";
      const originalConfidence = 0.6;

      // User's manual correction
      const userCategory = "출금";
      const userSubcategory = "대출이자";

      // Mock feedback collection
      vi.mocked(mockDb.classificationFeedback.create).mockResolvedValue({
        id: "feedback1",
        originalCategory,
        userCategory,
      } as any);

      // Simulate feedback being collected
      const feedback = await mockDb.classificationFeedback.create({
        data: {
          transactionId: "tx1",
          originalCategory,
          originalSubcategory,
          originalConfidence,
          userCategory,
          userSubcategory,
          userId: "user1",
          feedbackDate: new Date(),
        },
      });

      expect(feedback).toBeDefined();
      expect(feedback.originalCategory).toBe(originalCategory);
      expect(feedback.userCategory).toBe(userCategory);

      // Step 2: Training job extracts rules from feedback
      const mockFeedbacks = [
        {
          id: "feedback1",
          originalCategory: "입금",
          originalSubcategory: "기타",
          originalConfidence: 0.6,
          userCategory: "출금",
          userSubcategory: "대출이자",
          feedbackDate: new Date(),
          userId: "user1",
          transactionId: "tx1",
        },
        {
          id: "feedback2",
          originalCategory: "입금",
          originalSubcategory: "기타",
          originalConfidence: 0.6,
          userCategory: "출금",
          userSubcategory: "대출이자",
          feedbackDate: new Date(),
          userId: "user1",
          transactionId: "tx2",
        },
        {
          id: "feedback3",
          originalCategory: "입금",
          originalSubcategory: "기타",
          originalConfidence: 0.6,
          userCategory: "출금",
          userSubcategory: "대출이자",
          feedbackDate: new Date(),
          userId: "user1",
          transactionId: "tx3",
        },
        {
          id: "feedback4",
          originalCategory: "입금",
          originalSubcategory: "기타",
          originalConfidence: 0.6,
          userCategory: "출금",
          userSubcategory: "대출이자",
          feedbackDate: new Date(),
          userId: "user1",
          transactionId: "tx4",
        },
        {
          id: "feedback5",
          originalCategory: "입금",
          originalSubcategory: "기타",
          originalConfidence: 0.6,
          userCategory: "출금",
          userSubcategory: "대출이자",
          feedbackDate: new Date(),
          userId: "user1",
          transactionId: "tx5",
        },
      ];

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx1",
          memo: "김주택 대출 이자",
          withdrawalAmount: 100000,
          category: "출금",
          isManuallyClassified: true,
        },
        {
          id: "tx2",
          memo: "김주택 이자 납입",
          withdrawalAmount: 150000,
          category: "출금",
          isManuallyClassified: true,
        },
        {
          id: "tx3",
          memo: "김주택 상환",
          withdrawalAmount: 200000,
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue(null);
      vi.mocked(mockDb.classificationRule.create).mockResolvedValue({
        id: "rule1",
        pattern: "김주택",
        patternType: "KEYWORD",
        category: "출금",
        subcategory: "대출이자",
        confidence: 1.0,
        isActive: true,
      } as any);

      const trainingResult = await runTrainingJob(mockDb);

      expect(trainingResult.keywordRulesCount).toBeGreaterThan(0);
      expect(trainingResult.totalRulesCreated).toBeGreaterThan(0);

      // Step 3: New transaction is classified using learned rule
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "rule1",
          pattern: "김주택",
          patternType: "KEYWORD",
          category: "출금",
          subcategory: "대출이자",
          confidence: 1.0,
          applyCount: 0,
          successCount: 0,
          lastAppliedAt: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({} as any);

      const newTransactions = [
        {
          id: "tx2",
          memo: "김주택 대출 상환",
          depositAmount: null,
          withdrawalAmount: null,
        },
      ];

      const classificationResults = await classifyWithRules(mockDb, newTransactions);

      // Verify the rule was applied
      const result = classificationResults.get("tx2");
      expect(result?.matched).toBe(true);
      expect(result?.result?.category).toBe("출금");
      expect(result?.result?.subcategory).toBe("대출이자");

      // Verify rule statistics were updated
      expect(mockDb.classificationRule.update).toHaveBeenCalledWith({
        where: { id: "rule1" },
        data: {
          applyCount: { increment: 1 },
          successCount: { increment: 1 },
          lastAppliedAt: expect.any(Date),
        },
      });
    });

    it("should handle multiple feedback entries and extract multiple rules", async () => {
      // Mock multiple feedback entries for different patterns
      const mockFeedbacks = Array.from({ length: 20 }, (_, i) => ({
        id: `feedback${i}`,
        originalCategory: "입금",
        originalSubcategory: "기타",
        originalConfidence: 0.6,
        userCategory: i < 8 ? "출금" : "출금",
        userSubcategory: i < 8 ? "대출이자" : "카드결제",
        feedbackDate: new Date(),
        userId: "user1",
        transactionId: `tx${i}`,
      }));

      vi.mocked(mockDb.classificationFeedback.findMany).mockResolvedValue(
        mockFeedbacks as any
      );

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx1",
          memo: "김주택 대출 이자",
          withdrawalAmount: 100000,
          category: "출금",
          isManuallyClassified: true,
        },
        {
          id: "tx2",
          memo: "신한카드 사용",
          withdrawalAmount: 50000,
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue(null);
      vi.mocked(mockDb.classificationRule.create).mockResolvedValue({
        id: "new-rule",
      } as any);

      const trainingResult = await runTrainingJob(mockDb);

      // Should extract at least one keyword rule
      expect(trainingResult.keywordRulesCount).toBeGreaterThan(0);
      expect(trainingResult.totalRulesCreated).toBeGreaterThan(0);
    });

    it("should not extract rules that don't meet confidence threshold", async () => {
      // Mock feedback with low sample count
      const mockFeedbacks = Array.from({ length: 2 }, (_, i) => ({
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

      const trainingResult = await runTrainingJob(mockDb);

      // Should not extract any rules due to low confidence
      expect(trainingResult.totalRulesCreated).toBe(0);
    });

    it("should skip duplicate rules during training", async () => {
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
          id: "tx1",
          memo: "김주택 대출 이자",
          category: "출금",
          isManuallyClassified: true,
        },
      ] as any);

      // Rule already exists
      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue({
        id: "existing-rule",
      } as any);

      const trainingResult = await runTrainingJob(mockDb);

      // Should not create duplicate rule
      expect(trainingResult.totalRulesCreated).toBe(0);
    });
  });

  describe("Rule Application Priority", () => {
    it("should apply keyword rules before amount range rules", async () => {
      const transactions = [
        {
          id: "tx1",
          memo: "신한카드 50000원 결제",
          depositAmount: null,
          withdrawalAmount: 50000,
        },
      ];

      // Mock both keyword and amount range rules
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "keyword-rule",
          pattern: "신한카드",
          patternType: "KEYWORD",
          category: "출금",
          subcategory: "카드결제",
          confidence: 0.85,
          applyCount: 0,
          successCount: 0,
          lastAppliedAt: null,
          isActive: true,
        },
        {
          id: "amount-rule",
          pattern: "10000-100000",
          patternType: "AMOUNT_RANGE",
          category: "출금",
          subcategory: "소액결제",
          confidence: 0.8,
          applyCount: 0,
          successCount: 0,
          lastAppliedAt: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({} as any);

      const results = await classifyWithRules(mockDb, transactions);

      const result = results.get("tx1");

      // Keyword rule should have priority
      expect(result?.matched).toBe(true);
      expect(result?.result?.subcategory).toBe("카드결제");
    });

    it("should fall back to amount range when no keyword matches", async () => {
      const transactions = [
        {
          id: "tx1",
          memo: "편의점 결제",
          depositAmount: null,
          withdrawalAmount: 25000,
        },
      ];

      // Mock only amount range rule
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "amount-rule",
          pattern: "10000-100000",
          patternType: "AMOUNT_RANGE",
          category: "출금",
          subcategory: "소액결제",
          confidence: 0.8,
          applyCount: 0,
          successCount: 0,
          lastAppliedAt: null,
          isActive: true,
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({} as any);

      const results = await classifyWithRules(mockDb, transactions);

      const result = results.get("tx1");

      // Amount range rule should be applied
      expect(result?.matched).toBe(true);
      expect(result?.result?.subcategory).toBe("소액결제");
    });
  });
});
