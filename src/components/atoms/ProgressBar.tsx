/**
 * ProgressBar Atom Component
 *
 * Story 3.5: 실시간 진행률 표시 (SSE)
 *
 * Visual progress indicator for file upload operations.
 * Displays current progress percentage, stage message, and error states.
 *
 * Features:
 * - Progress bar (0-100%)
 * - Stage message in Korean
 * - Error state display with red border
 * - Completion summary display
 * - LLM 분석 결과 표시 (신뢰도, 컬럼 매핑, 비고 미인식 사유)
 * - Enhanced visual design with animations
 *
 * @example
 * <ProgressBar progress={50} stage="구조 분석 중..." />
 * <ProgressBar progress={0} stage="실패" error="파일이 손상되었습니다" />
 */

import { Progress } from "~/components/ui/progress";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";

/**
 * LLM 분석 결과 인터페이스
 */
interface LLMAnalysisResult {
  transactionTypeMethod: string;
  memoInAmountColumn?: boolean;
  reasoning: string;
  confidence: number;
  columnMapping: Record<string, string | undefined>;
}

/**
 * Props for ProgressBar component
 */
export interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Current stage message in Korean */
  stage: string;
  /** Error message if an error occurred */
  error?: string | null;
  /** Completion data to display when progress = 100 */
  completionData?: {
    fileName: string;
    totalTransactions?: number;
    columns?: string[];
    llmAnalysis?: LLMAnalysisResult;
  };
  /** Callback when retry button is clicked (AC4) */
  onRetry?: () => void;
}

// 컬럼 타입 한글 매핑
const columnTypeLabels: Record<string, string> = {
  date: "거래일자",
  deposit: "입금액",
  withdrawal: "출금액",
  amount: "거래금액",
  transaction_type: "거래구분",
  balance: "잔액",
  memo: "비고",
};

// 거래 유형 방식 한글 매핑
const transactionMethodLabels: Record<string, string> = {
  separate_columns: "입금/출금 분리형",
  type_column: "거래구분 텍스트형",
  sign_in_type: "거래구분 기호형 ([+]/[-])",
  amount_sign: "금액 부호형",
};

/**
 * ProgressBar Atom Component
 *
 * Displays file upload progress with visual feedback.
 *
 * @param props - ProgressBarProps
 * @returns JSX element
 */
export function ProgressBar({
  progress,
  stage,
  error,
  completionData,
  onRetry,
}: ProgressBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Error state display with retry button (AC4)
  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5 fade-in">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">업로드 실패</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="shrink-0"
              >
                재시도
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state with summary
  if (progress === 100 && completionData) {
    const { llmAnalysis } = completionData;
    const hasMemoColumn = llmAnalysis?.columnMapping?.memo;
    const memoStatus = hasMemoColumn 
      ? { status: "success", message: `"${hasMemoColumn}" 컬럼 인식됨` }
      : llmAnalysis?.memoInAmountColumn
        ? { status: "info", message: "금액 컬럼에서 비고 추출 (특수 형식)" }
        : { status: "warning", message: "비고 컬럼 미인식 - LLM이 비고 컬럼을 찾지 못했습니다" };

    return (
      <Card className="border-success/50 bg-success/5 fade-in">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* 상단: 완료 메시지 + 신뢰도 */}
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-success shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-success">
                  파일 분석 완료
                </span>
                <div className="flex items-center gap-3">
                  {llmAnalysis && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      AI 신뢰도: {Math.round(llmAnalysis.confidence * 100)}%
                    </span>
                  )}
                  <span className="text-sm font-semibold text-success">100%</span>
                </div>
              </div>
            </div>

            {/* 2열 그리드 레이아웃 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-success/20 pt-4">
              {/* 왼쪽: 기본 정보 */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-foreground min-w-[70px]">파일명:</span>
                  <span className="text-muted-foreground break-all">{completionData.fileName}</span>
                </div>

                {completionData.totalTransactions !== undefined && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-foreground min-w-[70px]">거래 건수:</span>
                    <span className="text-muted-foreground">
                      {completionData.totalTransactions.toLocaleString()}건
                    </span>
                  </div>
                )}

                {llmAnalysis && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-foreground min-w-[70px]">거래 형식:</span>
                    <span className="text-muted-foreground">
                      {transactionMethodLabels[llmAnalysis.transactionTypeMethod] || llmAnalysis.transactionTypeMethod}
                    </span>
                  </div>
                )}
              </div>

              {/* 오른쪽: 컬럼 매핑 */}
              <div className="space-y-3 text-sm">
                {llmAnalysis && (
                  <div className="space-y-2">
                    <span className="font-medium text-foreground">인식된 컬럼:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(llmAnalysis.columnMapping)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                              key === "memo" 
                                ? "bg-amber-100 text-amber-700 border border-amber-200" 
                                : "bg-primary/10 border border-primary/20 text-primary"
                            }`}
                          >
                            {columnTypeLabels[key] || key}: {value}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 비고 인식 상태 표시 */}
            {llmAnalysis && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                memoStatus.status === "success" 
                  ? "bg-green-50 border border-green-200" 
                  : memoStatus.status === "info"
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-amber-50 border border-amber-200"
              }`}>
                <Info className={`size-4 shrink-0 mt-0.5 ${
                  memoStatus.status === "success" 
                    ? "text-green-600" 
                    : memoStatus.status === "info"
                      ? "text-blue-600"
                      : "text-amber-600"
                }`} />
                <div className="flex-1">
                  <span className={`font-medium ${
                    memoStatus.status === "success" 
                      ? "text-green-700" 
                      : memoStatus.status === "info"
                        ? "text-blue-700"
                        : "text-amber-700"
                  }`}>
                    비고(메모): {memoStatus.message}
                  </span>
                </div>
              </div>
            )}

            {/* 상세 분석 결과 토글 */}
            {llmAnalysis?.reasoning && (
              <div className="border-t border-success/20 pt-3">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  <span>AI 분석 상세 보기</span>
                </button>
                {showDetails && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">분석 근거:</p>
                    <p>{llmAnalysis.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // In-progress state
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 text-primary shrink-0 animate-spin" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{stage}</span>
              <span className="text-sm font-semibold text-primary">{progress}%</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
