import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { FILE_VALIDATION, validateFileSignature } from "~/lib/file-validation";
import { uploadFileToS3, deleteFileFromS3, downloadFileFromS3 } from "~/lib/s3";
import { analyzeFileStructure } from "~/lib/file-analyzer";
import { extractAndSaveTransactions, type ColumnMapping } from "~/lib/data-extractor";
import type { Prisma } from "@prisma/client";

// pdf-parse doesn't have proper TypeScript types, using require with type assertion
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{
  numPages?: number;
  numpages?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}>;

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

        // PDF validation (MEDIUM-2: Add timeout and page limit)
        if (fileType === "application/pdf") {
          // Implement timeout for PDF parsing
          const pdfPromise = pdfParse(buffer) as Promise<{
            numPages?: number;
            numpages?: number;
          }>;

          // Create timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error("PDF parsing timeout"));
            }, FILE_VALIDATION.PDF_PARSING_TIMEOUT_MS);
          });

          // Race between parsing and timeout
          const data = (await Promise.race([pdfPromise, timeoutPromise])) as {
            numPages?: number;
            numpages?: number;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          };

          const pageCount = data.numPages ?? data.numpages ?? 0;

          // Validate page count
          if (!pageCount) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "PDF 파일에 페이지가 없습니다",
            });
          }

          // MEDIUM-2: Enforce maximum page limit
          if (pageCount > FILE_VALIDATION.MAX_pdf_PAGES) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `PDF 파일이 너무 큽니다 (${pageCount}페이지). 최대 ${FILE_VALIDATION.MAX_pdf_PAGES}페이지까지 지원합니다`,
            });
          }
        }

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

        if (fileType === "application/pdf") {
          const pdfPromise = pdfParse(buffer) as Promise<{
            numPages?: number;
            numpages?: number;
          }>;

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error("PDF parsing timeout"));
            }, FILE_VALIDATION.PDF_PARSING_TIMEOUT_MS);
          });

          const data = (await Promise.race([pdfPromise, timeoutPromise])) as {
            numPages?: number;
            numpages?: number;
          };

          const pageCount = data.numPages ?? data.numpages ?? 0;

          if (!pageCount) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "PDF 파일에 페이지가 없습니다",
            });
          }

          if (pageCount > FILE_VALIDATION.MAX_pdf_PAGES) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `PDF 파일이 너무 큽니다 (${pageCount}페이지). 최대 ${FILE_VALIDATION.MAX_pdf_PAGES}페이지까지 지원합니다`,
            });
          }
        }
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
        s3Key = await uploadFileToS3(buffer, caseId, fileName, fileType);
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
          await deleteFileFromS3(s3Key);
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
        fileBuffer = await downloadFileFromS3(document.s3Key);
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
        analysisData = await analyzeFileStructure(fileBuffer, document.mimeType);
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

      return {
        success: true,
        document: {
          id: document.id,
          fileName: document.originalFileName,
        },
        analysisResult,
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

      if (analysisResult.status !== "analyzing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `파일 분석 상태가 올바르지 않습니다 (현재: ${analysisResult.status})`,
        });
      }

      // Step 4: Update status to "processing" (75% progress for SSE)
      await ctx.db.fileAnalysisResult.update({
        where: { documentId },
        data: { status: "processing" },
      });

      try {
        // Step 5: Download file from S3
        let fileBuffer: Buffer;
        try {
          fileBuffer = await downloadFileFromS3(document.s3Key);
        } catch (error) {
          console.error("[S3 Download Error]", error);

          // Update analysis result with failed status
          await ctx.db.fileAnalysisResult.update({
            where: { documentId },
            data: {
              status: "failed",
              errorMessage: "S3 파일 다운로드 실패",
              errorDetails: {
                originalError:
                  error instanceof Error ? error.message : String(error),
              },
            },
          });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "파일 다운로드 중 오류가 발생했습니다",
          });
        }

        // Step 6: Parse Excel/CSV file
        let rawData: unknown[][];
        try {
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

          if (rawData.length === 0) {
            throw new Error("파일에 데이터가 없습니다");
          }
        } catch (error) {
          console.error("[Excel Parse Error]", error);

          // Update analysis result with failed status
          await ctx.db.fileAnalysisResult.update({
            where: { documentId },
            data: {
              status: "failed",
              errorMessage:
                error instanceof Error ? error.message : "엑셀 파싱 실패",
              errorDetails: {
                originalError:
                  error instanceof Error ? error.stack : String(error),
              },
            },
          });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "엑셀 파일 파싱 중 오류가 발생했습니다",
          });
        }

        // Step 7: Extract and save transactions
        const columnMapping = analysisResult.columnMapping as ColumnMapping;
        const headerRowIndex = analysisResult.headerRowIndex;

        let extractionResult;
        try {
          // Update status to "saving" (90%) - 데이터 저장 중
          await ctx.db.fileAnalysisResult.update({
            where: { documentId },
            data: { status: "saving" },
          });

          extractionResult = await extractAndSaveTransactions(
            ctx.db,
            documentId,
            document.caseId,
            rawData,
            columnMapping,
            headerRowIndex
          );
        } catch (error) {
          console.error("[Data Extraction Error]", error);

          // Update analysis result with failed status
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

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "데이터 추출 중 오류가 발생했습니다",
          });
        }

        // Step 8: Update FileAnalysisResult to "completed" (100% progress)
        await ctx.db.fileAnalysisResult.update({
          where: { documentId },
          data: {
            status: "completed",
            analyzedAt: new Date(),
            ...(extractionResult.skipped > 0 && {
              errorMessage: `${extractionResult.skipped}건의 데이터를 건너뛰었습니다 (전체 ${rawData.length}건 중)`,
              errorDetails: {
                skippedRecords: extractionResult.errors,
                totalRows: rawData.length,
                successCount: extractionResult.success,
                skippedCount: extractionResult.skipped,
              },
            }),
          },
        });

        // Step 9: Return success message
        return {
          success: true,
          message: `${extractionResult.success}건의 거래 데이터를 저장했습니다${extractionResult.skipped > 0 ? ` (${extractionResult.skipped}건 건너뛰기)` : ""}`,
          extractedCount: extractionResult.success,
          skippedCount: extractionResult.skipped,
          errors: extractionResult.errors,
        };
      } catch (error) {
        // Handle TRPCError (already logged and formatted above)
        if (error instanceof TRPCError) {
          throw error;
        }

        // Handle unexpected errors
        console.error("[Unexpected Error]", error);

        await ctx.db.fileAnalysisResult.update({
          where: { documentId },
          data: {
            status: "failed",
            errorMessage: "예기치 않은 오류가 발생했습니다",
            errorDetails: {
              originalError:
                error instanceof Error ? error.stack : String(error),
            },
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "데이터 추출 중 오류가 발생했습니다",
        });
      }
    }),
});
