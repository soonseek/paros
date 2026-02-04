/**
 * 금액 이상 입출금건 필터 모달 (서버 사이드 처리)
 * 
 * 대용량 데이터 처리를 위해 DB에서 직접 필터링
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
import { api } from "~/utils/api";

interface AmountFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function AmountFilterModal({ isOpen, onClose, caseId }: AmountFilterModalProps) {
  const [minAmount, setMinAmount] = useState<string>("1000000");
  const [searchTriggered, setSearchTriggered] = useState(false);

  // 서버 사이드 쿼리
  const threshold = parseFloat(minAmount.replace(/,/g, "")) || 0;
  const { data, isLoading, refetch } = api.transaction.filterByAmount.useQuery(
    { caseId, minAmount: threshold },
    { 
      enabled: searchTriggered && threshold > 0,
      refetchOnWindowFocus: false,
    }
  );

  const handleFilter = async () => {
    setSearchTriggered(true);
    await refetch();
  };

  const handleDownload = () => {
    if (!data || data.transactions.length === 0) return;

    // 전체 내역만 포함 (요약 없음)
    const excelData = data.transactions.map((tx, idx) => ({
      "순번": idx + 1,
      "날짜": formatDate(tx.transactionDate),
      "구분": tx.type,
      "금액": tx.amount,
      "잔액": tx.balance,
      "비고": tx.memo || "",
      "문서명": tx.documentName || "",
    }));

    // 워크북 생성
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "필터링 결과");

    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 6 },  // 순번
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

  // 모달 닫을 때 상태 초기화
  const handleClose = () => {
    setSearchTriggered(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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
                onChange={(e) => {
                  setMinAmount(e.target.value.replace(/[^0-9]/g, ""));
                  setSearchTriggered(false); // 입력 변경 시 검색 리셋
                }}
                placeholder="1,000,000"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                입력한 금액 이상의 모든 입금/출금 거래를 검색합니다 (서버에서 처리)
              </p>
            </div>
            <Button onClick={handleFilter} disabled={isLoading || threshold <= 0}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  검색 중...
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
          {data && data.transactions.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">검색 결과</p>
                  <p className="text-xl font-bold">{data.summary.total.toLocaleString()}건</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">입금</p>
                  <p className="text-xl font-bold text-green-600">{data.summary.depositCount.toLocaleString()}건</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">출금</p>
                  <p className="text-xl font-bold text-red-600">{data.summary.withdrawalCount.toLocaleString()}건</p>
                </div>
              </div>
            </div>
          )}

          {/* 결과 테이블 */}
          {data && data.transactions.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium">
                  필터링 결과 (샘플 {Math.min(10, data.transactions.length)}건 / 전체 {data.summary.total}건)
                </span>
                <Button size="sm" onClick={handleDownload} data-testid="amount-filter-download-btn">
                  <Download className="h-4 w-4 mr-2" />
                  전체 엑셀 다운로드
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">순번</TableHead>
                      <TableHead className="w-[100px]">날짜</TableHead>
                      <TableHead className="w-[80px]">구분</TableHead>
                      <TableHead className="text-right w-[130px]">금액</TableHead>
                      <TableHead className="text-right w-[130px]">잔액</TableHead>
                      <TableHead>비고</TableHead>
                      <TableHead className="w-[120px]">문서</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.slice(0, 10).map((tx, idx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {idx + 1}
                        </TableCell>
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
                        <TableCell className="text-sm max-w-[200px] truncate" title={tx.memo}>
                          {tx.memo || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate" title={tx.documentName}>
                          {tx.documentName || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.transactions.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-2">
                            +{data.transactions.length - 10}건 더 있음
                          </p>
                          <Button size="sm" variant="outline" onClick={handleDownload} data-testid="amount-filter-download-btn-bottom">
                            <Download className="h-4 w-4 mr-2" />
                            전체 {data.transactions.length}건 엑셀 다운로드
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* 결과 없음 */}
          {searchTriggered && !isLoading && data && data.transactions.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>조건에 맞는 거래가 없습니다</p>
                <p className="text-sm">다른 금액으로 검색해보세요</p>
              </div>
            </div>
          )}

          {/* 빈 상태 */}
          {!searchTriggered && !isLoading && (
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
          <Button variant="outline" onClick={handleClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
