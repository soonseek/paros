import { Download, Loader2, Network, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import * as XLSX from "xlsx";
import { api } from "~/utils/api";

interface InternalTransferLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function InternalTransferLinkModal({ isOpen, onClose, caseId }: InternalTransferLinkModalProps) {
  const { data, isLoading, refetch } = api.transaction.detectInternalTransfers.useQuery(
    { caseId },
    {
      enabled: isOpen,
      refetchOnWindowFocus: false,
    },
  );

  const handleDownload = () => {
    if (!data || data.matches.length === 0) return;

    const excelData = data.matches.map((match, idx) => ({
      순번: idx + 1,
      출금일시: formatDateTime(match.withdrawalDate),
      입금일시: formatDateTime(match.depositDate),
      출발문서: match.fromDocumentName,
      도착문서: match.toDocumentName,
      금액: match.amount,
      신뢰도: `${Math.round(match.confidence * 100)}%`,
      매칭근거: match.matchReason,
      출금비고: match.withdrawalMemo,
      입금비고: match.depositMemo,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "내부이체연결");
    ws["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 10 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
    ];

    XLSX.writeFile(wb, `내부이체연결_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString("ko-KR");
    } catch {
      return value;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] flex flex-col" data-testid="internal-transfer-link-modal">
        <DialogHeader>
          <DialogTitle data-testid="internal-transfer-link-modal-title">내부 계좌이체 연결</DialogTitle>
          <DialogDescription data-testid="internal-transfer-link-modal-description">
            사건 내 여러 문서 사이에서 같은 금액의 입출금을 찾아 내부 이체 후보를 연결합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => void refetch()} disabled={isLoading} data-testid="internal-transfer-refresh-button">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              다시 탐색
            </Button>
            <Button onClick={handleDownload} disabled={!data || data.matches.length === 0} data-testid="internal-transfer-download-button">
              <Download className="h-4 w-4 mr-2" />엑셀 다운로드
            </Button>
          </div>

          {isLoading && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="internal-transfer-loading-state">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
                <p>내부 이체 후보를 찾는 중입니다...</p>
              </div>
            </div>
          )}

          {!isLoading && data && data.matches.length > 0 && (
            <>
              <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0" data-testid="internal-transfer-summary-card">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div data-testid="internal-transfer-total-count">
                    <p className="text-sm text-muted-foreground">연결 건수</p>
                    <p className="text-xl font-bold">{data.summary.total.toLocaleString()}건</p>
                  </div>
                  <div data-testid="internal-transfer-total-amount">
                    <p className="text-sm text-muted-foreground">총 연결 금액</p>
                    <p className="text-lg font-bold">{data.summary.totalAmount.toLocaleString()}원</p>
                  </div>
                  <div data-testid="internal-transfer-same-day-count">
                    <p className="text-sm text-muted-foreground">당일 연결</p>
                    <p className="text-lg font-bold text-blue-600">{data.summary.sameDayCount.toLocaleString()}건</p>
                  </div>
                  <div data-testid="internal-transfer-document-pair-count">
                    <p className="text-sm text-muted-foreground">문서 쌍</p>
                    <p className="text-lg font-bold">{data.summary.documentPairCount.toLocaleString()}개</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg flex-1 overflow-hidden" data-testid="internal-transfer-results-panel">
                <ScrollArea className="h-full">
                  <Table data-testid="internal-transfer-results-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>출금일시</TableHead>
                        <TableHead>입금일시</TableHead>
                        <TableHead>출발 문서</TableHead>
                        <TableHead>도착 문서</TableHead>
                        <TableHead className="text-right">금액</TableHead>
                        <TableHead>신뢰도</TableHead>
                        <TableHead>매칭 근거</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.matches.map((match) => (
                        <TableRow key={`${match.withdrawalTransactionId}-${match.depositTransactionId}`} data-testid={`internal-transfer-row-${match.withdrawalTransactionId}`}>
                          <TableCell className="font-mono text-sm">{formatDateTime(match.withdrawalDate)}</TableCell>
                          <TableCell className="font-mono text-sm">{formatDateTime(match.depositDate)}</TableCell>
                          <TableCell>{match.fromDocumentName}</TableCell>
                          <TableCell>{match.toDocumentName}</TableCell>
                          <TableCell className="text-right font-mono">{match.amount.toLocaleString()}원</TableCell>
                          <TableCell>
                            <Badge variant="outline">{Math.round(match.confidence * 100)}%</Badge>
                          </TableCell>
                          <TableCell>{match.matchReason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}

          {!isLoading && data?.matches.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="internal-transfer-empty-state">
              <div className="text-center">
                <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>연결된 내부 이체 후보가 없습니다</p>
                <p className="text-sm">같은 금액의 문서 간 입출금이 있을 때 자동으로 표시됩니다</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="internal-transfer-close-button">닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}