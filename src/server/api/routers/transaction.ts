/**
 * Transaction Router
 *
 * Story 4.1: AI 기반 거래 자동 분류
 * Story 4.2 Code Review - MEDIUM #7: Pagination support
 * Story 4.5 CRITICAL #2: Audit logging for regulatory compliance
 *
 * AI 분류 관련 tRPC 프로시저:
 * - classifyTransactions: 특정 문서의 거래들을 AI 분류
 * - getClassificationStatus: 분류 진행 상태 조회
 * - getPaginatedTransactions: 페이지네이션된 거래 목록 조회 (MEDIUM #7)
 *
 * RBAC:
 * - Case lawyer 또는 Admin만 분류 가능
 * - Viewer는 조회만 가능
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { classifyTransactionsInBatches } from "~/server/ai/classification-service";
import {
  detectImportantTransactions,
  serializeMatchedKeywords,
} from "~/server/ai/important-transaction-detector";
import {
  generateFindingsForTransactions,
} from "~/server/findings/finding-generator";
import {
  logClassificationChange,
  createUpdateChanges,
  createRestoreChanges,
} from "~/server/audit/classification-audit";
import { assertTransactionAccess } from "~/server/lib/rbac";

/**
 * Transaction Router
 */
export const transactionRouter = createTRPCRouter({
  /**
   * 특정 문서의 거래들을 AI로 분류합니다.
   *
   * POST /api/trpc/transaction.classifyTransactions
   *
   * @param documentId - 분류할 문서 ID
   * @returns 분류 작업 ID
   *
   * @throws NOT_FOUND if document not found
   * @throws FORBIDDEN if user lacks permission
   * @throws INTERNAL_SERVER_ERROR if AI classification fails
   */
  classifyTransactions: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // 1. 문서 조회
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: {
          case: true,
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 문서를 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 분류 가능
      // Document의 owner(lawyerId) 또는 Admin인지 확인
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // Case lawyer가 아니고 Admin도 아닌 경우 거부
      if (document.case.lawyerId !== userId && user.role !== "ADMIN" && user.role !== "SUPER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "거래 분류를 수행할 권한이 없습니다.",
        });
      }

      // 3. 거래 데이터 조회
      const transactions = await ctx.db.transaction.findMany({
        where: { documentId },
        select: {
          id: true,
          memo: true,
          depositAmount: true,
          withdrawalAmount: true,
        },
      });

      if (transactions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "분류할 거래가 없습니다.",
        });
      }

      // 4. FileAnalysisResult 조회
      const fileAnalysisResult = await ctx.db.fileAnalysisResult.findFirst({
        where: { documentId },
      });

      if (!fileAnalysisResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "파일 분석 결과를 찾을 수 없습니다.",
        });
      }

      // 5. ClassificationJob 생성 (Story 4.1, CRITICAL-2 FIX: DB 기반 상태 관리)
      const classificationJob = await ctx.db.classificationJob.create({
        data: {
          fileAnalysisResultId: fileAnalysisResult.id,
          status: "processing",
          progress: 0,
          total: transactions.length,
        },
      });

      // 6. FileAnalysisResult 상태 업데이트 (processing)
      await ctx.db.fileAnalysisResult.update({
        where: { id: fileAnalysisResult.id },
        data: { status: "processing" },
      });

      // 7. 비동기 분류 실행 (일괄 처리 최적화)
      void (async () => {
        try {
          const results = await classifyTransactionsInBatches(
            transactions.map((tx) => ({
              id: tx.id,
              memo: tx.memo,
              depositAmount: tx.depositAmount ? Number(tx.depositAmount) : null,
              withdrawalAmount: tx.withdrawalAmount
                ? Number(tx.withdrawalAmount)
                : null,
            })),
            ctx.db, // Story 4.8: Prisma Client 전달 (규칙 조회용)
            {
              batchSize: 100, // Story 4.1, Task 4: 100건씩 배치로 처리
              maxConcurrentBatches: 5, // 최대 5개 배치 동시 실행
            },
            async (current, _total) => {
              // 진행률 업데이트 (Story 4.1, CRITICAL-2 FIX: DB 업데이트)
              await ctx.db.classificationJob.update({
                where: { id: classificationJob.id },
                data: { progress: current },
              });
            }
          );

          // 8. Story 4.3: 중요 거래 감지
          const importantDetectionResults = detectImportantTransactions(
            transactions.map((tx) => ({
              id: tx.id,
              memo: tx.memo,
              depositAmount: tx.depositAmount ? Number(tx.depositAmount) : null,
              withdrawalAmount: tx.withdrawalAmount
                ? Number(tx.withdrawalAmount)
                : null,
            }))
          );

          // 9. Story 4.3: Finding 자동 생성
          await generateFindingsForTransactions(
            ctx.db,
            document.caseId,
            transactions.map((tx) => ({
              id: tx.id,
              memo: tx.memo,
            })),
            importantDetectionResults
          );

          // 10. 분류 결과 저장 (Story 4.3: 중요 거래 정보 포함)
          for (const [txId, result] of results.entries()) {
            const importantResult = importantDetectionResults.get(txId);

            await ctx.db.transaction.update({
              where: { id: txId },
              data: {
                category: result.category,
                subcategory: result.subcategory,
                confidenceScore: result.confidenceScore,
                aiClassificationStatus: "completed",
                // Story 4.3: 중요 거래 정보 저장
                ...(importantResult && {
                  importantTransaction: importantResult.isImportant,
                  importantTransactionType: importantResult.type,
                  importantTransactionKeywords: serializeMatchedKeywords(
                    importantResult.matchedKeywords
                  ),
                }),
              },
            });
          }

          // 11. FileAnalysisResult 상태 업데이트 (completed)
          await ctx.db.fileAnalysisResult.update({
            where: { id: fileAnalysisResult.id },
            data: { status: "completed" },
          });

          // 12. ClassificationJob 상태 업데이트 (completed)
          await ctx.db.classificationJob.update({
            where: { id: classificationJob.id },
            data: {
              status: "completed",
              progress: transactions.length,
            },
          });
        } catch (error) {
          console.error("[AI Classification] 분류 실패:", error);

          // FileAnalysisResult 상태 업데이트 (failed)
          await ctx.db.fileAnalysisResult.update({
            where: { id: fileAnalysisResult.id },
            data: {
              status: "failed",
              errorMessage: "AI 분류에 실패했습니다. 다시 시도해주세요.",
            },
          });

          // ClassificationJob 상태 업데이트 (failed)
          await ctx.db.classificationJob.update({
            where: { id: classificationJob.id },
            data: {
              status: "failed",
              error: String(error),
            },
          });
        }
      })();

      return {
        jobId: classificationJob.id,
        total: transactions.length,
        message: `${transactions.length}건의 거래 분류를 시작했습니다.`,
      };
    }),

  /**
   * 분류 진행 상태를 조회합니다.
   *
   * QUERY /api/trpc/transaction.getClassificationStatus
   *
   * @param documentId - 문서 ID
   * @returns 분류 진행 상태
   */
  getClassificationStatus: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { documentId } = input;

      // FileAnalysisResult 조회
      const fileAnalysisResult = await ctx.db.fileAnalysisResult.findFirst({
        where: { documentId },
      });

      if (!fileAnalysisResult) {
        return {
          status: "pending" as const,
          progress: 0,
          total: 0,
        };
      }

      // Story 4.1, CRITICAL-2 FIX: ClassificationJob에서 상태 조회
      const classificationJob = await ctx.db.classificationJob.findUnique({
        where: { fileAnalysisResultId: fileAnalysisResult.id },
      });

      if (!classificationJob) {
        // ClassificationJob이 아직 생성되지 않은 경우
        return {
          status: fileAnalysisResult.status as
            | "pending"
            | "processing"
            | "completed"
            | "failed",
          progress: 0,
          total: 0,
        };
      }

      return {
        status: classificationJob.status as
          | "processing"
          | "completed"
          | "failed",
        progress: classificationJob.progress,
        total: classificationJob.total,
        error: classificationJob.error,
      };
    }),

  /**
   * 페이지네이션된 거래 목록을 조회합니다.
   *
   * Story 4.2 Code Review - MEDIUM #7: Pagination support for large datasets
   *
   * QUERY /api/trpc/transaction.getPaginatedTransactions
   *
   * @param documentId - 문서 ID
   * @param page - 페이지 번호 (1부터 시작)
   * @param pageSize - 페이지당 건수 (기본값: 50, 최대: 100)
   * @returns 페이지네이션된 거래 목록
   *
   * @throws NOT_FOUND if document not found
   * @throws FORBIDDEN if user lacks permission
   */
  getPaginatedTransactions: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
        importantOnly: z.boolean().optional(), // Story 4.3: 중요 거래만 보기
        natureFilter: z.enum(["CREDITOR", "COLLATERAL", "PRIORITY_REPAYMENT", "GENERAL"]).optional(), // Story 4.4: 거래 성격 필터
      })
    )
    .query(async ({ ctx, input }) => {
      const { documentId, page, pageSize, importantOnly, natureFilter } = input;
      const userId = ctx.userId;

      // 1. 문서 조회
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        include: { case: true },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 문서를 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 조회 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      if (document.case.lawyerId !== userId && user.role !== "ADMIN" && user.role !== "SUPER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "거래 조회 권한이 없습니다.",
        });
      }

      // 3. 필터 조건 구성
      const whereCondition: Record<string, unknown> = { documentId };

      // Story 4.3: 중요 거래 필터
      if (importantOnly) {
        whereCondition.importantTransaction = true;
      }

      // Story 4.4: 거래 성격 필터
      if (natureFilter) {
        whereCondition.transactionNature = natureFilter;
      }

      // 3. 전체 거래 수 조회 및 거래 목록 가져오기
      const [transactions, totalCount] = await Promise.all([
        ctx.db.transaction.findMany({
          where: whereCondition,
          orderBy: [{ transactionDate: "desc" }, { rowNumber: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            transactionDate: true,
            depositAmount: true,
            withdrawalAmount: true,
            balance: true,
            memo: true,
            category: true,
            subcategory: true,
            confidenceScore: true,
            importantTransaction: true, // Story 4.3
            importantTransactionType: true, // Story 4.3
            // Story 4.4: 거래 성격 관련 필드
            transactionNature: true,
            creditorName: true,
            collateralType: true,
            // Story 4.5: 수동 분류 수정 관련 필드
            isManuallyClassified: true,
            originalCategory: true,
            originalSubcategory: true,
            manualClassificationDate: true,
            manualClassifiedBy: true,
            rowNumber: true, // 같은 날짜 내 정렬 순서 유지용
            // Story 4.6: 태그 관계
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        ctx.db.transaction.count({ where: whereCondition }),
      ]);

      return {
        transactions,
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
   * 거래 분류를 수동으로 수정합니다.
   *
   * Story 4.5: 수동 분류 수정
   *
   * MUTATION /api/trpc/transaction.updateTransactionClassification
   *
   * @param transactionId - 수정할 거래 ID
   * @param category - 새 카테고리
   * @param subcategory - 새 서브카테고리
   * @returns 수정된 거래 정보
   *
   * @throws NOT_FOUND if transaction not found
   * @throws FORBIDDEN if user lacks permission
   * @throws CONFLICT if version mismatch (HIGH #2: Optimistic locking)
   */
  updateTransactionClassification: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().min(1, "거래 ID는 필수 항목입니다"),
        category: z.string().min(1, "카테고리는 필수 항목입니다"),
        subcategory: z.string().optional(),
        version: z.number().int().positive().optional(), // HIGH #2: Optimistic locking
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, category, subcategory, version } = input;
      const userId = ctx.userId;

      // 1. 거래 조회 (Document 포함)
      const transaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "거래를 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: HIGH #1 - 중앙화된 권한 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: transaction.document.case.lawyerId,
      });

      // 3. HIGH #2: 낙관적 잠금 버전 체크
      if (version !== undefined && transaction.version !== version) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "거래 정보가 다른 사용자에 의해 수정되었습니다. 다시 시도해주세요.",
        });
      }

      // 4. 원본 값 저장 (처음 수정하는 경우만)
      const originalCategory = transaction.originalCategory ?? transaction.category;
      const originalSubcategory = transaction.originalSubcategory ?? transaction.subcategory;
      const originalConfidence = transaction.originalConfidenceScore ?? transaction.confidenceScore;

      // Story 4.8: 피드백 수집 플래그 (처음 수정하는 경우만 피드백 생성)
      const isFirstManualEdit = transaction.originalCategory === null;

      // 5. 거래 분류 수정
      const updated = await ctx.db.transaction.update({
        where: { id: transactionId },
        data: {
          // 원본 값 저장 (처음 수정하는 경우)
          ...(transaction.originalCategory === null && {
            originalCategory,
          }),
          ...(transaction.originalSubcategory === null && {
            originalSubcategory,
          }),
          ...(transaction.originalConfidenceScore === null && {
            originalConfidenceScore: transaction.confidenceScore,
          }),
          // 새 값 업데이트
          category,
          subcategory,
          confidenceScore: 1.0, // 사용자 수동 수정 = 100% 신뢰도
          isManuallyClassified: true,
          manualClassificationDate: new Date(),
          manualClassifiedBy: userId,
          version: { increment: 1 }, // HIGH #2: 버전 증가
        },
        select: {
          id: true,
          category: true,
          subcategory: true,
          confidenceScore: true,
          isManuallyClassified: true,
          originalCategory: true,
          originalSubcategory: true,
          manualClassificationDate: true,
        },
      });

      // Story 4.8: Task 2 - 피드백 자동 수집 (처음 수정하는 경우만)
      // Code Review Fix #MEDIUM-2: 서브카테고리 변경도 감지하도록 조건 수정
      if (isFirstManualEdit && (originalCategory || originalSubcategory)) {
        await ctx.db.classificationFeedback.create({
          data: {
            transactionId,
            // 원본 AI 분류
            originalCategory,
            originalSubcategory,
            originalConfidence,
            // 사용자 수정
            userCategory: category,
            userSubcategory: subcategory,
            feedbackDate: new Date(),
            userId,
          },
        });
      }

      // CRITICAL #2: 감사 로그 기록 (상사법 7년 보관 의무)
      await logClassificationChange({
        db: ctx.db,
        userId,
        transactionId,
        action: "UPDATE",
        changes: createUpdateChanges(transaction, category, subcategory),
      });

      return updated;
    }),

  /**
   * 원본 AI 분류로 복원합니다.
   *
   * Story 4.5: 수동 분류 수정
   *
   * MUTATION /api/trpc/transaction.restoreOriginalClassification
   *
   * @param transactionId - 복원할 거래 ID
   * @returns 복원된 거래 정보
   *
   * @throws NOT_FOUND if transaction not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if no original classification exists
   * @throws CONFLICT if version mismatch (HIGH #2: Optimistic locking)
   */
  restoreOriginalClassification: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().min(1, "거래 ID는 필수 항목입니다"),
        version: z.number().int().positive().optional(), // HIGH #2: Optimistic locking
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, version } = input;
      const userId = ctx.userId;

      // 1. 거래 조회 (Document 포함)
      const transaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "거래를 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: HIGH #1 - 중앙화된 권한 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: transaction.document.case.lawyerId,
      });

      // 3. 원본 분류 존재 확인
      if (!transaction.originalCategory) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "복원할 원본 분류가 없습니다.",
        });
      }

      // 4. HIGH #2: 낙관적 잠금 버전 체크
      if (version !== undefined && transaction.version !== version) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "거래 정보가 다른 사용자에 의해 수정되었습니다. 다시 시도해주세요.",
        });
      }

      // 5. 원본 분류로 복원
      const restored = await ctx.db.transaction.update({
        where: { id: transactionId },
        data: {
          category: transaction.originalCategory,
          subcategory: transaction.originalSubcategory,
          // 신뢰도 복원 (원본 AI 신뢰도, 없으면 0.0)
          confidenceScore: transaction.originalConfidenceScore ?? 0.0,
          isManuallyClassified: false,
          manualClassificationDate: null,
          manualClassifiedBy: null,
          version: { increment: 1 }, // HIGH #2: 버전 증가
        },
        select: {
          id: true,
          category: true,
          subcategory: true,
          confidenceScore: true,
          isManuallyClassified: true,
          originalCategory: true,
          originalSubcategory: true,
        },
      });

      // CRITICAL #2: 감사 로그 기록 (상사법 7년 보관 의무)
      await logClassificationChange({
        db: ctx.db,
        userId,
        transactionId,
        action: "RESTORE",
        changes: createRestoreChanges(transaction),
      });

      return restored;
    }),

  /**
   * 여러 거래를 일괄적으로 수정합니다.
   *
   * Story 4.7: 일괄 분류 수정 (Batch Classification Edit)
   *
   * MUTATION /api/trpc/transaction.batchUpdateTransactions
   *
   * @param transactionIds - 수정할 거래 ID 목록
   * @param updates - 적용할 업데이트 (categoryId, importantTransaction)
   * @returns 수정된 거래 수
   *
   * @throws NOT_FOUND if transaction not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if no update fields provided
   */
  batchUpdateTransactions: protectedProcedure
    .input(
      z.object({
        transactionIds: z
          .array(z.string().uuid("유효한 거래 ID를 입력해 주세요"))
          .min(1, "최소 1개 이상의 거래를 선택해야 합니다"),
        updates: z.object({
          categoryId: z.string().uuid("유효한 카테고리 ID를 입력해 주세요").optional(),
          importantTransaction: z.boolean().optional(),
          // Tag 추가는 Story 4.6의 addTagsToMultipleTransactions 사용
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionIds, updates } = input;
      const { categoryId, importantTransaction } = updates;
      const userId = ctx.userId;

      // 1. 업데이트할 필드가 최소 1개 이상 있는지 확인
      if (categoryId === undefined && importantTransaction === undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "수정할 필드를 선택해주세요.",
        });
      }

      // 2. 사용자 조회
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // 3. 모든 거래 조회 (Document와 Case 포함)
      const transactions = await ctx.db.transaction.findMany({
        where: {
          id: { in: transactionIds },
        },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (transactions.length !== transactionIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "일부 거래를 찾을 수 없습니다.",
        });
      }

      // 4. RBAC: 모든 거래에 대해 권한 검증
      for (const transaction of transactions) {
        assertTransactionAccess({
          userId,
          userRole: user.role,
          caseLawyerId: transaction.document.case.lawyerId,
        });
      }

      // 5. 원본 상태 저장 (감사 로그용)
      const originalStates = transactions.map((tx) => ({
        id: tx.id,
        category: tx.category,
        importantTransaction: tx.importantTransaction,
        version: tx.version,
      }));

      // MEDIUM #1 & #2: 트랜잭션으로 래핑하여 원자성 보장
      // HIGH #1: updateMany로 성능 최적화 (N+1 쿼리 제거)
      const updatedResult = await ctx.db.$transaction(async (tx) => {
        // MEDIUM #1: 낙관적 잠금 - 모든 거래의 버전 일치 확인
        // 첫 번째 거래의 버전을 기준으로 모든 거래가 같은 버전인지 확인
        const firstVersion = transactions[0]?.version;
        const hasVersionMismatch = transactions.some(
          (tx) => tx.version !== firstVersion
        );

        // 버전 불일치가 있으면 경고만 출력하고 계속 진행
        // (개별 거래마다 버전 체크는 updateMany로는 불가능하므로)
        if (hasVersionMismatch) {
          console.warn(
            `[batchUpdateTransactions] Version mismatch detected in transactions ${transactionIds.join(",")}`
          );
        }

        // HIGH #1: updateMany로 일괄 업데이트 (성능 최적화)
        const updateData: Record<string, unknown> = {
          // version increment (낙관적 잠금)
          version: { increment: 1 },
        };

        // 카테고리 변경 (categoryId 제공 시)
        if (categoryId !== undefined) {
          updateData.categoryId = categoryId;
          updateData.isManuallyClassified = true;
          updateData.manualClassificationDate = new Date();
          updateData.manualClassifiedBy = userId;
        }

        // 중요 거래 표시 (importantTransaction 제공 시)
        if (importantTransaction !== undefined) {
          updateData.importantTransaction = importantTransaction;
          updateData.isManuallyClassified = true;
          updateData.manualClassificationDate = new Date();
          updateData.manualClassifiedBy = userId;
        }

        const updateResult = await tx.transaction.updateMany({
          where: {
            id: { in: transactionIds },
          },
          data: updateData,
        });

        return updateResult.count;
      });

      // 7. 감사 로그 기록 (배치 작업)
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "TRANSACTION_BATCH_UPDATE",
          entityType: "TRANSACTION",
          entityId: transactionIds.join(","),
          changes: {
            before: originalStates,
            after: {
              categoryId,
              importantTransaction,
              updatedCount: updatedResult,
            },
          },
        },
      });

      return {
        updatedCount: updatedResult,
        message: `${updatedResult}건의 거래가 수정되었습니다.`,
      };
    }),

  /**
   * 분류 오류를 보고합니다.
   *
   * Story 4.8: Task 7 - 분류 오류 보고 기능
   *
   * MUTATION /api/trpc/transaction.reportClassificationError
   *
   * @param transactionId - 오류가 발생한 거래 ID
   * @param errorType - 오류 유형 (WRONG_CATEGORY, MISSED, LOW_CONFIDENCE)
   * @param description - 오류 설명
   * @param severity - 심각도 (LOW, MEDIUM, HIGH)
   * @returns 생성된 오류 보고
   *
   * @throws NOT_FOUND if transaction not found
   * @throws FORBIDDEN if user lacks permission
   */
  reportClassificationError: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().min(1, "거래 ID는 필수 항목입니다"),
        errorType: z.enum(["WRONG_CATEGORY", "MISSED", "LOW_CONFIDENCE"]),
        description: z.string().min(1, "오류 설명은 필수 항목입니다").max(500, "오류 설명은 최대 500자까지 가능합니다"),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, errorType, description, severity } = input;
      const userId = ctx.userId;

      // 1. 거래 조회 (Document 포함)
      const transaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "거래를 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 보고 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: transaction.document.case.lawyerId,
      });

      // 3. 중복 보고 체크 (이미 같은 유형으로 보고된 경우)
      const existingError = await ctx.db.classificationError.findFirst({
        where: {
          transactionId,
          errorType,
          resolved: false,
        },
      });

      if (existingError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 동일한 유형의 오류가 보고되었습니다.",
        });
      }

      // 4. 오류 보고 생성
      const errorReport = await ctx.db.classificationError.create({
        data: {
          transactionId,
          errorType,
          description,
          severity,
          reportedAt: new Date(),
          userId,
        },
      });

      // 5. 감사 로그 기록
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "REPORT_CLASSIFICATION_ERROR",
          entityType: "CLASSIFICATION_ERROR",
          entityId: errorReport.id,
          changes: {
            transactionId,
            errorType,
            severity,
          },
        },
      });

      return errorReport;
    }),

  /**
   * 분류 오류 목록을 조회합니다.
   *
   * Story 4.8: Task 7 - 분류 오류 관리
   *
   * QUERY /api/trpc/transaction.getClassificationErrors
   *
   * @param resolved - 해결 여부 필터 (선택적)
   * @param severity - 심각도 필터 (선택적)
   * @param page - 페이지 번호 (기본값: 1)
   * @param pageSize - 페이지당 건수 (기본값: 20)
   * @returns 오류 목록
   *
   * @throws FORBIDDEN if user is not ADMIN
   */
  getClassificationErrors: protectedProcedure
    .input(
      z.object({
        resolved: z.boolean().optional(),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const { resolved, severity, page, pageSize } = input;

      // 1. RBAC: ADMIN만 접근 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || user.role !== "ADMIN" && user.role !== "SUPER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "분류 오류 조회는 관리자만 가능합니다.",
        });
      }

      // 2. 필터 조건 구성
      const whereCondition: Record<string, unknown> = {};

      if (resolved !== undefined) {
        whereCondition.resolved = resolved;
      }

      if (severity !== undefined) {
        whereCondition.severity = severity;
      }

      // 3. 오류 목록 조회
      const [errors, totalCount] = await Promise.all([
        ctx.db.classificationError.findMany({
          where: whereCondition,
          orderBy: [{ reportedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            transaction: {
              select: {
                id: true,
                memo: true,
                category: true,
                subcategory: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        ctx.db.classificationError.count({ where: whereCondition }),
      ]);

      return {
        errors,
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
   * 분류 오류를 해결 처리합니다.
   *
   * Story 4.8: Task 7 - 분류 오류 관리
   *
   * MUTATION /api/trpc/transaction.resolveClassificationError
   *
   * @param errorId - 오류 ID
   * @returns 업데이트된 오류
   *
   * @throws NOT_FOUND if error not found
   * @throws FORBIDDEN if user is not ADMIN
   */
  resolveClassificationError: protectedProcedure
    .input(
      z.object({
        errorId: z.string().min(1, "오류 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { errorId } = input;
      const userId = ctx.userId;

      // 1. RBAC: ADMIN만 접근 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || user.role !== "ADMIN" && user.role !== "SUPER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "오류 해결은 관리자만 가능합니다.",
        });
      }

      // 2. 오류 조회
      const error = await ctx.db.classificationError.findUnique({
        where: { id: errorId },
      });

      if (!error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "오류를 찾을 수 없습니다.",
        });
      }

      // 3. 오류 해결 처리
      const resolved = await ctx.db.classificationError.update({
        where: { id: errorId },
        data: {
          resolved: true,
        },
      });

      // 4. 감사 로그 기록
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "RESOLVE_CLASSIFICATION_ERROR",
          entityType: "CLASSIFICATION_ERROR",
          entityId: errorId,
          changes: {
            before: { resolved: error.resolved },
            after: { resolved: true },
          },
        },
      });

      return resolved;
    }),

  /**
   * 다차원 검색으로 거래를 검색합니다.
   *
   * Story 8.1: 다차원 검색 구현 (Task 9: tRPC 라우터 구현)
   *
   * QUERY /api/trpc/transaction.search
   *
   * @param caseId - 사건 ID
   * @param keyword - 키워드 (선택적)
   * @param startDate - 시작일 (선택적)
   * @param endDate - 종료일 (선택적)
   * @param minAmount - 최소금액 (선택적)
   * @param maxAmount - 최대금액 (선택적)
   * @param tags - 태그 목록 (선택적)
   * @param page - 페이지 번호 (기본값: 1)
   * @param pageSize - 페이지당 건수 (기본값: 50, 최대: 100)
   * @returns 검색된 거래 목록과 페이지네이션 정보
   *
   * @throws FORBIDDEN if user lacks permission
   */
  search: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        documentId: z.string().optional(), // Filter by specific document
        keyword: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        minAmount: z.number().nonnegative().optional(),
        maxAmount: z.number().nonnegative().optional(),
        tags: z.array(z.string()).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).default(10000),
      })
    )
    .query(async ({ ctx, input }) => {
      const {
        caseId,
        documentId,
        keyword,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        tags,
        page,
        pageSize,
      } = input;
      const userId = ctx.userId;

      // 1. RBAC: Case lawyer 또는 Admin만 조회 가능 (Task 9.2)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // 사건 조회
      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      // 권한 검증 (Epic 4 패턴 재사용)
      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      // 2. Prisma where 절 동적 구성 (Task 9.3)
      const where: Record<string, unknown> = { caseId };

      // 필터 by document (파일별 거래내역)
      if (documentId) {
        where.documentId = documentId;
      }

      // 키워드 검색 (AC1: case-insensitive)
      if (keyword) {
        where.memo = {
          contains: keyword,
          mode: "insensitive",
        };
      }

      // 날짜 범위 검색 (AC2)
      if (startDate || endDate) {
        where.transactionDate = {};
        if (startDate) {
          (where.transactionDate as Record<string, Date>).gte = startDate;
        }
        if (endDate) {
          (where.transactionDate as Record<string, Date>).lte = endDate;
        }
      }

      // 금액 범위 검색 (AC3: 입금액 OR 출금액)
      if (minAmount !== undefined || maxAmount !== undefined) {
        where.OR = [
          { depositAmount: {} },
          { withdrawalAmount: {} },
        ];

        if (minAmount !== undefined) {
          const depositAmountMin = { gte: minAmount };
          const withdrawalAmountMin = { gte: minAmount };
          const orArray = where.OR as Array<Record<string, unknown>>;
          if (orArray[0]) orArray[0].depositAmount = depositAmountMin;
          if (orArray[1]) orArray[1].withdrawalAmount = withdrawalAmountMin;
        }

        if (maxAmount !== undefined) {
          const depositAmountMax = { lte: maxAmount };
          const withdrawalAmountMax = { lte: maxAmount };
          const orArray = where.OR as Array<Record<string, unknown>>;
          if (orArray[0]) orArray[0].depositAmount = depositAmountMax;
          if (orArray[1]) orArray[1].withdrawalAmount = withdrawalAmountMax;
        }
      }

      // 태그 검색 (AC4: OR 조건)
      if (tags && tags.length > 0) {
        where.tags = {
          some: {
            tag: {
              name: {
                in: tags,
              },
            },
          },
        };
      }

      // 3. N+1 최적화 (Epic 7 패턴 재사용: Task 9.2)
      // 태그 필터 시에만 태그 포함
      const includeTags = tags && tags.length > 0;

      const [transactions, totalCount] = await Promise.all([
        ctx.db.transaction.findMany({
          where,
          orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }], // 거래일자 오름차순 + 원본 순서 (프론트엔드에서 정렬 처리)
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            documentId: true, // 문서명 표시용
            transactionDate: true,
            depositAmount: true,
            withdrawalAmount: true,
            balance: true,
            memo: true,
            category: true,
            subcategory: true,
            confidenceScore: true,
            importantTransaction: true,
            importantTransactionType: true,
            transactionNature: true,
            creditorName: true,
            collateralType: true,
            isManuallyClassified: true,
            originalCategory: true,
            originalSubcategory: true,
            manualClassificationDate: true,
            manualClassifiedBy: true,
            version: true,
            rowNumber: true, // 같은 날짜 내 정렬 순서 유지용
            // 태그는 필터 시에만 포함 (N+1 방지)
            ...(includeTags && {
              tags: {
                select: {
                  tag: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            }),
          },
        }),
        ctx.db.transaction.count({ where }),
      ]);

      // ===== 같은 날짜 그룹 내 잔액 기반 순서 보정 (기존 데이터 호환) =====
      // rowNumber가 올바르지 않은 기존 데이터를 위해 잔액 연속성을 검증하고 필요시 그룹 내 순서를 뒤집는다
      const reorderedTransactions = (() => {
        if (transactions.length <= 1) return transactions;

        // 날짜별 그룹핑 (날짜 부분만 사용)
        const dateGroups = new Map<string, typeof transactions>();
        for (const tx of transactions) {
          const dateKey = new Date(tx.transactionDate).toISOString().slice(0, 10);
          if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, []);
          dateGroups.get(dateKey)!.push(tx);
        }

        // 날짜 순서대로 처리 (ASC)
        const sortedDates = [...dateGroups.keys()].sort();
        const result: typeof transactions = [];
        let prevGroupLastBalance: number | null = null;

        for (const dateKey of sortedDates) {
          const group = dateGroups.get(dateKey)!;
          
          if (group.length <= 1) {
            if (group[0]?.balance != null) prevGroupLastBalance = Number(group[0].balance);
            result.push(...group);
            continue;
          }

          // 정순/역순 잔액 연속성 점수 계산
          const calcScore = (txs: typeof group, prevBal: number | null) => {
            let score = 0;
            let prev = prevBal;
            for (const tx of txs) {
              const dep = Number(tx.depositAmount ?? 0);
              const wit = Number(tx.withdrawalAmount ?? 0);
              const bal = tx.balance != null ? Number(tx.balance) : null;
              if (prev != null && bal != null) {
                const expected = prev + dep - wit;
                if (Math.abs(expected - bal) < 1) score++;
              }
              if (bal != null) prev = bal;
            }
            return score;
          };

          const forwardScore = calcScore(group, prevGroupLastBalance);
          const reversedGroup = [...group].reverse();
          const reverseScore = calcScore(reversedGroup, prevGroupLastBalance);

          if (reverseScore > forwardScore) {
            // 역순이 잔액 연속성이 더 높음 → 순서 뒤집기 + rowNumber 재할당
            console.log(`[transaction.search] Date ${dateKey}: 역순 보정 (정순: ${forwardScore}, 역순: ${reverseScore}, ${group.length}건)`);
            const baseRow = group[0]?.rowNumber ?? 0;
            for (let i = 0; i < reversedGroup.length; i++) {
              (reversedGroup[i] as { rowNumber: number | null }).rowNumber = baseRow + i;
            }
            result.push(...reversedGroup);
            const lastTx = reversedGroup[reversedGroup.length - 1];
            if (lastTx?.balance != null) prevGroupLastBalance = Number(lastTx.balance);
          } else {
            result.push(...group);
            const lastTx = group[group.length - 1];
            if (lastTx?.balance != null) prevGroupLastBalance = Number(lastTx.balance);
          }
        }

        // rowNumber 전체 재할당 (1부터)
        for (let i = 0; i < result.length; i++) {
          (result[i] as { rowNumber: number | null }).rowNumber = i + 1;
        }
        return result;
      })();

      return {
        transactions: reorderedTransactions,
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
   * Delete all transactions for a specific document
   *
   * Used when user wants to remove all transactions from a specific uploaded file
   *
   * @param documentId - Document ID to delete transactions for
   * @returns Number of deleted transactions
   *
   * @throws FORBIDDEN if user lacks permission
   */
  deleteByDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId } = input;
      const userId = ctx.userId;

      // 1. Check if document exists and get case info
      const document = await ctx.db.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          case: {
            select: {
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

      // 2. RBAC: Check permissions
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN" && user?.role !== "SUPER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서의 거래내역을 삭제할 권한이 없습니다",
        });
      }

      // 3. Delete all transactions for this document
      const deletedTransactionCount = await ctx.db.transaction.deleteMany({
        where: { documentId },
      });

      // 4. Delete FileAnalysisResult if exists
      await ctx.db.fileAnalysisResult.deleteMany({
        where: { documentId },
      });

      // 5. Get document info for deletion
      const docToDelete = await ctx.db.document.findUnique({
        where: { id: documentId },
        select: { id: true, originalFileName: true, s3Key: true },
      });

      if (docToDelete) {
        // 6. Delete from S3
        try {
          const { deleteFileFromS3 } = await import("~/lib/s3");
          await deleteFileFromS3(docToDelete.s3Key);
        } catch (error) {
          console.error("[S3 Delete] Failed to delete file:", error);
          // Continue with DB deletion even if S3 deletion fails
        }

        // 7. Delete document from database
        await ctx.db.document.delete({
          where: { id: documentId },
        });
      }

      return {
        deletedCount: deletedTransactionCount.count,
        message: deletedTransactionCount.count > 0 
          ? `${deletedTransactionCount.count}건의 거래내역과 파일이 삭제되었습니다`
          : `파일이 삭제되었습니다`,
      };
    }),

  /**
   * 금액 기준 거래 필터링 (서버 사이드)
   * 
   * 대용량 데이터 처리를 위해 DB에서 직접 필터링
   * 
   * @param caseId - 사건 ID
   * @param minAmount - 최소 금액
   * @param documentId - 특정 문서로 제한 (선택)
   * @returns 필터링된 거래 목록
   */
  filterByAmount: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        minAmount: z.number().min(0, "금액은 0 이상이어야 합니다"),
        documentId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, minAmount, documentId } = input;
      const userId = ctx.userId;

      // 1. RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      // 2. DB에서 직접 필터링 (금액 >= minAmount)
      // 주의: 출금 금액이 음수로 저장되어 있을 수 있으므로 절대값으로도 비교해야 함
      // 디버깅 로그
      console.log(`[filterByAmount] ========== 시작 ==========`);
      console.log(`[filterByAmount] caseId: ${caseId}`);
      console.log(`[filterByAmount] minAmount: ${minAmount}`);
      console.log(`[filterByAmount] documentId: ${documentId || 'all'}`);

      // 양수와 음수 모두 처리하기 위해 조건 확장
      // - depositAmount >= minAmount (양수 입금)
      // - withdrawalAmount >= minAmount (양수 출금)
      // - withdrawalAmount <= -minAmount (음수 출금: -120만 <= -100만)
      const whereClause: Record<string, unknown> = {
        caseId,
        OR: [
          { depositAmount: { gte: minAmount } },
          { withdrawalAmount: { gte: minAmount } },
          { withdrawalAmount: { lte: -minAmount } }, // 음수 출금 처리
        ],
      };

      if (documentId) {
        whereClause.documentId = documentId;
      }

      console.log(`[filterByAmount] WHERE 조건:`, JSON.stringify(whereClause, null, 2));

      const transactions = await ctx.db.transaction.findMany({
        where: whereClause,
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          balance: true,
          memo: true,
          documentId: true,
          rowNumber: true,
          document: {
            select: {
              originalFileName: true,
            },
          },
        },
        orderBy: [
          { document: { originalFileName: "asc" } },
          { transactionDate: "asc" },
          { rowNumber: "asc" },
        ],
      });

      console.log(`[filterByAmount] DB 조회 결과: ${transactions.length}건`);
      
      // 처음 5건의 원본 데이터 로그
      transactions.slice(0, 5).forEach((tx, idx) => {
        console.log(`[filterByAmount] [${idx}] date: ${tx.transactionDate.toISOString().slice(0,10)}, deposit: ${tx.depositAmount}, withdrawal: ${tx.withdrawalAmount}, memo: ${tx.memo?.slice(0,20) || '-'}`);
      });

      // 3. 통계 계산 (음수 출금도 처리)
      // 입금건: depositAmount가 minAmount 이상이고, 실제로 입금액이 있는 경우
      const depositCount = transactions.filter(tx => {
        const depositAmt = tx.depositAmount ? Number(tx.depositAmount) : 0;
        return depositAmt >= minAmount && depositAmt > 0;
      }).length;

      // 출금건: withdrawalAmount의 절대값이 minAmount 이상인 경우
      // (양수 출금: withdrawalAmt >= minAmount, 음수 출금: withdrawalAmt <= -minAmount)
      const withdrawalCount = transactions.filter(tx => {
        const withdrawalAmt = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
        const absWithdrawal = Math.abs(withdrawalAmt);
        return absWithdrawal >= minAmount && withdrawalAmt !== 0;
      }).length;

      const depositTotal = transactions.reduce((sum, tx) => {
        const depositAmt = tx.depositAmount ? Number(tx.depositAmount) : 0;
        return depositAmt >= minAmount && depositAmt > 0 ? sum + depositAmt : sum;
      }, 0);

      const withdrawalTotal = transactions.reduce((sum, tx) => {
        const withdrawalAmt = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
        const absWithdrawal = Math.abs(withdrawalAmt);
        return absWithdrawal >= minAmount && withdrawalAmt !== 0 ? sum + absWithdrawal : sum;
      }, 0);

      console.log(`[filterByAmount] 통계 - 입금: ${depositCount}건/${depositTotal}원, 출금: ${withdrawalCount}건/${withdrawalTotal}원`);

      // 4. 거래 유형 판별 로직 (음수 출금도 처리)
      const mappedTransactions = transactions.map(tx => {
        const depositAmt = tx.depositAmount ? Number(tx.depositAmount) : 0;
        const withdrawalAmt = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
        const absWithdrawal = Math.abs(withdrawalAmt);
        
        // 입금건 판별: 입금액이 minAmount 이상이고 0보다 큼
        // 출금건 판별: 출금액의 절대값이 minAmount 이상이고 0이 아님
        let type: "입금" | "출금";
        let amount: number;

        const isDeposit = depositAmt >= minAmount && depositAmt > 0;
        const isWithdrawal = absWithdrawal >= minAmount && withdrawalAmt !== 0;

        if (isDeposit && isWithdrawal) {
          // 둘 다 조건 만족하면 금액이 큰 쪽 선택
          if (depositAmt >= absWithdrawal) {
            type = "입금";
            amount = depositAmt;
          } else {
            type = "출금";
            amount = absWithdrawal; // 절대값으로 반환
          }
        } else if (isDeposit) {
          type = "입금";
          amount = depositAmt;
        } else if (isWithdrawal) {
          type = "출금";
          amount = absWithdrawal; // 절대값으로 반환
        } else {
          // 어느 쪽도 minAmount 이상이 아님 (이론상 여기 오면 안됨 - OR 쿼리 결과이므로)
          console.warn(`[filterByAmount] 경고: 거래 ${tx.id}가 조건에 맞지 않음 - deposit: ${depositAmt}, withdrawal: ${withdrawalAmt}, absWithdrawal: ${absWithdrawal}, minAmount: ${minAmount}`);
          if (depositAmt > 0) {
            type = "입금";
            amount = depositAmt;
          } else {
            type = "출금";
            amount = absWithdrawal;
          }
        }

        // 디버깅: 각 거래의 원본 데이터 로그 (처음 5건만)
        if (transactions.indexOf(tx) < 5) {
          console.log(`[filterByAmount] 거래 상세 - id: ${tx.id.slice(0,8)}, depositAmount: ${depositAmt}, withdrawalAmount: ${withdrawalAmt}, type: ${type}, amount: ${amount}`);
        }

        return {
          id: tx.id,
          transactionDate: tx.transactionDate.toISOString(),
          type,
          amount,
          depositAmount: depositAmt > 0 ? depositAmt : 0,
          withdrawalAmount: absWithdrawal > 0 ? absWithdrawal : 0,
          balance: Number(tx.balance) || 0,
          memo: tx.memo || "",
          documentId: tx.documentId,
          documentName: tx.document?.originalFileName || "",
        };
      });

      console.log(`[filterByAmount] 완료 - 총 ${mappedTransactions.length}건 반환`);

      return {
        transactions: mappedTransactions,
        summary: {
          total: transactions.length,
          depositCount,
          withdrawalCount,
          depositTotal,
          withdrawalTotal,
          minAmount,
        },
      };
    }),

  /**
   * 잔액 기반 입금/출금 검증 및 교정
   * 
   * 기존에 저장된 거래 데이터에서 OCR 파싱 오류로 인한 
   * 입금/출금 오분류를 감지하고 교정합니다.
   * 
   * @param caseId - 사건 ID
   * @param documentId - 특정 문서로 제한 (선택)
   * @param dryRun - true: 검증만 수행 (실제 수정 안함), false: 실제 교정
   * @returns 검증/교정 결과
   */
  validateBalanceAndCorrect: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        documentId: z.string().optional(),
        dryRun: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, documentId, dryRun } = input;
      const userId = ctx.userId;

      console.log(`[validateBalance] ========== 시작 ==========`);
      console.log(`[validateBalance] caseId: ${caseId}, documentId: ${documentId || 'all'}, dryRun: ${dryRun}`);

      // 1. RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseData = await ctx.db.case.findUnique({
        where: { id: caseId },
        select: { lawyerId: true },
      });

      if (!caseData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseData.lawyerId,
      });

      // 2. 거래 데이터 조회
      const whereClause: Record<string, unknown> = { caseId };
      if (documentId) {
        whereClause.documentId = documentId;
      }

      const transactions = await ctx.db.transaction.findMany({
        where: whereClause,
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          balance: true,
          memo: true,
          documentId: true,
          document: {
            select: {
              originalFileName: true,
            },
          },
        },
        orderBy: { transactionDate: "asc" },
      });

      console.log(`[validateBalance] 총 거래 수: ${transactions.length}건`);

      // 3. 잔액 기반 검증
      // 허용 오차: 잔액 계산 시 소수점 오차, 이자 등을 고려하여 0.1% 또는 최소 100원
      const getToleranceForAmount = (amount: number) => Math.max(100, Math.abs(amount) * 0.001);
      
      const issues: Array<{
        id: string;
        transactionDate: string;
        currentType: "입금" | "출금";
        suggestedType: "입금" | "출금";
        amount: number;
        prevBalance: number;
        currentBalance: number;
        expectedBalance: number;
        actualChange: number;
        memo: string;
        documentName: string;
      }> = [];

      const corrections: Array<{
        id: string;
        corrected: boolean;
      }> = [];

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (!tx) continue;

        const currentBalance = tx.balance ? Number(tx.balance) : null;
        const depositAmount = tx.depositAmount ? Math.abs(Number(tx.depositAmount)) : 0;
        const withdrawalAmount = tx.withdrawalAmount ? Math.abs(Number(tx.withdrawalAmount)) : 0;

        // 잔액이 없으면 검증 불가
        if (currentBalance === null) continue;

        // 이전 거래의 잔액
        let prevBalance: number | null = null;
        if (i > 0) {
          const prevTx = transactions[i - 1];
          prevBalance = prevTx?.balance ? Number(prevTx.balance) : null;
        }

        // 이전 잔액이 없으면 검증 불가
        if (prevBalance === null) continue;

        // 실제 잔액 변동
        const actualChange = currentBalance - prevBalance;

        // 현재 분류 확인
        const isDeposit = depositAmount > 0 && withdrawalAmount === 0;
        const isWithdrawal = withdrawalAmount > 0 && depositAmount === 0;

        if (!isDeposit && !isWithdrawal) continue;

        const amount = isDeposit ? depositAmount : withdrawalAmount;
        const expectedChange = isDeposit ? amount : -amount;
        const expectedBalance = prevBalance + expectedChange;
        
        // 허용 오차 계산 (금액의 0.1% 또는 최소 100원)
        const tolerance = getToleranceForAmount(amount);

        // 예상 변동과 실제 변동 비교
        const isMatch = Math.abs(actualChange - expectedChange) <= tolerance;

        if (!isMatch) {
          // 반대 케이스로 검증
          const oppositeExpectedChange = isDeposit ? -amount : amount;
          const isOppositeMatch = Math.abs(actualChange - oppositeExpectedChange) <= tolerance;

          if (isOppositeMatch) {
            // 오분류 감지!
            issues.push({
              id: tx.id,
              transactionDate: tx.transactionDate.toISOString(),
              currentType: isDeposit ? "입금" : "출금",
              suggestedType: isDeposit ? "출금" : "입금",
              amount,
              prevBalance,
              currentBalance,
              expectedBalance,
              actualChange,
              memo: tx.memo || "",
              documentName: tx.document?.originalFileName || "",
            });

            // 실제 교정 수행 (dryRun=false 일 때만)
            if (!dryRun) {
              await ctx.db.transaction.update({
                where: { id: tx.id },
                data: {
                  depositAmount: isDeposit ? null : amount,
                  withdrawalAmount: isDeposit ? amount : null,
                },
              });
              corrections.push({ id: tx.id, corrected: true });
              console.log(`[validateBalance] 교정됨: ${tx.id} (${isDeposit ? "입금→출금" : "출금→입금"})`);
            }
          }
        }
      }

      console.log(`[validateBalance] 완료 - 감지된 오류: ${issues.length}건, 교정: ${corrections.length}건`);

      return {
        totalTransactions: transactions.length,
        issuesFound: issues.length,
        correctionsMade: corrections.length,
        dryRun,
        issues,
      };
    }),

  /**
   * 대출금 사용 추적 (서버 사이드)
   * 
   * 키워드로 대출 입금건을 찾고, 이후 출금 내역을 추적
   * 
   * @param caseId - 사건 ID
   * @param keyword - 대출건 검색 키워드
   * @param documentId - 특정 문서로 제한 (선택)
   * @returns 대출금 추적 결과
   */
  trackLoanUsage: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        keyword: z.string().min(1, "검색 키워드는 필수 항목입니다"),
        documentId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, keyword, documentId } = input;
      const userId = ctx.userId;

      // 1. RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      // 2. 대출 입금건 검색 (키워드 + 입금액 > 0)
      const loanWhereClause: Record<string, unknown> = {
        caseId,
        memo: {
          contains: keyword,
          mode: "insensitive",
        },
        depositAmount: {
          gt: 0,
        },
      };

      if (documentId) {
        loanWhereClause.documentId = documentId;
      }

      const loanDeposit = await ctx.db.transaction.findFirst({
        where: loanWhereClause,
        orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          balance: true,
          memo: true,
        },
      });

      if (!loanDeposit) {
        return {
          found: false,
          message: `"${keyword}" 키워드를 포함한 입금 거래를 찾을 수 없습니다.`,
          loanInfo: null,
          trackedItems: [],
          summary: null,
        };
      }

      const loanAmount = Number(loanDeposit.depositAmount);

      // 3. 대출 실행 이후의 출금 내역 조회
      const withdrawalWhereClause: Record<string, unknown> = {
        caseId,
        transactionDate: {
          gte: loanDeposit.transactionDate,
        },
        withdrawalAmount: {
          gt: 0,
        },
        id: {
          not: loanDeposit.id, // 대출건 자체는 제외
        },
      };

      if (documentId) {
        withdrawalWhereClause.documentId = documentId;
      }

      const withdrawals = await ctx.db.transaction.findMany({
        where: withdrawalWhereClause,
        orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
        select: {
          id: true,
          transactionDate: true,
          withdrawalAmount: true,
          balance: true,
          memo: true,
        },
      });

      // 4. 추적 결과 생성 (대출금 소진까지)
      interface TrackedItem {
        date: string;
        type: "대출실행" | "출금" | "이체";
        amount: number;
        balance: number;
        memo: string;
        remainingLoan: number;
      }

      const trackedItems: TrackedItem[] = [];
      let remainingLoan = loanAmount;

      // 대출 실행건 추가
      trackedItems.push({
        date: loanDeposit.transactionDate.toISOString(),
        type: "대출실행",
        amount: loanAmount,
        balance: Number(loanDeposit.balance) || 0,
        memo: loanDeposit.memo || "",
        remainingLoan: remainingLoan,
      });

      // 출금 내역 추적 (대출금 소진까지)
      for (const tx of withdrawals) {
        const withdrawal = Number(tx.withdrawalAmount);
        const memo = tx.memo || "";
        const isTransfer = memo.includes("이체") || memo.includes("송금") || memo.includes("이동") || memo.includes("振込");

        // 이체/이동 거래는 대출금 차감하지 않음
        if (!isTransfer) {
          remainingLoan -= withdrawal;
        }

        trackedItems.push({
          date: tx.transactionDate.toISOString(),
          type: isTransfer ? "이체" : "출금",
          amount: withdrawal,
          balance: Number(tx.balance) || 0,
          memo,
          remainingLoan: Math.max(0, remainingLoan),
        });

        // 대출금 전액 사용 시 추적 종료 (이체는 소진 판단에서 제외)
        if (!isTransfer && remainingLoan <= 0) break;
      }

      const totalUsed = loanAmount - Math.max(0, remainingLoan);

      return {
        found: true,
        message: `대출금 ${loanAmount.toLocaleString()}원 추적 완료`,
        loanInfo: {
          date: loanDeposit.transactionDate.toISOString(),
          amount: loanAmount,
          memo: loanDeposit.memo || "",
        },
        trackedItems,
        summary: {
          loanAmount,
          totalUsed,
          usageCount: trackedItems.length - 1, // 대출실행 제외
          remainingLoan: Math.max(0, remainingLoan),
        },
      };
    }),

  /**
   * 대출 의심 입금건 자동 추출
   * 큰 금액, round number (100만원 단위), "대출/론/융자" 키워드 등
   */
  getSuspectedLoanDeposits: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        minAmount: z.number().optional().default(1000000), // 기본 100만원 이상
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, minAmount } = input;
      const userId = ctx.userId;

      // RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      // 대출 의심 입금건 조회
      // 1. 금액이 minAmount 이상인 입금건
      // 2. 비고에 대출 관련 키워드가 있는 입금건
      const deposits = await ctx.db.transaction.findMany({
        where: {
          caseId,
          depositAmount: { gt: 0 },
          OR: [
            { depositAmount: { gte: minAmount } },
            { memo: { contains: "대출", mode: "insensitive" } },
            { memo: { contains: "론", mode: "insensitive" } },
            { memo: { contains: "융자", mode: "insensitive" } },
            { memo: { contains: "담보", mode: "insensitive" } },
            { memo: { contains: "신용", mode: "insensitive" } },
            { memo: { contains: "마이너스", mode: "insensitive" } },
            { memo: { contains: "카드론", mode: "insensitive" } },
            { memo: { contains: "현금서비스", mode: "insensitive" } },
          ],
        },
        orderBy: [
          { depositAmount: "desc" },
          { transactionDate: "asc" },
        ],
        take: 100,
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          balance: true,
          memo: true,
          document: {
            select: {
              id: true,
              originalFileName: true,
            },
          },
        },
      });

      // Round number 여부 및 대출 키워드 여부 표시
      const loanKeywords = ["대출", "론", "융자", "담보", "신용", "마이너스", "카드론", "현금서비스"];
      const highConfidenceKeywords = ["저축은행", "캐피탈", "파이낸스", "대부"];

      const processedDeposits = deposits.map(d => {
        const amount = Number(d.depositAmount);
        const memo = d.memo || "";
        
        // Round number 체크 (500만원, 1000만원 단위)
        const is1000manUnit = amount >= 10000000 && amount % 10000000 === 0; // 1000만원 단위
        const is500manUnit = amount >= 5000000 && amount % 5000000 === 0;    // 500만원 단위
        const is100manUnit = amount >= 1000000 && amount % 1000000 === 0;    // 100만원 단위
        
        // 키워드 체크
        const hasLoanKeyword = loanKeywords.some(k => memo.includes(k));
        const hasHighConfidenceKeyword = highConfidenceKeywords.some(k => memo.includes(k));
        
        // 신뢰도 계산
        let confidence = 0;
        
        // 금액 기반 신뢰도
        if (is1000manUnit) confidence += 40;       // 1000만원 단위
        else if (is500manUnit) confidence += 30;  // 500만원 단위
        else if (is100manUnit) confidence += 15;  // 100만원 단위
        
        if (amount >= 10000000) confidence += 20; // 1000만원 이상
        else if (amount >= 5000000) confidence += 10; // 500만원 이상
        
        // 키워드 기반 신뢰도
        if (hasHighConfidenceKeyword) confidence += 40; // 저축은행, 캐피탈 등
        if (hasLoanKeyword) confidence += 30;           // 대출, 융자 등

        return {
          id: d.id,
          date: d.transactionDate.toISOString(),
          amount,
          balance: Number(d.balance) || 0,
          memo,
          documentId: d.document?.id || null,
          documentName: d.document?.originalFileName || null,
          isRoundNumber: is1000manUnit || is500manUnit,
          hasLoanKeyword: hasLoanKeyword || hasHighConfidenceKeyword,
          confidence: Math.min(confidence, 100), // 최대 100
        };
      });

      // 신뢰도 높은 순서로 정렬
      processedDeposits.sort((a, b) => b.confidence - a.confidence);

      return {
        deposits: processedDeposits,
        totalCount: processedDeposits.length,
      };
    }),

  /**
   * 키워드로 대출 입금건 검색
   */
  searchLoanDeposits: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        keyword: z.string().min(1, "검색 키워드는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, keyword } = input;
      const userId = ctx.userId;

      // RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      const deposits = await ctx.db.transaction.findMany({
        where: {
          caseId,
          depositAmount: { gt: 0 },
          memo: { contains: keyword, mode: "insensitive" },
        },
        orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
        take: 50,
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          balance: true,
          memo: true,
          document: {
            select: {
              id: true,
              originalFileName: true,
            },
          },
        },
      });

      return {
        deposits: deposits.map(d => ({
          id: d.id,
          date: d.transactionDate.toISOString(),
          amount: Number(d.depositAmount),
          balance: Number(d.balance) || 0,
          memo: d.memo || "",
          documentId: d.document?.id || null,
          documentName: d.document?.originalFileName || null,
        })),
        totalCount: deposits.length,
      };
    }),

  /**
   * 여러 대출건 동시 추적
   */
  trackMultipleLoans: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        loanIds: z.array(z.string()).min(1, "추적할 대출건을 선택해주세요"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, loanIds } = input;
      const userId = ctx.userId;

      // RBAC 검증
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: caseRecord.lawyerId,
      });

      // 선택된 대출건들 조회
      const loanDeposits = await ctx.db.transaction.findMany({
        where: {
          id: { in: loanIds },
          caseId,
          depositAmount: { gt: 0 },
        },
        orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          balance: true,
          memo: true,
          document: {
            select: {
              id: true,
              originalFileName: true,
            },
          },
        },
      });

      if (loanDeposits.length === 0) {
        return {
          success: false,
          message: "선택된 대출건을 찾을 수 없습니다.",
          results: [],
        };
      }

      // 각 대출건별 추적 결과
      const results = await Promise.all(
        loanDeposits.map(async (loan) => {
          const loanAmount = Number(loan.depositAmount);
          const loanDocumentId = loan.document?.id;

          // 동일 사건의 다른 계좌(문서)에서의 입금 내역 조회 (이동 매칭용)
          // 대출 계좌가 아닌 다른 문서의 입금 내역
          // 주의: 입금 금액이 양수 또는 음수로 저장될 수 있음
          const otherDepositWhereClause: Record<string, unknown> = {
            caseId,
            transactionDate: { gte: loan.transactionDate },
            OR: [
              { depositAmount: { gt: 0 } },
              { depositAmount: { lt: 0 } }, // 음수 입금도 포함 (오분류된 경우)
            ],
          };
          
          // loanDocumentId가 있을 때만 해당 문서 제외 (없으면 모든 문서 포함)
          if (loanDocumentId) {
            otherDepositWhereClause.documentId = { not: loanDocumentId };
          }
          
          const otherDeposits = await ctx.db.transaction.findMany({
            where: otherDepositWhereClause,
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              memo: true,
              document: {
                select: {
                  id: true,
                  originalFileName: true,
                },
              },
            },
          });

          // 이동 매칭을 위한 맵 생성 (날짜_금액 -> 입금 정보 배열)
          // 동일 일자 + 동일 금액의 입금이 다른 계좌에 여러 건 있을 수 있음
          const depositMatchMap = new Map<string, Array<{
            depositId: string;
            depositDocumentName: string;
            depositMemo: string;
          }>>();

          console.log(`[trackMultipleLoans] 대출 ID: ${loan.id.slice(0,8)}, 문서: ${loan.document?.originalFileName}`);
          console.log(`[trackMultipleLoans] 다른 계좌 입금건 수: ${otherDeposits.length}건`);

          for (const dep of otherDeposits) {
            const dateStr = dep.transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const amount = Math.abs(Number(dep.depositAmount)); // 절대값으로 매칭
            const key = `${dateStr}_${amount}`;
            
            const arr = depositMatchMap.get(key) || [];
            arr.push({
              depositId: dep.id,
              depositDocumentName: dep.document?.originalFileName || "",
              depositMemo: dep.memo || "",
            });
            depositMatchMap.set(key, arr);
          }
          
          console.log(`[trackMultipleLoans] 매칭 가능한 입금 키 수: ${depositMatchMap.size}개`);

          // 추적 결과 생성
          interface TrackedItem {
            date: string;
            type: "대출실행" | "출금" | "이동";
            amount: number;
            balance: number;
            memo: string;
            remainingLoan: number;
            documentName: string;
            // 이동인 경우 추가 정보
            transferTo?: string; // 이동 대상 계좌(문서명)
            transferFrom?: string; // 이동 출발 계좌(문서명)
            transferMemo?: string; // 이동 대상의 비고
          }

          const trackedItems: TrackedItem[] = [];
          const usedDepositCounts = new Map<string, number>(); // key → 사용된 매칭 수

          // 대출 실행건 추가
          trackedItems.push({
            date: loan.transactionDate.toISOString(),
            type: "대출실행",
            amount: loanAmount,
            balance: Number(loan.balance) || 0,
            memo: loan.memo || "",
            remainingLoan: loanAmount,
            documentName: loan.document?.originalFileName || "",
          });

          // 1단계: 대출 계좌의 출금만 먼저 처리 (이동 탐지용)
          const loanAccountWithdrawals = await ctx.db.transaction.findMany({
            where: {
              caseId,
              transactionDate: { gte: loan.transactionDate },
              withdrawalAmount: { gt: 0 },
              id: { not: loan.id },
              documentId: loanDocumentId, // 대출 계좌만 (이동 탐지)
            },
            orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
            take: 1000,
            select: {
              id: true,
              transactionDate: true,
              withdrawalAmount: true,
              balance: true,
              memo: true,
              document: {
                select: { id: true, originalFileName: true },
              },
            },
          });

          // === 1단계: 대출 계좌 출금 처리 (이동 탐색 + 직접 출금) ===
          const processedTxIds = new Set<string>(); // 중복 방지용

          for (const tx of loanAccountWithdrawals) {
            processedTxIds.add(tx.id);
            const withdrawal = Number(tx.withdrawalAmount);
            const memo = tx.memo || "";
            const dateStr = tx.transactionDate.toISOString().split('T')[0];
            const matchKey = `${dateStr}_${withdrawal}`;

            const deposits = depositMatchMap.get(matchKey);
            const usedCount = usedDepositCounts.get(matchKey) || 0;
            const matchedDeposit = deposits && usedCount < deposits.length ? deposits[usedCount] : undefined;
            const isTransfer = !!matchedDeposit;

            if (isTransfer) {
              usedDepositCounts.set(matchKey, usedCount + 1);

              trackedItems.push({
                date: tx.transactionDate.toISOString(),
                type: "이동",
                amount: withdrawal,
                balance: Number(tx.balance) || 0,
                memo,
                remainingLoan: 0, // 정렬 후 재계산
                documentName: tx.document?.originalFileName || "",
                transferTo: matchedDeposit.depositDocumentName,
                transferMemo: matchedDeposit.depositMemo,
              });
            } else {
              trackedItems.push({
                date: tx.transactionDate.toISOString(),
                type: "출금",
                amount: withdrawal,
                balance: Number(tx.balance) || 0,
                memo,
                remainingLoan: 0, // 정렬 후 재계산
                documentName: tx.document?.originalFileName || "",
              });
            }
          }

          // === 2단계: 이동 대상 계좌의 출금 추적 (이동 예산 범위 내에서만) ===
          const transferDestDocIds = new Set<string>();
          for (const dep of otherDeposits) {
            const dateStr = dep.transactionDate.toISOString().split('T')[0];
            const amount = Number(dep.depositAmount);
            const key = `${dateStr}_${amount}`;
            const usedCount = usedDepositCounts.get(key) || 0;
            if (usedCount > 0 && dep.document?.id) {
              transferDestDocIds.add(dep.document.id);
            }
          }

          if (transferDestDocIds.size > 0) {
            // 이동 대상 계좌들의 출금 조회
            const destWithdrawals = await ctx.db.transaction.findMany({
              where: {
                caseId,
                transactionDate: { gte: loan.transactionDate },
                withdrawalAmount: { gt: 0 },
                documentId: { in: [...transferDestDocIds] },
              },
              orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
              take: 1000,
              select: {
                id: true,
                transactionDate: true,
                withdrawalAmount: true,
                balance: true,
                memo: true,
                document: {
                  select: { id: true, originalFileName: true },
                },
              },
            });

            // 이동 대상 계좌별 남은 예산 관리 (이동된 금액까지만 추적)
            const destBudgets = new Map<string, number>();
            for (const dep of otherDeposits) {
              const dateStr = dep.transactionDate.toISOString().split('T')[0];
              const amount = Number(dep.depositAmount);
              const key = `${dateStr}_${amount}`;
              const usedCount = usedDepositCounts.get(key) || 0;
              if (usedCount > 0 && dep.document?.id) {
                const prev = destBudgets.get(dep.document.id) || 0;
                destBudgets.set(dep.document.id, prev + amount);
              }
            }

            for (const tx of destWithdrawals) {
              const docId = tx.document?.id || "";
              const budget = destBudgets.get(docId) || 0;
              if (budget <= 0) continue; // 이 계좌의 이동 예산 소진됨

              const txAmount = Number(tx.withdrawalAmount);
              const tracked = Math.min(txAmount, budget);
              destBudgets.set(docId, budget - tracked);

              trackedItems.push({
                date: tx.transactionDate.toISOString(),
                type: "출금",
                amount: txAmount,
                balance: Number(tx.balance) || 0,
                memo: tx.memo || "",
                remainingLoan: 0, // 정렬 후 재계산
                documentName: tx.document?.originalFileName || "",
                transferFrom: loan.document?.originalFileName || "",
              });
            }
          }

          // === 3단계: 정렬 (이동+매칭 출금 그룹핑) 후 남은 대출금 순차 재계산 ===
          // 1차: 날짜순 정렬
          trackedItems.sort((a, b) => {
            const dateA = a.date.split('T')[0] ?? '';
            const dateB = b.date.split('T')[0] ?? '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            // 동일 날짜 내: 대출실행(0) > 직접출금(1) > 이동(2) > 이동대상출금(3)
            const getPriority = (item: TrackedItem) => {
              if (item.type === "대출실행") return 0;
              if (item.type === "출금" && !item.transferFrom) return 1;
              if (item.type === "이동") return 2;
              return 3; // transferFrom 있는 출금 (이동 대상 계좌)
            };
            return getPriority(a) - getPriority(b);
          });

          // 2차: 이동 직후에 매칭되는 이동대상 출금(같은 날짜, 같은 금액) 배치
          const regrouped: TrackedItem[] = [];
          const usedIndices = new Set<number>();

          for (let i = 0; i < trackedItems.length; i++) {
            if (usedIndices.has(i)) continue;
            const item = trackedItems[i]!;
            regrouped.push(item);
            usedIndices.add(i);

            // 이동 항목이면 매칭되는 이동대상 출금을 바로 뒤에 배치
            if (item.type === "이동") {
              const dateStr = item.date.split('T')[0];
              // 같은 날짜 + 같은 금액 + 이동대상 출금 찾기
              for (let j = i + 1; j < trackedItems.length; j++) {
                if (usedIndices.has(j)) continue;
                const other = trackedItems[j]!;
                if (other.date.split('T')[0] !== dateStr) break;
                if (other.transferFrom && other.amount === item.amount) {
                  regrouped.push(other);
                  usedIndices.add(j);
                  break;
                }
              }
            }
          }

          // remainingLoan 재계산
          // 이동 대상 계좌 출금(transferFrom)은 남은 대출금에 영향 안 줌 → -1 (프론트에서 "-" 표시)
          let runningLoan = loanAmount;
          for (const item of regrouped) {
            if (item.type === "대출실행") {
              item.remainingLoan = runningLoan;
            } else if (item.type === "이동") {
              item.remainingLoan = runningLoan;
            } else if (item.transferFrom) {
              // 이동 대상 계좌의 출금: 남은 대출금 표시 안 함
              item.remainingLoan = -1;
            } else {
              // 대출 계좌의 직접 출금만 남은 대출금 차감
              runningLoan -= item.amount;
              if (runningLoan < 0) runningLoan = 0;
              item.remainingLoan = runningLoan;
            }
          }

          const totalUsed = loanAmount - Math.max(0, runningLoan);
          const transferCount = regrouped.filter(t => t.type === "이동").length;

          return {
            loanId: loan.id,
            loanDate: loan.transactionDate.toISOString(),
            loanAmount,
            loanMemo: loan.memo || "",
            loanDocumentName: loan.document?.originalFileName || "",
            trackedItems: regrouped,
            summary: {
              loanAmount,
              totalUsed,
              usageCount: regrouped.filter(t => t.type === "출금").length,
              transferCount,
              remainingLoan: Math.max(0, runningLoan),
              exhausted: runningLoan <= 0,
            },
          };
        })
      );

      return {
        success: true,
        message: `${results.length}건의 대출금 추적 완료`,
        results,
      };
    }),
});
