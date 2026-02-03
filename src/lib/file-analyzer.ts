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
  hasAmountColumns,
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

  // LLM 분석 메타데이터 (LLM 분석 사용 시)
  llmAnalysis?: {
    transactionTypeMethod: string; // separate_columns, type_column, sign_in_type, amount_sign
    memoInAmountColumn?: boolean; // 비고가 금액 컬럼에 섞여있는 특수 케이스
    reasoning: string; // 분석 근거
  };

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
 * @param useLlmAnalysis - LLM 기반 분석 사용 여부 (기본값: false)
 * @returns Analysis result with column mapping and metadata
 * @throws Error if analysis fails
 *
 * @example
 * const result = await analyzeFileStructure(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
 * // Returns: { status: "completed", columnMapping: { date: "날짜", ... }, confidence: 0.95, ... }
 */
export async function analyzeFileStructure(
  fileBuffer: Buffer,
  mimeType: string,
  useLlmAnalysis: boolean = false,
  prisma?: any, // Prisma client for template lookup
  upstageApiKey?: string // Upstage API key from DB
): Promise<AnalysisResult> {
  try {
    console.log("[File Analysis] Starting analysis for MIME type:", mimeType);
    console.log("[File Analysis] LLM Analysis mode:", useLlmAnalysis);

    // Detect file format
    const detectedFormat = detectFileFormat(mimeType);
    console.log("[File Analysis] Detected format:", detectedFormat);

    // Parse file based on format
    const parsedData = await parseFile(fileBuffer, detectedFormat, upstageApiKey);
    const { headers, totalRows, headerRowIndex, extractedData } = parsedData;

    // DEBUG: Log detected headers
    console.log("[File Analysis] Detected headers:", headers);
    console.log("[File Analysis] Header row index:", headerRowIndex);
    console.log("[File Analysis] Total rows:", totalRows);

    // === 3단계 분류 파이프라인 ===
    // Layer 1 & 2: 템플릿 기반 분류 시도
    if (prisma && extractedData) {
      console.log("[File Analysis] Trying template classification (Layer 1 & 2)...");
      try {
        const { classifyTransaction } = await import("./template-classifier");
        // 페이지 텍스트 전달 (PDF의 경우)
        const pageTexts = (parsedData as any).pageTexts;
        const templateResult = await classifyTransaction(prisma, headers, extractedData.rows, pageTexts);

        if (templateResult) {
          console.log(`[File Analysis] Template match! Layer ${templateResult.layer}: ${templateResult.templateName}`);
          
          // 템플릿 컬럼 매핑을 헤더명 기반으로 변환
          const templateColumnMapping: Record<string, string> = {};
          
          for (const [key, index] of Object.entries(templateResult.columnMapping)) {
            if (typeof index === "number" && index >= 0 && index < headers.length) {
              templateColumnMapping[key] = headers[index] || "";
            }
          }

          // memoInAmountColumn 플래그
          if (templateResult.memoInAmountColumn) {
            (templateColumnMapping as Record<string, unknown>).memoInAmountColumn = true;
          }
          
          // rowMergePattern 플래그
          if (templateResult.parseRules?.rowMergePattern) {
            (templateColumnMapping as Record<string, unknown>).rowMergePattern = templateResult.parseRules.rowMergePattern;
          }

          return {
            status: "completed",
            columnMapping: templateColumnMapping,
            headerRowIndex,
            totalRows,
            detectedFormat,
            hasHeaders: true,
            confidence: templateResult.confidence,
            extractedData,
            llmAnalysis: {
              transactionTypeMethod: templateResult.parseRules?.isDeposit 
                ? "custom_rule" 
                : (templateColumnMapping.deposit && templateColumnMapping.withdrawal)
                  ? "separate_columns"
                  : "type_column",
              memoInAmountColumn: templateResult.memoInAmountColumn,
              reasoning: `템플릿 매칭 (Layer ${templateResult.layer}): ${templateResult.templateName}`,
            },
          };
        }

        console.log("[File Analysis] No template match, proceeding to Layer 3 (LLM fallback)");
      } catch (error) {
        console.warn("[File Analysis] Template classification error, falling back to LLM:", error);
      }
    }

    // Layer 3: LLM 기반 분석 (기존 로직)
    if (useLlmAnalysis && extractedData) {
      console.log("[File Analysis] Using LLM-based column analysis (Layer 3)...");
      try {
        const { analyzeColumnsWithLLM } = await import("./column-analyzer-llm");
        
        const llmResult = await analyzeColumnsWithLLM(headers, extractedData.rows);
        
        if (llmResult.success) {
          console.log("[File Analysis] LLM analysis successful");
          console.log("[File Analysis] LLM confidence:", llmResult.confidence);
          console.log("[File Analysis] LLM column mapping:", llmResult.columnMapping);
          console.log("[File Analysis] Transaction type method:", llmResult.transactionTypeMethod);
          
          // LLM 결과를 기존 형식으로 변환
          const llmColumnMapping: Record<string, string> = {};
          
          if (llmResult.columnMapping.date) {
            llmColumnMapping.date = llmResult.columnMapping.date;
          }
          if (llmResult.columnMapping.deposit) {
            llmColumnMapping.deposit = llmResult.columnMapping.deposit;
          }
          if (llmResult.columnMapping.withdrawal) {
            llmColumnMapping.withdrawal = llmResult.columnMapping.withdrawal;
          }
          if (llmResult.columnMapping.amount) {
            llmColumnMapping.amount = llmResult.columnMapping.amount;
          }
          if (llmResult.columnMapping.transactionType) {
            llmColumnMapping.transaction_type = llmResult.columnMapping.transactionType;
          }
          if (llmResult.columnMapping.balance) {
            llmColumnMapping.balance = llmResult.columnMapping.balance;
          }
          if (llmResult.columnMapping.memo) {
            llmColumnMapping.memo = llmResult.columnMapping.memo;
          }
          
          // memoInAmountColumn 플래그를 columnMapping에 포함
          if (llmResult.memoInAmountColumn) {
            (llmColumnMapping as Record<string, unknown>).memoInAmountColumn = true;
          }
          
          return {
            status: "completed",
            columnMapping: llmColumnMapping,
            headerRowIndex,
            totalRows,
            detectedFormat,
            hasHeaders: true,
            confidence: llmResult.confidence,
            extractedData,
            // LLM 분석 메타데이터 추가
            llmAnalysis: {
              transactionTypeMethod: llmResult.transactionTypeMethod,
              memoInAmountColumn: llmResult.memoInAmountColumn,
              reasoning: llmResult.reasoning,
            },
          } as AnalysisResult;
        } else {
          console.warn("[File Analysis] LLM analysis failed, falling back to rule-based:", llmResult.error);
        }
      } catch (llmError) {
        console.warn("[File Analysis] LLM analysis error, falling back to rule-based:", llmError);
      }
    }

    // 기존 규칙 기반 분석 (폴백)
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

    // 금액 관련 열 검증
    const hasAmount = hasAmountColumns(detectedTypes);
    if (!hasAmount) {
      console.error("[File Analysis] No amount-related columns found");
    }

    // Build column mapping
    const columnMapping: Record<string, string> = {};
    for (const detection of detectedColumns) {
      if (detection.columnType !== ColumnType.UNKNOWN) {
        columnMapping[detection.columnType] = detection.columnName;
      }
    }

    console.log("[File Analysis] Final column mapping:", columnMapping);

    // 에러 메시지 생성
    let errorMessage: string | undefined;
    const errorDetails: Record<string, unknown> = {};

    if (missingRequired.length > 0) {
      errorMessage = `필수 열이 누락되었습니다: ${missingRequired.map(getColumnTypeLabel).join(", ")}`;
      errorDetails.missingRequired = missingRequired;
    } else if (!hasAmount) {
      errorMessage = "파일 구조 분석에서 금액 관련 열(입금액/출금액/거래금액/잔액)을 찾을 수 없습니다";
      errorDetails.missingAmountColumns = true;
    }

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
      ...(errorMessage && { errorMessage, errorDetails }),
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
  format: "excel" | "csv" | "pdf",
  upstageApiKey?: string
): Promise<{
  headers: string[];
  totalRows: number;
  headerRowIndex: number;
  extractedData?: { headers: string[]; rows: string[][] }; // Raw extracted data
  pageTexts?: string[]; // 페이지 텍스트 (PDF only)
}> {
  if (format === "pdf") {
    // Use Upstage API to parse PDF
    console.log("[PDF Analysis] Starting Upstage Document Parse API...");
    const tableData = await parsePdfWithUpstage(fileBuffer, upstageApiKey);
    console.log(`[PDF Analysis] Extracted ${tableData.totalRows} rows`);
    console.log(`[PDF Analysis] Extracted ${tableData.pageTexts?.length || 0} page texts`);

    return {
      headers: tableData.headers,
      totalRows: tableData.totalRows,
      headerRowIndex: 0, // PDF tables typically have headers in first row
      extractedData: {
        headers: tableData.headers,
        rows: tableData.rows,
      }, // Save raw data for reuse
      pageTexts: tableData.pageTexts, // 페이지 텍스트 포함
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
