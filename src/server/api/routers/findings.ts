/**
 * Findings Router
 *
 * Story 4.3: 중요 거래 자동 식별
 * Story 6.1: 자동 발견사항 식별
 *
 * Finding 관리 tRPC 프로시저:
 * - getFindingsForCase: 특정 사건의 Finding 목록 조회
 * - resolveFinding: Finding 해결 처리
 * - analyzeFindings: 자동 발견사항 분석 (Story 6.1)
 *
 * RBAC:
 * - Case lawyer 또는 Admin만 Finding 해결 가능
 * - Viewer는 조회만 가능
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { analyzeFindings } from "~/server/services/finding-service";
import {
  createNote,
  updateNote,
  deleteNote,
} from "~/server/services/finding-note-service";
import {
  extractUniqueCreditors,
} from "~/server/services/creditor-service";
import {
  logFindingPriorityUpdated,
  logFindingPriorityReset,
} from "~/server/audit/finding-audit";

/**
 * Findings Router
 */
export const findingsRouter = createTRPCRouter({
  /**
   * 특정 사건의 Finding 목록을 조회합니다.
   *
   * QUERY /api/trpc/findings.getFindingsForCase
   *
   * @param caseId - 사건 ID
   * @param includeResolved - 해결된 Finding 포함 여부 (기본값: false)
   * @returns Finding 목록
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   */
  getFindingsForCase: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        includeResolved: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, includeResolved } = input;
      const userId = ctx.userId;

      // 1. 사건 조회 및 권한 확인
      const caseData = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 사건을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer, Admin, 또는 Paralegal만 조회 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (caseData.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Finding 조회 권한이 없습니다.",
        });
      }

      // 3. Finding 목록 조회
      const findings = await ctx.db.finding.findMany({
        where: {
          caseId,
          ...(includeResolved ? {} : { isResolved: false }),
        },
        include: {
          transaction: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });

      return findings;
    }),

  /**
   * 발견사항 자동 분석 (Story 6.1, AC4)
   *
   * MUTATION /api/trpc/findings.analyzeFindings
   *
   * Acceptance Criteria:
   * - AC4: 사건의 모든 거래를 분석하여 Finding 레코드 생성
   * - AC4: 중복 방지 (caseId + findingType + relatedTransactionIds 조합)
   * - AC4: 분석 완료 후 생성된 Finding 개수 반환
   * - AC4: 분석 시간 30초 이내 (NFR-002)
   *
   * @param caseId - 사건 ID
   * @returns 생성된 Finding 개수 및 분석 시간
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   */
  analyzeFindings: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId } = input;
      const userId = ctx.userId;

      // 1. 사건 조회 및 권한 확인
      const caseData = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 사건을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 분석 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (caseData.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "발견사항 분석 권한이 없습니다.",
        });
      }

      // 3. Finding 분석 서비스 호출
      const result = await analyzeFindings({
        db: ctx.db,
        caseId,
        userId,
      });

      console.log(
        `[Findings Router] Finding 분석 완료: ${result.findingsCreated}개 생성됨 (${result.analysisDuration}ms) by ${userId}`
      );

      return {
        findingsCreated: result.findingsCreated,
        analysisDuration: result.analysisDuration,
      };
    }),

  /**
   * Finding을 해결 처리합니다.
   *
   * MUTATION /api/trpc/findings.resolveFinding
   *
   * @param findingId - Finding ID
   * @returns 업데이트된 Finding
   *
   * @throws NOT_FOUND if finding not found
   * @throws FORBIDDEN if user lacks permission
   */
  resolveFinding: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId } = input;
      const userId = ctx.userId;

      // 1. Finding 조회
      const finding = await ctx.db.finding.findUnique({
        where: { id: findingId },
        include: {
          case: true,
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 Finding을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 해결 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (finding.case.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Finding 해결 권한이 없습니다.",
        });
      }

      // 이미 해결된 경우
      if (finding.isResolved) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 해결된 Finding입니다.",
        });
      }

      // 3. Finding 해결 처리
      const updatedFinding = await ctx.db.finding.update({
        where: { id: findingId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });

      console.log(
        `[Findings Router] Finding 해결됨: ${findingId} by ${userId}`
      );

      return updatedFinding;
    }),

  /**
   * Finding을 미해결 상태로 되돌립니다.
   *
   * MUTATION /api/trpc/findings.unresolveFinding
   *
   * @param findingId - Finding ID
   * @returns 업데이트된 Finding
   *
   * @throws NOT_FOUND if finding not found
   * @throws FORBIDDEN if user lacks permission
   */
  unresolveFinding: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId } = input;
      const userId = ctx.userId;

      // 1. Finding 조회
      const finding = await ctx.db.finding.findUnique({
        where: { id: findingId },
        include: {
          case: true,
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 Finding을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (finding.case.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Finding 상태 변경 권한이 없습니다.",
        });
      }

      // 이미 미해결 상태인 경우
      if (!finding.isResolved) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 미해결 상태인 Finding입니다.",
        });
      }

      // 3. Finding 미해결 처리
      const updatedFinding = await ctx.db.finding.update({
        where: { id: findingId },
        data: {
          isResolved: false,
          resolvedAt: null,
        },
      });

      console.log(
        `[Findings Router] Finding 미해결 상태로 변경됨: ${findingId} by ${userId}`
      );

      return updatedFinding;
    }),

  /**
   * 특정 사건의 Finding 통계를 조회합니다.
   *
   * QUERY /api/trpc/findings.getFindingStats
   *
   * @param caseId - 사건 ID
   * @returns Finding 통계
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   */
  getFindingStats: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId } = input;
      const userId = ctx.userId;

      // 1. 사건 조회 및 권한 확인
      const caseData = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 사건을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer, Admin, 또는 Paralegal만 조회 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (caseData.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Finding 통계 조회 권한이 없습니다.",
        });
      }

      // 3. Finding 통계 조회
      const [totalCount, resolvedCount, byType, bySeverity] =
        await Promise.all([
          ctx.db.finding.count({ where: { caseId } }),
          ctx.db.finding.count({ where: { caseId, isResolved: true } }),
          ctx.db.finding.groupBy({
            by: ["findingType"],
            where: { caseId },
            _count: true,
          }),
          ctx.db.finding.groupBy({
            by: ["severity"],
            where: { caseId },
            _count: true,
          }),
        ]);

      return {
        total: totalCount,
        resolved: resolvedCount,
        unresolved: totalCount - resolvedCount,
        byType: byType.reduce(
          (acc, item) => {
            acc[item.findingType] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
        bySeverity: bySeverity.reduce(
          (acc, item) => {
            acc[item.severity] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      };
    }),

  /**
   * FindingNote 추가 (Story 6.3, AC2)
   *
   * MUTATION /api/trpc/findings.addNote
   *
   * Acceptance Criteria:
   * - AC2: FindingNote 테이블에 메모 레코드 생성
   * - AC2: 메모와 함께 작성자와 작성일시 저장
   * - AC2: 메모 목록에 새 메모 표시
   *
   * @param findingId - Finding ID
   * @param content - 메모 내용 (1-5000자)
   * @returns 생성된 FindingNote
   *
   * @throws NOT_FOUND if Finding not found
   * @throws BAD_REQUEST if content is empty
   * @throws FORBIDDEN if user lacks permission
   */
  addNote: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
        content: z.string().min(1, "메모 내용은 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, content } = input;
      const userId = ctx.userId;

      // FindingNote 서비스 호출
      const note = await createNote({
        db: ctx.db,
        input: {
          findingId,
          content,
          userId,
        },
      });

      console.log(
        `[Findings Router] FindingNote 생성됨: ${note.id} for Finding ${findingId} by ${userId}`
      );

      return note;
    }),

  /**
   * FindingNote 수정 (Story 6.3, AC3)
   *
   * MUTATION /api/trpc/findings.updateNote
   *
   * Acceptance Criteria:
   * - AC3: 메모 업데이트 및 수정일시 기록
   * - AC3: 자신의 메모만 수정 가능
   *
   * @param noteId - FindingNote ID
   * @param content - 새로운 메모 내용 (1-5000자)
   * @returns 수정된 FindingNote
   *
   * @throws NOT_FOUND if FindingNote not found
   * @throws BAD_REQUEST if content is empty
   * @throws FORBIDDEN if user is not the owner
   */
  updateNote: protectedProcedure
    .input(
      z.object({
        noteId: z.string().min(1, "메모 ID는 필수 항목입니다"),
        content: z.string().min(1, "메모 내용은 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { noteId, content } = input;
      const userId = ctx.userId;

      // FindingNote 서비스 호출
      const updatedNote = await updateNote({
        db: ctx.db,
        input: {
          noteId,
          content,
          userId,
        },
      });

      console.log(
        `[Findings Router] FindingNote 수정됨: ${noteId} by ${userId}`
      );

      return updatedNote;
    }),

  /**
   * FindingNote 삭제 (Story 6.3, AC4)
   *
   * MUTATION /api/trpc/findings.deleteNote
   *
   * Acceptance Criteria:
   * - AC4: FindingNote 테이블에서 삭제
   * - AC4: 자신의 메모만 삭제 가능
   *
   * @param noteId - FindingNote ID
   * @returns 성공 메시지
   *
   * @throws NOT_FOUND if FindingNote not found
   * @throws FORBIDDEN if user is not the owner
   */
  deleteNote: protectedProcedure
    .input(
      z.object({
        noteId: z.string().min(1, "메모 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { noteId } = input;
      const userId = ctx.userId;

      // FindingNote 서비스 호출
      const result = await deleteNote({
        db: ctx.db,
        input: {
          noteId,
          userId,
        },
      });

      console.log(
        `[Findings Router] FindingNote 삭제됨: ${noteId} by ${userId}`
      );

      return result;
    }),

  /**
   * Finding의 메모 목록 조회 (Story 6.3, AC6)
   *
   * QUERY /api/trpc/findings.getNotesForFinding
   *
   * Acceptance Criteria:
   * - AC6: 메모 목록 최신순 표시
   * - AC6: 작성자, 내용, 작성일시 표시
   * - AC6: 자신의 메모만 수정/삭제 버튼 표시
   *
   * @param findingId - Finding ID
   * @returns FindingNote 목록 (작성자 정보 포함)
   *
   * @throws NOT_FOUND if Finding not found
   * @throws FORBIDDEN if user lacks permission
   */
  getNotesForFinding: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { findingId } = input;
      const userId = ctx.userId;

      // 1. Finding 존재 확인 및 권한 검증
      const finding = await ctx.db.finding.findUnique({
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

      // 2. RBAC: Case lawyer 또는 Admin만 조회 가능
      const user = await ctx.db.user.findUnique({
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
          message: "메모 조회 권한이 없습니다.",
        });
      }

      // 3. FindingNote 목록 조회 (최신순)
      const notes = await ctx.db.findingNote.findMany({
        where: {
          findingId,
        },
        include: {
          // createdBy는 User ID이므로 User 정보 조회
        },
        orderBy: {
          createdAt: "desc", // 최신순
        },
      });

      // 4. 작성자 정보 일괄 조회 (N+1 방지)
      const userIds = [...new Set(notes.map((note) => note.createdBy))];
      const users = await ctx.db.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // 5. 작성자 정보 포함하여 반환
      const notesWithUsers = notes.map((note) => ({
        ...note,
        createdByUser: userMap.get(note.createdBy),
      }));

      return notesWithUsers;
    }),

  /**
   * Story 6.4 Task 2: 사건의 고유 채권자명 목록 조회
   *
   * QUERY /api/trpc/findings.getUniqueCreditors
   *
   * Acceptance Criteria:
   * - AC1: 사건 내 모든 채권자명 목록 제공
   * - AC1: 알파벳순 정렬
   *
   * @param caseId - 사건 ID
   * @returns 고유 채권자명 배열
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   */
  getUniqueCreditors: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId } = input;
      const userId = ctx.userId;

      // 1. 사건 조회 및 권한 확인
      const caseData = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 사건을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer, Admin, 또는 Paralegal만 조회 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      if (caseData.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "채권자 목록 조회 권한이 없습니다.",
        });
      }

      // 3. 고유 채권자명 추출
      const creditors = await extractUniqueCreditors({
        db: ctx.db,
        caseId,
      });

      return creditors;
    }),

  // Note: 채권자별 필터링은 FindingList 컴포넌트에서 클라이언트 사이드로 수행됩니다.
  // 서버사이드 필터링은 Prisma JSON 필드 제약사항으로 인해 현재 구현되지 않았습니다.
  // 향후 성능 최적화가 필요한 경우, 채권자명을 별도 테이블로 분리하여 검색 기능을 구현할 수 있습니다.
  // (Task 7.2: getFindingsByCreditors 절차 제거 - 미사용 코드 정리)

  /**
   * Story 6.5: Finding Priority 업데이트
   *
   * MUTATION /api/trpc/findings.updatePriority
   *
   * Acceptance Criteria:
   * - AC2: Finding의 priority 필드 업데이트
   * - AC2: 업데이트된 중요도가 즉시 반영됨
   *
   * @param findingId - Finding ID
   * @param priority - 새로운 priority ("HIGH" | "MEDIUM" | "LOW")
   * @returns 업데이트된 Finding
   *
   * @throws NOT_FOUND if finding not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if priority value is invalid
   */
  updatePriority: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"], {
          errorMap: () => ({ message: "유효하지 않은 중요도 값입니다. HIGH, MEDIUM, LOW 중 하나여야 합니다." }),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, priority } = input;
      const userId = ctx.userId;

      // 1. Finding 조회
      const finding = await ctx.db.finding.findUnique({
        where: { id: findingId },
        include: {
          case: true,
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 Finding을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 가능
      const user = await ctx.db.user.findUnique({
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
          message: "Finding 중요도 수정 권한이 없습니다.",
        });
      }

      // 3. Priority 업데이트
      const oldPriority = finding.priority;
      const updatedFinding = await ctx.db.finding.update({
        where: { id: findingId },
        data: {
          priority,
        },
      });

      // 4. 감사 로그 기록
      await logFindingPriorityUpdated({
        db: ctx.db,
        findingId,
        userId,
        caseId: finding.caseId,
        oldPriority,
        newPriority: priority,
      });

      console.log(
        `[Findings Router] Finding priority 업데이트됨: ${findingId} (${oldPriority} → ${priority}) by ${userId}`
      );

      return updatedFinding;
    }),

  /**
   * Story 6.5: Finding Priority 재설정
   *
   * MUTATION /api/trpc/findings.resetPriority
   *
   * @param findingId - Finding ID
   * @returns 업데이트된 Finding (priority = null)
   *
   * @throws NOT_FOUND if finding not found
   * @throws FORBIDDEN if user lacks permission
   */
  resetPriority: protectedProcedure
    .input(
      z.object({
        findingId: z.string().min(1, "Finding ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId } = input;
      const userId = ctx.userId;

      // 1. Finding 조회
      const finding = await ctx.db.finding.findUnique({
        where: { id: findingId },
        include: {
          case: true,
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 Finding을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 가능
      const user = await ctx.db.user.findUnique({
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
          message: "Finding 중요도 재설정 권한이 없습니다.",
        });
      }

      // 3. Priority 재설정 (null)
      const oldPriority = finding.priority;
      const updatedFinding = await ctx.db.finding.update({
        where: { id: findingId },
        data: {
          priority: null,
        },
      });

      // 4. 감사 로그 기록
      await logFindingPriorityReset({
        db: ctx.db,
        findingId,
        userId,
        caseId: finding.caseId,
        oldPriority,
      });

      console.log(
        `[Findings Router] Finding priority 재설정됨: ${findingId} (${oldPriority} → null) by ${userId}`
      );

      return updatedFinding;
    }),
});
