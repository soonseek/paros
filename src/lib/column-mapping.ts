/**
 * Column Mapping Constants and Utilities
 *
 * Provides column type inference for Korean/English transaction data headers.
 * Supports bilingual (Korean/English) column name recognition.
 *
 * Supported Columns:
 * - Date (날짜) - Required field
 * - Deposit (입금액)
 * - Withdrawal (출금액)
 * - Balance (잔액)
 * - Memo (메모/적요)
 * - Counterparty (거래처)
 * - Account Number (계좌번호)
 */

/**
 * Column types for transaction data
 */
export enum ColumnType {
  DATE = "date",
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  BALANCE = "balance",
  MEMO = "memo",
  COUNTERPARTY = "counterparty",
  ACCOUNT_NUMBER = "account_number",
  AMOUNT = "amount", // 단일 금액 컬럼 (거래구분으로 입출금 구분)
  TRANSACTION_TYPE = "transaction_type", // 거래구분 ([+]/[-])
  UNKNOWN = "unknown",
}

/**
 * Column type mapping with Korean and English names
 */
export const COLUMN_MAPPING: Record<
  ColumnType,
  { korean: string[]; english: string[]; priority: number }
> = {
  [ColumnType.DATE]: {
    korean: ["날짜", "거래일", "거래일자", "일자", "거래일시", "交易日期", "날짜/시간"],
    english: ["Date", "Transaction Date", "Trx Date", "Trade Date", "DateTime", "Transaction Time"],
    priority: 1, // Required field
  },
  [ColumnType.DEPOSIT]: {
    korean: ["입금액", "입금", "받은금액", "수입", "입금 금액", "맡기신금액", "입금금액"],
    english: ["Deposit", "In", "Credit", "Income", "Received", "Deposit Amount"],
    priority: 2,
  },
  [ColumnType.WITHDRAWAL]: {
    korean: ["출금액", "출금", "지급", "지출", "보낸금액", "출금 금액", "찾으신금액", "지급금액"],
    english: [
      "Withdrawal",
      "Out",
      "Debit",
      "Expense",
      "Payment",
      "Withdrawal Amount",
    ],
    priority: 3,
  },
  [ColumnType.BALANCE]: {
    korean: ["잔액", "잔고", "계좌잔액", "현재잔액", "잔액 (원)", "거래후잔액", "거래 후 잔액", "거래후 잔액"],
    english: [
      "Balance",
      "Current Balance",
      "Bal",
      "Account Balance",
      "Running Balance",
      "After Balance",
    ],
    priority: 4,
  },
  // 단일 금액 컬럼 (거래구분으로 입출금 구분)
  [ColumnType.AMOUNT]: {
    korean: ["거래금액", "금액", "거래 금액", "이체금액"],
    english: ["Amount", "Transaction Amount", "Trx Amount"],
    priority: 3, // 입금/출금 분리형보다 낮은 우선순위
  },
  // 거래구분 컬럼 ([+]/[-] 표시)
  [ColumnType.TRANSACTION_TYPE]: {
    korean: ["거래구분", "구분", "거래 구분", "입출금구분", "유형"],
    english: ["Transaction Type", "Type", "Trx Type"],
    priority: 3, // AMOUNT와 함께 사용
  },
  [ColumnType.MEMO]: {
    korean: ["적요", "메모", "내용", "거래내용", "상세", "적요 내용", "비고", "계좌정보", "결제정보", "계좌 정보", "결제 정보"],
    english: [
      "Memo",
      "Description",
      "Details",
      "Particulars",
      "Remark",
      "Transaction Details",
      "Note",
    ],
    priority: 5,
  },
  [ColumnType.COUNTERPARTY]: {
    korean: ["거래처", "상대방", "받는분", "주는분", "입출금처"],
    english: [
      "Counterparty",
      "Payee",
      "Payer",
      "Beneficiary",
      "To/From",
      "Transaction Partner",
    ],
    priority: 6,
  },
  [ColumnType.ACCOUNT_NUMBER]: {
    korean: ["계좌번호", "계좌", "번호", "계좌 번호"],
    english: [
      "Account Number",
      "Account No",
      "Acct No",
      "Account #",
      "Account No.",
    ],
    priority: 7,
  },
  [ColumnType.UNKNOWN]: {
    korean: [],
    english: [],
    priority: 99,
  },
};

/**
 * Infer column type from column name
 *
 * Supports both Korean and English column names with case-insensitive matching.
 *
 * @param columnName - Column name (Korean or English)
 * @returns Inferred ColumnType
 *
 * @example
 * inferColumnType("날짜") // Returns ColumnType.DATE
 * inferColumnType("Date") // Returns ColumnType.DATE
 * inferColumnType("Unknown Column") // Returns ColumnType.UNKNOWN
 */
export function inferColumnType(columnName: string): ColumnType {
  const normalized = columnName.trim().toLowerCase();

  // DEBUG: Log column type detection
  if (process.env.NODE_ENV === "development") {
    console.log(`[Column Mapping] Checking column: "${columnName}" (normalized: "${normalized}")`);
  }

  for (const [type, mapping] of Object.entries(COLUMN_MAPPING)) {
    const koreanMatches = mapping.korean.some((name) =>
      normalized.includes(name.toLowerCase())
    );
    const englishMatches = mapping.english.some((name) =>
      normalized.includes(name.toLowerCase())
    );

    if (koreanMatches || englishMatches) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Column Mapping] ✓ Matched as ${type} (korean: ${koreanMatches}, english: ${englishMatches})`);
      }
      return type as ColumnType;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[Column Mapping] ✗ No match found for "${columnName}"`);
  }

  return ColumnType.UNKNOWN;
}

/**
 * Get missing required columns
 *
 * Checks if all required columns (date) are present in the detected columns.
 *
 * @param detectedColumns - Array of detected column types
 * @returns Array of missing required column types
 *
 * @example
 * getMissingRequiredColumns([ColumnType.DATE, ColumnType.DEPOSIT])
 * // Returns [] (all required columns present)
 *
 * getMissingRequiredColumns([ColumnType.DEPOSIT, ColumnType.WITHDRAWAL])
 * // Returns [ColumnType.DATE] (missing required date column)
 */
export function getMissingRequiredColumns(
  detectedColumns: ColumnType[]
): ColumnType[] {
  const required = [ColumnType.DATE];
  return required.filter((col) => !detectedColumns.includes(col));
}

/**
 * Get Korean label for column type
 *
 * @param columnType - Column type enum value
 * @returns Korean label for display
 */
export function getColumnTypeLabel(columnType: ColumnType): string {
  const labels: Record<ColumnType, string> = {
    [ColumnType.DATE]: "날짜",
    [ColumnType.DEPOSIT]: "입금액",
    [ColumnType.WITHDRAWAL]: "출금액",
    [ColumnType.BALANCE]: "잔액",
    [ColumnType.MEMO]: "메모",
    [ColumnType.COUNTERPARTY]: "거래처",
    [ColumnType.ACCOUNT_NUMBER]: "계좌번호",
    [ColumnType.AMOUNT]: "거래금액",
    [ColumnType.TRANSACTION_TYPE]: "거래구분",
    [ColumnType.UNKNOWN]: "알 수 없음",
  };
  return labels[columnType] || columnType;
}

/**
 * Check if column type is required
 *
 * @param columnType - Column type enum value
 * @returns True if column type is required (date)
 */
export function isRequiredColumn(columnType: ColumnType): boolean {
  return columnType === ColumnType.DATE;
}

/**
 * 금액 관련 컬럼이 있는지 확인
 * 
 * 다음 중 하나 이상 있어야 함:
 * - 입금액/출금액 분리형
 * - 단일 거래금액 + 거래구분
 */
export function hasAmountColumns(detectedColumns: ColumnType[]): boolean {
  const hasDeposit = detectedColumns.includes(ColumnType.DEPOSIT);
  const hasWithdrawal = detectedColumns.includes(ColumnType.WITHDRAWAL);
  const hasAmount = detectedColumns.includes(ColumnType.AMOUNT);
  const hasTransactionType = detectedColumns.includes(ColumnType.TRANSACTION_TYPE);
  
  // 입금/출금 분리형
  if (hasDeposit || hasWithdrawal) return true;
  
  // 단일 금액 + 거래구분
  if (hasAmount) return true;
  
  return false;
}
