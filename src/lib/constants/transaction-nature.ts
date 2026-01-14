/**
 * Transaction Nature Constants
 *
 * Story 4.4: 거래 성격 판단
 * Story 5.5: 추적 필터링
 *
 * 거래 성격(Enum) 관련 상수 정의
 *
 * @see https://github.com/anthropics/claude-code
 */

import type { TransactionNature } from "@prisma/client";

/**
 * 거래 성격 유형별 라벨 (i18n 호환)
 */
export const TRANSACTION_NATURE_LABELS: Record<TransactionNature, string> = {
  CREDITOR: "채권자 관련",
  COLLATERAL: "담보 관련",
  PRIORITY_REPAYMENT: "우선변제 관련",
  GENERAL: "일반 거래",
} as const;

/**
 * 거래 성감 유형 배열 (필터링용)
 */
export const TRANSACTION_NATURE_TYPES: Array<{
  value: TransactionNature;
  label: string;
}> = [
  { value: "CREDITOR", label: "채권자 관련" },
  { value: "COLLATERAL", label: "담보 관련" },
  { value: "PRIORITY_REPAYMENT", label: "우선변제 관련" },
  { value: "GENERAL", label: "일반 거래" },
] as const;
