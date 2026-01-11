/**
 * Restore Original Classification Button Component
 *
 * Story 4.5: 수동 분류 수정
 *
 * 원본 AI 분류로 복원하는 버튼 컴포넌트
 * - 확인 다이얼로그로 실수 방지
 * - tRPC mutation으로 원본 복원
 */

"use client";

import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useI18n } from "~/lib/i18n";
import { api } from "~/utils/api";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";

interface RestoreOriginalButtonProps {
  transactionId: string;
  onRestored: () => void;
  disabled?: boolean;
}

/**
 * 원본 복원 버튼 컴포넌트
 *
 * @example
 * <RestoreOriginalButton
 *   transactionId="tx-123"
 *   onRestored={() => refetch()}
 * />
 */
export function RestoreOriginalButton({
  transactionId,
  onRestored,
  disabled = false,
}: RestoreOriginalButtonProps) {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // tRPC mutation
  const restoreMutation = api.transaction.restoreOriginalClassification.useMutation({
    onSuccess: () => {
      toast.success(t("manualClassification.restoreSuccess"));
      setIsDialogOpen(false);
      onRestored();
    },
    onError: (error) => {
      console.error("원본 복원 실패:", error);
      toast.error(error.message || t("manualClassification.error.restoreFailed"));
    },
  });

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync({ transactionId });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to restore classification:", error);
    }
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled || restoreMutation.isPending}
        aria-label={t("manualClassification.restore")}
      >
        <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" />
        {t("manualClassification.restore")}
      </Button>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("manualClassification.restoreConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("manualClassification.restoreConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="outline"
              disabled={restoreMutation.isPending}
            >
              {t("manualClassification.cancel")}
            </Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />
                  {t("manualClassification.restoring")}
                </>
              ) : (
                t("manualClassification.restore")
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
