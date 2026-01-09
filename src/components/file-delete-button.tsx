/**
 * File Delete Button
 *
 * Story 3.7: Delete uploaded document with confirmation dialog
 *
 * Features:
 * - Delete button with trash icon
 * - Confirmation dialog (shadcn/ui AlertDialog)
 * - Deletion restriction for processing/saving status files
 * - Loading state during deletion
 * - Toast notifications for success/error
 *
 * @example
 * <FileDeleteButton
 *   documentId="doc-123"
 *   documentName="statement.xlsx"
 *   analysisStatus="completed"
 *   onDeleteSuccess={() => console.log('Deleted')}
 * />
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "~/utils/api";
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
import { toast } from "sonner";

interface DeleteButtonProps {
  documentId: string;
  documentName: string;
  analysisStatus: string;
  onDeleteSuccess: () => void;
}

export function FileDeleteButton({
  documentId,
  documentName,
  analysisStatus,
  onDeleteSuccess,
}: DeleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteMutation = api.file.deleteDocument.useMutation();

  /**
   * AC5: 파일 삭제 가능 여부 확인
   *
   * 삭제 불가 상태:
   * - "processing": 데이터 추출 중 (실시간 파일 접근 중)
   * - "saving": DB 저장 중 (transaction insert 중)
   *
   * 삭제 가능 상태: pending, analyzing, completed, failed
   *
   * 상태별 설명:
   * - pending: 분석 대기 중 → 삭제 가능 (아직 분석 시작 전)
   * - analyzing: 구조 분석 중 → 삭제 가능 (아직 데이터 추출 전)
   * - processing: 데이터 추출 중 → 삭제 불가 (실시간 파일 접근)
   * - saving: DB 저장 중 → 삭제 불가 (transaction insert 진행 중)
   * - completed: 분석 완료 → 삭제 가능 (사용자 확인 후)
   * - failed: 분석 실패 → 삭제 가능 (재시도 가능)
   */
  const DELETION_BLOCKED_STATUSES = ["processing", "saving"] as const;
  const canDelete = !DELETION_BLOCKED_STATUSES.includes(analysisStatus as any);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ documentId });
      toast.success("파일이 삭제되었습니다");
      setShowConfirm(false);
      onDeleteSuccess();
    } catch (error) {
      // Error message is already handled by the mutation
      // TRPCError will be caught and displayed
      console.error("[Delete Error]", error);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={!canDelete || deleteMutation.isPending}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        삭제
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파일 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말 "{documentName}" 파일을 삭제하시겠습니까?
              <br />
              <br />
              삭제된 파일은 복구할 수 없으며, 관련된 모든 거래 데이터도 함께
              삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
