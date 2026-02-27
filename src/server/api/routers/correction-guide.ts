/**
 * 보정권고 안내사항 템플릿 관리 라우터
 */
import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";

export const correctionGuideRouter = createTRPCRouter({
  // 템플릿 목록 조회 (모든 인증된 사용자)
  getTemplates: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const where = input?.includeInactive ? {} : { isActive: true };
      
      return db.correctionGuideTemplate.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
    }),

  // 단일 템플릿 조회
  getTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const template = await db.correctionGuideTemplate.findUnique({
        where: { id: input.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      return template;
    }),

  // 템플릿 생성 (ADMIN, SUPER만)
  createTemplate: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "제목은 필수입니다"),
        content: z.string().min(1, "내용은 필수입니다"),
        images: z.array(z.string()).optional(),
        files: z.array(z.string()).optional(),
        specialNotes: z.string().optional(),
        priority: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      return db.correctionGuideTemplate.create({
        data: {
          title: input.title,
          content: input.content,
          images: input.images ?? [],
          files: input.files ?? [],
          specialNotes: input.specialNotes,
          priority: input.priority,
        },
      });
    }),

  // 템플릿 수정 (ADMIN, SUPER만)
  updateTemplate: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        images: z.array(z.string()).optional(),
        files: z.array(z.string()).optional(),
        specialNotes: z.string().nullable().optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const template = await db.correctionGuideTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      return db.correctionGuideTemplate.update({
        where: { id },
        data,
      });
    }),

  // 템플릿 삭제 (ADMIN, SUPER만)
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const template = await db.correctionGuideTemplate.findUnique({
        where: { id: input.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      return db.correctionGuideTemplate.delete({
        where: { id: input.id },
      });
    }),

  // 사건별 보정권고 분석 결과 조회
  getAnalysesForCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      return db.correctionGuideAnalysis.findMany({
        where: { caseId: input.caseId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // 보정권고 분석 생성 (목업 - 실제 분석은 나중에 구현)
  createAnalysis: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        documentId: z.string().optional(),
        originalFileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.correctionGuideAnalysis.create({
        data: {
          caseId: input.caseId,
          documentId: input.documentId,
          originalFileName: input.originalFileName,
          analysisStatus: "pending",
        },
      });
    }),
});
