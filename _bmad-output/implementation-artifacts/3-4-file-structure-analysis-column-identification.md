# Story 3.4: 파일 구조 분석 및 열 식별

**Status:** ready-for-dev
**Epic:** Epic 3 - 거래내역서 업로드 및 전처리
**Story Key:** 3-4-file-structure-analysis-column-identification
**Created:** 2026-01-09
**Dependencies:** Story 3.1 완료 (파일 업로드 UI), Story 3.2 완료 (파일 형식 검증), Story 3.3 완료 (S3 파일 저장)

---

## Story

**As a** 시스템,
**I want** 업로드된 파일의 구조를 분석하여 열을 식별해서,
**So that** 거래 데이터를 올바르게 추출할 수 있다.

---

## Acceptance Criteria

### AC1: 헤더 행 식별

**Given** 엑셀 또는 CSV 파일이 업로드되었을 때
**When** 파일 구조 분석을 시작하면
**Then** 시스템은 헤더 행을 식별한다
**And** 한글 및 영문 헤더를 모두 지원하여 열을 매핑한다(예: "날짜"/"Date", "입금액"/"Deposit", "출금액"/"Withdrawal")

### AC2: 필수 열 매핑

**Given** 파일의 열 구조를 분석할 때
**When** 시스템이 다음 열을 식별하면
**Then** 날짜(필수), 입금액, 출금액, 잔액, 메모/적요, 거래처 등의 열이 자동으로 매핑된다
**And** 식별된 열 매핑이 사용자에게 표시된다

### AC3: 필수 열 누락 처리

**Given** 필수 열(날짜)이 식별되지 않았을 때
**When** 구조 분석이 완료되면
**Then** "필수 열(날짜)을 식별할 수 없습니다. 파일을 확인해주세요" 에러 메시지가 표시된다
**And** 사용자는 수동으로 열을 매핑할 수 있는 인터페이스가 제공된다

### AC4: PDF 파일 OCR 처리

**Given** PDF 파일이 업로드되었을 때
**When** 구조 분석을 수행하면
**Then** Upstage Solar API 또는 Google Cloud Vision API를 사용하여 텍스트를 추출한다
**And** 추출된 텍스트에서 표 형식을 감지하여 열 구조를 파악한다

### AC5: 비표준 형식 처리

**Given** 비표준 형식의 파일이 업로드되었을 때
**When** 자동 열 식별이 실패하면
**Then** 사용자에게 열 매핑 인터페이스가 제공된다
**And** 사용자는 각 열의 의미(날짜, 입금액, 출금액 등)를 수동으로 지정할 수 있다

**Requirements:** FR-015, FR-016, NFR-014 (외부 API 통합)

---

## Developer Context & Guardrails

### 🎯 CRITICAL IMPLEMENTATION REQUIREMENTS

**🚨 THIS IS THE MOST IMPORTANT SECTION - READ CAREFULLY!**

### Technical Stack & Versions

- **Framework:** Next.js 14+ (Pages Router) - 프로젝트는 Pages Router 사용
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Prisma ORM 7.2.0+
- **API Layer:** tRPC v11
- **State Management:** TanStack Query v5 (React Query)
- **UI Components:** shadcn/ui (Radix UI)
- **File Storage:** AWS S3 (ap-northeast-2 리전) - 이미 Story 3.3에서 구현 완료
- **File Parsing:**
  - Excel/CSV: xlsx 라이브러리 (Story 3.2에서 이미 사용)
  - PDF OCR: Upstage Solar API (Primary), Google Cloud Vision API (Backup)
- **Document Model:** 이미 Story 3.3에서 정의됨

### Architecture Compliance

**1. Prisma Schema - FileAnalysisResult Model (NEW)**

파일 구조 분석 결과를 저장하기 위한 모델을 추가해야 합니다:

```prisma
// prisma/schema.prisma

model FileAnalysisResult {
  id              String   @id @default(uuid())
  documentId      String   @unique // 분석할 문서 ID (Story 3.3의 Document)
  caseId          String   // 연결된 사건 ID

  // 분석 상태
  status          String   // pending, analyzing, completed, failed

  // 열 매핑 결과 (JSON으로 저장)
  columnMapping   Json     @default("{}") // { date: "날짜", deposit: "입금액", withdrawal: "출금액", ... }
  headerRowIndex  Int      // 헤더 행 인덱스 (0-based)
  totalRows       Int      // 전체 행 수

  // 분석 메타데이터
  detectedFormat  String   // excel, csv, pdf
  hasHeaders      Boolean  @default(true)
  confidence      Float    @default(0.0) // 0.0 ~ 1.0

  // OCR 관련 (PDF인 경우)
  ocrProvider     String?  // upstage, google
  ocrConfidence   Float?   // OCR 신뢰도

  // 분석 완료 시간
  analyzedAt      DateTime?

  // 에러 정보
  errorMessage    String?
  errorDetails    Json?

  // 관계
  document        Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  case            Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([caseId])
  @@index([documentId])
  @@index([status])
  @@map("file_analysis_results")
}
```

**Document 모델에 관계 추가:**

```prisma
// prisma/schema.prisma - Document 모델 수정

model Document {
  // ... 기존 필드 ...

  analysisResults FileAnalysisResult[] // Story 3.4: 구조 분석 결과

  // ... 기존 관계 ...
}
```

**Case 모델에 관계 추가:**

```prisma
// prisma/schema.prisma - Case 모델 수정

model Case {
  // ... 기존 필드 ...

  analysisResults FileAnalysisResult[] // Story 3.4: 구조 분석 결과

  // ... 기존 관계 ...
}
```

**2. 열 매핑 상수 정의**

```typescript
// src/lib/column-mapping.ts (NEW FILE)

/**
 * 한국/영문 열 이름 매핑 상수
 *
 * 은행 거래 내역서에서 사용되는 표준 열 이름을 정의합니다.
 */

// 지원되는 열 타입
export enum ColumnType {
  DATE = "date",
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  BALANCE = "balance",
  MEMO = "memo",
  COUNTERPARTY = "counterparty",
  ACCOUNT_NUMBER = "account_number",
  UNKNOWN = "unknown",
}

// 한글/영문 열 이름 매핑
export const COLUMN_MAPPING: Record<
  ColumnType,
  { korean: string[]; english: string[]; priority: number }
> = {
  [ColumnType.DATE]: {
    korean: ["날짜", "거래일자", "일자", "交易日期"],
    english: ["Date", "Transaction Date", "Trx Date", "Trade Date"],
    priority: 1, // 필수
  },
  [ColumnType.DEPOSIT]: {
    korean: ["입금액", "입금", "입금", "받은금액", "수입"],
    english: ["Deposit", "In", "Credit", "Income", "Received"],
    priority: 2,
  },
  [ColumnType.WITHDRAWAL]: {
    korean: ["출금액", "출금", "지급", "지출", "보낸금액"],
    english: ["Withdrawal", "Out", "Debit", "Expense", "Payment"],
    priority: 3,
  },
  [ColumnType.BALANCE]: {
    korean: ["잔액", "잔고", "계좌잔액", "현재잔액"],
    english: ["Balance", "Current Balance", "Bal", "Account Balance"],
    priority: 4,
  },
  [ColumnType.MEMO]: {
    korean: ["적요", "메모", "내용", "거래내용", "상세"],
    english: ["Memo", "Description", "Details", "Particulars", "Remark"],
    priority: 5,
  },
  [ColumnType.COUNTERPARTY]: {
    korean: ["거래처", "상대방", "받는분", "주는분"],
    english: ["Counterparty", "Payee", "Payer", "Beneficiary", "To/From"],
    priority: 6,
  },
  [ColumnType.ACCOUNT_NUMBER]: {
    korean: ["계좌번호", "계좌", "번호"],
    english: ["Account Number", "Account No", "Acct No", "Account #"],
    priority: 7,
  },
  [ColumnType.UNKNOWN]: {
    korean: [],
    english: [],
    priority: 99,
  },
};

/**
 * 열 이름으로부터 ColumnType을 추론합니다.
 *
 * @param columnName - 열 이름 (한글 또는 영문)
 * @returns 추론된 ColumnType
 */
export function inferColumnType(columnName: string): ColumnType {
  const normalized = columnName.trim().toLowerCase();

  for (const [type, mapping] of Object.entries(COLUMN_MAPPING)) {
    const koreanMatches = mapping.korean.some((name) =>
      normalized.includes(name.toLowerCase())
    );
    const englishMatches = mapping.english.some((name) =>
      normalized.includes(name.toLowerCase())
    );

    if (koreanMatches || englishMatches) {
      return type as ColumnType;
    }
  }

  return ColumnType.UNKNOWN;
}

/**
 * 필수 열이 누락되었는지 확인합니다.
 *
 * @param detectedColumns - 감지된 열 타입 배열
 * @returns 누락된 필수 열 배열
 */
export function getMissingRequiredColumns(
  detectedColumns: ColumnType[]
): ColumnType[] {
  const required = [ColumnType.DATE];
  return required.filter((col) => !detectedColumns.includes(col));
}
```

**3. S3 파일 다운로드 (Story 3.3 S3 업로드와 연동)**

```typescript
// src/lib/s3.ts (MODIFY - Story 3.3 파일에 추가)

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * S3에서 파일을 다운로드합니다.
 *
 * @param s3Key - S3 객체 키 (Story 3.3에서 저장한 키)
 * @returns 파일 버퍼
 * @throws Error if download fails
 */
export async function downloadFileFromS3(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  try {
    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("S3 객체가 비어있습니다");
    }

    // Stream을 Buffer로 변환
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = response.Body as any;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("[S3 Download Error]", error);
    throw new Error("S3 파일 다운로드 실패");
  }
}
```

**4. 파일 구조 분석 서비스**

```typescript
// src/lib/file-analyzer.ts (NEW FILE)

import * as XLSX from "xlsx";
import {
  inferColumnType,
  ColumnType,
  COLUMN_MAPPING,
  getMissingRequiredColumns,
} from "./column-mapping";

/**
 * 파일 구조 분석 결과 인터페이스
 */
export interface ColumnMappingResult {
  columnName: string; // 원본 열 이름
  columnType: ColumnType; // 추론된 열 타입
  confidence: number; // 신뢰도 (0.0 ~ 1.0)
}

export interface StructureAnalysisResult {
  columnMapping: ColumnMappingResult[];
  headerRowIndex: number;
  totalRows: number;
  detectedFormat: "excel" | "csv" | "pdf";
  hasHeaders: boolean;
  confidence: number;
  missingRequiredColumns: ColumnType[];
  errorMessage?: string;
}

/**
 * 엑셀/CSV 파일 구조를 분석합니다.
 *
 * @param buffer - 파일 버퍼
 * @param mimeType - MIME 타입
 * @returns 구조 분석 결과
 */
export async function analyzeExcelOrCSVStructure(
  buffer: Buffer,
  mimeType: string
): Promise<StructureAnalysisResult> {
  try {
    // 엑셀 워크북 로드
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (!workbook.SheetNames.length) {
      throw new Error("엑셀 파일에 시트가 없습니다");
    }

    const firstSheetName = workbook.SheetNames[0]!;
    const worksheet = workbook.Sheets[firstSheetName];

    // 데이터 파싱 (header: 1 옵션으로 배열 형태로 변환)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Array<
      unknown[]
    >;

    if (data.length === 0) {
      throw new Error("엑셀 파일에 데이터가 없습니다");
    }

    // 헤더 행 감지 (첫 번째 비어있지 않은 행을 헤더로 가정)
    let headerRowIndex = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;
      if (row.length > 0 && row.some((cell) => cell !== null && cell !== undefined)) {
        headerRowIndex = i;
        break;
      }
    }

    const headerRow = data[headerRowIndex]!;
    const totalRows = data.length - headerRowIndex - 1; // 헤더 행 제외

    // 열 매핑 분석
    const columnMapping: ColumnMappingResult[] = [];
    let totalConfidence = 0;

    for (const columnName of headerRow) {
      if (columnName === null || columnName === undefined) continue;

      const columnType = inferColumnType(String(columnName));
      let confidence = 0.5; // 기본 신뢰도

      // 열 이름이 정확히 일치하면 신뢰도 높임
      if (columnType !== ColumnType.UNKNOWN) {
        const mapping = COLUMN_MAPPING[columnType];
        const exactKoreanMatch = mapping.korean.some(
          (name) => String(columnName).toLowerCase() === name.toLowerCase()
        );
        const exactEnglishMatch = mapping.english.some(
          (name) => String(columnName).toLowerCase() === name.toLowerCase()
        );

        if (exactKoreanMatch || exactEnglishMatch) {
          confidence = 0.95;
        } else {
          confidence = 0.7; // 부분 일치
        }
      }

      columnMapping.push({
        columnName: String(columnName),
        columnType,
        confidence,
      });

      totalConfidence += confidence;
    }

    const detectedTypes = columnMapping.map((col) => col.columnType);
    const missingRequiredColumns = getMissingRequiredColumns(detectedTypes);

    const overallConfidence = columnMapping.length > 0
      ? totalConfidence / columnMapping.length
      : 0.0;

    return {
      columnMapping,
      headerRowIndex,
      totalRows,
      detectedFormat: mimeType.includes("csv") ? "csv" : "excel",
      hasHeaders: true,
      confidence: overallConfidence,
      missingRequiredColumns,
      errorMessage: missingRequiredColumns.length > 0
        ? `필수 열(날짜)을 식별할 수 없습니다. 파일을 확인해주세요`
        : undefined,
    };
  } catch (error) {
    console.error("[File Analysis Error]", error);
    throw new Error("파일 구조 분석 실패");
  }
}
```

**5. tRPC 라우터 - analyzeFile 프로시저**

```typescript
// src/server/api/routers/file.ts (MODIFY - Story 3.3 파일에 추가)

import { downloadFileFromS3 } from "~/lib/s3";
import { analyzeExcelOrCSVStructure } from "~/lib/file-analyzer";

/**
 * Analyze file structure and identify columns
 *
 * POST /api/trpc/file.analyzeFile
 *
 * Performs file structure analysis:
 * 1. Downloads file from S3 (uploaded in Story 3.3)
 * 2. Parses file structure (Excel/CSV/PDF)
 * 3. Identifies column mappings (Korean/English)
 * 4. Stores analysis result in database
 * 5. Returns column mapping to user
 *
 * @param documentId - Document ID from Story 3.3
 * @returns Object containing analysis result
 */
analyzeFile: protectedProcedure
  .input(
    z.object({
      documentId: z.string().min(1, "문서 ID는 필수 항목입니다"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { documentId } = input;
    const userId = ctx.userId;

    // Step 1: Get Document metadata
    const document = await ctx.db.document.findUnique({
      where: { id: documentId },
      include: { case: true },
    });

    if (!document) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "문서를 찾을 수 없습니다",
      });
    }

    // RBAC: Check if user can access this case
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (document.case.lawyerId !== userId && user?.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "이 문서에 접근할 권한이 없습니다",
      });
    }

    // Step 2: Check if analysis already exists
    const existingAnalysis = await ctx.db.fileAnalysisResult.findUnique({
      where: { documentId },
    });

    if (existingAnalysis && existingAnalysis.status === "completed") {
      return {
        success: true,
        analysisResult: existingAnalysis,
        message: "파일 구조 분석 완료",
      };
    }

    // Step 3: Download file from S3
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFileFromS3(document.s3Key);
    } catch (error) {
      console.error("[S3 Download Error]", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "파일 다운로드 중 오류가 발생했습니다",
      });
    }

    // Step 4: Analyze file structure
    let analysisResult;
    try {
      if (document.mimeType.includes("sheet") ||
          document.mimeType.includes("excel") ||
          document.mimeType.includes("csv")) {
        analysisResult = await analyzeExcelOrCSVStructure(
          fileBuffer,
          document.mimeType
        );
      } else if (document.mimeType === "application/pdf") {
        // PDF 분석은 Story 3.4에서 OCR 연동 후 구현
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "PDF 파일 분석은 다음 단계에서 지원됩니다",
        });
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "지원하지 않는 파일 형식입니다",
        });
      }
    } catch (error) {
      console.error("[File Analysis Error]", error);

      // Create failed analysis record
      await ctx.db.fileAnalysisResult.create({
        data: {
          documentId,
          caseId: document.caseId,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "분석 실패",
          detectedFormat: document.mimeType.includes("csv") ? "csv" : "excel",
        },
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "파일 구조 분석 실패",
      });
    }

    // Step 5: Store analysis result in database
    const dbAnalysisResult = await ctx.db.fileAnalysisResult.upsert({
      where: { documentId },
      create: {
        documentId,
        caseId: document.caseId,
        status: analysisResult.missingRequiredColumns.length > 0 ? "failed" : "completed",
        columnMapping: analysisResult.columnMapping,
        headerRowIndex: analysisResult.headerRowIndex,
        totalRows: analysisResult.totalRows,
        detectedFormat: analysisResult.detectedFormat,
        hasHeaders: analysisResult.hasHeaders,
        confidence: analysisResult.confidence,
        errorMessage: analysisResult.errorMessage,
        analyzedAt: new Date(),
      },
      update: {
        status: analysisResult.missingRequiredColumns.length > 0 ? "failed" : "completed",
        columnMapping: analysisResult.columnMapping,
        headerRowIndex: analysisResult.headerRowIndex,
        totalRows: analysisResult.totalRows,
        detectedFormat: analysisResult.detectedFormat,
        hasHeaders: analysisResult.hasHeaders,
        confidence: analysisResult.confidence,
        errorMessage: analysisResult.errorMessage,
        analyzedAt: new Date(),
      },
    });

    return {
      success: true,
      analysisResult: dbAnalysisResult,
      message: "파일 구조 분석 완료",
    };
  }),
```

**6. 프론트엔드 - 파일 분석 컴포넌트 (선택적 구현)**

```typescript
// src/components/file-structure-analysis.tsx (NEW FILE - 선택적)

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/utils/api";
import { ColumnType } from "~/lib/column-mapping";

interface FileStructureAnalysisProps {
  documentId: string;
  onAnalysisComplete?: (result: any) => void;
}

export function FileStructureAnalysis({
  documentId,
  onAnalysisComplete,
}: FileStructureAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyzeFileMutation = api.file.analyzeFile.useMutation();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    try {
      const response = await analyzeFileMutation.mutateAsync({ documentId });

      if (response.success) {
        setResult(response.analysisResult);
        toast.success("파일 구조 분석 완료");

        if (onAnalysisComplete) {
          onAnalysisComplete(response.analysisResult);
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "파일 분석 실패";
      toast.error(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getColumnTypeLabel = (type: ColumnType) => {
    const labels: Record<ColumnType, string> = {
      [ColumnType.DATE]: "날짜",
      [ColumnType.DEPOSIT]: "입금액",
      [ColumnType.WITHDRAWAL]: "출금액",
      [ColumnType.BALANCE]: "잔액",
      [ColumnType.MEMO]: "메모",
      [ColumnType.COUNTERPARTY]: "거래처",
      [ColumnType.ACCOUNT_NUMBER]: "계좌번호",
      [ColumnType.UNKNOWN]: "알 수 없음",
    };
    return labels[type] || type;
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">파일 구조 분석</h3>
        {!result && (
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                분석 중...
              </>
            ) : (
              "분석 시작"
            )}
          </Button>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {result.status === "completed" ? (
            <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">분석 완료</p>
                <p className="text-sm text-green-700">
                  총 {result.totalRows}행의 데이터가 감지되었습니다
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">분석 실패</p>
                <p className="text-sm text-red-700">{result.errorMessage}</p>
              </div>
            </div>
          )}

          {result.columnMapping && Array.isArray(result.columnMapping) && (
            <div>
              <h4 className="font-medium mb-2">감지된 열:</h4>
              <div className="space-y-2">
                {result.columnMapping.map((col: any, index: number) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                  >
                    <span className="font-medium">{col.columnName}</span>
                    <Badge
                      variant={
                        col.columnType === ColumnType.UNKNOWN
                          ? "destructive"
                          : "default"
                      }
                    >
                      {getColumnTypeLabel(col.columnType)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

### Project Structure Notes

**File Locations:**
- **NEW:** `src/lib/column-mapping.ts` - Column type inference constants and functions
- **NEW:** `src/lib/file-analyzer.ts` - File structure analysis service
- **NEW:** `src/components/file-structure-analysis.tsx` - Optional UI component for displaying analysis results
- **MODIFY:** `prisma/schema.prisma` - Add FileAnalysisResult model
- **MODIFY:** `src/lib/s3.ts` - Add downloadFileFromS3 function
- **MODIFY:** `src/server/api/routers/file.ts` - Add analyzeFile procedure

**Import Aliases:**
- `~/lib/s3` - S3 utilities (upload/download)
- `~/lib/column-mapping` - Column mapping constants
- `~/lib/file-analyzer` - File structure analysis functions
- `~/utils/api` - tRPC utilities

**Naming Conventions:**
- Functions: camelCase with descriptive verbs (`inferColumnType`, `analyzeExcelOrCSVStructure`)
- Types: PascalCase (`ColumnMappingResult`, `StructureAnalysisResult`)
- Database tables: snake_case (`file_analysis_results`)
- Prisma models: PascalCase (`FileAnalysisResult`)

### References

- **Epic 3 Stories:** `_bmad-output/planning-artifacts/epics.md` (lines 649-681)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
  - File parsing: OCR integration (Upstage Solar, Google Document AI)
  - API design: Domain-based router structure
  - Error handling: TRPCError with Korean messages
- **Previous Story:** `_bmad-output/implementation-artifacts/3-3-s3-file-storage-metadata.md`
  - Document model definition
  - S3 upload/download patterns
  - RBAC implementation pattern
  - Error handling with rollback

## Tasks / Subtasks

- [ ] **Task 1: Add FileAnalysisResult model to Prisma schema** (AC: 2, 3)
  - [ ] 1.1: Add FileAnalysisResult model to `prisma/schema.prisma`
  - [ ] 1.2: Define fields (id, documentId, caseId, status, columnMapping, etc.)
  - [ ] 1.3: Add relation to Document model
  - [ ] 1.4: Add relation to Case model
  - [ ] 1.5: Add indexes (caseId, documentId, status)
  - [ ] 1.6: Run `npx prisma generate`
  - [ ] 1.7: Run `npx prisma migrate dev --name add_file_analysis_result`

- [ ] **Task 2: Create column mapping constants and utilities** (AC: 1, 2)
  - [ ] 2.1: Create `src/lib/column-mapping.ts`
  - [ ] 2.2: Define ColumnType enum
  - [ ] 2.3: Define COLUMN_MAPPING constant with Korean/English names
  - [ ] 2.4: Implement `inferColumnType()` function
  - [ ] 2.5: Implement `getMissingRequiredColumns()` function

- [ ] **Task 3: Add S3 download function** (AC: 1, 4)
  - [ ] 3.1: Modify `src/lib/s3.ts` to add `downloadFileFromS3()` function
  - [ ] 3.2: Implement GetObjectCommand usage
  - [ ] 3.3: Handle stream to Buffer conversion
  - [ ] 3.4: Add error handling

- [ ] **Task 4: Implement file structure analyzer** (AC: 1, 2, 3)
  - [ ] 4.1: Create `src/lib/file-analyzer.ts`
  - [ ] 4.2: Define `ColumnMappingResult` interface
  - [ ] 4.3: Define `StructureAnalysisResult` interface
  - [ ] 4.4: Implement `analyzeExcelOrCSVStructure()` function
  - [ ] 4.5: Implement header row detection logic
  - [ ] 4.6: Implement column mapping inference
  - [ ] 4.7: Calculate confidence score
  - [ ] 4.8: Detect missing required columns

- [ ] **Task 5: Implement analyzeFile tRPC procedure** (AC: 1, 2, 3, 5)
  - [ ] 5.1: Add `analyzeFile` procedure to `src/server/api/routers/file.ts`
  - [ ] 5.2: Implement Document lookup with RBAC check
  - [ ] 5.3: Download file from S3 using downloadFileFromS3()
  - [ ] 5.4: Call file structure analyzer
  - [ ] 5.5: Create/update FileAnalysisResult record
  - [ ] 5.6: Return analysis result to client
  - [ ] 5.7: Add comprehensive error handling

- [ ] **Task 6: Create frontend analysis component** (Optional - AC: 2, 3, 5)
  - [ ] 6.1: Create `src/components/file-structure-analysis.tsx`
  - [ ] 6.2: Use `analyzeFile` mutation from tRPC
  - [ ] 6.3: Display analysis status (completed/failed)
  - [ ] 6.4: Display detected columns with badges
  - [ ] 6.5: Show error messages for missing columns
  - [ ] 6.6: Add loading state

- [ ] **Task 7: Error handling and validation** (AC: 3, 5)
  - [ ] 7.1: Korean error messages for each failure scenario
  - [ ] 7.2: Handle missing required columns with clear message
  - [ ] 7.3: Handle PDF files with "not implemented" message (OCR in future)
  - [ ] 7.4: Toast notifications for success/error
  - [ ] 7.5: Log all errors to console

- [ ] **Task 8: Validation and testing** (선택사항)
  - [ ] 8.1: Run TypeScript check: `npm run typecheck`
  - [ ] 8.2: Run ESLint: `npm run lint`
  - [ ] 8.3: Manual testing with Excel files
  - [ ] 8.4: Manual testing with CSV files
  - [ ] 8.5: Verify FileAnalysisResult records in database

## Dev Notes

### Implementation Priorities

**MVP 범위 (Story 3.4):**
1. **엑셀/CSV 파일 구조 분석만 구현** (PDF OCR은 Story 3.6으로 연기)
2. **자동 열 식별** - 한글/영문 헤더 지원
3. **필수 열(날짜) 검증** - 누락 시 명확한 에러 메시지
4. **분석 결과 DB 저장** - FileAnalysisResult 모델 활용
5. **tRPC API 제공** - 프론트엔드에서 호출 가능

**다음 스토리(3.6)에서 구현:**
- PDF OCR 처리 (Upstage Solar API 또는 Google Cloud Vision API)
- 수동 열 매핑 인터페이스 (비표준 형식 지원)

### Technical Considerations

1. **파일 다운로드 비용:** Story 3.3에서 업로드된 파일을 S3에서 다시 다운로드하므로, 네트워크 비용 발생
   - 해결책: 향후 파일 업로드 시 즉시 분석을 수행하여 S3 저장 후 분석 결과만 DB에 저장

2. **대용량 파일 처리:** 50MB 엑셀 파일의 메모리 처리에 주의
   - xlsx 라이브러리는 전체 파일을 메모리에 로드하므로 메모리 부족 가능
   - 해결책: 향후 streaming 방식으로 개선 고려

3. **열 이름 매칭의 한계:** 다양한 은행별 표준을 모두 지원하기 어려움
   - 현재: 주요 열 이름만 하드코딩
   - 향후: 기계학습 기반의 열 분류 고려

4. **신뢰도 계산:** 현재는 단순히 정확히 일치하는지 여부로 신뢰도 계산
   - 향후 더 정교한 알고리즘으로 개선 가능

### Testing Standards Summary

**Unit Tests:**
- `inferColumnType()` 함수
  - Korean column names detection
  - English column names detection
  - Case-insensitive matching
  - Unknown column handling
- `getMissingRequiredColumns()` function
  - Detects missing date column
  - Returns array of missing types
- `analyzeExcelOrCSVStructure()` function
  - Successful analysis returns correct structure
  - Handles empty files
  - Handles files without headers
  - Correctly calculates confidence score

**Integration Tests:**
- File analysis flow:
  1. Get Document from DB
  2. Download file from S3
  3. Analyze file structure
  4. Store result in FileAnalysisResult table
  5. Return result to client
- RBAC: Only case owner can analyze files
- Error handling: Missing required columns, invalid file format

**Manual Testing Checklist:**
- [ ] 정상 엑셀 파일 분석 성공
- [ ] 정상 CSV 파일 분석 성공
- [ ] 한글 헤더 인식 (날짜, 입금액, 출금액, 잔액, 메모, 거래처)
- [ ] 영문 헤더 인식 (Date, Deposit, Withdrawal, Balance, Memo, Counterparty)
- [ ] 필수 열(날짜) 누락 시 에러 메시지 표시
- [ ] 분석 결과가 FileAnalysisResult 테이블에 저장됨
- [ ] 분석 결과 UI에 정상 표시됨
- [ ] 권한 없는 사용자 분석 시도 차단 (RBAC)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Completion Notes List

- Story 3.4 created with comprehensive implementation guide
- Previous story (3.3) patterns reused (S3, RBAC, error handling)
- Architecture analysis integrated (OCR, column mapping, error handling)
- Korean language support throughout (messages, UI, column names)
- PDF OCR deferred to Story 3.6 (focus on Excel/CSV for MVP)
- FileAnalysisResult model designed with proper indexing
- Column mapping utilities with Korean/English bilingual support
- S3 download function added to complement Story 3.3 upload

### File List

- `prisma/schema.prisma` (MODIFY - Add FileAnalysisResult model)
- `src/lib/column-mapping.ts` (NEW - Column mapping constants and utilities)
- `src/lib/file-analyzer.ts` (NEW - File structure analysis service)
- `src/lib/s3.ts` (MODIFY - Add downloadFileFromS3 function)
- `src/server/api/routers/file.ts` (MODIFY - Add analyzeFile procedure)
- `src/components/file-structure-analysis.tsx` (NEW - Optional UI component)
