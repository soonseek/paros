/**
 * Fund Flow Filter Panel Component (Story 5.5: 추적 필터링)
 *
 * 자금 흐름 추적 결과 필터링 패널
 *
 * 기능:
 * - 날짜 범위 필터링
 * - 금액 범위 필터링
 * - 태그 필터링
 * - 거래 성격 필터링
 * - 중요 거래 필터링
 * - 복합 필터 적용
 * - 필터 초기화
 *
 * @component
 */

"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { useI18n } from "~/lib/i18n";
import { useFundFlowFilterStore } from "~/store/fundFlowFilterStore";
import type { TransactionNature } from "@prisma/client";
import { TRANSACTION_NATURE_TYPES } from "~/lib/constants/transaction-nature";

/**
 * FundFlowFilterPanel 컴포넌트 (Story 5.5, Task 1.1)
 */
export default function FundFlowFilterPanel() {
  const { t, formatMessage } = useI18n();
  const {
    filters,
    setDateRange,
    setAmountRange,
    setTags,
    setTransactionNature,
    setImportantOnly,
    resetFilters,
    hasActiveFilters,
    getActiveFilterCount,
  } = useFundFlowFilterStore();

  // Local state for form inputs
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");

  // Transaction nature selections
  const [selectedNatures, setSelectedNatures] = useState<TransactionNature[]>(
    filters.transactionNature ?? []
  );

  // Tag selections (mock tags for now - will be loaded from server)
  const allTags = ["loan", "collateral", "repayment", "seizure"];
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags ?? []);

  // Toggle transaction nature
  const toggleNature = (nature: TransactionNature) => {
    const newSelected = selectedNatures.includes(nature)
      ? selectedNatures.filter((n) => n !== nature)
      : [...selectedNatures, nature];

    setSelectedNatures(newSelected);
    setTransactionNature(newSelected);
  };

  // Toggle tag
  const toggleTag = (tag: string) => {
    const newSelected = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newSelected);
    setTags(newSelected);
  };

  // Apply date range filter
  const handleApplyDateRange = () => {
    if (startDate && endDate) {
      setDateRange(new Date(startDate), new Date(endDate));
    }
  };

  // Apply amount range filter
  const handleApplyAmountRange = () => {
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;

    if (min !== null || max !== null) {
      setAmountRange(min ?? 0, max ?? Number.MAX_SAFE_INTEGER);
    }
  };

  // Reset all filters
  const handleReset = () => {
    resetFilters();
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
    setSelectedNatures([]);
    setSelectedTags([]);
  };

  // Get active filter count
  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="w-full space-y-6 p-4 bg-background rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t("fundFlowFilter.title")}</h3>
          {activeFilterCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatMessage("fundFlowFilter.filterCount", { count: activeFilterCount })}
            </p>
          )}
        </div>
        {hasActiveFilters() && (
          <Badge variant="secondary">{activeFilterCount}</Badge>
        )}
      </div>

      {/* AC1: 필터 패널 표시 */}
      <div className="space-y-4">
        {/* AC2: 날짜 범위 필터링 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("fundFlowFilter.dateRange")}</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1"
              aria-label={t("fundFlowFilter.startDate")}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1"
              aria-label={t("fundFlowFilter.endDate")}
            />
          </div>
        </div>

        {/* AC3: 금액 범위 필터링 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("fundFlowFilter.amountRange")}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t("fundFlowFilter.minAmount")}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="flex-1"
              aria-label={t("fundFlowFilter.minAmount")}
            />
            <Input
              type="number"
              placeholder={t("fundFlowFilter.maxAmount")}
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="flex-1"
              aria-label={t("fundFlowFilter.maxAmount")}
            />
          </div>
        </div>

        {/* AC4: 태그 필터링 (OR 조건) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("fundFlowFilter.tags")}</Label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* 거래 성격 필터링 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("fundFlowFilter.transactionNature")}</Label>
          <div className="space-y-2">
            {TRANSACTION_NATURE_TYPES.map((nature) => (
              <div key={nature.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`nature-${nature.value}`}
                  checked={selectedNatures.includes(nature.value)}
                  onCheckedChange={() => toggleNature(nature.value)}
                />
                <Label
                  htmlFor={`nature-${nature.value}`}
                  className="text-sm cursor-pointer"
                >
                  {nature.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* 중요 거래 필터링 */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="important-only"
            checked={filters.importantOnly ?? false}
            onCheckedChange={(checked) => setImportantOnly(checked === true)}
          />
          <Label htmlFor="important-only" className="text-sm cursor-pointer">
            {t("fundFlowFilter.importantOnly")}
          </Label>
        </div>
      </div>

      {/* AC5: 복합 필터 (버튼들) */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={() => {
            handleApplyDateRange();
            handleApplyAmountRange();
          }}
          className="flex-1"
        >
          {t("fundFlowFilter.apply")}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          disabled={!hasActiveFilters()}
        >
          {t("fundFlowFilter.reset")}
        </Button>
      </div>
    </div>
  );
}
