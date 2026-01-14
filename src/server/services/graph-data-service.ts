/**
 * Graph Data Service (Story 5.4)
 *
 * TransactionChain과 TransactionRelation을 React Flow 형식의 그래프 데이터로 변환
 *
 * @module server/services/graph-data-service
 */

import type { Node, Edge } from "@xyflow/react";
import type { MarkerType } from "@xyflow/react";
import type { TransactionChain, TransactionRelation } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

/**
 * React Flow Node 타입 (Graph 데이터용)
 */
export interface GraphNode extends Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    chainId?: string;
    transactionId?: string;
    memo: string;
    amount: number;
    transactionDate: Date;
    creditorName?: string | null;
  };
  style?: {
    background: string;
    border: string;
    borderRadius: string;
    width: number;
  };
}

/**
 * React Flow Edge 타입 (Graph 데이터용)
 */
export interface GraphEdge extends Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  markerEnd?: MarkerType | undefined;
  style?: {
    strokeWidth?: number;
  };
}

/**
 * Prisma TransactionChain with relations
 */
export type TransactionChainWithRelations = TransactionChain & {
  startTx: {
    id: string;
    transactionDate: Date;
    depositAmount: Decimal | null;
    withdrawalAmount: Decimal | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  };
  endTx: {
    id: string;
    transactionDate: Date;
    depositAmount: Decimal | null;
    withdrawalAmount: Decimal | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  };
};

/**
 * Prisma TransactionRelation with relations
 */
export type TransactionRelationWithRelations = TransactionRelation & {
  sourceTx: {
    id: string;
    transactionDate: Date;
    depositAmount: Decimal | null;
    withdrawalAmount: Decimal | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  };
  targetTx: {
    id: string;
    transactionDate: Date;
    depositAmount: Decimal | null;
    withdrawalAmount: Decimal | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  };
};

/**
 * 체인 유형별 색상 매핑 (Story 5.4, Dev Notes)
 *
 * @param chainType - 체인 유형
 * @returns CSS 색상 코드
 */
export function getChainTypeColor(chainType: string): string {
  switch (chainType) {
    case "LOAN_EXECUTION":
      return "#dbeafe"; // 파랑
    case "DEBT_SETTLEMENT":
      return "#fee2e2"; // 빨강
    case "COLLATERAL_RIGHT":
      return "#fef3c7"; // 노랑
    case "UPSTREAM":
      return "#dcfce7"; // 초록
    case "DOWNSTREAM":
      return "#e0f2fe"; // 하늘
    default:
      return "#f3f4f6"; // 회색 (기본값)
  }
}

/**
 * TransactionChain[] → GraphNode[] 변환 (Story 5.4, Task 4.1)
 *
 * 각 체인을 하나의 노드로 변환합니다.
 * startTx 정보를 노드 데이터로 사용합니다.
 *
 * @param chains - TransactionChain 목록 (with relations)
 * @returns React Flow Node 배열
 */
export function transformChainsToNodes(
  chains: TransactionChainWithRelations[]
): GraphNode[] {
  return chains.map((chain) => {
    const tx = chain.startTx; // 시작 거래 정보 사용
    const amount = tx.depositAmount
      ? Number(tx.depositAmount)
      : tx.withdrawalAmount
      ? Number(tx.withdrawalAmount)
      : 0;

    return {
      id: chain.id,
      type: "default",
      position: { x: 0, y: 0 }, // 레이아웃 알고리즘으로 계산 (Task 3.2)
      data: {
        chainId: chain.id,
        transactionId: tx.id,
        memo: tx.memo || "거래",
        amount,
        transactionDate: tx.transactionDate,
        creditorName: tx.creditorName,
      },
      style: {
        background: getChainTypeColor(chain.chainType),
        border: "2px solid #000",
        borderRadius: "8px",
        width: 220,
      },
    };
  });
}

/**
 * TransactionRelation[] → GraphEdge[] 변환 (Story 5.4, Task 4.1)
 *
 * 각 관계를 엣지로 변환합니다.
 * confidence를 라벨로 표시합니다.
 *
 * @param relations - TransactionRelation 목록 (with relations)
 * @returns React Flow Edge 배열
 */
export function transformRelationsToEdges(
  relations: TransactionRelationWithRelations[]
): GraphEdge[] {
  return relations.map((rel) => {
    const confidencePercent = Math.round(rel.confidence * 100);

    return {
      id: rel.id,
      source: rel.sourceTxId,
      target: rel.targetTxId,
      label: `${confidencePercent}%`,
      markerEnd: "arrowclosed" as MarkerType,
      style: {
        strokeWidth: 2,
      },
    } as GraphEdge;
  });
}
