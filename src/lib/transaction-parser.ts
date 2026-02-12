/**
 * Transaction Parser - Standardized 3-Type Bank Statement Parser
 *
 * Parses 3 different types of Korean bank statements into a standardized format:
 * - Type 1: 거래일자, 일련번호, 적요, 상태, 지급금액, 입금금액, 잔액, 취급점, 시각, Teller
 * - Type 2: 거래일자, 내용, 찾으신금액, 맡기신금액, 비고, 잔액, 후송, 마감후, 키, 기번, 점, 점명
 * - Type 3: No, 거래일시, 거래구분, 거래금액, 거래후잔액, 은행, 계좌정보/결제정보
 *
 * Standard Output: 거래일자, 구분(입금/출금), 금액(+/-), 잔액, 비고
 *
 * Key Features:
 * - Auto-detects memo column based on content analysis
 * - Flexible deposit/withdrawal detection
 * - Handles mixed formats in single file
 */

import { parseDate, parseAmount } from "./data-extractor";

/**
 * Standardized transaction format
 */
export interface StandardTransaction {
  거래일자: Date;
  구분: "입금" | "출금";
  금액: number; // Always positive, sign determined by '구분'
  잔액?: number;
  비고: string;
}

/**
 * Column type detection result
 */
interface ColumnDetection {
  dateColumn: number;
  depositColumn?: number;
  withdrawalColumn?: number;
  balanceColumn?: number;
  memoColumn: number;
  transactionTypeColumn?: number; // For Type 3: 거래구분
}

/**
 * Header pattern matching for each document type
 */
const HEADER_PATTERNS = {
  type1: {
    keywords: ["지급금액", "입금금액", "적요", "상태", "취급점", "Teller"],
    dateKeywords: ["거래일자", "일자"],
    depositKeywords: ["입금금액", "입금"],
    withdrawalKeywords: ["지급금액", "지급", "출금"],
    balanceKeywords: ["잔액"],
    memoKeywords: ["적요", "내용", "비고"],
  },
  type2: {
    keywords: ["찾으신금액", "맡기신금액", "비고", "후송", "마감후", "기번", "점명"],
    dateKeywords: ["거래일자", "일자"],
    depositKeywords: ["맡기신금액", "입금", "예금"],
    withdrawalKeywords: ["찾으신금액", "출금", "인출"],
    balanceKeywords: ["잔액"],
    memoKeywords: ["비고", "내용", "적요"],
  },
  type3: {
    keywords: ["거래구분", "거래일시", "계좌정보", "결제정보"],
    dateKeywords: ["거래일시", "일자"],
    depositKeywords: [], // Determined from 거래구분 column
    withdrawalKeywords: [], // Determined from 거래구분 column
    balanceKeywords: ["거래후잔액", "잔액"],
    memoKeywords: ["계좌정보", "결제정보", "내용"],
  },
};

/**
 * Analyze sample rows to detect which column is likely the memo column
 * Memo columns typically contain:
 * - Person names (Korean)
 * - Account numbers
 * - Bank names
 * - Transaction descriptions
 *
 * @param rows - Sample rows from the data (at least 5 rows recommended)
 * @returns Index of the most likely memo column
 */
export function detectMemoColumn(rows: unknown[][], headerRowIndex: number): number {
  const dataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 1 + Math.min(10, rows.length - headerRowIndex - 1));

  if (dataRows.length === 0) return -1;

  const headerRow = rows[headerRowIndex];
  if (!headerRow) return -1;
  const numColumns = headerRow.length;
  const scores: number[] = new Array(numColumns).fill(0);

  for (const row of dataRows) {
    for (let col = 0; col < Math.min(row.length, numColumns); col++) {
      const value = row[col];

      if (!value || typeof value !== "string") continue;

      const text = String(value).trim();

      // Skip empty or very short values
      if (text.length < 2) continue;

      // Score indicators for memo content:
      // 1. Contains Korean names (2-4 character Korean text)
      if (/^[가-힣]{2,4}$/.test(text)) scores[col] += 3;

      // 2. Contains account numbers (numeric sequences 10-14 digits)
      if (/^\d{10,14}$/.test(text)) scores[col] += 2;

      // 3. Contains bank names
      if (/(은행|뱅크|제일|기업|국민|외환|수협|농협|지역농협|카카오|토스|새마을)/.test(text)) scores[col] += 2;

      // 4. Mixed text and numbers (typical in transaction memos)
      if (/[가-힣]+.*\d+|\d+.*[가-힣]+/.test(text)) scores[col] += 1;

      // 5. Not a pure number (dates, amounts are usually pure)
      if (!/^\d+$/.test(text) && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        scores[col] += 1;
      }

      // 6. Common memo keywords
      if (/(이체|송금|입금|출금|자동|이체|이자|수수료|월세|상환|대출|적립)/.test(text)) {
        scores[col] += 2;
      }
    }
  }

  // Find column with highest score
  let maxScore = 0;
  let bestColumn = -1;

  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > maxScore) {
      maxScore = scores[i];
      bestColumn = i;
    }
  }

  return bestColumn;
}

/**
 * Detect document type and column mapping from header row
 */
export function detectColumns(headerRow: unknown[]): ColumnDetection | null {
  const headers = headerRow.map((h) => String(h).trim());

  // Detect document type
  let docType: keyof typeof HEADER_PATTERNS | null = null;
  for (const [type, patterns] of Object.entries(HEADER_PATTERNS)) {
    const matchCount = patterns.keywords.filter((kw) =>
      headers.some((h) => h.includes(kw))
    ).length;

    if (matchCount >= 2) {
      docType = type as keyof typeof HEADER_PATTERNS;
      break;
    }
  }

  if (!docType) return null;

  const patterns = HEADER_PATTERNS[docType];

  // Find column indices
  const detection: ColumnDetection = {
    dateColumn: -1,
    memoColumn: -1,
  };

  // Date column
  for (let i = 0; i < headers.length; i++) {
    if (patterns.dateKeywords.some((kw) => headers[i].includes(kw))) {
      detection.dateColumn = i;
      break;
    }
  }

  // Deposit/Withdrawal columns
  for (let i = 0; i < headers.length; i++) {
    if (patterns.depositKeywords.some((kw) => headers[i].includes(kw))) {
      detection.depositColumn = i;
    }
    if (patterns.withdrawalKeywords.some((kw) => headers[i].includes(kw))) {
      detection.withdrawalColumn = i;
    }
    if (patterns.balanceKeywords.some((kw) => headers[i].includes(kw))) {
      detection.balanceColumn = i;
    }
    if (patterns.memoKeywords.some((kw) => headers[i].includes(kw))) {
      detection.memoColumn = i;
    }
    if (headers[i].includes("거래구분")) {
      detection.transactionTypeColumn = i;
    }
  }

  // Validate required columns
  if (detection.dateColumn === -1) return null;

  return detection;
}

/**
 * Parse transaction type from Type 3 format (거래구분 column)
 * Format: "[출금] xxx" or "[입금] xxx" or "출금/xxx" or "입금/xxx"
 */
function parseTransactionType(value: unknown): "입금" | "출금" | null {
  if (!value || typeof value !== "string") return null;

  const text = value.trim();

  // Check for brackets format: [입금], [출금]
  if (text.includes("[입금]") || text.includes("+")) return "입금";
  if (text.includes("[출금]") || text.includes("-")) return "출금";

  // Check for slash format: 입금/, 출금/
  if (/^입금\//.test(text)) return "입금";
  if (/^출금\//.test(text)) return "출금";

  return null;
}

/**
 * Extract amount from deposit/withdrawal columns
 * Handles the case where one column has amount and the other has memo/note
 */
function extractAmountWithFallback(
  depositValue: unknown,
  withdrawalValue: unknown
): { amount: number; type: "입금" | "출금" } | null {
  const deposit = parseAmount(depositValue);
  const withdrawal = parseAmount(withdrawalValue);

  // Both have numbers - prefer the larger one
  if (deposit && withdrawal) {
    if (deposit > withdrawal) {
      return { amount: deposit, type: "입금" };
    } else {
      return { amount: withdrawal, type: "출금" };
    }
  }

  // Only one has number
  if (deposit) return { amount: deposit, type: "입금" };
  if (withdrawal) return { amount: withdrawal, type: "출금" };

  return null;
}

/**
 * Parse standard transaction from a row
 */
export function parseTransactionRow(
  row: unknown[],
  detection: ColumnDetection
): StandardTransaction | null {
  // Parse date
  const dateValue = row[detection.dateColumn];
  const transactionDate = parseDate(dateValue);

  if (!transactionDate) {
    return null; // Invalid date
  }

  // Determine transaction type and amount
  let amount: number;
  let type: "입금" | "출금";

  if (detection.transactionTypeColumn !== undefined) {
    // Type 3: Use 거래구분 column
    const typeValue = row[detection.transactionTypeColumn];
    const parsedType = parseTransactionType(typeValue);

    if (!parsedType) {
      return null; // Cannot determine transaction type
    }

    type = parsedType;

    // Get amount from 거래금액 column (would be passed as depositColumn for Type 3)
    const amountValue = detection.depositColumn !== undefined
      ? row[detection.depositColumn]
      : null;
    const parsedAmount = parseAmount(amountValue);

    if (!parsedAmount) {
      return null; // Invalid amount
    }

    amount = parsedAmount;
  } else {
    // Type 1 & 2: Use deposit/withdrawal columns
    const depositValue = detection.depositColumn !== undefined
      ? row[detection.depositColumn]
      : null;
    const withdrawalValue = detection.withdrawalColumn !== undefined
      ? row[detection.withdrawalColumn]
      : null;

    const result = extractAmountWithFallback(depositValue, withdrawalValue);

    if (!result) {
      return null; // Cannot determine amount
    }

    amount = result.amount;
    type = result.type;
  }

  // Parse balance
  const balance = detection.balanceColumn !== undefined
    ? parseAmount(row[detection.balanceColumn])
    : undefined;

  // Parse memo
  const memoValue = detection.memoColumn !== -1
    ? row[detection.memoColumn]
    : "";
  const memo = String(memoValue ?? "").trim();

  return {
    거래일자: transactionDate,
    구분: type,
    금액: amount,
    잔액: balance,
    비고: memo,
  };
}

/**
 * Parse all transactions from raw data
 */
export function parseStandardTransactions(
  rawData: unknown[][],
  headerRowIndex: number
): {
  transactions: StandardTransaction[];
  errors: Array<{ row: number; error: string }>;
} {
  // Detect columns from header
  const detection = detectColumns(rawData[headerRowIndex]);

  if (!detection) {
    return {
      transactions: [],
      errors: [{ row: headerRowIndex + 1, error: "헤더 형식을 인식할 수 없습니다" }],
    };
  }

  // Auto-detect memo column if not found
  if (detection.memoColumn === -1) {
    const detectedMemoColumn = detectMemoColumn(rawData, headerRowIndex);
    if (detectedMemoColumn !== -1) {
      detection.memoColumn = detectedMemoColumn;
    }
  }

  const transactions: StandardTransaction[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  // Parse each data row
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];

    if (!row || row.length === 0) {
      continue; // Skip empty rows
    }

    try {
      const transaction = parseTransactionRow(row, detection);

      if (transaction) {
        transactions.push(transaction);
      } else {
        errors.push({
          row: i + 1,
          error: "유효하지 않은 거래 데이터"
        });
      }
    } catch (error) {
      errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { transactions, errors };
}

/**
 * Format transaction for UI display
 * - 구분: 입금 (blue) / 출금 (red)
 * - 금액: +123,456 or -123,456
 * - 잔액: formatted with commas
 */
export interface FormattedTransaction {
  거래일자: string; // "2023-01-01"
  구분: "입금" | "출금";
  구분색상: string; // CSS color class
  금액: string; // "+123,456" or "-123,456"
  잔액?: string; // "1,234,567"
  비고: string;
}

/**
 * Format transaction for UI display
 */
export function formatTransactionForDisplay(transaction: StandardTransaction): FormattedTransaction {
  const formattedDate = transaction.거래일자.toISOString().split('T')[0];
  const colorClass = transaction.구분 === "입금" ? "text-blue-600" : "text-red-600";
  const sign = transaction.구분 === "입금" ? "+" : "-";
  const formattedAmount = `${sign}${transaction.금액.toLocaleString()}`;
  const formattedBalance = transaction.잔액 !== undefined
    ? transaction.잔액.toLocaleString()
    : undefined;

  return {
    거래일자: formattedDate,
    구분: transaction.구분,
    구분색상: colorClass,
    금액: formattedAmount,
    잔액: formattedBalance,
    비고: transaction.비고,
  };
}

/**
 * Convert database Transaction to StandardTransaction format
 * Handles the different deposit/withdrawal column combinations
 *
 * @param transaction - Database transaction with depositAmount/withdrawalAmount
 * @returns StandardTransaction with unified 구분/금액 format
 */
export function convertToStandardTransaction(transaction: {
  transactionDate: Date;
  depositAmount: number | string | null;
  withdrawalAmount: number | string | null;
  balance: number | string | null;
  memo: string | null;
}): StandardTransaction | null {
  // Determine transaction type and amount
  const deposit = typeof transaction.depositAmount === 'string'
    ? parseAmount(transaction.depositAmount)
    : transaction.depositAmount;
  const withdrawal = typeof transaction.withdrawalAmount === 'string'
    ? parseAmount(transaction.withdrawalAmount)
    : transaction.withdrawalAmount;
  const balance = typeof transaction.balance === 'string'
    ? parseAmount(transaction.balance)
    : transaction.balance;

  let 구분: "입금" | "출금";
  let 금액: number;

  // Determine type based on which amount is present
  if (deposit && withdrawal) {
    // Both present - use the larger one
    if (deposit > withdrawal) {
      구분 = "입금";
      금액 = deposit;
    } else {
      구분 = "출금";
      금액 = withdrawal;
    }
  } else if (deposit) {
    구분 = "입금";
    금액 = deposit;
  } else if (withdrawal) {
    구분 = "출금";
    금액 = withdrawal;
  } else {
    return null; // No valid amount
  }

  return {
    거래일자: transaction.transactionDate,
    구분,
    금액,
    잔액: balance ?? undefined,
    비고: transaction.memo ?? "",
  };
}


