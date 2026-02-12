/**
 * Fund Flow Tracking Router (Epic 5)
 *
 * 자금 흐름 추적 기능을 위한 tRPC 라우터
 *
 * Stories:
 * - 5.1: 자금 출처 추적 (Upstream Fund Tracing)
 * - 5.2: 자금 사용처 추적 (Downstream Fund Tracing)
 * - 5.3: 거래 체인 식별 (Transaction Chain Identification)
 * - 5.5: 추적 필터링 (Tracking Filtering)
 *
 * @module server/api/routers/fundFlow
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  caseAccessProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TransactionRelationType } from "@prisma/client"; // PrismaClient 제거 (CRITICAL #3: 더 이상 필요 없음)
import { traceUpstreamFunds, traceDownstreamFunds } from "../../services/fund-flow-service";
import { logFundFlowTrace } from "../../audit/fund-flow-audit";
import { auditLog } from "~/server/audit/audit-log"; // Story 7.4: Epic 7 패턴 - 감사 로그 (CRITICAL #4 수정: ctx.db 사용)
import type { FundFlowFilters } from "~/lib/filter-utils";
import { fundFlowFiltersSchema, applyFilters } from "~/lib/filter-utils"; // HIGH #1: applyFilters import

/**
 * Story 5.1: 자금 출처 추적
 *
 * 입금 거래의 자금 출처를 상류 방향으로 추적 (최대 5단계)
 */
export const fundFlowRouter = createTRPCRouter({
  /**
   * 자금 출처 추적 (Upstream Fund Tracing)
   *
   * Story 5.1 Acceptance Criteria:
   * - Given: 사용자가 TransactionTable에서 특정 입금 거래를 선택
   * - When: "자금 출처 추적" 버튼 클릭
   * - Then: 금액 ±10%, 날짜 이전 조건으로 출금 거래 검색
   * - And: 연관 강도(금액 일치도, 날짜 근접도) 표시
   * - And: 최대 5단계까지 추적
   *
   * Performance Requirement (NFR-003): 3초 이내 응답
   */
  traceUpstream: caseAccessProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(), // 추적을 시작할 거래 ID
        caseId: z.string().uuid(), // Case ID (RBAC 검증용)
        maxDepth: z.number().int().min(1).max(5).default(3), // MEDIUM #2: .int() 추가 - 추적 깊이 (기본값: 3, 최대: 5)
        amountTolerance: z.number().min(0).max(1).default(0.1), // 금액 허용 오차 (기본값: ±10%)
        filters: fundFlowFiltersSchema.optional(), // HIGH #1: 서버 사이드 필터링을 위한 필터 파라미터
      })
    )
    .query(async ({ ctx, input }) => {
      const { transactionId, caseId, maxDepth, amountTolerance, filters } = input; // HIGH #1: filters 추가

      // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음 (canAccessCase helper 사용)

      // 시작 거래 조회
      const startTransaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          caseId: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          memo: true,
          category: true,
          creditorName: true,
        },
      });

      if (!startTransaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "거래를 찾을 수 없습니다.",
        });
      }

      if (startTransaction.caseId !== caseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "거래가 해당 사건에 속하지 않습니다.",
        });
      }

      // MEDIUM #4: Decimal → number 변환 검증 (안전한 범위 확인)
      const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;
      const depositAmount = startTransaction.depositAmount
        ? Number(startTransaction.depositAmount)
        : null;
      const withdrawalAmount = startTransaction.withdrawalAmount
        ? Number(startTransaction.withdrawalAmount)
        : null;

      // 변환된 값이 안전한 범위인지 확인
      if (depositAmount !== null && (isNaN(depositAmount) || depositAmount > MAX_SAFE_AMOUNT)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `입금액 변환 오류: 값이 너무 큽니다 (>${MAX_SAFE_AMOUNT.toLocaleString()})`,
        });
      }
      if (withdrawalAmount !== null && (isNaN(withdrawalAmount) || withdrawalAmount > MAX_SAFE_AMOUNT)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `출금액 변환 오류: 값이 너무 큽니다 (>${MAX_SAFE_AMOUNT.toLocaleString()})`,
        });
      }

      // 자금 출처 추적 서비스 호출 (BFS 알고리즘)
      const startTime = performance.now();
      const result = await traceUpstreamFunds(
        ctx.db,
        {
          ...startTransaction,
          depositAmount,
          withdrawalAmount,
        },
        maxDepth,
        amountTolerance
      );
      const endTime = performance.now();

      // 성능 모니터링 (NFR-003: 3초 이내 응답)
      const responseTime = endTime - startTime;
      if (responseTime > 3000) {
        console.warn(
          `[FundFlow] traceUpstream 성능 경고: ${responseTime.toFixed(2)}ms (3초 초과)`
        );
      }

      // MEDIUM #3: 감사 로그 기록
      await logFundFlowTrace({
        db: ctx.db,
        userId: ctx.userId,
        action: "UPSTREAM_TRACE",
        metadata: {
          transactionId,
          caseId,
          maxDepth,
          amountTolerance,
          chainsFound: result.chains.length,
          totalTransactions: result.totalTransactions,
          responseTimeMs: Math.round(responseTime),
        },
        ipAddress: ctx.req.headers["x-forwarded-for"] as string | undefined,
        userAgent: ctx.req.headers["user-agent"] as string | undefined,
      });

      // HIGH #1: 서버 사이드 필터링 적용
      let filteredChains = result.chains;
      if (filters) {
        // 체인 내의 모든 거래를 수집하여 필터링
        // 체인이 필터 조건을 만족하는지 확인하려면 체인 내 모든 거래 중 하나라도 필터를 통과해야 함
        filteredChains = result.chains.filter((chain) => {
          // 체인의 모든 노드 수집 (chain.nodes: ChainNode[])
          const chainTransactions = chain.nodes.map((node) => ({
            transactionDate: node.transactionDate,
            depositAmount: node.amount > 0 ? node.amount : null,
            withdrawalAmount: node.amount < 0 ? Math.abs(node.amount) : null,
            tags: [], // TODO: 태그 관계 로드 필요
            transactionNature: null, // TODO: transactionNature 로드 필요
            importantTransaction: null, // TODO: importantTransaction 로드 필요
          }));

          // 체인 내 거래 중 필터 조건을 만족하는 거래가 있는지 확인
          const filtered = applyFilters(chainTransactions, filters);
          return filtered.length > 0; // 필터링 후 남은 거래가 있으면 체인 유지
        });
      }

      return {
        startTransaction: {
          ...startTransaction,
          // MEDIUM #4: 이미 검증된 값 사용
          depositAmount,
          withdrawalAmount,
        },
        chains: filteredChains, // HIGH #1: 필터링된 체인 반환
        totalChains: filteredChains.length,
        totalTransactions: filteredChains.reduce((sum, chain) => sum + chain.maxDepth, 0), // HIGH #1: 필터링된 거래 수
        responseTimeMs: Math.round(responseTime),
        maxDepth,
      };
    }),

  /**
   * Story 5.2: 자금 사용처 추적 (Downstream Fund Tracing)
   *
   * 출금 거래의 자금 사용처를 하류 방향으로 추적 (최대 5단계)
   */
  traceDownstream: caseAccessProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        caseId: z.string().uuid(),
        maxDepth: z.number().int().min(1).max(5).default(3), // MEDIUM #2: .int() 추가
        amountTolerance: z.number().min(0).max(1).default(0.1),
        filters: fundFlowFiltersSchema.optional(), // HIGH #1: 서버 사이드 필터링을 위한 필터 파라미터
      })
    )
    .query(async ({ ctx, input }) => {
      const { transactionId, caseId, maxDepth, amountTolerance, filters } = input; // HIGH #1: filters 추가

      // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음 (canAccessCase helper 사용)

      // 시작 거래 조회
      const startTransaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          caseId: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          memo: true,
          category: true,
          creditorName: true,
        },
      });

      if (!startTransaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "거래를 찾을 수 없습니다.",
        });
      }

      if (startTransaction.caseId !== caseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "거래가 해당 사건에 속하지 않습니다.",
        });
      }

      // MEDIUM #4: Decimal → number 변환 검증 (안전한 범위 확인)
      const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;
      const depositAmount = startTransaction.depositAmount
        ? Number(startTransaction.depositAmount)
        : null;
      const withdrawalAmount = startTransaction.withdrawalAmount
        ? Number(startTransaction.withdrawalAmount)
        : null;

      // 변환된 값이 안전한 범위인지 확인
      if (depositAmount !== null && (isNaN(depositAmount) || depositAmount > MAX_SAFE_AMOUNT)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `입금액 변환 오류: 값이 너무 큽니다 (>${MAX_SAFE_AMOUNT.toLocaleString()})`,
        });
      }
      if (withdrawalAmount !== null && (isNaN(withdrawalAmount) || withdrawalAmount > MAX_SAFE_AMOUNT)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `출금액 변환 오류: 값이 너무 큽니다 (>${MAX_SAFE_AMOUNT.toLocaleString()})`,
        });
      }

      // 자금 사용처 추적 서비스 호출
      const startTime = performance.now();
      const result = await traceDownstreamFunds(
        ctx.db,
        {
          ...startTransaction,
          depositAmount,
          withdrawalAmount,
        },
        maxDepth,
        amountTolerance
      );
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      if (responseTime > 3000) {
        console.warn(
          `[FundFlow] traceDownstream 성능 경고: ${responseTime.toFixed(2)}ms`
        );
      }

      // MEDIUM #3: 감사 로그 기록
      await logFundFlowTrace({
        db: ctx.db,
        userId: ctx.userId,
        action: "DOWNSTREAM_TRACE",
        metadata: {
          transactionId,
          caseId,
          maxDepth,
          amountTolerance,
          chainsFound: result.chains.length,
          totalTransactions: result.totalTransactions,
          responseTimeMs: Math.round(responseTime),
        },
        ipAddress: ctx.req.headers["x-forwarded-for"] as string | undefined,
        userAgent: ctx.req.headers["user-agent"] as string | undefined,
      });

      // HIGH #1: 서버 사이드 필터링 적용
      let filteredChains = result.chains;
      if (filters) {
        // 체인 내의 모든 거래를 수집하여 필터링
        // 체인이 필터 조건을 만족하는지 확인하려면 체인 내 모든 거래 중 하나라도 필터를 통과해야 함
        filteredChains = result.chains.filter((chain) => {
          // 체인의 모든 노드 수집 (chain.nodes: ChainNode[])
          const chainTransactions = chain.nodes.map((node) => ({
            transactionDate: node.transactionDate,
            depositAmount: node.amount > 0 ? node.amount : null,
            withdrawalAmount: node.amount < 0 ? Math.abs(node.amount) : null,
            tags: [], // TODO: 태그 관계 로드 필요
            transactionNature: null, // TODO: transactionNature 로드 필요
            importantTransaction: null, // TODO: importantTransaction 로드 필요
          }));

          // 체인 내 거래 중 필터 조건을 만족하는 거래가 있는지 확인
          const filtered = applyFilters(chainTransactions, filters);
          return filtered.length > 0; // 필터링 후 남은 거래가 있으면 체인 유지
        });
      }

      return {
        startTransaction: {
          ...startTransaction,
          // MEDIUM #4: 이미 검증된 값 사용
          depositAmount,
          withdrawalAmount,
        },
        chains: filteredChains, // HIGH #1: 필터링된 체인 반환
        totalChains: filteredChains.length,
        totalTransactions: filteredChains.reduce((sum, chain) => sum + chain.maxDepth, 0), // HIGH #1: 필터링된 거래 수
        responseTimeMs: Math.round(responseTime),
        maxDepth,
      };
    }),

  /**
   * Story 5.3: 거래 체인 저장 (Transaction Chain Persistence)
   *
   * 추적된 체인을 TransactionChain 테이블에 저장하여
   * 재계산 없이 빠르게 조회 가능
   */
  saveChain: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        startTxId: z.string().uuid(),
        endTxId: z.string().uuid(),
        chainType: z.enum(["UPSTREAM", "DOWNSTREAM"]),
        chainDepth: z.number().min(1).max(5),
        path: z.string(), // CSV: "tx1,tx2,tx3,tx4,tx5"
        totalAmount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음 (canAccessCase helper 사용)

      // 체인 저장
      const chain = await ctx.db.transactionChain.create({
        data: {
          caseId: input.caseId,
          startTxId: input.startTxId,
          endTxId: input.endTxId,
          chainType: input.chainType,
          chainDepth: input.chainDepth,
          path: input.path,
          totalAmount: input.totalAmount,
        },
      });

      return { success: true, chainId: chain.id };
    }),

  /**
   * Story 5.3: 저장된 체인 조회 (Get Saved Chains)
   *
   * TransactionChain 테이블에서 미리 계산된 체인을 조회
   */
  getSavedChains: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        chainType: z.enum(["UPSTREAM", "DOWNSTREAM"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음 (canAccessCase helper 사용)

      const chains = await ctx.db.transactionChain.findMany({
        where: {
          caseId: input.caseId,
          chainType: input.chainType,
        },
        include: {
          startTx: {
            select: {
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
            },
          },
          endTx: {
            select: {
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
            },
          },
        },
        orderBy: {
          chainDepth: "desc", // 깊이가 깊은 체인 우선
        },
      });

      return {
        chains,
        totalChains: chains.length,
      };
    }),

  /**
   * Story 5.5: 필터 저장 (Save Filter)
   *
   * 사용자의 현재 필터 조합을 SavedFilter 테이블에 저장
   */
  saveFilter: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        filters: fundFlowFiltersSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name, filters } = input;

      // RBAC: protectedProcedure middleware가 이미 인증을 확인했으므로
      // 추가 검증이 필요 없음 (필터는 사용자별로 격리됨)

      // upsert: 같은 이름으로 저장된 필터가 있으면 업데이트, 없으면 생성
      const savedFilter = await ctx.db.savedFilter.upsert({
        where: {
          userId_name: {
            userId: ctx.userId,
            name,
          },
        },
        update: {
          filters: filters as any, // Json 타입으로 저장
        },
        create: {
          userId: ctx.userId,
          name,
          filters: filters as any, // Json 타입으로 저장
        },
      });

      return {
        success: true,
        id: savedFilter.id,
        name: savedFilter.name,
      };
    }),

  /**
   * Story 5.5: 저장된 필터 목록 조회 (Get Saved Filters)
   *
   * 사용자의 저장된 필터 목록을 조회
   */
  getSavedFilters: protectedProcedure
    .query(async ({ ctx }) => {
      // RBAC: protectedProcedure middleware가 이미 인증을 확인했으므로
      // 추가 검증이 필요 없음 (필터는 사용자별로 자동 격리됨)

      const savedFilters = await ctx.db.savedFilter.findMany({
        where: {
          userId: ctx.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          filters: true,
          createdAt: true,
        },
      });

      return {
        filters: savedFilters.map((filter) => ({
          ...filter,
          filters: filter.filters as FundFlowFilters, // Json → FundFlowFilters 변환
        })),
        totalFilters: savedFilters.length,
      };
    }),

  /**
   * Story 5.5: 저장된 필터 삭제 (Delete Saved Filter)
   *
   * 저장된 필터를 삭제
   */
  deleteSavedFilter: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // RBAC: protectedProcedure middleware가 이미 인증을 확인했으므로
      // 추가 검증이 필요 없음 (필터는 사용자별로 자동 격리됨)

      // 먼저 필터가 현재 사용자의 것인지 확인
      const filter = await ctx.db.savedFilter.findUnique({
        where: { id: input.id },
      });

      if (!filter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "필터를 찾을 수 없습니다.",
        });
      }

      if (filter.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "필터 삭제 권한이 없습니다.",
        });
      }

      // 삭제
      await ctx.db.savedFilter.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Story 5.6: 자금 흐름 추적 결과 내보내기 (Export Fund Flow Result)
   *
   * 추적 결과를 엑셀 파일(.xlsx)로 내보내기
   *
   * Story 5.6 Acceptance Criteria:
   * - AC1: 내보내기 옵션 모달 표시 (체인 전체/필터링/선택)
   * - AC2: 엑셀 파일 생성 (.xlsx, UTF-8, 한글 지원)
   * - AC3: 엑셀 시트 구성 (요약, 거래 상세, 체인, 시각화)
   * - AC4: 다운로드 및 피드백
   * - AC5: 셀 서식 적용 (헤더 스타일, 날짜/금액 형식)
   */
  exportFundFlowResult: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        chainIds: z.array(z.string().uuid()).optional(), // 선택된 체인 ID 목록
        exportOption: z.enum(["all", "filtered", "selected"]), // 내보내기 옵션
        includeVisualization: z.boolean().default(false), // 시각화 이미지 포함
        filters: fundFlowFiltersSchema.optional(), // 필터링된 결과 내보내기용 필터
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, chainIds, exportOption, includeVisualization, filters } = input;

      // Story 7.4: Epic 7 패턴 - 에러 처리 개선 (Story 7.2 Task 7.10 패턴 재사용)
      try {
        // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
        // 추가 검증이 필요 없음 (canAccessCase helper 사용)

      const {
        createWorkbook,
        createWorksheetWithHeaders,
        addDataRow,
        autoFitColumns,
        writeExcelBuffer,
        formatTags,
        formatTransactionNature,
        formatConfidence,
        formatAmount,
        formatDate,
      } = await import("~/lib/export/excel");

      // 엑셀 워크북 생성
      const workbook = createWorkbook();

      // 사건 정보 조회 (요약 시트용)
      const caseInfo = await ctx.db.case.findUnique({
        where: { id: caseId },
        select: {
          caseNumber: true,
          debtorName: true,
          courtName: true,
        },
      });

      if (!caseInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      // 내보내기 옵션에 따라 체인 데이터 조회
      let chains: any[] = [];

      if (exportOption === "all") {
        // 체인 전체 내보내기: caseId로 모든 체인 조회
        chains = await ctx.db.transactionChain.findMany({
          where: { caseId },
          include: {
            startTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
              },
            },
            endTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
              },
            },
          },
        });
      } else if (exportOption === "selected" && chainIds) {
        // 선택된 체인들만 내보내기
        chains = await ctx.db.transactionChain.findMany({
          where: {
            id: { in: chainIds },
            caseId,
          },
          include: {
            startTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
              },
            },
            endTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
              },
            },
          },
        });
      } else if (exportOption === "filtered" && filters) {
        // 현재 필터링된 결과만 내보내기
        // 먼저 모든 체인을 조회한 후 필터 적용
        const allChains = await ctx.db.transactionChain.findMany({
          where: { caseId },
          include: {
            startTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
                importantTransaction: true,
              },
            },
            endTx: {
              select: {
                transactionDate: true,
                depositAmount: true,
                withdrawalAmount: true,
                memo: true,
                tags: { include: { tag: { select: { name: true } } } },
                transactionNature: true,
                importantTransaction: true,
              },
            },
          },
        });

        // 필터 적용 (체인의 시작/종료 거래에 필터 조건 적용)
        chains = allChains.filter((chain) => {
          if (!filters || Object.keys(filters).length === 0) return true;

          // 체인의 모든 관련 거래 수집
          const chainTransactions = [chain.startTx, chain.endTx];

          // 필터 적용
          let matches = true;

          // 날짜 범위 필터
          if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
            const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999));

            matches = chainTransactions.some((tx) => {
              const txDate = new Date(tx.transactionDate);
              return txDate >= startDate && txDate <= endDate;
            });
          }

          // 금액 범위 필터
          if (matches && filters.amountRange) {
            const { min, max } = filters.amountRange;
            matches = chainTransactions.some((tx) => {
              const amount =
                tx.depositAmount !== null
                  ? Number(tx.depositAmount)
                  : tx.withdrawalAmount !== null
                    ? Number(tx.withdrawalAmount)
                    : 0;
              return amount >= min && amount <= max;
            });
          }

          // 태그 필터 (OR 조건)
          if (matches && filters.tags && filters.tags.length > 0) {
            const tagSet = new Set(filters.tags);
            matches = chainTransactions.some((tx) =>
              tx.tags.some((tagRelation) => tagSet.has(tagRelation.tag.name))
            );
          }

          // 거래 성격 필터
          if (matches && filters.transactionNature && filters.transactionNature.length > 0) {
            const natureSet = new Set(filters.transactionNature);
            matches = chainTransactions.some((tx) => tx.transactionNature !== null && natureSet.has(tx.transactionNature));
          }

          // 중요 거래 필터
          if (matches && filters.importantOnly) {
            matches = chainTransactions.some((tx) => tx.importantTransaction === true);
          }

          return matches;
        });
      }

      // Story 7.4: Epic 7 패턴 - 파일 크기 검증 (Story 7.2 Task 7.4 패턴 재사용)
      const MAX_CHAINS = 1000; // 최대 1,000개 체인
      if (chains.length > MAX_CHAINS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `최대 ${MAX_CHAINS.toLocaleString()}개 체인까지만 내보낼 수 있습니다. 현재 ${chains.length.toLocaleString()}개 체인이 있습니다.`,
        });
      }

      // 1. 요약 시트 생성 (AC3)
      const summarySheet = createWorksheetWithHeaders(
        workbook,
        "요약",
        ["항목", "값"]
      );

      const summaryData = [
        { 항목: "사건번호", 값: caseInfo.caseNumber ?? "" },
        { 항목: "채무자명", 값: caseInfo.debtorName ?? "" },
        { 항목: "법원", 값: caseInfo.courtName ?? "" },
        { 항목: "내보내기 날짜", 값: formatDate(new Date()) },
        { 항목: "총 체인 수", 값: chains.length },
        { 항목: "UPSTREAM 체인", 값: chains.filter((c) => c.chainType === "UPSTREAM").length },
        { 항목: "DOWNSTREAM 체인", 값: chains.filter((c) => c.chainType === "DOWNSTREAM").length },
      ];

      addDataRow(summarySheet, summaryData);
      autoFitColumns(summarySheet);

      // 2. 체인 시트 생성 (AC3)
      const chainSheet = createWorksheetWithHeaders(
        workbook,
        "체인",
        ["체인ID", "체인유형", "깊이", "시작거래날짜", "종료거래날짜", "관련거래수"]
      );

      const chainData = chains.map((chain) => ({
        체인ID: chain.id,
        체인유형: chain.chainType,
        깊이: chain.chainDepth,
        시작거래날짜: chain.startTx.transactionDate,
        종료거래날짜: chain.endTx.transactionDate,
        관련거래수: chain.path.split(",").length,
      }));

      addDataRow(chainSheet, chainData);
      autoFitColumns(chainSheet);

      // 3. 거래 상세 시트 생성 (AC3)
      const transactionSheet = createWorksheetWithHeaders(
        workbook,
        "거래 상세",
        ["체인ID", "거래ID", "날짜", "입금액", "출금액", "메모", "태그", "거래성격"]
      );

      // MEDIUM #1: N+1 Query 최적화 - 서비스 분리
      // 1. 모든 chain.path에서 트랜잭션 ID 수집
      const chainTxIds = new Map<string, string[]>(); // chainId -> txIds[]
      for (const chain of chains) {
        const txIds = chain.path
          .split(",")
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0);
        if (txIds.length > 0) {
          chainTxIds.set(chain.id, txIds);
        }
      }

      // 2. 단일 DB 쿼리로 모든 트랜잭션 로드
      const allTxIds = Array.from(chainTxIds.values()).flat();
      const allTransactions = await ctx.db.transaction.findMany({
        where: {
          id: { in: allTxIds },
        },
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          memo: true,
          tags: { include: { tag: { select: { name: true } } } },
          transactionNature: true,
          importantTransaction: true,
        },
      });

      // 3. 트랜잭션 Map 생성
      const txMap = new Map(allTransactions.map((tx) => [tx.id, tx]));

      // 4. ExcelExportService 사용 (MEDIUM #1: 서비스 분리 완료)
      const { excelExportService } = await import("~/server/services/excel-export-service");
      const buffer = await excelExportService.generateFundFlowExcel(
        {
          caseNumber: caseInfo.caseNumber,
          debtorName: caseInfo.debtorName,
          courtName: caseInfo.courtName,
        },
        chains,
        txMap,
        includeVisualization
      );

      // CRITICAL #1: Buffer를 Base64로 인코딩하여 tRPC JSON 직렬화 가능하게 변환
      const base64Data = buffer.toString('base64');

      // 파일명 생성: "자금흐름추적_[사건번호]_[날짜].xlsx"
      const caseNumber = (caseInfo.caseNumber ?? "unknown").replace(/[^a-zA-Z0-9가-힣]/g, "_");
      const dateStr = formatDate(new Date()).replace(/-/g, "");
      const filename = `자금흐름추적_${caseNumber}_${dateStr}.xlsx`;

      // MIME 타입
      const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      // Story 7.4: Epic 7 패턴 - 감사 로그 추가 (Story 7.2 Subtask 3.3 패턴 재사용)
      // CRITICAL #4 수정: ctx.db 사용하여 세션과 일관성 유지
      await auditLog.create({
        db: ctx.db,
        action: "EXPORT_FUND_FLOW",
        userId: ctx.userId,
        caseId,
        entityType: "CASE",
        details: {
          exportType: exportOption,
          chainCount: chains.length,
          filename,
          filters,
        },
      });

      return {
        data: base64Data,  // Base64 인코딩된 문자열
        filename,
        mimeType,
        success: true,
      };
      } catch (error) {
        // Story 7.4: Epic 7 패턴 - 에러 처리 개선 (Story 7.2 Task 7.10 패턴 재사용)
        console.error("Fund flow export error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "자금 흐름 추적 결과 내보내기 중 오류가 발생했습니다. 다시 시도해주세요.",
        });
      }
    }),
});
