/**
 * 금액 이상 입출금건 필터 모달
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
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

  const handleFilter = () => {
    setIsFiltering(true);
    
    const threshold = parseFloat(minAmount.replace(/,/g, "")) || 0;
    
    const filtered = transactions.filter(tx => {
      const deposit = Number(tx.depositAmount) || 0;
      const withdrawal = Number(tx.withdrawalAmount) || 0;
      return deposit >= threshold || withdrawal >= threshold;
    });
    
    setFilteredData(filtered);
    setIsFiltering(false);
  };

  const handleDownload = () => {
    if (filteredData.length === 0) return;

    // 엑셀 데이터 준비
    const excelData = filteredData.map(tx => ({
      "날짜": tx.date,
      "입금액": tx.depositAmount || "",
      "출금액": tx.withdrawalAmount || "",
      "잔액": tx.balance || "",
      "비고": tx.memo || "",
    }));

    // 워크북 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "필터링 결과");

    // 다운로드
    XLSX.writeFile(wb, `금액필터_${minAmount}원이상_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>금액 이상 입출금건 뽑기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 입력 */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>최소 금액 (원)</Label>
              <Input
                type="text"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1000000"
              />
            </div>
            <Button onClick={handleFilter} disabled={isFiltering}>
              {isFiltering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  필터링 중...
                </>
              ) : (
                "필터링"
              )}
            </Button>
          </div>

          {/* 결과 테이블 */}
          {filteredData.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-4 bg-muted flex justify-between items-center">
                <span className="font-medium">
                  총 {filteredData.length}건 (전체 {transactions.length}건 중)
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
                      <TableHead className="text-right">입금액</TableHead>
                      <TableHead className="text-right">출금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((tx, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {tx.depositAmount ? Number(tx.depositAmount).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {tx.withdrawalAmount ? Number(tx.withdrawalAmount).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.balance ? Number(tx.balance).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{tx.memo}</TableCell>
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
