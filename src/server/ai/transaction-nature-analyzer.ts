/**
 * Transaction Nature Analyzer Service
 *
 * Story 4.4: 거래 성격 판단
 *
 * 거래의 성격(채권자 관련, 담보 관련, 우선변제 관련, 일반 거래)을 분석합니다.
 */

/**
 * 거래 성격 분류 타입
 */
export type TransactionNatureType =
  | "CREDITOR"
  | "COLLATERAL"
  | "PRIORITY_REPAYMENT"
  | "GENERAL"
  | null;

/**
 * 담보 유형
 */
export type CollateralType = "MORTGAGE" | "LIEN" | "POSSESSION" | null;

/**
 * 거래 성격 분석 결과
 */
export interface TransactionNatureAnalysis {
  nature: TransactionNatureType;
  creditorName?: string;
  collateralType?: CollateralType;
  confidenceScore: number;
  matchedKeywords: string[];
}

/**
 * 채권자 관련 키워드 패턴
 */
const CREDITOR_PATTERNS = [
  { pattern: /김주택/, name: "김주택" },
  { pattern: /신한카드/, name: "신한카드" },
  { pattern: /캐피탈/, name: "캐피탈" },
  { pattern: /저축은행/, name: "저축은행" },
  { pattern: /(삼성|현대|LG|SK)(카드|캐피탈)/, name: null }, // name 추출 필요
  { pattern: /국세/, name: "국세" },
  { pattern: /지방세/, name: "지방세" },
  { pattern: /연금/, name: "연금" },
  { pattern: /보험/, name: "보험" },
];

/**
 * 담보 관련 키워드
 */
const COLLATERAL_KEYWORDS: Record<
  string,
  { keywords: string[]; type: CollateralType }
> = {
  MORTGAGE: {
    keywords: ["저당권", "저당설정", "근저당", "근저당권"],
    type: "MORTGAGE",
  },
  LIEN: { keywords: ["질권", "질권설정"], type: "LIEN" },
  POSSESSION: { keywords: ["유치권", "유치"], type: "POSSESSION" },
};

/**
 * 우선변제 관련 키워드
 */
const PRIORITY_REPAYMENT_KEYWORDS = [
  "우선변제",
  "임차권",
  "대항력",
  "선의의 제3자",
  "전세권",
  "임차권등기",
];

/**
 * CRITICAL 조합 (임차권 + 대항력 등)
 */
const CRITICAL_COMBINATIONS = [
  ["임차권", "대항력"],
  ["전세권", "등기"],
  ["우선변제", "채권자"],
];

/**
 * 키워드 조합이 CRITICAL 조합인지 확인합니다.
 *
 * @param keywords - 매칭된 키워드 배열
 * @returns CRITICAL 조합이면 true
 *
 * @example
 * isCriticalCombination(["임차권", "대항력"]) // true
 * isCriticalCombination(["우선변제"]) // false
 */
export function isCriticalCombination(keywords: string[]): boolean {
  return CRITICAL_COMBINATIONS.some((combination) =>
    combination.every((keyword) => keywords.includes(keyword))
  );
}

/**
 * 단일 거래의 성격을 분석합니다.
 *
 * @param memo - 거래 메모
 * @param amount - 거래 금액
 * @param date - 거래 날짜
 * @returns TransactionNatureAnalysis 분석 결과
 */
export function analyzeTransactionNature(
  memo: string | null | undefined,
  _amount: number,
  _date: Date
): TransactionNatureAnalysis {
  // 초기 결과 (일반 거래)
  const result: TransactionNatureAnalysis = {
    nature: null,
    creditorName: undefined,
    collateralType: undefined,
    confidenceScore: 0,
    matchedKeywords: [],
  };

  // 빈 값 처리
  if (!memo || memo.trim().length === 0) {
    result.nature = "GENERAL";
    result.confidenceScore = 0;
    return result;
  }

  const normalizedMemo = memo.trim();

  // 1. 채권자 관련 거래 감지 (우선순위: 높음)
  for (const { pattern, name } of CREDITOR_PATTERNS) {
    const match = normalizedMemo.match(pattern);
    if (match) {
      result.nature = "CREDITOR";
      result.creditorName = name ?? match[0];
      result.matchedKeywords.push(match[0]);
      result.confidenceScore = 0.9;
      return result;
    }
  }

  // 2. 우선변제 관련 거래 감지 (우선순위: 높음 - CRITICAL)
  const priorityMatches = PRIORITY_REPAYMENT_KEYWORDS.filter((keyword) =>
    normalizedMemo.includes(keyword)
  );

  if (priorityMatches.length > 0) {
    result.nature = "PRIORITY_REPAYMENT";
    result.matchedKeywords = priorityMatches;

    // CRITICAL 조합 확인
    const isCritical = CRITICAL_COMBINATIONS.some((combination) =>
      combination.every((keyword) => normalizedMemo.includes(keyword))
    );

    result.confidenceScore = isCritical ? 1.0 : 0.85;
    return result;
  }

  // 3. 담보 관련 거래 감지 (우선순위: 중간)
  for (const [, { keywords, type: collateralType }] of Object.entries(
    COLLATERAL_KEYWORDS
  )) {
    for (const keyword of keywords) {
      if (normalizedMemo.includes(keyword)) {
        result.nature = "COLLATERAL";
        result.collateralType = collateralType;
        result.matchedKeywords.push(keyword);
        result.confidenceScore = 0.8;
        return result;
      }
    }
  }

  // 4. 일반 거래 (위에 해당하지 않음)
  result.nature = "GENERAL";
  result.confidenceScore = 0.3; // 낮은 신뢰도

  return result;
}

/**
 * 여러 거래를 배치로 분석합니다.
 *
 * @param transactions - 거래 배열
 * @param progressCallback - 진행률 콜백 (선택 사항)
 * @returns Map<transactionId, TransactionNatureAnalysis> 분석 결과 맵
 */
export function analyzeTransactionNatureInBatch(
  transactions: Array<{ id: string; memo: string | null; amount: number; date: Date }>,
  progressCallback?: (current: number, total: number) => void
): Map<string, TransactionNatureAnalysis> {
  const results = new Map<string, TransactionNatureAnalysis>();

  transactions.forEach((transaction, index) => {
    const analysis = analyzeTransactionNature(
      transaction.memo,
      transaction.amount,
      transaction.date
    );

    results.set(transaction.id, analysis);

    // 진행률 콜백 호출
    if (progressCallback) {
      progressCallback(index + 1, transactions.length);
    }
  });

  return results;
}

/**
 * 분석 결과 통계를 계산합니다.
 *
 * @param results - 분석 결과 맵
 * @returns 통계 정보
 */
export function calculateNatureStats(
  results: Map<string, TransactionNatureAnalysis>
): {
  total: number;
  byNature: Record<string, number>;
  averageConfidence: number;
} {
  let totalConfidence = 0;
  const byNature: Record<string, number> = {
    CREDITOR: 0,
    COLLATERAL: 0,
    PRIORITY_REPAYMENT: 0,
    GENERAL: 0,
  };

  for (const result of results.values()) {
    if (result.nature) {
      const nature = result.nature;
      if (nature && byNature[nature] !== undefined) {
        byNature[nature]++;
      }
    }
    totalConfidence += result.confidenceScore;
  }

  return {
    total: results.size,
    byNature,
    averageConfidence: results.size > 0 ? totalConfidence / results.size : 0,
  };
}
