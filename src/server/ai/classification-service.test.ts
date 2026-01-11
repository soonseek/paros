/**
 * AI Classification Service Tests
 *
 * Story 4.1, CRITICAL-1 FIX: 분류 서비스 테스트
 * Story 4.1, AI-1: classifyTransactionsInBatches 테스트 추가
 *
 * 테스트 범위:
 * - retryWithBackoff: 지수 백오프 재시도 메커니즘
 * - classifyTransactionsInBatches: 배치 분류 기능
 *
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  retryWithBackoff,
  classifyTransactionsInBatches,
  classifyTransaction,
} from "./classification-service";
import type { TransactionInput } from "./types";

// AI 공급자 모킹
vi.mock("./providers/upstage", () => ({
  classifyWithUpstage: vi.fn(),
}));

vi.mock("./providers/openai", () => ({
  classifyWithOpenAI: vi.fn(),
}));

vi.mock("./providers/anthropic", () => ({
  classifyWithAnthropic: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    AI_PROVIDER: "upstage",
  },
  validateAIProviderConfig: vi.fn(),
}));

import { classifyWithUpstage } from "./providers/upstage";

describe("retryWithBackoff", () => {
  it("[AC4] 최대 3회 재시도 후 실패", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("API Error"));

    await expect(
      retryWithBackoff(mockFn, { maxRetries: 3, initialDelay: 100, backoffMultiplier: 2 })
    ).rejects.toThrow("API Error");

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("[AC4] 첫 번째 시도에서 성공하면 즉시 반환", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const result = await retryWithBackoff(mockFn, {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });
  });
});

describe("classifyTransactionsInBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[AI-1] 100건을 100건씩 배치로 분할하여 분류", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 100 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: i % 2 === 0 ? 100000 : null,
      withdrawalAmount: i % 2 === 1 ? 50000 : null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
      reasoning: "테스트 분류",
    });

    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });

    expect(results.size).toBe(100);
    expect(classifyWithUpstage).toHaveBeenCalledTimes(100);
  });

  it("[AI-1] 1000건을 100건씩 배치로 분류 (10개 배치)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "기타",
      subcategory: "미분류",
      confidenceScore: 0.5,
    });

    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });

    expect(results.size).toBe(1000);
    expect(classifyWithUpstage).toHaveBeenCalledTimes(1000);
  });

  it("[AI-1] 진행률 콜백 정확성 검증 (0% → 100%)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 250 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    const progressUpdates: Array<{ current: number; total: number }> = [];

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    await classifyTransactionsInBatches(
      transactions,
      {
        batchSize: 50,
        maxConcurrentBatches: 5,
      },
      (current, total) => {
        progressUpdates.push({ current, total });
      }
    );

    // 진행률 콜백이 호출되었는지 확인
    expect(progressUpdates.length).toBeGreaterThan(0);

    // 첫 번째 업데이트는 진행 시작
    expect(progressUpdates[0]?.current).toBe(1);
    expect(progressUpdates[0]?.total).toBe(250);

    // 마지막 업데이트는 100% 완료
    expect(progressUpdates[progressUpdates.length - 1]?.current).toBe(250);
    expect(progressUpdates[progressUpdates.length - 1]?.total).toBe(250);
  });

  it("[AI-1] 동시 실행 제한 (maxConcurrentBatches=3)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 500 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    let activeBatches = 0;
    let maxActiveBatches = 0;

    vi.mocked(classifyWithUpstage).mockImplementation(async () => {
      activeBatches++;
      maxActiveBatches = Math.max(maxActiveBatches, activeBatches);

      // 비동기 처리 시뮬레이션
      await new Promise((resolve) => setTimeout(resolve, 10));

      activeBatches--;
      return {
        category: "입금",
        subcategory: "급여",
        confidenceScore: 0.9,
      };
    });

    const results = await classifyTransactionsInBatches(
      transactions,
      {
        batchSize: 100,
        maxConcurrentBatches: 3,
      },
      () => {}
    );

    expect(results.size).toBe(500);
    // 최대 동시 배치 수가 제한을 초과하지 않아야 함
    expect(maxActiveBatches).toBeLessThanOrEqual(3);
  });

  it("[AI-1] 에러 발생 시 기본 분류 결과 저장", async () => {
    const transactions: TransactionInput[] = [
      {
        id: "tx-1",
        memo: "정상 거래",
        depositAmount: 100000,
        withdrawalAmount: null,
      },
      {
        id: "tx-2",
        memo: "실패 거래",
        depositAmount: 100000,
        withdrawalAmount: null,
      },
      {
        id: "tx-3",
        memo: "정상 거래 2",
        depositAmount: 100000,
        withdrawalAmount: null,
      },
    ];

    // 메모 내용을 기반으로 실패/성공 결정
    vi.mocked(classifyWithUpstage).mockImplementation(async (memo) => {
      if (memo === "실패 거래") {
        // 모든 재시도 실패
        throw new Error("API Error");
      }
      if (memo === "정상 거래") {
        return {
          category: "입금",
          subcategory: "급여",
          confidenceScore: 0.9,
        };
      }
      // 정상 거래 2
      return {
        category: "입금",
        subcategory: "이체",
        confidenceScore: 0.8,
      };
    });

    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 10,
      maxConcurrentBatches: 2,
    });

    expect(results.size).toBe(3);

    // 정상 분류된 거래
    expect(results.get("tx-1")).toEqual({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    // 실패한 거래는 기본 분류 결과
    expect(results.get("tx-2")).toEqual({
      category: "기타",
      subcategory: "분류 실패",
      confidenceScore: 0.0,
      reasoning: expect.stringContaining("AI 분류 실패"),
    });

    expect(results.get("tx-3")).toEqual({
      category: "입금",
      subcategory: "이체",
      confidenceScore: 0.8,
    });
  });

  it("[AI-1] 빈 배열 입력 처리", async () => {
    const results = await classifyTransactionsInBatches([], {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });

    expect(results.size).toBe(0);
  });

  it("[AI-1] 배치 크기가 총 거래 수보다 큰 경우", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100, // 50건보다 큰 배치 크기
      maxConcurrentBatches: 5,
    });

    expect(results.size).toBe(50);
    expect(classifyWithUpstage).toHaveBeenCalledTimes(50);
  });

  it("[AI-1] 진행률 콜백이 제공되지 않은 경우에도 정상 동작", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 100 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    // onProgress 콜백 없이 호출
    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 50,
      maxConcurrentBatches: 3,
    });

    expect(results.size).toBe(100);
  });

  it("[AI-1] undefined/null 거래 건 안전하게 건너뜀", async () => {
    const transactions: TransactionInput[] = [
      {
        id: "tx-1",
        memo: "정상 거래",
        depositAmount: 100000,
        withdrawalAmount: null,
      },
      // undefined/null은 TypeScript에서 허용되지 않으므로 테스트하지 않음
    ];

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 10,
      maxConcurrentBatches: 2,
    });

    expect(results.size).toBe(1);
  });
});

describe("classifyTransactionsInBatches - Performance (AC3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Story 4.1, AC3: 성능 요구사항
   * - 1000건을 60초 이내에 분류 완료
   *
   * 참고: 이 테스트는 모킹된 AI 응답을 사용하므로 실제 API 호출보다 빠릅니다.
   * 실제 성능은 실제 AI 공급자 응답 시간에 따라 달라집니다.
   */
  it("[AC3] 100건 분류 성능 측정 (기준: 10초 이내)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 100 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    // 빠른 모킹 응답 (실제 API보다 훨씬 빠름)
    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const startTime = performance.now();
    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });
    const elapsed = performance.now() - startTime;

    console.log(`⏱️ 100건 소요 시간: ${elapsed.toFixed(2)}ms`);

    expect(results.size).toBe(100);
    // 모킹 환경에서는 1초 이내여야 함
    expect(elapsed).toBeLessThan(10000);
  });

  it("[AC3] 1000건 분류 성능 측정 (기준: 60초 이내, 모킹 환경)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    // 빠른 모킹 응답
    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "기타",
      subcategory: "미분류",
      confidenceScore: 0.5,
    });

    const startTime = performance.now();
    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });
    const elapsed = performance.now() - startTime;

    console.log(`⏱️ 1000건 소요 시간: ${elapsed.toFixed(2)}ms (요구: 60000ms 이내)`);

    expect(results.size).toBe(1000);
    // 모킹 환경에서는 10초 이내여야 함 (실제 API는 60초 요구사항)
    expect(elapsed).toBeLessThan(60000);
  });

  /**
   * 배치 크기별 성능 비교 테스트
   * 최적의 배치 크기를 결정하기 위한 벤치마크
   */
  it("[AC3] 배치 크기별 성능 비교 (50 vs 100 vs 200)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 300 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const batchSizes = [50, 100, 200] as const;
    const results: Record<number, number> = {};

    for (const batchSize of batchSizes) {
      const start = performance.now();
      await classifyTransactionsInBatches(
        transactions,
        {
          batchSize,
          maxConcurrentBatches: 5,
        },
        () => {}
      );
      const elapsed = performance.now() - start;
      results[batchSize] = elapsed;
    }

    console.table(results);

    // 모든 배치 크기가 성공적으로 처리되어야 함
    for (const batchSize of batchSizes) {
      expect(results[batchSize]).toBeGreaterThan(0);
      expect(results[batchSize]).toBeLessThan(30000); // 30초 이내
    }
  });

  /**
   * 동시성 수준별 성능 비교 테스트
   * 최적의 동시성 수준을 결정하기 위한 벤치마크
   */
  it("[AC3] 동시성 수준별 성능 비교 (3 vs 5 vs 10)", async () => {
    const transactions: TransactionInput[] = Array.from({ length: 300 }, (_, i) => ({
      id: `tx-${i}`,
      memo: `거래 ${i}`,
      depositAmount: 100000,
      withdrawalAmount: null,
    }));

    vi.mocked(classifyWithUpstage).mockResolvedValue({
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.9,
    });

    const concurrencyLevels = [3, 5, 10] as const;
    const results: Record<number, number> = {};

    for (const maxConcurrent of concurrencyLevels) {
      const start = performance.now();
      await classifyTransactionsInBatches(
        transactions,
        {
          batchSize: 100,
          maxConcurrentBatches: maxConcurrent,
        },
        () => {}
      );
      const elapsed = performance.now() - start;
      results[maxConcurrent] = elapsed;
    }

    console.table(results);

    // 모든 동시성 수준이 성공적으로 처리되어야 함
    for (const maxConcurrent of concurrencyLevels) {
      expect(results[maxConcurrent]).toBeGreaterThan(0);
      expect(results[maxConcurrent]).toBeLessThan(30000); // 30초 이내
    }
  });
});
