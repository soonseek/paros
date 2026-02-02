/**
 * Transaction Template Router
 * 
 * 거래내역서 템플릿 CRUD API
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";

// 컬럼 정의 스키마
const columnDefinitionSchema = z.object({
  index: z.number(),
  header: z.string(),
  whenDeposit: z.enum(["amount", "memo", "skip"]).optional(),
  whenWithdrawal: z.enum(["amount", "memo", "skip"]).optional(),
});

// 템플릿 컬럼 스키마
const columnSchemaSchema = z.object({
  columns: z.object({
    date: columnDefinitionSchema.optional(),
    deposit: columnDefinitionSchema.optional(),
    withdrawal: columnDefinitionSchema.optional(),
    balance: columnDefinitionSchema.optional(),
    memo: columnDefinitionSchema.optional(),
    transactionType: columnDefinitionSchema.optional(),
    amount: columnDefinitionSchema.optional(),
  }),
  parseRules: z.object({
    isDeposit: z.string().optional(),
    memoExtraction: z.string().optional(),
  }).optional(),
});

export const templateRouter = createTRPCRouter({
  /**
   * 템플릿 목록 조회
   */
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      const templates = await ctx.db.transactionTemplate.findMany({
        where: input?.includeInactive ? {} : { isActive: true },
        orderBy: [
          { priority: "desc" },
          { name: "asc" },
        ],
      });

      return templates.map(t => ({
        ...t,
        columnSchema: t.columnSchema as object,
      }));
    }),

  /**
   * 단일 템플릿 조회
   */
  getById: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 생성 (관리자 전용)
   */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "템플릿 이름은 필수입니다"),
      bankName: z.string().optional(),
      description: z.string().min(10, "설명은 최소 10자 이상이어야 합니다"),
      identifiers: z.array(z.string()).default([]),
      columnSchema: columnSchemaSchema,
      priority: z.number().default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // 중복 이름 체크
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 동일한 이름의 템플릿이 존재합니다",
        });
      }

      const template = await ctx.db.transactionTemplate.create({
        data: {
          name: input.name,
          bankName: input.bankName,
          description: input.description,
          identifiers: input.identifiers,
          columnSchema: input.columnSchema,
          priority: input.priority,
          isActive: input.isActive,
          createdBy: ctx.userId,
        },
      });

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 수정 (관리자 전용)
   */
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      bankName: z.string().nullable().optional(),
      description: z.string().min(10).optional(),
      identifiers: z.array(z.string()).optional(),
      columnSchema: columnSchemaSchema.optional(),
      priority: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // 템플릿 존재 확인
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      // 이름 중복 체크 (다른 템플릿과)
      if (updateData.name && updateData.name !== existing.name) {
        const duplicate = await ctx.db.transactionTemplate.findUnique({
          where: { name: updateData.name },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 동일한 이름의 템플릿이 존재합니다",
          });
        }
      }

      const template = await ctx.db.transactionTemplate.update({
        where: { id },
        data: updateData,
      });

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 삭제 (관리자 전용)
   */
  delete: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      await ctx.db.transactionTemplate.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * 템플릿 복제 (관리자 전용)
   */
  duplicate: adminProcedure
    .input(z.object({
      id: z.string(),
      newName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      // 새 이름 중복 체크
      const duplicate = await ctx.db.transactionTemplate.findUnique({
        where: { name: input.newName },
      });

      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 동일한 이름의 템플릿이 존재합니다",
        });
      }

      const newTemplate = await ctx.db.transactionTemplate.create({
        data: {
          name: input.newName,
          bankName: existing.bankName,
          description: existing.description,
          identifiers: existing.identifiers,
          columnSchema: existing.columnSchema as object,
          priority: existing.priority,
          isActive: false, // 복제된 템플릿은 비활성화 상태로 시작
          createdBy: ctx.userId,
        },
      });

      return {
        ...newTemplate,
        columnSchema: newTemplate.columnSchema as object,
      };
    }),

  /**
   * 템플릿 통계 조회
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const templates = await ctx.db.transactionTemplate.findMany({
        select: {
          id: true,
          name: true,
          bankName: true,
          isActive: true,
          matchCount: true,
          successRate: true,
        },
        orderBy: { matchCount: "desc" },
      });

      const totalActive = templates.filter(t => t.isActive).length;
      const totalMatches = templates.reduce((sum, t) => sum + t.matchCount, 0);

      return {
        totalTemplates: templates.length,
        activeTemplates: totalActive,
        totalMatches,
        templates,
      };
    }),

  /**
   * 템플릿 테스트 - PDF 파일로 매칭 테스트 (Upstage 파싱 후)
   */
  testMatchWithFile: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("application/pdf"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { classifyTransaction } = await import("~/lib/template-classifier");
      const { extractTablesFromPDF } = await import("~/lib/pdf-ocr");
      
      // Base64를 Buffer로 변환
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      
      console.log(`[Template Test] Processing file: ${input.fileName} (${fileBuffer.length} bytes)`);
      
      // Upstage로 PDF 파싱 (첫 3페이지만)
      let headers: string[] = [];
      let sampleRows: string[][] = [];
      
      try {
        const pdfResult = await extractTablesFromPDF(fileBuffer, 3); // maxPages = 3
        
        if (pdfResult.headers && pdfResult.headers.length > 0) {
          headers = pdfResult.headers;
          sampleRows = pdfResult.rows.slice(0, 10); // 샘플로 최대 10행
          
          console.log(`[Template Test] Extracted headers: ${headers.join(", ")}`);
          console.log(`[Template Test] Sample rows: ${sampleRows.length}`);
        } else {
          return {
            matched: false,
            error: "PDF에서 테이블 헤더를 추출할 수 없습니다",
            headers: [],
            sampleRows: [],
          };
        }
      } catch (error) {
        console.error("[Template Test] PDF parsing error:", error);
        return {
          matched: false,
          error: error instanceof Error ? error.message : "PDF 파싱 실패",
          headers: [],
          sampleRows: [],
        };
      }
      
      // 템플릿 매칭 테스트
      const result = await classifyTransaction(ctx.db, headers, sampleRows);

      if (result) {
        return {
          matched: true,
          layer: result.layer,
          layerName: result.layerName,
          templateId: result.templateId,
          templateName: result.templateName,
          confidence: result.confidence,
          columnMapping: result.columnMapping,
          headers,
          sampleRows: sampleRows.slice(0, 5), // UI에 표시할 샘플
        };
      }

      return {
        matched: false,
        message: "Layer 1, 2에서 매칭되지 않음. Layer 3 (LLM 폴백) 필요",
        headers,
        sampleRows: sampleRows.slice(0, 5),
      };
    }),

  /**
   * 이미지 분석 - 스크린샷에서 템플릿 초안 자동 생성
   */
  analyzeImage: adminProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ input }) => {
      const { analyzeTemplateImage } = await import("~/lib/template-image-analyzer");
      
      // Base64를 Buffer로 변환
      const imageBuffer = Buffer.from(input.imageBase64, "base64");
      
      const result = await analyzeTemplateImage(imageBuffer, input.mimeType);
      
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "이미지 분석 실패",
        });
      }
      
      return {
        success: true,
        suggestedName: result.suggestedName,
        suggestedBankName: result.suggestedBankName,
        suggestedDescription: result.suggestedDescription,
        suggestedIdentifiers: result.suggestedIdentifiers,
        detectedHeaders: result.detectedHeaders,
        suggestedColumnSchema: result.suggestedColumnSchema,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };
    }),
});
