/**
 * FindingNote Service
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * FindingNote 비즈니스 로직:
 * - createNote: 메모 생성 (Finding 존재 확인, 감사 로그)
 * - updateNote: 메모 수정 (소유권 검증, 감사 로그)
 * - deleteNote: 메모 삭제 (소유권 검증, 감사 로그)
 *
 * 보안:
 * - RBAC: Finding 접근 권한 검증
 * - 소유권 검증: 자신의 메모만 수정/삭제 가능
 *
 * 감사 로그: 모든 작업 기록 (Epic 4 패턴)
 */

import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "~/server/db";
import {
  logFindingNoteCreated,
  logFindingNoteUpdated,
  logFindingNoteDeleted,
} from "~/server/audit/finding-audit";

/**
 * FindingNote 생성
 *
 * AC2: 메모 생성 기능
 *
 * @param db - Prisma Client
 * @param input - 생성 입력
 * @param input.findingId - Finding ID
 * @param input.content - 메모 내용 (1-5000자)
 * @param input.userId - 작성자 ID
 * @returns 생성된 FindingNote
 * @throws NOT_FOUND if Finding not found
 * @throws BAD_REQUEST if content is empty
 */
export async function createNote(params: {
  db: PrismaClient;
  input: {
    findingId: string;
    content: string;
    userId: string;
  };
}) {
  const { db, input } = params;
  const { findingId, content, userId } = input;

  // 1. 입력 검증
  if (!content || content.trim().length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "메모 내용을 입력해주세요.",
    });
  }

  if (content.length > 5000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "메모 내용은 5000자 이하여야 합니다.",
    });
  }

  // 2. Finding 존재 확인 및 접근 권한 검증
  const finding = await db.finding.findUnique({
    where: { id: findingId },
    include: {
      case: true,
    },
  });

  if (!finding) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "발견사항을 찾을 수 없습니다.",
    });
  }

  // 3. RBAC: Case lawyer 또는 Admin만 메모 추가 가능
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  if (finding.case.lawyerId !== userId && user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "메모 추가 권한이 없습니다.",
    });
  }

  // 4. FindingNote 생성
  const note = await db.findingNote.create({
    data: {
      findingId,
      content: content.trim(),
      createdBy: userId,
    },
  });

  // 5. 감사 로그 기록
  await logFindingNoteCreated({
    db,
    findingId,
    noteId: note.id,
    userId,
    caseId: finding.caseId,
    content: note.content,
  });

  return note;
}

/**
 * FindingNote 수정
 *
 * AC3: 메모 수정 기능
 *
 * @param db - Prisma Client
 * @param input - 수정 입력
 * @param input.noteId - FindingNote ID
 * @param input.content - 새로운 메모 내용 (1-5000자)
 * @param input.userId - 수정자 ID
 * @returns 수정된 FindingNote
 * @throws NOT_FOUND if FindingNote not found
 * @throws FORBIDDEN if user is not the owner
 * @throws BAD_REQUEST if content is empty
 */
export async function updateNote(params: {
  db: PrismaClient;
  input: {
    noteId: string;
    content: string;
    userId: string;
  };
}) {
  const { db, input } = params;
  const { noteId, content, userId } = input;

  // 1. 입력 검증
  if (!content || content.trim().length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "메모 내용을 입력해주세요.",
    });
  }

  if (content.length > 5000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "메모 내용은 5000자 이하여야 합니다.",
    });
  }

  // 2. FindingNote 조회 (Finding 정보 포함)
  const note = await db.findingNote.findUnique({
    where: { id: noteId },
    include: {
      finding: {
        include: {
          case: true,
        },
      },
    },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "메모를 찾을 수 없습니다.",
    });
  }

  // 3. 소유권 검증: 자신의 메모만 수정 가능
  if (note.createdBy !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "자신의 메모만 수정할 수 있습니다.",
    });
  }

  // 4. RBAC: Case 접근 권한 검증
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  if (note.finding.case.lawyerId !== userId && user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "메모 수정 권한이 없습니다.",
    });
  }

  // 5. FindingNote 업데이트 (updatedAt은 Prisma @updatedAt 자동 업데이트)
  const oldContent = note.content;
  const updatedNote = await db.findingNote.update({
    where: { id: noteId },
    data: {
      content: content.trim(),
    },
  });

  // 6. 감사 로그 기록
  await logFindingNoteUpdated({
    db,
    findingId: note.findingId,
    noteId,
    userId,
    caseId: note.finding.caseId,
    oldContent,
    newContent: updatedNote.content,
  });

  return updatedNote;
}

/**
 * FindingNote 삭제
 *
 * AC4: 메모 삭제 기능
 *
 * @param db - Prisma Client
 * @param input - 삭제 입력
 * @param input.noteId - FindingNote ID
 * @param input.userId - 삭제자 ID
 * @throws NOT_FOUND if FindingNote not found
 * @throws FORBIDDEN if user is not the owner
 */
export async function deleteNote(params: {
  db: PrismaClient;
  input: {
    noteId: string;
    userId: string;
  };
}) {
  const { db, input } = params;
  const { noteId, userId } = input;

  // 1. FindingNote 조회 (Finding 정보 포함)
  const note = await db.findingNote.findUnique({
    where: { id: noteId },
    include: {
      finding: {
        include: {
          case: true,
        },
      },
    },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "메모를 찾을 수 없습니다.",
    });
  }

  // 2. 소유권 검증: 자신의 메모만 삭제 가능
  if (note.createdBy !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "자신의 메모만 삭제할 수 있습니다.",
    });
  }

  // 3. RBAC: Case 접근 권한 검증
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  if (note.finding.case.lawyerId !== userId && user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "메모 삭제 권한이 없습니다.",
    });
  }

  // 4. FindingNote 삭제
  await db.findingNote.delete({
    where: { id: noteId },
  });

  // 5. 감사 로그 기록
  await logFindingNoteDeleted({
    db,
    findingId: note.findingId,
    noteId,
    userId,
    caseId: note.finding.caseId,
    deletedContent: note.content,
  });

  return { success: true };
}
