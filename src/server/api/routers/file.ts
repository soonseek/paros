import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { FILE_VALIDATION, validateFileSignature } from "~/lib/file-validation";
import { uploadFile, deleteFile, downloadFile } from "~/lib/storage";
import { analyzeFileStructure } from "~/lib/file-analyzer";
import { extractAndSaveTransactions, type ColumnMapping } from "~/lib/data-extractor";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * File Management Router
 *
 * Handles file validation operations for uploaded transaction documents.
 * All procedures require authentication (protectedProcedure).
 *
 * Supported File Types:
 * - Excel (.xlsx, .xls)
 * - CSV (.csv)
 * - PDF (.pdf)
 *
 * File Size Limit: 50MB
 */

/**
 * Helper function to detect file type from filename and MIME type
 *
 * @param fileName - Name of the file
 * @param _mimeType - MIME type of the file (unused but kept for consistency)
 * @returns Korean label for the detected file type
 */
function detectFileType(fileName: string, _mimeType: string): string {
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return "엑셀 파일";
  }
  if (fileName.endsWith(".csv")) {
    return "CSV 파일";
  }
  if (fileName.endsWith(".pdf")) {
    return "PDF 파일";
  }
  return "알 수 없는 파일";
}

export const fileRouter = createTRPCRouter({
  /**
   * Validate uploaded file format and structure
   *
   * POST /api/trpc/file.validateFileFormat
   *
   * Performs comprehensive validation on uploaded files:
   * 1. File size validation (50MB limit)
   * 2. MIME type validation
   * 3. File structure parsing (actual content validation, not just extension)
   *
   * @param fileName - Name of the file
   * @param fileType - MIME type of the file
   * @param fileSize - Size of the file in bytes
   * @param fileBuffer - Base64-encoded file content
   *
   * @returns Object containing success status, detected file type, and message
   *
   * @throws BAD_REQUEST if file size exceeds 50MB
   * @throws BAD_REQUEST if file type is not supported
   * @throws BAD_REQUEST if file is corrupted or cannot be parsed
   */
  validateFileFormat: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1, "파일명은 필수 항목입니다"),
        fileType: z.string().min(1, "파일 타입은 필수 항목입니다"),
        fileSize: z.number().min(0, "파일 크기는 0 이상이어야 합니다"),
        fileBuffer: z.string().min(1, "파일 내용은 필수 항목입니다"),
      })
    )
    .mutation(async ({ input }) => {
      const { fileName, fileType, fileSize, fileBuffer } = input;

      // 1. File size validation (CRITICAL-1: Consider Base64 overhead)
      if (fileSize > FILE_VALIDATION.MAX_FILE_SIZE_ENCODED_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `파일 크기는 ${FILE_VALIDATION.MAX_FILE_SIZE_MB}MB 이하여야 합니다. 현재 파일: ${(
            fileSize /
            1024 /
            1024
          ).toFixed(2)}MB`,
        });
      }

      // 2. MIME type validation (MEDIUM-3: Check against allowed types)
      if (
        !FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(
          fileType as (typeof FILE_VALIDATION.ALLOWED_MIME_TYPES)[number]
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "지원되지 않는 파일 형식입니다. 엑셀(.xlsx, .xls), CSV(.csv), PDF(.pdf) 파일만 업로드 가능합니다",
        });
      }

      // 3. File structure parsing validation
      try {
        const buffer = Buffer.from(fileBuffer, "base64");

        // CRITICAL-2/MEDIUM-3: Magic number validation (prevent MIME type spoofing)
        const fileExtension = fileName.slice(fileName.lastIndexOf("."));
        if (!validateFileSignature(buffer, fileExtension)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "파일 형식이 확장자와 일치하지 않습니다. 파일이 손상되었거나 위변조되었을 수 있습니다",
          });
        }

        // Excel/CSV validation
        if (
          fileType.includes("sheet") ||
          fileType.includes("excel") ||
          fileType.includes("csv")
        ) {
          if (fileName.endsWith(".csv")) {
            // CSV validation: parse first 5 lines to verify structure
            const text = buffer.toString("utf-8");
            const lines = text.split("\n").slice(0, 5);
            if (
              lines.length === 0 ||
              lines.every((line) => line.trim() === "")
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "CSV 파일이 비어있거나 손상되었습니다",
              });
            }
          } else {
            // Excel validation: parse with xlsx library
            const workbook = XLSX.read(buffer, { type: "buffer" });
            if (!workbook.SheetNames.length) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "엑셀 파일에 시트가 없습니다",
              });
            }

            // LOW-1: Validate that sheet has data
            const firstSheetName = workbook.SheetNames[0]!;
            const firstSheet = workbook.Sheets[firstSheetName];

            if (!firstSheet) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "엑셀 파일의 첫 번째 시트를 찾을 수 없습니다",
              });
            }

            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (data.length === 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "엑셀 파일에 데이터가 없습니다",
              });
            }

            // Check if all rows are empty
            if (
              (data as Array<Array<unknown>>).every((row) => row.length === 0)
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "엑셀 파일의 모든 행이 비어있습니다",
              });
            }
          }
        }

        // PDF validation: File signature is already validated by validateFileSignature()
        // Actual PDF parsing will be done by Upstage AI API in Story 3.4 (analyzeFile)
        // No local parsing needed here

        // Validation successful
        return {
          success: true,
          fileType: detectFileType(fileName, fileType),
          message: "파일 형식 검증 성공",
        };
      } catch (error) {
        // LOW-2: Generic error message (don't expose internal errors)
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류";

        // Log detailed error for debugging (in production, use proper logging service)
        console.error("[File Validation Error]", {
          error: errorMessage,
          fileName,
          fileType,
          fileSize,
        });

        // Return user-friendly message
        if (errorMessage === "PDF parsing timeout") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PDF 파일 분석 시간이 초과되었습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다",
          });
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일을 분석할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다",
        });
      }
    }),

  /**
   * Upload file to S3 and create Document metadata record
   *
   * POST /api/trpc/file.uploadFile
   *
   * Performs complete file upload workflow:
   * 1. Validates file format (re-uses Story 3.2 validation logic)
   * 2. Uploads file to S3 with UUID-based key
   * 3. Creates Document metadata record in database
   * 4. Implements rollback mechanism (deletes S3 object if DB creation fails)
   *
   * @param caseId - Case ID to associate the file with
   * @param fileName - Name of the file
   * @param fileType - MIME type of the file
   * @param fileSize - Size of the file in bytes
   * @param fileBuffer - Base64-encoded file content
   *
   * @returns Object containing success status, document record, and message
   *
   * @throws BAD_REQUEST if file validation fails
   * @throws INTERNAL_SERVER_ERROR if S3 upload or DB creation fails
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        fileName: z.string().min(1, "파일명은 필수 항목입니다"),
        fileType: z.string().min(1, "파일 타입은 필수 항목입니다"),
        fileSize: z.number().min(0, "파일 크기는 0 이상이어야 합니다"),
        fileBuffer: z.string().min(1, "파일 내용은 필수 항목입니다"),
        allowDuplicates: z.boolean().optional().default(false), // MEDIUM-2 FIX: Duplicate detection option
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, fileName, fileType, fileSize, fileBuffer, allowDuplicates } = input;
      const userId = ctx.userId;

      // MEDIUM-1 FIX: RBAC - Check Case access permissions
      const targetCase = await ctx.db.case.findUnique({
        where: { id: caseId },
        select: { lawyerId: true },
      });

      if (!targetCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다",
        });
      }

      // Get user role to check admin permissions
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      // Only Case lawyer or Admin can upload files
      if (targetCase.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 파일을 업로드할 권한이 없습니다",
        });
      }

      // MEDIUM-2 FIX: Duplicate file detection (same Case, filename, size within 24 hours)
      if (!allowDuplicates) {
        const existingDoc = await ctx.db.document.findFirst({
          where: {
            caseId,
            originalFileName: fileName,
            fileSize,
            uploadedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        if (existingDoc) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `"${fileName}" 파일은 이미 업로드되었습니다 (동일한 크기: ${(
              fileSize / 1024 / 1024
            ).toFixed(2)}MB). 중복 업로드를 원하시면 allowDuplicates를 true로 설정하세요`,
          });
        }
      }

      // Step 1: Validate file format (re-use Story 3.2 validation logic)
      let validatedFileType: string;
      try {
        const buffer = Buffer.from(fileBuffer, "base64");

        // File size validation
        if (fileSize > FILE_VALIDATION.MAX_FILE_SIZE_ENCODED_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `파일 크기는 ${FILE_VALIDATION.MAX_FILE_SIZE_MB}MB 이하여야 합니다. 현재 파일: ${(
              fileSize /
              1024 /
              1024
            ).toFixed(2)}MB`,
          });
        }

        // MIME type validation
        if (
          !FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(
            fileType as (typeof FILE_VALIDATION.ALLOWED_MIME_TYPES)[number]
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "지원되지 않는 파일 형식입니다. 엑셀(.xlsx, .xls), CSV(.csv), PDF(.pdf) 파일만 업로드 가능합니다",
          });
        }

        // Magic number validation
        const fileExtension = fileName.slice(fileName.lastIndexOf("."));
        if (!validateFileSignature(buffer, fileExtension)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "파일 형식이 확장자와 일치하지 않습니다. 파일이 손상되었거나 위변조되었을 수 있습니다",
          });
        }

        validatedFileType = detectFileType(fileName, fileType);

        // Basic structure validation (parse file to ensure it's valid)
        if (
          fileType.includes("sheet") ||
          fileType.includes("excel") ||
          fileType.includes("csv")
        ) {
          if (fileName.endsWith(".csv")) {
            const text = buffer.toString("utf-8");
            const lines = text.split("\n").slice(0, 5);
            if (
              lines.length === 0 ||
              lines.every((line) => line.trim() === "")
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "CSV 파일이 비어있거나 손상되었습니다",
              });
            }
          } else {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            if (!workbook.SheetNames.length) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "엑셀 파일에 시트가 없습니다",
              });
            }
          }
        }

        // PDF validation: File signature already validated above
        // PDF parsing will be handled by Upstage AI API in analyzeFile
        // No local parsing needed here

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류";
        console.error("[File Validation Error]", {
          error: errorMessage,
          fileName,
          fileType,
          fileSize,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일을 분석할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다",
        });
      }

      // Step 2: Upload to S3
      let s3Key: string;
      try {
        const buffer = Buffer.from(fileBuffer, "base64");
        // LOW-1 FIX: Pass caseId for improved directory structure
        s3Key = await uploadFile(buffer, caseId, fileName, fileType);
      } catch (error) {
        console.error("[S3 Upload Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 업로드 중 오류가 발생했습니다. 다시 시도해주세요",
        });
      }

      // Step 3: Create Document record
      try {
        const document = await ctx.db.document.create({
          data: {
            caseId,
            originalFileName: fileName,
            s3Key,
            fileSize,
            mimeType: fileType,
            uploaderId: userId,
          },
        });

        return {
          success: true,
          document,
          message: `${validatedFileType} 업로드 완료`,
        };
      } catch (error) {
        console.error("[Document Create Error]", error);

        // Rollback: Delete S3 object if DB creation fails
        try {
          await deleteFile(s3Key);
          console.log("[Rollback Success] S3 object deleted after DB failure");
        } catch (deleteError) {
          // MEDIUM-3 FIX: Record orphaned S3 object for cleanup
          console.error("[Rollback Error] Failed to delete S3 object - recording orphan", deleteError);

          try {
            // Note: OrphanedS3Object model would need to be added to Prisma schema
            // For now, we log the orphaned object for manual cleanup
            console.error(
              `[Orphaned S3 Object] Key: ${s3Key}, Case: ${caseId}, File: ${fileName}, Timestamp: ${new Date().toISOString()}`
            );
          } catch (recordError) {
            console.error("[Record Error] Failed to log orphaned object", recordError);
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 메타데이터 저장 실패",
        });
      }
    }),

  /**
   * Analyze file structure and identify columns
   *
   * POST /api/trpc/file.analyzeFile
   *
   * Story 3.4: Analyzes uploaded files to detect structure and identify columns.
   * Downloads file from S3, analyzes structure, and stores results in database.
   *
   * Workflow:
   * 1. Verify Document exists and user has access (RBAC)
   * 2. Check if analysis already exists (skip if completed)
   * 3. Download file from S3
   * 4. Analyze file structure (detect columns, headers, format)
   * 5. Create/update FileAnalysisResult record
   *
   * @param documentId - Document ID to analyze
   *
   * @returns Object containing analysis result with column mapping and metadata
   *
   * @throws NOT_FOUND if document doesn't exist
   * @throws FORBIDDEN if user doesn't have access to the Case
   * @throws INTERNAL_SERVER_ERROR if analysis fails
   */
  analyzeFile: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
        useLlmAnalysis: z.boolean().optional().default(true), // LLM 기반 컬럼 분석 (OpenAI 직접 호출)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId, useLlmAnalysis } = input;
      const userId = ctx.userId;

      // Step 1: Get Document with Case information
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // Step 2: RBAC - Check user permissions (Case lawyer or Admin only)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서를 분석할 권한이 없습니다",
        });
      }

      // Step 3: Check if analysis already exists
      const existingAnalysis = await ctx.db.fileAnalysisResult.findUnique({
        where: { documentId },
      });

      if (existingAnalysis?.status === "completed") {
        // Return existing analysis if already completed
        return {
          success: true,
          analysisResult: existingAnalysis,
          message: "파일 분석 완료 (기존 결과)",
        };
      }

      // Step 4: Create or update FileAnalysisResult record with "analyzing" status
      const analysisResult = await ctx.db.fileAnalysisResult.upsert({
        where: { documentId },
        create: {
          documentId,
          caseId: document.caseId,
          status: "analyzing",
          columnMapping: {},
          headerRowIndex: 0,
          totalRows: 0,
          detectedFormat: "excel",
          hasHeaders: true,
          confidence: 0.0,
        },
        update: {
          status: "analyzing",
        },
      });

      // Step 5: Download file from S3
      let fileBuffer: Buffer;
      try {
        fileBuffer = await downloadFile(document.s3Key);
      } catch (error) {
        console.error("[S3 Download Error]", error);

        // Update analysis result with failed status
        await ctx.db.fileAnalysisResult.update({
          where: { id: analysisResult.id },
          data: {
            status: "failed",
            errorMessage: "S3 파일 다운로드 실패",
            errorDetails: {
              originalError: error instanceof Error ? error.message : String(error),
            },
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 다운로드 중 오류가 발생했습니다",
        });
      }

      // Step 6: Analyze file structure
      let analysisData;
      try {
        // DB에서 Upstage API 키 가져오기
        const { SettingsService } = await import("~/server/services/settings-service");
        const settingsService = new SettingsService(ctx.db);
        const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
        
        console.log("[File Analysis] Upstage API key loaded from DB:", upstageApiKey ? "YES" : "NO");
        
        // LLM 기반 분석 옵션 전달 + Prisma client for template lookup + API key
        analysisData = await analyzeFileStructure(fileBuffer, document.mimeType, useLlmAnalysis, ctx.db, upstageApiKey || undefined);
      } catch (error) {
        console.error("[File Analysis Error]", error);

        // Update analysis result with failed status
        await ctx.db.fileAnalysisResult.update({
          where: { id: analysisResult.id },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "파일 구조 분석 실패",
            errorDetails: {
              originalError: error instanceof Error ? error.stack : String(error),
            },
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 구조 분석 중 오류가 발생했습니다",
        });
      }

      // Step 7: Update FileAnalysisResult with analysis data
      try {
        const updatedResult = await ctx.db.fileAnalysisResult.update({
          where: { id: analysisResult.id },
          data: {
            status: "analyzing", // Keep status as "analyzing" for Story 3.6 extractData
            columnMapping: analysisData.columnMapping,
            headerRowIndex: analysisData.headerRowIndex,
            totalRows: analysisData.totalRows,
            detectedFormat: analysisData.detectedFormat,
            hasHeaders: analysisData.hasHeaders,
            confidence: analysisData.confidence,
            errorMessage: analysisData.errorMessage,
            extractedData: analysisData.extractedData as Prisma.InputJsonValue, // Save extracted data for reuse
            ...(analysisData.errorDetails && {
              errorDetails: analysisData.errorDetails as Prisma.InputJsonValue,
            }),
          },
        });

        return {
          success: true,
          analysisResult: updatedResult,
          message: "파일 분석 완료",
        };
      } catch (error) {
        console.error("[Database Update Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "분석 결과 저장 실패",
        });
      }
    }),

  /**
   * Get file analysis result by document ID
   *
   * QUERY /api/trpc/file.getAnalysisResult
   *
   * Story 3.5: Retrieves FileAnalysisResult for displaying completion summary.
   * Used by ProgressBar component to show analysis completion details.
   *
   * @param documentId - Document ID to get analysis result for
   *
   * @returns FileAnalysisResult with analysis details including column mapping,
   *          total rows, detected format, headers, confidence score
   *
   * @throws NOT_FOUND if document or analysis result doesn't exist
   * @throws FORBIDDEN if user doesn't have access to the Case
   */
  getAnalysisResult: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // Step 1: Get Document with Case information
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          originalFileName: true,
          caseId: true,
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // Step 2: RBAC - Check user permissions (Case lawyer or Admin only)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서의 분석 결과를 조회할 권한이 없습니다",
        });
      }

      // Step 3: Get analysis result
      const analysisResult = await ctx.db.fileAnalysisResult.findUnique({
        where: { documentId },
      });

      if (!analysisResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "분석 결과를 찾을 수 없습니다",
        });
      }

      // 실제 저장된 거래 건수 조회 (DB에서 직접 카운트)
      const savedTransactionCount = await ctx.db.transaction.count({
        where: { documentId },
      });

      return {
        success: true,
        document: {
          id: document.id,
          fileName: document.originalFileName,
        },
        analysisResult,
        savedTransactionCount, // 실제 저장된 거래 건수
      };
    }),

  /**
   * Extract data from file and save to Transaction table
   *
   * POST /api/trpc/file.extractData
   *
   * Story 3.6: Extracts transaction data from uploaded files and saves to database.
   * Downloads file from S3, parses Excel/CSV, extracts data based on column mapping,
   * and performs bulk insert to Transaction table.
   *
   * Workflow:
   * 1. Verify Document exists and user has access (RBAC)
   * 2. Check if file analysis is completed (column mapping available)
   * 3. Update FileAnalysisResult status to "processing" (75% progress)
   * 4. Download file from S3
   * 5. Parse Excel/CSV to extract raw data
   * 6. Extract and save transactions using extractAndSaveTransactions
   * 7. Update FileAnalysisResult status to "completed" (100% progress)
   *
   * Performance: NFR-002 - 1,000 records in 60 seconds using Prisma createMany bulk insert
   *
   * @param documentId - Document ID to extract data from
   *
   * @returns Object containing success status, message, extraction statistics
   *
   * @throws NOT_FOUND if document doesn't exist
   * @throws FORBIDDEN if user doesn't have access to the Case
   * @throws BAD_REQUEST if file analysis is not completed
   * @throws INTERNAL_SERVER_ERROR if extraction fails
   */
  extractData: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // Step 1: Get Document with Case information
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // Step 2: RBAC - Check user permissions (Case lawyer or Admin only)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서의 데이터를 추출할 권한이 없습니다",
        });
      }

      // Step 3: Check FileAnalysisResult status (must be "analyzing" or "completed")
      const analysisResult = await ctx.db.fileAnalysisResult.findUnique({
        where: { documentId },
      });

      if (!analysisResult) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일 구조 분석이 완료되지 않았습니다",
        });
      }

      // MEDIUM-2 FIX: Validate required columns before extraction (LOW-1 also)
      // Note: columnMapping in DB is stored as string→string (e.g., { date: "거래일" })
      // We'll validate based on keys, not values
      const rawColumnMapping = analysisResult.columnMapping as Record<string, string>;

      if (!rawColumnMapping.date) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "파일 구조 분석에서 '날짜' 열을 찾을 수 없습니다. 분석 결과를 확인하고 다시 시도해주세요",
        });
      }

      if (
        !rawColumnMapping.deposit &&
        !rawColumnMapping.withdrawal &&
        !rawColumnMapping.balance &&
        !rawColumnMapping.amount // 단일 금액 컬럼 방식도 허용
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "파일 구조 분석에서 금액 관련 열(입금액/출금액/거래금액/잔액)을 찾을 수 없습니다",
        });
      }

      // 분석 완료 또는 진행 중일 때 추출 허용
      if (analysisResult.status !== "analyzing" && analysisResult.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `파일 분석 상태가 올바르지 않습니다 (현재: ${analysisResult.status})`,
        });
      }

      // MEDIUM-2 FIX: Use optimistic locking - only update if still "analyzing"
      const updateResult = await ctx.db.fileAnalysisResult.updateMany({
        where: {
          documentId,
          status: "analyzing", // Only update if still in analyzing state
        },
        data: {
          status: "processing", // 75% progress
        },
      });

      // MEDIUM-2 FIX: If no rows updated, another process already started extraction
      if (updateResult.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "다른 사용자가 이 파일을 처리 중입니다. 잠시 후 다시 시도해주세요",
        });
      }

      // LOW-2 FIX: Check if data already extracted (idempotency)
      const existingCount = await ctx.db.transaction.count({
        where: { documentId },
      });

      if (existingCount > 0) {
        // Data already extracted from this document
        console.log(
          `[Idempotent] Document ${documentId} already has ${existingCount} transactions`
        );

        // Update status to completed
        await ctx.db.fileAnalysisResult.update({
          where: { documentId },
          data: {
            status: "completed",
            analyzedAt: new Date(),
          },
        });

        return {
          success: true,
          message: `이 파일의 데이터는 이미 추출되었습니다 (${existingCount}건)`,
          extractedCount: existingCount,
          skippedCount: 0,
          errors: [],
        };
      }

      try {
        // MEDIUM-2 FIX: Add timeout for entire extraction process
        const EXTRACTION_TIMEOUT_MS = 90 * 1000; // 90 seconds

        const extractionPromise = performExtraction(
          ctx,
          document,
          rawColumnMapping,
          analysisResult.headerRowIndex,
          document.mimeType,
          analysisResult // Pass analysisResult for extractedData
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Data extraction timeout (90 seconds exceeded)"));
          }, EXTRACTION_TIMEOUT_MS);
        });

        // Race extraction against timeout
        const result = await Promise.race([extractionPromise, timeoutPromise]);

        // Step 8: Update FileAnalysisResult to "completed" (100% progress)
        await ctx.db.fileAnalysisResult.update({
          where: { documentId },
          data: {
            status: "completed",
            analyzedAt: new Date(),
            ...(result.skippedCount > 0 && {
              errorMessage: `${result.skippedCount}건의 데이터를 건너뛰었습니다 (전체 ${result.totalRows}건 중)`,
              errorDetails: {
                skippedRecords: result.errors,
                totalRows: result.totalRows,
                successCount: result.extractedCount,
                skippedCount: result.skippedCount,
              },
            }),
          },
        });

        // Step 9: Return success message
        return {
          success: true,
          message: `${result.extractedCount}건의 거래 데이터를 저장했습니다${result.skippedCount > 0 ? ` (${result.skippedCount}건 건너뛰기)` : ""}`,
          extractedCount: result.extractedCount,
          skippedCount: result.skippedCount,
          errors: result.errors,
        };
      } catch (error) {
        // MEDIUM-2 FIX: Always set failed status on error
        await ctx.db.fileAnalysisResult.update({
          where: { documentId },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "데이터 추출 실패",
            errorDetails: {
              originalError:
                error instanceof Error ? error.stack : String(error),
            },
          },
        });

        // MEDIUM-2 FIX: Check if timeout error
        if (error instanceof Error && error.message === "Data extraction timeout (90 seconds exceeded)") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "데이터 추출이 시간 초과되었습니다 (최대 90초). 파일이 매우 크거나 네트워크가 느릴 수 있습니다",
          });
        }

        // Handle TRPCError (already logged and formatted above)
        if (error instanceof TRPCError) {
          throw error;
        }

        // Handle unexpected errors
        console.error("[Unexpected Error]", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "데이터 추출 중 오류가 발생했습니다",
        });
      }
    }),

  /**
   * Get transactions preview for a document
   *
   * QUERY /api/trpc/file.getTransactionsPreview
   *
   * Retrieves the first 20 transactions for preview purposes.
   * Only accessible by Case lawyer or Admin.
   *
   * @param documentId - Document ID to preview
   *
   * @returns First 20 transactions ordered by date (ascending)
   *
   * @throws NOT_FOUND if document doesn't exist
   * @throws FORBIDDEN if user lacks permissions
   */
  getTransactionsPreview: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // 1. Document 조회 (RBAC 체크)
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          originalFileName: true,
          uploadedAt: true,
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // 2. RBAC 권한 체크 (Case lawyer 또는 Admin만 접근 가능)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서를 조회할 권한이 없습니다",
        });
      }

      // 3. Transaction 테이블에서 처음 20건 조회 (transactionDate 오름차순)
      // MEDIUM-2 FIX: 병렬 쿼리 실행으로 N+1 문제 해결 (Promise.all)
      const [transactions, totalCount] = await Promise.all([
        ctx.db.transaction.findMany({
          where: { documentId },
          orderBy: { transactionDate: "asc" },
          take: 20,
          select: {
            id: true,
            transactionDate: true,
            depositAmount: true,
            withdrawalAmount: true,
            balance: true,
            memo: true,
          },
        }),
        ctx.db.transaction.count({
          where: { documentId },
        }),
      ]);

      return {
        documentId: document.id,
        documentName: document.originalFileName,
        uploadedAt: document.uploadedAt,
        totalTransactions: totalCount,
        transactions,
      };
    }),

  /**
   * Delete a document and all related data
   *
   * MUTATION /api/trpc/file.deleteDocument
   *
   * Deletes a document and all related data (transactions, analysis results, S3 file).
   * Only accessible by Case lawyer or Admin.
   * Cannot delete if file is currently being processed (status: processing, saving).
   *
   * @param documentId - Document ID to delete
   *
   * @returns Success message
   *
   * @throws NOT_FOUND if document doesn't exist
   * @throws FORBIDDEN if user lacks permissions or file is being processed
   */
  deleteDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // 1. Document 조회 (RBAC 체크)
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          s3Key: true,
          originalFileName: true,
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // 2. RBAC 권한 체크 (Case lawyer 또는 Admin만 삭제 가능)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서를 삭제할 권한이 없습니다",
        });
      }

      // 3. FileAnalysisResult.status 확인 (analyzing, processing, saving 상태면 삭제 불가)
      const analysisResult = await ctx.db.fileAnalysisResult.findUnique({
        where: { documentId },
        select: { status: true },
      });

      if (analysisResult && ["processing", "saving"].includes(analysisResult.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이미 분석이 시작된 파일은 삭제할 수 없습니다",
        });
      }

      // 4. Document 삭제 (CASCADE로 FileAnalysisResult, Transaction 자동 삭제)
      // MEDIUM-1 FIX: DB 삭제 먼저 수행 → S3 삭제는 실패해도 로깅만 (orphan S3 객체 방지)
      try {
        await ctx.db.document.delete({
          where: { id: documentId },
        });
      } catch (error) {
        console.error("[Prisma Delete Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB 삭제에 실패했습니다",
        });
      }

      // 5. S3 파일 삭제 (DB 삭제 성공 후, 실패는 로깅만 - non-blocking)
      try {
        await deleteFile(document.s3Key);
      } catch (error) {
        // S3 삭제 실패는 로깅만 (DB는 이미 삭제됨, 사용자 경험 저하 방지)
        console.error("[S3 Delete Error - Non-blocking]", error);
        // S3 정리 작업은 백그라운드 작업으로 처리 가능
      }

      return {
        success: true,
        message: "파일이 삭제되었습니다",
      };
    }),

  /**
   * Pre-analyze file for template matching (앞 3페이지만 추출하여 매칭 테스트)
   * 
   * 새로운 업로드 절차:
   * 1. 파일 업로드 후 앞 3페이지만 추출
   * 2. 템플릿 매칭 테스트 수행
   * 3. 매칭 결과(템플릿명, 신뢰도, 샘플 데이터)를 반환
   * 4. 사용자가 확인 후 진행 또는 템플릿 선택
   */
  preAnalyzeFile: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // Get Document with Case information
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // RBAC check
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서를 분석할 권한이 없습니다",
        });
      }

      // Download file
      const fileBuffer = await downloadFile(document.s3Key);
      
      if (document.mimeType.includes("pdf")) {
        // PDF: 앞 3페이지만 추출하여 분석
        const { PDFDocument } = await import("pdf-lib");
        const { parsePdfWithUpstage } = await import("~/lib/pdf-ocr");
        const { SettingsService } = await import("~/server/services/settings-service");
        const settingsService = new SettingsService(ctx.db);
        const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
        
        // PDF 로드 및 페이지 수 확인
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const totalPdfPages = pdfDoc.getPageCount();
        const previewPages = Math.min(3, totalPdfPages); // 최대 3페이지
        
        console.log(`[PreAnalyze] PDF 총 ${totalPdfPages}페이지, 미리보기용 ${previewPages}페이지 추출`);
        
        // 앞 3페이지만 추출
        let previewBuffer: Buffer;
        if (totalPdfPages <= 3) {
          // 3페이지 이하면 전체 사용
          previewBuffer = fileBuffer;
        } else {
          // 앞 3페이지만 새 PDF로 생성
          const previewPdf = await PDFDocument.create();
          const pageIndices = Array.from({ length: previewPages }, (_, i) => i);
          const copiedPages = await previewPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach(page => previewPdf.addPage(page));
          previewBuffer = Buffer.from(await previewPdf.save());
        }
        
        console.log(`[PreAnalyze] 미리보기 PDF 크기: ${(previewBuffer.length / 1024).toFixed(2)}KB`);
        
        // Upstage API로 앞 3페이지 분석
        const tableData = await parsePdfWithUpstage(previewBuffer, upstageApiKey || undefined);
        
        // 템플릿 매칭 시도
        const { matchByIdentifiers } = await import("~/lib/template-classifier");
        
        const templates = await ctx.db.transactionTemplate.findMany({
          where: { isActive: true },
          orderBy: { priority: "desc" },
        });
        
        const parsedTemplates = templates.map(t => ({
          ...t,
          columnSchema: t.columnSchema as {
            columns: Record<string, { index: number; header: string }>;
            parseRules?: { rowMergePattern?: "pair" | "none" };
          },
        }));
        
        const matchedTemplate = matchByIdentifiers(
          tableData.headers, 
          parsedTemplates,
          tableData.pageTexts
        );
        
        // 매칭 신뢰도 계산
        let confidence = 0;
        if (matchedTemplate) {
          // 식별자 매칭 개수 기반 신뢰도
          const identifiers = matchedTemplate.identifiers || [];
          const pageTextContent = (tableData.pageTexts || []).join(" ").toLowerCase();
          const headersContent = tableData.headers.join(" ").toLowerCase();
          const matchedIdentifiers = identifiers.filter(id => 
            pageTextContent.includes(id.toLowerCase()) || headersContent.includes(id.toLowerCase())
          );
          confidence = identifiers.length > 0 
            ? Math.round((matchedIdentifiers.length / identifiers.length) * 100) 
            : 50;
        }
        
        return {
          success: true,
          fileName: document.originalFileName,
          totalPdfPages,
          previewPages,
          headers: tableData.headers,
          sampleRows: tableData.rows.slice(0, 10),
          pageTexts: tableData.pageTexts,
          // 매칭 결과
          matchResult: matchedTemplate ? {
            matched: true,
            templateId: matchedTemplate.id,
            templateName: matchedTemplate.name,
            bankName: matchedTemplate.bankName,
            confidence,
            identifiers: matchedTemplate.identifiers,
          } : {
            matched: false,
            templateId: null,
            templateName: null,
            bankName: null,
            confidence: 0,
            identifiers: [],
          },
          // 전체 템플릿 목록 (선택용)
          availableTemplates: templates.map(t => ({
            id: t.id,
            name: t.name,
            bankName: t.bankName,
            description: t.description,
            identifiers: t.identifiers,
          })),
        };
      } else {
        // Excel/CSV
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "엑셀 파일에 시트가 없습니다",
          });
        }
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "워크시트를 찾을 수 없습니다",
          });
        }
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as string[][];
        
        if (rawData.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "파일에 데이터가 없습니다",
          });
        }
        
        const headers = (rawData[0] || []).map(h => String(h));
        const sampleRows = rawData.slice(1, 11);
        
        // 템플릿 목록
        const templates = await ctx.db.transactionTemplate.findMany({
          where: { isActive: true },
          orderBy: { priority: "desc" },
        });
        
        return {
          success: true,
          fileName: document.originalFileName,
          totalPdfPages: 0,
          previewPages: 0,
          headers,
          sampleRows,
          pageTexts: [],
          matchResult: {
            matched: false,
            templateId: null,
            templateName: null,
            bankName: null,
            confidence: 0,
            identifiers: [],
          },
          availableTemplates: templates.map(t => ({
            id: t.id,
            name: t.name,
            bankName: t.bankName,
            description: t.description,
            identifiers: t.identifiers,
          })),
        };
      }
    }),

  /**
   * Analyze file with manually selected template
   * 
   * 사용자가 수동으로 선택한 템플릿으로 분석 진행
   */
  analyzeWithTemplate: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
        templateId: z.string().min(1, "템플릿 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId, templateId } = input;
      const userId = ctx.userId;

      // Get Document with Case information
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            select: {
              id: true,
              lawyerId: true,
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "문서를 찾을 수 없습니다",
        });
      }

      // RBAC check
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서를 분석할 권한이 없습니다",
        });
      }

      // Get template
      const template = await ctx.db.transactionTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      // Download and parse file
      const fileBuffer = await downloadFile(document.s3Key);
      
      let headers: string[] = [];
      let rows: string[][] = [];
      
      if (document.mimeType.includes("pdf")) {
        const { parsePdfWithUpstage } = await import("~/lib/pdf-ocr");
        const { SettingsService } = await import("~/server/services/settings-service");
        const settingsService = new SettingsService(ctx.db);
        const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
        
        const tableData = await parsePdfWithUpstage(fileBuffer, upstageApiKey || undefined);
        headers = tableData.headers;
        rows = tableData.rows;
      } else {
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "엑셀 파일에 시트가 없습니다" });
        }
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "워크시트를 찾을 수 없습니다" });
        }
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as string[][];
        headers = (rawData[0] || []).map(h => String(h));
        rows = rawData.slice(1);
      }

      // Convert template columnSchema to columnMapping
      const { convertSchemaToMapping } = await import("~/lib/template-classifier");
      const templateSchema = template.columnSchema as {
        columns: Record<string, { index: number; header: string }>;
        parseRules?: { rowMergePattern?: "pair" | "none" };
      };
      
      const { columnMapping: numericMapping, memoInAmountColumn } = convertSchemaToMapping(
        templateSchema,
        headers
      );
      
      // Convert numeric mapping to string-based mapping
      const columnMapping: Record<string, string> = {};
      for (const [key, idx] of Object.entries(numericMapping)) {
        if (typeof idx === "number" && idx >= 0 && idx < headers.length) {
          columnMapping[key] = headers[idx] || "";
        }
      }
      
      if (memoInAmountColumn) {
        (columnMapping as Record<string, unknown>).memoInAmountColumn = true;
      }
      
      if (templateSchema.parseRules?.rowMergePattern) {
        (columnMapping as Record<string, unknown>).rowMergePattern = templateSchema.parseRules.rowMergePattern;
      }

      // Create/update FileAnalysisResult
      const analysisResult = await ctx.db.fileAnalysisResult.upsert({
        where: { documentId },
        create: {
          documentId,
          caseId: document.caseId,
          status: "analyzing",
          columnMapping,
          headerRowIndex: 0,
          totalRows: rows.length,
          detectedFormat: document.mimeType.includes("pdf") ? "pdf" : "excel",
          hasHeaders: true,
          confidence: 1.0, // 수동 선택이므로 100%
          extractedData: { headers, rows } as Prisma.InputJsonValue,
          llmAnalysis: {
            transactionTypeMethod: "manual_template",
            memoInAmountColumn,
            reasoning: `수동 템플릿 선택: ${template.name}${template.bankName ? ` [${template.bankName}]` : ""}`,
          } as Prisma.InputJsonValue,
        },
        update: {
          status: "analyzing",
          columnMapping,
          totalRows: rows.length,
          confidence: 1.0,
          extractedData: { headers, rows } as Prisma.InputJsonValue,
          llmAnalysis: {
            transactionTypeMethod: "manual_template",
            memoInAmountColumn,
            reasoning: `수동 템플릿 선택: ${template.name}${template.bankName ? ` [${template.bankName}]` : ""}`,
          } as Prisma.InputJsonValue,
        },
      });

      // Update template match count
      await ctx.db.transactionTemplate.update({
        where: { id: templateId },
        data: { matchCount: { increment: 1 } },
      });

      return {
        success: true,
        analysisResult,
        templateName: template.name,
        bankName: template.bankName,
        message: `템플릿 "${template.name}" 적용 완료`,
      };
    }),

  /**
   * Get all documents for a case
   *
   * @param caseId - Case ID
   * @returns Array of documents for the case
   *
   * @throws FORBIDDEN if user lacks permission
   */
  getDocumentsForCase: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId } = input;
      const userId = ctx.userId;

      // RBAC: Check user permissions
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
        select: { lawyerId: true },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다",
        });
      }

      if (caseRecord.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건의 문서를 조회할 권한이 없습니다",
        });
      }

      // Get all documents for this case
      const documents = await ctx.db.document.findMany({
        where: { caseId },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      });

      return documents;
    }),
});

/**
 * MEDIUM-2 FIX: Separate function for extraction logic to enable timeout
 *
 * @param ctx - tRPC context
 * @param document - Document record
 * @param columnMapping - Column mapping from file analysis (string→string format)
 * @param headerRowIndex - Header row index
 * @param mimeType - MIME type to detect file format (Excel/CSV vs PDF)
 * @param analysisResult - FileAnalysisResult containing extractedData and llmAnalysis
 * @returns Extraction result
 */
async function performExtraction(
  ctx: { db: PrismaClient },
  document: { id: string; s3Key: string; caseId: string },
  columnMapping: Record<string, string>,
  headerRowIndex: number,
  mimeType: string,
  analysisResult: { 
    extractedData?: { headers: string[]; rows: string[][] };
    llmAnalysis?: { memoInAmountColumn?: boolean };
  }
): Promise<{
  extractedCount: number;
  skippedCount: number;
  totalRows: number;
  errors: Array<{ row: number; error: string }>;
}> {
  const { id: documentId, s3Key, caseId } = document;

  // Download file from S3
  const fileBuffer = await downloadFile(s3Key);

  let rawData: unknown[][];
  let headerRow: string[];

  // Check if we have extractedData from analyzeFile (reuse to avoid calling Upstage API again)
  if (analysisResult.extractedData) {
    console.log("[Extract Data] Reusing extracted data from analyzeFile...");
    const extractedData = analysisResult.extractedData as { headers: string[]; rows: string[][] };
    rawData = [extractedData.headers, ...extractedData.rows];
    headerRow = extractedData.headers;
    console.log(`[Extract Data] Reused ${extractedData.rows.length} rows from previous extraction`);
  } else if (mimeType.includes("pdf")) {
    // Fallback: Use Upstage API to parse PDF (if extractedData not available)
    console.log("[PDF Extraction] Using Upstage API to extract table data...");
    const { parsePdfWithUpstage } = await import("~/lib/pdf-ocr");
    const tableData = await parsePdfWithUpstage(fileBuffer);

    // Convert table data to rawData format (array of arrays)
    // First row is headers, rest are data rows
    rawData = [tableData.headers, ...tableData.rows];
    headerRow = tableData.headers;
    console.log(`[PDF Extraction] Converted ${tableData.totalRows} rows to rawData format`);
  } else {
    // Parse Excel/CSV file
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    if (!workbook.SheetNames.length) {
      throw new Error("엑셀 파일에 시트가 없습니다");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("첫 번째 시트를 찾을 수 없습니다");
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error("워크시트를 찾을 수 없습니다");
    }

    // Convert to array of arrays (raw data with header)
    rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    }) as unknown[][];

    headerRow = rawData[0] as string[];
  }

  if (rawData.length === 0) {
    throw new Error("파일에 데이터가 없습니다");
  }

  // Update status to "saving" (90%) - 데이터 저장 중
  await ctx.db.fileAnalysisResult.update({
    where: { documentId },
    data: { status: "saving" },
  });

  // Fallback: LLM이 memo 컬럼을 찾지 못한 경우 헤더에서 자동 탐지
  const memoColumnKeywords = [
    "비고", "적요", "내용", "거래내용", "메모", "설명",
    "계좌 정보", "계좌정보", "결제 정보", "결제정보",
    "상대방", "거래처", "거래상대", "받는분", "보내는분",
    "은행", "계좌번호", "내역", "정보"
  ];

  if (!columnMapping.memo && !analysisResult.llmAnalysis?.memoInAmountColumn) {
    // memo가 없고 memoInAmountColumn도 아닌 경우, 헤더에서 비고 컬럼 찾기
    for (const keyword of memoColumnKeywords) {
      const foundHeader = headerRow.find(h => 
        h && typeof h === "string" && h.toLowerCase().includes(keyword.toLowerCase())
      );
      if (foundHeader) {
        console.log(`[performExtraction] Fallback memo detection: found "${foundHeader}" matching keyword "${keyword}"`);
        columnMapping.memo = foundHeader;
        break;
      }
    }

    // 그래도 못 찾으면 날짜/금액/잔액 아닌 컬럼 중 첫 번째 텍스트 컬럼 선택
    if (!columnMapping.memo) {
      const knownColumns = new Set([
        columnMapping.date,
        columnMapping.deposit,
        columnMapping.withdrawal,
        columnMapping.amount,
        columnMapping.balance,
        columnMapping.transaction_type,
      ].filter(Boolean));

      const candidateColumns = headerRow.filter(h => 
        h && typeof h === "string" && !knownColumns.has(h) && h.trim().length > 0
      );

      if (candidateColumns.length > 0) {
        const memoCandidate = candidateColumns[candidateColumns.length - 1]; // 보통 마지막 컬럼이 비고
        console.log(`[performExtraction] Fallback memo detection: using last unknown column "${memoCandidate}"`);
        columnMapping.memo = memoCandidate;
      }
    }
  }

  // Convert columnMapping from string→string to ColumnMapping (number) for extractAndSaveTransactions
  const numericColumnMapping: ColumnMapping = {};
  for (const [key, columnName] of Object.entries(columnMapping)) {
    // memoInAmountColumn은 boolean 값이므로 별도 처리
    if (key === "memoInAmountColumn" && columnName === true) {
      numericColumnMapping.memoInAmountColumn = true;
      continue;
    }
    // rowMergePattern 전달
    if (key === "rowMergePattern" && (columnName === "pair" || columnName === "none")) {
      numericColumnMapping.rowMergePattern = columnName;
      console.log(`[performExtraction] rowMergePattern: ${columnName}`);
      continue;
    }
    if (typeof columnName === "string") {
      const index = headerRow.indexOf(columnName);
      if (index !== -1) {
        (numericColumnMapping as Record<string, number>)[key] = index;
      } else {
        console.warn(`[performExtraction] Column "${columnName}" not found in headerRow for key "${key}"`);
      }
    }
  }

  // llmAnalysis에서 memoInAmountColumn 전달
  if (analysisResult.llmAnalysis?.memoInAmountColumn) {
    numericColumnMapping.memoInAmountColumn = true;
    console.log(`[performExtraction] memoInAmountColumn enabled from LLM analysis`);
  }

  // 디버그: columnMapping 변환 결과
  console.log(`[performExtraction] ========== COLUMN MAPPING ==========`);
  console.log(`[performExtraction] Original columnMapping:`, columnMapping);
  console.log(`[performExtraction] Numeric columnMapping:`, numericColumnMapping);
  console.log(`[performExtraction] Header row:`, headerRow);
  console.log(`[performExtraction] Memo column:`, {
    name: columnMapping.memo,
    index: numericColumnMapping.memo,
    found: numericColumnMapping.memo !== undefined,
  });
  console.log(`[performExtraction] rowMergePattern:`, numericColumnMapping.rowMergePattern);
  console.log(`[performExtraction] memoInAmountColumn:`, numericColumnMapping.memoInAmountColumn);
  console.log(`[performExtraction] =========================================`);

  // Extract and save transactions
  const extractionResult = await extractAndSaveTransactions(
    ctx.db,
    documentId,
    caseId,
    rawData,
    numericColumnMapping,
    headerRowIndex
  );

  return {
    extractedCount: extractionResult.success,
    skippedCount: extractionResult.skipped,
    totalRows: rawData.length,
    errors: extractionResult.errors,
  };
}
