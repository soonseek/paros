/**
 * Finding List Component with Filtering (Story 6.1)
 *
 * 발견사항 목록 및 필터링 컴포넌트
 * - severity별 필터링 (CRITICAL, WARNING, INFO, All)
 * - findingType별 필터링
 * - severity별 정렬 (CRITICAL → WARNING → INFO)
 * - FindingCard 렌더링
 *
 * @module components/molecules/finding-list
 */

"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Filter } from "lucide-react";
import { useI18n } from "~/lib/i18n/index";
import { FindingCard } from "~/components/finding-card";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CreditorFilterPanel } from "~/components/molecules/creditor-filter-panel";
import { sortFindingsByResolvedAndPriority } from "~/lib/sort-utils"; // Story 6.5

interface Transaction {
  id: string;
  transactionDate: Date;
  depositAmount: string | null;
  withdrawalAmount: string | null;
  memo: string | null;
}

interface Finding {
  id: string;
  findingType: string;
  title: string;
  description: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  priority: "HIGH" | "MEDIUM" | "LOW" | null; // Story 6.5: 사용자 지정 중요도
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  transaction: Transaction | null;
  relatedTransactionIds: string[];
  relatedCreditorNames: string | null;
}

interface FindingListProps {
  findings: Finding[];
  onUpdate?: () => void;
  // Story 6.2: FindingCard 클릭 핸들러
  onFindingClick?: (finding: Finding) => void;
  // Story 6.4: 채권자 필터링 (선택 사항)
  creditorNames?: string[];
  caseId?: string; // 채권자 필터 사용 시 필요
  // Story 6.5: priority 필터링 (사용자 지정 중요도만 보기)
  showPriorityOnly?: boolean;
  onPriorityFilterChange?: (show: boolean) => void;
}

/**
 * Finding List with Filtering (Story 6.1, AC5, Story 6.4)
 */
export function FindingList({
  findings,
  onUpdate,
  onFindingClick,
  creditorNames,
  caseId,
  showPriorityOnly = false,
  onPriorityFilterChange,
}: FindingListProps) {
  const { t } = useI18n();

  // 필터 상태
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [findingTypeFilter, setFindingTypeFilter] = useState<string>("all");

  // Story 6.4: 채권자 필터 상태
  const [selectedCreditors, setSelectedCreditors] = useState<string[]>(creditorNames ?? []);
  const [showCreditorFilter, setShowCreditorFilter] = useState(false);

  // Story 6.5: priority 필터 상태
  const [priorityOnlyFilter, setPriorityOnlyFilter] = useState<boolean>(showPriorityOnly);

  // Story 6.4: creditorNames prop이 변경되면 내부 상태 업데이트 (Task 7.3 수정)
  useEffect(() => {
    if (creditorNames !== undefined) {
      setSelectedCreditors(creditorNames);
    }
  }, [creditorNames]);

  // Story 6.5: showPriorityOnly prop이 변경되면 내부 상태 업데이트
  useEffect(() => {
    setPriorityOnlyFilter(showPriorityOnly);
  }, [showPriorityOnly]);

  // severity별 필터링
  const filteredBySeverity = findings.filter((finding) => {
    if (severityFilter === "all") return true;
    return finding.severity === severityFilter;
  });

  // findingType별 필터링
  const filteredByType = filteredBySeverity.filter((finding) => {
    if (findingTypeFilter === "all") return true;
    return finding.findingType === findingTypeFilter;
  });

  // Story 6.4 AC2, AC3: 채권자별 필터링 (OR 조건)
  const filteredByCreditors = filteredByType.filter((finding) => {
    // 채권자 필터가 비어있으면 모든 Finding 표시
    if (selectedCreditors.length === 0) return true;

    // relatedCreditorNames 파싱
    let creditorNames: string[] = [];
    if (finding.relatedCreditorNames) {
      try {
        creditorNames = JSON.parse(finding.relatedCreditorNames);
      } catch (e) {
        console.error("Failed to parse relatedCreditorNames:", e);
      }
    }

    // OR 조건: 선택된 채권자 중 하나라도 포함되면 true
    return selectedCreditors.some((selectedCreditor) =>
      creditorNames.some(
        (creditor) =>
          creditor.toLowerCase().trim() === selectedCreditor.toLowerCase().trim()
      )
    );
  });

  // Story 6.5 AC4: 사용자 지정 중요도 필터링 (priority !== null만 표시)
  const filteredByPriority = filteredByCreditors.filter((finding) => {
    if (!priorityOnlyFilter) return true; // 필터가 비활성화면 모두 표시
    return finding.priority !== null; // priority가 있는 Finding만 표시
  });

  // Story 6.5: 미해결 Finding을 먼저, priority > severity > createdAt 순으로 정렬
  const sortedFindings = sortFindingsByResolvedAndPriority(filteredByPriority);

  // 고유한 findingType 목록 추출
  const uniqueFindingTypes = Array.from(
    new Set(findings.map((f) => f.findingType))
  ).sort();

  // 빈 상태 처리
  if (findings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
        <p className="text-lg font-medium">{t("finding.title")} 없음</p>
        <p className="text-sm">표시할 발견사항이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {t("finding.title")} ({sortedFindings.length}건)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            미해결: {findings.filter((f) => !f.isResolved).length}건
          </p>
        </div>

        {/* 필터 컨트롤 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">필터</span>
          </div>

          {/* severity 필터 */}
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="심각도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              <SelectItem value="WARNING">WARNING</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
            </SelectContent>
          </Select>

          {/* Story 6.4: 채권자 필터 토글 버튼 */}
          {caseId && (
            <Button
              variant={showCreditorFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCreditorFilter(!showCreditorFilter)}
              className="relative"
            >
              채권자 필터
              {selectedCreditors.length > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {selectedCreditors.length}
                </span>
              )}
            </Button>
          )}

          {/* findingType 필터 */}
          {uniqueFindingTypes.length > 0 && (
            <Select value={findingTypeFilter} onValueChange={setFindingTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                {uniqueFindingTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Story 6.5: 사용자 지정 중요도 필터 토글 버튼 */}
          <Button
            variant={priorityOnlyFilter ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const newValue = !priorityOnlyFilter;
              setPriorityOnlyFilter(newValue);
              onPriorityFilterChange?.(newValue);
            }}
          >
            중요도 지정만
          </Button>
        </div>
      </div>

      {/* Story 6.4: 채권자 필터 패널 */}
      {showCreditorFilter && caseId && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <CreditorFilterPanel
            caseId={caseId}
            selectedCreditors={selectedCreditors}
            onSelectionChange={setSelectedCreditors}
          />
        </div>
      )}

      {/* 필터 결과 없음 */}
      {sortedFindings.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <Filter className="w-8 h-8 mx-auto mb-2 text-gray-400" aria-hidden="true" />
          <p className="text-sm">해당 필터 조건에 맞는 발견사항이 없습니다.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSeverityFilter("all");
              setFindingTypeFilter("all");
              setSelectedCreditors([]);
              setPriorityOnlyFilter(false);
              onPriorityFilterChange?.(false);
            }}
          >
            필터 초기화
          </Button>
        </div>
      )}

      {/* Finding 목록 */}
      {sortedFindings.length > 0 && (
        <div className="space-y-4">
          {sortedFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              caseId={caseId ?? ""}
              onResolve={onUpdate}
              onUnresolve={onUpdate}
              onClick={onFindingClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
