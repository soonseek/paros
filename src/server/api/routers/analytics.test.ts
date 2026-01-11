/**
 * Unit Tests for Learning Analytics API
 *
 * Story 4.8: Learning Feedback Loop
 *
 * Tests the analytics router that provides learning statistics
 * and rule management endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { analyticsRouter } from "./analytics";

describe("Analytics Router", () => {
  let mockDb: PrismaClient;
  let mockCtx: any;

  beforeEach(() => {
    // Mock PrismaClient
    mockDb = {
      user: {
        findUnique: vi.fn(),
      },
      classificationRule: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      classificationFeedback: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      classificationError: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Mock context
    mockCtx = {
      db: mockDb,
      userId: "test-user-id",
    };
  });

  describe("getLearningStats", () => {
    it("should return learning statistics for admin users", async () => {
      // Mock admin user
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      // Mock statistics
      vi.mocked(mockDb.classificationRule.count).mockResolvedValue(10);
      vi.mocked(mockDb.classificationRule.count).mockResolvedValueOnce(7).mockResolvedValueOnce(3);
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "rule1",
          pattern: "김주택",
          applyCount: 100,
          successCount: 95,
        },
      ] as any);

      vi.mocked(mockDb.classificationFeedback.count).mockResolvedValue(50);
      vi.mocked(mockDb.classificationFeedback.count).mockResolvedValueOnce(15);
      vi.mocked(mockDb.classificationFeedback.groupBy).mockResolvedValue([
        { _count: 10, userCategory: "출금" },
        { _count: 8, userCategory: "입금" },
      ] as any);

      vi.mocked(mockDb.classificationError.count).mockResolvedValue(3);
      vi.mocked(mockDb.classificationError.count).mockResolvedValueOnce(1);
      vi.mocked(mockDb.classificationError.groupBy).mockResolvedValue([
        { _count: 2, errorType: "WRONG_CATEGORY" },
      ] as any);

      const caller = analyticsRouter.createCaller(mockCtx);
      const result = await caller.getLearningStats();

      expect(result).toHaveProperty("rules");
      expect(result).toHaveProperty("feedbacks");
      expect(result).toHaveProperty("errors");
      expect(result.rules.total).toBe(10);
      expect(result.feedbacks.total).toBe(50);
      expect(result.errors.total).toBe(3);
    });

    it("should throw FORBIDDEN error for non-admin users", async () => {
      // Mock non-admin user
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "PARALEGAL",
      } as any);

      const caller = analyticsRouter.createCaller(mockCtx);

      await expect(caller.getLearningStats()).rejects.toThrow(TRPCError);
    });

    it("should handle empty statistics gracefully", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      // Mock empty statistics
      vi.mocked(mockDb.classificationRule.count).mockResolvedValue(0);
      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([]);
      vi.mocked(mockDb.classificationFeedback.count).mockResolvedValue(0);
      vi.mocked(mockDb.classificationError.count).mockResolvedValue(0);

      const caller = analyticsRouter.createCaller(mockCtx);
      const result = await caller.getLearningStats();

      expect(result.rules.total).toBe(0);
      expect(result.feedbacks.total).toBe(0);
      expect(result.errors.total).toBe(0);
    });
  });

  describe("getClassificationRules", () => {
    it("should return paginated list of classification rules", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([
        {
          id: "rule1",
          pattern: "김주택",
          patternType: "KEYWORD",
          category: "출금",
          subcategory: "대출이자",
          confidence: 0.9,
          applyCount: 100,
          successCount: 95,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      vi.mocked(mockDb.classificationRule.count).mockResolvedValue(1);

      const caller = analyticsRouter.createCaller(mockCtx);
      const result = await caller.getClassificationRules({
        page: 1,
        pageSize: 20,
      });

      expect(result).toHaveProperty("rules");
      expect(result).toHaveProperty("pagination");
      expect(result.pagination).toHaveProperty("totalCount");
      expect(result.pagination).toHaveProperty("page");
      expect(result.pagination).toHaveProperty("pageSize");
    });

    it("should filter by pattern type when specified", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([] as any);
      vi.mocked(mockDb.classificationRule.count).mockResolvedValue(0);

      const caller = analyticsRouter.createCaller(mockCtx);
      await caller.getClassificationRules({
        patternType: "KEYWORD",
        page: 1,
        pageSize: 20,
      });

      expect(mockDb.classificationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patternType: "KEYWORD",
          }),
        })
      );
    });

    it("should filter by active status when specified", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      vi.mocked(mockDb.classificationRule.findMany).mockResolvedValue([] as any);
      vi.mocked(mockDb.classificationRule.count).mockResolvedValue(0);

      const caller = analyticsRouter.createCaller(mockCtx);
      await caller.getClassificationRules({
        isActive: true,
        page: 1,
        pageSize: 20,
      });

      expect(mockDb.classificationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });
  });

  describe("toggleClassificationRule", () => {
    it("should toggle rule active status", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue({
        id: "rule1",
        isActive: true,
      } as any);

      vi.mocked(mockDb.classificationRule.update).mockResolvedValue({
        id: "rule1",
        isActive: false,
      } as any);

      const caller = analyticsRouter.createCaller(mockCtx);
      const result = await caller.toggleClassificationRule({
        ruleId: "rule1",
      });

      expect(result).toHaveProperty("id", "rule1");
      expect(result.isActive).toBe(false);
    });

    it("should throw error when rule not found", async () => {
      vi.mocked(mockDb.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        role: "ADMIN",
      } as any);

      vi.mocked(mockDb.classificationRule.findFirst).mockResolvedValue(null);

      const caller = analyticsRouter.createCaller(mockCtx);

      await expect(
        caller.toggleClassificationRule({
          ruleId: "non-existent-rule",
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
