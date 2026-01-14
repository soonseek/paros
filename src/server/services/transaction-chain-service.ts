/**
 * Transaction Chain Identification Service (Story 5.3)
 *
 * 연관된 거래들 간의 체인을 식별하고 저장하는 서비스
 *
 * 알고리즘:
 * - TransactionRelation 테이블에서 이미 추적된 관계 활용
 * - 패턴 매칭으로 체인 유형 자동 결정 (LOAN_EXECUTION, DEBT_SETTLEMENT, COLLATERAL_RIGHT)
 * - confidenceScore 기반 필터링 (0.6 미만 시 경고)
 *
 * @module server/services/transaction-chain-service
 */

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * 체인 유형 Enum
 */
export enum ChainType {
  LOAN_EXECUTION = "LOAN_EXECUTION",       // 대출 실행: 입금 → 이체 → 담보제공
  DEBT_SETTLEMENT = "DEBT_SETTLEMENT",     // 채무 변제: 변제 → 출처 → 정산
  COLLATERAL_RIGHT = "COLLATERAL_RIGHT",   // 담보권 설정: 설정 → 유입 → 해지
  UPSTREAM = "UPSTREAM",                   // 상류 추적 (Story 5.1)
  DOWNSTREAM = "DOWNSTREAM",               // 하류 추적 (Story 5.2)
}

/**
 * 거래 유형 기반 체인 패턴 분류
 */
interface ChainPattern {
  chainType: ChainType;
  description: string;
}

/**
 * 체인 식별 결과
 */
export interface IdentifiedChain {
  startTxId: string;
  endTxId: string;
  chainType: ChainType;
  chainDepth: number;
  path: string; // CSV: "tx1,tx2,tx3"
  totalAmount: number;
  confidenceScore: number; // 체인 평균 신뢰도
}

/**
 * 체인 식별 서비스 입력
 */
export interface IdentifyChainsInput {
  db: PrismaClient;
  caseId: string;
  minConfidence?: number; // 최소 신뢰도 (기본값: 0.6)
}

/**
 * 거래 유형 분석 (체인 패턴 결정용)
 *
 * @param depositAmount - 입금액
 * @param withdrawalAmount - 출금액
 * @param category - 거래 카테고리
 * @param importantTransactionType - 중요 거래 유형
 * @returns 거래 유형: DEPOSIT, WITHDRAWAL, TRANSFER, COLLATERAL
 */
function analyzeTransactionType(
  depositAmount: number | null,
  withdrawalAmount: number | null,
  category: string | null,
  importantTransactionType: string | null
): string {
  if (importantTransactionType === "COLLATERAL") {
    return "COLLATERAL";
  }

  if (depositAmount && !withdrawalAmount) {
    return "DEPOSIT";
  }

  if (withdrawalAmount && !depositAmount) {
    return "WITHDRAWAL";
  }

  if (depositAmount && withdrawalAmount) {
    return "TRANSFER";
  }

  return "UNKNOWN";
}

/**
 * 체인 패턴 매칭 (거래 유형 기반 자동 분류)
 *
 * @param txTypes - 체인의 거래 유형 배열
 * @returns 체인 패턴 또는 null
 */
function matchChainPattern(txTypes: string[]): ChainPattern | null {
  // LOAN_EXECUTION: 입금 → 이체 → 담보제공
  if (
    txTypes.length >= 2 &&
    txTypes[0] === "DEPOSIT" &&
    txTypes.some((t) => t === "COLLATERAL")
  ) {
    return {
      chainType: ChainType.LOAN_EXECUTION,
      description: "대출 실행 체인",
    };
  }

  // DEBT_SETTLEMENT: 출금 → 입금 → 입금 (변제 → 출처 → 정산)
  if (
    txTypes.length >= 2 &&
    txTypes[0] === "WITHDRAWAL" &&
    txTypes.slice(1).every((t) => t === "DEPOSIT")
  ) {
    return {
      chainType: ChainType.DEBT_SETTLEMENT,
      description: "채무 변제 체인",
    };
  }

  // COLLATERAL_RIGHT: 담보 → 입금 → 담보
  if (
    txTypes.length >= 3 &&
    txTypes[0] === "COLLATERAL" &&
    txTypes[txTypes.length - 1] === "COLLATERAL"
  ) {
    return {
      chainType: ChainType.COLLATERAL_RIGHT,
      description: "담보권 설정 체인",
    };
  }

  // 기본적으로 UPSTREAM/DOWNSTREAM 분류
  return null;
}

/**
 * 체인 식별 서비스 (Story 5.3)
 *
 * TransactionRelation 테이블에서 이미 추적된 관계를 조회하여
 * 특정 패턴의 체인을 식별하고 TransactionChain 테이블에 저장
 *
 * @param input - 식별 서비스 입력
 * @returns 식별된 체인 목록
 */
export async function identifyTransactionChains(
  input: IdentifyChainsInput
): Promise<IdentifiedChain[]> {
  const { db, caseId, minConfidence = 0.6 } = input;

  // 1. TransactionRelation 테이블 조회 (모든 관계)
  const relations = await db.transactionRelation.findMany({
    where: {
      caseId,
    },
    include: {
      sourceTx: {
        select: {
          depositAmount: true,
          withdrawalAmount: true,
          category: true,
          importantTransactionType: true,
          transactionDate: true,
          memo: true,
        },
      },
      targetTx: {
        select: {
          depositAmount: true,
          withdrawalAmount: true,
          category: true,
          importantTransactionType: true,
          transactionDate: true,
          memo: true,
        },
      },
    },
  });

  if (relations.length === 0) {
    return [];
  }

  // 2. 방향 그래프 구성 (source → target)
  const graph = new Map<string, Array<{ txId: string; confidence: number }>>();

  for (const relation of relations) {
    const { sourceTxId, targetTxId, confidence } = relation;

    // MEDIUM #1 FIX: Null/undefined 체크 (orphaned records 방지)
    if (!sourceTxId || !targetTxId) {
      continue; // Skip orphaned records
    }

    // MEDIUM #1 FIX: confidence Decimal → number 타입 캐스팅
    const confidenceScore = typeof confidence === "number" ? confidence : Number(confidence);

    if (!graph.has(sourceTxId)) {
      graph.set(sourceTxId, []);
    }

    graph.get(sourceTxId)!.push({ txId: targetTxId, confidence: confidenceScore });
  }

  // 3. 연결된 경로 탐색 (BFS)
  const identifiedChains: IdentifiedChain[] = [];
  const visited = new Set<string>();
  const chainKeySet = new Set<string>(); // 중복 방지 (startTxId + endTxId)

  for (const [startTxId] of graph) {
    if (visited.has(startTxId)) continue;

    const queue: Array<{
      currentTxId: string;
      path: string[];
      confidences: number[];
      txTypes: string[];
      totalAmount: number;
    }> = [
      {
        currentTxId: startTxId,
        path: [startTxId],
        confidences: [],
        txTypes: [],
        totalAmount: 0,
      },
    ];

    while (queue.length > 0) {
      const { currentTxId, path, confidences, txTypes, totalAmount } =
        queue.shift()!;

      if (visited.has(currentTxId)) {
        continue;
      }

      visited.add(currentTxId);

      // 현재 거래 정보 조회
      const currentRelation = relations.find(
        (r) => r.sourceTxId === currentTxId || r.targetTxId === currentTxId
      );

      if (!currentRelation) continue;

      // 거래 유형 분석
      const currentTx =
        currentRelation.sourceTxId === currentTxId
          ? currentRelation.sourceTx
          : currentRelation.targetTx;

      const txType = analyzeTransactionType(
        currentTx.depositAmount ? Number(currentTx.depositAmount) : null,
        currentTx.withdrawalAmount ? Number(currentTx.withdrawalAmount) : null,
        currentTx.category,
        currentTx.importantTransactionType
      );

      const newTxTypes = [...txTypes, txType];

      // 현재 노드에서의 인접 노드 탐색
      const neighbors = graph.get(currentTxId) || [];

      for (const neighbor of neighbors) {
        const newPath = [...path, neighbor.txId];
        const newConfidences = [...confidences, neighbor.confidence];
        const neighborTotalAmount =
          totalAmount +
          (currentTx.depositAmount
            ? Number(currentTx.depositAmount)
            : Number(currentTx.withdrawalAmount || 0));

        // 체인 깊이 제한 (최대 5단계)
        if (newPath.length > 5) {
          continue;
        }

        // 최소 2개 이상의 거래로 구성된 체인만 식별
        if (newPath.length >= 2) {
          const avgConfidence =
            newConfidences.reduce((sum, c) => sum + c, 0) /
            newConfidences.length;

          // 신뢰도 필터링 (AC4: 0.6 미만 시 경고)
          if (avgConfidence >= minConfidence) {
            const chainKey = `${newPath[0]}-${newPath[newPath.length - 1]}`;

            if (!chainKeySet.has(chainKey)) {
              chainKeySet.add(chainKey);

              // 패턴 매칭
              const pattern = matchChainPattern(newTxTypes);

              // 패턴이 매칭되면 특정 체인 유형으로 분류, 그렇지 않으면 UPSTREAM/DOWNSTREAM
              let chainType: ChainType;

              if (pattern) {
                chainType = pattern.chainType;
              } else {
                // 기본 분류: 입금 시작 → UPSTREAM, 출금 시작 → DOWNSTREAM
                const startRelation = relations.find(
                  (r) => r.sourceTxId === newPath[0] || r.targetTxId === newPath[0]
                );

                if (startRelation) {
                  const startTx =
                    startRelation.sourceTxId === newPath[0]
                      ? startRelation.sourceTx
                      : startRelation.targetTx;

                  if (startTx?.depositAmount) {
                    chainType = ChainType.UPSTREAM;
                  } else {
                    chainType = ChainType.DOWNSTREAM;
                  }
                } else {
                  // 기본값: DOWNSTREAM
                  chainType = ChainType.DOWNSTREAM;
                }
              }

              identifiedChains.push({
                startTxId: newPath[0]!, // newPath.length >= 2이므로 항상 존재
                endTxId: newPath[newPath.length - 1]!, // newPath.length >= 2이므로 항상 존재
                chainType,
                chainDepth: newPath.length - 1,
                path: newPath.join(","),
                totalAmount: neighborTotalAmount,
                confidenceScore: avgConfidence,
              });
            }
          }
        }

        // 계속 탐색
        if (!visited.has(neighbor.txId)) {
          queue.push({
            currentTxId: neighbor.txId,
            path: newPath,
            confidences: newConfidences,
            txTypes: newTxTypes,
            totalAmount: neighborTotalAmount,
          });
        }
      }
    }
  }

  // 4. TransactionChain.bulkCreate로 체인 저장 (중복 방지)
  // MEDIUM #2 FIX: N+1 쿼리 최적화 - 일괄 조회 후 메모리 필터링
  const chainsToCreate: Prisma.TransactionChainCreateManyInput[] = [];

  // 일괄 조회로 O(n) 쿼리 → O(1) 쿼리 최적화
  const existingChains = await db.transactionChain.findMany({
    where: {
      caseId,
      OR: identifiedChains.map((c) => ({
        startTxId: c.startTxId,
        endTxId: c.endTxId,
        chainType: c.chainType,
      })),
    },
    select: {
      startTxId: true,
      endTxId: true,
      chainType: true,
    },
  });

  // 메모리에서 중복 체크 (Set 사용)
  const existingSet = new Set(
    existingChains.map((c) => `${c.startTxId}-${c.endTxId}-${c.chainType}`)
  );

  for (const chain of identifiedChains) {
    const chainKey = `${chain.startTxId}-${chain.endTxId}-${chain.chainType}`;

    // 중복이 아니면 추가
    if (!existingSet.has(chainKey)) {
      chainsToCreate.push({
        caseId,
        startTxId: chain.startTxId,
        endTxId: chain.endTxId,
        chainType: chain.chainType,
        chainDepth: chain.chainDepth,
        path: chain.path,
        totalAmount: chain.totalAmount,
      });
    }
  }

  if (chainsToCreate.length > 0) {
    await db.transactionChain.createMany({
      data: chainsToCreate,
      skipDuplicates: true,
    });
  }

  return identifiedChains;
}
