/**
 * Saved Filter Router (Story 8.2, Task 9.3: tRPC savedFilters 라우터 생성)
 *
 * 저장된 검색 필터 CRUD API
 *
 * @module server/api/routers/savedFilters
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import type { ExtendedSearchFilters } from "~/types/search";

/**
 * 필터 타입 enum (Story 8.2, Task 9.3)
 */
const FilterTypeSchema = z.enum(["SEARCH", "FUND_FLOW"]);

/**
 * Zod 스키마: ExtendedSearchFilters (Story 8.2, Task 9.3)
 *
 * 검증을 위한 Zod 스키마 정의
 */
const ExtendedSearchFiltersSchema = z.object({
  keyword: z.string().optional(),
  dateRange: z.object({
    start: z.date().optional(),
    end: z.date().optional(),
  }).optional(),
  amountRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  transactionType: z.array(z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER"])).optional(),
  transactionNature: z.array(z.enum(["CREDITOR", "COLLATERAL", "PRIORITY_REPAYMENT"])).optional(),
  isImportantOnly: z.boolean().optional(),
  confidenceRange: z.object({
    min: z.number().min(0).max(1).optional(),
    max: z.number().min(0).max(1).optional(),
  }).optional(),
});

/**
 * 저장된 필터 라우터 (Story 8.2, Task 9.3)
 */
export const savedFiltersRouter = createTRPCRouter({
  /**
   * 저장된 필터 목록 조회 (Story 8.2, Task 9.3.1)
   *
   * @input - { filterType?: "SEARCH" | "FUND_FLOW" }
   * @returns - SavedFilter[]
   */
  list: protectedProcedure
    .input(
      z.object({
        filterType: FilterTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { filterType } = input;

      // 사용자의 저장된 필터 목록 조회
      const savedFilters = await ctx.db.savedFilter.findMany({
        where: {
          userId,
          ...(filterType ? { filterType } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          filters: true,
          filterType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return savedFilters;
    }),

  /**
   * 저장된 필터 단건 조회 (Story 8.2, Task 9.3.2)
   *
   * @input - { id: string }
   * @returns - SavedFilter
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, "필터 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { id } = input;

      // 저장된 필터 조회
      const savedFilter = await ctx.db.savedFilter.findUnique({
        where: { id },
      });

      if (!savedFilter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "저장된 필터를 찾을 수 없습니다.",
        });
      }

      // RBAC: 자신의 필터만 조회 가능
      if (savedFilter.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "필터 조회 권한이 없습니다.",
        });
      }

      return savedFilter;
    }),

  /**
   * 필터 저장 (Story 8.2, Task 9.3.3)
   *
   * @input - { name: string, filters: ExtendedSearchFilters, filterType: "SEARCH" | "FUND_FLOW" }
   * @returns - SavedFilter
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "필터 이름은 필수 항목입니다").max(100, "필터 이름은 100자 이내여야 합니다"),
        filters: ExtendedSearchFiltersSchema,
        filterType: FilterTypeSchema.default("SEARCH"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { name, filters, filterType } = input;

      // 중복 이름 확인 (같은 사용자, 같은 필터 타입)
      const existing = await ctx.db.savedFilter.findFirst({
        where: {
          userId,
          name,
          filterType,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `이미 "${name}" 이름의 필터가 존재합니다.`,
        });
      }

      // 필터 저장
      const savedFilter = await ctx.db.savedFilter.create({
        data: {
          userId,
          name,
          filters: filters as any, // JSON 필드에 저장
          filterType,
        },
      });

      return savedFilter;
    }),

  /**
   * 저장된 필터 수정 (Story 8.2, Task 9.3.4)
   *
   * @input - { id: string, name?: string, filters?: ExtendedSearchFilters }
   * @returns - SavedFilter
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, "필터 ID는 필수 항목입니다"),
        name: z.string().min(1).max(100).optional(),
        filters: ExtendedSearchFiltersSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { id, name, filters } = input;

      // 저장된 필터 조회
      const existing = await ctx.db.savedFilter.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "저장된 필터를 찾을 수 없습니다.",
        });
      }

      // RBAC: 자신의 필터만 수정 가능
      if (existing.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "필터 수정 권한이 없습니다.",
        });
      }

      // 이름 변경 시 중복 확인
      if (name && name !== existing.name) {
        const duplicate = await ctx.db.savedFilter.findFirst({
          where: {
            userId,
            name,
            filterType: existing.filterType ?? "SEARCH",
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `이미 "${name}" 이름의 필터가 존재합니다.`,
          });
        }
      }

      // 필터 수정
      const updated = await ctx.db.savedFilter.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(filters !== undefined && { filters: filters as any }),
        },
      });

      return updated;
    }),

  /**
   * 저장된 필터 삭제 (Story 8.2, Task 9.3.5)
   *
   * @input - { id: string }
   * @returns - { success: true }
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, "필터 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { id } = input;

      // 저장된 필터 조회
      const existing = await ctx.db.savedFilter.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "저장된 필터를 찾을 수 없습니다.",
        });
      }

      // RBAC: 자신의 필터만 삭제 가능
      if (existing.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "필터 삭제 권한이 없습니다.",
        });
      }

      // 필터 삭제
      await ctx.db.savedFilter.delete({
        where: { id },
      });

      return { success: true };
    }),
});
