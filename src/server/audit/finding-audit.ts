/**
 * Finding Audit Logging Service
 *
 * Epic 4: 감사 로그 패턴
 * Epic 6: FindingNote 감사 로그 (Story 6.3)
 * Epic 6: Finding Priority 감사 로그 (Story 6.5)
 *
 * 모든 Finding 관련 작업의 감사 로그 기록:
 * - Finding 생성/해결 (Story 6.1)
 * - FindingNote 생성/수정/삭제 (Story 6.3)
 * - Finding Priority 업데이트/재설정 (Story 6.5)
 *
 * AuditLog 레코드 구조:
 * - entityType: "FINDING" | "FINDING_NOTE" | "FINDING_PRIORITY"
 * - action: "CREATE" | "UPDATE" | "DELETE" | "RESOLVE" | "RESET"
 * - entityId: findingId | noteId
 * - changes: JSON string with details
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Finding 생성 감사 로그
 *
 * Story 6.1: 자동 발견사항 식별
 */
export async function logFindingCreated(params: {
  db: PrismaClient;
  findingId: string;
  caseId: string;
  userId: string;
  findingType: string;
  description?: string;
}) {
  const { db, findingId, caseId, userId, findingType, description } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING",
      action: "CREATE",
      entityId: findingId,
      userId,
      changes: JSON.stringify({
        findingType,
        description,
        caseId,
      }),
    },
  });
}

/**
 * Finding 해결 감사 로그
 *
 * Story 6.1: 자동 발견사항 식별
 */
export async function logFindingResolved(params: {
  db: PrismaClient;
  findingId: string;
  caseId: string;
  userId: string;
}) {
  const { db, findingId, caseId, userId } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING",
      action: "RESOLVE",
      entityId: findingId,
      userId,
      caseId,
      changes: JSON.stringify({
        resolved: true,
        resolvedAt: new Date().toISOString(),
      }),
    },
  });
}

/**
 * FindingNote 생성 감사 로그
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * @param params - FindingNote 생성 파라미터
 * @param params.db - Prisma Client
 * @param params.findingId - Finding ID
 * @param params.noteId - FindingNote ID
 * @param params.userId - 작성자 ID
 * @param params.caseId - Case ID
 * @param params.content - 메모 내용
 */
export async function logFindingNoteCreated(params: {
  db: PrismaClient;
  findingId: string;
  noteId: string;
  userId: string;
  caseId: string;
  content: string;
}) {
  const { db, findingId, noteId, userId, caseId, content } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING_NOTE",
      action: "CREATE",
      entityId: noteId,
      userId,
      caseId,
      changes: JSON.stringify({
        findingId,
        noteId,
        content,
      }),
    },
  });
}

/**
 * FindingNote 수정 감사 로그
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * @param params - FindingNote 수정 파라미터
 * @param params.db - Prisma Client
 * @param params.findingId - Finding ID
 * @param params.noteId - FindingNote ID
 * @param params.userId - 수정자 ID
 * @param params.caseId - Case ID
 * @param params.oldContent - 이전 내용
 * @param params.newContent - 새로운 내용
 */
export async function logFindingNoteUpdated(params: {
  db: PrismaClient;
  findingId: string;
  noteId: string;
  userId: string;
  caseId: string;
  oldContent: string;
  newContent: string;
}) {
  const { db, findingId, noteId, userId, caseId, oldContent, newContent } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING_NOTE",
      action: "UPDATE",
      entityId: noteId,
      userId,
      caseId,
      changes: JSON.stringify({
        findingId,
        noteId,
        oldContent,
        newContent,
      }),
    },
  });
}

/**
 * FindingNote 삭제 감사 로그
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * @param params - FindingNote 삭제 파라미터
 * @param params.db - Prisma Client
 * @param params.findingId - Finding ID
 * @param params.noteId - FindingNote ID
 * @param params.userId - 삭제자 ID
 * @param params.caseId - Case ID
 * @param params.deletedContent - 삭제된 내용
 */
export async function logFindingNoteDeleted(params: {
  db: PrismaClient;
  findingId: string;
  noteId: string;
  userId: string;
  caseId: string;
  deletedContent: string;
}) {
  const { db, findingId, noteId, userId, caseId, deletedContent } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING_NOTE",
      action: "DELETE",
      entityId: noteId,
      userId,
      caseId,
      changes: JSON.stringify({
        findingId,
        noteId,
        deletedContent,
      }),
    },
  });
}

/**
 * Finding Priority 업데이트 감사 로그
 *
 * Story 6.5: 중요도 지정
 *
 * @param params - Finding Priority 업데이트 파라미터
 * @param params.db - Prisma Client
 * @param params.findingId - Finding ID
 * @param params.userId - 업데이트한 사용자 ID
 * @param params.caseId - Case ID
 * @param params.oldPriority - 이전 priority 값 (HIGH|MEDIUM|LOW|null)
 * @param params.newPriority - 새로운 priority 값 (HIGH|MEDIUM|LOW)
 */
export async function logFindingPriorityUpdated(params: {
  db: PrismaClient;
  findingId: string;
  userId: string;
  caseId: string;
  oldPriority: string | null;
  newPriority: string;
}) {
  const { db, findingId, userId, caseId, oldPriority, newPriority } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING_PRIORITY",
      action: "UPDATE",
      entityId: findingId,
      userId,
      caseId,
      changes: JSON.stringify({
        oldPriority,
        newPriority,
      }),
    },
  });
}

/**
 * Finding Priority 재설정 감사 로그
 *
 * Story 6.5: 중요도 지정
 *
 * @param params - Finding Priority 재설정 파라미터
 * @param params.db - Prisma Client
 * @param params.findingId - Finding ID
 * @param params.userId - 재설정한 사용자 ID
 * @param params.caseId - Case ID
 * @param params.oldPriority - 이전 priority 값
 */
export async function logFindingPriorityReset(params: {
  db: PrismaClient;
  findingId: string;
  userId: string;
  caseId: string;
  oldPriority: string | null;
}) {
  const { db, findingId, userId, caseId, oldPriority } = params;

  await db.auditLog.create({
    data: {
      entityType: "FINDING_PRIORITY",
      action: "RESET",
      entityId: findingId,
      userId,
      caseId,
      changes: JSON.stringify({
        oldPriority,
        resetTo: null,
      }),
    },
  });
}
