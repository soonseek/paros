/**
 * Role-Based Access Control (RBAC) Helpers
 *
 * Story 4.5 HIGH #1: Centralized RBAC validation
 * - Clarifies role permissions for transaction access
 * - Eliminates code duplication across mutations
 *
 * Role Permissions:
 * - ADMIN: Full access to all resources
 * - LAWYER: Full access to own cases (lawyerId === userId)
 * - PARALEGAL: Read-only access to own cases
 * - SUPPORT: Read-only access to all cases (for support purposes)
 */

import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";

export interface TransactionAccessParams {
  userId: string;
  userRole: Role;
  caseLawyerId: string;
}

export interface RBACResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks if a user has permission to access/modify a transaction.
 *
 * Role Permissions:
 * - ADMIN: Can access any transaction
 * - LAWYER: Can access transactions in own cases
 * - PARALEGAL: Read-only access to own cases (use canReadTransaction for reads)
 * - SUPPORT: Read-only access to all cases (use canReadTransaction for reads)
 *
 * @param params - Access parameters
 * @returns Access result with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * const access = checkTransactionAccess({
 *   userId: ctx.userId,
 *   userRole: user.role,
 *   caseLawyerId: transaction.document.case.lawyerId,
 * });
 *
 * if (!access.allowed) {
 *   throw new TRPCError({ code: "FORBIDDEN", message: access.reason });
 * }
 * ```
 */
export function checkTransactionAccess(params: TransactionAccessParams): RBACResult {
  const { userId, userRole, caseLawyerId } = params;

  // ADMIN: Full access
  if (userRole === "ADMIN") {
    return { allowed: true };
  }

  // LAWYER: Can access own cases
  if (userRole === "LAWYER") {
    if (caseLawyerId === userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "변호사는 자신의 사건 거래만 접근할 수 있습니다.",
    };
  }

  // PARALEGAL: Read-only, no write access
  if (userRole === "PARALEGAL") {
    return {
      allowed: false,
      reason: "패리리걸은 읽기 전용 권한만 가지고 있습니다.",
    };
  }

  // SUPPORT: Read-only, no write access
  if (userRole === "SUPPORT") {
    return {
      allowed: false,
      reason: "지원팀은 읽기 전용 권한만 가지고 있습니다.",
    };
  }

  return {
    allowed: false,
    reason: "알 수 없는 역할입니다.",
  };
}

/**
 * Checks if a user has read-only access to a transaction.
 *
 * Role Permissions (Read):
 * - ADMIN: Can read any transaction
 * - LAWYER: Can read own cases
 * - PARALEGAL: Can read any case (for support/documentation purposes)
 * - SUPPORT: Can read any case (for support purposes)
 *
 * @param params - Access parameters
 * @returns Access result with allowed flag and optional reason
 */
export function checkTransactionReadAccess(
  params: TransactionAccessParams
): RBACResult {
  const { userId, userRole, caseLawyerId } = params;

  // ADMIN: Full read access
  if (userRole === "ADMIN") {
    return { allowed: true };
  }

  // PARALEGAL: Full read access for case support/documentation
  if (userRole === "PARALEGAL") {
    return { allowed: true };
  }

  // SUPPORT: Full read access for support purposes
  if (userRole === "SUPPORT") {
    return { allowed: true };
  }

  // LAWYER: Can read own cases
  if (userRole === "LAWYER") {
    if (caseLawyerId === userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "변호사는 자신의 사건 거래만 조회할 수 있습니다.",
    };
  }

  return {
    allowed: false,
    reason: "알 수 없는 역할입니다.",
  };
}

/**
 * Throws a TRPCError if access is denied.
 *
 * Convenience wrapper around checkTransactionAccess for use in procedures.
 *
 * @param params - Access parameters
 * @throws FORBIDDEN if access is denied
 *
 * @example
 * ```typescript
 * assertTransactionAccess({
 *   userId: ctx.userId,
 *   userRole: user.role,
 *   caseLawyerId: transaction.document.case.lawyerId,
 * });
 * ```
 */
export function assertTransactionAccess(params: TransactionAccessParams): void {
  const result = checkTransactionAccess(params);

  if (!result.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: result.reason || "접근 권한이 없습니다.",
    });
  }
}

/**
 * Throws a TRPCError if read access is denied.
 *
 * Convenience wrapper around checkTransactionReadAccess for use in procedures.
 *
 * @param params - Access parameters
 * @throws FORBIDDEN if access is denied
 */
export function assertTransactionReadAccess(params: TransactionAccessParams): void {
  const result = checkTransactionReadAccess(params);

  if (!result.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: result.reason || "조회 권한이 없습니다.",
    });
  }
}
