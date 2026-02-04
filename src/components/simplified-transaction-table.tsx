/**
 * Simplified Transaction Table
 * 
 * 표준 형식으로 정규화된 거래내역 표시
 * 컬럼: 거래일자, 입금, 출금, 잔액, 비고
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

export interface SimplifiedTransaction {
  id: string;
  transactionDate: string;
  type: '입금' | '출금';
  amount: number;
  balance: number;
  memo: string;
  documentName?: string;
}

interface SimplifiedTransactionTableProps {
  transactions: SimplifiedTransaction[];
  caseId?: string;
  showDocumentName?: boolean;
}

type SortField = 'transactionDate' | 'amount' | 'balance';
type SortOrder = 'asc' | 'desc';

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
  const [sortField, setSortField] = useState<SortField>('transactionDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [typeFilter, setTypeFilter] = useState<'all' | '입금' | '출금'>('all');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.memo?.toLowerCase().includes(term) ||
        t.transactionDate?.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'transactionDate':
          comparison = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchTerm, sortField, sortOrder, typeFilter]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR');
  };

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
            <TableRow className="bg-muted/50">
              {showDocumentName && (
                <TableHead className="w-[100px] font-semibold">
                  문서
                </TableHead>
              )}
              <TableHead className="w-[110px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('transactionDate')}
                  className="font-semibold p-0 h-auto"
                  data-testid="sort-date"
                >
                  거래일자
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[120px] text-right font-semibold">
                입금
              </TableHead>
              <TableHead className="w-[120px] text-right font-semibold">
                출금
              </TableHead>
              <TableHead className="w-[130px] text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort('balance')}
                  className="font-semibold ml-auto p-0 h-auto"
                  data-testid="sort-balance"
                >
                  잔액
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">비고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={showDocumentName ? 6 : 5} 
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm || typeFilter !== 'all' 
                    ? '검색 결과가 없습니다' 
                    : '거래내역이 없습니다'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTransactions.map((transaction, index) => (
                <TableRow 
                  key={transaction.id}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  data-testid={`transaction-row-${transaction.id}`}
                >
                  {showDocumentName && (
                    <TableCell 
                      className="text-xs text-muted-foreground"
                      title={transaction.documentName}
                    >
                      {truncateDocName(transaction.documentName || '')}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">
                    {transaction.transactionDate}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    {transaction.type === '입금' ? formatAmount(transaction.amount) : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {transaction.type === '출금' ? formatAmount(transaction.amount) : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatAmount(transaction.balance)}
                  </TableCell>
                  <TableCell 
                    className="text-sm max-w-[300px] truncate"
                    title={transaction.memo}
                  >
                    {transaction.memo || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 합계 */}
      {filteredAndSortedTransactions.length > 0 && (
        <div className="flex justify-end gap-6 text-sm px-2">
          <span className="text-muted-foreground">
            표시: <span className="font-medium text-foreground">{filteredAndSortedTransactions.length}건</span>
          </span>
          <span className="text-blue-600">
            입금 합계: <span className="font-mono font-medium">
              {formatAmount(filteredAndSortedTransactions.filter(t => t.type === '입금').reduce((sum, t) => sum + t.amount, 0))}
            </span>
          </span>
          <span className="text-red-600">
            출금 합계: <span className="font-mono font-medium">
              {formatAmount(filteredAndSortedTransactions.filter(t => t.type === '출금').reduce((sum, t) => sum + t.amount, 0))}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
