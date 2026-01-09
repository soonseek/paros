/**
 * File Preview Modal
 *
 * Story 3.7: Displays first 20 transactions from uploaded file
 *
 * Features:
 * - Dialog/Modal structure using shadcn/ui Dialog
 * - Table display of first 20 transactions
 * - Columns: date, deposit amount, withdrawal amount, balance, memo
 * - Loading state with skeleton
 * - File metadata display (filename, uploaded date, total transactions)
 *
 * @example
 * <FilePreviewModal
 *   documentId="doc-123"
 *   documentName="statement.xlsx"
 *   uploadedAt={new Date()}
 *   totalTransactions={150}
 *   open={true}
 *   onOpenChange={(open) => setOpen(open)}
 * />
 */

import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";

interface PreviewModalProps {
  documentId: string;
  documentName: string;
  uploadedAt: Date;
  totalTransactions: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Format Decimal amount to Korean currency string
 *
 * @param amount - Decimal amount from Prisma
 * @returns Formatted currency string (e.g., "1,000,000원")
 */
function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(num);
}

export function FilePreviewModal({
  documentId,
  documentName,
  uploadedAt,
  totalTransactions,
  open,
  onOpenChange,
}: PreviewModalProps) {
  // LOW-2 FIX: 에러 처리 및 재시도 기능 추가
  const { data: previewData, isLoading, error, refetch } =
    api.file.getTransactionsPreview.useQuery(
      {
        documentId,
      },
      {
        enabled: open, // Only fetch when modal is open
        retry: 2, // LOW-2 FIX: 재시도 2회
      }
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>파일 미리보기: {documentName}</DialogTitle>
          <DialogDescription>
            업로드일시: {format(uploadedAt, "yyyy-MM-dd HH:mm")} | 총{" "}
            {totalTransactions.toLocaleString()}건 중 처음 20건 표시
          </DialogDescription>
        </DialogHeader>

        {error ? (
          // LOW-2 FIX: 에러 상태 처리 및 재시도 버튼
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              미리보기 데이터를 불러올 수 없습니다
            </p>
            <Button onClick={() => refetch()} variant="outline">
              다시 시도
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead className="text-right">입금액</TableHead>
                  <TableHead className="text-right">출금액</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                  <TableHead>메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      표시할 데이터가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  previewData?.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.transactionDate), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.depositAmount
                          ? formatCurrency(tx.depositAmount.toString())
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.withdrawalAmount
                          ? formatCurrency(tx.withdrawalAmount.toString())
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.balance
                          ? formatCurrency(tx.balance.toString())
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {tx.memo || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
