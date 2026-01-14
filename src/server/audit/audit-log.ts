/**
 * Generic Audit Logging Service
 *
 * Epic 7: 분석 결과 내보내기 (Story 7.2)
 *
 * Export 작업의 감사 로그 기록:
 * - EXPORT_TRANSACTIONS: 선택/필터 거래 내보내기
 *
 * AuditLog 레코드 구조:
 * - entityType: "CASE" | "TRANSACTION" | "EXPORT"
 * - action: "EXPORT_TRANSACTIONS" | "EXPORT_FINDINGS" | ...
 * - entityId: caseId
 * - changes: JSON string with export details
 */

import type { PrismaClient } from "~/server/db";

/**
 * Audit Log Service Interface
 */
export const auditLog = {
  /**
   * Create audit log entry
   *
   * @param params - Audit log parameters
   * @param params.action - Action performed (e.g., "EXPORT_TRANSACTIONS")
   * @param params.userId - User who performed the action
   * @param params.caseId - Related case ID
   * @param params.entityType - Entity type (e.g., "CASE", "TRANSACTION")
   * @param params.details - Additional details (will be JSON stringified)
   */
  create: async (params: {
    db: PrismaClient;
    action: string;
    userId: string;
    caseId: string;
    entityType: string;
    details: Record<string, unknown>;
  }) => {
    const { db, action, userId, caseId, entityType, details } = params;

    await db.auditLog.create({
      data: {
        entityType: entityType as any,
        action: action as any,
        entityId: caseId,
        userId,
        caseId,
        changes: JSON.stringify(details),
      },
    });
  },
};
