/**
 * Classification Audit Service Tests
 *
 * Story 4.5 CRITICAL #2: Audit logging for regulatory compliance
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  logClassificationChange,
  createUpdateChanges,
  createRestoreChanges,
} from "./classification-audit";

// Mock Prisma Client
const mockDb = {
  auditLog: {
    create: vi.fn(),
  },
};

describe("Classification Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.auditLog.create.mockResolvedValue({
      id: "audit-123",
      userId: "user-1",
      action: "TRANSACTION_CLASSIFICATION_UPDATE",
      entityType: "TRANSACTION_CLASSIFICATION",
      entityId: "tx-1",
      changes: {},
      createdAt: new Date(),
    });
  });

  describe("logClassificationChange", () => {
    it("should create audit log entry", async () => {
      const input = {
        db: mockDb as any,
        userId: "user-1",
        transactionId: "tx-1",
        action: "UPDATE" as const,
        changes: {
          before: { category: "입금", subcategory: "이체", confidenceScore: 0.85 },
          after: { category: "출금", subcategory: "이체", confidenceScore: 1.0 },
        },
      };

      await logClassificationChange(input);

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          action: "TRANSACTION_CLASSIFICATION_UPDATE",
          entityType: "TRANSACTION_CLASSIFICATION",
          entityId: "tx-1",
          changes: input.changes,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it("should include optional fields", async () => {
      const input = {
        db: mockDb as any,
        userId: "user-1",
        transactionId: "tx-1",
        action: "RESTORE" as const,
        changes: {
          before: { category: "출금", subcategory: "이체", confidenceScore: 1.0 },
          after: { category: "입금", subcategory: "이체", confidenceScore: 0.85 },
        },
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      };

      await logClassificationChange(input);

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          action: "TRANSACTION_CLASSIFICATION_RESTORE",
          entityType: "TRANSACTION_CLASSIFICATION",
          entityId: "tx-1",
          changes: input.changes,
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        },
      });
    });

    it("should return created audit log", async () => {
      const mockAuditLog = {
        id: "audit-123",
        userId: "user-1",
        action: "TRANSACTION_CLASSIFICATION_UPDATE",
        entityType: "TRANSACTION_CLASSIFICATION",
        entityId: "tx-1",
        changes: {},
        createdAt: new Date(),
      };

      mockDb.auditLog.create.mockResolvedValue(mockAuditLog);

      const input = {
        db: mockDb as any,
        userId: "user-1",
        transactionId: "tx-1",
        action: "UPDATE" as const,
        changes: {
          before: { category: "입금", subcategory: "이체", confidenceScore: 0.85 },
          after: { category: "출금", subcategory: "이체", confidenceScore: 1.0 },
        },
      };

      const result = await logClassificationChange(input);

      expect(result).toEqual(mockAuditLog);
    });
  });

  describe("createUpdateChanges", () => {
    it("should create changes object for update", () => {
      const transaction = {
        category: "입금",
        subcategory: "이체",
        confidenceScore: 0.85,
      };

      const changes = createUpdateChanges(transaction, "출금", "이체");

      expect(changes).toEqual({
        before: {
          category: "입금",
          subcategory: "이체",
          confidenceScore: 0.85,
        },
        after: {
          category: "출금",
          subcategory: "이체",
          confidenceScore: 1.0,
        },
        original: {
          category: "입금",
          subcategory: "이체",
          confidenceScore: 0.85,
        },
      });
    });

    it("should handle null subcategory", () => {
      const transaction = {
        category: "입금",
        subcategory: null,
        confidenceScore: 0.85,
      };

      const changes = createUpdateChanges(transaction, "출금", null);

      expect(changes.before.subcategory).toBeNull();
      expect(changes.after.subcategory).toBeNull();
    });
  });

  describe("createRestoreChanges", () => {
    it("should create changes object for restore", () => {
      const transaction = {
        category: "출금",
        subcategory: "이체",
        originalCategory: "입금",
        originalSubcategory: "이체",
        originalConfidenceScore: 0.85,
      };

      const changes = createRestoreChanges(transaction);

      expect(changes).toEqual({
        before: {
          category: "출금",
          subcategory: "이체",
          confidenceScore: 1.0,
        },
        after: {
          category: "입금",
          subcategory: "이체",
          confidenceScore: 0.85,
        },
      });
    });

    it("should fallback to 0.0 when originalConfidenceScore is null", () => {
      const transaction = {
        category: "출금",
        subcategory: "이체",
        originalCategory: "입금",
        originalSubcategory: null,
        originalConfidenceScore: null,
      };

      const changes = createRestoreChanges(transaction);

      expect(changes.after.confidenceScore).toBe(0.0);
    });
  });
});
