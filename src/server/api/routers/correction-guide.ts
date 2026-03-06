/**
 * 보정권고 안내사항 템플릿 관리 및 분석 라우터
 */
import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { uploadFile, deleteFile } from "~/lib/storage";
import { CorrectionGuideService } from "~/server/services/correction-guide-service";
import type { FileInfo, TemplateMatchResult } from "~/types/correction-guide";

export const correctionGuideRouter = createTRPCRouter({
  // ========== 템플릿 관리 ==========
  
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

  // 파일 업로드 (이미지/파일)
  uploadFile: adminProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        fileName: z.string(),
        fileData: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        isImage: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const fileBuffer = Buffer.from(input.fileData, "base64");
      
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일 크기는 10MB를 초과할 수 없습니다",
        });
      }

      if (input.isImage) {
        const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedImageTypes.includes(input.fileType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "지원하지 않는 이미지 형식입니다 (JPEG, PNG, GIF, WebP만 허용)",
          });
        }
      }

      const storageKey = await uploadFile(
        fileBuffer,
        "correction-guide-templates",
        input.fileName,
        input.fileType
      );

      const fileInfo: FileInfo = {
        key: storageKey,
        name: input.fileName,
        size: input.fileSize,
        type: input.fileType,
        uploadedAt: new Date().toISOString(),
      };

      console.log(`[CorrectionGuide] File uploaded: ${storageKey}`);
      return fileInfo;
    }),

  // 파일 삭제
  deleteFile: adminProcedure
    .input(z.object({ fileKey: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await deleteFile(input.fileKey);
        console.log(`[CorrectionGuide] File deleted: ${input.fileKey}`);
        return { success: true };
      } catch (error) {
        console.error(`[CorrectionGuide] File delete error:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 삭제에 실패했습니다",
        });
      }
    }),

  // 파일 다운로드 URL 생성
  getFileUrl: protectedProcedure
    .input(z.object({ fileKey: z.string() }))
    .query(async ({ input }) => {
      const { getStorageBackend } = await import("~/lib/storage");
      const backend = await getStorageBackend();
      
      return {
        url: `/api/correction-guide/download?key=${encodeURIComponent(input.fileKey)}`,
        backend,
      };
    }),

  // 템플릿 생성
  createTemplate: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "제목은 필수입니다"),
        content: z.string().min(1, "내용은 필수입니다"),
        images: z.array(z.object({
          key: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
          uploadedAt: z.string(),
        })).optional(),
        files: z.array(z.object({
          key: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
          uploadedAt: z.string(),
        })).optional(),
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

  // 템플릿 수정
  updateTemplate: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        images: z.array(z.object({
          key: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
          uploadedAt: z.string(),
        })).optional(),
        files: z.array(z.object({
          key: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
          uploadedAt: z.string(),
        })).optional(),
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

  // 템플릿 삭제
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

      const images = (template.images as unknown as FileInfo[]) ?? [];
      for (const image of images) {
        try {
          await deleteFile(image.key);
        } catch (error) {
          console.error(`[CorrectionGuide] Failed to delete image: ${image.key}`, error);
        }
      }

      const files = (template.files as unknown as FileInfo[]) ?? [];
      for (const file of files) {
        try {
          await deleteFile(file.key);
        } catch (error) {
          console.error(`[CorrectionGuide] Failed to delete file: ${file.key}`, error);
        }
      }

      return db.correctionGuideTemplate.delete({
        where: { id: input.id },
      });
    }),

  // ========== 분석 기능 ==========

  // 사건별 분석 결과 목록 조회
  getAnalysesForCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      return db.correctionGuideAnalysis.findMany({
        where: { caseId: input.caseId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // 단일 분석 결과 조회
  getAnalysis: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.id },
        include: {
          case: {
            select: { caseNumber: true, debtorName: true },
          },
        },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      return analysis;
    }),

  // 보정권고/명령서 분석 실행
  analyzeDocument: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        fileName: z.string(),
        fileData: z.string(),  // Base64 인코딩
        fileType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const service = new CorrectionGuideService(db);
      const fileBuffer = Buffer.from(input.fileData, "base64");

      // 1. 분석 레코드 생성 (pending 상태)
      const analysis = await db.correctionGuideAnalysis.create({
        data: {
          caseId: input.caseId,
          originalFileName: input.fileName,
          analysisStatus: "processing",
        },
      });

      try {
        // 2. 파일 저장
        const documentS3Key = await uploadFile(
          fileBuffer,
          `correction-guide-analysis/${input.caseId}`,
          input.fileName,
          input.fileType
        );

        // 3. Upstage OCR로 텍스트 추출
        const extractedText = await service.parseDocumentWithUpstage(
          fileBuffer,
          input.fileName,
          input.fileType
        );

        // 4. 흠결사항 항목 추출
        const defectItems = service.extractDefectItems(extractedText);

        if (defectItems.length === 0) {
          throw new Error("흠결사항 항목을 찾을 수 없습니다. 문서 형식을 확인해주세요.");
        }

        // 5. 활성 템플릿 조회
        const templates = await db.correctionGuideTemplate.findMany({
          where: { isActive: true },
          orderBy: [{ priority: "desc" }],
        });

        // 6. GPT로 템플릿 매칭
        const matchResults = await service.matchTemplatesWithGPT(defectItems, templates);

        // 7. 결과 저장
        const updatedAnalysis = await db.correctionGuideAnalysis.update({
          where: { id: analysis.id },
          data: {
            documentS3Key,
            analysisStatus: "completed",
            extractedItems: JSON.parse(JSON.stringify(defectItems)) as Prisma.InputJsonValue,
            matchedTemplates: JSON.parse(JSON.stringify(matchResults)) as Prisma.InputJsonValue,
            selectedItems: matchResults
              .filter(m => m.isSelected)
              .map(m => m.itemNumber) as Prisma.InputJsonValue,
          },
        });

        return updatedAnalysis;
      } catch (error) {
        // 분석 실패 처리
        await db.correctionGuideAnalysis.update({
          where: { id: analysis.id },
          data: {
            analysisStatus: "failed",
            errorMessage: error instanceof Error ? error.message : "알 수 없는 오류",
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "분석에 실패했습니다",
        });
      }
    }),

  // 선택 항목 업데이트
  updateSelectedItems: protectedProcedure
    .input(
      z.object({
        analysisId: z.string(),
        selectedItemNumbers: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.analysisId },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      const matchedTemplates = analysis.matchedTemplates as unknown as TemplateMatchResult[];
      const updatedTemplates = matchedTemplates.map(t => ({
        ...t,
        isSelected: input.selectedItemNumbers.includes(t.itemNumber),
      }));

      return db.correctionGuideAnalysis.update({
        where: { id: input.analysisId },
        data: {
          matchedTemplates: JSON.parse(JSON.stringify(updatedTemplates)) as Prisma.InputJsonValue,
          selectedItems: input.selectedItemNumbers as Prisma.InputJsonValue,
        },
      });
    }),

  // 수동 추가 항목 저장
  saveManualItems: protectedProcedure
    .input(
      z.object({
        analysisId: z.string(),
        manualItems: z.array(z.object({
          id: z.string(),
          title: z.string(),
          defectContent: z.string(),
          content: z.string(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.analysisId },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      return db.correctionGuideAnalysis.update({
        where: { id: input.analysisId },
        data: {
          manualItems: input.manualItems as Prisma.InputJsonValue,
        },
      });
    }),

  // 편집된 내용 저장
  saveEditedContents: protectedProcedure
    .input(
      z.object({
        analysisId: z.string(),
        editedContents: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input }) => {
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.analysisId },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      return db.correctionGuideAnalysis.update({
        where: { id: input.analysisId },
        data: {
          editedContents: input.editedContents as Prisma.InputJsonValue,
        },
      });
    }),

  // 공유 링크 생성
  createShareLink: protectedProcedure
    .input(
      z.object({
        analysisId: z.string(),
        expiresInDays: z.number().optional(),  // null이면 무기한
      })
    )
    .mutation(async ({ input }) => {
      const service = new CorrectionGuideService(db);
      
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.analysisId },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      const updated = await service.createShareLink(input.analysisId, input.expiresInDays);
      
      return {
        shareSlug: updated.shareSlug,
        shareUrl: `/guide/${updated.shareSlug}`,
        expiresAt: updated.shareExpiresAt,
      };
    }),

  // 공유 링크로 분석 결과 조회 (인증 불필요)
  getAnalysisByShareSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const service = new CorrectionGuideService(db);
      const analysis = await service.getAnalysisByShareSlug(input.slug);

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "공유 링크가 만료되었거나 존재하지 않습니다",
        });
      }

      return analysis;
    }),

  // 분석 삭제
  deleteAnalysis: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const analysis = await db.correctionGuideAnalysis.findUnique({
        where: { id: input.id },
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      // 저장된 문서 삭제
      if (analysis.documentS3Key) {
        try {
          await deleteFile(analysis.documentS3Key);
        } catch (error) {
          console.error(`[CorrectionGuide] Failed to delete document: ${analysis.documentS3Key}`, error);
        }
      }

      return db.correctionGuideAnalysis.delete({
        where: { id: input.id },
      });
    }),
});
