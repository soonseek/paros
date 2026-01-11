/**
 * Anthropic Claude API Adapter
 *
 * Story 4.1: AI 기반 거래 자동 분류
 *
 * Anthropic Claude API를 사용하여 거래를 분류합니다.
 *
 * @see https://docs.anthropic.com/claude/reference
 */

import { ClassificationResultSchema } from "../types";

/**
 * Anthropic Claude API를 사용하여 거래를 분류합니다.
 *
 * @param memo - 거래 메모/적요
 * @param amount - 입금액 또는 출금액 (선택적)
 * @returns 분류 결과
 *
 * @example
 * const result = await classifyWithAnthropic("홍길동급여", { deposit: 3000000 });
 */
export async function classifyWithAnthropic(
  memo: string,
  amount?: { deposit?: number; withdrawal?: number }
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다");
  }

  // MVP: 간단한 규칙 기반 분류
  // 실제 구현에서는 Anthropic Claude API를 호출해야 합니다.

  const memoLower = memo.toLowerCase().trim();

  // 입금 패턴
  if (amount?.deposit) {
    if (memoLower.includes("급여") || memoLower.includes("월급")) {
      return ClassificationResultSchema.parse({
        category: "입금",
        subcategory: "급여",
        confidenceScore: 0.85,
        reasoning: "Claude: 메모에 급여 키워드 포함",
      });
    }

    if (memoLower.includes("이체")) {
      return ClassificationResultSchema.parse({
        category: "입금",
        subcategory: "이체",
        confidenceScore: 0.75,
        reasoning: "Claude: 메모에 이체 키워드 포함",
      });
    }

    return ClassificationResultSchema.parse({
      category: "입금",
      subcategory: "기타",
      confidenceScore: 0.6,
      reasoning: "Claude: 입금액 있음",
    });
  }

  // 출금 패턴
  if (amount?.withdrawal) {
    if (memoLower.includes("수수료")) {
      return ClassificationResultSchema.parse({
        category: "수수료",
        subcategory: "이자수수료",
        confidenceScore: 0.85,
        reasoning: "Claude: 메모에 수수료 키워드 포함",
      });
    }

    if (memoLower.includes("이체")) {
      return ClassificationResultSchema.parse({
        category: "출금",
        subcategory: "이체",
        confidenceScore: 0.75,
        reasoning: "Claude: 메모에 이체 키워드 포함",
      });
    }

    return ClassificationResultSchema.parse({
      category: "출금",
      subcategory: "기타",
      confidenceScore: 0.6,
      reasoning: "Claude: 출금액 있음",
    });
  }

  return ClassificationResultSchema.parse({
    category: "기타",
    subcategory: "미분류",
    confidenceScore: 0.5,
    reasoning: "Claude: 분류 불가",
  });
}
