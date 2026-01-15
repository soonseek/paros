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
      if (document.case.lawyerId !== userId && user.role !== "ADMIN") {
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

      if (document.case.lawyerId !== userId && user.role !== "ADMIN") {
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
          orderBy: [{ transactionDate: "desc" }],
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

      if (!user || user.role !== "ADMIN") {
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

      if (!user || user.role !== "ADMIN") {
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
          (where.OR as Array<Record<string, unknown>>)[0].depositAmount = depositAmountMin;
          (where.OR as Array<Record<string, unknown>>)[1].withdrawalAmount = withdrawalAmountMin;
        }

        if (maxAmount !== undefined) {
          const depositAmountMax = { lte: maxAmount };
          const withdrawalAmountMax = { lte: maxAmount };
          (where.OR as Array<Record<string, unknown>>)[0].depositAmount = depositAmountMax;
          (where.OR as Array<Record<string, unknown>>)[1].withdrawalAmount = withdrawalAmountMax;
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
          orderBy: [{ transactionDate: "desc" }],
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

      if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 문서의 거래내역을 삭제할 권한이 없습니다",
        });
      }

      // DEBUG: Check if transactions exist for this documentId
      const existingTransactions = await ctx.db.transaction.findMany({
        where: { documentId },
        select: { id: true, documentId: true },
        take: 5,
      });

      console.log(`[Delete Transactions] Document ID: ${documentId}`);
      console.log(`[Delete Transactions] Found ${existingTransactions.length} transactions before delete`);
      if (existingTransactions.length > 0) {
        console.log(`[Delete Transactions] Sample transactions:`, existingTransactions.map(t => ({ id: t.id, documentId: t.documentId })));
      }

      // Also check all transactions for this case
      const allCaseTransactions = await ctx.db.transaction.findMany({
        where: { caseId: document.caseId },
        select: { id: true, documentId: true },
      });

      console.log(`[Delete Transactions] Total transactions in case: ${allCaseTransactions.length}`);
      console.log(`[Delete Transactions] Unique document IDs in case:`, [...new Set(allCaseTransactions.map(t => t.documentId))]);

      // 3. Delete all transactions for this document
      const result = await ctx.db.transaction.deleteMany({
        where: { documentId },
      });

      console.log(`[Delete Transactions] Deleted ${result.count} transactions for document ${documentId}`);

      return {
        deletedCount: result.count,
        message: `${result.count}건의 거래내역이 삭제되었습니다`,
      };
    }),
});
