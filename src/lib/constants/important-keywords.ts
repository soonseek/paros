/**
 * Important Transaction Keywords Constants
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * 중요 거래 유형별 키워드 정의
 * 키워드 매칭을 통해 대출 실행, 변제, 담보, 압류 등 중요 거래 자동 식별
 *
 * @see https://github.com/anthropics/claude-code
 */

/**
 * 중요 거래 키워드 상수
 *
 * 각 유형별로 매칭할 키워드 목록 정의
 * 대소문자 무시하고 부분 일치로 검색
 */
export const IMPORTANT_TRANSACTION_KEYWORDS = {
  /** 대출 실행 관련 키워드 */
  LOAN_EXECUTION: ['대출 실행', '대출금', '실행'],

  /** 변제/상환 관련 키워드 */
  REPAYMENT: ['변제', '상환', '갚음'],

  /** 담보 관련 키워드 */
  COLLATERAL: ['담보제공', '담보설정', '저당권'],

  /** 압류 관련 키워드 */
  SEIZURE: ['압류', '가압류'],
} as const;

/**
 * 중요 거래 유형 Enum
 */
export type ImportantTransactionType =
  | 'LOAN_EXECUTION'
  | 'REPAYMENT'
  | 'COLLATERAL'
  | 'SEIZURE';

/**
 * 중요 거래 유형별 한국어 라벨
 */
export const IMPORTANT_TRANSACTION_TYPE_LABELS: Record<
  ImportantTransactionType,
  string
> = {
  LOAN_EXECUTION: '대출 실행',
  REPAYMENT: '변제',
  COLLATERAL: '담보',
  SEIZURE: '압류',
} as const;

/**
 * 키워드 매칭 유틸리 함수
 *
 * @param memo - 거래 메모
 * @param type - 중요 거래 유형
 * @returns 매칭된 키워드가 있으면 true, 없으면 false
 */
export function matchImportantTransactionKeyword(
  memo: string,
  type: ImportantTransactionType
): boolean {
  if (!memo) return false;

  const keywords = IMPORTANT_TRANSACTION_KEYWORDS[type];
  const lowerMemo = memo.toLowerCase();

  return keywords.some((keyword) => lowerMemo.includes(keyword.toLowerCase()));
}

/**
 * 메모에서 중요 거래 유형 감지
 *
 * @param memo - 거래 메모
 * @returns 매칭된 중요 거래 유형 또는 null
 */
export function detectImportantTransactionType(
  memo: string
): ImportantTransactionType | null {
  if (!memo) return null;

  for (const type of Object.keys(
    IMPORTANT_TRANSACTION_KEYWORDS
  ) as ImportantTransactionType[]) {
    if (matchImportantTransactionKeyword(memo, type)) {
      return type;
    }
  }

  return null;
}

/**
 * 메모에서 매칭된 모든 키워드 추출
 *
 * @param memo - 거래 메모
 * @returns 매칭된 키워드 배열
 */
export function extractMatchedKeywords(memo: string): string[] {
  if (!memo) return [];

  const matched: string[] = [];
  const lowerMemo = memo.toLowerCase();

  for (const type of Object.keys(
    IMPORTANT_TRANSACTION_KEYWORDS
  ) as ImportantTransactionType[]) {
    const keywords = IMPORTANT_TRANSACTION_KEYWORDS[type];

    for (const keyword of keywords) {
      if (lowerMemo.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    }
  }

  return matched;
}
