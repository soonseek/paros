/**
 * Rule-Based Classifier Service
 *
 * Story 4.8: Task 3 - 학습 피드백 루프
 *
 * 기능:
 * - 데이터베이스에서 학습된 분류 규칙을 로드
 * - 규칙 기반으로 거래 분류 (AI API 호출 전 단계)
 * - 규칙 적용 통계 추적 (applyCount, successCount, lastAppliedAt)
 *
 * 규칙 패턴 타입:
 * - KEYWORD: 메모(memo)의 키워드 매칭
 * - AMOUNT_RANGE: 입금/출금액 범위 매칭
 * - CREDITOR: 채권자명 매칭
 *
 * 성능 최적화:
 * - 활성 규칙만 로드 (isActive = true)
 * - 규칙 적용 순서: confidence 내림차순 (신뢰도 높은 규칙 우선)
 *
 * @module server/ai/rule-based-classifier
 */

import { PrismaClient, ClassificationRulePatternType } from "@prisma/client";
import type { ClassificationResult } from "./types";

/**
 * 분류할 거래 입력
 */
export interface RuleBasedTransactionInput {
  id: string;
  memo: string | null;
  depositAmount: number | null;
  withdrawalAmount: number | null;
  creditorName?: string | null; // Story 4.4: 채권자명
}

/**
 * 규칙 기반 분류 결과
 */
export interface RuleBasedClassificationResult {
  transactionId: string;
  matched: boolean;
  result?: ClassificationResult;
  appliedRuleId?: string;
}

/**
 * 규칙 매칭 결과 (내부용)
 */
interface RuleMatch {
  ruleId: string;
  category: string;
  subcategory: string | null;
  confidence: number;
}

/**
 * 활성 분류 규칙 (확장 타입)
 */
interface ActiveClassificationRule {
  id: string;
  pattern: string;
  patternType: ClassificationRulePatternType;
  category: string;
  subcategory: string | null;
  confidence: number;
  applyCount: number;
  successCount: number;
}

/**
 * 키워드 규칙으로 거래 분류
 *
 * @param transaction - 분류할 거래
 * @param rules - 키워드 규칙 목록
 * @returns 매칭된 규칙 또는 null
 */
export function matchKeywordRule(
  transaction: RuleBasedTransactionInput,
  rules: ActiveClassificationRule[]
): RuleMatch | null {
  if (!transaction.memo) {
    return null;
  }

  const memo = transaction.memo.toLowerCase();

  // confidence 내림차순 정렬 (신뢰도 높은 규칙 우선)
  const sortedRules = rules.sort((a, b) => b.confidence - a.confidence);

  for (const rule of sortedRules) {
    const keyword = rule.pattern.toLowerCase();

    if (memo.includes(keyword)) {
      return {
        ruleId: rule.id,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: rule.confidence,
      };
    }
  }

  return null;
}

/**
 * 금액 범위 규칙으로 거래 분류
 *
 * @param transaction - 분류할 거래
 * @param rules - 금액 범위 규칙 목록
 * @returns 매칭된 규칙 또는 null
 *
 * 패턴 형식: "MIN-MAX" (예: "1000000-5000000" = 100만~500만 원)
 */
export function matchAmountRangeRule(
  transaction: RuleBasedTransactionInput,
  rules: ActiveClassificationRule[]
): RuleMatch | null {
  const amount =
    transaction.depositAmount ?? transaction.withdrawalAmount ?? null;

  if (!amount) {
    return null;
  }

  // confidence 내림차순 정렬
  const sortedRules = rules.sort((a, b) => b.confidence - a.confidence);

  for (const rule of sortedRules) {
    // 패턴 파싱: "MIN-MAX" 형식
    const match = rule.pattern.match(/^(\d+)-(\d+)$/);
    if (!match) {
      console.warn(`[rule-based-classifier] Invalid amount range pattern: ${rule.pattern}`);
      continue;
    }

    const min = Number(match[1]);
    const max = Number(match[2]);

    if (amount >= min && amount <= max) {
      return {
        ruleId: rule.id,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: rule.confidence,
      };
    }
  }

  return null;
}

/**
 * 채권자 규칙으로 거래 분류
 *
 * @param transaction - 분류할 거래
 * @param rules - 채권자 규칙 목록
 * @returns 매칭된 규칙 또는 null
 */
export function matchCreditorRule(
  transaction: RuleBasedTransactionInput,
  rules: ActiveClassificationRule[]
): RuleMatch | null {
  if (!transaction.creditorName) {
    return null;
  }

  const creditorName = transaction.creditorName.toLowerCase();

  // confidence 내림차순 정렬
  const sortedRules = rules.sort((a, b) => b.confidence - a.confidence);

  for (const rule of sortedRules) {
    const pattern = rule.pattern.toLowerCase();

    if (creditorName.includes(pattern)) {
      return {
        ruleId: rule.id,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: rule.confidence,
      };
    }
  }

  return null;
}

/**
 * 규칙 기반 분류 실행
 *
 * @param db - Prisma Client
 * @param transactions - 분류할 거래 목록
 * @returns 규칙 기반 분류 결과 맵
 */
export async function classifyWithRules(
  db: PrismaClient,
  transactions: RuleBasedTransactionInput[]
): Promise<Map<string, RuleBasedClassificationResult>> {
  const results = new Map<string, RuleBasedClassificationResult>();

  // 1. 활성 규칙 로드 (성능 최적화: 한 번만 조회)
  const activeRules = await db.classificationRule.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      pattern: true,
      patternType: true,
      category: true,
      subcategory: true,
      confidence: true,
      applyCount: true,
      successCount: true,
    },
  });

  // 2. 패턴 타입별 규칙 그룹화
  const keywordRules = activeRules.filter(
    (rule) => rule.patternType === "KEYWORD"
  );
  const amountRangeRules = activeRules.filter(
    (rule) => rule.patternType === "AMOUNT_RANGE"
  );
  const creditorRules = activeRules.filter(
    (rule) => rule.patternType === "CREDITOR"
  );

  // 3. 각 거래에 대해 규칙 매칭 시도
  for (const transaction of transactions) {
    let match: RuleMatch | null = null;

    // 규칙 적용 순서: KEYWORD → AMOUNT_RANGE → CREDITOR
    if (keywordRules.length > 0) {
      match = matchKeywordRule(transaction, keywordRules);
    }

    if (!match && amountRangeRules.length > 0) {
      match = matchAmountRangeRule(transaction, amountRangeRules);
    }

    if (!match && creditorRules.length > 0) {
      match = matchCreditorRule(transaction, creditorRules);
    }

    // 4. 결과 저장
    if (match) {
      results.set(transaction.id, {
        transactionId: transaction.id,
        matched: true,
        result: {
          category: match.category,
          subcategory: match.subcategory ?? "",
          confidenceScore: match.confidence,
        },
        appliedRuleId: match.ruleId,
      });

      // 5. 규칙 적용 통계 업데이트 (비동기)
      void db.classificationRule.update({
        where: { id: match.ruleId },
        data: {
          applyCount: { increment: 1 },
          successCount: { increment: 1 },
          lastAppliedAt: new Date(),
        },
      });
    } else {
      results.set(transaction.id, {
        transactionId: transaction.id,
        matched: false,
      });
    }
  }

  return results;
}

/**
 * 단일 거래를 규칙으로 분류 (헬퍼 함수)
 *
 * @param db - Prisma Client
 * @param transaction - 분류할 거래
 * @returns 규칙 기반 분류 결과
 */
export async function classifySingleTransactionWithRules(
  db: PrismaClient,
  transaction: RuleBasedTransactionInput
): Promise<RuleBasedClassificationResult> {
  const results = await classifyWithRules(db, [transaction]);
  return results.get(transaction.id) ?? {
    transactionId: transaction.id,
    matched: false,
  };
}
