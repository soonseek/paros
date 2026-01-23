/**
 * 시스템 설정 라우터 (관리자 전용)
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { SettingsService } from '~/server/services/settings-service';
import { TRPCError } from '@trpc/server';

export const settingsRouter = createTRPCRouter({
  /**
   * 모든 설정 조회 (관리자 전용)
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // 세션 체크
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
      });
    }

    // 관리자 권한 체크
    if (ctx.session.user.role !== 'ADMIN') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '관리자만 접근할 수 있습니다.',
      });
    }

    const service = new SettingsService(ctx.db);
    return await service.getAllSettings();
  }),

  /**
   * 카테고리별 설정 조회 (관리자 전용)
   */
  getByCategory: protectedProcedure
    .input(
      z.object({
        category: z.enum(['AI', 'EMAIL', 'GENERAL']),
      })
    )
    .query(async ({ ctx, input }) => {
      // 세션 체크
      if (!ctx.session?.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.',
        });
      }

      // 관리자 권한 체크
      if (ctx.session.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '관리자만 접근할 수 있습니다.',
        });
      }

      const service = new SettingsService(ctx.db);
      return await service.getSettingsByCategory(input.category);
    }),

  /**
   * 설정 저장 (관리자 전용)
   */
  update: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        category: z.enum(['AI', 'EMAIL', 'GENERAL']).optional(),
        isEncrypted: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 세션 체크
      if (!ctx.session?.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.',
        });
      }

      // 관리자 권한 체크
      if (ctx.session.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '관리자만 접근할 수 있습니다.',
        });
      }

      const service = new SettingsService(ctx.db);
      await service.setSetting(input, ctx.session.user.id);

      return { success: true };
    }),

  /**
   * 설정 삭제 (관리자 전용)
   */
  delete: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 세션 체크
      if (!ctx.session?.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.',
        });
      }

      // 관리자 권한 체크
      if (ctx.session.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '관리자만 접근할 수 있습니다.',
        });
      }

      const service = new SettingsService(ctx.db);
      await service.deleteSetting(input.key);

      return { success: true };
    }),

  /**
   * AI 제공자 설정 조회
   */
  getAIProvider: protectedProcedure.query(async ({ ctx }) => {
    // 세션 체크
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
      });
    }

    // 관리자 권한 체크
    if (ctx.session.user.role !== 'ADMIN') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '관리자만 접근할 수 있습니다.',
      });
    }

    const service = new SettingsService(ctx.db);
    return await service.getAIProvider();
  }),
});
