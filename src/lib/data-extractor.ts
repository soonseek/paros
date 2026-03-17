/**
 * Data Extractor
 *
 * Story 3.6: Extracts transaction data from uploaded files and saves to database.
 *
 * Features:
 * - Parse dates from multiple formats (YYYY-MM-DD, MM/DD/YYYY, Excel serial numbers)
 * - Parse amounts with commas (,) and won (₩) symbols
 * - Bulk insert to Transaction table using Prisma createMany
 * - Error handling: Skip invalid records, log errors, continue processing
 * - Performance: 1,000 records in 60 seconds (NFR-002)
 *
 * @example
 * const result = await extractAndSaveTransactions(
 *   documentId,
 *   caseId,
 *   rawData,
 *   columnMapping,
 *   headerRowIndex
 * );
 * // Returns: { success: 998, skipped: 2, errors: [...] }
 */

import { type Prisma, type PrismaClient } from "@prisma/client";


/**
 * 잔액 연속성 점수 계산
 * 이전 잔액 + 입금 - 출금 = 현재 잔액이 맞는 연속 쌍의 개수를 반환
 */
function calculateBalanceConsistency(
  txs: Prisma.TransactionCreateManyInput[],
  prevBalance: number | null,
): number {
  let score = 0;
  let prev = prevBalance;
  for (const tx of txs) {
    const dep = Number(tx.depositAmount ?? 0);
    const wit = Number(tx.withdrawalAmount ?? 0);
    const bal = tx.balance != null ? Number(tx.balance) : null;
    if (prev != null && bal != null) {
      const expected = prev + dep - wit;
      if (Math.abs(expected - bal) < 1) {
        score++;
      }
    }
    if (bal != null) prev = bal;
  }
  return score;
}

/**
 * Column mapping interface from Story 3.4 (FileAnalysisResult)
 *
 * Maps column type to column index in the Excel sheet
 */
export interface ColumnMapping {
  date?: number;            // Date column index
  deposit?: number;         // Deposit amount column index
  withdrawal?: number;      // Withdrawal amount column index
  balance?: number;         // Balance column index
  memo?: number;            // Memo column index
  amount?: number;          // Single amount column (with transaction_type)
  transaction_type?: number; // Transaction type column ([+]/[-])
  memoInAmountColumn?: boolean; // 비고가 입금/출금 컬럼에 섞여있는 특수 케이스
  rowMergePattern?: "pair" | "none"; // 행 병합 패턴 (NH농협 등: 2행 → 1거래)
}

/**
 * Extraction result interface
 */
export interface ExtractionResult {
  success: number;  // Number of successfully saved records
  skipped: number;  // Number of skipped records
  errors: Array<{ row: number; error: string }>;  // Error details
}

/**
 * 2행을 1개 거래로 병합 (NH농협 등 특수 형식)
 * 
 * 패턴: 홀수 행(순번 O) + 짝수 행(순번 X) = 1개 거래
 * 
 * @param rows - 원본 데이터 행
 * @returns 병합된 행 배열
 */
function mergePairedRows(rows: string[][]): string[][] {
  const merged: string[][] = [];
  
  console.log(`[Row Merge] 2행 병합 시작: ${rows.length}행 → ${Math.ceil(rows.length / 2)}개 거래 예상`);
  
  for (let i = 0; i < rows.length; i += 2) {
    const row1 = rows[i];
    const row2 = rows[i + 1];
    
    if (!row1) continue;
    
    // 마지막 행 (짝이 없는 경우)
    if (!row2) {
      merged.push(row1);
      console.log(`[Row Merge] 마지막 행 (짝 없음): row ${i + 1}`);
      break;
    }
    
    // 검증: row1은 순번이 있고, row2는 순번이 비어있어야 함
    const hasSequenceNumber = row1[0] && row1[0].toString().trim().length > 0;
    const noSequenceNumber = !row2[0] || row2[0].toString().trim().length === 0;
    
    if (hasSequenceNumber && noSequenceNumber) {
      // 각 컬럼을 병합
      const mergedRow = row1.map((cell, colIdx) => {
        const val1 = cell?.toString().trim() || "";
        const val2 = row2[colIdx]?.toString().trim() || "";
        
        // Row 2에 값이 있으면 Row 2 우선 (가맹점명 등)
        // 단, 숫자 필드는 Row 1 우선 (금액, 날짜 등)
        const isNumericField = val1 && /^[\d,.\-]+$/.test(val1);
        
        if (val2 && !isNumericField) {
          // Row 2에 값이 있고, Row 1이 숫자 아니면 → Row 2 우선
          return val1 && val2 ? `${val1} ${val2}` : val2;
        } else {
          // Row 1이 숫자이거나 Row 2가 없으면 → 기존 로직
          return val1 && val2 ? `${val1} ${val2}` : val1 || val2;
        }
      });
      
      merged.push(mergedRow);
      
      if (i < 5) {
        console.log(`[Row Merge] 병합 ${i / 2 + 1}:`);
        console.log(`  Row1[1,2]: ${row1[1]}, ${row1[2]}`);
        console.log(`  Row2[1,2]: ${row2[1]}, ${row2[2]}`);
        console.log(`  Merged[1,2]: ${mergedRow[1]}, ${mergedRow[2]}`);
      }
    } else {
      // 패턴이 맞지 않으면 그냥 추가
      merged.push(row1);
      merged.push(row2);
      console.log(`[Row Merge] ⚠️ 패턴 불일치 (row ${i + 1}-${i + 2}): 병합 스킵`);
    }
  }
  
  console.log(`[Row Merge] 완료: ${rows.length}행 → ${merged.length}행`);
  return merged;
}

/**
 * Parse date from multiple formats
 *
 * Supports:
 * - Excel serial numbers (e.g., 44927 = 2023-01-01)
 * - ISO format (YYYY-MM-DD)
 * - Korean format (YYYY.MM.DD)
 * - US format (MM/DD/YYYY)
 *
 * @param dateValue - Date value (number, string, or Date object)
 * @returns Parsed Date object or null if invalid
 *
 * @example
 * parseDate(44927); // Returns Date(2023-01-01)
 * parseDate("2023-01-01"); // Returns Date(2023-01-01)
 * parseDate("2023.01.01"); // Returns Date(2023-01-01)
 * parseDate("01/01/2023"); // Returns Date(2023-01-01)
 * parseDate("invalid"); // Returns null
 */
export function parseDate(dateValue: unknown): Date | null {
  if (!dateValue) return null;

  // Excel serial number (days since 1900-01-01)
  if (typeof dateValue === "number") {
    // Convert Excel serial number to JavaScript timestamp
    // Excel epoch: 1900-01-01 (but Excel incorrectly treats 1900 as a leap year)
    // JavaScript epoch: 1970-01-01
    // Formula: (excelDate - 25569) * 86400 * 1000
    // 25569 = days from 1900-01-01 to 1970-01-01
    const excelEpoch = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    return excelEpoch;
  }

  // String format
  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();

    // 1차: YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY/MM/DD 패턴을 regex로 추출
    // "2025.01.08 17:10: F/B출금" 같은 합쳐진 값에서도 날짜만 추출
    const datePattern = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/;
    const match = trimmed.match(datePattern);
    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed
      const day = parseInt(match[3], 10);
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return new Date(year, month, day);
      }
    }

    // 2차: "01.08" 또는 "01-08" 패턴 (년도 없이 월.일만)은 현재 연도 사용
    const shortDatePattern = /^(\d{1,2})[.\-/](\d{1,2})(?:\s|$)/;
    const shortMatch = trimmed.match(shortDatePattern);
    if (shortMatch && shortMatch[1] && shortMatch[2]) {
      const month = parseInt(shortMatch[1], 10);
      const day = parseInt(shortMatch[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const year = new Date().getFullYear();
        return new Date(year, month - 1, day);
      }
    }

    // 3차: 기존 파싱 - 순수 날짜 문자열
    const cleaned = trimmed.replace(/\./g, "-").replace(/\//g, "-");
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Date object (pass through)
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  return null;
}

/**
 * Extract date and description from a merged "거래일시적요" column
 * 
 * Handles formats like:
 * - "2025/01/01 15:24:33 토스 임숙자"  → { date: 2025-01-01, memo: "토스 임숙자" }
 * - "2025.01.08 17:10: F/B출금"       → { date: 2025-01-08, memo: "F/B출금" }
 * - "2025/01/01 16:23:01 4860 (주)영풍문고" → { date: 2025-01-01, memo: "4860 (주)영풍문고" }
 * - "11:01: 자동이체"                  → { date: null, memo: "자동이체" }
 * - "2025.01.09 14:30: 부가세"         → { date: 2025-01-09, memo: "부가세" }
 * - "대출이자"                         → { date: null, memo: "대출이자" }
 */
export function extractDateAndMemo(value: unknown): { date: Date | null; extractedMemo: string } {
  if (!value || typeof value !== "string") return { date: null, extractedMemo: "" };

  const trimmed = value.trim();
  const date = parseDate(trimmed);

  // 날짜+시간 패턴 제거 후 나머지를 적요로 추출
  let memo = trimmed;

  // 날짜 부분 제거 (YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD)
  memo = memo.replace(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*/, "");
  // 시간 부분 제거 (HH:MM:SS or HH:MM: or HH:MM) - 초(seconds)까지 처리
  memo = memo.replace(/\d{1,2}:\d{2}(?::\d{2})?\s*/, "");
  memo = memo.trim();

  // 콜론으로 시작하면 제거
  if (memo.startsWith(":")) memo = memo.substring(1).trim();

  return { date, extractedMemo: memo };
}

/**
 * Parse amount with commas and won symbols
 *
 * Supports:
 * - Numbers (pass through)
 * - Strings with commas: "1,000,000" → 1000000
 * - Strings with won symbol: "₩1,000,000" → 1000000
 * - Strings with Korean text: "1,000원" → 1000
 *
 * @param amountValue - Amount value (number, string, or null)
 * @returns Parsed number or null if invalid
 *
 * @example
 * parseAmount(1000); // Returns 1000
 * parseAmount("1,000,000"); // Returns 1000000
 * parseAmount("₩1,000,000"); // Returns 1000000
 * parseAmount("1,000원"); // Returns 1000
 * parseAmount("invalid"); // Returns null
 */
export function parseAmount(amountValue: unknown): number | null {
  if (amountValue === null || amountValue === undefined || amountValue === "") return null;

  // Number (pass through) - 0 포함
  if (typeof amountValue === "number") {
    return amountValue;
  }

  // String with commas/symbols
  if (typeof amountValue === "string") {
    // Remove commas, won (₩) symbol, Korean "원" text, and whitespace
    const cleaned = amountValue
      .replace(/,/g, "")
      .replace(/[₩원]/g, "")
      .trim();

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Parse balance from a string (extracts last number for merged rows)
 * 
 * NH농협 등 2행 병합 시: "380,000원 503원" → 503
 * 일반 케이스: "503원" → 503
 *
 * @param balanceValue - Balance value (may contain multiple numbers)
 * @returns Parsed last number or null if invalid
 */
export function parseBalance(balanceValue: unknown): number | null {
  if (balanceValue === null || balanceValue === undefined || balanceValue === "") return null;

  if (typeof balanceValue === "number") {
    return balanceValue;
  }

  if (typeof balanceValue === "string") {
    // 모든 숫자 패턴 찾기 (쉼표 포함)
    const numberPattern = /[\d,]+/g;
    const matches = balanceValue.match(numberPattern);
    
    if (!matches || matches.length === 0) {
      return null;
    }
    
    // 마지막 숫자 추출 (병합된 경우 잔액이 마지막)
    const lastNumber = matches[matches.length - 1];
    if (!lastNumber) return null;
    const cleaned = lastNumber.replace(/,/g, "");
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Extract first word from a string (for merged row columns)
 * 
 * 병합된 행: "출금 NH올원뱅크" → "출금"
 * 일반: "출금" → "출금"
 *
 * @param value - String value
 * @returns First word or original string
 */
export function extractFirstWord(value: unknown): string {
  if (!value) return "";
  
  const str = String(value).trim();
  const firstWord = str.split(/\s+/)[0];
  return firstWord || str;
}

/**
 * Extract and save transactions to database
 *
 * This is the main extraction function that:
 * 1. Iterates through rows in the Excel data
 * 2. Parses dates and amounts
 * 3. Validates required fields
 * 4. Performs bulk insert using Prisma createMany
 * 5. Returns success/skip/error statistics
 *
 * Performance: Uses Prisma createMany for bulk insert (NFR-002: 1,000 records in 60 seconds)
 *
 * MEDIUM-1 FIX: Wrapped in database transaction for automatic rollback on failure
 *
 * @param prisma - Prisma Client instance
 * @param documentId - Document ID from Story 3.3
 * @param caseId - Case ID
 * @param rawData - Raw Excel data (array of arrays from XLSX.utils.sheet_to_json)
 * @param columnMapping - Column mapping from Story 3.4 (FileAnalysisResult)
 * @param headerRowIndex - Header row index (0-based)
 * @returns Extraction result with success count, skipped count, and error details
 *
 * @throws Prisma.PrismaClientKnownRequestError if database operation fails
 *
 * @example
 * const result = await extractAndSaveTransactions(
 *   prisma,
 *   "doc-123",
 *   "case-456",
 *   rawData,
 *   { date: 0, deposit: 1, withdrawal: 2, balance: 3, memo: 4 },
 *   0
 * );
 * // Returns: { success: 998, skipped: 2, errors: [{ row: 15, error: "Invalid date" }] }
 */
export async function extractAndSaveTransactions(
  prisma: PrismaClient,
  documentId: string,
  caseId: string,
  rawData: unknown[][],
  columnMapping: ColumnMapping,
  headerRowIndex: number
): Promise<ExtractionResult> {
  // MEDIUM-1 FIX: Wrap entire operation in database transaction for automatic rollback
  return await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const transactions: Prisma.TransactionCreateManyInput[] = [];
      let skipped = 0;
      const errors: Array<{ row: number; error: string }> = [];

  // Validate required column mapping
  if (columnMapping.date === undefined) {
    throw new Error("Date column is required in column mapping");
  }

  // MEDIUM-3 FIX: Limit metadata size to prevent database bloat
  const MAX_METADATA_SIZE = 5 * 1024; // 5KB max per transaction

  // Start from the row after the header
  const startRow = headerRowIndex + 1;
  
  // 행 병합이 필요한 경우 (NH농협 등)
  let processRows = rawData.slice(startRow);
  
  if (columnMapping.rowMergePattern === "pair") {
    console.log("[Data Extractor] 행 병합 모드: 2행을 1개 거래로 병합");
    processRows = mergePairedRows(processRows as string[][]);
    console.log(`[Data Extractor] 병합 후: ${processRows.length}개 거래`);
  }

  // 잔액 검증을 위한 이전 잔액 추적
  let previousBalance: number | null = null;
  const balanceValidationWarnings: string[] = [];

  // 날짜 이어받기: 합쳐진 "거래일시적요" 컬럼에서 날짜가 없는 행은 앞 행 날짜 사용
  let lastKnownDate: Date | null = null;

  for (let i = 0; i < processRows.length; i++) {
    const row = processRows[i];

    if (!row || row.length === 0) {
      skipped++;
      errors.push({ row: i + 1, error: "Empty row" });
      continue;
    }

    try {
      // Parse date (required field)
      const dateValue = row[columnMapping.date];
      let transactionDate = parseDate(dateValue);

      // 날짜+적요 합쳐진 셀에서 적요 추출 (예: "2025/01/01 15:24:33 토스 임숙자")
      let dateColumnMemo = "";
      if (typeof dateValue === "string") {
        const { extractedMemo } = extractDateAndMemo(dateValue);
        if (extractedMemo) {
          dateColumnMemo = extractedMemo;
        }
      }

      // Fallback: OCR이 날짜를 행번호 컬럼(col[0])에 합쳐서 넣는 경우 대응
      // 예: col[0]="2 2025.01.09", col[1]="11:01: 자동이체"
      if (!transactionDate && columnMapping.date !== 0) {
        transactionDate = parseDate(row[0]);
        // col[0]에서도 적요 추출 시도
        if (!dateColumnMemo && typeof row[0] === "string") {
          const { extractedMemo } = extractDateAndMemo(row[0]);
          if (extractedMemo) dateColumnMemo = extractedMemo;
        }
      }

      // 날짜 이어받기: 위 두 컬럼 모두에서 날짜를 못 찾으면 앞 행 날짜 사용
      let dateCarriedForward = false;
      if (transactionDate) {
        lastKnownDate = transactionDate;
      } else if (lastKnownDate) {
        transactionDate = lastKnownDate;
        dateCarriedForward = true;
      }

      // 디버그: 첫 10개 행에 대해 날짜 파싱 상세 로그
      if (i < 10) {
        console.log(`[Data Extractor] ===== Row ${i + 1} DATE PARSING =====`);
        console.log(`[Data Extractor] Row ${i + 1} dateColumnIndex: ${columnMapping.date}`);
        console.log(`[Data Extractor] Row ${i + 1} dateValue (col[${columnMapping.date}]):`, JSON.stringify(dateValue));
        console.log(`[Data Extractor] Row ${i + 1} col[0] value:`, JSON.stringify(row[0]));
        console.log(`[Data Extractor] Row ${i + 1} parseDate(col[${columnMapping.date}]):`, parseDate(dateValue)?.toISOString() ?? 'null');
        console.log(`[Data Extractor] Row ${i + 1} parseDate(col[0]):`, columnMapping.date !== 0 ? (parseDate(row[0])?.toISOString() ?? 'null') : 'same as dateCol');
        console.log(`[Data Extractor] Row ${i + 1} dateCarriedForward: ${dateCarriedForward}`);
        console.log(`[Data Extractor] Row ${i + 1} final transactionDate:`, transactionDate?.toISOString() ?? 'null');
        console.log(`[Data Extractor] ===================================`);
      }

      if (!transactionDate) {
        skipped++;
        errors.push({
          row: i + 1,
          error: `Invalid date: ${String(dateValue)}`,
        });
        continue; // Skip this record
      }

      // Parse amounts (optional - at least one of deposit or withdrawal must be present)
      let depositAmount: number | null = null;
      let withdrawalAmount: number | null = null;
      let memo = "";

      // 디버그: 첫 5개 행에 대해 컬럼 매핑 확인
      if (i < 5) {
        console.log(`[Data Extractor] Row ${i + 1} raw data:`, {
          deposit: columnMapping.deposit !== undefined ? row[columnMapping.deposit] : 'N/A',
          withdrawal: columnMapping.withdrawal !== undefined ? row[columnMapping.withdrawal] : 'N/A',
          memo: columnMapping.memo !== undefined ? row[columnMapping.memo] : 'N/A',
          memoInAmountColumn: columnMapping.memoInAmountColumn,
        });
      }

      // Case 1: 입금/출금 분리형 (비고가 금액 컬럼에 섞여있는 특수 케이스 포함)
      if (columnMapping.deposit !== undefined || columnMapping.withdrawal !== undefined) {
        const depositRaw = columnMapping.deposit !== undefined ? row[columnMapping.deposit] : null;
        const withdrawalRaw = columnMapping.withdrawal !== undefined ? row[columnMapping.withdrawal] : null;

        // memoInAmountColumn 특수 케이스: 비고가 반대편 금액 컬럼에 있음
        if (columnMapping.memoInAmountColumn) {
          const depositParsed = parseAmount(depositRaw);
          const withdrawalParsed = parseAmount(withdrawalRaw);

          if (depositParsed !== null && depositParsed > 0) {
            // 입금 거래: 입금금액에 숫자, 출금금액 컬럼에 비고
            depositAmount = depositParsed;
            memo = withdrawalRaw && !parseAmount(withdrawalRaw) ? String(withdrawalRaw) : "";
          } else if (withdrawalParsed !== null && withdrawalParsed > 0) {
            // 출금 거래: 출금금액에 숫자, 입금금액 컬럼에 비고
            withdrawalAmount = withdrawalParsed;
            memo = depositRaw && !parseAmount(depositRaw) ? String(depositRaw) : "";
          } else {
            // 둘 다 숫자가 아니면 그냥 파싱
            depositAmount = depositParsed;
            withdrawalAmount = withdrawalParsed;
          }
        } else {
          // 일반 케이스
          depositAmount = parseAmount(depositRaw);
          withdrawalAmount = parseAmount(withdrawalRaw);
        }
      }
      // Case 2: 단일 금액 컬럼 (거래구분 있거나 금액 부호로 판단)
      else if (columnMapping.amount !== undefined) {
        const amount = parseAmount(row[columnMapping.amount]);
        const transactionTypeRaw = columnMapping.transaction_type !== undefined
          ? String(row[columnMapping.transaction_type] ?? "")
          : "";
        
        // 병합된 행 대응: 첫 단어만 추출 ("출금 NH올원뱅크" → "출금")
        const transactionType = extractFirstWord(transactionTypeRaw);

        // D형: 금액 자체에 +/- 부호 포함 (거래구분 컬럼 없음)
        if (!columnMapping.transaction_type && amount !== null) {
          if (amount > 0) {
            depositAmount = amount;
          } else if (amount < 0) {
            withdrawalAmount = Math.abs(amount);
          } else {
            // 금액이 0인 경우 스킵
            skipped++;
            errors.push({ row: i + 1, error: "Amount is 0" });
            continue;
          }
        }
        // 거래구분 컬럼이 있는 경우: 입금/출금만 처리, 매도/매수 등 비입출금 필터링
        else if (columnMapping.transaction_type) {
          // 입금 관련 키워드
          const isDeposit = transactionType.includes("+") ||
            transactionType.includes("입금") ||
            transactionType.includes("받기") ||
            transactionType.includes("충전") ||
            transactionType.includes("적립");
          
          // 출금 관련 키워드
          const isWithdrawal = transactionType.includes("-") ||
            transactionType.includes("출금") ||
            transactionType.includes("보내기") ||
            transactionType.includes("차감") ||
            transactionType.includes("이체") ||
            transactionType.includes("결제") ||
            transactionType.includes("지급") ||
            transactionType.includes("인출");

          // 입출금도 아닌 경우 (매도, 매수, 체결, 배당 등) → 스킵
          if (!isDeposit && !isWithdrawal) {
            skipped++;
            errors.push({ row: i + 1, error: `Non-deposit/withdrawal transaction type: "${transactionType}"` });
            continue;
          }

          // 금액 부호 기반 판단 (양수=입금, 음수=출금)
          if (amount !== null && amount !== 0) {
            if (amount > 0) {
              depositAmount = isDeposit ? amount : null;
              withdrawalAmount = isWithdrawal ? amount : null;
            } else {
              depositAmount = isDeposit ? Math.abs(amount) : null;
              withdrawalAmount = isWithdrawal ? Math.abs(amount) : null;
            }
            // 키워드 기반으로 결정이 안 된 경우 부호로 판단
            if (!depositAmount && !withdrawalAmount) {
              if (amount > 0) depositAmount = amount;
              else withdrawalAmount = Math.abs(amount);
            }
          } else if (amount !== null) {
            // 금액이 0인 경우
            if (isDeposit) depositAmount = Math.abs(amount);
            else withdrawalAmount = Math.abs(amount);
          }
        }
        // 거래구분도 없고 금액 부호도 없는 경우 (폴백)
        else if (amount !== null && amount !== 0) {
          if (amount > 0) {
            depositAmount = amount;
          } else {
            withdrawalAmount = Math.abs(amount);
          }
        }
      }

      // Parse balance (마지막 숫자 추출 - 병합된 행 대응)
      const balance = parseBalance(
        columnMapping.balance !== undefined ? row[columnMapping.balance] : null
      );

      // At least one amount field must be present
      if (!depositAmount && !withdrawalAmount) {
        skipped++;
        errors.push({
          row: i + 1,
          error: "No amount data (both deposit and withdrawal are empty)",
        });
        continue;
      }

      // Parse memo (optional) - memoInAmountColumn이 아닌 경우에만
      if (!memo && columnMapping.memo !== undefined) {
        const memoRaw = row[columnMapping.memo];
        const memoStr = String(memoRaw ?? "");
        
        // 병합된 행 대응: 마지막 부분 추출 ("출금 NH올원뱅크" → "NH올원뱅크")
        // 단, 거래구분 컬럼과 같은 인덱스면 두 번째 단어 추출
        if (columnMapping.rowMergePattern === "pair" && 
            columnMapping.memo === columnMapping.transaction_type) {
          const words = memoStr.split(/\s+/);
          memo = words.length > 1 ? words.slice(1).join(" ") : memoStr;
        } else {
          memo = memoStr;
        }
        
        // 디버그: 첫 10개 행에 대해 비고 파싱 상세 로그
        if (i < 10) {
          console.log(`[Data Extractor] Row ${i + 1} memo debug:`, {
            memoColumnIndex: columnMapping.memo,
            memoRawValue: memoRaw,
            memoRawType: typeof memoRaw,
            memoParsed: memo,
            rowLength: Array.isArray(row) ? row.length : 'not array',
            rowKeys: typeof row === 'object' ? Object.keys(row as object).slice(0, 5) : 'N/A',
          });
        }
      } else if (i < 5) {
        console.log(`[Data Extractor] Row ${i + 1} memo skipped:`, {
          memoAlreadySet: !!memo,
          memoColumnDefined: columnMapping.memo !== undefined,
          memoInAmountColumn: columnMapping.memoInAmountColumn,
        });
      }

      // MEDIUM-3 FIX: Validate metadata size before adding
      // 날짜 컬럼에서 추출된 적요 통합
      // (날짜+적요 합쳐진 셀에서 추출된 "토스 임숙자" 같은 값)
      if (dateColumnMemo) {
        if (!memo) {
          // 비고가 없으면 날짜 컬럼에서 추출된 적요 사용
          memo = dateColumnMemo;
        } else if (!memo.includes(dateColumnMemo)) {
          // 비고에 이미 다른 값이 있고, 날짜컬럼 적요가 중복되지 않으면 앞에 추가
          memo = `${dateColumnMemo} ${memo}`;
        }
      }

      const metadata = {
        rowNumber: i + 1,
        originalData: row as Prisma.JsonValue,
      };

      const metadataSize = JSON.stringify(metadata).length;

      if (metadataSize > MAX_METADATA_SIZE) {
        skipped++;
        errors.push({
          row: i + 1,
          error: `Row data too large (${metadataSize} bytes > ${MAX_METADATA_SIZE} bytes limit)`,
        });
        continue; // Skip this row
      }

      // 잔액 검증: 이전 잔액과 현재 잔액을 비교하여 입금/출금 방향 확인
      if (previousBalance !== null && balance !== null) {
        const expectedChange = (depositAmount ?? 0) - (withdrawalAmount ?? 0);
        const actualChange = balance - previousBalance;
        
        // 허용 오차 (소수점 반올림 등으로 인한 미세한 차이 허용)
        const tolerance = 1;
        
        if (Math.abs(expectedChange - actualChange) > tolerance) {
          // 입금/출금이 반대로 되어 있는지 확인
          const reverseChange = -(depositAmount ?? 0) + (withdrawalAmount ?? 0);
          
          if (Math.abs(reverseChange - actualChange) <= tolerance) {
            // 입금/출금이 반대로 되어 있음 - 자동 수정
            console.log(`[Data Extractor] Row ${i + 1}: 입금/출금 반전 감지, 자동 수정`);
            const tempDeposit = depositAmount;
            depositAmount = withdrawalAmount;
            withdrawalAmount = tempDeposit;
            
            balanceValidationWarnings.push(
              `Row ${i + 1}: 입금/출금 반전 자동 수정 (이전잔액: ${previousBalance}, 현재잔액: ${balance})`
            );
          } else {
            // 잔액 불일치 경고 (수정하지 않음 - 데이터 손실 방지)
            balanceValidationWarnings.push(
              `Row ${i + 1}: 잔액 불일치 (예상: ${previousBalance + expectedChange}, 실제: ${balance})`
            );
          }
        }
      }
      
      // 현재 잔액을 이전 잔액으로 저장
      if (balance !== null) {
        previousBalance = balance;
      }

      // Create transaction record
      transactions.push({
        caseId,
        documentId,
        transactionDate,
        depositAmount,
        withdrawalAmount,
        balance,
        memo: memo || undefined,
        rowNumber: i + 1, // 원본 순서 유지를 위한 행 번호
        rawMetadata: metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      skipped++;
      errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ===== 같은 날짜 그룹 내 잔액 기반 순서 보정 =====
  // OCR 결과가 같은 날짜 내에서 순서가 뒤바뀌는 경우가 있으므로
  // 잔액 연속성(이전 잔액 + 입금 - 출금 = 현재 잔액)을 기준으로 순서를 검증하고 보정한다
  if (transactions.length > 1) {
    // 날짜별 그룹핑
    const dateGroups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const dateKey = tx.transactionDate instanceof Date 
        ? tx.transactionDate.toISOString().slice(0, 10) 
        : String(tx.transactionDate);
      if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, []);
      dateGroups.get(dateKey)!.push(tx);
    }

    let needsReorder = false;
    const reorderedTransactions: typeof transactions = [];
    let prevGroupLastBalance: number | null = null;

    // 날짜 순서대로 처리
    const sortedDates = [...dateGroups.keys()].sort();
    for (const dateKey of sortedDates) {
      const group = dateGroups.get(dateKey)!;
      
      if (group.length <= 1) {
        // 1건이면 보정 불필요
        if (group[0]?.balance != null) prevGroupLastBalance = Number(group[0].balance);
        reorderedTransactions.push(...group);
        continue;
      }

      // 현재 순서의 잔액 연속성 점수 계산
      const forwardScore = calculateBalanceConsistency(group, prevGroupLastBalance);
      // 역순의 잔액 연속성 점수 계산
      const reversedGroup = [...group].reverse();
      const reverseScore = calculateBalanceConsistency(reversedGroup, prevGroupLastBalance);

      if (reverseScore > forwardScore) {
        // 역순이 더 맞으면 순서 뒤집기
        console.log(`[Data Extractor] Date ${dateKey}: 역순이 잔액 연속성이 더 높음 (정순: ${forwardScore}/${group.length - 1}, 역순: ${reverseScore}/${group.length - 1}) → 순서 보정`);
        // rowNumber 재할당 (역순 → 정순)
        const baseRowNumber = Number(group[0]!.rowNumber ?? 0);
        for (let i = 0; i < reversedGroup.length; i++) {
          reversedGroup[i]!.rowNumber = baseRowNumber + i;
        }
        reorderedTransactions.push(...reversedGroup);
        needsReorder = true;
        const lastTx = reversedGroup[reversedGroup.length - 1];
        if (lastTx?.balance != null) prevGroupLastBalance = Number(lastTx.balance);
      } else {
        reorderedTransactions.push(...group);
        const lastTx = group[group.length - 1];
        if (lastTx?.balance != null) prevGroupLastBalance = Number(lastTx.balance);
      }
    }

    if (needsReorder) {
      // rowNumber 전체 재할당
      for (let i = 0; i < reorderedTransactions.length; i++) {
        reorderedTransactions[i]!.rowNumber = i + 1;
      }
      transactions.length = 0;
      transactions.push(...reorderedTransactions);
      console.log(`[Data Extractor] 순서 보정 완료: ${transactions.length}건`);
    }
  }

  // Bulk insert using Prisma createMany (performance optimization)
  let success = 0;
  try {
    const result = await tx.transaction.createMany({
      data: transactions,
      skipDuplicates: true, // CRITICAL-1 FIX: Skip duplicates based on unique constraint
    });

    success = result.count;
    
    // 추출 결과 상세 로그
    const duplicatesSkipped = transactions.length - success;
    console.log(`[Data Extractor] Extraction complete:`, {
      prepared: transactions.length,
      saved: success,
      skippedByValidation: skipped,
      skippedByDuplicate: duplicatesSkipped,
      errors: errors.length,
      balanceWarnings: balanceValidationWarnings.length,
    });
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log(`[Data Extractor] First errors:`, errors.slice(0, 10));
    }
    
    // 잔액 검증 경고 로그
    if (balanceValidationWarnings.length > 0) {
      console.log(`[Data Extractor] Balance validation warnings:`, balanceValidationWarnings.slice(0, 20));
    }
  } catch (error) {
    // Log Prisma error details
    console.error("[Prisma Bulk Insert Error]", error);

    // Re-throw for caller to handle
    throw error;
  }

  return { success, skipped, errors };
    },
    {
      maxWait: 60000, // MEDIUM-1 FIX: Wait max 60 seconds for transaction to start
      timeout: 90000, // MEDIUM-1 FIX: Transaction timeout 90 seconds for bulk insert
    }
  );
}
