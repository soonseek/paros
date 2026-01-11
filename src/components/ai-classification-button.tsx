/**
 * AI Classification Button
 *
 * Story 4.1: AI 기반 거래 자동 분류
 * Story 4.1, Task 5: 분류 시작 UI
 * Story 4.1, HIGH-3 & MEDIUM-8 FIX: 실시간 진행률 표시
 *
 * 기능:
 * - "AI 분류 시작" 버튼
 * - shadcn/ui Button 컴포넌트 사용
 * - 로딩 상태 표시
 * - 분류 완료 후 Toast 알림 (sonner)
 * - 분류 가능 상태 체크 (이미 완료된 경우 비활성화)
 * - Story 4.1, HIGH-3: SSE를 통한 실시간 진행률 수신
 *
 * @example
 * <AIClassificationButton
 *   documentId="doc-123"
 *   classificationStatus="pending"
 *   onClassificationComplete={() => console.log('완료')}
 * />
 */

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "~/utils/api";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { useClassificationProgress } from "~/hooks/use-classification-progress";

interface AIClassificationButtonProps {
  documentId: string;
  classificationStatus: string;
  onClassificationComplete?: () => void;
}

export function AIClassificationButton({
  documentId,
  classificationStatus,
  onClassificationComplete,
}: AIClassificationButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [localStatus, setLocalStatus] = useState(classificationStatus);

  // Story 4.1, MEDIUM-8 FIX: 로컬 상태 동기화
  useEffect(() => {
    setLocalStatus(classificationStatus);
  }, [classificationStatus]);

  const classifyMutation = api.transaction.classifyTransactions.useMutation();

  // Story 4.1, HIGH-3 FIX: SSE를 통한 실시간 진행률 수신
  const { progress, isConnected } = useClassificationProgress(
    localStatus === "processing" ? documentId : null,
    {
      onCompleted: () => {
        setLocalStatus("completed");
        setIsClassifying(false);
        toast.success("AI 분류가 완료되었습니다.");
        onClassificationComplete?.();
      },
      onFailed: (error) => {
        setLocalStatus("failed");
        setIsClassifying(false);
        toast.error(error || "AI 분류에 실패했습니다.");
      },
    }
  );

  // 분류가 이미 완료되었거나 진행 중인 경우 비활성화
  const isDisabled =
    localStatus === "completed" ||
    localStatus === "processing" ||
    isClassifying;

  const handleClassify = async () => {
    try {
      setIsClassifying(true);
      setShowConfirm(false);

      await classifyMutation.mutateAsync({ documentId });

      toast.success("AI 분류를 시작했습니다. 잠시 후 결과를 확인해주세요.");

      // 진행 상태로 변경 (Story 4.1, MEDIUM-8 FIX)
      setLocalStatus("processing");
    } catch (error) {
      console.error("[AI Classification] 분류 시작 실패:", error);

      toast.error(
        "AI 분류를 시작할 수 없습니다. 다시 시도해주세요."
      );
      setIsClassifying(false);
    }
  };

  // 진행률 표시 텍스트
  const getButtonText = () => {
    if (localStatus === "completed") {
      return "분류 완료";
    }
    if (localStatus === "processing" || isClassifying) {
      if (progress && progress.total > 0) {
        const percent = Math.round((progress.progress / progress.total) * 100);
        return `분류 중... ${percent}%`;
      }
      return "분류 중...";
    }
    return "AI 분류 시작";
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={isDisabled}
      >
        {(localStatus === "processing" || isClassifying) && (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        )}
        {(localStatus !== "processing" && !isClassifying) && (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        {getButtonText()}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI 분류 시작 확인</AlertDialogTitle>
            <AlertDialogDescription>
              AI가 거래 내역을 분석하여 자동으로 카테고리를 분류합니다.
              <br />
              <br />
              분류는 몇 초 정도 소요될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClassifying}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClassify();
              }}
              disabled={isClassifying}
            >
              {isClassifying ? "시작 중..." : "시작"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
