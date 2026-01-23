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
 * - Enhanced visual design with animations
 *
 * @example
 * <ProgressBar progress={50} stage="구조 분석 중..." />
 * <ProgressBar progress={0} stage="실패" error="파일이 손상되었습니다" />
 */

import { Progress } from "~/components/ui/progress";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
  };
  /** Callback when retry button is clicked (AC4) */
  onRetry?: () => void;
}

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
    return (
      <Card className="border-success/50 bg-success/5 fade-in">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-success shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-success">
                  파일 업로드가 완료되었습니다
                </span>
                <span className="text-sm font-semibold text-success">100%</span>
              </div>
            </div>

            <div className="space-y-3 text-sm border-t border-success/20 pt-4">
              <div className="flex items-start gap-2">
                <span className="font-medium text-foreground min-w-[80px]">파일명:</span>
                <span className="text-muted-foreground break-all">{completionData.fileName}</span>
              </div>

              {completionData.totalTransactions !== undefined && (
                <div className="flex items-start gap-2">
                  <span className="font-medium text-foreground min-w-[80px]">거래 건수:</span>
                  <span className="text-muted-foreground">
                    {completionData.totalTransactions.toLocaleString()}건
                  </span>
                </div>
              )}

              {completionData.columns && completionData.columns.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="font-medium text-foreground min-w-[80px]">식별된 열:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {completionData.columns.map((column) => (
                      <span
                        key={column}
                        className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs font-medium text-primary"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
