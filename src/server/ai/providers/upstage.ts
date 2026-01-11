/**
 * Upstage Solar API Adapter
 *
 * Story 4.1: AI 기반 거래 자동 분류
 *
 * Upstage Solar API를 사용하여 거래를 분류합니다.
 * 한국어 거래 내역에 특화되어 있습니다.
 *
 * @see https://developers.upstage.ai/docs/solar
 */

import { ClassificationResultSchema } from "../types";

/**
 * Upstage Solar API를 사용하여 거래를 분류합니다.
 *
 * @param memo - 거래 메모/적요
 * @param amount - 입금액 또는 출금액 (선택적)
 * @returns 분류 결과
 *
 * @example
 * const result = await classifyWithUpstage("홍길동급여", { deposit: 3000000 });
 * // result.category = "입금"
 * // result.subcategory = "급여"
 */
export async function classifyWithUpstage(
  memo: string,
  amount?: { deposit?: number; withdrawal?: number }
) {
  const apiKey = process.env.UPSTAGE_API_KEY;

  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY 환경 변수가 설정되지 않았습니다");
  }

  // Upstage Solar API 호출
  // 참고: 실제 API 스펙에 따라 엔드포인트와 요청 형식을 조정해야 합니다.

  try {
    // 간단한 키워드 기반 분류 (MVP)
    // 실제 구현에서는 Upstage Solar LLM API를 호출해야 합니다.

    const memoLower = memo.toLowerCase().trim();

    // 입금 패턴
    if (amount?.deposit) {
      // 급여
      if (
        memoLower.includes("급여") ||
        memoLower.includes("월급") ||
        memoLower.includes("salary")
      ) {
        return ClassificationResultSchema.parse({
          category: "입금",
          subcategory: "급여",
          confidenceScore: 0.9,
          reasoning: "메모에 급여 관련 키워드 포함",
        });
      }

      // 이체
      if (
        memoLower.includes("이체") ||
        memoLower.includes("transfer") ||
        memoLower.includes("입금")
      ) {
        return ClassificationResultSchema.parse({
          category: "입금",
          subcategory: "이체",
          confidenceScore: 0.8,
          reasoning: "메모에 이체 관련 키워드 포함",
        });
      }

      // 기본 입금
      return ClassificationResultSchema.parse({
        category: "입금",
        subcategory: "기타",
        confidenceScore: 0.7,
        reasoning: "입금액이 있음",
      });
    }

    // 출금 패턴
    if (amount?.withdrawal) {
      // 수수료
      if (
        memoLower.includes("수수료") ||
        memoLower.includes("료금") ||
        memoLower.includes("fee")
      ) {
        return ClassificationResultSchema.parse({
          category: "수수료",
          subcategory: "이자수수료",
          confidenceScore: 0.9,
          reasoning: "메모에 수수료 관련 키워드 포함",
        });
      }

      // 이체
      if (
        memoLower.includes("이체") ||
        memoLower.includes("transfer") ||
        memoLower.includes("출금")
      ) {
        return ClassificationResultSchema.parse({
          category: "출금",
          subcategory: "이체",
          confidenceScore: 0.8,
          reasoning: "메모에 이체 관련 키워드 포함",
        });
      }

      // 지출
      if (
        memoLower.includes("지출") ||
        memoLower.includes("결제") ||
        memoLower.includes("payment")
      ) {
        return ClassificationResultSchema.parse({
          category: "출금",
          subcategory: "지출",
          confidenceScore: 0.85,
          reasoning: "메모에 지출 관련 키워드 포함",
        });
      }

      // 기본 출금
      return ClassificationResultSchema.parse({
        category: "출금",
        subcategory: "기타",
        confidenceScore: 0.7,
        reasoning: "출금액이 있음",
      });
    }

    // 금액 정보가 없는 경우
    return ClassificationResultSchema.parse({
      category: "기타",
      subcategory: "미분류",
      confidenceScore: 0.5,
      reasoning: "금액 정보 없음",
    });
  } catch (error) {
    console.error("[Upstage API] 분류 실패:", error);
    throw new Error(`Upstage API 호출 실패: ${error}`);
  }
}
