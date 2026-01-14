/**
 * Column Selector Component (Story 7.2, Task 2.1)
 *
 * Excel 내보내기 시 포함할 열을 선택하는 컴포넌트
 *
 * @module components/export/column-selector
 */

"use client";

import { useEffect } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

/**
 * 사용 가능한 컬럼 정의
 */
const AVAILABLE_COLUMNS = [
  { key: "메모", label: "메모", default: false },
  { key: "태그", label: "태그", default: false },
  { key: "AI 분류", label: "AI 분류", default: true },
  { key: "거래 성격", label: "거래 성격", default: true },
  { key: "신뢰도", label: "신뢰도", default: true },
] as const;

export type OptionalColumn = typeof AVAILABLE_COLUMNS[number]["key"];

/**
 * ColumnSelector 컴포넌트 Props
 */
export interface ColumnSelectorProps {
  /** 선택된 컬럼 목록 */
  selectedColumns: OptionalColumn[];
  /** 컬럼 변경 핸들러 */
  onColumnChange: (columns: OptionalColumn[]) => void;
}

/**
 * ColumnSelector 컴포넌트
 *
 * Story 7.2, AC3: 포함할 열 선택
 * - 기본 열: 거래ID, 날짜, 입금액, 출금액 (무조건 포함)
 * - 선택 열: 메모, 태그, AI 분류, 거래 성격, 신뢰도 (사용자 선택)
 * - localStorage에 선택 저장
 *
 * @example
 * ```tsx
 * const [selectedColumns, setSelectedColumns] = useState<OptionalColumn[]>(['AI 분류', '거래 성격']);
 *
 * <ColumnSelector
 *   selectedColumns={selectedColumns}
 *   onColumnChange={setSelectedColumns}
 * />
 * ```
 */
export function ColumnSelector({
  selectedColumns,
  onColumnChange,
}: ColumnSelectorProps) {
  // localStorage에서 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("export-columns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as OptionalColumn[];
        onColumnChange(parsed);
      } catch (error) {
        console.error("Failed to parse saved columns:", error);
      }
    }
  }, []);

  /**
   * 컬럼 토글 핸들러
   */
  const handleToggle = (column: OptionalColumn) => {
    const newColumns = selectedColumns.includes(column)
      ? selectedColumns.filter((c) => c !== column)
      : [...selectedColumns, column];

    onColumnChange(newColumns);

    // localStorage에 저장
    localStorage.setItem("export-columns", JSON.stringify(newColumns));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        포함할 열 선택
      </Label>
      <div className="space-y-2">
        {AVAILABLE_COLUMNS.map((col) => (
          <div key={col.key} className="flex items-center space-x-2">
            <Checkbox
              id={col.key}
              checked={selectedColumns.includes(col.key)}
              onCheckedChange={() => handleToggle(col.key)}
            />
            <Label
              htmlFor={col.key}
              className="cursor-pointer text-sm text-gray-700"
            >
              {col.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
