/**
 * 대출금 사용 소명자료 생성 모달
 * 
 * 기능:
 * 1. 키워드로 대출 입금건 검색
 * 2. 해당 대출금이 어떻게 사용되었는지 추적
 * 3. 엑셀 다운로드
 */

import { useState } from "react";
import { Download, Loader2, Search, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
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
  depth: number; // 추적 깊이 (0=대출, 1=직접 사용)
  remainingLoan: number; // 남은 대출금
}

export function LoanTrackingModal({ isOpen, onClose, transactions }: LoanTrackingModalProps) {
  const [keyword, setKeyword] = useState<string>("");
  const [trackedData, setTrackedData] = useState<TrackedItem[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [totalUsed, setTotalUsed] = useState<number>(0);

  const handleTrack = () => {
    setIsTracking(true);
    
    try {
      // 1단계: 대출 실행건 찾기 (키워드 포함된 입금)
      const loanDeposit = transactions.find(tx => {
        const memo = (tx.memo || "").toLowerCase();
        const searchKey = keyword.toLowerCase();
        
        return tx.type === "입금" && memo.includes(searchKey);
      });

      if (!loanDeposit) {
        alert(`"${keyword}" 키워드를 포함한 입금 거래를 찾을 수 없습니다.`);
        setIsTracking(false);
        return;
      }

      const loanAmountValue = tx.amount;
      setLoanAmount(loanAmountValue);
      
      const tracked: TrackedItem[] = [];
      let remainingLoan = loanAmountValue;
      
      // 대출 실행건 추가
      tracked.push({
        date: loanDeposit.transactionDate,
        type: "대출실행",
        amount: loanAmountValue,
        balance: loanDeposit.balance,
        memo: loanDeposit.memo || "",
        depth: 0,
        remainingLoan: remainingLoan,
      });

      // 2단계: 대출 실행 이후의 출금 거래 추적
      const loanDate = new Date(loanDeposit.transactionDate);
      
      // 날짜순 정렬 (오름차순)
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      
      // 대출 실행 이후의 출금만 추적
      for (const tx of sortedTransactions) {
        const txDate = new Date(tx.transactionDate);
        
        // 대출일 이전 거래는 스킵
        if (txDate < loanDate) continue;
        
        // 대출 실행건 자체는 스킵
        if (tx.id === loanDeposit.id) continue;
        
        // 출금 거래만 추적
        if (tx.type === "출금") {
          const memo = tx.memo || "";
          const isTransfer = memo.includes("이체") || memo.includes("송금") || memo.includes("振込");
          
          remainingLoan -= tx.amount;
          
          tracked.push({
            date: tx.transactionDate,
            type: isTransfer ? "이체" : "출금",
            amount: tx.amount,
            balance: tx.balance,
            memo,
            depth: 1,
            remainingLoan: Math.max(0, remainingLoan),
          });
          
          // 대출금 전액 사용 시 추적 종료
          if (remainingLoan <= 0) break;
        }
      }
      
      setTrackedData(tracked);
      setTotalUsed(loanAmountValue - Math.max(0, remainingLoan));
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
      "남은 대출금": item.remainingLoan,
      "비고": item.memo,
    }));

    // 요약 정보 추가
    excelData.push({} as typeof excelData[0]); // 빈 행
    excelData.push({
      "날짜": "=== 요약 ===",
      "구분": "",
      "금액": 0,
      "잔액": 0,
      "남은 대출금": 0,
      "비고": "",
    });
    excelData.push({
      "날짜": "대출금 총액",
      "구분": "",
      "금액": loanAmount,
      "잔액": 0,
      "남은 대출금": 0,
      "비고": "",
    });
    excelData.push({
      "날짜": "사용 금액",
      "구분": "",
      "금액": totalUsed,
      "잔액": 0,
      "남은 대출금": 0,
      "비고": "",
    });
    excelData.push({
      "날짜": "사용 건수",
      "구분": "",
      "금액": trackedData.length - 1,
      "잔액": 0,
      "남은 대출금": 0,
      "비고": "",
    });

    // 워크북 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "대출금 사용 내역");

    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 12 }, // 날짜
      { wch: 10 }, // 구분
      { wch: 15 }, // 금액
      { wch: 15 }, // 잔액
      { wch: 15 }, // 남은 대출금
      { wch: 40 }, // 비고
    ];

    // 다운로드
    XLSX.writeFile(wb, `대출금사용내역_${keyword}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] flex flex-col" data-testid="loan-tracking-modal">
        <DialogHeader>
          <DialogTitle className="text-lg">대출금 사용 소명자료 생성</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 입력 영역 */}
          <div className="flex gap-4 items-end flex-shrink-0">
            <div className="flex-1">
              <Label>대출건 검색 키워드</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 주택담보대출, 신용대출, 마이너스통장"
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                비고에 이 키워드가 포함된 입금 거래를 대출 실행건으로 간주하고, 이후 출금 내역을 추적합니다
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

          {/* 대출금 정보 요약 */}
          {loanAmount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">대출금 총액</p>
                  <p className="text-xl font-bold text-blue-600">{loanAmount.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사용 금액</p>
                  <p className="text-xl font-bold text-red-600">{totalUsed.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사용 건수</p>
                  <p className="text-xl font-bold">{trackedData.length - 1}건</p>
                </div>
              </div>
            </div>
          )}

          {/* 결과 테이블 */}
          {trackedData.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium">
                  대출금 사용 추적 내역 (총 {trackedData.length}건)
                </span>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">날짜</TableHead>
                      <TableHead className="w-[80px]">구분</TableHead>
                      <TableHead className="text-right w-[130px]">금액</TableHead>
                      <TableHead className="text-right w-[130px]">잔액</TableHead>
                      <TableHead className="text-right w-[130px]">남은 대출금</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackedData.map((item, idx) => (
                      <TableRow 
                        key={idx} 
                        className={item.type === "대출실행" ? "bg-blue-50 dark:bg-blue-950" : ""}
                      >
                        <TableCell className="font-mono text-sm">
                          {formatDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 ${
                            item.type === "대출실행" ? "font-bold text-blue-600" :
                            item.type === "이체" ? "text-amber-600" :
                            "text-red-600"
                          }`}>
                            {item.depth > 0 && <ChevronRight className="h-3 w-3" />}
                            {item.type}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${
                          item.type === "대출실행" ? "text-blue-600" : "text-red-600"
                        }`}>
                          {item.type === "대출실행" ? "+" : "-"}
                          {item.amount.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.balance.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {item.remainingLoan.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate" title={item.memo}>
                          {item.memo || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* 빈 상태 */}
          {trackedData.length === 0 && !isTracking && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>키워드를 입력하고 추적을 시작하세요</p>
                <p className="text-sm">대출 입금건을 찾아 이후 출금 내역을 자동으로 추적합니다</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
