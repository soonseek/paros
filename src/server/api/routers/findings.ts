/**
 * Findings Router
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * Finding 관리 tRPC 프로시저:
 * - getFindingsForCase: 특정 사건의 Finding 목록 조회
 * - resolveFinding: Finding 해결 처리
 *
 * RBAC:
 * - Case lawyer 또는 Admin만 Finding 해결 가능
 * - Viewer는 조회만 가능
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
});
