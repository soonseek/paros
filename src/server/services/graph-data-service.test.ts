/**
 * Graph Data Service Tests (Story 5.4)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  transformChainsToNodes,
  transformRelationsToEdges,
  getChainTypeColor,
  type GraphNode,
  type GraphEdge,
} from "./graph-data-service";

describe("Graph Data Service", () => {
  describe("transformChainsToNodes", () => {
    it("should transform TransactionChain to GraphNode", () => {
      const mockChain = {
        id: "chain-1",
        startTxId: "tx-1",
        endTxId: "tx-2",
        chainType: "LOAN_EXECUTION",
        chainDepth: 2,
        path: "tx-1,tx-2",
        totalAmount: 1000000,
        startTx: {
          id: "tx-1",
          transactionDate: new Date("2024-01-15"),
          depositAmount: 1000000,
          withdrawalAmount: null,
          memo: "대금 입금",
          category: "입금",
          creditorName: null,
        },
        endTx: {
          id: "tx-2",
          transactionDate: new Date("2024-01-16"),
          depositAmount: null,
          withdrawalAmount: 1000000,
          memo: "이체",
          category: "이체",
          creditorName: null,
        },
      };

      const result = transformChainsToNodes([mockChain]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("chain-1");
      expect(result[0].type).toBe("default");
      expect(result[0].position).toEqual({ x: 0, y: 0 });
      expect(result[0].style?.background).toBe("#dbeafe"); // LOAN_EXECUTION color
      expect(result[0].data.memo).toBe("대금 입금");
      expect(result[0].data.amount).toBe(1000000);
      expect(result[0].data.transactionDate).toEqual(new Date("2024-01-15"));
    });

    it("should handle multiple chains", () => {
      const mockChains = [
        {
          id: "chain-1",
          startTxId: "tx-1",
          endTxId: "tx-2",
          chainType: "LOAN_EXECUTION",
          chainDepth: 2,
          path: "tx-1,tx-2",
          totalAmount: 1000000,
          startTx: {
            id: "tx-1",
            transactionDate: new Date("2024-01-15"),
            depositAmount: 1000000,
            withdrawalAmount: null,
            memo: "대금 입금",
            category: "입금",
            creditorName: null,
          },
          endTx: {
            id: "tx-2",
            transactionDate: new Date("2024-01-16"),
            depositAmount: null,
            withdrawalAmount: 1000000,
            memo: "이체",
            category: "이체",
            creditorName: null,
          },
        },
        {
          id: "chain-2",
          startTxId: "tx-3",
          endTxId: "tx-4",
          chainType: "DEBT_SETTLEMENT",
          chainDepth: 1,
          path: "tx-3,tx-4",
          totalAmount: 500000,
          startTx: {
            id: "tx-3",
            transactionDate: new Date("2024-01-17"),
            depositAmount: null,
            withdrawalAmount: 500000,
            memo: "변제",
            category: "출금",
            creditorName: null,
          },
          endTx: {
            id: "tx-4",
            transactionDate: new Date("2024-01-18"),
            depositAmount: 500000,
            withdrawalAmount: null,
            memo: "입금",
            category: "입금",
            creditorName: null,
          },
        },
      ];

      const result = transformChainsToNodes(mockChains);

      expect(result).toHaveLength(2);
      expect(result[0].style?.background).toBe("#dbeafe"); // LOAN_EXECUTION
      expect(result[1].style?.background).toBe("#fee2e2"); // DEBT_SETTLEMENT
    });

    it("should handle null amounts", () => {
      const mockChain = {
        id: "chain-1",
        startTxId: "tx-1",
        endTxId: "tx-2",
        chainType: "UPSTREAM",
        chainDepth: 1,
        path: "tx-1,tx-2",
        totalAmount: null,
        startTx: {
          id: "tx-1",
          transactionDate: new Date("2024-01-15"),
          depositAmount: null,
          withdrawalAmount: null,
          memo: "거래",
          category: "기타",
          creditorName: null,
        },
        endTx: {
          id: "tx-2",
          transactionDate: new Date("2024-01-16"),
          depositAmount: null,
          withdrawalAmount: null,
          memo: "거래",
          category: "기타",
          creditorName: null,
        },
      };

      const result = transformChainsToNodes([mockChain]);

      expect(result).toHaveLength(1);
      expect(result[0].style?.background).toBe("#dcfce7"); // UPSTREAM
      expect(result[0].data.amount).toBe(0);
    });
  });

  describe("transformRelationsToEdges", () => {
    it("should transform TransactionRelation to GraphEdge", () => {
      const mockRelation = {
        id: "rel-1",
        caseId: "case-1",
        sourceTxId: "tx-1",
        targetTxId: "tx-2",
        relationType: "DIRECT_TRANSFER",
        confidence: 0.9,
        matchReason: "금액 일치",
        distance: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceTx: {
          id: "tx-1",
          transactionDate: new Date("2024-01-15"),
          depositAmount: 1000000,
          withdrawalAmount: null,
          memo: "입금",
          category: "입금",
          creditorName: null,
        },
        targetTx: {
          id: "tx-2",
          transactionDate: new Date("2024-01-16"),
          depositAmount: null,
          withdrawalAmount: 1000000,
          memo: "출금",
          category: "출금",
          creditorName: null,
        },
      };

      const result = transformRelationsToEdges([mockRelation]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rel-1");
      expect(result[0].source).toBe("tx-1");
      expect(result[0].target).toBe("tx-2");
      expect(result[0].label).toBe("90%"); // confidence displayed as percentage
      expect(result[0].markerEnd).toBe("arrowclosed");
    });

    it("should handle multiple relations", () => {
      const mockRelations = [
        {
          id: "rel-1",
          caseId: "case-1",
          sourceTxId: "tx-1",
          targetTxId: "tx-2",
          relationType: "DIRECT_TRANSFER",
          confidence: 0.9,
          matchReason: "금액 일치",
          distance: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          sourceTx: {
            id: "tx-1",
            transactionDate: new Date("2024-01-15"),
            depositAmount: 1000000,
            withdrawalAmount: null,
            memo: "입금",
            category: "입금",
            creditorName: null,
          },
          targetTx: {
            id: "tx-2",
            transactionDate: new Date("2024-01-16"),
            depositAmount: null,
            withdrawalAmount: 1000000,
            memo: "출금",
            category: "출금",
            creditorName: null,
          },
        },
        {
          id: "rel-2",
          caseId: "case-1",
          sourceTxId: "tx-2",
          targetTxId: "tx-3",
          relationType: "DIRECT_TRANSFER",
          confidence: 0.85,
          matchReason: "날짜 근접",
          distance: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          sourceTx: {
            id: "tx-2",
            transactionDate: new Date("2024-01-16"),
            depositAmount: null,
            withdrawalAmount: 1000000,
            memo: "출금",
            category: "출금",
            creditorName: null,
          },
          targetTx: {
            id: "tx-3",
            transactionDate: new Date("2024-01-17"),
            depositAmount: 500000,
            withdrawalAmount: null,
            memo: "입금",
            category: "입금",
            creditorName: null,
          },
        },
      ];

      const result = transformRelationsToEdges(mockRelations);

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("90%");
      expect(result[1].label).toBe("85%");
    });
  });

  describe("getChainTypeColor", () => {
    it("should return correct colors for each chain type", () => {
      expect(getChainTypeColor("LOAN_EXECUTION")).toBe("#dbeafe"); // 파랑
      expect(getChainTypeColor("DEBT_SETTLEMENT")).toBe("#fee2e2"); // 빨강
      expect(getChainTypeColor("COLLATERAL_RIGHT")).toBe("#fef3c7"); // 노랑
      expect(getChainTypeColor("UPSTREAM")).toBe("#dcfce7"); // 초록
      expect(getChainTypeColor("DOWNSTREAM")).toBe("#e0f2fe"); // 하늘
    });

    it("should return gray for unknown chain types", () => {
      expect(getChainTypeColor("UNKNOWN" as any)).toBe("#f3f4f6");
    });
  });
});
