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

import { Prisma, PrismaClient } from "@prisma/client";

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
    const cleaned = dateValue.trim().replace(/\./g, "-").replace(/\//g, "-");
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
  if (!amountValue) return null;

  // Number (pass through)
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
  if (!balanceValue) return null;

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
      const transactionDate = parseDate(dateValue);

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
      // Case 2: 단일 금액 + 거래구분 ([+]/[-])
      else if (columnMapping.amount !== undefined) {
        const amount = parseAmount(row[columnMapping.amount]);
        const transactionTypeRaw = columnMapping.transaction_type !== undefined
          ? String(row[columnMapping.transaction_type] ?? "")
          : "";
        
        // 병합된 행 대응: 첫 단어만 추출 ("출금 NH올원뱅크" → "출금")
        const transactionType = extractFirstWord(transactionTypeRaw);

        // [+] 또는 입금 관련 키워드면 입금, [-] 또는 출금 관련 키워드면 출금
        const isDeposit = transactionType.includes("+") ||
          transactionType.includes("입금") ||
          transactionType.includes("받기") ||
          transactionType.includes("충전") ||
          transactionType.includes("적립");

        if (isDeposit) {
          depositAmount = amount;
        } else {
          withdrawalAmount = amount;
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

      // Create transaction record
      transactions.push({
        caseId,
        documentId,
        transactionDate,
        depositAmount,
        withdrawalAmount,
        balance,
        memo: memo || undefined,
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
    });
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log(`[Data Extractor] First errors:`, errors.slice(0, 10));
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
