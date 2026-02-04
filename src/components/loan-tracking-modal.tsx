/**
 * 대출금 사용 소명자료 생성 모달 (개편)
 * 
 * 프로세스:
 * 1. 대출건 검색 방법 선택 (자동 추출 / 키워드 검색)
 * 2. 검색 결과에서 체크박스로 대출건 선택
 * 3. 추적 시작 → 각 대출건별 탭 UI + 개별 엑셀 다운로드
 */

import { useState, useMemo } from "react";
import { 
  Download, 
  Loader2, 
  Search, 
  Sparkles, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import * as XLSX from "xlsx";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface LoanTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

type Step = "select-method" | "search-results" | "tracking-results";
type SearchMethod = "auto" | "keyword";

interface SelectedLoan {
  id: string;
  date: string;
  amount: number;
  memo: string;
  documentName: string | null;
}

export function LoanTrackingModal({ isOpen, onClose, caseId }: LoanTrackingModalProps) {
  // Step 관리
  const [step, setStep] = useState<Step>("select-method");
  const [searchMethod, setSearchMethod] = useState<SearchMethod | null>(null);
  
  // 키워드 검색
  const [keyword, setKeyword] = useState("");
  const [keywordSearchTriggered, setKeywordSearchTriggered] = useState(false);
  
  // 선택된 대출건
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string>>(new Set());
  
  // 추적 실행 여부
  const [trackingTriggered, setTrackingTriggered] = useState(false);

  // API 쿼리
  const suspectedLoansQuery = api.transaction.getSuspectedLoanDeposits.useQuery(
    { caseId, minAmount: 1000000 },
    { enabled: searchMethod === "auto" && step === "search-results", refetchOnWindowFocus: false }
  );

  const keywordSearchQuery = api.transaction.searchLoanDeposits.useQuery(
    { caseId, keyword },
    { enabled: searchMethod === "keyword" && keywordSearchTriggered && keyword.length > 0, refetchOnWindowFocus: false }
  );

  // 선택된 대출건 ID 배열
  const selectedLoanIdsArray = useMemo(() => Array.from(selectedLoanIds), [selectedLoanIds]);

  const trackingQuery = api.transaction.trackMultipleLoans.useQuery(
    { caseId, loanIds: selectedLoanIdsArray },
    { enabled: trackingTriggered && selectedLoanIdsArray.length > 0, refetchOnWindowFocus: false }
  );

  // 현재 검색 결과 (방법에 따라)
  const searchResults = useMemo(() => {
    if (searchMethod === "auto") {
      return suspectedLoansQuery.data?.deposits || [];
    } else if (searchMethod === "keyword") {
      return keywordSearchQuery.data?.deposits || [];
    }
    return [];
  }, [searchMethod, suspectedLoansQuery.data, keywordSearchQuery.data]);

  const isSearchLoading = searchMethod === "auto" 
    ? suspectedLoansQuery.isLoading 
    : keywordSearchQuery.isLoading;

  // 체크박스 토글
  const toggleLoanSelection = (id: string) => {
    setSelectedLoanIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedLoanIds.size === searchResults.length) {
      setSelectedLoanIds(new Set());
    } else {
      setSelectedLoanIds(new Set(searchResults.map(d => d.id)));
    }
  };

  // Step 이동
  const handleSelectMethod = (method: SearchMethod) => {
    setSearchMethod(method);
    setStep("search-results");
    setSelectedLoanIds(new Set());
    if (method === "keyword") {
      setKeywordSearchTriggered(false);
    }
  };

  const handleKeywordSearch = () => {
    if (keyword.trim()) {
      setKeywordSearchTriggered(true);
    }
  };

  const handleStartTracking = () => {
    if (selectedLoanIds.size === 0) {
      toast.error("추적할 대출건을 선택해주세요");
      return;
    }
    setTrackingTriggered(true);
    setStep("tracking-results");
  };

  const handleBack = () => {
    if (step === "tracking-results") {
      setStep("search-results");
      setTrackingTriggered(false);
    } else if (step === "search-results") {
      setStep("select-method");
      setSearchMethod(null);
      setSelectedLoanIds(new Set());
    }
  };

  // 모달 닫기 시 초기화
  const handleClose = () => {
    setStep("select-method");
    setSearchMethod(null);
    setKeyword("");
    setKeywordSearchTriggered(false);
    setSelectedLoanIds(new Set());
    setTrackingTriggered(false);
    onClose();
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("ko-KR");
    } catch {
      return dateStr;
    }
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return amount.toLocaleString() + "원";
  };

  // 개별 탭 엑셀 다운로드
  const handleDownloadTab = (result: NonNullable<typeof trackingQuery.data>["results"][0]) => {
    const excelData = result.trackedItems.map((item, idx) => ({
      "순번": idx + 1,
      "날짜": formatDate(item.date),
      "구분": item.type,
      "금액": item.amount,
      "잔액": item.balance,
      "남은 대출금": item.remainingLoan,
      "비고": item.memo,
      "거래내역 파일": item.documentName || "-",
      "이동 대상 계좌": item.transferTo || "-",
    }));

    // 요약 추가
    excelData.push({
      "순번": 0,
      "날짜": "",
      "구분": "" as "대출실행" | "출금" | "이동",
      "금액": 0,
      "잔액": 0,
      "남은 대출금": 0,
      "비고": "",
      "거래내역 파일": "",
      "이동 대상 계좌": "",
    });
    excelData.push({
      "순번": 0,
      "날짜": "=== 요약 ===",
      "구분": "" as "대출실행" | "출금" | "이동",
      "금액": result.summary.loanAmount,
      "잔액": 0,
      "남은 대출금": result.summary.remainingLoan,
      "비고": `사용: ${result.summary.usageCount}건, 이동: ${result.summary.transferCount || 0}건`,
      "거래내역 파일": result.summary.exhausted ? "전액 소진" : "일부 잔여",
      "이동 대상 계좌": "",
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "대출금 사용 내역");

    ws["!cols"] = [
      { wch: 6 },  // 순번
      { wch: 12 }, // 날짜
      { wch: 10 }, // 구분
      { wch: 15 }, // 금액
      { wch: 15 }, // 잔액
      { wch: 15 }, // 남은 대출금
      { wch: 30 }, // 비고
      { wch: 25 }, // 거래내역 파일
      { wch: 25 }, // 이동 대상 계좌
    ];

    const loanDate = formatDate(result.loanDate).replace(/\./g, "-");
    XLSX.writeFile(wb, `대출금추적_${formatAmount(result.loanAmount)}_${loanDate}.xlsx`);
    toast.success("엑셀 파일이 다운로드되었습니다");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col" data-testid="loan-tracking-modal">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            대출금 사용 소명자료 생성
            {step !== "select-method" && (
              <Badge variant="outline" className="ml-2">
                {step === "search-results" ? "2단계: 대출건 선택" : "3단계: 추적 결과"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Step 1: 검색 방법 선택 */}
          {step === "select-method" && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <Card 
                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                  onClick={() => handleSelectMethod("auto")}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                      대출 의심 입금건 추적
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      AI가 대출로 의심되는 입금건을 자동으로 추출합니다.
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li>• 100만원 이상 큰 금액</li>
                      <li>• Round number (100만원 단위)</li>
                      <li>• "대출", "융자", "담보" 등 키워드</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                  onClick={() => handleSelectMethod("keyword")}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Search className="h-5 w-5 text-blue-500" />
                      대출금 입금건 비고 검색
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      키워드로 대출 실행건을 직접 검색합니다.
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li>• 비고(적요)에서 키워드 검색</li>
                      <li>• 예: "카카오", "주택담보", "신용대출"</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 2: 검색 결과 & 선택 */}
          {step === "search-results" && (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* 키워드 검색인 경우 입력창 */}
              {searchMethod === "keyword" && (
                <div className="flex gap-4 items-end flex-shrink-0 px-1">
                  <div className="flex-1">
                    <Label>검색 키워드</Label>
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="예: 카카오, 주택담보, 신용대출"
                      onKeyDown={(e) => e.key === "Enter" && handleKeywordSearch()}
                    />
                  </div>
                  <Button onClick={handleKeywordSearch} disabled={!keyword.trim()}>
                    <Search className="h-4 w-4 mr-2" />
                    검색
                  </Button>
                </div>
              )}

              {/* 로딩 */}
              {isSearchLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* 결과 테이블 */}
              {!isSearchLoading && searchResults.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-1 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedLoanIds.size === searchResults.length && searchResults.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">
                        전체 선택 ({selectedLoanIds.size}/{searchResults.length})
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {searchResults.length}건 발견 (신뢰도순 정렬)
                    </Badge>
                  </div>

                  <div className="flex-1 border rounded-lg min-h-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px] sticky top-0 bg-background z-10">선택</TableHead>
                          <TableHead className="w-[100px] sticky top-0 bg-background z-10">날짜</TableHead>
                          <TableHead className="w-[130px] text-right sticky top-0 bg-background z-10">금액</TableHead>
                          <TableHead className="sticky top-0 bg-background z-10">비고</TableHead>
                          <TableHead className="w-[150px] sticky top-0 bg-background z-10">파일명</TableHead>
                          {searchMethod === "auto" && (
                            <TableHead className="w-[100px] sticky top-0 bg-background z-10">신뢰도</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((deposit) => (
                          <TableRow 
                            key={deposit.id}
                            className={selectedLoanIds.has(deposit.id) ? "bg-primary/5" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedLoanIds.has(deposit.id)}
                                onCheckedChange={() => toggleLoanSelection(deposit.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatDate(deposit.date)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-blue-600">
                              {formatAmount(deposit.amount)}
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate" title={deposit.memo}>
                              {deposit.memo || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate" title={deposit.documentName || ""}>
                              {deposit.documentName || "-"}
                            </TableCell>
                            {searchMethod === "auto" && "confidence" in deposit && (
                              <TableCell>
                                <Badge 
                                  variant={deposit.confidence >= 50 ? "default" : "secondary"}
                                  className={deposit.confidence >= 70 ? "bg-green-600" : deposit.confidence >= 50 ? "bg-yellow-500" : ""}
                                >
                                  {deposit.confidence}%
                                </Badge>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* 결과 없음 */}
              {!isSearchLoading && searchResults.length === 0 && (searchMethod === "auto" || keywordSearchTriggered) && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchMethod === "auto" 
                        ? "대출 의심 입금건을 찾지 못했습니다."
                        : `"${keyword}" 키워드를 포함한 입금건이 없습니다.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 추적 결과 (탭 UI) */}
          {step === "tracking-results" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {trackingQuery.isLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">대출금 사용 내역을 추적하고 있습니다...</p>
                  </div>
                </div>
              )}

              {trackingQuery.error && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-red-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>오류: {trackingQuery.error.message}</p>
                  </div>
                </div>
              )}

              {trackingQuery.data?.success && trackingQuery.data.results.length > 0 && (
                <Tabs defaultValue={trackingQuery.data.results[0]?.loanId} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
                    {trackingQuery.data.results.map((result, idx) => (
                      <TabsTrigger 
                        key={result.loanId} 
                        value={result.loanId}
                        className="flex items-center gap-2 max-w-[250px]"
                      >
                        <span className="font-mono text-xs whitespace-nowrap">
                          {formatAmount(result.loanAmount)}
                        </span>
                        {result.loanMemo && (
                          <span className="text-xs text-muted-foreground truncate" title={result.loanMemo}>
                            {result.loanMemo.length > 15 ? result.loanMemo.slice(0, 15) + "..." : result.loanMemo}
                          </span>
                        )}
                        {result.summary.exhausted && (
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {trackingQuery.data.results.map((result) => (
                    <TabsContent 
                      key={result.loanId} 
                      value={result.loanId}
                      className="flex-1 flex flex-col overflow-hidden mt-4"
                    >
                      {/* 요약 카드 */}
                      <div className="flex-shrink-0 grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">대출 실행일</p>
                          <p className="font-mono font-medium">{formatDate(result.loanDate)}</p>
                        </Card>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">대출금</p>
                          <p className="font-mono font-medium text-blue-600">{formatAmount(result.loanAmount)}</p>
                        </Card>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">사용 금액</p>
                          <p className="font-mono font-medium text-red-600">{formatAmount(result.summary.totalUsed)}</p>
                        </Card>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">이동 건수</p>
                          <p className="font-mono font-medium text-purple-600">{result.summary.transferCount || 0}건</p>
                        </Card>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">잔여 금액</p>
                          <p className="font-mono font-medium">{formatAmount(result.summary.remainingLoan)}</p>
                        </Card>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">상태</p>
                          <Badge variant={result.summary.exhausted ? "default" : "secondary"} className={result.summary.exhausted ? "bg-green-600" : ""}>
                            {result.summary.exhausted ? "전액 소진" : "일부 잔여"}
                          </Badge>
                        </Card>
                      </div>

                      {/* 다운로드 버튼 */}
                      <div className="flex justify-end mb-2 flex-shrink-0">
                        <Button size="sm" onClick={() => handleDownloadTab(result)}>
                          <Download className="h-4 w-4 mr-2" />
                          이 대출건 엑셀 다운로드
                        </Button>
                      </div>

                      {/* 테이블 (샘플 10개 + 나머지 다운로드) */}
                      <div className="flex-1 border rounded-lg overflow-hidden min-h-0">
                        <div className="h-full overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px] sticky top-0 bg-background z-10">순번</TableHead>
                                <TableHead className="w-[90px] sticky top-0 bg-background z-10">날짜</TableHead>
                                <TableHead className="w-[70px] sticky top-0 bg-background z-10">구분</TableHead>
                                <TableHead className="w-[110px] text-right sticky top-0 bg-background z-10">금액</TableHead>
                                <TableHead className="w-[110px] text-right sticky top-0 bg-background z-10">남은 대출금</TableHead>
                                <TableHead className="w-[150px] sticky top-0 bg-background z-10">비고</TableHead>
                                <TableHead className="w-[120px] sticky top-0 bg-background z-10">거래 파일</TableHead>
                                <TableHead className="w-[120px] sticky top-0 bg-background z-10">이동 대상</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.trackedItems.map((item, idx) => (
                                <TableRow 
                                  key={idx} 
                                  className={
                                    item.type === "대출실행" 
                                      ? "bg-blue-50 dark:bg-blue-950" 
                                      : item.type === "이동" 
                                        ? "bg-purple-50 dark:bg-purple-950" 
                                        : ""
                                  }
                                >
                                  <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                                  <TableCell className="font-mono text-sm">{formatDate(item.date)}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={item.type === "대출실행" ? "default" : "outline"}
                                      className={item.type === "이동" ? "border-purple-500 text-purple-600" : ""}
                                    >
                                      {item.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={`text-right font-mono ${
                                    item.type === "대출실행" 
                                      ? "text-blue-600" 
                                      : item.type === "이동" 
                                        ? "text-purple-600" 
                                        : "text-red-600"
                                  }`}>
                                    {item.type === "대출실행" ? "+" : "-"}{formatAmount(item.amount)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{formatAmount(item.remainingLoan)}</TableCell>
                                  <TableCell className="max-w-[150px] truncate text-sm" title={item.memo}>
                                    {item.memo || "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <FileText className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate" title={item.documentName}>
                                        {item.documentName || "-"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {item.type === "이동" && item.transferTo ? (
                                      <div className="flex items-center gap-1 text-purple-600">
                                        <span>→</span>
                                        <span className="truncate" title={item.transferTo}>
                                          {item.transferTo}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={handleBack} disabled={step === "select-method"}>
              이전
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                닫기
              </Button>
              {step === "search-results" && (
                <Button 
                  onClick={handleStartTracking} 
                  disabled={selectedLoanIds.size === 0}
                >
                  <ChevronRight className="h-4 w-4 mr-2" />
                  추적 시작 ({selectedLoanIds.size}건)
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
