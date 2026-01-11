/**
 * AI Classification Service
 *
 * Story 4.1: AI 기반 거래 자동 분류
 *
 * 기능:
 * - AI 공급자 선택 로직 (환경 변수 AI_PROVIDER)
 * - 거래 메모를 기반으로 한 분류
 * - 재시도 메커니즘 (최대 3회, 지수 백오프)
 * - 타임아웃 처리 (15초)
 *
 * @example
 * const result = await classifyTransaction(memo, { deposit: 100000 });
 * console.log(result.category); // "입금"
 */

import type {
  ClassificationResult,
  TransactionInput,
  AIProvider,
  RetryOptions,
  BatchOptions,
} from "./types";
import { classifyWithUpstage } from "./providers/upstage";
import { classifyWithOpenAI } from "./providers/openai";
import { classifyWithAnthropic } from "./providers/anthropic";
import { env } from "~/env";
import { validateAIProviderConfig } from "~/env";
// Story 4.4: 거래 성격 판단 통합
import { analyzeTransactionNature } from "./transaction-nature-analyzer";
// Story 4.8: 규칙 기반 분류 (AI API 호출 전 단계)
import {
  classifyWithRules,
  type RuleBasedTransactionInput,
} from "./rule-based-classifier";
import type { PrismaClient } from "@prisma/client";

/**
 * 환경 변수에서 AI 공급자 설정을 가져옵니다.
 */
function getAIProvider(): AIProvider {
  // Story 4.1, MEDIUM-5 FIX: Use validated env instead of process.env
  const provider = env.AI_PROVIDER;

  // Validate that the corresponding API key is set
  validateAIProviderConfig();

  return provider;
}

/**
 * 지수 백오프(Exponential Backoff)로 재시도 메커니즘을 구현합니다.
 *
 * @param fn - 재시도할 함수
 * @param options - 재시도 옵션
 * @returns 함수 실행 결과
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => callAI(memo),
 *   { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
  }
): Promise<T> {
  const { maxRetries, initialDelay, backoffMultiplier } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 마지막 시도에서 실패하면 에러를 던짐
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 지수 백오프로 대기 시간 계산 (1s, 2s, 4s, ...)
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
      console.error(
        `[AI Classification] 실패 (시도 ${attempt + 1}/${maxRetries}): ${error}`
      );
      console.log(`[AI Classification] ${delay}ms 후 재시도...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("최대 재시도 횟수 초과");
}

/**
 * 단일 거래를 AI로 분류합니다.
 *
 * @param memo - 거래 메모/적요
 * @param amount - 입금액 또는 출금액
 * @returns 분류 결과
 *
 * @example
 * const result = await classifyTransaction(
 *   "홍길동급여",
 *   { deposit: 3000000 }
 * );
 * // result.category = "입금"
 * // result.subcategory = "급여"
 * // result.confidenceScore = 0.95
 */
export async function classifyTransaction(
  memo: string | null,
  amount?: { deposit?: number; withdrawal?: number }
): Promise<ClassificationResult> {
  // 메모가 없으면 기본 분류 반환
  if (!memo || memo.trim().length === 0) {
    return {
      category: "기타",
      subcategory: "미분류",
      confidenceScore: 0.0,
      reasoning: "메모가 없어 기본 분류 적용",
    };
  }

  const provider = getAIProvider();

  // 재시도 메커니즘 적용
  const result = await retryWithBackoff(async () => {
    switch (provider) {
      case "upstage":
        return classifyWithUpstage(memo, amount);
      case "openai":
        return classifyWithOpenAI(memo, amount);
      case "anthropic":
        return classifyWithAnthropic(memo, amount);
      default:
        throw new Error(`지원하지 않는 AI 공급자입니다: ${provider}`);
    }
  });

  return result;
}

/**
 * 다중 거래를 일괄 분류합니다.
 *
 * @param transactions - 거래 배열
 * @param onProgress - 진행률 콜백 (선택적)
 * @returns 분류 결과 배열
 *
 * @example
 * const transactions = [
 *   { id: "1", memo: "홍길동급여", depositAmount: 3000000, withdrawalAmount: null },
 *   { id: "2", memo: "지출", depositAmount: null, withdrawalAmount: 50000 }
 * ];
 *
 * const results = await classifyTransactions(transactions, (progress) => {
 *   console.log(`진행률: ${progress}%`);
 * });
 */
export async function classifyTransactions(
  transactions: TransactionInput[],
  onProgress?: (current: number, total: number) => void | Promise<void>
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    if (!tx) {
      continue;
    }

    try {
      const result = await classifyTransaction(
        tx.memo,
        {
          deposit: tx.depositAmount ?? undefined,
          withdrawal: tx.withdrawalAmount ?? undefined,
        }
      );

      results.set(tx.id, result);

      // 진행률 콜백
      if (onProgress) {
        await onProgress(i + 1, transactions.length);
      }
    } catch (error) {
      console.error(`[AI Classification] 거래 ${tx.id} 분류 실패:`, error);

      // 실패 시 기본 분류 결과 저장
      results.set(tx.id, {
        category: "기타",
        subcategory: "분류 실패",
        confidenceScore: 0.0,
        reasoning: `AI 분류 실패: ${error}`,
      });
    }
  }

  return results;
}

/**
 * 다중 거래를 배치로 일괄 분류합니다 (성능 최적화 버전).
 *
 * Story 4.1, Task 4: 일괄 처리 및 성능 최적화
 * Story 4.8, Task 4: 규칙 기반 분류 적용 (AI API 호출 전 단계)
 *
 * @param transactions - 거래 배열
 * @param db - Prisma Client (Story 4.8: 규칙 조회용)
 * @param options - 배치 옵션
 * @param onProgress - 진행률 콜백 (선택적)
 * @returns 분류 결과 배열
 *
 * @example
 * const BATCH_SIZE = 100;
 * const MAX_CONCURRENT_BATCHES = 5;
 *
 * const results = await classifyTransactionsInBatches(
 *   transactions,
 *   db,
 *   { batchSize: BATCH_SIZE, maxConcurrentBatches: MAX_CONCURRENT_BATCHES },
 *   (progress) => console.log(`진행률: ${progress}%`)
 * );
 */
export async function classifyTransactionsInBatches(
  transactions: TransactionInput[],
  db: PrismaClient,
  options: BatchOptions = {
    batchSize: 100,
    maxConcurrentBatches: 5,
  },
  onProgress?: (current: number, total: number) => void | Promise<void>
): Promise<Map<string, ClassificationResult>> {
  const { batchSize, maxConcurrentBatches } = options;
  const results = new Map<string, ClassificationResult>();

  // Story 4.8: Step 1 - 규칙 기반 분류 먼저 적용
  console.log(`[AI Classification] Story 4.8: 규칙 기반 분류 시작...`);
  const ruleBasedInputs: RuleBasedTransactionInput[] = transactions.map((tx) => ({
    id: tx.id,
    memo: tx.memo,
    depositAmount: tx.depositAmount,
    withdrawalAmount: tx.withdrawalAmount,
  }));

  const ruleBasedResults = await classifyWithRules(db, ruleBasedInputs);

  // 규칙 매칭된 거래와 매칭되지 않은 거래 분리
  const matchedTransactions: string[] = [];
  const unmatchedTransactions: TransactionInput[] = [];

  for (const tx of transactions) {
    const ruleResult = ruleBasedResults.get(tx.id);
    if (ruleResult?.matched && ruleResult.result) {
      // 규칙 매칭됨 → 결과 저장 (AI 호출 불필요)
      results.set(tx.id, ruleResult.result);
      matchedTransactions.push(tx.id);
    } else {
      // 규칙 매칭 안됨 → AI API 호출 필요
      unmatchedTransactions.push(tx);
    }
  }

  console.log(
    `[AI Classification] Story 4.8: 규칙 기반 분류 완료 - ${matchedTransactions.length}건 매칭, ${unmatchedTransactions.length}건 AI 분류 필요`
  );

  // Story 4.8: Step 2 - 매칭되지 않은 거래만 AI API 호출
  // 1. 거래를 배치로 나눔
  const batches: TransactionInput[][] = [];
  for (let i = 0; i < unmatchedTransactions.length; i += batchSize) {
    batches.push(unmatchedTransactions.slice(i, i + batchSize));
  }

  if (batches.length > 0) {
    console.log(
      `[AI Classification] ${unmatchedTransactions.length}건을 ${batches.length}개 배치로 분할 (배치 크기: ${batchSize})`
    );
  }

  // 2. 배치를 병렬로 처리 (최대 maxConcurrentBatches개 동시 실행)
  let processedCount = matchedTransactions.length; // 이미 처리된 건수부터 시작

  for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
    const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);

    console.log(
      `[AI Classification] 배치 그룹 ${Math.floor(i / maxConcurrentBatches) + 1} 처리 중 (${concurrentBatches.length}개 배치)`
    );

    // 병렬로 배치 처리
    await Promise.all(
      concurrentBatches.map(async (batch) => {
        for (const tx of batch) {
          if (!tx) continue; // undefined 체크

          try {
            const result = await classifyTransaction(
              tx.memo,
              {
                deposit: tx.depositAmount ?? undefined,
                withdrawal: tx.withdrawalAmount ?? undefined,
              }
            );

            // Story 4.4: 거래 성격 분석 통합
            // 순서: AI 분류 → 중요 거래 감지(Story 4.3) → 거래 성격 분석(Story 4.4)
            const amount = tx.depositAmount ?? tx.withdrawalAmount ?? 0;
            const natureAnalysis = analyzeTransactionNature(
              tx.memo,
              amount,
              tx.transactionDate || new Date()
            );

            // 분석 결과 병합
            const enhancedResult: ClassificationResult = {
              ...result,
              transactionNature: natureAnalysis.nature,
              creditorName: natureAnalysis.creditorName,
              collateralType: natureAnalysis.collateralType,
              natureConfidenceScore: natureAnalysis.confidenceScore,
            };

            results.set(tx.id, enhancedResult);

            // 진행률 업데이트
            processedCount++;
            if (onProgress) {
              await onProgress(processedCount, transactions.length);
            }
          } catch (error) {
            console.error(`[AI Classification] 거래 ${tx.id} 분류 실패:`, error);

            // Story 4.4: 실패 시에도 거래 성격 분석은 시도
            const amount = tx.depositAmount ?? tx.withdrawalAmount ?? 0;
            const natureAnalysis = analyzeTransactionNature(
              tx.memo,
              amount,
              tx.transactionDate || new Date()
            );

            // 실패 시 기본 분류 결과 + 거래 성격 분석 저장
            results.set(tx.id, {
              category: "기타",
              subcategory: "분류 실패",
              confidenceScore: 0.0,
              reasoning: `AI 분류 실패: ${error}`,
              transactionNature: natureAnalysis.nature,
              creditorName: natureAnalysis.creditorName,
              collateralType: natureAnalysis.collateralType,
              natureConfidenceScore: natureAnalysis.confidenceScore,
            });

            // 진행률 업데이트 (실패도 포함)
            processedCount++;
            if (onProgress) {
              await onProgress(processedCount, transactions.length);
            }
          }
        }
      })
    );
  }

  console.log(
    `[AI Classification] 모든 거래 분류 완료 (${results.size}건: ${matchedTransactions.length}건 규칙, ${unmatchedTransactions.length}건 AI)`
  );

  return results;
}
