/**
 * 대출금 사용 소명자료 생성 모달
 */

import { useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import * as XLSX from "xlsx";
import type { SimplifiedTransaction } from "./simplified-transaction-table";

interface LoanTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  transactions: SimplifiedTransaction[];
}

interface TrackedItem {
  date: string;
  type: "대출실행" | "출금" | "이체";
  amount: number;
  balance: number;
  memo: string;
  depth: number; // 추적 깊이 (0=대출, 1=직접 사용, 2=이체 후 사용)
}

export function LoanTrackingModal({ isOpen, onClose, transactions }: LoanTrackingModalProps) {
  const [keyword, setKeyword] = useState<string>("");
  const [trackedData, setTrackedData] = useState<TrackedItem[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loanAmount, setLoanAmount] = useState<number>(0);

  const handleTrack = () => {
    setIsTracking(true);
    
    try {
      // 1단계: 대출 실행건 찾기 (키워드 포함된 입금액)
      const loanDeposit = transactions.find(tx => {
        const deposit = Number(tx.depositAmount) || 0;
        const memo = (tx.memo || "").toLowerCase();
        const searchKey = keyword.toLowerCase();
        
        return deposit > 0 && memo.includes(searchKey);
      });

      if (!loanDeposit) {
        alert(`"${keyword}" 키워드를 포함한 입금 거래를 찾을 수 없습니다.`);
        setIsTracking(false);
        return;
      }

      const loanAmountValue = Number(loanDeposit.depositAmount);
      setLoanAmount(loanAmountValue);
      
      const tracked: TrackedItem[] = [];
      
      // 대출 실행건 추가
      tracked.push({
        date: loanDeposit.date,
        type: "대출실행",
        amount: loanAmountValue,
        balance: Number(loanDeposit.balance) || 0,
        memo: loanDeposit.memo || "",
        depth: 0,
      });

      // 2단계: 대출 실행 이후의 거래 추적
      const loanDate = new Date(loanDeposit.date);
      const afterLoan = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= loanDate;
      });

      // 출금 및 이체 내역 추출
      let remainingBalance = loanAmountValue;
      
      for (const tx of afterLoan) {
        const withdrawal = Number(tx.withdrawalAmount) || 0;
        
        if (withdrawal > 0) {
          const memo = tx.memo || "";
          const isTransfer = memo.includes("이체") || memo.includes("송금");
          
          tracked.push({
            date: tx.date,
            type: isTransfer ? "이체" : "출금",
            amount: withdrawal,
            balance: Number(tx.balance) || 0,
            memo,
            depth: 1,
          });
          
          remainingBalance -= withdrawal;
          
          // 잔액이 음수가 되면 추적 종료
          if (remainingBalance <= 0) break;
        }
      }
      
      setTrackedData(tracked);
    } finally {
      setIsTracking(false);
    }
  };

  const handleDownload = () => {
    if (trackedData.length === 0) return;

    // 엑셀 데이터 준비
    const excelData = trackedData.map(item => ({
      "날짜": item.date,
      "구분": item.type,
      "금액": item.amount,
      "잔액": item.balance,
      "비고": item.memo,
      "깊이": item.depth === 0 ? "대출" : `${item.depth}차`,
    }));

    // 워크북 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "대출금 추적");

    // 다운로드
    XLSX.writeFile(wb, `대출금추적_${keyword}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>대출금 사용 소명자료 생성</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 입력 */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>대출건 검색 키워드</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 주택담보대출, 신용대출, 마이너스통장"
              />
              <p className="text-xs text-muted-foreground mt-1">
                비고에 이 키워드가 포함된 입금 거래를 대출 실행건으로 간주합니다
              </p>
            </div>
            <Button onClick={handleTrack} disabled={isTracking || !keyword}>
              {isTracking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  추적 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  추적 시작
                </>
              )}
            </Button>
          </div>

          {/* 대출금 정보 */}
          {loanAmount > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-medium">대출금: {loanAmount.toLocaleString()}원</p>
              <p className="text-sm text-muted-foreground">
                추적된 사용 내역: {trackedData.length - 1}건
              </p>
            </div>
          )}

          {/* 결과 테이블 */}
          {trackedData.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-4 bg-muted flex justify-between items-center">
                <span className="font-medium">
                  대출금 사용 내역 (총 {trackedData.length}건)
                </span>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
              </div>
              
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackedData.map((item, idx) => (
                      <TableRow key={idx} className={item.type === "대출실행" ? "bg-blue-50" : ""}>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>
                          <span className={
                            item.type === "대출실행" ? "font-bold text-blue-600" :
                            item.type === "이체" ? "text-amber-600" :
                            "text-red-600"
                          }>
                            {item.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.amount.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right">
                          {item.balance.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-sm">{item.memo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
