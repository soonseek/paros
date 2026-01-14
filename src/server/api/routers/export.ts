/**
 * Export Router (Story 7.1, Task 2; Story 7.2, Task 3)
 *
 * Excel 내보내기 tRPC 라우터
 *
 * @module server/api/routers/export
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { canAccessCase } from "~/lib/rbac";
import { excelExportService } from "~/server/services/excel-export-service";
import { auditLog } from "~/server/audit/audit-log"; // Story 7.2, Task 3.3
import { db } from "~/server/db"; // Story 7.3: auditLog.create()에 db 파라미터 전달

/**
 * Export 옵션 타입 (Story 7.2 확장)
 */
type ExportOption = "full" | "selected" | "filtered" | "transactions" | "findings" | "fundFlow";

/**
 * Optional Column 타입 (Story 7.2)
 */
type OptionalColumn = "메모" | "태그" | "AI 분류" | "거래 성격" | "신뢰도";

/**
 * Export Router
 */
export const exportRouter = createTRPCRouter({
  /**
   * 전체 분석 결과를 Excel로 내보내기 (Story 7.1, Task 2.1)
   *
   * MUTATION /api/trpc/export.exportFullAnalysisResult
   *
   * @param caseId - 사건 ID
   * @param option - 내보내기 옵션 (기본값: "full")
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   *
   * Story 7.1 AC2-AC6: 4개 시트 Excel 파일 생성
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   */
  exportFullAnalysisResult: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        option: z
          .enum(["full", "selected", "filtered", "transactions", "findings", "fundFlow"])
          .default("full"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, option } = input;
      const userId = ctx.userId;

      // RBAC 적용 (Epic 4 패턴 재사용)
      const hasAccess = await canAccessCase(userId, caseId);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 접근할 권한이 없습니다.",
        });
      }

      // "full" 옵션만 지원
      if (option !== "full") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${option}" 옵션은 현재 지원되지 않습니다.`,
        });
      }

      // Excel 생성 서비스 호출
      const response = await excelExportService.generateFullAnalysisExcel(
        caseId
      );

      return response;
    }),

  /**
   * 선택된 거래들을 Excel로 내보내기 (Story 7.2, Task 3.1)
   *
   * MUTATION /api/trpc/export.exportSelectedTransactions
   *
   * @param caseId - 사건 ID
   * @param transactionIds - 선택된 거래 ID 목록
   * @param selectedColumns - 포함할 열 목록 (선택사항)
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   *
   * Story 7.2 AC1: 선택된 거래들만 포함된 엑셀 파일 생성
   * Story 7.2 AC3: 포함할 열 선택 지원
   * Story 7.2 AI 리뷰 이슈 반영:
   *   - MEDIUM #1: 감사 로그 추가
   *   - MEDIUM #2: N+1 쿼리 최적화 (서비스에서 처리)
   *   - LOW #3: 에러 처리 개선
   *   - LOW #4: 파일 크기 검증 (서비스에서 처리)
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if transactionIds is empty
   */
  exportSelectedTransactions: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        transactionIds: z
          .array(z.string().min(1, "거래 ID는 필수 항목입니다"))
          .min(1, "최소 1개 이상의 거래를 선택해주세요"),
        selectedColumns: z
          .array(z.enum(["메모", "태그", "AI 분류", "거래 성격", "신뢰도"]))
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, transactionIds, selectedColumns } = input;
      const userId = ctx.userId;

      // RBAC 적용 (Epic 4 패턴 재사용)
      const hasAccess = await canAccessCase(userId, caseId);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 접근할 권한이 없습니다.",
        });
      }

      try {
        // Excel 생성 서비스 호출 (N+1 최적화, 파일 크기 검증 포함)
        const response =
          await excelExportService.generateSelectedTransactionsExcel(
            caseId,
            transactionIds,
            selectedColumns
          );

        // Story 7.2, Task 3.3: 감사 로그 추가 (Story 7.1 AI 리뷰 MEDIUM #1)
        await auditLog.create({
          db,
          action: "EXPORT_TRANSACTIONS",
          userId,
          caseId,
          entityType: "CASE",
          details: {
            exportType: "selected",
            transactionCount: transactionIds.length,
            selectedColumns,
          },
        });

        return response;
      } catch (error) {
        // Story 7.2, Task 3.1: LOW #3 - 에러 처리 개선
        console.error("Excel generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "엑셀 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        });
      }
    }),

  /**
   * 필터링된 거래들을 Excel로 내보내기 (Story 7.2, Task 3.2)
   *
   * MUTATION /api/trpc/export.exportFilteredTransactions
   *
   * @param caseId - 사건 ID
   * @param filters - 필터 조건
   * @param selectedColumns - 포함할 열 목록 (선택사항)
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   *
   * Story 7.2 AC2: 필터링된 거래들만 포함된 엑셀 파일 생성
   * Story 7.2 AC3: 포함할 열 선택 지원
   * Story 7.2 AI 리뷰 이슈 반영:
   *   - MEDIUM #1: 감사 로그 추가
   *   - MEDIUM #2: N+1 쿼리 최적화 (서비스에서 처리)
   *   - LOW #3: 에러 처리 개선
   *   - LOW #4: 파일 크기 검증 (서비스에서 처리)
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if filters are invalid
   */
  exportFilteredTransactions: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        filters: z.object({
          dateRange: z
            .object({
              from: z.string().optional(),
              to: z.string().optional(),
            })
            .optional(),
          amountRange: z
            .object({
              min: z.number().optional(),
              max: z.number().optional(),
            })
            .optional(),
          category: z.string().optional(),
          tags: z.array(z.string()).optional(),
        }),
        selectedColumns: z
          .array(z.enum(["메모", "태그", "AI 분류", "거래 성격", "신뢰도"]))
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, filters, selectedColumns } = input;
      const userId = ctx.userId;

      // RBAC 적용 (Epic 4 패턴 재사용)
      const hasAccess = await canAccessCase(userId, caseId);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 접근할 권한이 없습니다.",
        });
      }

      try {
        // Excel 생성 서비스 호출 (N+1 최적화, 파일 크기 검증 포함)
        const response =
          await excelExportService.generateFilteredTransactionsExcel(
            caseId,
            filters,
            selectedColumns
          );

        // Story 7.2, Task 3.3: 감사 로그 추가 (Story 7.1 AI 리뷰 MEDIUM #1)
        await auditLog.create({
          db,
          action: "EXPORT_TRANSACTIONS",
          userId,
          caseId,
          entityType: "CASE",
          details: {
            exportType: "filtered",
            filters,
            selectedColumns,
          },
        });

        return response;
      } catch (error) {
        // Story 7.2, Task 3.2: LOW #3 - 에러 처리 개선
        console.error("Excel generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "엑셀 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        });
      }
    }),

  /**
   * 발견사항 목록을 Excel로 내보내기 (Story 7.3, Task 2.1)
   *
   * MUTATION /api/trpc/export.exportFindings
   *
   * @param caseId - 사건 ID
   * @param filters - 필터 옵션 (선택사항)
   * @param sortBy - 정렬 순서 (기본값: "priority-severity-date")
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   *
   * Story 7.3 AC1: 발견사항 엑셀 생성
   * Story 7.3 AC2: 발견사항 데이터 포함 (모든 필드)
   * Story 7.3 AC3: severity별 색상 적용
   * Story 7.3 AC4: 다운로드 및 피드백
   * Story 7.3 AC5: 필터 및 정렬 옵션 지원
   * Story 7.3 AI 리뷰 이슈 반영:
   *   - MEDIUM #1: 감사 로그 추가
   *   - MEDIUM #2: N+1 쿼리 최적화 (서비스에서 처리)
   *   - HIGH #1: 에러 처리 개선
   *   - MEDIUM #2: 파일 크기 검증 (서비스에서 처리)
   *   - LOW #3: auditLog import 확인
   *
   * @throws NOT_FOUND if case not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if no findings found
   */
  exportFindings: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        filters: z
          .object({
            isResolved: z.boolean().optional(),
            severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
            priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
          })
          .optional(),
        sortBy: z
          .enum(["priority-severity-date", "severity-date", "date"])
          .default("priority-severity-date"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, filters, sortBy } = input;
      const userId = ctx.userId;

      // RBAC 적용 (Epic 4 패턴 재사용)
      const hasAccess = await canAccessCase(userId, caseId);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 접근할 권한이 없습니다.",
        });
      }

      try {
        // Excel 생성 서비스 호출 (N+1 최적화, 파일 크기 검증 포함)
        const response = await excelExportService.generateFindingsExcel(
          caseId,
          filters,
          sortBy
        );

        // Story 7.3, Task 2.2: 감사 로그 추가 (Story 7.1, 7.2 AI 리뷰 MEDIUM #1 패턴 재사용)
        await auditLog.create({
          db,
          action: "EXPORT_FINDINGS",
          userId,
          caseId,
          entityType: "CASE",
          details: {
            exportType: "findings",
            filters,
            sortBy,
          },
        });

        return response;
      } catch (error) {
        // Story 7.3, Task 7.1: HIGH #1 - 에러 처리 개선 (Story 7.2 패턴 재사용)
        console.error("Excel generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "엑셀 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        });
      }
    }),
});
