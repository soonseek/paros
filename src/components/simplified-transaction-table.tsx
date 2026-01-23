/**
 * Simplified Transaction Table
 * 
 * 표준 형식으로 정규화된 거래내역만 표시
 * 컬럼: 거래일자, 구분, 금액, 잔액, 비고
 */

"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";

export interface SimplifiedTransaction {
  id: string;
  transactionDate: string;
  type: '입금' | '출금';
  amount: number;
  balance: number;
  memo: string;
  documentName?: string; // 문서명 (전체 내역 표시용)
}

interface SimplifiedTransactionTableProps {
  transactions: SimplifiedTransaction[];
  caseId?: string;
  showDocumentName?: boolean; // 문서명 컬럼 표시 여부
}

type SortField = 'transactionDate' | 'amount' | 'balance';
type SortOrder = 'asc' | 'desc';

// 문서명 truncate 함수 (10글자 초과시 ellipsis)
function truncateDocName(name: string, maxLength: number = 10): string {
  if (!name) return '-';
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
}

export function SimplifiedTransactionTable({
  transactions,
  caseId,
  showDocumentName = false,
}: SimplifiedTransactionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  // 기본 정렬: 거래일자 오름차순 (시간순)
  const [sortField, setSortField] = useState<SortField>('transactionDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [typeFilter, setTypeFilter] = useState<'all' | '입금' | '출금'>('all');

  // 정렬 토글
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 필터링 및 정렬
  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    // 타입 필터
    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }

    // 검색
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.memo.toLowerCase().includes(term) ||
        t.transactionDate.includes(term)
      );
    }

    // 정렬
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'transactionDate':
          comparison = a.transactionDate.localeCompare(b.transactionDate);
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchTerm, sortField, sortOrder, typeFilter]);

  // 금액 포맷 (천단위 콤마)
  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString('ko-KR');
    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  // 잔액 포맷
  const formatBalance = (balance: number) => {
    return balance.toLocaleString('ko-KR');
  };

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* 타입 필터 */}
        <div className="flex gap-2">
          <Button
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('all')}
            data-testid="filter-all"
          >
            전체 ({transactions.length})
          </Button>
          <Button
            variant={typeFilter === '입금' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('입금')}
            data-testid="filter-deposit"
            className="text-blue-600 dark:text-blue-400"
          >
            입금 ({transactions.filter(t => t.type === '입금').length})
          </Button>
          <Button
            variant={typeFilter === '출금' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('출금')}
            data-testid="filter-withdrawal"
            className="text-red-600 dark:text-red-400"
          >
            출금 ({transactions.filter(t => t.type === '출금').length})
          </Button>
        </div>

        {/* 검색 */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="비고 또는 날짜 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="search-input"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showDocumentName && (
                <TableHead className="w-[120px] font-semibold">
                  문서
                </TableHead>
              )}
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('transactionDate')}
                  className="font-semibold"
                  data-testid="sort-date"
                >
                  거래일자
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px] text-center font-semibold">
                구분
              </TableHead>
              <TableHead className="w-[130px] text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('amount')}
                  className="font-semibold ml-auto"
                  data-testid="sort-amount"
                >
                  금액
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[130px] text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('balance')}
                  className="font-semibold ml-auto"
                  data-testid="sort-balance"
                >
                  잔액
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">비고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDocumentName ? 6 : 5} className="text-center py-8 text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '거래내역이 없습니다.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTransactions.map((transaction) => (
                <TableRow key={transaction.id} data-testid="transaction-row">
                  {/* 문서명 */}
                  {showDocumentName && (
                    <TableCell 
                      className="text-xs text-gray-500" 
                      title={transaction.documentName}
                    >
                      {truncateDocName(transaction.documentName ?? '')}
                    </TableCell>
                  )}
                  {/* 거래일자 */}
                  <TableCell className="font-medium">
                    {transaction.transactionDate}
                  </TableCell>

                  {/* 구분 */}
                  <TableCell className="text-center">
                    <Badge
                      variant={transaction.type === '입금' ? 'default' : 'destructive'}
                      className={
                        transaction.type === '입금'
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
                      }
                      data-testid={`type-badge-${transaction.type}`}
                    >
                      {transaction.type}
                    </Badge>
                  </TableCell>

                  {/* 금액 */}
                  <TableCell
                    className={`text-right font-semibold ${
                      transaction.amount >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                    data-testid="amount"
                  >
                    {formatAmount(transaction.amount)}
                  </TableCell>

                  {/* 잔액 */}
                  <TableCell className="text-right font-medium" data-testid="balance">
                    {formatBalance(transaction.balance)}
                  </TableCell>

                  {/* 비고 */}
                  <TableCell className="max-w-md truncate" title={transaction.memo} data-testid="memo">
                    {transaction.memo || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 통계 */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div>
          총 <span className="font-semibold text-gray-900 dark:text-gray-100">
            {filteredAndSortedTransactions.length}
          </span>건
        </div>
        <div className="border-l pl-4">
          입금 합계:{' '}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            +{filteredAndSortedTransactions
              .filter(t => t.type === '입금')
              .reduce((sum, t) => sum + t.amount, 0)
              .toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="border-l pl-4">
          출금 합계:{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">
            {filteredAndSortedTransactions
              .filter(t => t.type === '출금')
              .reduce((sum, t) => sum + t.amount, 0)
              .toLocaleString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
}
