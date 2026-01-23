/**
 * 거래내역 정규화 (Transaction Normalizer)
 * 
 * 다양한 형식의 거래내역서를 통일된 형식으로 변환합니다.
 * 
 * 표준 출력 형식:
 * - 거래일자 (transactionDate)
 * - 구분 (type: '입금' | '출금')
 * - 금액 (amount: number, 입금은 +, 출금은 -)
 * - 잔액 (balance: number)
 * - 비고 (memo: string)
 */

export interface NormalizedTransaction {
  transactionDate: string;
  type: '입금' | '출금';
  amount: number;
  balance: number;
  memo: string;
  originalData?: Record<string, any>;
}

export interface ColumnMapping {
  date?: string;
  withdrawalAmount?: string;
  depositAmount?: string;
  balance?: string;
  memo?: string;
  transactionType?: string;
}

/**
 * 컬럼명에서 역할 자동 감지
 */
export function detectColumnRoles(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, ''));
  
  for (let i = 0; i < headers.length; i++) {
    const header = lowerHeaders[i];
    const original = headers[i];
    
    // 날짜 컬럼 감지
    if (!mapping.date) {
      if (
        header.includes('거래일') || 
        header.includes('일자') || 
        header.includes('date')
      ) {
        mapping.date = original;
      }
    }
    
    // 출금 컬럼 감지
    if (!mapping.withdrawalAmount) {
      if (
        header.includes('지급') ||
        header.includes('찾으신') ||
        header.includes('출금') ||
        header.includes('차감') ||
        (header.includes('거래금액') && !header.includes('후'))
      ) {
        mapping.withdrawalAmount = original;
      }
    }
    
    // 입금 컬럼 감지
    if (!mapping.depositAmount) {
      if (
        header.includes('입금') ||
        header.includes('맡기신') ||
        header.includes('수금') ||
        header.includes('충전')
      ) {
        mapping.depositAmount = original;
      }
    }
    
    // 잔액 컬럼 감지
    if (!mapping.balance) {
      if (
        header.includes('잔액') ||
        header.includes('balance') ||
        header.includes('거래후잔액')
      ) {
        mapping.balance = original;
      }
    }
    
    // 거래구분 컬럼 (카카오페이 방식)
    if (!mapping.transactionType) {
      if (
        header.includes('거래구분') ||
        header.includes('구분')
      ) {
        mapping.transactionType = original;
      }
    }
  }
  
  return mapping;
}

/**
 * 비고 컬럼 자동 감지
 * 비고는 주로 텍스트가 많고, 숫자 데이터가 적은 컬럼
 */
export function detectMemoColumn(
  headers: string[],
  rows: Record<string, any>[],
  mapping: ColumnMapping
): string | undefined {
  const excludedColumns = new Set([
    mapping.date,
    mapping.withdrawalAmount,
    mapping.depositAmount,
    mapping.balance,
    mapping.transactionType,
  ].filter(Boolean));
  
  const candidates = headers.filter(h => !excludedColumns.has(h));
  
  // 비고 가능성이 높은 키워드
  const memoKeywords = ['비고', '내용', '적요', '계좌정보', '결제정보', 'memo', 'description', 'remark'];
  
  // 1. 키워드 매칭 우선
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase().replace(/\s+/g, '');
    for (const keyword of memoKeywords) {
      if (lower.includes(keyword)) {
        return candidate;
      }
    }
  }
  
  // 2. 데이터 분석: 가장 텍스트가 많은 컬럼 선택
  const textScores = candidates.map(col => {
    let score = 0;
    const sampleSize = Math.min(10, rows.length);
    
    for (let i = 0; i < sampleSize; i++) {
      const value = rows[i]?.[col];
      if (typeof value === 'string') {
        // 한글 문자 수
        const koreanChars = (value.match(/[가-힣]/g) || []).length;
        // 영문 단어 수
        const words = value.split(/\s+/).length;
        // 숫자만 있으면 점수 감소
        const isNumericOnly = /^\d+$/.test(value.trim());
        
        if (isNumericOnly) {
          score -= 10;
        } else {
          score += koreanChars + words;
        }
      }
    }
    
    return { col, score };
  });
  
  textScores.sort((a, b) => b.score - a.score);
  
  return textScores[0]?.score > 0 ? textScores[0].col : undefined;
}

/**
 * 금액 문자열을 숫자로 변환
 */
function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value)
    .replace(/[,₩W\s]/g, '')
    .replace(/\+/g, '')
    .replace(/-/g, '');
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * 날짜 문자열 정규화
 */
function normalizeDate(value: any): string {
  if (!value) return '';
  
  const str = String(value).trim();
  
  // YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  // YYYY.MM.DD 형식
  if (/^\d{4}\.\d{2}\.\d{2}/.test(str)) {
    return str.substring(0, 10).replace(/\./g, '-');
  }
  
  // YYYYMMDD 형식
  if (/^\d{8}/.test(str)) {
    const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  
  return str;
}

/**
 * 거래 타입 및 금액 결정
 * 
 * 특이점 1 처리: 
 * - 1번 문서: 지급금액에 숫자면 출금, 입금금액에 숫자면 입금
 * - 2번 문서: 찾으신금액이면 출금, 맡기신금액이면 입금
 * - 3번 문서: 거래구분의 [+]/[-] 기호로 판단
 */
function determineTypeAndAmount(
  row: Record<string, any>,
  mapping: ColumnMapping
): { type: '입금' | '출금'; amount: number } {
  // 카카오페이 방식 (거래구분 컬럼 사용)
  if (mapping.transactionType) {
    const typeValue = String(row[mapping.transactionType] || '');
    const isDeposit = typeValue.includes('+') || typeValue.includes('입금') || typeValue.includes('충전') || typeValue.includes('받기') || typeValue.includes('적립');
    const amount = parseAmount(row[mapping.withdrawalAmount || ''] || row['거래금액'] || 0);
    
    return {
      type: isDeposit ? '입금' : '출금',
      amount: isDeposit ? amount : -amount
    };
  }
  
  // 일반 방식 (입금/출금 컬럼 분리)
  const withdrawalAmount = parseAmount(row[mapping.withdrawalAmount || ''] || 0);
  const depositAmount = parseAmount(row[mapping.depositAmount || ''] || 0);
  
  // 입금이 있으면 입금
  if (depositAmount > 0) {
    return { type: '입금', amount: depositAmount };
  }
  
  // 출금이 있으면 출금
  if (withdrawalAmount > 0) {
    return { type: '출금', amount: -withdrawalAmount };
  }
  
  // 둘 다 없으면 기본값
  return { type: '출금', amount: 0 };
}

/**
 * 비고 추출
 * 
 * 특이점 1 처리:
 * - 1번 문서의 경우 입금이면 지급금액 컬럼에서, 출금이면 입금금액 컬럼에서 비고를 가져옴
 */
function extractMemo(
  row: Record<string, any>,
  type: '입금' | '출금',
  mapping: ColumnMapping,
  memoColumn?: string
): string {
  // 1. 명시적 비고 컬럼이 있으면 사용
  if (memoColumn && row[memoColumn]) {
    return String(row[memoColumn]).trim();
  }
  
  // 2. 특이점 1 처리: 1번 문서 방식
  // 입금이면 출금 컬럼에서, 출금이면 입금 컬럼에서 비고 찾기
  if (type === '입금' && mapping.withdrawalAmount) {
    const value = row[mapping.withdrawalAmount];
    if (value && typeof value === 'string' && isNaN(parseFloat(value.replace(/[,₩W\s]/g, '')))) {
      return value.trim();
    }
  }
  
  if (type === '출금' && mapping.depositAmount) {
    const value = row[mapping.depositAmount];
    if (value && typeof value === 'string' && isNaN(parseFloat(value.replace(/[,₩W\s]/g, '')))) {
      return value.trim();
    }
  }
  
  // 3. 적요 또는 내용 컬럼 찾기
  const contentKeys = ['적요', '내용', 'description', 'content'];
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase().replace(/\s+/g, '');
    for (const contentKey of contentKeys) {
      if (lowerKey.includes(contentKey)) {
        return String(row[key] || '').trim();
      }
    }
  }
  
  return '';
}

/**
 * 거래내역 정규화
 */
export function normalizeTransactions(
  rows: Record<string, any>[],
  headers: string[]
): NormalizedTransaction[] {
  if (!rows || rows.length === 0) return [];
  
  // 1. 컬럼 역할 자동 감지
  const mapping = detectColumnRoles(headers);
  
  console.log('[Normalizer] Column mapping:', mapping);
  
  // 2. 비고 컬럼 감지
  const memoColumn = detectMemoColumn(headers, rows, mapping);
  
  console.log('[Normalizer] Memo column:', memoColumn);
  
  // 3. 각 행 정규화
  const normalized: NormalizedTransaction[] = [];
  
  for (const row of rows) {
    try {
      // 날짜
      const transactionDate = normalizeDate(row[mapping.date || ''] || '');
      if (!transactionDate) continue; // 날짜 없으면 스킵
      
      // 타입 및 금액 결정
      const { type, amount } = determineTypeAndAmount(row, mapping);
      
      // 잔액
      const balance = parseAmount(row[mapping.balance || ''] || 0);
      
      // 비고
      const memo = extractMemo(row, type, mapping, memoColumn);
      
      normalized.push({
        transactionDate,
        type,
        amount,
        balance,
        memo,
        originalData: row
      });
    } catch (error) {
      console.error('[Normalizer] Error processing row:', error, row);
    }
  }
  
  console.log(`[Normalizer] Normalized ${normalized.length} transactions`);
  
  return normalized;
}
