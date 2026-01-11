/**
 * Classification Audit Service
 *
 * Story 4.5 CRITICAL #2: Audit logging for regulatory compliance (상사법)
 * - Minimum 7-year retention requirement
 * - Tracks all transaction classification changes (manual edits and restores)
 *
 * This service provides a centralized way to log classification changes for:
 * - Regulatory compliance (상사법)
 * - Security audit trail
 * - User activity tracking
 */

import type { PrismaClient, Prisma } from "@prisma/client";

export type ClassificationAction = "UPDATE" | "RESTORE";

export interface ClassificationChanges {
  before?: {
    category: string | null;
    subcategory: string | null;
    confidenceScore: number | null;
  };
  after: {
    category: string;
    subcategory?: string | null;
    confidenceScore: number;
  };
  original?: {
    category: string | null;
    subcategory: string | null;
    confidenceScore: number | null;
  };
}

export interface LogClassificationChangeInput {
  db: PrismaClient;
  userId: string;
  transactionId: string;
  action: ClassificationAction;
  changes: ClassificationChanges;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs a transaction classification change to the audit log.
 *
 * CRITICAL #2: Regulatory compliance requirement
 * - 상사법 (Bankruptcy Act) requires 7-year retention of audit logs
 * - Must be called for every manual classification change
 *
 * @param input - Audit log input parameters
 * @returns Created audit log entry
 *
 * @example
 * ```typescript
 * await logClassificationChange({
 *   db: ctx.db,
 *   userId: ctx.userId,
 *   transactionId: "tx-123",
 *   action: "UPDATE",
 *   changes: {
 *     before: { category: "입금", subcategory: "이체", confidenceScore: 0.85 },
 *     after: { category: "출금", subcategory: "이체", confidenceScore: 1.0 },
 *     original: { category: "입금", subcategory: "이체", confidenceScore: 0.85 },
 *   },
 *   ipAddress: ctx.ip,
 *   userAgent: ctx.userAgent,
 * });
 * ```
 */
export async function logClassificationChange(
  input: LogClassificationChangeInput
) {
  const { db, userId, transactionId, action, changes, ipAddress, userAgent } =
    input;

  const auditLog = await db.auditLog.create({
    data: {
      userId,
      action: `TRANSACTION_CLASSIFICATION_${action}`,
      entityType: "TRANSACTION_CLASSIFICATION",
      entityId: transactionId,
      changes: changes as unknown as Prisma.InputJsonValue,
      ipAddress,
      userAgent,
    },
  });

  // Console log for development visibility
  console.log(
    `[AuditLog] ${action} transaction classification: ` +
      `User=${userId}, Transaction=${transactionId}, ` +
      `Action=${action}, AuditLogId=${auditLog.id}`
  );

  return auditLog;
}

/**
 * Creates the changes object for classification updates.
 *
 * @param transaction - Current transaction state before update
 * @param newCategory - New category value
 * @param newSubcategory - New subcategory value
 * @returns ClassificationChanges object
 */
export function createUpdateChanges(
  transaction: {
    category: string | null;
    subcategory: string | null;
    confidenceScore: number | null;
  },
  newCategory: string,
  newSubcategory?: string | null
): ClassificationChanges {
  return {
    before: {
      category: transaction.category,
      subcategory: transaction.subcategory,
      confidenceScore: transaction.confidenceScore,
    },
    after: {
      category: newCategory,
      subcategory: newSubcategory,
      confidenceScore: 1.0, // Manual classification always has 100% confidence
    },
    original: {
      category: transaction.category,
      subcategory: transaction.subcategory,
      confidenceScore: transaction.confidenceScore,
    },
  };
}

/**
 * Creates the changes object for classification restores.
 *
 * @param transaction - Current transaction state before restore
 * @returns ClassificationChanges object
 */
export function createRestoreChanges(
  transaction: {
    category: string | null;
    subcategory: string | null;
    originalCategory: string | null;
    originalSubcategory: string | null;
    originalConfidenceScore: number | null;
  }
): ClassificationChanges {
  return {
    before: {
      category: transaction.category,
      subcategory: transaction.subcategory,
      confidenceScore: 1.0, // Currently manually classified
    },
    after: {
      category: transaction.originalCategory ?? "",
      subcategory: transaction.originalSubcategory,
      confidenceScore: transaction.originalConfidenceScore ?? 0.0,
    },
  };
}
