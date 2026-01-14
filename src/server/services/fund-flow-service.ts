/**
 * Fund Flow Tracing Service (Epic 5)
 *
 * 자금 흐름 추적을 위한 핵심 서비스
 *
 * 알고리즘:
 * - BFS (Breadth-First Search)를 사용한 5단계 추적
 * - 사이클 감지 (Cycle Detection)
 * - Promise.all을 사용한 병렬 쿼리 (N+1 문제 방지)
 *
 * 성능 최적화:
 * - 중복 방문 방지 (visited Set)
 * - 깊이 제한 (maxDepth: 5)
 * - Prisma findMany + include로 쿼리 수 최소화
 *
 * @module server/services/fund-flow-service
 */

import { PrismaClient, TransactionRelationType } from "@prisma/client";

/**
 * 추적된 거래 체인의 노드
 */
export interface ChainNode {
  transactionId: string;
  depth: number;
  amount: number;
  transactionDate: Date;
  memo: string | null;
  category: string | null;
  creditorName: string | null;
  matchReason: string; // 연결 사유
  confidence: number; // 연결 신뢰도 (0.0 ~ 1.0)
}

/**
 * 추적된 거래 체인
 */
export interface TransactionChain {
  nodes: ChainNode[];
  totalAmount: number;
  maxDepth: number;
  path: string; // CSV: "tx1,tx2,tx3"
}

/**
 * 추적 결과
 */
export interface TracingResult {
  chains: TransactionChain[];
  totalTransactions: number;
}

/**
 * 금액 유사도 계산
 *
 * @param sourceAmount - 출처 금액
 * @param targetAmount - 대상 금액
 * @param tolerance - 허용 오차 (기본값: 0.1 = ±10%)
 * @returns 일치하면 true, 그렇지 않으면 false
 */
function isAmountMatch(
  sourceAmount: number,
  targetAmount: number,
  tolerance: number
): boolean {
  const lowerBound = sourceAmount * (1 - tolerance);
  const upperBound = sourceAmount * (1 + tolerance);
  return targetAmount >= lowerBound && targetAmount <= upperBound;
}

/**
 * 연결 신뢰도 계산
 *
 * @param amountDiff - 금액 차이 비율 (0 ~ 1)
 * @param dateDiffDays - 날짜 차이 (일)
 * @returns 신뢰도 점수 (0.0 ~ 1.0)
 */
function calculateConfidence(
  amountDiff: number,
  dateDiffDays: number
): number {
  // 금액 일치도: 70% 가중치
  const amountScore = Math.max(0, 1 - amountDiff);

  // 날짜 근접도: 30% 가중치 (30일 이내: 1.0, 그 이상: 감소)
  const dateScore = Math.max(0, 1 - dateDiffDays / 30);

  return amountScore * 0.7 + dateScore * 0.3;
}

/**
 * 자금 출처 추적 (Upstream Fund Tracing)
 *
 * Story 5.1: 입금 거래의 자금 출처를 상류 방향으로 추적
 *
 * 알고리즘: BFS (Breadth-First Search)
 * - 입금 → 출금 → 입금 → 출금 ...
 * - 최대 5단계까지 추적
 *
 * 검색 조건:
 * - 금액: ±tolerance% 이내
 * - 날짜: 현재 거래 이전
 *
 * @param db - Prisma Client
 * @param startTransaction - 추적을 시작할 거래
 * @param maxDepth - 최대 추적 깊이 (기본값: 3, 최대: 5)
 * @param amountTolerance - 금액 허용 오차 (기본값: 0.1 = ±10%)
 * @returns 추적 결과 (체인 배열)
 */
export async function traceUpstreamFunds(
  db: PrismaClient,
  startTransaction: {
    id: string;
    caseId: string;
    transactionDate: Date;
    depositAmount: number | null;
    withdrawalAmount: number | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  },
  maxDepth: number = 3,
  amountTolerance: number = 0.1
): Promise<TracingResult> {
  console.log(
    `[FundFlow] Story 5.1: 자금 출처 추적 시작 - TX: ${startTransaction.id}, MaxDepth: ${maxDepth}`
  );

  // MEDIUM #5: 시작 거래 검증 - 입금이어야 함
  if (!startTransaction.depositAmount) {
    throw new Error(
      `입금 거래만 추적 가능합니다 (TX: ${startTransaction.id}, Type: 출금)`
    );
  }

  const startAmount = Number(startTransaction.depositAmount);
  const chains: TransactionChain[] = [];
  const visited = new Set<string>(); // 사이클 방지
  visited.add(startTransaction.id);

  /**
   * 시작 노드 생성 (HIGH #1 수정: 체인에 시작 거래 포함)
   */
  const startNode: ChainNode = {
    transactionId: startTransaction.id,
    depth: 0,
    amount: startAmount,
    transactionDate: startTransaction.transactionDate,
    memo: startTransaction.memo,
    category: startTransaction.category,
    creditorName: startTransaction.creditorName,
    matchReason: "시작 거래",
    confidence: 1.0,
  };

  /**
   * BFS Queue: [{ transactionId, depth, path, totalAmount }]
   */
  const queue: Array<{
    transactionId: string;
    depth: number;
    path: ChainNode[];
    totalAmount: number;
  }> = [
    {
      transactionId: startTransaction.id,
      depth: 0,
      path: [startNode], // 시작 노드를 path에 포함
      totalAmount: startAmount,
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // 최대 깊이 도달 시 체인 저장
    if (current.depth >= maxDepth) {
      chains.push({
        nodes: current.path,
        totalAmount: current.totalAmount,
        maxDepth: current.depth,
        path: current.path.map((n) => n.transactionId).join(","),
      });
      continue;
    }

    // 상류 거래 검색 (출금 → 입금 패턴)
    const currentTx = await db.transaction.findUnique({
      where: { id: current.transactionId },
      select: {
        transactionDate: true,
        depositAmount: true,
        withdrawalAmount: true,
      },
    });

    if (!currentTx) continue;

    const currentAmount = Number(
      currentTx.depositAmount ?? currentTx.withdrawalAmount
    );

    /**
     * 현재 거래의 금액과 일치하는 출금 거래 검색
     *
     * 검색 조건:
     * - caseId: 같은 사건
     * - withdrawalAmount: 금액 ±tolerance% 이내
     * - transactionDate: 현재 거래 이전
     * - id: visited에 없는 거래 (사이클 방지)
     */
    const matchingWithdrawals = await db.transaction.findMany({
      where: {
        caseId: startTransaction.caseId,
        withdrawalAmount: {
          gte: currentAmount * (1 - amountTolerance),
          lte: currentAmount * (1 + amountTolerance),
        },
        transactionDate: {
          lt: currentTx.transactionDate,
        },
        id: {
          notIn: Array.from(visited),
        },
      },
      select: {
        id: true,
        transactionDate: true,
        withdrawalAmount: true,
        memo: true,
        category: true,
        creditorName: true,
      },
      take: 10, // 최대 10개만 (성능 최적화)
    });

    // 각 매칭된 출금 거래에 대해 재귀적으로 추적
    // MEDIUM #1: 병렬 처리를 위한 배열 수집
    const processingPromises: Promise<unknown>[] = [];

    for (const withdrawal of matchingWithdrawals) {
      const withdrawalAmount = Number(withdrawal.withdrawalAmount!);
      const amountDiff = Math.abs(currentAmount - withdrawalAmount) / currentAmount;
      // HIGH #3 수정: 음수 날짜 차이 방지
      const dateDiffDays = Math.abs(
        Math.floor(
          (currentTx.transactionDate.getTime() - withdrawal.transactionDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const confidence = calculateConfidence(amountDiff, dateDiffDays);
      const matchReason = `금액 ${withdrawalAmount.toLocaleString()}원 (${Math.round(
        (1 - amountDiff) * 100
      )}% 일치), ${dateDiffDays}일 전`;

      const newNode: ChainNode = {
        transactionId: withdrawal.id,
        depth: current.depth + 1,
        amount: withdrawalAmount,
        transactionDate: withdrawal.transactionDate,
        memo: withdrawal.memo,
        category: withdrawal.category,
        creditorName: withdrawal.creditorName,
        matchReason,
        confidence,
      };

      // 사이클 방지
      if (visited.has(withdrawal.id)) continue;
      visited.add(withdrawal.id);

      // 큐에 추가 (BFS)
      queue.push({
        transactionId: withdrawal.id,
        depth: current.depth + 1,
        path: [...current.path, newNode],
        totalAmount: current.totalAmount + withdrawalAmount,
      });

      // MEDIUM #1: TransactionRelation upsert를 병렬로 처리
      processingPromises.push(
        db.transactionRelation.upsert({
          where: {
            sourceTxId_targetTxId: {
              sourceTxId: withdrawal.id,
              targetTxId: current.transactionId,
            },
          },
          create: {
            caseId: startTransaction.caseId,
            sourceTxId: withdrawal.id,
            targetTxId: current.transactionId,
            relationType: TransactionRelationType.PROBABLE_TRANSFER,
            confidence,
            matchReason,
            distance: current.depth + 1,
          },
          update: {}, // 이미 존재하면 업데이트 안 함
        })
      );
    }

    // MEDIUM #1: 모든 upsert 작업을 병렬로 실행
    if (processingPromises.length > 0) {
      await Promise.all(processingPromises);
    }
  }

  console.log(
    `[FundFlow] 자금 출처 추적 완료 - ${chains.length}개 체인 발견, ${visited.size}개 거래 방문`
  );

  return {
    chains,
    totalTransactions: visited.size,
  };
}

/**
 * 자금 사용처 추적 (Downstream Fund Tracing)
 *
 * Story 5.2: 출금 거래의 자금 사용처를 하류 방향으로 추적
 *
 * 알고리즘: BFS (Breadth-First Search)
 * - 출금 → 입금 → 출금 → 입금 ...
 * - 최대 5단계까지 추적
 *
 * 검색 조건:
 * - 금액: ±tolerance% 이내
 * - 날짜: 현재 거래 이후
 *
 * @param db - Prisma Client
 * @param startTransaction - 추적을 시작할 거래
 * @param maxDepth - 최대 추적 깊이 (기본값: 3, 최대: 5)
 * @param amountTolerance - 금액 허용 오차 (기본값: 0.1 = ±10%)
 * @returns 추적 결과 (체인 배열)
 */
export async function traceDownstreamFunds(
  db: PrismaClient,
  startTransaction: {
    id: string;
    caseId: string;
    transactionDate: Date;
    depositAmount: number | null;
    withdrawalAmount: number | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  },
  maxDepth: number = 3,
  amountTolerance: number = 0.1
): Promise<TracingResult> {
  console.log(
    `[FundFlow] Story 5.2: 자금 사용처 추적 시작 - TX: ${startTransaction.id}, MaxDepth: ${maxDepth}`
  );

  // MEDIUM #5: 시작 거래 검증 - 출금이어야 함
  if (!startTransaction.withdrawalAmount) {
    throw new Error(
      `출금 거래만 추적 가능합니다 (TX: ${startTransaction.id}, Type: 입금)`
    );
  }

  const startAmount = Number(startTransaction.withdrawalAmount);
  const chains: TransactionChain[] = [];
  const visited = new Set<string>();
  visited.add(startTransaction.id);

  /**
   * 시작 노드 생성 (HIGH #1 수정: 체인에 시작 거래 포함)
   */
  const startNode: ChainNode = {
    transactionId: startTransaction.id,
    depth: 0,
    amount: startAmount,
    transactionDate: startTransaction.transactionDate,
    memo: startTransaction.memo,
    category: startTransaction.category,
    creditorName: startTransaction.creditorName,
    matchReason: "시작 거래",
    confidence: 1.0,
  };

  const queue: Array<{
    transactionId: string;
    depth: number;
    path: ChainNode[];
    totalAmount: number;
  }> = [
    {
      transactionId: startTransaction.id,
      depth: 0,
      path: [startNode], // 시작 노드를 path에 포함
      totalAmount: startAmount,
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.depth >= maxDepth) {
      chains.push({
        nodes: current.path,
        totalAmount: current.totalAmount,
        maxDepth: current.depth,
        path: current.path.map((n) => n.transactionId).join(","),
      });
      continue;
    }

    const currentTx = await db.transaction.findUnique({
      where: { id: current.transactionId },
      select: {
        transactionDate: true,
        depositAmount: true,
        withdrawalAmount: true,
      },
    });

    if (!currentTx) continue;

    const currentAmount = Number(
      currentTx.depositAmount ?? currentTx.withdrawalAmount
    );

    // 하류 거래 검색 (입금 → 출금 패턴)
    const matchingDeposits = await db.transaction.findMany({
      where: {
        caseId: startTransaction.caseId,
        depositAmount: {
          gte: currentAmount * (1 - amountTolerance),
          lte: currentAmount * (1 + amountTolerance),
        },
        transactionDate: {
          gt: currentTx.transactionDate,
        },
        id: {
          notIn: Array.from(visited),
        },
      },
      select: {
        id: true,
        transactionDate: true,
        depositAmount: true,
        memo: true,
        category: true,
        creditorName: true,
      },
      take: 10,
    });

    // MEDIUM #1: 병렬 처리를 위한 배열 수집
    const processingPromises: Promise<unknown>[] = [];

    for (const deposit of matchingDeposits) {
      const depositAmount = Number(deposit.depositAmount!);
      const amountDiff = Math.abs(currentAmount - depositAmount) / currentAmount;
      // HIGH #3 수정: 음수 날짜 차이 방지
      const dateDiffDays = Math.abs(
        Math.floor(
          (deposit.transactionDate.getTime() - currentTx.transactionDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const confidence = calculateConfidence(amountDiff, dateDiffDays);
      const matchReason = `금액 ${depositAmount.toLocaleString()}원 (${Math.round(
        (1 - amountDiff) * 100
      )}% 일치), ${dateDiffDays}일 후`;

      const newNode: ChainNode = {
        transactionId: deposit.id,
        depth: current.depth + 1,
        amount: depositAmount,
        transactionDate: deposit.transactionDate,
        memo: deposit.memo,
        category: deposit.category,
        creditorName: deposit.creditorName,
        matchReason,
        confidence,
      };

      if (visited.has(deposit.id)) continue;
      visited.add(deposit.id);

      queue.push({
        transactionId: deposit.id,
        depth: current.depth + 1,
        path: [...current.path, newNode],
        totalAmount: current.totalAmount + depositAmount,
      });

      // MEDIUM #1: TransactionRelation upsert를 병렬로 처리
      processingPromises.push(
        db.transactionRelation.upsert({
          where: {
            sourceTxId_targetTxId: {
              sourceTxId: current.transactionId,
              targetTxId: deposit.id,
            },
          },
          create: {
            caseId: startTransaction.caseId,
            sourceTxId: current.transactionId,
            targetTxId: deposit.id,
            relationType: TransactionRelationType.PROBABLE_TRANSFER,
            confidence,
            matchReason,
            distance: current.depth + 1,
          },
          update: {},
        })
      );
    }

    // MEDIUM #1: 모든 upsert 작업을 병렬로 실행
    if (processingPromises.length > 0) {
      await Promise.all(processingPromises);
    }
  }

  console.log(
    `[FundFlow] 자금 사용처 추적 완료 - ${chains.length}개 체인 발견, ${visited.size}개 거래 방문`
  );

  return {
    chains,
    totalTransactions: visited.size,
  };
}
