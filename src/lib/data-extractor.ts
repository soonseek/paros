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

  for (let i = startRow; i < rawData.length; i++) {
    const row = rawData[i];

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

      // Case 1: 입금/출금 분리형
      if (columnMapping.deposit !== undefined || columnMapping.withdrawal !== undefined) {
        depositAmount = parseAmount(
          columnMapping.deposit !== undefined ? row[columnMapping.deposit] : null
        );
        withdrawalAmount = parseAmount(
          columnMapping.withdrawal !== undefined
            ? row[columnMapping.withdrawal]
            : null
        );
      }
      // Case 2: 단일 금액 + 거래구분 ([+]/[-])
      else if (columnMapping.amount !== undefined) {
        const amount = parseAmount(row[columnMapping.amount]);
        const transactionType = columnMapping.transaction_type !== undefined
          ? String(row[columnMapping.transaction_type] ?? "")
          : "";

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

      const balance = parseAmount(
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

      // Parse memo (optional)
      const memo =
        columnMapping.memo !== undefined
          ? String(row[columnMapping.memo] ?? "")
          : "";

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
