/**
 * 금액 이상 입출금건 필터 모달
 * 
 * 기능:
 * 1. 지정 금액 이상의 입출금 거래 필터링
 * 2. 날짜, 금액, 비고 표시
 * 3. 엑셀 다운로드
 */

import { useState } from "react";
import { Download, Loader2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import * as XLSX from "xlsx";
import type { SimplifiedTransaction } from "./simplified-transaction-table";

interface AmountFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  transactions: SimplifiedTransaction[];
}

export function AmountFilterModal({ isOpen, onClose, transactions }: AmountFilterModalProps) {
  const [minAmount, setMinAmount] = useState<string>("1000000");
  const [filteredData, setFilteredData] = useState<SimplifiedTransaction[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [depositCount, setDepositCount] = useState(0);
  const [withdrawalCount, setWithdrawalCount] = useState(0);

  const handleFilter = () => {
    setIsFiltering(true);
    
    const threshold = parseFloat(minAmount.replace(/,/g, "")) || 0;
    
    const filtered = transactions.filter(tx => tx.amount >= threshold);
    
    // 정렬: 날짜순 (오름차순)
    const sorted = [...filtered].sort((a, b) => 
      new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );
    
    // 입금/출금 건수 계산
    setDepositCount(sorted.filter(tx => tx.type === "입금").length);
    setWithdrawalCount(sorted.filter(tx => tx.type === "출금").length);
    
    setFilteredData(sorted);
    setIsFiltering(false);
  };

  const handleDownload = () => {
    if (filteredData.length === 0) return;

    const threshold = parseFloat(minAmount.replace(/,/g, "")) || 0;

    // 엑셀 데이터 준비
    const excelData = filteredData.map(tx => ({
      "날짜": formatDate(tx.transactionDate),
      "구분": tx.type,
      "금액": tx.amount,
      "잔액": tx.balance,
      "비고": tx.memo || "",
      "문서명": tx.documentName || "",
    }));

    // 요약 정보 추가
    excelData.push({} as typeof excelData[0]);
    excelData.push({
      "날짜": "=== 요약 ===",
      "구분": "",
      "금액": 0,
      "잔액": 0,
      "비고": "",
      "문서명": "",
    });
    excelData.push({
      "날짜": "필터 기준",
      "구분": "",
      "금액": threshold,
      "잔액": 0,
      "비고": "원 이상",
      "문서명": "",
    });
    excelData.push({
      "날짜": "입금 건수",
      "구분": "",
      "금액": depositCount,
      "잔액": 0,
      "비고": "",
      "문서명": "",
    });
    excelData.push({
      "날짜": "출금 건수",
      "구분": "",
      "금액": withdrawalCount,
      "잔액": 0,
      "비고": "",
      "문서명": "",
    });

    // 워크북 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "필터링 결과");

    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 12 }, // 날짜
      { wch: 8 },  // 구분
      { wch: 15 }, // 금액
      { wch: 15 }, // 잔액
      { wch: 40 }, // 비고
      { wch: 20 }, // 문서명
    ];

    // 다운로드
    XLSX.writeFile(wb, `금액필터_${threshold.toLocaleString()}원이상_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  const formatNumber = (value: string) => {
    const num = parseInt(value.replace(/,/g, ""), 10);
    if (isNaN(num)) return value;
    return num.toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] flex flex-col" data-testid="amount-filter-modal">
        <DialogHeader>
          <DialogTitle className="text-lg">금액 이상 입출금건 뽑기</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 입력 영역 */}
          <div className="flex gap-4 items-end flex-shrink-0">
            <div className="flex-1">
              <Label>최소 금액 (원)</Label>
              <Input
                type="text"
                value={formatNumber(minAmount)}
                onChange={(e) => setMinAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1,000,000"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                입력한 금액 이상의 모든 입금/출금 거래를 검색합니다
              </p>
            </div>
            <Button onClick={handleFilter} disabled={isFiltering}>
              {isFiltering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  필터링 중...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4 mr-2" />
                  필터링
                </>
              )}
            </Button>
          </div>

          {/* 결과 요약 */}
          {filteredData.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">전체 건수</p>
                  <p className="text-xl font-bold">{filteredData.length}건</p>
                  <p className="text-xs text-muted-foreground">/ 총 {transactions.length}건 중</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">입금</p>
                  <p className="text-xl font-bold text-green-600">{depositCount}건</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">출금</p>
                  <p className="text-xl font-bold text-red-600">{withdrawalCount}건</p>
                </div>
              </div>
            </div>
          )}

          {/* 결과 테이블 */}
          {filteredData.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium">
                  필터링 결과
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
                      <TableHead className="text-right w-[150px]">금액</TableHead>
                      <TableHead className="text-right w-[150px]">잔액</TableHead>
                      <TableHead>비고</TableHead>
                      <TableHead className="w-[120px]">문서</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((tx, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(tx.transactionDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "입금" ? "default" : "destructive"} className="text-xs">
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${
                          tx.type === "입금" ? "text-green-600" : "text-red-600"
                        }`}>
                          {tx.type === "입금" ? "+" : "-"}
                          {tx.amount.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.balance.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate" title={tx.memo}>
                          {tx.memo || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate" title={tx.documentName}>
                          {tx.documentName || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* 빈 상태 */}
          {filteredData.length === 0 && !isFiltering && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>금액을 입력하고 필터링을 시작하세요</p>
                <p className="text-sm">지정 금액 이상의 모든 거래를 검색합니다</p>
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
