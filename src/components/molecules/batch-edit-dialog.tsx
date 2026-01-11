/**
 * Batch Edit Dialog Component
 *
 * Story 4.7: 일괄 분류 수정 (Batch Classification Edit)
 *
 * 여러 거래를 일괄적으로 수정하는 다이얼로그 컴포넌트입니다.
 * - 선택된 거래 수 표시
 * - 중요 거래 표시 체크박스
 * - 태그 추가 섹션 (Story 4.6의 BatchTagDialog 재사용)
 * - "적용" 버튼
 * - tRPC mutation 호출 (batchUpdateTransactions)
 *
 * @param transactionIds - 수정할 거래 ID 목록
 * @param open - 다이얼로그 열림 여부
 * @param onClose - 닫기 콜백
 * @param onComplete - 완료 콜백
 */

"use client";

import { useState } from "react";
import { Loader2, Edit as EditIcon } from "lucide-react";
import { api } from "~/utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { BatchTagDialog } from "./batch-tag-dialog";

interface BatchEditDialogProps {
  transactionIds: string[];
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * 일괄 수정 다이얼로그 컴포넌트
 *
 * @example
 * <BatchEditDialog
 *   transactionIds={["tx-1", "tx-2", "tx-3"]}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onComplete={() => refetch()}
 * />
 */
export function BatchEditDialog({
  transactionIds,
  open,
  onClose,
  onComplete,
}: BatchEditDialogProps) {
  const [importantTransaction, setImportantTransaction] = useState<boolean | undefined>();
  const [showTagDialog, setShowTagDialog] = useState(false);

  // tRPC mutation
  const batchUpdateMutation = api.transaction.batchUpdateTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // 상태 초기화
      setImportantTransaction(undefined);
      onComplete();
      onClose();
    },
    onError: (error) => {
      console.error("일괄 수정 실패:", error);
      toast.error(error.message || "일괄 수정에 실패했습니다.");
    },
  });

  // 적용 버튼 클릭 처리
  const handleApply = async () => {
    // 최소 1개의 수정 옵션이 선택되어야 함
    // 참고: 카테고리 변경은 Story 4.5의 단일 수정 기능 사용 권장
    // 일괄 수정에서는 중요 거래 표시와 태그 추가만 지원
    if (importantTransaction === undefined) {
      toast.error("수정할 옵션을 선택해주세요.");
      return;
    }

    try {
      await batchUpdateMutation.mutateAsync({
        transactionIds,
        updates: {
          importantTransaction,
        },
      });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to batch update:", error);
    }
  };

  // 다이얼로그가 닫힐 때 상태 초기화
  const handleClose = () => {
    setImportantTransaction(undefined);
    setShowTagDialog(false);
    onClose();
  };

  // 태그 추가 완료 처리
  const handleTagComplete = () => {
    setShowTagDialog(false);
    // 태그 추가가 완료되면 다이얼로그를 닫지 않고 상태 유지
    // 사용자가 추가 수정을 할 수 있도록 함
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <EditIcon className="h-5 w-5" />
              일괄 수정
            </DialogTitle>
            <DialogDescription>
              {transactionIds.length}개의 거래를 일괄 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 중요 거래 표시 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="important-checkbox"
                  checked={importantTransaction}
                  onCheckedChange={(checked) =>
                    setImportantTransaction(checked === true ? true : undefined)
                  }
                  disabled={batchUpdateMutation.isPending}
                />
                <Label
                  htmlFor="important-checkbox"
                  className="cursor-pointer"
                >
                  중요 거래로 표시
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                선택된 거래를 중요 거래로 표시합니다.
              </p>
            </div>

            {/* 태그 추가 버튼 */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowTagDialog(true)}
                disabled={batchUpdateMutation.isPending}
              >
                태그 추가
              </Button>
              <p className="text-xs text-muted-foreground">
                선택된 거래에 동일한 태그를 추가합니다. (Story 4.6 기능)
              </p>
            </div>

            {/* 안내 메시지 */}
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                💡 <strong>팁:</strong> 카테고리 변경은 개별 수정 기능(Story 4.5)을 사용해주세요.
                일괄 수정에서는 중요 거래 표시와 태그 추가를 지원합니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={batchUpdateMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={
                batchUpdateMutation.isPending ||
                importantTransaction === undefined
              }
            >
              {batchUpdateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  적용 중...
                </>
              ) : (
                <>
                  <EditIcon className="h-4 w-4 mr-2" />
                  적용
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 태그 추가 다이얼로그 (Story 4.6 재사용) */}
      {showTagDialog && (
        <BatchTagDialog
          transactionIds={transactionIds}
          open={showTagDialog}
          onClose={() => setShowTagDialog(false)}
          onComplete={handleTagComplete}
        />
      )}
    </>
  );
}
