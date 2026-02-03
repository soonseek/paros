/**
 * ProgressBar Atom Component
 *
 * Story 3.5: 실시간 진행률 표시 (SSE)
 */

import { Progress } from "~/components/ui/progress";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";

interface LLMAnalysisResult {
  transactionTypeMethod: string;
  memoInAmountColumn?: boolean;
  reasoning: string;
  confidence: number;
  columnMapping: Record<string, string | undefined>;
}

export interface ProgressBarProps {
  progress: number;
  stage: string;
  error?: string | null;
  completionData?: {
    fileName: string;
    totalTransactions?: number;
    columns?: string[];
    llmAnalysis?: LLMAnalysisResult;
    templateMatch?: {
      templateName: string;
      bankName?: string;
      layer: number;
      confidence: number;
    };
  };
  onRetry?: () => void;
}

const columnTypeLabels: Record<string, string> = {
  date: "거래일자",
  deposit: "입금액",
  withdrawal: "출금액",
  amount: "거래금액",
  transaction_type: "거래구분",
  balance: "잔액",
  memo: "비고",
};

const transactionMethodLabels: Record<string, string> = {
  separate_columns: "입금/출금 분리형",
  type_column: "거래구분 텍스트형",
  sign_in_type: "거래구분 기호형",
  amount_sign: "금액 부호형",
};

export function ProgressBar({
  progress,
  stage,
  error,
  completionData,
  onRetry,
}: ProgressBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Error state
  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">업로드 실패</p>
                <p className="text-sm text-destructive/80 break-words">{error}</p>
              </div>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
                재시도
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state
  if (progress === 100 && completionData) {
    const { llmAnalysis } = completionData;
    const hasMemoColumn = llmAnalysis?.columnMapping?.memo;
    
    let memoStatus: { status: string; message: string };
    if (hasMemoColumn) {
      memoStatus = { status: "success", message: `"${hasMemoColumn}" 인식됨` };
    } else if (llmAnalysis?.memoInAmountColumn) {
      memoStatus = { status: "info", message: "금액 컬럼에서 추출" };
    } else {
      memoStatus = { status: "warning", message: "미인식" };
    }

    const recognizedColumns = llmAnalysis 
      ? Object.entries(llmAnalysis.columnMapping).filter(([, v]) => v)
      : [];

    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              <span className="font-medium text-green-700">분석 완료</span>
            </div>
            <div className="flex gap-2">
              {completionData.templateMatch && (
                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                  Layer {completionData.templateMatch.layer}
                </span>
              )}
              {llmAnalysis && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                  신뢰도 {Math.round(llmAnalysis.confidence * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Template Match Info */}
          {completionData.templateMatch && (
            <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-600 mb-1">템플릿 매칭</div>
              <div className="font-medium text-purple-900">
                {completionData.templateMatch.templateName}
              </div>
              {completionData.templateMatch.bankName && (
                <div className="text-sm text-purple-700">
                  {completionData.templateMatch.bankName}
                </div>
              )}
              <div className="text-xs text-purple-600 mt-1">
                신뢰도: {Math.round(completionData.templateMatch.confidence * 100)}%
              </div>
            </div>
          )}

          {/* File Info */}
          <div className="space-y-2 text-sm mb-3">
            <div className="flex gap-2">
              <span className="text-gray-500 shrink-0">파일:</span>
              <span className="font-medium truncate">{completionData.fileName}</span>
            </div>
            <div className="flex gap-4">
              {completionData.totalTransactions !== undefined && (
                <span>
                  <span className="text-gray-500">거래:</span>{" "}
                  <span className="font-medium">{completionData.totalTransactions.toLocaleString()}건</span>
                </span>
              )}
              {llmAnalysis && (
                <span>
                  <span className="text-gray-500">형식:</span>{" "}
                  <span className="font-medium">
                    {transactionMethodLabels[llmAnalysis.transactionTypeMethod] || llmAnalysis.transactionTypeMethod}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Column Mapping */}
          {recognizedColumns.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1.5">인식된 컬럼</div>
              <div className="flex flex-wrap gap-1.5">
                {recognizedColumns.map(([key, value]) => (
                  <span
                    key={key}
                    className={`text-xs px-2 py-0.5 rounded ${
                      key === "memo"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {columnTypeLabels[key] || key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Memo Status */}
          {llmAnalysis && (
            <div
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                memoStatus.status === "success"
                  ? "bg-green-100 text-green-700"
                  : memoStatus.status === "info"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <Info className="size-3.5" />
              <span>비고 컬럼: {memoStatus.message}</span>
            </div>
          )}

          {/* Details Toggle */}
          {llmAnalysis?.reasoning && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                AI 분석 상세
              </button>
              {showDetails && (
                <p className="mt-2 text-xs text-gray-600 bg-white/50 p-2 rounded">
                  {llmAnalysis.reasoning}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // In-progress state
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="size-4 text-blue-600 animate-spin" />
          <span className="text-sm font-medium flex-1">{stage}</span>
          <span className="text-sm font-semibold text-blue-600">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </CardContent>
    </Card>
  );
}
