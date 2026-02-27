/**
 * 보정권고 안내사항 템플릿 관리 라우터
 */
import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { uploadFile, deleteFile, downloadFile } from "~/lib/storage";
import { randomUUID } from "crypto";

// 파일 정보 타입
interface FileInfo {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

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

  // 파일 업로드 (이미지/파일)
  uploadFile: adminProcedure
    .input(
      z.object({
        templateId: z.string().optional(), // 기존 템플릿에 추가하는 경우
        fileName: z.string(),
        fileData: z.string(), // Base64 인코딩된 파일 데이터
        fileType: z.string(), // MIME 타입
        fileSize: z.number(),
        isImage: z.boolean(), // 이미지인지 일반 파일인지
      })
    )
    .mutation(async ({ input }) => {
      // Base64 디코딩
      const fileBuffer = Buffer.from(input.fileData, "base64");
      
      // 파일 크기 검증 (최대 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일 크기는 10MB를 초과할 수 없습니다",
        });
      }

      // 이미지 타입 검증
      if (input.isImage) {
        const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedImageTypes.includes(input.fileType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "지원하지 않는 이미지 형식입니다 (JPEG, PNG, GIF, WebP만 허용)",
          });
        }
      }

      // 파일 업로드 (correction-guide-templates 폴더에 저장)
      const storageKey = await uploadFile(
        fileBuffer,
        "correction-guide-templates",
        input.fileName,
        input.fileType
      );

      // 파일 정보 반환
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
    .input(
      z.object({
        fileKey: z.string(),
      })
    )
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

  // 파일 다운로드 URL 생성 (로컬 스토리지용)
  getFileUrl: protectedProcedure
    .input(
      z.object({
        fileKey: z.string(),
      })
    )
    .query(async ({ input }) => {
      // S3인 경우 직접 URL 반환, 로컬인 경우 API 엔드포인트로 리다이렉트
      const { getStorageBackend } = await import("~/lib/storage");
      const backend = await getStorageBackend();
      
      if (backend === "S3") {
        // S3 presigned URL 생성 (실제 구현 시 추가)
        return {
          url: `/api/correction-guide/download?key=${encodeURIComponent(input.fileKey)}`,
          backend: "S3",
        };
      } else {
        return {
          url: `/api/correction-guide/download?key=${encodeURIComponent(input.fileKey)}`,
          backend: "LOCAL",
        };
      }
    }),

  // 템플릿 생성 (ADMIN, SUPER만)
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

  // 템플릿 수정 (ADMIN, SUPER만)
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

  // 템플릿 삭제 (ADMIN, SUPER만) - 연결된 파일도 삭제
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

      // 연결된 이미지 삭제
      const images = (template.images as FileInfo[]) ?? [];
      for (const image of images) {
        try {
          await deleteFile(image.key);
        } catch (error) {
          console.error(`[CorrectionGuide] Failed to delete image: ${image.key}`, error);
        }
      }

      // 연결된 파일 삭제
      const files = (template.files as FileInfo[]) ?? [];
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
