/**
 * Column Analyzer Agent - LLM 기반 거래내역서 컬럼 분석기
 *
 * 거래내역서의 테이블 구조를 LLM(Gemini)이 분석하여 컬럼 매핑을 자동으로 결정합니다.
 * 새로운 형식의 내역서도 자동 대응 가능합니다.
 *
 * 표준 출력 형식: 거래일자, 구분(입금/출금), 금액, 잔액, 비고
 *
 * 특징:
 * - PDF 파일을 직접 첨부하여 분석 (Gemini FileContentWithMimeType)
 * - 테이블 구조 자동 인식
 * - 비고 컬럼 지능적 추론 (입금자명, 계좌정보, 거래 설명 등)
 * - 거래 테이블과 무관한 테이블 자동 회피
 */

import { LlmChat, UserMessage, FileContentWithMimeType } from "emergentintegrations/llm/chat";
import { z } from "zod";

/**
 * LLM이 분석한 컬럼 매핑 결과 스키마
 */
export const ColumnAnalysisResultSchema = z.object({
  // 분석 성공 여부
  success: z.boolean(),

  // 감지된 테이블 유형 (은행 거래내역)
  tableType: z.string().optional(),

  // 컬럼 매핑 (표준 컬럼명 -> 원본 헤더명)
  columnMapping: z.object({
    거래일자: z.string().describe("날짜 컬럼 헤더명"),
    구분: z.string().optional().describe("입출금 구분 컬럼 (없을 수 있음)"),
    입금금액: z.string().optional().describe("입금 금액 컬럼"),
    출금금액: z.string().optional().describe("출금 금액 컬럼"),
    금액: z.string().optional().describe("통합 금액 컬럼 (입출금 구분이 별도일 때)"),
    잔액: z.string().optional().describe("잔액 컬럼"),
    비고: z.string().describe("비고/메모 컬럼 (입금자명, 계좌정보 등)"),
  }),

  // 헤더 행 인덱스 (0-based)
  headerRowIndex: z.number(),

  // 데이터 행 시작 인덱스
  dataStartRowIndex: z.number(),

  // 입출금 구분 방법
  transactionTypeDetection: z.object({
    method: z.enum([
      "separate_columns", // 입금/출금 별도 컬럼
      "type_column",      // 구분 컬럼에 입금/출금 텍스트
      "sign_in_type",     // 거래구분에 [+]/[-] 기호
      "amount_sign",      // 금액에 +/- 부호
    ]),
    details: z.string().optional(),
  }),

  // 비고 컬럼 분석 결과
  memoAnalysis: z.object({
    columnName: z.string(),
    contentType: z.string().describe("내용 유형: 입금자명, 계좌정보, 거래설명 등"),
    confidence: z.number().min(0).max(1),
  }),

  // 분석 신뢰도
  confidence: z.number().min(0).max(1),

  // 분석 근거
  reasoning: z.string(),

  // 에러 메시지 (실패 시)
  error: z.string().optional(),
});

export type ColumnAnalysisResult = z.infer<typeof ColumnAnalysisResultSchema>;

/**
 * 테이블 데이터 인터페이스 (PDF에서 추출된 데이터)
 */
export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

/**
 * LLM 기반 컬럼 분석 프롬프트
 */
const COLUMN_ANALYSIS_PROMPT = `당신은 한국 은행 거래내역서 분석 전문가입니다.
업로드된 PDF 파일 또는 제공된 테이블 데이터를 분석하여 거래내역 테이블의 컬럼 구조를 파악하세요.

## 목표
거래내역 테이블을 다음 표준 형식으로 매핑:
- 거래일자: 거래 발생 날짜
- 구분: 입금 또는 출금
- 금액: 거래 금액 (입금이면 +, 출금이면 -)
- 잔액: 거래 후 잔액
- 비고: 입금자/출금처, 계좌정보, 거래 설명 등 기록성 데이터

## 분석 시 주의사항

1. **거래내역 테이블 식별**
   - 문서에 여러 테이블이 있을 수 있음
   - "거래일자", "날짜", "일시" 등 날짜 컬럼이 있는 테이블이 거래내역
   - 계좌정보, 요약표, 집계표 등은 제외

2. **입출금 구분 방식 (3가지 유형)**
   - Type A: 입금/출금 별도 컬럼 (예: "입금금액", "출금금액" 또는 "맡기신금액", "찾으신금액")
   - Type B: 거래구분 컬럼에 텍스트 (예: "[+] 입금", "[-] 송금")
   - Type C: 금액 컬럼은 하나, 부호로 구분

3. **비고 컬럼 식별 (가장 중요)**
   - 적요, 비고, 내용, 계좌정보/결제정보 등 다양한 이름 가능
   - 내용을 보고 판단: 사람 이름, 계좌번호, 거래처명, 상품명 등이 포함된 컬럼
   - **특이점**: 일부 내역서에서는 입금/출금 금액 컬럼 중 빈 쪽에 비고가 들어감
     예) 지급금액에 숫자, 입금금액에 "홍길동" (비고)

4. **헤더 행 찾기**
   - 첫 번째 행이 아닐 수 있음
   - 계좌정보 등 메타데이터 행 이후에 헤더가 있음

## 응답 형식 (JSON)
{
  "success": true,
  "tableType": "은행 거래내역서",
  "columnMapping": {
    "거래일자": "실제 컬럼명",
    "구분": "실제 컬럼명 (없으면 null)",
    "입금금액": "실제 컬럼명 (Type A일 때)",
    "출금금액": "실제 컬럼명 (Type A일 때)",
    "금액": "실제 컬럼명 (Type B/C일 때)",
    "잔액": "실제 컬럼명",
    "비고": "실제 컬럼명"
  },
  "headerRowIndex": 0,
  "dataStartRowIndex": 1,
  "transactionTypeDetection": {
    "method": "separate_columns | type_column | sign_in_type | amount_sign",
    "details": "설명"
  },
  "memoAnalysis": {
    "columnName": "비고",
    "contentType": "입금자명/거래처/계좌정보/거래설명",
    "confidence": 0.95
  },
  "confidence": 0.9,
  "reasoning": "분석 근거 설명"
}`;

/**
 * PDF 파일로부터 컬럼 구조 분석
 *
 * @param pdfBuffer - PDF 파일 버퍼
 * @param apiKey - Emergent LLM API Key
 * @returns 컬럼 분석 결과
 */
export async function analyzeColumnsFromPdf(
  pdfBuffer: Buffer,
  apiKey: string
): Promise<ColumnAnalysisResult> {
  try {
    // 임시 파일로 저장 (Gemini FileContentWithMimeType 사용)
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `transaction_${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);

    try {
      // Gemini 모델로 PDF 분석
      const chat = new LlmChat(
        apiKey,
        `column-analysis-${Date.now()}`,
        COLUMN_ANALYSIS_PROMPT
      ).withModel("gemini", "gemini-2.5-flash");

      const pdfFile = new FileContentWithMimeType(
        tempFilePath,
        "application/pdf"
      );

      const response = await chat.sendMessage(
        new UserMessage(
          "첨부된 PDF 파일의 거래내역 테이블을 분석하고 컬럼 매핑을 JSON 형식으로 반환해주세요.",
          [pdfFile]
        )
      );

      // JSON 파싱
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return ColumnAnalysisResultSchema.parse(parsed);
    } finally {
      // 임시 파일 삭제
      fs.unlinkSync(tempFilePath);
    }
  } catch (error) {
    console.error("[Column Analyzer] PDF 분석 실패:", error);
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
}

/**
 * 추출된 테이블 데이터로부터 컬럼 구조 분석
 *
 * @param tableData - 추출된 테이블 데이터 (헤더 + 샘플 행)
 * @param apiKey - Emergent LLM API Key
 * @returns 컬럼 분석 결과
 */
export async function analyzeColumnsFromTableData(
  tableData: ExtractedTableData,
  apiKey: string
): Promise<ColumnAnalysisResult> {
  try {
    // 샘플 데이터 준비 (최대 10행)
    const sampleRows = tableData.rows.slice(0, 10);
    const tablePreview = [
      `헤더: ${tableData.headers.join(" | ")}`,
      "",
      "샘플 데이터:",
      ...sampleRows.map((row, i) => `Row ${i + 1}: ${row.join(" | ")}`),
    ].join("\n");

    const chat = new LlmChat(
      apiKey,
      `column-analysis-${Date.now()}`,
      COLUMN_ANALYSIS_PROMPT
    ).withModel("gemini", "gemini-2.5-flash");

    const response = await chat.sendMessage(
      new UserMessage(
        `다음 테이블 데이터를 분석하고 컬럼 매핑을 JSON 형식으로 반환해주세요:\n\n${tablePreview}`
      )
    );

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return ColumnAnalysisResultSchema.parse(parsed);
  } catch (error) {
    console.error("[Column Analyzer] 테이블 데이터 분석 실패:", error);
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
}

/**
 * 컬럼 분석 결과를 기존 ColumnMapping 형식으로 변환
 */
export function convertToColumnMapping(
  result: ColumnAnalysisResult,
  headers: string[]
): Record<string, number> {
  const mapping: Record<string, number> = {};

  const findColumnIndex = (columnName: string | undefined): number => {
    if (!columnName) return -1;
    const index = headers.findIndex(
      (h) => h.trim().toLowerCase() === columnName.trim().toLowerCase()
    );
    return index;
  };

  // 거래일자 (필수)
  mapping.date = findColumnIndex(result.columnMapping.거래일자);

  // 입금/출금 금액
  if (result.transactionTypeDetection.method === "separate_columns") {
    mapping.deposit = findColumnIndex(result.columnMapping.입금금액);
    mapping.withdrawal = findColumnIndex(result.columnMapping.출금금액);
  } else {
    // 통합 금액 컬럼
    const amountIndex = findColumnIndex(result.columnMapping.금액);
    if (amountIndex !== -1) {
      mapping.deposit = amountIndex;
      mapping.withdrawal = amountIndex;
    }
  }

  // 잔액
  mapping.balance = findColumnIndex(result.columnMapping.잔액);

  // 비고
  mapping.memo = findColumnIndex(result.columnMapping.비고);

  return mapping;
}

/**
 * 거래 유형 판별 함수 (LLM 분석 결과 기반)
 */
export function determineTransactionType(
  row: unknown[],
  result: ColumnAnalysisResult,
  headers: string[]
): { type: "입금" | "출금"; amount: number } | null {
  const mapping = convertToColumnMapping(result, headers);

  switch (result.transactionTypeDetection.method) {
    case "separate_columns": {
      // 입금/출금 별도 컬럼
      const depositValue = mapping.deposit !== -1 ? row[mapping.deposit] : null;
      const withdrawalValue = mapping.withdrawal !== -1 ? row[mapping.withdrawal] : null;

      const deposit = parseAmountValue(depositValue);
      const withdrawal = parseAmountValue(withdrawalValue);

      if (deposit && deposit > 0) return { type: "입금", amount: deposit };
      if (withdrawal && withdrawal > 0) return { type: "출금", amount: withdrawal };
      return null;
    }

    case "sign_in_type": {
      // 거래구분에 [+]/[-] 기호
      const typeColumnIndex = headers.findIndex(
        (h) => h.includes("거래구분") || h.includes("구분")
      );
      if (typeColumnIndex === -1) return null;

      const typeValue = String(row[typeColumnIndex] || "");
      const amountValue = mapping.deposit !== -1 ? row[mapping.deposit] : null;
      const amount = parseAmountValue(amountValue);

      if (!amount) return null;

      if (typeValue.includes("[+]") || typeValue.includes("입금") || typeValue.includes("충전")) {
        return { type: "입금", amount };
      }
      if (typeValue.includes("[-]") || typeValue.includes("출금") || typeValue.includes("송금") || typeValue.includes("결제")) {
        return { type: "출금", amount };
      }
      return null;
    }

    case "type_column": {
      // 구분 컬럼에 입금/출금 텍스트
      const typeColumnIndex = headers.findIndex(
        (h) => h.includes("구분") || h.includes("거래종류")
      );
      if (typeColumnIndex === -1) return null;

      const typeValue = String(row[typeColumnIndex] || "").toLowerCase();
      const amountValue = mapping.deposit !== -1 ? row[mapping.deposit] : null;
      const amount = parseAmountValue(amountValue);

      if (!amount) return null;

      if (typeValue.includes("입금")) return { type: "입금", amount };
      if (typeValue.includes("출금") || typeValue.includes("지급")) return { type: "출금", amount };
      return null;
    }

    case "amount_sign": {
      // 금액에 +/- 부호
      const amountValue = mapping.deposit !== -1 ? row[mapping.deposit] : null;
      const amountStr = String(amountValue || "");

      if (amountStr.startsWith("+")) {
        return { type: "입금", amount: parseAmountValue(amountStr.slice(1)) || 0 };
      }
      if (amountStr.startsWith("-")) {
        return { type: "출금", amount: parseAmountValue(amountStr.slice(1)) || 0 };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * 금액 파싱 헬퍼
 */
function parseAmountValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return value > 0 ? value : null;

  if (typeof value === "string") {
    // 숫자가 아닌 문자열 (비고일 가능성)
    const cleaned = value.replace(/[,₩원\s]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }

  return null;
}
