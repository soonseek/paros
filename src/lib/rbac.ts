/**
 * RBAC (Role-Based Access Control) Helper Functions
 *
 * 역할 기반 접근 제어를 위한 유틸리티 함수들
 * 파산 사건 관리 시스템에서 변호사가 자신의 사건에만 접근할 수 있도록 제어
 */

import { db } from "~/server/db";

/**
 * 사용자가 특정 사건에 접근할 수 있는지 확인
 *
 * @param userId - 확인하려는 사용자 ID
 * @param caseId - 접근하려는 사건 ID
 * @returns true if user can access the case, false otherwise
 *
 * **RBAC Rules:**
 * - ADMIN: 모든 사건 접근 가능
 * - LAWYER/PARALEGAL/SUPPORT: 자신이 소유한 사건만 접근 가능
 * - isActive=false인 사용자는 접근 불가
 */
export async function canAccessCase(
  userId: string,
  caseId: string
): Promise<boolean> {
  // Get user with role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  // User must exist and be active
  if (!user?.isActive) {
    return false;
  }

  // ADMIN can access all cases
  if (user.role === "ADMIN") {
    return true;
  }

  // LAWYER, PARALEGAL, SUPPORT can only access their own cases
  const caseCount = await db.case.count({
    where: {
      id: caseId,
      lawyerId: userId,
    },
  });

  return caseCount > 0;
}

/**
 * 사용자가 특정 사건을 수정할 수 있는지 확인
 *
 * @param userId - 확인하려는 사용자 ID
 * @param caseId - 수정하려는 사건 ID
 * @returns true if user can modify the case, false otherwise
 *
 * **RBAC Rules:**
 * - ADMIN: 모든 사건 수정 가능
 * - LAWYER: 자신이 소유한 사건만 수정 가능
 * - PARALEGAL/SUPPORT: 수정 권한 없음
 * - isActive=false인 사용자는 수정 불가
 */
export async function canModifyCase(
  userId: string,
  caseId: string
): Promise<boolean> {
  // Get user with role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  // User must exist and be active
  if (!user?.isActive) {
    return false;
  }

  // ADMIN can modify all cases
  if (user.role === "ADMIN") {
    return true;
  }

  // Only LAWYER can modify their own cases
  if (user.role !== "LAWYER") {
    return false;
  }

  // Check if case belongs to this lawyer
  const caseCount = await db.case.count({
    where: {
      id: caseId,
      lawyerId: userId,
    },
  });

  return caseCount > 0;
}

/**
 * 사용자가 CaseNote를 추가/수정/삭제할 수 있는지 확인
 *
 * @param userId - 확인하려는 사용자 ID
 * @param caseId - 사건 ID
 * @param noteAuthorId - CaseNote의 작성자 ID (수정/삭제 시 필요)
 * @returns true if user can manage the note, false otherwise
 *
 * **RBAC Rules:**
 * - ADMIN: 모든 CaseNote 관리 가능
 * - LAWYER: 자신의 사건의 CaseNote만 추가 가능, 자신이 작성한 note만 수정/삭제 가능
 * - PARALEGAL/SUPPORT: 자신이 작성한 note만 수정/삭제 가능
 * - isActive=false인 사용자는 관리 불가
 */
export async function canManageCaseNote(
  userId: string,
  caseId: string,
  noteAuthorId?: string
): Promise<boolean> {
  // Get user with role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  // User must exist and be active
  if (!user?.isActive) {
    return false;
  }

  // ADMIN can manage all notes
  if (user.role === "ADMIN") {
    return true;
  }

  // Check if user can access the case
  const hasCaseAccess = await canAccessCase(userId, caseId);
  if (!hasCaseAccess) {
    return false;
  }

  // For adding new notes, LAWYER, PARALEGAL, SUPPORT can add notes to cases they can access
  if (!noteAuthorId) {
    return user.role === "LAWYER" || user.role === "PARALEGAL" || user.role === "SUPPORT";
  }

  // For modifying/deleting notes, only the note author can modify their own notes
  // (except ADMIN who can do anything)
  return userId === noteAuthorId;
}

/**
 * 사용자가 사건 목록을 조회할 수 있는지 확인
 *
 * @param userId - 확인하려는 사용자 ID
 * @param lawyerId - 조회하려는 사건의 변호사 ID
 * @returns true if user can view the case list, false otherwise
 *
 * **RBAC Rules:**
 * - ADMIN: 모든 사용자의 사건 목록 조회 가능
 * - LAWYER/PARALEGAL/SUPPORT: 자신의 사건 목록만 조회 가능
 * - isActive=false인 사용자는 조회 불가
 */
export async function canViewCaseList(
  userId: string,
  lawyerId: string
): Promise<boolean> {
  // Get user with role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  // User must exist and be active
  if (!user?.isActive) {
    return false;
  }

  // ADMIN can view all case lists
  if (user.role === "ADMIN") {
    return true;
  }

  // LAWYER, PARALEGAL, SUPPORT can only view their own cases
  return userId === lawyerId;
}

/**
 * tRPC middleware에서 사용하는 권한 검증 함수
 *
 * 사용자가 인증되어 있고 활성 상태인지 확인
 *
 * @param userId - tRPC context의 userId
 * @throws TRPCError if user not found or inactive
 */
export async function requireActiveUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("User account is inactive");
  }

  return user;
}
