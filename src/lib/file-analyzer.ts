/**
 * File Structure Analyzer
 *
 * Story 3.4: Analyzes uploaded financial transaction files (Excel/CSV/PDF) to detect structure.
 *
 * Features:
 * - Automatic file format detection (Excel/CSV/PDF)
 * - PDF OCR using Upstage Solar Document Parse API
 * - Column header identification with bilingual support (Korean/English)
 * - Confidence scoring (0.0 ~ 1.0) based on match quality
 * - Required column validation (date column is mandatory)
 * - Header row detection
 *
 * MVP Scope: Excel/CSV + PDF with Upstage OCR
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as XLSX from "xlsx";
import {
  inferColumnType,
  ColumnType,
  getMissingRequiredColumns,
  getColumnTypeLabel,
} from "./column-mapping";
import { parsePdfWithUpstage } from "./pdf-ocr";

/**
 * Analysis result interface
 */
export interface AnalysisResult {
  // Analysis status
  status: "pending" | "analyzing" | "completed" | "failed";

  // Column mapping result
  columnMapping: Record<string, string>; // { date: "날짜", deposit: "입금액", ... }
  headerRowIndex: number;
  totalRows: number;

  // Analysis metadata
  detectedFormat: "excel" | "csv" | "pdf";
  hasHeaders: boolean;
  confidence: number; // 0.0 ~ 1.0

  // Extracted raw data (for reuse in extractData)
  extractedData?: { headers: string[]; rows: string[][] };

  // Error information
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

/**
 * Column detection result with confidence
 */
interface ColumnDetection {
  columnType: ColumnType;
  columnName: string;
  columnIndex: number;
  confidence: number; // 0.0 ~ 1.0
}

/**
 * Analyze file structure from Buffer
 *
 * @param fileBuffer - Buffer containing file content
 * @param mimeType - MIME type from file upload
 * @returns Analysis result with column mapping and metadata
 * @throws Error if analysis fails
 *
 * @example
 * const result = await analyzeFileStructure(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
 * // Returns: { status: "completed", columnMapping: { date: "날짜", ... }, confidence: 0.95, ... }
 */
export async function analyzeFileStructure(
  fileBuffer: Buffer,
  mimeType: string
): Promise<AnalysisResult> {
  try {
    console.log("[File Analysis] Starting analysis for MIME type:", mimeType);

    // Detect file format
    const detectedFormat = detectFileFormat(mimeType);
    console.log("[File Analysis] Detected format:", detectedFormat);

    // Parse file based on format
    const parsedData = await parseFile(fileBuffer, detectedFormat);
    const { headers, totalRows, headerRowIndex, extractedData } = parsedData;

    // DEBUG: Log detected headers
    console.log("[File Analysis] Detected headers:", headers);
    console.log("[File Analysis] Header row index:", headerRowIndex);
    console.log("[File Analysis] Total rows:", totalRows);

    // Detect column types
    const detectedColumns = detectColumns(headers);

    // DEBUG: Log detected columns
    console.log("[File Analysis] Detected columns:", detectedColumns.map(col => ({
      type: col.columnType,
      name: col.columnName,
      confidence: col.confidence
    })));

    // Calculate confidence score
    const confidence = calculateConfidence(detectedColumns, headers.length);
    console.log("[File Analysis] Confidence score:", confidence);

    // Check for missing required columns
    const detectedTypes = detectedColumns.map((col) => col.columnType);
    const missingRequired = getMissingRequiredColumns(detectedTypes);

    if (missingRequired.length > 0) {
      console.error("[File Analysis] Missing required columns:", missingRequired);
    }

    // Build column mapping
    const columnMapping: Record<string, string> = {};
    for (const detection of detectedColumns) {
      if (detection.columnType !== ColumnType.UNKNOWN) {
        columnMapping[detection.columnType] = detection.columnName;
      }
    }

    console.log("[File Analysis] Final column mapping:", columnMapping);

    // Return analysis result
    return {
      status: "completed",
      columnMapping,
      headerRowIndex,
      totalRows,
      detectedFormat,
      hasHeaders: true,
      confidence,
      extractedData, // Include extracted raw data
      ...(missingRequired.length > 0 && {
        errorMessage: `필수 열이 누락되었습니다: ${missingRequired.map(getColumnTypeLabel).join(", ")}`,
        errorDetails: { missingRequired },
      }),
    };
  } catch (error) {
    console.error("[File Analysis Error]", error);
    return {
      status: "failed",
      columnMapping: {},
      headerRowIndex: 0,
      totalRows: 0,
      detectedFormat: "excel",
      hasHeaders: false,
      confidence: 0.0,
      errorMessage:
        error instanceof Error ? error.message : "파일 구조 분석 실패",
      errorDetails: {
        originalError:
          error instanceof Error ? error.stack : String(error),
      },
    };
  }
}

/**
 * Detect file format from MIME type
 *
 * @param mimeType - MIME type from file upload
 * @returns Detected file format
 */
function detectFileFormat(mimeType: string): "excel" | "csv" | "pdf" {
  if (mimeType.includes("pdf")) {
    return "pdf";
  } else if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet")
  ) {
    return "excel";
  } else if (mimeType.includes("csv")) {
    return "csv";
  }

  // Default to Excel for unknown types
  return "excel";
}

/**
 * Parse file and extract headers
 *
 * @param fileBuffer - Buffer containing file content
 * @param format - Detected file format
 * @returns Headers, total rows, and header row index
 */
async function parseFile(
  fileBuffer: Buffer,
  format: "excel" | "csv" | "pdf"
): Promise<{
  headers: string[];
  totalRows: number;
  headerRowIndex: number;
  extractedData?: { headers: string[]; rows: string[][] }; // Raw extracted data
}> {
  if (format === "pdf") {
    // Use Upstage API to parse PDF
    console.log("[PDF Analysis] Starting Upstage Document Parse API...");
    const tableData = await parsePdfWithUpstage(fileBuffer);
    console.log(`[PDF Analysis] Extracted ${tableData.totalRows} rows`);

    return {
      headers: tableData.headers,
      totalRows: tableData.totalRows,
      headerRowIndex: 0, // PDF tables typically have headers in first row
      extractedData: {
        headers: tableData.headers,
        rows: tableData.rows,
      }, // Save raw data for reuse
    };
  }

  // Parse Excel/CSV file using xlsx library
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("엑셀 파일에 시트가 없습니다");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("첫 번째 시트를 찾을 수 없습니다");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error("워크시트를 찾을 수 없습니다");
  }

  // Convert to JSON with header option
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Use array of arrays
    defval: "", // Default value for empty cells
  });

  if (jsonData.length === 0) {
    throw new Error("파일에 데이터가 없습니다");
  }

  // Detect header row (assume first row with valid column names)
  let headerRowIndex = 0;
  const firstRow = jsonData[0] as any[];
  if (!firstRow) {
    throw new Error("첫 번째 행을 찾을 수 없습니다");
  }
  let headers = firstRow.map((cell) => String(cell));

  // Try to find header row if first row doesn't look like headers
  if (!looksLikeHeaders(headers)) {
    for (let i = 1; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (!row) continue;

      const candidateHeaders = row.map((cell) => String(cell));
      if (looksLikeHeaders(candidateHeaders)) {
        headerRowIndex = i;
        headers = candidateHeaders;
        break;
      }
    }
  }

  // Filter out empty headers
  headers = headers.filter((h) => h.trim().length > 0);

  return {
    headers,
    totalRows: jsonData.length - headerRowIndex - 1, // Exclude header row
    headerRowIndex,
  };
}

/**
 * Check if row looks like headers
 *
 * @param row - Row data
 * @returns True if row looks like headers
 */
function looksLikeHeaders(row: string[]): boolean {
  // Check if at least one column matches known column types
  const matchingColumns = row.filter((cell): cell is string => {
    return typeof cell === "string" && inferColumnType(cell) !== ColumnType.UNKNOWN;
  });

  return matchingColumns.length >= 2; // At least 2 recognizable columns
}

/**
 * Detect column types from headers
 *
 * @param headers - Array of header names
 * @returns Array of column detections
 */
function detectColumns(headers: string[]): ColumnDetection[] {
  const detections: ColumnDetection[] = [];

  for (let i = 0; i < headers.length; i++) {
    const columnName = headers[i];
    if (!columnName) continue; // Skip undefined/empty headers

    const columnType = inferColumnType(columnName);
    const confidence = calculateColumnConfidence(columnName, columnType);

    detections.push({
      columnType,
      columnName,
      columnIndex: i,
      confidence,
    });
  }

  return detections;
}

/**
 * Calculate confidence score for a single column
 *
 * @param columnName - Column name
 * @param columnType - Detected column type
 * @returns Confidence score (0.0 ~ 1.0)
 */
function calculateColumnConfidence(
  columnName: string,
  columnType: ColumnType
): number {
  if (columnType === ColumnType.UNKNOWN) {
    return 0.0;
  }

  // Base confidence for successful detection
  // Future enhancement: Could calculate based on exact vs partial match
  return 0.9; // High confidence for any successful detection
}

/**
 * Calculate overall confidence score
 *
 * @param detections - Array of column detections
 * @param totalColumns - Total number of columns
 * @returns Overall confidence score (0.0 ~ 1.0)
 */
function calculateConfidence(
  detections: ColumnDetection[],
  totalColumns: number
): number {
  if (totalColumns === 0) {
    return 0.0;
  }

  // Calculate average confidence for detected columns
  const detectedColumns = detections.filter(
    (d) => d.columnType !== ColumnType.UNKNOWN
  );

  if (detectedColumns.length === 0) {
    return 0.0;
  }

  const avgConfidence =
    detectedColumns.reduce((sum, d) => sum + d.confidence, 0) /
    detectedColumns.length;

  // Adjust by coverage (how many columns we detected)
  const coverage = detectedColumns.length / totalColumns;

  // Weight confidence 70% and coverage 30%
  return avgConfidence * 0.7 + coverage * 0.3;
}
