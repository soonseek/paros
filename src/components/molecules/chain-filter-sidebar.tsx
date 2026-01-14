/**
 * Chain Filter Sidebar Component (Story 5.4)
 *
 * 체인 유형별 필터링 사이드바
 *
 * 기능:
 * - 체인 유형별 다중 선택
 * - 전체 선택 토글
 * - 필터 상태 관리
 *
 * @component
 */

import React from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

// Chain Types
export type ChainType =
  | "LOAN_EXECUTION"
  | "DEBT_SETTLEMENT"
  | "COLLATERAL_RIGHT"
  | "UPSTREAM"
  | "DOWNSTREAM";

interface ChainFilterSidebarProps {
  selectedTypes: ChainType[];
  onSelectionChange: (types: ChainType[]) => void;
}

const CHAIN_TYPE_LABELS: Record<ChainType, string> = {
  LOAN_EXECUTION: "대출 실행",
  DEBT_SETTLEMENT: "채무 변제",
  COLLATERAL_RIGHT: "담보권 설정",
  UPSTREAM: "자금 출처",
  DOWNSTREAM: "자금 사용처",
};

/**
 * ChainFilterSidebar 컴포넌트
 */
export default function ChainFilterSidebar({
  selectedTypes,
  onSelectionChange,
}: ChainFilterSidebarProps) {
  const allTypes: ChainType[] = [
    "LOAN_EXECUTION",
    "DEBT_SETTLEMENT",
    "COLLATERAL_RIGHT",
    "UPSTREAM",
    "DOWNSTREAM",
  ];

  const allSelected = allTypes.every((type) => selectedTypes.includes(type));
  const someSelected =
    selectedTypes.length > 0 && selectedTypes.length < allTypes.length;

  // 전체 선택 토글
  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allTypes);
    }
  };

  // 개별 체인 유형 토글
  const handleToggleType = (type: ChainType) => {
    if (selectedTypes.includes(type)) {
      onSelectionChange(selectedTypes.filter((t) => t !== type));
    } else {
      onSelectionChange([...selectedTypes, type]);
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h3 className="font-semibold text-sm mb-1">체인 필터</h3>
        <p className="text-xs text-muted-foreground">
          표시할 체인 유형을 선택하세요
        </p>
      </div>

      {/* 전체 선택 */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={handleToggleAll}
        />
        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          전체 선택
        </Label>
      </div>

      {/* 체인 유형 목록 */}
      <div className="space-y-2">
        {allTypes.map((type) => (
          <div key={type} className="flex items-center space-x-2">
            <Checkbox
              id={type}
              checked={selectedTypes.includes(type)}
              onCheckedChange={() => handleToggleType(type)}
            />
            <Label htmlFor={type} className="text-sm cursor-pointer">
              {CHAIN_TYPE_LABELS[type]}
            </Label>
          </div>
        ))}
      </div>

      {/* 선택된 개수 표시 */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          {selectedTypes.length} / {allTypes.length}개 선택됨
        </p>
      </div>
    </div>
  );
}
