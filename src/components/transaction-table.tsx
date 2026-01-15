/**
 * Transaction Table Component
 *
 * Story 4.2: 신뢰도 점수 및 불확실한 분류 표시
 * Story 4.2 Code Review - HIGH #2: Sort state persisted to URL
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 * Story 4.2 Code Review - MEDIUM #7: Pagination support for large datasets
 * Story 4.3: 중요 거래 자동 식별 및 표시
 * Story 4.4: 거래 성격 판단 및 표시
 * Story 4.6: 태그 추가 및 삭제
 * Story 4.7: 일괄 분류 수정
 *
 * 기능:
 * - 거래 목록 표시
 * - 신뢰도 점수 배지 표시
 * - 중요 거래 배지 표시 (Story 4.3)
 * - 거래 성격 배지 표시 (Story 4.4)
 * - 채권자명/담보 유형 표시 (Story 4.4)
 * - 태그 추가/삭제 (Story 4.6)
 * - 일괄 수정 (Story 4.7)
 * - 신뢰도 낮은 순 필터 (AC2)
 * - 카테고리 필터
 * - 거래 성격 필터 (Story 4.4)
 * - 검색 기능
 * - URL 파라미터로 정렬 상태 저장 (HIGH #2)
 * - 다국어 지원 (MEDIUM #5)
 * - 페이지네이션 (MEDIUM #7)
 *
 * @see https://ui.shadcn.com/docs/components/table
 */

"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { ConfidenceBadge, ConfidenceText } from "./confidence-badge";
import { ImportantTransactionBadge } from "./important-transaction-badge";
import { TransactionNatureBadge } from "./transaction-nature-badge";
import { CategoryEditor } from "./category-editor";
import { ManualClassificationBadge } from "./manual-classification-badge";
import { RestoreOriginalButton } from "./restore-original-button";
import { TagEditor } from "./molecules/tag-editor"; // Story 4.6
import { BatchTagDialog } from "./molecules/batch-tag-dialog"; // Story 4.6
import { BatchEditDialog } from "./molecules/batch-edit-dialog"; // Story 4.7
import { ReportErrorDialog } from "./report-error-dialog"; // Story 4.8
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { api } from "~/utils/api";
import FundSourceTraceResult, { type TracingResult } from "./molecules/FundSourceTraceResult"; // Story 5.1
import FundDestinationTraceResult from "./molecules/FundDestinationTraceResult"; // Story 5.2
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useI18n } from "~/lib/i18n/index";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface Transaction {
  id: string;
  transactionDate: Date;
  depositAmount: string | null;
  withdrawalAmount: string | null;
  balance: string | null;
  memo: string | null;
  category: string | null;
  subcategory: string | null;
  confidenceScore: number | null;
  // Story 4.3: 중요 거래 필드
  importantTransaction: boolean | null;
  importantTransactionType: string | null;
  importantTransactionKeywords: string | null;
  // Story 4.4: 거래 성격 필드
  transactionNature: "CREDITOR" | "COLLATERAL" | "PRIORITY_REPAYMENT" | "GENERAL" | null;
  creditorName: string | null;
  collateralType: string | null;
  // Story 4.5: 수동 분류 수정 필드
  isManuallyClassified: boolean | null;
  originalCategory: string | null;
  originalSubcategory: string | null;
  manualClassificationDate: Date | null;
  manualClassifiedBy: string | null;
  // Story 4.6: 태그 필드
  tags?: Array<{
    tag: {
      id: string;
      name: string;
    };
  }>;
}

/**
 * Pagination metadata
 * Story 4.2 Code Review - MEDIUM #7
 */
export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface TransactionTableProps {
  transactions: Transaction[];
  pagination?: PaginationMetadata;
  onPageChange?: (page: number) => void;
  onTagsUpdated?: () => void; // Story 4.6
  caseId?: string; // Story 5.1: Fund source tracing requires caseId
  onExportSelected?: (transactionIds: string[]) => void; // Story 7.2: 선택 내보내기
}

type SortField = "date" | "depositAmount" | "withdrawalAmount" | "confidenceScore";
type SortOrder = "asc" | "desc" | null;

export function TransactionTable({ transactions, pagination, onPageChange, onTagsUpdated, caseId, onExportSelected }: TransactionTableProps) {
  const { t, formatMessage, formatDate, formatCurrency } = useI18n();

  // URL 기반 상태 관리 (HIGH #2, MEDIUM #7)
  const router = useRouter();
  const searchParams = useSearchParams();

  // 검색어 상태 (로컬 상태 유지 - 검색어는 URL에 저장하지 않음)
  const [searchQuery, setSearchQuery] = useState("");

  // 카테고리 필터 상태 (로컬 상태 유지)
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Story 4.3: 중요 거래만 보기 필터 상태
  const [showOnlyImportant, setShowOnlyImportant] = useState(false);

  // Story 4.4: 거래 성격 필터 상태
  const [natureFilter, setNatureFilter] = useState<string>("all");

  // Story 4.6: 일괄 태그 추가 상태
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // Story 4.7: 일괄 수정 다이얼로그 상태
  const [isBatchEditDialogOpen, setIsBatchEditDialogOpen] = useState(false);

  // Story 5.1: 자금 출처 추적 상태
  const [traceTransaction, setTraceTransaction] = useState<{ id: string; memo: string | null } | null>(null);
  const [traceResult, setTraceResult] = useState<TracingResult | null>(null);
  const [traceDepth, setTraceDepth] = useState(1);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Story 5.2: 자금 사용처 추적 상태
  const [traceDestTransaction, setTraceDestTransaction] = useState<{ id: string; memo: string | null } | null>(null);
  const [traceDestResult, setTraceDestResult] = useState<TracingResult | null>(null);
  const [traceDestDepth, setTraceDestDepth] = useState(1);
  const [isTracingDest, setIsTracingDest] = useState(false);
  const [traceDestError, setTraceDestError] = useState<string | null>(null);

  // tRPC utils for manual query execution
  const utils = api.useUtils();

  // 정렬 상태를 URL에서 읽기 (HIGH #2)
  const sortField = (searchParams!.get("sortBy") as SortField) ?? "date";
  const sortOrder = (searchParams!.get("order") as SortOrder) ?? "desc";

  // 페이지네이션 상태를 URL에서 읽기 (MEDIUM #7)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentPage = pagination?.page ?? Number(searchParams!.get("page") ?? "1");

  // 카테고리 목록 추출 (중복 제거)
  const categories = useMemo(() => {
    const cats = new Set(
      transactions
        .map((tx) => tx.category)
        .filter((cat): cat is string => cat !== null && cat !== undefined)
    );
    return Array.from(cats).sort();
  }, [transactions]);

  // 필터링된 거래 목록
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 검색어 필터 (메모, 카테고리, 서브카테고리)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const memo = tx.memo?.toLowerCase() ?? "";
        const category = tx.category?.toLowerCase() ?? "";
        const subcategory = tx.subcategory?.toLowerCase() ?? "";

        if (!memo.includes(query) && !category.includes(query) && !subcategory.includes(query)) {
          return false;
        }
      }

      // 카테고리 필터
      if (categoryFilter !== "all" && tx.category !== categoryFilter) {
        return false;
      }

      // Story 4.3: 중요 거래만 보기 필터
      if (showOnlyImportant && !tx.importantTransaction) {
        return false;
      }

      // Story 4.4: 거래 성격 필터
      if (natureFilter !== "all" && tx.transactionNature !== natureFilter) {
        return false;
      }

      return true;
    });
  }, [transactions, searchQuery, categoryFilter, showOnlyImportant, natureFilter]);

  // 정렬된 거래 목록
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      // MEDIUM #4: Changed from 'any' to 'number' for type safety
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case "date":
          aValue = new Date(a.transactionDate).getTime();
          bValue = new Date(b.transactionDate).getTime();
          break;
        case "depositAmount":
          aValue = a.depositAmount ? Number(a.depositAmount) : 0;
          bValue = b.depositAmount ? Number(b.depositAmount) : 0;
          break;
        case "withdrawalAmount":
          aValue = a.withdrawalAmount ? Number(a.withdrawalAmount) : 0;
          bValue = b.withdrawalAmount ? Number(b.withdrawalAmount) : 0;
          break;
        case "confidenceScore":
          // [AC2] 신뢰도 낮은 순 필터 - null을 마지막으로 처리
          aValue = a.confidenceScore ?? -1;
          bValue = b.confidenceScore ?? -1;
          break;
        default:
          return 0;
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else if (sortOrder === "desc") {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
      return 0;
    });

    return sorted;
  }, [filteredTransactions, sortField, sortOrder]);

  // 정렬 핸들러 (HIGH #2: URL에 정렬 상태 저장)
  const handleSort = (field: SortField) => {
    const params = new URLSearchParams(searchParams!.toString());

    if (sortField === field) {
      // 같은 필드 클릭: asc -> desc -> 제거
      if (sortOrder === "asc") {
        params.set("order", "desc");
      } else if (sortOrder === "desc") {
        // 정렬 제거 (기본값으로 돌아감)
        params.delete("sortBy");
        params.delete("order");
      } else {
        // asc로 설정 (이 경우는 발생하지 않음)
        params.set("sortBy", field);
        params.set("order", "asc");
      }
    } else {
      // 새 필드 클릭: 오름차순부터 시작
      params.set("sortBy", field);
      params.set("order", "asc");
    }

    // URL 업데이트 (scroll: false로 페이지 이동 방지)
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field || !sortOrder) {
      return <ArrowUpDown className="w-4 h-4 ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* 필터 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-4" role="search" aria-label={t("transaction.filter.ariaLabel")}>
        {/* 검색어 입력 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input
            type="text"
            id="transaction-search"
            placeholder={t("transaction.filter.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label={t("transaction.filter.searchAriaLabel")}
          />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 items-center">
          <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
            {t("transaction.filter.categoryLabel")}
          </label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t("transaction.filter.categoryAriaLabel")}
          >
            <option value="all">{t("transaction.filter.all")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Story 4.4: 거래 성격 필터 */}
        <div className="flex gap-2 items-center">
          <label htmlFor="nature-filter" className="text-sm font-medium text-gray-700">
            {t("transactionNature.filterLabel")}
          </label>
          <Select value={natureFilter} onValueChange={setNatureFilter}>
            <SelectTrigger id="nature-filter" className="w-[180px]">
              <SelectValue placeholder={t("transactionNature.filterLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("transaction.filter.all")}</SelectItem>
              <SelectItem value="CREDITOR">{t("transactionNature.types.CREDITOR")}</SelectItem>
              <SelectItem value="COLLATERAL">{t("transactionNature.types.COLLATERAL")}</SelectItem>
              <SelectItem value="PRIORITY_REPAYMENT">
                {t("transactionNature.types.PRIORITY_REPAYMENT")}
              </SelectItem>
              <SelectItem value="GENERAL">{t("transactionNature.types.GENERAL")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* [AC2] 신뢰도 낮은 순 필터 버튼 */}
        <Button
          variant={sortField === "confidenceScore" && sortOrder === "asc" ? "default" : "outline"}
          size="sm"
          onClick={() => handleSort("confidenceScore")}
          aria-label={
            sortField === "confidenceScore" && sortOrder === "asc"
              ? t("transaction.filter.sortByConfidenceAriaLabelActive")
              : sortField === "confidenceScore" && sortOrder === "desc"
              ? t("transaction.filter.sortByConfidenceDescAriaLabel")
              : t("transaction.filter.sortByConfidenceAriaLabel")
          }
          aria-pressed={sortField === "confidenceScore"}
        >
          {t("transaction.filter.sortByConfidence")}
          {renderSortIcon("confidenceScore")}
        </Button>

        {/* Story 4.3: 중요 거래만 보기 체크박스 */}
        <div className="flex gap-2 items-center">
          <input
            type="checkbox"
            id="important-only-filter"
            checked={showOnlyImportant}
            onChange={(e) => setShowOnlyImportant(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            aria-label="중요 거래만 보기"
          />
          <label
            htmlFor="important-only-filter"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            {t("importantTransaction.important")}
          </label>
        </div>
      </div>

      {/* 결과 수 표시 */}
      <div className="text-sm text-gray-600" role="status" aria-live="polite">
        {formatMessage("transaction.filter.resultCount", {
          count: sortedTransactions.length,
          total: transactions.length,
        })}
      </div>

      {/* Story 7.2: 선택 내보내기 버튼 (Task 1.3) */}
      {selectedTransactionIds.size > 0 && (
        <Button
          size="sm"
          onClick={() => {
            // ExportOptionsModal이 열리도록 props로 전달
            // 부모 컴포넌트에서 onExportSelected 호출
            if (onExportSelected) {
              onExportSelected(Array.from(selectedTransactionIds));
            }
          }}
          disabled={selectedTransactionIds.size === 0}
          className="ml-auto"
        >
          선택 내보내기 ({selectedTransactionIds.size}개)
        </Button>
      )}

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <caption className="sr-only">
            {t("transaction.table.caption")}
          </caption>
          <TableHeader>
            <TableRow>
              {/* Story 4.6: 체크박스 컬럼 헤더 */}
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={sortedTransactions.length > 0 && selectedTransactionIds.size === sortedTransactions.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTransactionIds(new Set(sortedTransactions.map((tx) => tx.id)));
                    } else {
                      setSelectedTransactionIds(new Set());
                    }
                  }}
                  className="w-4 h-4"
                  aria-label="모든 거래 선택"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort("date")}
                aria-label={t("transaction.table.date")}
                aria-sort={
                  sortField === "date"
                    ? sortOrder === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <div className="flex items-center">
                  {t("transaction.table.date")}
                  {renderSortIcon("date")}
                </div>
              </TableHead>
              <TableHead>{t("transaction.table.memo")}</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort("depositAmount")}
                aria-label={t("transaction.table.deposit")}
                aria-sort={
                  sortField === "depositAmount"
                    ? sortOrder === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <div className="flex items-center justify-end">
                  {t("transaction.table.deposit")}
                  {renderSortIcon("depositAmount")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort("withdrawalAmount")}
                aria-label={t("transaction.table.withdrawal")}
                aria-sort={
                  sortField === "withdrawalAmount"
                    ? sortOrder === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <div className="flex items-center justify-end">
                  {t("transaction.table.withdrawal")}
                  {renderSortIcon("withdrawalAmount")}
                </div>
              </TableHead>
              <TableHead className="text-right">{t("transaction.table.balance")}</TableHead>
              <TableHead>{t("transaction.table.category")}</TableHead>
              <TableHead>{t("importantTransaction.important")}</TableHead>
              {/* Story 4.6: 태그 컬럼 */}
              <TableHead>태그</TableHead>
              {/* Story 4.8: 오류 보고 컬럼 */}
              <TableHead>오류 보고</TableHead>
              {/* Story 5.1 & 5.2: 자금 추적 컬럼 */}
              {caseId && <TableHead>자금 추적</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={caseId ? 15 : 14} className="text-center py-8 text-gray-500">
                  {t("transaction.filter.noTransactions")}
                </TableCell>
              </TableRow>
            ) : (
              sortedTransactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-gray-50">
                  {/* Story 4.6: 체크박스 셀 */}
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTransactionIds.has(tx.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedTransactionIds);
                        if (e.target.checked) {
                          newSelected.add(tx.id);
                        } else {
                          newSelected.delete(tx.id);
                        }
                        setSelectedTransactionIds(newSelected);
                      }}
                      className="w-4 h-4"
                      aria-label={`거래 선택: ${formatDate(tx.transactionDate)} ${tx.memo ?? ""}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDate(tx.transactionDate)}
                  </TableCell>
                  <TableCell>{tx.memo ?? "-"}</TableCell>
                  <TableCell
                    className="text-right text-blue-600"
                    aria-label={
                      tx.depositAmount
                        ? `${t("transaction.table.deposit")} ${formatCurrency(Number(tx.depositAmount))}`
                        : `${t("transaction.table.deposit")} -`
                    }
                  >
                    {tx.depositAmount ? formatCurrency(Number(tx.depositAmount)) : "-"}
                  </TableCell>
                  <TableCell
                    className="text-right text-red-600"
                    aria-label={
                      tx.withdrawalAmount
                        ? `${t("transaction.table.withdrawal")} ${formatCurrency(Number(tx.withdrawalAmount))}`
                        : `${t("transaction.table.withdrawal")} -`
                    }
                  >
                    {tx.withdrawalAmount ? formatCurrency(Number(tx.withdrawalAmount)) : "-"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    aria-label={
                      tx.balance
                        ? `${t("transaction.table.balance")} ${formatCurrency(Number(tx.balance))}`
                        : `${t("transaction.table.balance")} -`
                    }
                  >
                    {tx.balance ? formatCurrency(Number(tx.balance)) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {/* Story 4.5: CategoryEditor + ManualClassificationBadge */}
                      <CategoryEditor
                        transactionId={tx.id}
                        currentCategory={tx.category}
                        currentSubcategory={tx.subcategory}
                        onClassificationUpdated={() => {
                          // TODO: Invalidate tRPC query
                          // utils.transaction.getPaginatedTransactions.invalidate();
                          console.log("Classification updated for transaction", tx.id);
                        }}
                      />

                      {/* ManualClassificationBadge */}
                      {tx.isManuallyClassified && (
                        <ManualClassificationBadge
                          isManuallyClassified={tx.isManuallyClassified}
                          originalCategory={tx.originalCategory}
                          originalSubcategory={tx.originalSubcategory}
                          manualClassificationDate={tx.manualClassificationDate}
                          size="sm"
                        />
                      )}
                    </div>
                  </TableCell>
                  {/* Story 4.3: 중요 거래 배지 */}
                  <TableCell>
                    {tx.importantTransaction && (
                      <ImportantTransactionBadge
                        type={tx.importantTransactionType as "LOAN_EXECUTION" | "REPAYMENT" | "COLLATERAL" | "SEIZURE" | null}
                        keywords={
                          tx.importantTransactionKeywords
                            ? (JSON.parse(tx.importantTransactionKeywords) as string[])
                            : undefined
                        }
                        size="sm"
                      />
                    )}
                  </TableCell>
                  {/* Story 4.6: 태그 셀 */}
                  <TableCell>
                    <TagEditor
                      transactionId={tx.id}
                      currentTags={tx.tags ?? []}
                      onTagsUpdated={() => onTagsUpdated?.()}
                    />
                  </TableCell>
                  {/* Story 4.8: 오류 보고 셀 */}
                  <TableCell>
                    <ReportErrorDialog
                      transactionId={tx.id}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="오류 보고"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                          </svg>
                        </Button>
                      }
                    />
                  </TableCell>
                  {/* Story 5.1 & 5.2: 자금 추적 버튼 */}
                  {caseId && (
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Story 5.1: 자금 출처 추적 (입금 거래) */}
                        {tx.depositAmount && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setTraceTransaction({ id: tx.id, memo: tx.memo });
                              setTraceResult(null);
                              setTraceDepth(1);
                              setIsTracing(true);
                              setTraceError(null);

                              try {
                                const result = await utils.fundFlow.traceUpstream.fetch({
                                  transactionId: tx.id,
                                  caseId,
                                  maxDepth: 1,
                                  amountTolerance: 0.1,
                                });
                                setTraceResult(result);
                              } catch (error) {
                                setTraceError(error instanceof Error ? error.message : "추적 실패");
                              } finally {
                                setIsTracing(false);
                              }
                            }}
                            disabled={isTracing}
                            title="자금 출처 추적"
                          >
                            <ArrowUpCircle className="w-4 h-4 mr-1" />
                            출처
                          </Button>
                        )}
                        {/* Story 5.2: 자금 사용처 추적 (출금 거래) */}
                        {tx.withdrawalAmount && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setTraceDestTransaction({ id: tx.id, memo: tx.memo });
                              setTraceDestResult(null);
                              setTraceDestDepth(1);
                              setIsTracingDest(true);
                              setTraceDestError(null);

                              try {
                                const result = await utils.fundFlow.traceDownstream.fetch({
                                  transactionId: tx.id,
                                  caseId,
                                  maxDepth: 1,
                                  amountTolerance: 0.1,
                                });
                                setTraceDestResult(result);
                              } catch (error) {
                                setTraceDestError(error instanceof Error ? error.message : "추적 실패");
                              } finally {
                                setIsTracingDest(false);
                              }
                            }}
                            disabled={isTracingDest}
                            title="자금 사용처 추적"
                          >
                            <ArrowDownCircle className="w-4 h-4 mr-1" />
                            사용처
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Story 4.6 & 4.7: 일괄 작업 버튼들 */}
      {selectedTransactionIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700">
            {selectedTransactionIds.size}개의 거래가 선택됨
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsBatchEditDialogOpen(true)}
            >
              일괄 수정
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsBatchDialogOpen(true)}
            >
              태그 추가
            </Button>
          </div>
        </div>
      )}

      {/* Story 4.6: 일괄 태그 추가 다이얼로그 */}
      <BatchTagDialog
        transactionIds={Array.from(selectedTransactionIds)}
        open={isBatchDialogOpen}
        onClose={() => setIsBatchDialogOpen(false)}
        onComplete={() => {
          setSelectedTransactionIds(new Set());
          onTagsUpdated?.();
        }}
      />

      {/* Story 4.7: 일괄 수정 다이얼로그 */}
      <BatchEditDialog
        transactionIds={Array.from(selectedTransactionIds)}
        open={isBatchEditDialogOpen}
        onClose={() => setIsBatchEditDialogOpen(false)}
        onComplete={() => {
          setSelectedTransactionIds(new Set());
          onTagsUpdated?.();
        }}
      />

      {/* Story 5.1: 자금 출처 추적 다이얼로그 */}
      {caseId && traceTransaction && (
        <Dialog
          open={!!traceTransaction}
          onOpenChange={(open) => {
            if (!open) {
              setTraceTransaction(null);
              setTraceResult(null);
              setTraceDepth(1);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-green-600" />
                자금 출처 추적
              </DialogTitle>
              <DialogDescription>
                {traceTransaction.memo
                  ? `"${traceTransaction.memo}" 거래의 자금 출처를 추적합니다`
                  : "선택한 거래의 자금 출처를 추적합니다"}
              </DialogDescription>
            </DialogHeader>

            <FundSourceTraceResult
              result={traceResult}
              isLoading={isTracing}
              error={traceError}
              depth={traceDepth}
              onContinueTracing={async () => {
                if (!traceTransaction || !caseId) return;

                const newDepth = traceDepth + 1;
                setTraceDepth(newDepth);
                setIsTracing(true);
                setTraceError(null);

                try {
                  const result = await utils.fundFlow.traceUpstream.fetch({
                    transactionId: traceTransaction.id,
                    caseId,
                    maxDepth: newDepth,
                    amountTolerance: 0.1,
                  });
                  setTraceResult(result);
                } catch (error) {
                  setTraceError(error instanceof Error ? error.message : "추적 실패");
                } finally {
                  setIsTracing(false);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Story 5.2: 자금 사용처 추적 다이얼로그 */}
      {caseId && traceDestTransaction && (
        <Dialog
          open={!!traceDestTransaction}
          onOpenChange={(open) => {
            if (!open) {
              setTraceDestTransaction(null);
              setTraceDestResult(null);
              setTraceDestDepth(1);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-orange-600" />
                자금 사용처 추적
              </DialogTitle>
              <DialogDescription>
                {traceDestTransaction.memo
                  ? `"${traceDestTransaction.memo}" 거래의 자금 사용처를 추적합니다`
                  : "선택한 거래의 자금 사용처를 추적합니다"}
              </DialogDescription>
            </DialogHeader>

            <FundDestinationTraceResult
              result={traceDestResult}
              isLoading={isTracingDest}
              error={traceDestError}
              depth={traceDestDepth}
              onContinueTracing={async () => {
                if (!traceDestTransaction || !caseId) return;

                const newDepth = traceDestDepth + 1;
                setTraceDestDepth(newDepth);
                setIsTracingDest(true);
                setTraceDestError(null);

                try {
                  const result = await utils.fundFlow.traceDownstream.fetch({
                    transactionId: traceDestTransaction.id,
                    caseId,
                    maxDepth: newDepth,
                    amountTolerance: 0.1,
                  });
                  setTraceDestResult(result);
                } catch (error) {
                  setTraceDestError(error instanceof Error ? error.message : "추적 실패");
                } finally {
                  setIsTracingDest(false);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* [MEDIUM #7] 페이지네이션 컨트롤 */}
      {pagination && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t"
          role="navigation"
          aria-label={t("transaction.pagination.ariaLabel")}
        >
          {/* 페이지 정보 */}
          <div className="text-sm text-gray-600" role="status">
            {formatMessage("transaction.pagination.showing", {
              start: (pagination.page - 1) * pagination.pageSize + 1,
              end: Math.min(pagination.page * pagination.pageSize, pagination.totalCount),
              total: pagination.totalCount,
            })}
          </div>

          {/* 페이지 버튼 */}
          <div className="flex items-center gap-2">
            {/* 처음으로 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page === 1}
              aria-label={t("transaction.pagination.first")}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>

            {/* 이전 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              aria-label={t("transaction.pagination.previous")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* 페이지 정보 텍스트 */}
            <span className="text-sm text-gray-600 px-2">
              {formatMessage("transaction.pagination.pageInfo", {
                current: pagination.page,
                total: pagination.totalPages,
              })}
            </span>

            {/* 다음 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={!pagination.hasMore}
              aria-label={t("transaction.pagination.next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* 마지막으로 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.totalPages)}
              disabled={!pagination.hasMore}
              aria-label={t("transaction.pagination.last")}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Transaction Detail Component
 *
 * [AC2] 거래 상세 조회 시 신뢰도 퍼센트 표시
 * 예: "입금 - 92% 신뢰도"
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 */
interface TransactionDetailProps {
  transaction: Transaction;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  const { t, formatDate, formatCurrency } = useI18n();

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-500">{t("transaction.detail.date")}</label>
          <p className="mt-1 text-lg">{formatDate(transaction.transactionDate)}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">{t("transaction.detail.memo")}</label>
          <p className="mt-1 text-lg">{transaction.memo ?? "-"}</p>
        </div>
      </div>

      {/* 금액 정보 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-500">{t("transaction.detail.depositAmount")}</label>
          <p className="mt-1 text-lg text-blue-600">
            {transaction.depositAmount ? formatCurrency(Number(transaction.depositAmount)) : "-"}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">{t("transaction.detail.withdrawalAmount")}</label>
          <p className="mt-1 text-lg text-red-600">
            {transaction.withdrawalAmount ? formatCurrency(Number(transaction.withdrawalAmount)) : "-"}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">{t("transaction.detail.balance")}</label>
          <p className="mt-1 text-lg">
            {transaction.balance ? formatCurrency(Number(transaction.balance)) : "-"}
          </p>
        </div>
      </div>

      {/* [AC2] AI 분류 결과 및 신뢰도 */}
      <div className="border-t pt-4">
        <label className="text-sm font-medium text-gray-500">{t("transaction.detail.aiResult")}</label>
        <div className="mt-2">
          <ConfidenceText
            confidenceScore={transaction.confidenceScore}
            category={transaction.category ?? undefined}
          />
          {transaction.subcategory && (
            <p className="text-sm text-gray-600 mt-1">
              {t("transaction.table.subcategory")}: {transaction.subcategory}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
