/**
 * Report Error Dialog Component
 *
 * Story 4.8: Task 9 - 학습 피드백 루프
 *
 * 기능:
 * - 분류 오류 보고 다이얼로그
 * - 오류 유형, 설명, 심각도 입력
 * - tRPC 뮤테이션으로 오류 보고 전송
 *
 * @module components/report-error-dialog
 */

import { useState } from "react";
import { api } from "~/utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * 오류 보고 다이얼로그 속성
 */
interface ReportErrorDialogProps {
  transactionId: string;
  trigger?: React.ReactNode;
}

/**
 * 분류 오류 보고 다이얼로그 컴포넌트
 */
export function ReportErrorDialog({
  transactionId,
  trigger,
}: ReportErrorDialogProps) {
  const [open, setOpen] = useState(false);
  const [errorType, setErrorType] = useState<"WRONG_CATEGORY" | "MISSED" | "LOW_CONFIDENCE">();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  // 오류 보고 뮤테이션
  const reportError = api.transaction.reportClassificationError.useMutation();

  /**
   * 오류 보고 제출 핸들러
   */
  const handleSubmit = async () => {
    if (!errorType || !description.trim()) {
      toast.error("오류 유형과 설명을 입력해주세요.");
      return;
    }

    try {
      await reportError.mutateAsync({
        transactionId,
        errorType,
        description: description.trim(),
        severity,
      });

      toast.success("오류가 성공적으로 보고되었습니다.");
      setOpen(false);
      // 폼 초기화
      setErrorType(undefined);
      setDescription("");
      setSeverity("MEDIUM");
    } catch (error) {
      console.error("[ReportErrorDialog] 오류 보고 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "오류 보고에 실패했습니다."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <AlertCircle className="mr-2 h-4 w-4" />
            오류 보고
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>분류 오류 보고</DialogTitle>
          <DialogDescription>
            AI 분류 결과가 올바르지 않은 경우 오류를 보고해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 오류 유형 선택 */}
          <div className="space-y-2">
            <Label htmlFor="errorType">오류 유형 *</Label>
            <Select
              value={errorType}
              onValueChange={(value) =>
                setErrorType(value as typeof errorType)
              }
            >
              <SelectTrigger id="errorType">
                <SelectValue placeholder="오류 유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WRONG_CATEGORY">
                  잘못된 카테고리
                </SelectItem>
                <SelectItem value="MISSED">누락된 분류</SelectItem>
                <SelectItem value="LOW_CONFIDENCE">
                  신뢰도 부정확
                </SelectItem>
              </SelectContent>
            </Select>
            {errorType && (
              <p className="text-xs text-muted-foreground">
                {get_error_type_description(errorType)}
              </p>
            )}
          </div>

          {/* 설명 입력 */}
          <div className="space-y-2">
            <Label htmlFor="description">설명 *</Label>
            <Textarea
              id="description"
              placeholder="오류 내용을 자세히 설명해주세요..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 자
            </p>
          </div>

          {/* 심각도 선택 */}
          <div className="space-y-2">
            <Label htmlFor="severity">심각도</Label>
            <Select
              value={severity}
              onValueChange={(value) =>
                setSeverity(value as typeof severity)
              }
            >
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">낮음</SelectItem>
                <SelectItem value="MEDIUM">보통</SelectItem>
                <SelectItem value="HIGH">높음</SelectItem>
              </SelectContent>
            </Select>
            {severity && (
              <p className="text-xs text-muted-foreground">
                {get_severity_description(severity)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={reportError.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={reportError.isPending || !errorType || !description.trim()}
          >
            {reportError.isPending ? "보고 중..." : "오류 보고"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 오류 유형별 설명 헬퍼 함수
 */
function get_error_type_description(
  type: "WRONG_CATEGORY" | "MISSED" | "LOW_CONFIDENCE"
): string {
  const descriptions: Record<
    typeof type,
    string
  > = {
    WRONG_CATEGORY:
      "AI가 분류한 카테고리가 올바르지 않은 경우 (예: '급여'를 '기타'로 분류)",
    MISSED:
      "AI가 거래를 분류하지 못한 경우 (예: '미분류'로 남겨진 거래)",
    LOW_CONFIDENCE:
      "AI가 분류했지만 신뢰도가 낮아 재검토가 필요한 경우",
  };
  return descriptions[type];
}

/**
 * 심각도별 설명 헬퍼 함수
 */
function get_severity_description(
  severity: "LOW" | "MEDIUM" | "HIGH"
): string {
  const descriptions: Record<
    typeof severity,
    string
  > = {
    LOW: "사소한 오류, 기능에 영향이 적음",
    MEDIUM: "일반적인 오류, 사용성에 약간의 영향",
    HIGH: "심각한 오류, 즉각적인 수정 필요",
  };
  return descriptions[severity];
}
