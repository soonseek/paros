/**
 * Transaction Analysis Orchestrator
 *
 * PDF 거래내역서 분석을 위한 에이전트 오케스트레이션 시스템
 *
 * 파이프라인:
 * 1. PDF 업로드 → 테이블 추출 (Upstage OCR)
 * 2. LLM 컬럼 분석기 (Gemini) → 동적 컬럼 매핑
 * 3. 표준 형식 변환 → 거래일자, 구분, 금액, 잔액, 비고
 * 4. 데이터베이스 저장 또는 UI 반환
 *
 * 특징:
 * - 새로운 형식의 내역서도 자동 대응
 * - 거래 테이블이 아닌 테이블 자동 회피
 * - 비고 컬럼 지능적 추론
 */

import {
  analyzeColumnsFromPdf,
  analyzeColumnsFromTableData,
  ColumnAnalysisResult,
  determineTransactionType,
  convertToColumnMapping,
} from "./column-analyzer-agent";
import { parsePdfWithUpstage } from "@/lib/pdf-ocr";
import { parseDate, parseAmount } from "@/lib/data-extractor";

/**
 * 표준화된 거래 내역 인터페이스
 */
export interface StandardizedTransaction {
  거래일자: Date;
  구분: "입금" | "출금";
  금액: number; // 양수, 부호는 구분으로 결정
  잔액?: number;
  비고: string;
}

/**
 * 포맷된 거래 내역 (UI 표시용)
 */
export interface FormattedStandardTransaction {
  거래일자: string; // "YYYY-MM-DD"
  구분: "입금" | "출금";
  구분색상: string; // CSS class
  금액: string; // "+1,234,567" or "-1,234,567"
  잔액?: string; // "1,234,567"
  비고: string;
}

/**
 * 오케스트레이션 결과
 */
export interface OrchestrationResult {
  success: boolean;
  transactions: StandardizedTransaction[];
  formattedTransactions: FormattedStandardTransaction[];
  analysisResult: ColumnAnalysisResult;
  statistics: {
    total: number;
    success: number;
    skipped: number;
    입금건수: number;
    출금건수: number;
    총입금액: number;
    총출금액: number;
  };
  errors: Array<{ row: number; error: string }>;
}

/**
 * PDF 거래내역서를 분석하고 표준 형식으로 변환
 *
 * @param pdfBuffer - PDF 파일 버퍼
 * @param emergentLlmKey - Emergent LLM API Key
 * @param upstageApiKey - Upstage API Key (OCR용)
 * @returns 오케스트레이션 결과
 */
export async function analyzeTransactionPdf(
  pdfBuffer: Buffer,
  emergentLlmKey: string,
  upstageApiKey?: string
): Promise<OrchestrationResult> {
  const errors: Array<{ row: number; error: string }> = [];

  try {
    console.log("[Orchestrator] 1단계: PDF 테이블 추출 시작");

    // 1단계: PDF에서 테이블 추출 (Upstage OCR 사용)
    let tableData: { headers: string[]; rows: string[][]; totalRows: number };

    if (upstageApiKey) {
      // Upstage OCR 사용
      tableData = await parsePdfWithUpstage(pdfBuffer);
    } else {
      // OCR 없이 LLM이 직접 PDF 분석
      console.log("[Orchestrator] Upstage API Key 없음 - LLM 직접 PDF 분석");
      const analysisResult = await analyzeColumnsFromPdf(pdfBuffer, emergentLlmKey);

      if (!analysisResult.success) {
        return {
          success: false,
          transactions: [],
          formattedTransactions: [],
          analysisResult,
          statistics: {
            total: 0,
            success: 0,
            skipped: 0,
            입금건수: 0,
            출금건수: 0,
            총입금액: 0,
            총출금액: 0,
          },
          errors: [{ row: 0, error: analysisResult.error || "PDF 분석 실패" }],
        };
      }

      // PDF 직접 분석 시 테이블 데이터 없음 - 별도 처리 필요
      return {
        success: true,
        transactions: [],
        formattedTransactions: [],
        analysisResult,
        statistics: {
          total: 0,
          success: 0,
          skipped: 0,
          입금건수: 0,
          출금건수: 0,
          총입금액: 0,
          총출금액: 0,
        },
        errors: [{ row: 0, error: "테이블 추출을 위해 Upstage API Key가 필요합니다" }],
      };
    }

    console.log(`[Orchestrator] 테이블 추출 완료: ${tableData.totalRows}행`);
    console.log(`[Orchestrator] 헤더: ${tableData.headers.join(", ")}`);

    // 2단계: LLM 컬럼 분석
    console.log("[Orchestrator] 2단계: LLM 컬럼 분석 시작");
    const analysisResult = await analyzeColumnsFromTableData(tableData, emergentLlmKey);

    if (!analysisResult.success) {
      return {
        success: false,
        transactions: [],
        formattedTransactions: [],
        analysisResult,
        statistics: {
          total: tableData.totalRows,
          success: 0,
          skipped: tableData.totalRows,
          입금건수: 0,
          출금건수: 0,
          총입금액: 0,
          총출금액: 0,
        },
        errors: [{ row: 0, error: analysisResult.error || "컬럼 분석 실패" }],
      };
    }

    console.log(`[Orchestrator] 컬럼 분석 완료 (신뢰도: ${analysisResult.confidence})`);
    console.log(`[Orchestrator] 매핑: ${JSON.stringify(analysisResult.columnMapping)}`);

    // 3단계: 표준 형식으로 변환
    console.log("[Orchestrator] 3단계: 표준 형식 변환 시작");
    const transactions: StandardizedTransaction[] = [];
    const columnMapping = convertToColumnMapping(analysisResult, tableData.headers);

    let 입금건수 = 0;
    let 출금건수 = 0;
    let 총입금액 = 0;
    let 총출금액 = 0;

    for (let i = 0; i < tableData.rows.length; i++) {
      const row = tableData.rows[i];

      if (!row || row.length === 0) {
        continue; // 빈 행 스킵
      }

      try {
        // 날짜 파싱
        const dateIndex = columnMapping.date;
        if (dateIndex === -1 || dateIndex >= row.length) {
          errors.push({ row: i + 1, error: "날짜 컬럼 인덱스 오류" });
          continue;
        }

        const dateValue = row[dateIndex];
        const transactionDate = parseDate(dateValue);

        if (!transactionDate) {
          // 날짜가 아닌 행은 스킵 (헤더 반복, 빈 행 등)
          continue;
        }

        // 거래 유형 및 금액 판별 (LLM 분석 결과 기반)
        const typeResult = determineTransactionType(row, analysisResult, tableData.headers);

        if (!typeResult) {
          errors.push({ row: i + 1, error: "거래 유형/금액 파싱 실패" });
          continue;
        }

        // 잔액 파싱
        const balanceIndex = columnMapping.balance;
        const balance = balanceIndex !== -1 && balanceIndex < row.length
          ? parseAmount(row[balanceIndex])
          : undefined;

        // 비고 파싱
        const memoIndex = columnMapping.memo;
        let memo = "";

        if (memoIndex !== -1 && memoIndex < row.length) {
          memo = String(row[memoIndex] || "").trim();
        }

        // 특이점 처리: Type1 내역서에서 비고가 금액 컬럼에 있는 경우
        if (!memo && analysisResult.transactionTypeDetection.method === "separate_columns") {
          // 입금 시 출금 컬럼에 비고, 출금 시 입금 컬럼에 비고
          const depositIndex = columnMapping.deposit;
          const withdrawalIndex = columnMapping.withdrawal;

          if (typeResult.type === "입금" && withdrawalIndex !== -1) {
            const potentialMemo = row[withdrawalIndex];
            if (potentialMemo && typeof potentialMemo === "string" && !parseAmount(potentialMemo)) {
              memo = potentialMemo.trim();
            }
          } else if (typeResult.type === "출금" && depositIndex !== -1) {
            const potentialMemo = row[depositIndex];
            if (potentialMemo && typeof potentialMemo === "string" && !parseAmount(potentialMemo)) {
              memo = potentialMemo.trim();
            }
          }
        }

        const transaction: StandardizedTransaction = {
          거래일자: transactionDate,
          구분: typeResult.type,
          금액: typeResult.amount,
          잔액: balance ?? undefined,
          비고: memo,
        };

        transactions.push(transaction);

        // 통계 집계
        if (typeResult.type === "입금") {
          입금건수++;
          총입금액 += typeResult.amount;
        } else {
          출금건수++;
          총출금액 += typeResult.amount;
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 4단계: UI 표시용 포맷 변환
    const formattedTransactions = transactions.map(formatTransaction);

    console.log(`[Orchestrator] 변환 완료: ${transactions.length}건`);

    return {
      success: true,
      transactions,
      formattedTransactions,
      analysisResult,
      statistics: {
        total: tableData.totalRows,
        success: transactions.length,
        skipped: tableData.totalRows - transactions.length,
        입금건수,
        출금건수,
        총입금액,
        총출금액,
      },
      errors,
    };
  } catch (error) {
    console.error("[Orchestrator] 오류:", error);
    return {
      success: false,
      transactions: [],
      formattedTransactions: [],
      analysisResult: {
        success: false,
        columnMapping: { 거래일자: "", 비고: "" },
        headerRowIndex: 0,
        dataStartRowIndex: 1,
        transactionTypeDetection: { method: "separate_columns" },
        memoAnalysis: { columnName: "", contentType: "", confidence: 0 },
        confidence: 0,
        reasoning: "",
        error: error instanceof Error ? error.message : String(error),
      },
      statistics: {
        total: 0,
        success: 0,
        skipped: 0,
        입금건수: 0,
        출금건수: 0,
        총입금액: 0,
        총출금액: 0,
      },
      errors: [{ row: 0, error: error instanceof Error ? error.message : String(error) }],
    };
  }
}

/**
 * 테이블 데이터로부터 거래내역 분석 (이미 추출된 데이터용)
 */
export async function analyzeExtractedTableData(
  headers: string[],
  rows: string[][],
  emergentLlmKey: string
): Promise<OrchestrationResult> {
  const tableData = {
    headers,
    rows,
    totalRows: rows.length,
  };

  // 2단계부터 시작 (테이블 추출 스킵)
  const pdfPlaceholder = Buffer.from(""); // 사용하지 않음

  // 직접 LLM 분석 호출
  console.log("[Orchestrator] LLM 컬럼 분석 시작 (테이블 데이터)");
  const analysisResult = await analyzeColumnsFromTableData(tableData, emergentLlmKey);

  if (!analysisResult.success) {
    return {
      success: false,
      transactions: [],
      formattedTransactions: [],
      analysisResult,
      statistics: {
        total: rows.length,
        success: 0,
        skipped: rows.length,
        입금건수: 0,
        출금건수: 0,
        총입금액: 0,
        총출금액: 0,
      },
      errors: [{ row: 0, error: analysisResult.error || "컬럼 분석 실패" }],
    };
  }

  // 나머지 변환 로직...
  const transactions: StandardizedTransaction[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  const columnMapping = convertToColumnMapping(analysisResult, headers);

  let 입금건수 = 0;
  let 출금건수 = 0;
  let 총입금액 = 0;
  let 총출금액 = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length === 0) continue;

    try {
      const dateIndex = columnMapping.date;
      if (dateIndex === -1) continue;

      const dateValue = row[dateIndex];
      const transactionDate = parseDate(dateValue);

      if (!transactionDate) continue;

      const typeResult = determineTransactionType(row, analysisResult, headers);
      if (!typeResult) continue;

      const balanceIndex = columnMapping.balance;
      const balance = balanceIndex !== -1 ? parseAmount(row[balanceIndex]) : undefined;

      const memoIndex = columnMapping.memo;
      let memo = memoIndex !== -1 ? String(row[memoIndex] || "").trim() : "";

      // 특이점 처리
      if (!memo && analysisResult.transactionTypeDetection.method === "separate_columns") {
        const depositIndex = columnMapping.deposit;
        const withdrawalIndex = columnMapping.withdrawal;

        if (typeResult.type === "입금" && withdrawalIndex !== -1) {
          const potentialMemo = row[withdrawalIndex];
          if (potentialMemo && !parseAmount(potentialMemo)) {
            memo = String(potentialMemo).trim();
          }
        } else if (typeResult.type === "출금" && depositIndex !== -1) {
          const potentialMemo = row[depositIndex];
          if (potentialMemo && !parseAmount(potentialMemo)) {
            memo = String(potentialMemo).trim();
          }
        }
      }

      transactions.push({
        거래일자: transactionDate,
        구분: typeResult.type,
        금액: typeResult.amount,
        잔액: balance ?? undefined,
        비고: memo,
      });

      if (typeResult.type === "입금") {
        입금건수++;
        총입금액 += typeResult.amount;
      } else {
        출금건수++;
        총출금액 += typeResult.amount;
      }
    } catch (error) {
      errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: true,
    transactions,
    formattedTransactions: transactions.map(formatTransaction),
    analysisResult,
    statistics: {
      total: rows.length,
      success: transactions.length,
      skipped: rows.length - transactions.length,
      입금건수,
      출금건수,
      총입금액,
      총출금액,
    },
    errors,
  };
}

/**
 * 거래 내역을 UI 표시용 포맷으로 변환
 */
function formatTransaction(tx: StandardizedTransaction): FormattedStandardTransaction {
  const dateStr = tx.거래일자.toISOString().split("T")[0] ?? "";
  const sign = tx.구분 === "입금" ? "+" : "-";
  const colorClass = tx.구분 === "입금" ? "text-blue-600" : "text-red-600";

  return {
    거래일자: dateStr,
    구분: tx.구분,
    구분색상: colorClass,
    금액: `${sign}${tx.금액.toLocaleString()}`,
    잔액: tx.잔액?.toLocaleString(),
    비고: tx.비고,
  };
}
