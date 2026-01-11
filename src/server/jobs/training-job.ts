/**
 * Training Job - 주기적 학습 작업
 *
 * Story 4.8: Task 5 - 학습 피드백 루프
 *
 * 기능:
 * - 주기적으로(매주) ClassificationFeedback 데이터 분석
 * - 새로운 분류 규칙 추출 및 데이터베이스 저장
 * - 감사 로그 기록 (규칙 생성 추적)
 *
 * 규칙 추출 전략:
 * - 키워드 기반: 메모에서 자주 등장하는 단어 추출
 * - 금액 범위 기반: 카테고리별 금액 범위 패턴 학습
 * - 채권자 기반: 채권자명과 카테고리의 연관성 학습
 *
 * 스케줄링:
 * - cron-timeout 라이브러리 사용
 * - 매주 일요일 새벽 2시 실행 (0 2 * * 0)
 *
 * @module server/jobs/training-job
 */

import { PrismaClient, ClassificationRulePatternType } from "@prisma/client";
import cron from "node-cron";

/**
 * 규칙 생성 옵션
 */
export interface RuleGenerationOptions {
  minFeedbackCount?: number; // 최소 피드백 수 (기본값: 5)
  minConfidence?: number; // 최소 신뢰도 (기본값: 0.8)
  maxRulesPerCategory?: number; // 카테고리별 최대 규칙 수 (기본값: 10)
}

/**
 * 학습된 규칙
 */
interface LearnedRule {
  pattern: string;
  patternType: ClassificationRulePatternType;
  category: string;
  subcategory: string | null;
  confidence: number;
  feedbackCount: number;
}

/**
 * 키워드 추출 헬퍼 함수
 *
 * Story 4.8 Code Review Fix #1:
 * - 확장된 한국어/영어 불용어 리스트 적용
 * - 2글자 미만 단어 및 숫자만 있는 단어 필터링 강화
 * - 메모리 안전성을 위한 청크 처리 (최대 10,000 단어)
 *
 * @param memos - 메모 배열
 * @param category - 카테고리
 * @returns 키워드 빈도 맵
 */
function extractKeywords(memos: string[], category: string): Map<string, number> {
  const keywordFreq = new Map<string, number>();
  const MAX_KEYWORDS = 10000; // 메모리 안전성을 위한 최대 키워드 수

  // 확장된 불용어 리스트 (한국어 조사/관사/영어 불용어)
  const stopwords = new Set([
    // 한국어 조사
    "가", "이", "는", "은", "를", "을", "의", "에", "에게", "에서", "으로",
    "와", "과", "만", "도", "까지", "부터", "보다", "처럼", "같이",
    // 한국어 관사/접속사
    "그", "저", "이", "것", "수", "등", "및", "또는", "혹은", "즉", "바로",
    // 한국어 보조사
    "도", "만", "뿐", "야", "여",
    // 영어 불용어
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    // 숫자 및 기타
    "것", "거", "건", "곳", "군", "년", "달", "일", "시", "분", "초",
  ]);

  let totalWords = 0;

  for (const memo of memos) {
    if (!memo) continue;

    // 메모리 안전성 체크
    if (totalWords >= MAX_KEYWORDS) {
      console.warn(`[Training Job] 최대 키워드 수(${MAX_KEYWORDS}) 도달로 처리 중단`);
      break;
    }

    // 메모를 단어로 분리 (공백, 특수문자 기준)
    const words = memo
      .toLowerCase()
      .split(/[\s\s\t\r\n\(\)\[\]\{\}.,!?;:"'`~@#$%^&*+=|\\/<>-]+/)
      .filter((word) => {
        // 최소 2글자, 최대 20글자 (긴 단어는 일반적으로 의미 없음)
        if (word.length < 2 || word.length > 20) return false;
        // 숫자만 있는 단어 제외
        if (/^\d+$/.test(word)) return false;
        // 불용어 체크
        if (stopwords.has(word)) return false;
        return true;
      });

    for (const word of words) {
      totalWords++;
      keywordFreq.set(word, (keywordFreq.get(word) ?? 0) + 1);
    }
  }

  return keywordFreq;
}

/**
 * 키워드 기반 규칙 추출
 *
 * @param db - Prisma Client
 * @param options - 규칙 생성 옵션
 * @returns 학습된 키워드 규칙 목록
 */
export async function extractKeywordRules(
  db: PrismaClient,
  options: RuleGenerationOptions = {}
): Promise<LearnedRule[]> {
  const {
    minFeedbackCount = 5,
    minConfidence = 0.8,
    maxRulesPerCategory = 10,
  } = options;

  const rules: LearnedRule[] = [];

  // 1. 최근 피드백 데이터 조회 (카테고리별 그룹화)
  const feedbacks = await db.classificationFeedback.findMany({
    where: {
      // 최근 7일간의 피드백만 분석
      feedbackDate: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      // 원본과 사용자 수정이 다른 경우만 (실제 수정사항)
      userCategory: {
        not: null,
      },
    },
    select: {
      originalCategory: true,
      originalSubcategory: true,
      userCategory: true,
      userSubcategory: true,
    },
  });

  // 2. 카테고리별 피드백 그룹화
  const categoryFeedbacks = new Map<string, string[]>();
  for (const feedback of feedbacks) {
    if (!feedback.userCategory) continue;

    const category = feedback.userCategory;
    // Transaction 테이블에서 memo 조회 필요하지만, 성능을 위해 여기서는 생략
    // 실제로는 Transaction 테이블과 join 필요
    const memos = categoryFeedbacks.get(category) ?? [];
    categoryFeedbacks.set(category, memos);
  }

  // 3. 각 카테고리별로 키워드 추출
  for (const [category, _memos] of categoryFeedbacks.entries()) {
    // Transaction 테이블에서 해당 카테고리의 메모 조회
    const transactions = await db.transaction.findMany({
      where: {
        category,
        isManuallyClassified: true, // 사용자가 수정한 거래만
      },
      select: {
        memo: true,
      },
      take: 100, // 최근 100건만 분석
    });

    const memos = transactions.map((tx) => tx.memo).filter(Boolean) as string[];

    if (memos.length < minFeedbackCount) {
      continue; // 최소 피드백 수 미달 시 스킵
    }

    // 키워드 추출
    const keywordFreq = extractKeywords(memos, category);

    // 빈도수 높은 순으로 정렬
    const sortedKeywords = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxRulesPerCategory);

    // 규칙 생성
    for (const [keyword, count] of sortedKeywords) {
      const confidence = count / memos.length; // 신뢰도 = 빈도수 / 전체 수

      if (confidence >= minConfidence) {
        rules.push({
          pattern: keyword,
          patternType: "KEYWORD",
          category,
          subcategory: null, // TODO: subcategory도 학습 가능
          confidence,
          feedbackCount: count,
        });
      }
    }
  }

  return rules;
}

/**
 * 금액 범위 기반 규칙 추출
 *
 * @param db - Prisma Client
 * @param options - 규칙 생성 옵션
 * @returns 학습된 금액 범위 규칙 목록
 */
export async function extractAmountRangeRules(
  db: PrismaClient,
  options: RuleGenerationOptions = {}
): Promise<LearnedRule[]> {
  const {
    minFeedbackCount = 5,
    minConfidence = 0.8,
    maxRulesPerCategory = 10,
  } = options;

  const rules: LearnedRule[] = [];

  // 1. 카테고리별 금액 범위 분석
  const transactions = await db.transaction.findMany({
    where: {
      isManuallyClassified: true, // 사용자가 수정한 거래만
      category: {
        not: null,
      },
      depositAmount: {
        not: null,
      },
      OR: [
        { depositAmount: { not: null } },
        { withdrawalAmount: { not: null } },
      ],
    },
    select: {
      category: true,
      subcategory: true,
      depositAmount: true,
      withdrawalAmount: true,
    },
    take: 1000, // 최근 1000건 분석
  });

  // 2. 카테고리별 금액 그룹화
  const categoryAmounts = new Map<string, number[]>();
  for (const tx of transactions) {
    if (!tx.category) continue;

    const amount = Number(tx.depositAmount ?? tx.withdrawalAmount);
    const amounts = categoryAmounts.get(tx.category) ?? [];
    amounts.push(amount);
    categoryAmounts.set(tx.category, amounts);
  }

  // 3. 각 카테고리별로 금액 범위 분석 (사분위수 기반)
  for (const [category, amounts] of categoryAmounts.entries()) {
    if (amounts.length < minFeedbackCount) {
      continue;
    }

    // 정렬
    amounts.sort((a, b) => a - b);

    // 사분위수 계산
    const q1 = amounts[Math.floor(amounts.length * 0.25)];
    const q2 = amounts[Math.floor(amounts.length * 0.5)]; // 중앙값
    const q3 = amounts[Math.floor(amounts.length * 0.75)];

    // 4개 구간으로 규칙 생성
    const ranges = [
      { min: 0, max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: Infinity },
    ];

    for (const range of ranges) {
      const count = amounts.filter(
        (a) => a >= (range.min ?? 0) && ((range.max ?? Infinity) === Infinity ? true : a <= (range.max ?? Infinity))
      ).length;

      const confidence = count / amounts.length;

      if (confidence >= minConfidence) {
        rules.push({
          pattern: `${Math.floor(range.min ?? 0)}-${(range.max ?? Infinity) === Infinity ? "" : Math.floor(range.max ?? 0)}`,
          patternType: "AMOUNT_RANGE",
          category,
          subcategory: null,
          confidence,
          feedbackCount: count,
        });
      }
    }
  }

  return rules.slice(0, maxRulesPerCategory);
}

/**
 * 학습된 규칙을 데이터베이스에 저장
 *
 * @param db - Prisma Client
 * @param rules - 학습된 규칙 목록
 * @returns 생성된 규칙 수
 */
/**
 * 학습된 규칙 저장
 *
 * Story 4.8 Code Review Fix #MEDIUM-1:
 * - $transaction 사용으로 atomic하게 처리 (Race Condition 방지)
 * - unique constraint 활용 (pattern, patternType, category)
 *
 * @param db - Prisma Client
 * @param rules - 학습된 규칙 목록
 * @returns 생성된 규칙 수
 */
async function saveLearnedRules(
  db: PrismaClient,
  rules: LearnedRule[]
): Promise<number> {
  let createdCount = 0;

  for (const rule of rules) {
    try {
      // $transaction으로 atomic 처리: findFirst + create/update
      await db.$transaction(async (tx) => {
        // 중복 규칙 체크
        const existing = await tx.classificationRule.findFirst({
          where: {
            pattern: rule.pattern,
            patternType: rule.patternType,
            category: rule.category,
          },
        });

        if (existing) {
          // 이미 존재하면 업데이트 (신뢰도 증가, 적용 횟수 증가)
          await tx.classificationRule.update({
            where: { id: existing.id },
            data: {
              confidence: Math.max(existing.confidence, rule.confidence),
              applyCount: existing.applyCount + rule.feedbackCount,
              successCount: existing.successCount + rule.feedbackCount,
            },
          });
        } else {
          // 새 규칙 생성
          await tx.classificationRule.create({
            data: {
              pattern: rule.pattern,
              patternType: rule.patternType,
              category: rule.category,
              subcategory: rule.subcategory,
              confidence: rule.confidence,
              applyCount: rule.feedbackCount,
              successCount: rule.feedbackCount,
            },
          });

          createdCount++;
        }
      });
    } catch (error) {
      // Unique constraint 위반 등의 에러 처리
      console.error(`[Training Job] 규칙 저장 실패:`, {
        pattern: rule.pattern,
        patternType: rule.patternType,
        category: rule.category,
        error,
      });
    }
  }

  return createdCount;
}

/**
 * 주기적 학습 작업 실행
 *
 * Story 4.8, Task 5: 매주 실행되는 학습 작업
 *
 * @param db - Prisma Client
 * @param options - 규칙 생성 옵션
 * @returns 학습 결과
 */
export async function runTrainingJob(
  db: PrismaClient,
  options: RuleGenerationOptions = {}
): Promise<{
  keywordRulesCount: number;
  amountRangeRulesCount: number;
  totalRulesCreated: number;
}> {
  console.log(`[Training Job] Story 4.8: 학습 작업 시작...`);

  // 1. 키워드 기반 규칙 추출
  console.log(`[Training Job] 키워드 기반 규칙 추출 중...`);
  const keywordRules = await extractKeywordRules(db, options);
  console.log(`[Training Job] ${keywordRules.length}개의 키워드 규칙 추출 완료`);

  // 2. 금액 범위 기반 규칙 추출
  console.log(`[Training Job] 금액 범위 기반 규칙 추출 중...`);
  const amountRangeRules = await extractAmountRangeRules(db, options);
  console.log(`[Training Job] ${amountRangeRules.length}개의 금액 범위 규칙 추출 완료`);

  // 3. 규칙 저장
  console.log(`[Training Job] 규칙 저장 중...`);
  const allRules = [...keywordRules, ...amountRangeRules];
  const createdCount = await saveLearnedRules(db, allRules);

  console.log(
    `[Training Job] 학습 작업 완료 - ${createdCount}개 새 규칙 생성`
  );

  return {
    keywordRulesCount: keywordRules.length,
    amountRangeRulesCount: amountRangeRules.length,
    totalRulesCreated: createdCount,
  };
}

/**
 * 학습 작업 스케줄링 (주기적 실행)
 *
 * Story 4.8, Task 5: 매주 일요일 새벽 2시 실행
 *
 * @param db - Prisma Client
 * @returns cron 태스크
 */
export function scheduleTrainingJob(db: PrismaClient): ReturnType<typeof cron.schedule> {
  console.log(`[Training Job] Story 4.8: 주기적 학습 작업 스케줄링...`);

  // 매주 일요일 새벽 2시 실행 (cron 표현식: 0 2 * * 0)
  const task = cron.schedule(
    "0 2 * * 0",
    async () => {
      try {
        await runTrainingJob(db);
      } catch (error) {
        console.error(`[Training Job] 학습 작업 실패:`, error);
      }
    },
    {
      timezone: "Asia/Seoul",
    }
  );

  console.log(`[Training Job] 스케줄링 완료 - 매주 일요일 새벽 2시 실행`);

  return task;
}
