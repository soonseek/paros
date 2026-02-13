/**
 * Column Analyzer Client
 *
 * Python Column Analyzer Service를 호출하는 클라이언트
 * LLM 기반 거래내역서 컬럼 분석을 수행합니다.
 */

import { z } from "zod";

/**
 * 컬럼 분석 결과 스키마
 */
export const ColumnAnalysisResultSchema = z.object({
  success: z.boolean(),
  tableType: z.string().optional().nullable(),
  columnMapping: z.object({
    거래일자: z.string(),
    구분: z.string().optional().nullable(),
    입금금액: z.string().optional().nullable(),
    출금금액: z.string().optional().nullable(),
    금액: z.string().optional().nullable(),
    잔액: z.string().optional().nullable(),
    비고: z.string(),
  }),
  headerRowIndex: z.number(),
  dataStartRowIndex: z.number(),
  transactionTypeDetection: z.object({
    method: z.enum(["separate_columns", "type_column", "sign_in_type", "amount_sign"]),
    details: z.string().optional().nullable(),
  }),
  memoAnalysis: z.object({
    columnName: z.string(),
    contentType: z.string(),
    confidence: z.number(),
  }),
  confidence: z.number(),
  reasoning: z.string(),
  error: z.string().optional().nullable(),
});

export type ColumnAnalysisResult = z.infer<typeof ColumnAnalysisResultSchema>;

/**
 * Column Analyzer Service URL
 */
const ANALYZER_SERVICE_URL = process.env.COLUMN_ANALYZER_URL || "http://localhost:8002";

/**
 * PDF 파일로부터 컬럼 분석
 *
 * @param pdfBuffer - PDF 파일 버퍼
 * @returns 컬럼 분석 결과
 */
export async function analyzeColumnsFromPdf(pdfBuffer: Buffer): Promise<ColumnAnalysisResult> {
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
    formData.append("file", blob, "transaction.pdf");

    const response = await fetch(`${ANALYZER_SERVICE_URL}/analyze/pdf`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return ColumnAnalysisResultSchema.parse(data);
  } catch (error) {
    console.error("[Column Analyzer Client] PDF 분석 실패:", error);
    return createErrorResult(error);
  }
}

/**
 * 테이블 데이터로부터 컬럼 분석
 *
 * @param headers - 헤더 배열
 * @param rows - 데이터 행 배열
 * @returns 컬럼 분석 결과
 */
export async function analyzeColumnsFromTableData(
  headers: string[],
  rows: string[][]
): Promise<ColumnAnalysisResult> {
  try {
    const response = await fetch(`${ANALYZER_SERVICE_URL}/analyze/table`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ headers, rows }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return ColumnAnalysisResultSchema.parse(data);
  } catch (error) {
    console.error("[Column Analyzer Client] 테이블 분석 실패:", error);
    return createErrorResult(error);
  }
}

/**
 * 에러 결과 생성
 */
function createErrorResult(error: unknown): ColumnAnalysisResult {
  return {
    success: false,
    columnMapping: {
      거래일자: "",
      비고: "",
    },
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    transactionTypeDetection: {
      method: "separate_columns",
    },
    memoAnalysis: {
      columnName: "",
      contentType: "unknown",
      confidence: 0,
    },
    confidence: 0,
    reasoning: "",
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * 컬럼 분석 결과를 기존 ColumnMapping 인덱스로 변환
 *
 * @param result - LLM 분석 결과
 * @param headers - 실제 헤더 배열
 * @returns 컬럼 인덱스 매핑
 */
export function convertToColumnIndices(
  result: ColumnAnalysisResult,
  headers: string[]
): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  const findIndex = (columnName: string | null | undefined): number => {
    if (!columnName) return -1;
    const normalized = columnName.trim().toLowerCase();
    return normalizedHeaders.findIndex((h) => h.includes(normalized) || normalized.includes(h));
  };

  // 거래일자 (필수)
  mapping.date = findIndex(result.columnMapping.거래일자);

  // 입금/출금
  if (result.transactionTypeDetection.method === "separate_columns") {
    mapping.deposit = findIndex(result.columnMapping.입금금액);
    mapping.withdrawal = findIndex(result.columnMapping.출금금액);
  } else {
    const amountIndex = findIndex(result.columnMapping.금액);
    if (amountIndex !== -1) {
      mapping.deposit = amountIndex;
      mapping.withdrawal = amountIndex;
    }
  }

  // 잔액
  mapping.balance = findIndex(result.columnMapping.잔액);

  // 비고
  mapping.memo = findIndex(result.columnMapping.비고);

  return mapping;
}

/**
 * 서비스 헬스 체크
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ANALYZER_SERVICE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
