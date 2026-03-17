/**
 * 금액 이상 입출금건 필터 모달 (서버 사이드 처리)
 * 
 * - 문서별 → 일자별 정렬
 * - 표시 모드: 구분+금액 / 입금·출금 분리
 * - 엑셀 다운로드
 */

import { useState, useMemo, Fragment } from "react";
import { Download, Loader2, Filter, ToggleLeft, ToggleRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import * as XLSX from "xlsx";
import { api } from "~/utils/api";

type DisplayMode = "type" | "split"; // type: 구분+금액, split: 입금/출금 분리

interface AmountFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function AmountFilterModal({ isOpen, onClose, caseId }: AmountFilterModalProps) {
  const [minAmount, setMinAmount] = useState<string>("1000000");
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("split");

  // 서버 사이드 쿼리
  const threshold = parseFloat(minAmount.replace(/,/g, "")) || 0;
  const { data, isLoading, refetch } = api.transaction.filterByAmount.useQuery(
    { caseId, minAmount: threshold },
    { 
      enabled: searchTriggered && threshold > 0,
      refetchOnWindowFocus: false,
    }
  );

  // 문서별 그룹핑 (표시용)
  const groupedByDocument = useMemo(() => {
    if (!data?.transactions) return [];
    const groups: { documentName: string; transactions: typeof data.transactions }[] = [];
    let currentDoc = "";
    let currentGroup: typeof data.transactions = [];

    for (const tx of data.transactions) {
      if (tx.documentName !== currentDoc) {
        if (currentGroup.length > 0) {
          groups.push({ documentName: currentDoc, transactions: currentGroup });
        }
        currentDoc = tx.documentName;
        currentGroup = [];
      }
      currentGroup.push(tx);
    }
    if (currentGroup.length > 0) {
      groups.push({ documentName: currentDoc, transactions: currentGroup });
    }
    return groups;
  }, [data]);

  const handleFilter = async () => {
    setSearchTriggered(true);
    await refetch();
  };

  const handleDownload = () => {
    if (!data || data.transactions.length === 0) return;

    const excelData = data.transactions.map((tx, idx) => {
      if (displayMode === "split") {
        return {
          "순번": idx + 1,
          "문서명": tx.documentName || "",
          "날짜": formatDate(tx.transactionDate),
          "입금": tx.depositAmount || "",
          "출금": tx.withdrawalAmount || "",
          "잔액": tx.balance,
          "비고": tx.memo || "",
        };
      }
      return {
        "순번": idx + 1,
        "문서명": tx.documentName || "",
        "날짜": formatDate(tx.transactionDate),
        "구분": tx.type,
        "금액": tx.amount,
        "잔액": tx.balance,
        "비고": tx.memo || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "필터링 결과");

    ws["!cols"] = displayMode === "split"
      ? [
          { wch: 6 },  // 순번
          { wch: 20 }, // 문서명
          { wch: 12 }, // 날짜
          { wch: 15 }, // 입금
          { wch: 15 }, // 출금
          { wch: 15 }, // 잔액
          { wch: 40 }, // 비고
        ]
      : [
          { wch: 6 },  // 순번
          { wch: 20 }, // 문서명
          { wch: 12 }, // 날짜
          { wch: 8 },  // 구분
          { wch: 15 }, // 금액
          { wch: 15 }, // 잔액
          { wch: 40 }, // 비고
        ];

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

  const handleClose = () => {
    setSearchTriggered(false);
    onClose();
  };

  const colCount = displayMode === "split" ? 7 : 7;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] flex flex-col" data-testid="amount-filter-modal">
        <DialogHeader>
          <DialogTitle className="text-lg">금액 이상 입출금건 뽑기</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 입력 + 모드 토글 */}
          <div className="flex gap-4 items-end flex-shrink-0">
            <div className="flex-1">
              <Label>최소 금액 (원)</Label>
              <Input
                type="text"
                value={formatNumber(minAmount)}
                onChange={(e) => {
                  setMinAmount(e.target.value.replace(/[^0-9]/g, ""));
                  setSearchTriggered(false);
                }}
                placeholder="1,000,000"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
                data-testid="amount-filter-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                입력한 금액 이상의 모든 입금/출금 거래를 검색합니다
              </p>
            </div>
            <Button onClick={handleFilter} disabled={isLoading || threshold <= 0} data-testid="amount-filter-btn">
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

          {/* 결과 요약 + 표시 모드 토글 */}
          {data && data.transactions.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0">
              <div className="flex justify-between items-start">
                <div className="grid grid-cols-3 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-muted-foreground">검색 결과</p>
                    <p className="text-xl font-bold">{data.summary.total.toLocaleString()}건</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">입금</p>
                    <p className="text-xl font-bold text-blue-600">{data.summary.depositCount.toLocaleString()}건</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">출금</p>
                    <p className="text-xl font-bold text-red-600">{data.summary.withdrawalCount.toLocaleString()}건</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayMode(displayMode === "type" ? "split" : "type")}
                  className="ml-4 whitespace-nowrap"
                  data-testid="display-mode-toggle"
                >
                  {displayMode === "type" ? (
                    <>
                      <ToggleLeft className="h-4 w-4 mr-1.5" />
                      구분+금액
                    </>
                  ) : (
                    <>
                      <ToggleRight className="h-4 w-4 mr-1.5" />
                      입금/출금 분리
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 결과 테이블 */}
          {data && data.transactions.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium text-sm">
                  문서별 정렬 | {groupedByDocument.length}개 문서 | 전체 {data.summary.total}건
                </span>
                <Button size="sm" onClick={handleDownload} data-testid="amount-filter-download-btn">
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] sticky top-0 bg-background z-10">순번</TableHead>
                      <TableHead className="w-[100px] sticky top-0 bg-background z-10">날짜</TableHead>
                      {displayMode === "type" ? (
                        <>
                          <TableHead className="w-[70px] sticky top-0 bg-background z-10">구분</TableHead>
                          <TableHead className="text-right w-[130px] sticky top-0 bg-background z-10">금액</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-right w-[130px] sticky top-0 bg-background z-10">입금</TableHead>
                          <TableHead className="text-right w-[130px] sticky top-0 bg-background z-10">출금</TableHead>
                        </>
                      )}
                      <TableHead className="text-right w-[130px] sticky top-0 bg-background z-10">잔액</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByDocument.map((group) => {
                      let globalIdx = 0;
                      // 이 그룹 이전까지의 거래 수를 계산
                      for (const g of groupedByDocument) {
                        if (g === group) break;
                        globalIdx += g.transactions.length;
                      }

                      return (
                        <Fragment key={group.documentName}>
                          {/* 문서 구분 헤더 행 */}
                          <TableRow className="bg-slate-100 dark:bg-slate-800 border-t-2">
                            <TableCell colSpan={colCount} className="py-2 font-semibold text-sm">
                              {group.documentName || "(문서명 없음)"} 
                              <span className="ml-2 text-muted-foreground font-normal">
                                ({group.transactions.length}건)
                              </span>
                            </TableCell>
                          </TableRow>
                          {group.transactions.map((tx, idx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                {globalIdx + idx + 1}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {formatDate(tx.transactionDate)}
                              </TableCell>
                              {displayMode === "type" ? (
                                <>
                                  <TableCell>
                                    <Badge variant={tx.type === "입금" ? "default" : "destructive"} className="text-xs">
                                      {tx.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={`text-right font-mono ${
                                    tx.type === "입금" ? "text-blue-600" : "text-red-600"
                                  }`}>
                                    {tx.amount.toLocaleString()}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right font-mono text-blue-600">
                                    {tx.depositAmount > 0 ? tx.depositAmount.toLocaleString() : ""}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-red-600">
                                    {tx.withdrawalAmount > 0 ? tx.withdrawalAmount.toLocaleString() : ""}
                                  </TableCell>
                                </>
                              )}
                              <TableCell className="text-right font-mono">
                                {tx.balance.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate" title={tx.memo}>
                                {tx.memo || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* 결과 없음 */}
          {searchTriggered && !isLoading && data?.transactions.length === 0 && (
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
                <p className="text-sm">문서별 → 일자별로 정렬된 결과를 확인할 수 있습니다</p>
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
