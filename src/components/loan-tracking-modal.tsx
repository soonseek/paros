/**
 * 대출금 사용 소명자료 생성 모달 (서버 사이드 처리)
 * 
 * 대용량 데이터 처리를 위해 DB에서 직접 필터링 및 추적
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
import { api } from "~/utils/api";

interface LoanTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function LoanTrackingModal({ isOpen, onClose, caseId }: LoanTrackingModalProps) {
  const [keyword, setKeyword] = useState<string>("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  // 서버 사이드 쿼리
  const { data, isLoading, refetch, error } = api.transaction.trackLoanUsage.useQuery(
    { caseId, keyword },
    { 
      enabled: searchTriggered && keyword.length > 0,
      refetchOnWindowFocus: false,
    }
  );

  const handleTrack = async () => {
    if (!keyword.trim()) {
      return;
    }
    setSearchTriggered(true);
    await refetch();
  };

  const handleDownload = () => {
    if (!data || !data.found || data.trackedItems.length === 0) return;

    // 엑셀 데이터 준비
    const excelData = data.trackedItems.map(item => ({
      "날짜": formatDate(item.date),
      "구분": item.type,
      "금액": item.amount,
      "잔액": item.balance,
      "남은 대출금": item.remainingLoan,
      "비고": item.memo,
    }));

    // 요약 정보 추가
    if (data.summary) {
      excelData.push({
        "날짜": "",
        "구분": "-" as "대출실행" | "출금" | "이체",
        "금액": 0,
        "잔액": 0,
        "남은 대출금": 0,
        "비고": "",
      });
      excelData.push({
        "날짜": "=== 요약 ===",
        "구분": "-" as "대출실행" | "출금" | "이체",
        "금액": 0,
        "잔액": 0,
        "남은 대출금": 0,
        "비고": "",
      });
      excelData.push({
        "날짜": "대출금 총액",
        "구분": "-" as "대출실행" | "출금" | "이체",
        "금액": data.summary.loanAmount,
        "잔액": 0,
        "남은 대출금": 0,
        "비고": "",
      });
      excelData.push({
        "날짜": "사용 금액",
        "구분": "-" as "대출실행" | "출금" | "이체",
        "금액": data.summary.totalUsed,
        "잔액": 0,
        "남은 대출금": 0,
        "비고": "",
      });
      excelData.push({
        "날짜": "사용 건수",
        "구분": "-" as "대출실행" | "출금" | "이체",
        "금액": data.summary.usageCount,
        "잔액": 0,
        "남은 대출금": 0,
        "비고": "",
      });
    }

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

  // 모달 닫을 때 상태 초기화
  const handleClose = () => {
    setSearchTriggered(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setSearchTriggered(false); // 입력 변경 시 검색 리셋
                }}
                placeholder="예: 주택담보대출, 신용대출, 마이너스통장"
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                비고에 이 키워드가 포함된 입금 거래를 대출 실행건으로 간주하고, 이후 출금 내역을 추적합니다 (서버에서 처리)
              </p>
            </div>
            <Button onClick={handleTrack} disabled={isLoading || !keyword.trim()}>
              {isLoading ? (
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

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg flex-shrink-0 text-red-600">
              <p>오류: {error.message}</p>
            </div>
          )}

          {/* 대출금 못 찾음 */}
          {searchTriggered && !isLoading && data && !data.found && (
            <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg flex-shrink-0">
              <p className="text-yellow-700 dark:text-yellow-300">{data.message}</p>
            </div>
          )}

          {/* 대출금 정보 요약 */}
          {data && data.found && data.summary && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg flex-shrink-0">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">대출금 총액</p>
                  <p className="text-xl font-bold text-blue-600">{data.summary.loanAmount.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사용 금액</p>
                  <p className="text-xl font-bold text-red-600">{data.summary.totalUsed.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사용 건수</p>
                  <p className="text-xl font-bold">{data.summary.usageCount}건</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">잔여 대출금</p>
                  <p className="text-xl font-bold text-green-600">{data.summary.remainingLoan.toLocaleString()}원</p>
                </div>
              </div>
            </div>
          )}

          {/* 결과 테이블 */}
          {data && data.found && data.trackedItems.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium">
                  대출금 사용 추적 내역 (총 {data.trackedItems.length}건)
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
                    {data.trackedItems.map((item, idx) => (
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
                            {item.type !== "대출실행" && <ChevronRight className="h-3 w-3" />}
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
          {!searchTriggered && !isLoading && (
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
          <Button variant="outline" onClick={handleClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
