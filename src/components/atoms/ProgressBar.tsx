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
 *
 * @example
 * <ProgressBar progress={50} stage="구조 분석 중..." />
 * <ProgressBar progress={0} stage="실패" error="파일이 손상되었습니다" />
 */

import { Progress } from "~/components/ui/progress";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

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
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-red-600 font-medium flex-1">❌ {error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="text-red-600 border-red-300 hover:bg-red-100"
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
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-600">
                ✓ 파일 업로드가 완료되었습니다
              </span>
              <span className="text-sm text-muted-foreground">100%</span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">파일명:</span>{" "}
                <span className="text-muted-foreground">{completionData.fileName}</span>
              </div>

              {completionData.totalTransactions !== undefined && (
                <div>
                  <span className="font-medium">총 거래 건수:</span>{" "}
                  <span className="text-muted-foreground">
                    {completionData.totalTransactions}건
                  </span>
                </div>
              )}

              {completionData.columns && completionData.columns.length > 0 && (
                <div>
                  <span className="font-medium">식별된 열:</span>{" "}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {completionData.columns.map((column) => (
                      <span
                        key={column}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
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
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{stage}</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
