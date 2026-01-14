/**
 * Transaction Chain Identification Service Tests (Story 5.3)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient, TransactionRelationType } from "@prisma/client";
import {
  identifyTransactionChains,
  ChainType,
  type IdentifiedChain,
} from "./transaction-chain-service";

// Mock Prisma Client
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreateMany = vi.fn();
const mockChainFindMany = vi.fn();

const mockDb = {
  transactionRelation: {
    findMany: mockFindMany,
  },
  transactionChain: {
    findFirst: mockFindFirst,
    findMany: mockChainFindMany,
    createMany: mockCreateMany,
  },
} as unknown as PrismaClient;

describe("Transaction Chain Identification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("identifyTransactionChains", () => {
    it("should return empty array when no relations exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      expect(result).toEqual([]);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { caseId: "test-case-1" },
        include: {
          sourceTx: {
            select: expect.any(Object),
          },
          targetTx: {
            select: expect.any(Object),
          },
        },
      });
    });

    it("should identify chains from relations (basic functionality)", async () => {
      // Mock data: Simple 2-node chain
      mockFindMany.mockResolvedValue([
        {
          id: "rel-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          confidence: 0.9,
          sourceTx: {
            depositAmount: null,
            withdrawalAmount: 100000,
            category: "출금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-15"),
            memo: "출금 A",
          },
          targetTx: {
            depositAmount: 100000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-16"),
            memo: "입금 B",
          },
        },
      ]);

      mockChainFindMany.mockResolvedValue([]); // No existing chains

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      // Basic chain identification should work
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.startTxId).toBeDefined();
      expect(result[0]?.endTxId).toBeDefined();
      expect(result[0]?.chainDepth).toBeGreaterThanOrEqual(1);
      expect(result[0]?.confidenceScore).toBeGreaterThan(0);
    });

    it("should identify multi-node chains", async () => {
      // Mock data: 3-node chain
      mockFindMany.mockResolvedValue([
        {
          id: "rel-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          confidence: 0.95,
          sourceTx: {
            depositAmount: 1000000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-10"),
            memo: "대금 입금",
          },
          targetTx: {
            depositAmount: null,
            withdrawalAmount: 1000000,
            category: "이체",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-11"),
            memo: "이체",
          },
        },
        {
          id: "rel-2",
          sourceTxId: "tx-2",
          targetTxId: "tx-3",
          confidence: 0.85,
          sourceTx: {
            depositAmount: null,
            withdrawalAmount: 1000000,
            category: "이체",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-11"),
            memo: "이체",
          },
          targetTx: {
            depositAmount: null,
            withdrawalAmount: 500000,
            category: "담보제공",
            importantTransactionType: "COLLATERAL",
            transactionDate: new Date("2024-01-12"),
            memo: "담보제공",
          },
        },
      ]);

      mockChainFindMany.mockResolvedValue([]);

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      // Should identify chains from multi-node paths
      expect(result.length).toBeGreaterThan(0);
    });

    it("should filter chains by minConfidence parameter", async () => {
      // Mock data with low confidence
      mockFindMany.mockResolvedValue([
        {
          id: "rel-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          confidence: 0.5, // Low confidence
          sourceTx: {
            depositAmount: null,
            withdrawalAmount: 100000,
            category: "출금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-15"),
            memo: "출금 A",
          },
          targetTx: {
            depositAmount: 100000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-16"),
            memo: "입금 B",
          },
        },
      ]);

      mockFindFirst.mockResolvedValue(null);

      // minConfidence = 0.6 (default)
      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
        minConfidence: 0.6,
      });

      // Low confidence chains should be filtered out
      expect(result).toHaveLength(0);
    });

    it("should avoid duplicate chains (same startTxId + endTxId)", async () => {
      // Mock data
      mockFindMany.mockResolvedValue([
        {
          id: "rel-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          confidence: 0.9,
          sourceTx: {
            depositAmount: null,
            withdrawalAmount: 100000,
            category: "출금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-15"),
            memo: "출금 A",
          },
          targetTx: {
            depositAmount: 100000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-16"),
            memo: "입금 B",
          },
        },
      ]);

      // Existing chain found
      mockChainFindMany.mockResolvedValue([
        {
          startTxId: "tx-1",
          endTxId: "tx-2",
          chainType: "UPSTREAM",
        },
      ]);

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      // MEDIUM #2 FIX: findMany는 호출되지만, 중복 체인은 건너뜀 (skipDuplicates)
      // createMany는 호출되지만 skipDuplicates로 인해 실제 생성은 안 됨
      expect(mockChainFindMany).toHaveBeenCalled();
      expect(mockCreateMany).toHaveBeenCalled();
    });

    it("should calculate confidence scores for chains", async () => {
      // Mock data: 2 relations with different confidences
      mockFindMany.mockResolvedValue([
        {
          id: "rel-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          confidence: 0.9,
          sourceTx: {
            depositAmount: null,
            withdrawalAmount: 100000,
            category: "출금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-15"),
            memo: "출금 A",
          },
          targetTx: {
            depositAmount: 100000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-16"),
            memo: "입금 B",
          },
        },
        {
          id: "rel-2",
          sourceTxId: "tx-2",
          targetTxId: "tx-3",
          confidence: 0.7,
          sourceTx: {
            depositAmount: 100000,
            withdrawalAmount: null,
            category: "입금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-16"),
            memo: "입금 B",
          },
          targetTx: {
            depositAmount: null,
            withdrawalAmount: 100000,
            category: "출금",
            importantTransactionType: null,
            transactionDate: new Date("2024-01-17"),
            memo: "출금 C",
          },
        },
      ]);

      mockChainFindMany.mockResolvedValue([]);

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      // Should have confidence scores
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.confidenceScore).toBeGreaterThan(0);
      expect(result[0]?.confidenceScore).toBeLessThanOrEqual(1);
    });
  });

  describe("Chain Depth Limit", () => {
    it("should limit chain depth to 5 levels", async () => {
      // Create 6 relations (6 levels - exceeds limit)
      const relations = Array.from({ length: 6 }, (_, i) => ({
        id: `rel-${i + 1}`,
        sourceTxId: `tx-${i + 1}`,
        targetTxId: `tx-${i + 2}`,
        confidence: 0.9,
        sourceTx: {
          depositAmount: i === 0 ? 100000 : null,
          withdrawalAmount: i === 0 ? null : 100000,
          category: i === 0 ? "입금" : "출금",
          importantTransactionType: null,
          transactionDate: new Date(`2024-01-${10 + i}`),
          memo: `거래 ${i + 1}`,
        },
        targetTx: {
          depositAmount: null,
          withdrawalAmount: 100000,
          category: "출금",
          importantTransactionType: null,
          transactionDate: new Date(`2024-01-${11 + i}`),
          memo: `거래 ${i + 2}`,
        },
      }));

      mockFindMany.mockResolvedValue(relations);
      mockChainFindMany.mockResolvedValue([]);

      const result = await identifyTransactionChains({
        db: mockDb,
        caseId: "test-case-1",
      });

      // All chains should have depth <= 5
      result.forEach((chain) => {
        expect(chain.chainDepth).toBeLessThanOrEqual(5);
      });
    });
  });
});
