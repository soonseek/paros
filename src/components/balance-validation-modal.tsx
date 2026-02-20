/**
 * 잔액 기반 입금/출금 검증 모달
 * 
 * OCR 파싱 오류로 인한 입금/출금 오분류를 감지하고 교정합니다.
 */

import { useState } from "react";
import { Loader2, AlertTriangle, CheckCircle, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface BalanceValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function BalanceValidationModal({ isOpen, onClose, caseId }: BalanceValidationModalProps) {
  const [hasValidated, setHasValidated] = useState(false);
  
  const utils = api.useUtils();
  
  // 검증 API (dryRun=true)
  const validateMutation = api.transaction.validateBalanceAndCorrect.useMutation({
    onSuccess: (data) => {
      setHasValidated(true);
      console.log("[잔액검증] 결과:", data);
      if (data.issuesFound === 0) {
        toast.success("모든 거래가 정상입니다.");
      } else {
        toast.warning(`${data.issuesFound}건의 오분류가 감지되었습니다.`);
      }
    },
    onError: (error) => {
      toast.error(`검증 실패: ${error.message}`);
    },
  });
  
  // 교정 API (dryRun=false)
  const correctMutation = api.transaction.validateBalanceAndCorrect.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.correctionsMade}건이 교정되었습니다.`);
      // 거래 목록 갱신
      void utils.transaction.getTransactionsForCase.invalidate({ caseId });
      onClose();
    },
    onError: (error) => {
      toast.error(`교정 실패: ${error.message}`);
    },
  });
  
  const handleValidate = () => {
    validateMutation.mutate({ caseId, dryRun: true });
  };
  
  const handleCorrect = () => {
    if (!validateMutation.data || validateMutation.data.issuesFound === 0) return;
    
    if (confirm(`${validateMutation.data.issuesFound}건의 오분류를 교정하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      correctMutation.mutate({ caseId, dryRun: false });
    }
  };
  
  const handleClose = () => {
    setHasValidated(false);
    validateMutation.reset();
    onClose();
  };
  
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            잔액 기반 입금/출금 검증
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 설명 */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">OCR 파싱 오류 자동 감지</p>
              <p className="text-sm text-amber-700 mt-1">
                거래 내역의 잔액을 역산하여 입금/출금이 잘못 분류된 거래를 찾아냅니다.
                예: 잔액이 증가했는데 출금으로 기록된 경우 → 입금으로 교정
              </p>
            </div>
          </div>

          {/* 검증 버튼 */}
          {!hasValidated && (
            <div className="flex justify-center">
              <Button 
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                size="lg"
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    검증 중...
                  </>
                ) : (
                  "검증 시작"
                )}
              </Button>
            </div>
          )}

          {/* 검증 결과 */}
          {hasValidated && validateMutation.data && (
            <div className="space-y-4">
              {/* 요약 */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold">{validateMutation.data.totalTransactions}</p>
                  <p className="text-sm text-muted-foreground">총 거래</p>
                </div>
                <div className="text-center">
                  {validateMutation.data.issuesFound > 0 ? (
                    <p className="text-2xl font-bold text-red-600">{validateMutation.data.issuesFound}</p>
                  ) : (
                    <p className="text-2xl font-bold text-green-600">0</p>
                  )}
                  <p className="text-sm text-muted-foreground">오분류 감지</p>
                </div>
              </div>

              {/* 오분류 목록 */}
              {validateMutation.data.issuesFound > 0 ? (
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">날짜</TableHead>
                        <TableHead className="w-[100px]">현재 분류</TableHead>
                        <TableHead className="w-[100px]">권장 분류</TableHead>
                        <TableHead className="text-right">금액</TableHead>
                        <TableHead className="text-right">이전 잔액</TableHead>
                        <TableHead className="text-right">현재 잔액</TableHead>
                        <TableHead>비고</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validateMutation.data.issues.map((issue, idx) => (
                        <TableRow key={issue.id || idx}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(issue.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{issue.currentType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-600">
                              {issue.suggestedType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {issue.amount.toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {issue.prevBalance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {issue.currentBalance.toLocaleString()}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {issue.memo}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">모든 거래가 정상입니다</p>
                  <p className="text-sm text-muted-foreground">
                    잔액 기반 검증 결과 오분류된 거래가 없습니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {hasValidated && validateMutation.data && validateMutation.data.issuesFound > 0 && (
            <Button 
              onClick={handleCorrect}
              disabled={correctMutation.isPending}
              variant="destructive"
            >
              {correctMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  교정 중...
                </>
              ) : (
                `${validateMutation.data.issuesFound}건 교정하기`
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
