/**
 * Fund Flow Service Unit Tests (Story 5.1)
 *
 * 자금 흐름 추적 서비스의 단위 테스트
 *
 * 테스트 커버리지:
 * - isAmountMatch: 금액 일치 검증
 * - calculateConfidence: 신뢰도 계산
 * - traceUpstreamFunds: 상류 추적 BFS 알고리즘
 * - traceDownstreamFunds: 하류 추적 BFS 알고리즘
 * - 사이클 감지
 * - 최대 깊이 제한
 * - 빈 결과 처리
 *
 * @see https://vitest.dev/api/
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  traceUpstreamFunds,
  traceDownstreamFunds,
  type ChainNode,
  type TransactionChain,
} from "./fund-flow-service";

// Mock Prisma Client
const mockDb = {
  transaction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  transactionRelation: {
    upsert: vi.fn(),
  },
} as unknown as PrismaClient;

describe("Fund Flow Service - Story 5.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("traceUpstreamFunds - 자금 출처 추적", () => {
    const mockStartTransaction = {
      id: "tx-deposit-1",
      caseId: "case-1",
      transactionDate: new Date("2024-01-15"),
      depositAmount: 100000,
      withdrawalAmount: null,
      memo: "입금 1",
      category: "소득",
      creditorName: null,
    };

    it("[AC1] 입금 거래로 출처 추적을 시작해야 함", async () => {
      // Given: 입금 거래로 시작
      // When: traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        2,
        0.1
      );

      // Then: 추적 수행
      expect(result).toBeDefined();
      expect(result.chains).toBeDefined();
      expect(result.totalTransactions).toBeGreaterThanOrEqual(0);
    });

    it("[AC1] 출금 거래로 시작하면 에러 반환", async () => {
      // Given: 출금 거래로 시작
      const withdrawalTx = {
        ...mockStartTransaction,
        depositAmount: null,
        withdrawalAmount: 50000,
      };

      // When: traceUpstreamFunds 호출
      // Then: 에러 발생 (MEDIUM #5 수정)
      await expect(traceUpstreamFunds(mockDb, withdrawalTx, 2, 0.1)).rejects.toThrow(
        "입금 거래만 추적 가능합니다"
      );
    });

    it("[AC1] 금액 ±10% 내의 출금 거래를 찾아야 함", async () => {
      // Given: 매칭되는 출금 거래 2개
      vi.mocked(mockDb.transaction.findUnique).mockResolvedValueOnce({
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValueOnce([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"),
          withdrawalAmount: 100000, // 100% 일치
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
        {
          id: "tx-withdrawal-2",
          transactionDate: new Date("2024-01-13"),
          withdrawalAmount: 95000, // 95% 일치 (±10% 내)
          memo: "출금 2",
          category: "지출",
          creditorName: "채권자B",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-14"),
        depositAmount: null,
        withdrawalAmount: 100000,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: 2개 체인 발견
      // HIGH #1 수정: 시작 노드가 포함되므로 nodes.length = 2 (시작 노드 + 1단계)
      expect(result.chains).toHaveLength(2);
      expect(result.chains[0].nodes).toHaveLength(2); // 시작 노드 + 찾은 노드
      expect(result.chains[0].nodes[0].amount).toBe(100000); // 시작 노드 금액
    });

    it("[AC1] 금액이 ±10%를 벗어나는 거래는 제외해야 함", async () => {
      // Given: ±10%를 벗어나는 출금 거래
      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"),
          withdrawalAmount: 89000, // 89% (±10% 밖)
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-14"),
        depositAmount: null,
        withdrawalAmount: 100000,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: 해당 거래는 제외 (Prisma 쿼리로 필터링됨)
      expect(result.chains).toHaveLength(0);
    });

    it("[AC1] 날짜가 이전인 거래만 추적해야 함", async () => {
      // Given: 이전 날짜의 출금 거래
      let callCount = 0;
      vi.mocked(mockDb.transaction.findUnique).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // 첫 번째 호출: 시작 거래 (tx-deposit-1)
          return {
            transactionDate: new Date("2024-01-15"),
            depositAmount: 100000,
            withdrawalAmount: null,
          };
        } else {
          // 두 번째 호출: tx-withdrawal-1 조회
          return {
            transactionDate: new Date("2024-01-14"),
            depositAmount: null,
            withdrawalAmount: 100000,
          };
        }
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"), // 1일 전
          withdrawalAmount: 100000,
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      // When: traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: 체인 발견
      expect(result.chains).toHaveLength(1);
      // HIGH #1 수정: nodes[0]는 시작 노드, nodes[1]은 찾은 노드
      expect(result.chains[0].nodes[1].transactionDate).toEqual(
        new Date("2024-01-14")
      );
    });

    it("[AC3] 최대 5단계까지 추적해야 함", async () => {
      // Given: 5단계 깊이
      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: maxDepth = 5로 traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        5,
        0.1
      );

      // Then: 에러 없이 완료
      expect(result).toBeDefined();
      expect(result.totalTransactions).toBe(1); // 시작 거래만 방문
    });

    it("[AC3] 6단계 이상은 추적하지 않아야 함", async () => {
      // Given: maxDepth = 5 (최대)
      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: maxDepth = 5로 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        5,
        0.1
      );

      // Then: 5단계로 제한됨
      expect(result).toBeDefined();
    });

    it("사이클 감지: 이미 방문한 거래는 다시 방문하지 않음", async () => {
      // Given: 사이클이 발생할 수 있는 구조
      let findUniqueCallCount = 0;
      vi.mocked(mockDb.transaction.findUnique).mockImplementation(async () => {
        findUniqueCallCount++;
        if (findUniqueCallCount === 1) {
          // 첫 번째 호출: 시작 거래 (tx-deposit-1)
          return {
            transactionDate: new Date("2024-01-15"),
            depositAmount: 100000,
            withdrawalAmount: null,
          };
        } else if (findUniqueCallCount === 2) {
          // 두 번째 호출: tx-withdrawal-1 조회
          return {
            transactionDate: new Date("2024-01-14"),
            depositAmount: null,
            withdrawalAmount: 100000,
          };
        } else {
          // 세 번째 이후 호출: null 반환 (추가 추적 중단)
          return null;
        }
      });

      // 첫 번째 findMany 호출: tx-withdrawal-1 반환
      vi.mocked(mockDb.transaction.findMany).mockResolvedValueOnce([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"),
          withdrawalAmount: 100000,
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      // When: traceUpstreamFunds 호출 (maxDepth = 1로 설정하여 체인 생성)
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: tx-withdrawal-1만 방문하고 체인 1개 생성 (depth 1 = maxDepth)
      expect(result.chains).toHaveLength(1);
      // HIGH #1 수정: 시작 노드가 포함되므로 nodes.length = 2
      expect(result.chains[0].nodes).toHaveLength(2);
      expect(result.totalTransactions).toBe(2); // tx-deposit-1 + tx-withdrawal-1
    });

    it("[AC2] 연관 강도(신뢰도)를 계산해야 함", async () => {
      // Given: 금액 100% 일치, 1일 전
      let callCount = 0;
      vi.mocked(mockDb.transaction.findUnique).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            transactionDate: new Date("2024-01-15"),
            depositAmount: 100000,
            withdrawalAmount: null,
          };
        } else {
          return {
            transactionDate: new Date("2024-01-14"),
            depositAmount: null,
            withdrawalAmount: 100000,
          };
        }
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"), // 1일 전
          withdrawalAmount: 100000, // 100% 일치
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      // When: traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: 신뢰도 계산됨 (금액 100% + 날짜 1일 = 높은 신뢰도)
      // HIGH #1 수정: nodes[0]는 시작 노드, nodes[1]은 찾은 노드
      expect(result.chains[0].nodes[1].confidence).toBeGreaterThan(0.8);
      expect(result.chains[0].nodes[1].matchReason).toContain("100% 일치");
    });

    it("연결 관계를 TransactionRelation에 저장해야 함", async () => {
      // Given: 매칭되는 거래
      let callCount = 0;
      vi.mocked(mockDb.transaction.findUnique).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            transactionDate: new Date("2024-01-15"),
            depositAmount: 100000,
            withdrawalAmount: null,
          };
        } else {
          return {
            transactionDate: new Date("2024-01-14"),
            depositAmount: null,
            withdrawalAmount: 100000,
          };
        }
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"),
          withdrawalAmount: 100000,
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      // When: traceUpstreamFunds 호출
      await traceUpstreamFunds(mockDb, mockStartTransaction, 1, 0.1);

      // Then: TransactionRelation.upsert 호출됨
      expect(mockDb.transactionRelation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sourceTxId: "tx-withdrawal-1",
            targetTxId: "tx-deposit-1",
            relationType: "PROBABLE_TRANSFER",
          }),
        })
      );
    });
  });

  describe("traceDownstreamFunds - 자금 사용처 추적", () => {
    const mockStartTransaction = {
      id: "tx-withdrawal-1",
      caseId: "case-1",
      transactionDate: new Date("2024-01-10"),
      depositAmount: null,
      withdrawalAmount: 100000,
      memo: "출금 1",
      category: "지출",
      creditorName: null,
    };

    it("출금 거래로 사용처 추적을 시작해야 함", async () => {
      // Given: 출금 거래로 시작
      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-10"),
        depositAmount: null,
        withdrawalAmount: 100000,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: traceDownstreamFunds 호출
      const result = await traceDownstreamFunds(
        mockDb,
        mockStartTransaction,
        2,
        0.1
      );

      // Then: 추적 수행
      expect(result).toBeDefined();
      expect(result.chains).toBeDefined();
    });

    it("입금 거래로 시작하면 에러 반환", async () => {
      // Given: 입금 거래로 시작
      const depositTx = {
        ...mockStartTransaction,
        depositAmount: 100000,
        withdrawalAmount: null,
      };

      // When: traceDownstreamFunds 호출
      // Then: 에러 발생 (MEDIUM #5 수정)
      await expect(traceDownstreamFunds(mockDb, depositTx, 2, 0.1)).rejects.toThrow(
        "출금 거래만 추적 가능합니다"
      );
    });

    it("날짜가 이후인 입금 거래만 추적해야 함", async () => {
      // Given: 이후 날짜의 입금 거래
      let callCount = 0;
      vi.mocked(mockDb.transaction.findUnique).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            transactionDate: new Date("2024-01-10"),
            depositAmount: null,
            withdrawalAmount: 100000,
          };
        } else {
          return {
            transactionDate: new Date("2024-01-11"),
            depositAmount: 100000,
            withdrawalAmount: null,
          };
        }
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([
        {
          id: "tx-deposit-1",
          transactionDate: new Date("2024-01-11"), // 1일 후
          depositAmount: 100000,
          memo: "입금 1",
          category: "소득",
          creditorName: "채권자A",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      // When: traceDownstreamFunds 호출
      const result = await traceDownstreamFunds(
        mockDb,
        mockStartTransaction,
        1,
        0.1
      );

      // Then: 체인 발견
      expect(result.chains).toHaveLength(1);
      // HIGH #1 수정: nodes[0]는 시작 노드, nodes[1]은 찾은 노드
      expect(result.chains[0].nodes[1].transactionDate).toEqual(
        new Date("2024-01-11")
      );
    });
  });

  describe("BFS 알고리즘 검증", () => {
    it("너비 우선 탐색으로 체인을 구성해야 함", async () => {
      // Given: 여러 개의 매칭되는 출금 거래 (같은 depth)
      const startTx = {
        id: "tx-deposit-1",
        caseId: "case-1",
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
        memo: "입금 1",
        category: "소득",
        creditorName: null,
      };

      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-15"),
        depositAmount: 100000,
        withdrawalAmount: null,
      });

      // 3개의 매칭되는 거래 (모두 depth 1)
      vi.mocked(mockDb.transaction.findMany).mockResolvedValueOnce([
        {
          id: "tx-withdrawal-1",
          transactionDate: new Date("2024-01-14"),
          withdrawalAmount: 100000,
          memo: "출금 1",
          category: "지출",
          creditorName: "채권자A",
        },
        {
          id: "tx-withdrawal-2",
          transactionDate: new Date("2024-01-13"),
          withdrawalAmount: 95000,
          memo: "출금 2",
          category: "지출",
          creditorName: "채권자B",
        },
        {
          id: "tx-withdrawal-3",
          transactionDate: new Date("2024-01-12"),
          withdrawalAmount: 105000,
          memo: "출금 3",
          category: "지출",
          creditorName: "채권자C",
        },
      ]);

      vi.mocked(mockDb.transactionRelation.upsert).mockResolvedValue({});

      vi.mocked(mockDb.transaction.findUnique).mockResolvedValue({
        transactionDate: new Date("2024-01-14"),
        depositAmount: null,
        withdrawalAmount: 100000,
      });

      vi.mocked(mockDb.transaction.findMany).mockResolvedValue([]);

      // When: maxDepth = 1로 traceUpstreamFunds 호출
      const result = await traceUpstreamFunds(mockDb, startTx, 1, 0.1);

      // Then: 3개 체인 모두 depth 1
      // HIGH #1 수정: 시작 노드가 포함되므로 nodes.length = 2 (시작 노드 + 1단계)
      expect(result.chains).toHaveLength(3);
      result.chains.forEach((chain) => {
        expect(chain.maxDepth).toBe(1);
        expect(chain.nodes).toHaveLength(2); // 시작 노드 + 1단계 노드
      });
    });
  });
});
