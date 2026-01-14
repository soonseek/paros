/**
 * Search Filter Panel Component (Story 8.1: 기본 검색, Story 8.2: 복합 필터링)
 *
 * 다차원 검색 필터 UI (키워드, 날짜, 금액, 태그 + 거래유형, 성격, 중요, 신뢰도)
 *
 * @module components/molecules/search-filter-panel
 */

"use client";

import { useState, useEffect } from "react";
import { Search, X, Calendar, Hash, Badge, Filter, Star } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge as BadgeUI } from "~/components/ui/badge";
import type { ExtendedSearchFilters } from "~/types/search";

/**
 * Props 인터페이스 (Story 8.1, Task 1.2 + Story 8.2, Task 10)
 */
interface SearchFilterPanelProps {
  /** 현재 필터 상태 (Story 8.2: ExtendedSearchFilters) */
  filters: ExtendedSearchFilters;
  /** 필터 변경 핸들러 */
  onFiltersChange: (filters: ExtendedSearchFilters) => void;
  /** 필터 초기화 핸들러 */
  onReset: () => void;
  /** 사용 가능한 태그 목록 */
  availableTags: string[];
  /** 컴포넌트 크기 */
  size?: "default" | "compact";
  /** Story 8.2, Task 10.1: 필터 카운트 표시 여부 */
  showFilterCount?: boolean;
}

/**
 * SearchFilterPanel 컴포넌트 (Story 8.1, AC7 + Story 8.2, Task 10)
 *
 * 다차원 검색 필터 UI 제공 + 필터 카운트 및 배지 표시
 */
export function SearchFilterPanel({
  filters,
  onFiltersChange,
  onReset,
  availableTags,
  size = "default",
  showFilterCount = true,
}: SearchFilterPanelProps) {
  // 디바운스 상태 (Task 2.2: 300ms 딜레이)
  const [debouncedKeyword, setDebouncedKeyword] = useState(filters.keyword ?? "");

  // 디바운스 효과 (Task 2.2)
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, keyword: debouncedKeyword || undefined });
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedKeyword]);

  // 키워드 입력 변경 핸들러
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDebouncedKeyword(e.target.value);
  };

  // 날짜 변경 핸들러
  const handleDateChange = (field: "start" | "end", value: string) => {
    const date = value ? new Date(value) : undefined;
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: date,
      },
    });
  };

  // 금액 변경 핸들러 (Task 4.2: 숫자만 입력)
  const handleAmountChange = (field: "min" | "max", value: string) => {
    const num = value === "" ? undefined : Number.parseFloat(value);
    if (value === "" || ((num !== undefined) && !Number.isNaN(num) && num >= 0)) {
      onFiltersChange({
        ...filters,
        amountRange: {
          ...filters.amountRange,
          [field]: num,
        },
      });
    }
  };

  // 태그 토글 핸들러 (Task 5.3: 태그 선택/해제)
  const handleTagToggle = (tagName: string) => {
    const currentTags = filters.tags ?? [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];

    onFiltersChange({
      ...filters,
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  // Story 8.2, Task 10.2: 활성화된 필터 개수 계산
  const activeFilterCount = (() => {
    let count = 0;
    if (filters.keyword) count++;
    if (filters.dateRange?.start || filters.dateRange?.end) count++;
    if (filters.amountRange?.min !== undefined || filters.amountRange?.max !== undefined) count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.transactionType && filters.transactionType.length > 0) count++;
    if (filters.transactionNature && filters.transactionNature.length > 0) count++;
    if (filters.isImportantOnly) count++;
    if (filters.confidenceRange?.min !== undefined || filters.confidenceRange?.max !== undefined) count++;
    return count;
  })();

  // 컴팩트 모드 여부
  const isCompact = size === "compact";

  return (
    <div
      className={`space-y-4 p-4 border rounded-lg bg-white ${
        isCompact ? "p-3 space-y-3" : ""
      }`}
      role="search"
      aria-label="다차원 검색 필터"
    >
      {/* 키워드 검색 (AC7) */}
      <div className="space-y-2">
        <Label htmlFor="keyword-search" className="text-sm font-medium">
          메모에서 검색
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="keyword-search"
            type="text"
            placeholder="키워드 입력..."
            value={debouncedKeyword}
            onChange={handleKeywordChange}
            className="pl-9"
            aria-label="메모에서 키워드 검색"
          />
        </div>
      </div>

      {/* 날짜 범위 검색 (AC7) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">날짜 범위</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              placeholder="시작일"
              value={
                filters.dateRange?.start
                  ? new Date(filters.dateRange.start).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) => handleDateChange("start", e.target.value)}
              className="pl-9"
              aria-label="시작일"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              placeholder="종료일"
              value={
                filters.dateRange?.end
                  ? new Date(filters.dateRange.end).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) => handleDateChange("end", e.target.value)}
              className="pl-9"
              aria-label="종료일"
            />
          </div>
        </div>
      </div>

      {/* 금액 범위 검색 (AC7) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">금액 범위 (원)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="최소금액"
              min={0}
              step={1000}
              value={filters.amountRange?.min ?? ""}
              onChange={(e) => handleAmountChange("min", e.target.value)}
              className="pl-9"
              aria-label="최소금액"
            />
          </div>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="최대금액"
              min={0}
              step={1000}
              value={filters.amountRange?.max ?? ""}
              onChange={(e) => handleAmountChange("max", e.target.value)}
              className="pl-9"
              aria-label="최대금액"
            />
          </div>
        </div>
      </div>

      {/* 태그 다중 선택 (AC7) */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">태그</Label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {availableTags.map((tagName) => {
              const isSelected = (filters.tags ?? []).includes(tagName);
              return (
                <div
                  key={tagName}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => handleTagToggle(tagName)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTagToggle(tagName);
                    }
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={true}
                    className="pointer-events-none"
                  />
                  <span className="text-sm">{tagName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Story 8.2: 추가 필터 섹션 */}
      <div className="border-t pt-4 space-y-4">
        {/* 거래 유형 필터 (Task 3) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">거래 유형</Label>
          <div className="flex flex-wrap gap-2">
            {["DEPOSIT", "WITHDRAWAL", "TRANSFER"].map((type) => {
              const isSelected = filters.transactionType?.includes(type as any);
              const labels: Record<string, string> = {
                DEPOSIT: "입금",
                WITHDRAWAL: "출금",
                TRANSFER: "이체",
              };
              return (
                <button
                  key={type}
                  type="button"
                  className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    const current = filters.transactionType ?? [];
                    const newTypes = current.includes(type as any)
                      ? current.filter((t) => t !== type)
                      : [...current, type as any];
                    onFiltersChange({
                      ...filters,
                      transactionType: newTypes.length > 0 ? newTypes : undefined,
                    });
                  }}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 거래 성격 필터 (Task 4) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">거래 성격</Label>
          <div className="flex flex-wrap gap-2">
            {["CREDITOR", "COLLATERAL", "PRIORITY_REPAYMENT"].map((nature) => {
              const isSelected = filters.transactionNature?.includes(nature as any);
              const labels: Record<string, string> = {
                CREDITOR: "채권자",
                COLLATERAL: "담보",
                PRIORITY_REPAYMENT: "우선변제",
              };
              return (
                <button
                  key={nature}
                  type="button"
                  className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                    isSelected
                      ? "bg-purple-50 border-purple-500 text-purple-700"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    const current = filters.transactionNature ?? [];
                    const newNatures = current.includes(nature as any)
                      ? current.filter((n) => n !== nature)
                      : [...current, nature as any];
                    onFiltersChange({
                      ...filters,
                      transactionNature: newNatures.length > 0 ? newNatures : undefined,
                    });
                  }}
                >
                  {labels[nature]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 중요 거래 필터 (Task 5) */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="important-only"
            checked={filters.isImportantOnly ?? false}
            onCheckedChange={(checked) => {
              onFiltersChange({
                ...filters,
                isImportantOnly: checked === true ? true : undefined,
              });
            }}
          />
          <Label
            htmlFor="important-only"
            className="text-sm font-medium cursor-pointer flex items-center gap-1"
          >
            <Star className="h-4 w-4 text-yellow-500" />
            중요 거래만 보기
          </Label>
        </div>

        {/* AI 신뢰도 범위 필터 (Task 6) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">AI 신뢰도 범위</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="최소 (0~1)"
              min={0}
              max={1}
              step={0.1}
              value={filters.confidenceRange?.min ?? ""}
              onChange={(e) => {
                const num = e.target.value === "" ? undefined : Number.parseFloat(e.target.value);
                onFiltersChange({
                  ...filters,
                  confidenceRange: {
                    ...filters.confidenceRange,
                    min: num,
                  },
                });
              }}
            />
            <Input
              type="number"
              placeholder="최대 (0~1)"
              min={0}
              max={1}
              step={0.1}
              value={filters.confidenceRange?.max ?? ""}
              onChange={(e) => {
                const num = e.target.value === "" ? undefined : Number.parseFloat(e.target.value);
                onFiltersChange({
                  ...filters,
                  confidenceRange: {
                    ...filters.confidenceRange,
                    max: num,
                  },
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* 필터 초기화 버튼 + Story 8.2 Task 10.1: 필터 카운트 배지 */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onReset}
          className="flex-1"
          aria-label="필터 초기화"
        >
          <X className="mr-2 h-4 w-4" />
          필터 초기화
        </Button>
        {showFilterCount && activeFilterCount > 0 && (
          <BadgeUI variant="secondary" className="h-10 px-3 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span className="text-sm font-medium">{activeFilterCount}</span>
          </BadgeUI>
        )}
      </div>
    </div>
  );
}
