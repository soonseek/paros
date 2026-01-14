/**
 * Transaction Chain Router (Story 5.3)
 *
 * 거래 체인 식별 및 조회를 위한 tRPC 라우터
 *
 * Stories:
 * - 5.3: 거래 체인 식별 (Transaction Chain Identification)
 *
 * @module server/api/routers/transactionChain
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  caseAccessProcedure,
} from "~/server/api/trpc";
import {
  identifyTransactionChains,
  ChainType,
} from "../../services/transaction-chain-service";
import {
  transformChainsToNodes,
  transformRelationsToEdges,
  type GraphNode,
  type GraphEdge,
} from "../../services/graph-data-service";

/**
 * Story 5.3: 거래 체인 식별 및 관리 라우터
 */
export const transactionChainRouter = createTRPCRouter({
  /**
   * 체인 식별 트리거 (Story 5.3, AC1, AC2)
   *
   * Acceptance Criteria:
   * - AC1: TransactionRelation 테이블에서 연관된 거래 체인 식별
   * - AC2: TransactionChain 테이블에 체인 정보 저장
   *
   * 패턴:
   * - LOAN_EXECUTION: 대출 실행(입금) → 이체(출금) → 담보제공(출금)
   * - DEBT_SETTLEMENT: 변제(출금) → 출처(입금) → 정산(입금)
   * - COLLATERAL_RIGHT: 담보권 설정(출금) → 유입(입금) → 해지(출금)
   */
  identifyChains: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        minConfidence: z.number().min(0).max(1).default(0.6), // AC4: 최소 신뢰도 (기본값: 0.6)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, minConfidence } = input;

      // 체인 식별 서비스 호출
      const startTime = performance.now();
      const chains = await identifyTransactionChains({
        db: ctx.db,
        caseId,
        minConfidence,
      });
      const endTime = performance.now();

      // 성능 모니터링
      const responseTime = endTime - startTime;
      if (responseTime > 30000) {
        // 아키텍처 요구사항: 최대 30초
        console.warn(
          `[TransactionChain] identifyChains 성능 경고: ${responseTime.toFixed(2)}ms (30초 초과)`
        );
      }

      // AC4: confidenceScore < 0.6인 체인 경고 메시지
      const lowConfidenceChains = chains.filter(
        (c) => c.confidenceScore < 0.6
      );

      return {
        success: true,
        chainsIdentified: chains.length,
        chains,
        lowConfidenceChains: lowConfidenceChains.length,
        responseTimeMs: Math.round(responseTime),
      };
    }),

  /**
   * 저장된 체인 조회 (Story 5.3, AC3)
   *
   * Acceptance Criteria:
   * - AC3: caseId로 필터링된 체인 목록 반환
   * - chainType별 필터링 지원
   * - 체인에 포함된 거래 정보 포함 (include: startTx, endTx)
   */
  getTransactionChains: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        chainType: z
          .enum([
            "LOAN_EXECUTION",
            "DEBT_SETTLEMENT",
            "COLLATERAL_RIGHT",
            "UPSTREAM",
            "DOWNSTREAM",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, chainType } = input;

      // 체인 조회 (관련 거래 정보 포함)
      const chains = await ctx.db.transactionChain.findMany({
        where: {
          caseId,
          chainType,
        },
        include: {
          startTx: {
            select: {
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
          endTx: {
            select: {
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
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
   * 특정 체인 상세 조회 (Story 5.3, AC3)
   *
   * Acceptance Criteria:
   * - AC3: 체인에 포함된 모든 거래들이 순서대로 표시
   */
  getChainDetail: caseAccessProcedure
    .input(
      z.object({
        chainId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { chainId } = input;

      // 체인 조회
      const chain = await ctx.db.transactionChain.findUnique({
        where: { id: chainId },
        include: {
          startTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
          endTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
        },
      });

      if (!chain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "체인을 찾을 수 없습니다.",
        });
      }

      // RBAC: caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음

      // path CSV를 배열로 변환
      const transactionIds = chain.path.split(",");

      // 체인에 포함된 모든 거래 조회 (순서대로)
      const transactions = await ctx.db.transaction.findMany({
        where: {
          id: { in: transactionIds },
        },
        select: {
          id: true,
          transactionDate: true,
          depositAmount: true,
          withdrawalAmount: true,
          memo: true,
          category: true,
          creditorName: true,
        },
      });

      // 원래 순서대로 정렬
      const orderedTransactions = transactionIds
        .map((id) => transactions.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);

      return {
        chain,
        transactions: orderedTransactions,
      };
    }),

  /**
   * 체인 삭제 (Story 5.3)
   *
   * 잘못 식별된 체인을 삭제
   */
  deleteChain: caseAccessProcedure
    .input(
      z.object({
        chainId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { chainId } = input;

      // 체인 조회 (RBAC 검증용)
      const chain = await ctx.db.transactionChain.findUnique({
        where: { id: chainId },
        select: { caseId: true },
      });

      if (!chain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "체인을 찾을 수 없습니다.",
        });
      }

      // caseAccessProcedure middleware가 이미 접근 권한을 확인했으므로
      // 추가 검증이 필요 없음

      // 체인 삭제
      await ctx.db.transactionChain.delete({
        where: { id: chainId },
      });

      return { success: true };
    }),

  /**
   * 그래프 시각화 데이터 조회 (Story 5.4, Task 5)
   *
   * Acceptance Criteria:
   * - AC1: caseId로 필터링된 체인과 관계를 React Flow 형식으로 반환
   * - AC4: chainType별 필터링 지원
   *
   * 반환 데이터:
   * - nodes: React Flow Node[] (체인 기반)
   * - edges: React Flow Edge[] (관계 기반)
   */
  getVisualizationData: caseAccessProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        chainType: z
          .enum([
            "LOAN_EXECUTION",
            "DEBT_SETTLEMENT",
            "COLLATERAL_RIGHT",
            "UPSTREAM",
            "DOWNSTREAM",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId, chainType } = input;

      // 체인 조회 (관련 거래 정보 포함)
      const chains = await ctx.db.transactionChain.findMany({
        where: {
          caseId,
          chainType,
        },
        include: {
          startTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
          endTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
        },
        orderBy: {
          chainDepth: "desc",
        },
      });

      // 관계 조회 (엣지용)
      const chainIds = chains.map((c) => c.id);

      // 체인에 포함된 트랜잭션 ID 추출
      const transactionIds = new Set<string>();
      chains.forEach((chain) => {
        const ids = chain.path.split(",");
        ids.forEach((id) => transactionIds.add(id));
      });

      // 해당 트랜잭션 간의 관계 조회
      const relations = await ctx.db.transactionRelation.findMany({
        where: {
          caseId,
          sourceTxId: { in: Array.from(transactionIds) },
          targetTxId: { in: Array.from(transactionIds) },
        },
        include: {
          sourceTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
          targetTx: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
              category: true,
              creditorName: true,
            },
          },
        },
      });

      // 그래프 데이터 변환
      const nodes: GraphNode[] = transformChainsToNodes(chains);
      const edges: GraphEdge[] = transformRelationsToEdges(relations);

      return {
        nodes,
        edges,
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          chainCount: chains.length,
        },
      };
    }),
});
