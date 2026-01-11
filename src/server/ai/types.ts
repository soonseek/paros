/**
 * AI Classification Types
 *
 * Story 4.1: AI 기반 거래 자동 분류
 *
 * 타입 정의:
 * - ClassificationResult: AI 분류 결과
 * - TransactionInput: 분류를 위한 거래 입력
 * - AIProvider: 지원되는 AI 공급자
 */

import { z } from "zod";

/**
 * Zod 스키마: 분류 결과 검증
 * Story 4.1, MEDIUM-7 FIX: confidenceScore 범위 검증 (0.0 ~ 1.0)
 * Story 4.4: 거래 성격 판단 필드 추가 (transactionNature, creditorName, collateralType, natureConfidenceScore)
 */
export const ClassificationResultSchema = z.object({
  category: z.string().min(1, "카테고리는 필수입니다"),
  subcategory: z.string().min(1, "서브카테고리는 필수입니다"),
  confidenceScore: z
    .number()
    .min(0, "신뢰도는 0.0 이상이어야 합니다")
    .max(1, "신뢰도는 1.0 이하여야 합니다"),
  reasoning: z.string().optional(),
  // Story 4.3: 중요 거래 식별
  importantTransaction: z.boolean().optional(),
  importantTransactionType: z
    .enum(["LOAN_EXECUTION", "REPAYMENT", "COLLATERAL", "SEIZURE"])
    .nullable()
    .optional(),
  matchedKeywords: z.array(z.string()).optional(),
  // Story 4.4: 거래 성격 판단
  transactionNature: z
    .enum(["CREDITOR", "COLLATERAL", "PRIORITY_REPAYMENT", "GENERAL"])
    .nullable()
    .optional(),
  creditorName: z.string().nullable().optional(),
  collateralType: z.string().nullable().optional(),
  natureConfidenceScore: z.number().min(0).max(1).optional(),
});

/**
 * AI 분류 결과 (Zod 스키마에서 추론)
 */
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * 분류를 위한 거래 입력
 * Story 4.4: transactionDate 필드 추가
 */
export interface TransactionInput {
  /** 거래 ID */
  id: string;
  /** 거래 메모/적요 */
  memo: string | null;
  /** 입금액 */
  depositAmount: number | null;
  /** 출금액 */
  withdrawalAmount: number | null;
  /** 거래 날짜 (Story 4.4) */
  transactionDate?: Date;
}

/**
 * 지원되는 AI 공급자
 */
export type AIProvider = "upstage" | "openai" | "anthropic";

/**
 * AI 공급자별 설정
 */
export interface AIProviderConfig {
  /** 공급자 이름 */
  provider: AIProvider;
  /** API 키 */
  apiKey: string;
  /** API URL */
  apiUrl: string;
  /** 모델 이름 (선택적) */
  model?: string;
  /** 타임아웃 (ms) */
  timeout: number;
}

/**
 * 재시도 옵션
 */
export interface RetryOptions {
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 초기 지연 시간 (ms) */
  initialDelay: number;
  /** 지수 백오프 배수 */
  backoffMultiplier: number;
}

/**
 * 일괄 처리 옵션
 */
export interface BatchOptions {
  /** 배치 크기 */
  batchSize: number;
  /** 최대 동시 배치 수 */
  maxConcurrentBatches: number;
}

/**
 * Zod 스키마: 중요 거래 감지 결과 검증
 * Story 4.3: 중요 거래 자동 식별
 */
export const ImportantTransactionDetectionResultSchema = z.object({
  isImportant: z.boolean(),
  type: z.enum(["LOAN_EXECUTION", "REPAYMENT", "COLLATERAL", "SEIZURE"]).nullable(),
  matchedKeywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

/**
 * 중요 거래 감지 결과 (Zod 스키마에서 추론)
 * Story 4.3: 중요 거래 자동 식별
 */
export type ImportantTransactionDetectionResult = z.infer<
  typeof ImportantTransactionDetectionResultSchema
>;
