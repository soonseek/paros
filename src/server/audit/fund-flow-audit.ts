/**
 * Fund Flow Audit Service
 *
 * MEDIUM #3: Audit logging for fund flow tracing
 * - Tracks all fund flow tracing operations for regulatory compliance
 * - Maintains security audit trail
 * - User activity tracking
 *
 * This service provides a centralized way to log fund flow tracing operations for:
 * - Regulatory compliance (상사법)
 * - Security audit trail
 * - User activity tracking
 */

import type { PrismaClient, Prisma } from "@prisma/client";

export type FundFlowAction = "UPSTREAM_TRACE" | "DOWNSTREAM_TRACE";

export interface FundFlowMetadata {
  transactionId: string;
  caseId: string;
  maxDepth: number;
  amountTolerance: number;
  chainsFound: number;
  totalTransactions: number;
  responseTimeMs: number;
}

export interface LogFundFlowTraceInput {
  db: PrismaClient;
  userId: string;
  action: FundFlowAction;
  metadata: FundFlowMetadata;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs a fund flow tracing operation to the audit log.
 *
 * MEDIUM #3: Regulatory compliance requirement
 * - 상사법 (Bankruptcy Act) requires 7-year retention of audit logs
 * - Must be called for every fund flow tracing operation
 *
 * @param input - Audit log input parameters
 * @returns Created audit log entry
 *
 * @example
 * ```typescript
 * await logFundFlowTrace({
 *   db: ctx.db,
 *   userId: ctx.userId,
 *   action: "UPSTREAM_TRACE",
 *   metadata: {
 *     transactionId: "tx-123",
 *     caseId: "case-456",
 *     maxDepth: 3,
 *     amountTolerance: 0.1,
 *     chainsFound: 2,
 *     totalTransactions: 5,
 *     responseTimeMs: 150,
 *   },
 *   ipAddress: ctx.ip,
 *   userAgent: ctx.userAgent,
 * });
 * ```
 */
export async function logFundFlowTrace(input: LogFundFlowTraceInput) {
  const { db, userId, action, metadata, ipAddress, userAgent } = input;

  const auditLog = await db.auditLog.create({
    data: {
      userId,
      action: `FUND_FLOW_${action}`,
      entityType: "FUND_FLOW_TRACE",
      entityId: metadata.transactionId,
      changes: metadata as unknown as Prisma.InputJsonValue,
      ipAddress,
      userAgent,
    },
  });

  // Console log for development visibility
  console.log(
    `[AuditLog] ${action} fund flow trace: ` +
      `User=${userId}, Transaction=${metadata.transactionId}, ` +
      `Case=${metadata.caseId}, Chains=${metadata.chainsFound}, ` +
      `ResponseTime=${metadata.responseTimeMs}ms, AuditLogId=${auditLog.id}`
  );

  return auditLog;
}
