import { Fragment, useMemo, useState } from "react";
import { Download, Filter, Loader2, UserRoundSearch } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import * as XLSX from "xlsx";
import { api } from "~/utils/api";

interface CounterpartyFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  documentId?: string | null;
}

export function CounterpartyFilterModal({
  isOpen,
  onClose,
  caseId,
  documentId,
}: CounterpartyFilterModalProps) {
  const [query, setQuery] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const trimmedQuery = query.trim();
  const { data, isLoading, refetch } = api.transaction.filterByCounterparty.useQuery(
    {
      caseId,
      query: trimmedQuery || "-",
      ...(documentId ? { documentId } : {}),
    },
    {
      enabled: searchTriggered && trimmedQuery.length > 0,
      refetchOnWindowFocus: false,
    },
  );

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

  const handleSearch = async () => {
    if (!trimmedQuery) return;
    setSearchTriggered(true);
    await refetch();
  };

  const handleDownload = () => {
    if (!data || data.transactions.length === 0) return;

    const excelData = data.transactions.map((tx, idx) => ({
      순번: idx + 1,
      문서명: tx.documentName || "",
      날짜: formatDate(tx.transactionDate),
      구분: tx.type,
      금액: tx.amount,
      잔액: tx.balance,
      비고: tx.memo || "",
      채권자명: tx.creditorName || "",
      일치위치: tx.matchedFields.join(", "),
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "인물별 거래");
    ws["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 12 },
      { wch: 8 },
      { wch: 15 },
      { wch: 15 },
      { wch: 32 },
      { wch: 20 },
      { wch: 18 },
    ];

    XLSX.writeFile(wb, `인물거래_${trimmedQuery}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
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

  const handleClose = () => {
    setSearchTriggered(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] flex flex-col" data-testid="counterparty-filter-modal">
        <DialogHeader>
          <DialogTitle data-testid="counterparty-filter-modal-title">특정 인물 거래 찾기</DialogTitle>
          <DialogDescription data-testid="counterparty-filter-modal-description">
            이름 또는 계좌번호로 관련 거래를 모아 보고 엑셀로 내보냅니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex gap-4 items-end flex-shrink-0">
            <div className="flex-1">
              <Label data-testid="counterparty-filter-input-label">이름 또는 계좌번호</Label>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchTriggered(false);
                }}
                placeholder="예: 홍길동, 110-123-456789"
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                data-testid="counterparty-filter-input"
              />
              <p className="text-xs text-muted-foreground mt-1" data-testid="counterparty-filter-help-text">
                비고, 채권자명, 원본 업로드 데이터에서 함께 검색합니다.
                {documentId ? " 현재 선택한 파일 범위로 검색 중입니다." : " 사건 전체 파일을 대상으로 검색합니다."}
              </p>
            </div>
            <Button
              onClick={() => void handleSearch()}
              disabled={isLoading || trimmedQuery.length === 0}
              data-testid="counterparty-filter-search-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />검색 중...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4 mr-2" />검색
                </>
              )}
            </Button>
          </div>

          {data && data.transactions.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0" data-testid="counterparty-filter-summary-card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div data-testid="counterparty-filter-total-count">
                  <p className="text-sm text-muted-foreground">검색 결과</p>
                  <p className="text-xl font-bold">{data.summary.total.toLocaleString()}건</p>
                </div>
                <div data-testid="counterparty-filter-deposit-total">
                  <p className="text-sm text-muted-foreground">입금 합계</p>
                  <p className="text-lg font-bold text-blue-600">{data.summary.depositTotal.toLocaleString()}원</p>
                </div>
                <div data-testid="counterparty-filter-withdrawal-total">
                  <p className="text-sm text-muted-foreground">출금 합계</p>
                  <p className="text-lg font-bold text-red-600">{data.summary.withdrawalTotal.toLocaleString()}원</p>
                </div>
                <div data-testid="counterparty-filter-document-group-count">
                  <p className="text-sm text-muted-foreground">문서 그룹</p>
                  <p className="text-xl font-bold">{groupedByDocument.length.toLocaleString()}개</p>
                </div>
              </div>
            </div>
          )}

          {data && data.transactions.length > 0 && (
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden" data-testid="counterparty-filter-results-panel">
              <div className="p-3 bg-muted flex justify-between items-center flex-shrink-0">
                <span className="font-medium text-sm" data-testid="counterparty-filter-results-caption">
                  문서별 정렬 | {groupedByDocument.length}개 문서 | 전체 {data.summary.total}건
                </span>
                <Button size="sm" onClick={handleDownload} data-testid="counterparty-filter-download-button">
                  <Download className="h-4 w-4 mr-2" />엑셀 다운로드
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <Table data-testid="counterparty-filter-results-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">순번</TableHead>
                      <TableHead className="w-[110px]">날짜</TableHead>
                      <TableHead className="w-[80px]">구분</TableHead>
                      <TableHead className="text-right w-[130px]">금액</TableHead>
                      <TableHead className="text-right w-[130px]">잔액</TableHead>
                      <TableHead>비고</TableHead>
                      <TableHead className="w-[180px]">일치 위치</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByDocument.map((group) => {
                      let globalIdx = 0;
                      for (const previousGroup of groupedByDocument) {
                        if (previousGroup === group) break;
                        globalIdx += previousGroup.transactions.length;
                      }

                      return (
                        <Fragment key={group.documentName}>
                          <TableRow className="bg-slate-100 dark:bg-slate-800 border-t-2" data-testid={`counterparty-filter-document-group-${globalIdx}`}>
                            <TableCell colSpan={7} className="py-2 font-semibold text-sm">
                              {group.documentName || "(문서명 없음)"}
                              <span className="ml-2 text-muted-foreground font-normal">
                                ({group.transactions.length}건)
                              </span>
                            </TableCell>
                          </TableRow>
                          {group.transactions.map((tx, idx) => (
                            <TableRow key={tx.id} data-testid={`counterparty-filter-row-${tx.id}`}>
                              <TableCell className="font-mono text-sm text-muted-foreground">{globalIdx + idx + 1}</TableCell>
                              <TableCell className="font-mono text-sm">{formatDate(tx.transactionDate)}</TableCell>
                              <TableCell>
                                <Badge variant={tx.type === "입금" ? "default" : "destructive"}>
                                  {tx.type}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-mono ${tx.type === "입금" ? "text-blue-600" : "text-red-600"}`}>
                                {tx.amount.toLocaleString()}원
                              </TableCell>
                              <TableCell className="text-right font-mono">{tx.balance.toLocaleString()}원</TableCell>
                              <TableCell className="text-sm max-w-[260px] truncate" title={tx.memo}>{tx.memo || "-"}</TableCell>
                              <TableCell data-testid={`counterparty-filter-row-match-${tx.id}`}>
                                <div className="flex flex-wrap gap-1">
                                  {tx.matchedFields.map((field) => (
                                    <Badge key={`${tx.id}-${field}`} variant="outline" className="text-xs">
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
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

          {searchTriggered && !isLoading && data?.transactions.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="counterparty-filter-empty-results">
              <div className="text-center">
                <UserRoundSearch className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>일치하는 거래가 없습니다</p>
                <p className="text-sm">이름 철자나 계좌번호를 다시 확인해보세요</p>
              </div>
            </div>
          )}

          {!searchTriggered && !isLoading && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="counterparty-filter-idle-state">
              <div className="text-center">
                <UserRoundSearch className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>이름 또는 계좌번호를 입력하고 검색을 시작하세요</p>
                <p className="text-sm">특정 인물과 관련된 거래만 모아볼 수 있습니다</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="counterparty-filter-close-button">닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}