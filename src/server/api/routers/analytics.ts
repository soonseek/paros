/**
 * Analytics Router
 *
 * Story 4.8: Task 6 - 학습 피드백 루프
 *
 * 기능:
 * - 학습 통계 조회 (전체 규칙 수, 활성 규칙 수, 피드백 수 등)
 * - 규칙 적용 통계
 * - RBAC: ADMIN만 접근 가능
 *
 * @module server/api/routers/analytics
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Analytics Router
 */
export const analyticsRouter = createTRPCRouter({
  /**
   * 학습 통계를 조회합니다.
   *
   * Story 4.8, Task 6: 학습 피드백 루프 통계
   *
   * QUERY /api/trpc/analytics.getLearningStats
   *
   * @returns 학습 통계
   *
   * @throws FORBIDDEN if user is not ADMIN
   */
  getLearningStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

    // 1. RBAC: ADMIN만 접근 가능
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "학습 통계 조회는 관리자만 가능합니다.",
      });
    }

    // 2. 규칙 통계 조회
    const [
      totalRules,
      activeRules,
      keywordRules,
      amountRangeRules,
      creditorRules,
      topRules,
    ] = await Promise.all([
      // 전체 규칙 수
      ctx.db.classificationRule.count(),
      // 활성 규칙 수
      ctx.db.classificationRule.count({
        where: { isActive: true },
      }),
      // 키워드 규칙 수
      ctx.db.classificationRule.count({
        where: { patternType: "KEYWORD" },
      }),
      // 금액 범위 규칙 수
      ctx.db.classificationRule.count({
        where: { patternType: "AMOUNT_RANGE" },
      }),
      // 채권자 규칙 수
      ctx.db.classificationRule.count({
        where: { patternType: "CREDITOR" },
      }),
      // 상위 적용 규칙 (TOP 10)
      ctx.db.classificationRule.findMany({
        where: { isActive: true },
        orderBy: { applyCount: "desc" },
        take: 10,
        select: {
          id: true,
          pattern: true,
          patternType: true,
          category: true,
          subcategory: true,
          confidence: true,
          applyCount: true,
          successCount: true,
          lastAppliedAt: true,
          createdAt: true,
        },
      }),
    ]);

    // 3. 피드백 통계 조회
    const [
      totalFeedbacks,
      recentFeedbacks,
      categoryFeedbacks,
      weeklyFeedbacks,
    ] = await Promise.all([
      // 전체 피드백 수
      ctx.db.classificationFeedback.count(),
      // 최근 30일 피드백 수
      ctx.db.classificationFeedback.count({
        where: {
          feedbackDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // 카테고리별 피드백 수 (TOP 10)
      ctx.db.classificationFeedback.groupBy({
        by: ["userCategory"],
        _count: {
          userCategory: true,
        },
        orderBy: {
          _count: {
            userCategory: "desc",
          },
        },
        take: 10,
      }),
      // 최근 7일 피드백 (일별 그룹화)
      ctx.db.$queryRaw<
        { date: Date; count: bigint }[]
      >`
        SELECT
          DATE("feedbackDate") as date,
          COUNT(*) as count
        FROM "classification_feedbacks"
        WHERE "feedbackDate" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("feedbackDate")
        ORDER BY date DESC
      `,
    ]);

    // 4. 분류 오류 통계
    const [
      totalErrors,
      unresolvedErrors,
      recentErrors,
      errorByType,
      errorBySeverity,
    ] = await Promise.all([
      // 전체 오류 수
      ctx.db.classificationError.count(),
      // 미해결 오류 수
      ctx.db.classificationError.count({
        where: { resolved: false },
      }),
      // 최근 30일 오류 수
      ctx.db.classificationError.count({
        where: {
          reportedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // 오류 유형별 분류
      ctx.db.classificationError.groupBy({
        by: ["errorType"],
        _count: {
          errorType: true,
        },
      }),
      // 심각도별 분류
      ctx.db.classificationError.groupBy({
        by: ["severity"],
        _count: {
          severity: true,
        },
      }),
    ]);

    // 5. 규칙 효율성 계산 (성공률)
    const ruleEfficiency = topRules.map((rule) => ({
      ...rule,
      successRate:
        rule.applyCount > 0
          ? (rule.successCount / rule.applyCount) * 100
          : 0,
    }));

    // 6. 응답 생성
    return {
      rules: {
        total: totalRules,
        active: activeRules,
        inactive: totalRules - activeRules,
        byPatternType: {
          keyword: keywordRules,
          amountRange: amountRangeRules,
          creditor: creditorRules,
        },
        topApplied: ruleEfficiency,
      },
      feedbacks: {
        total: totalFeedbacks,
        recent30Days: recentFeedbacks,
        byCategory: categoryFeedbacks.map((item) => ({
          category: item.userCategory ?? "Unknown",
          count: item._count.userCategory,
        })),
        weeklyTrend: (weeklyFeedbacks as Array<{ date: Date; count: bigint }>).map(
          (item) => ({
            date: item.date.toISOString().split("T")[0],
            count: Number(item.count),
          })
        ),
      },
      errors: {
        total: totalErrors,
        unresolved: unresolvedErrors,
        resolved: totalErrors - unresolvedErrors,
        recent30Days: recentErrors,
        byType: errorByType.map((item) => ({
          type: item.errorType,
          count: item._count.errorType,
        })),
        bySeverity: errorBySeverity.map((item) => ({
          severity: item.severity,
          count: item._count.severity,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * 분류 규칙 목록을 조회합니다.
   *
   * Story 4.8, Task 6: 규칙 관리
   *
   * QUERY /api/trpc/analytics.getClassificationRules
   *
   * @param isActive - 활성 규칙만 필터링 (선택적)
   * @param patternType - 패턴 타입 필터 (선택적)
   * @param page - 페이지 번호 (기본값: 1)
   * @param pageSize - 페이지당 건수 (기본값: 20)
   * @returns 규칙 목록
   *
   * @throws FORBIDDEN if user is not ADMIN
   */
  getClassificationRules: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        patternType: z
          .enum(["KEYWORD", "AMOUNT_RANGE", "CREDITOR"])
          .optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { isActive, patternType, page, pageSize } = input;

      // 1. RBAC: ADMIN만 접근 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "분류 규칙 조회는 관리자만 가능합니다.",
        });
      }

      // 2. 필터 조건 구성
      const whereCondition: Record<string, unknown> = {};

      if (isActive !== undefined) {
        whereCondition.isActive = isActive;
      }

      if (patternType !== undefined) {
        whereCondition.patternType = patternType;
      }

      // 3. 규칙 목록 조회
      const [rules, totalCount] = await Promise.all([
        ctx.db.classificationRule.findMany({
          where: whereCondition,
          orderBy: [{ createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.db.classificationRule.count({ where: whereCondition }),
      ]);

      return {
        rules,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      };
    }),

  /**
   * 분류 규칙을 토글(활성/비활성)합니다.
   *
   * Story 4.8, Task 6: 규칙 관리
   *
   * MUTATION /api/trpc/analytics.toggleClassificationRule
   *
   * @param ruleId - 규칙 ID
   * @returns 업데이트된 규칙
   *
   * @throws NOT_FOUND if rule not found
   * @throws FORBIDDEN if user is not ADMIN
   */
  toggleClassificationRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().uuid("유효한 규칙 ID를 입력해 주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ruleId } = input;
      const userId = ctx.userId;

      // 1. RBAC: ADMIN만 접근 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "규칙 토글은 관리자만 가능합니다.",
        });
      }

      // 2. 규칙 조회
      const rule = await ctx.db.classificationRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "규칙을 찾을 수 없습니다.",
        });
      }

      // 3. 규칙 토글
      const updated = await ctx.db.classificationRule.update({
        where: { id: ruleId },
        data: {
          isActive: !rule.isActive,
        },
      });

      // 4. 감사 로그 기록
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "TOGGLE_RULE",
          entityType: "CLASSIFICATION_RULE",
          entityId: ruleId,
          changes: {
            before: { isActive: rule.isActive },
            after: { isActive: updated.isActive },
          },
        },
      });

      return updated;
    }),
});
