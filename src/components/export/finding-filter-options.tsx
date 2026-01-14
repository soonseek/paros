/**
 * Finding Filter Options (Story 7.3, Task 1.2)
 *
 * 발견사항 내보내기 필터 옵션 컴포넌트
 *
 * @module components/export/finding-filter-options
 */

import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/**
 * Finding 필터 옵션 인터페이스 (Story 7.3, AC5)
 */
export interface FindingFilterOptions {
  /** 해결 여부 필터: undefined=전체, false=미해결만, true=해결만 */
  isResolved?: boolean;
  /** Severity 필터 */
  severity?: "CRITICAL" | "WARNING" | "INFO";
  /** Priority 필터 */
  priority?: "HIGH" | "MEDIUM" | "LOW";
  /** 정렬 순서 */
  sortBy?: "priority-severity-date" | "severity-date" | "date";
}

/**
 * FindingFilterOptions 컴포넌트 Props
 */
export interface FindingFilterOptionsProps {
  /** 현재 필터 옵션 */
  filters: FindingFilterOptions;
  /** 필터 변경 핸들러 */
  onFilterChange: (filters: FindingFilterOptions) => void;
}

/**
 * FindingFilterOptions 컴포넌트
 *
 * Story 7.3, AC5: 발견사항 내보내기 필터 옵션
 * - 해결 여부 필터 (전체/미해결/해결)
 * - Severity 필터 (전체/CRITICAL/WARNING/INFO)
 * - Priority 필터 (전체/HIGH/MEDIUM/LOW)
 * - 정렬 순서 선택 (기본: Priority → Severity → 생성일시)
 *
 * @example
 * ```tsx
 * <FindingFilterOptions
 *   filters={findingFilters}
 *   onFilterChange={setFindingFilters}
 * />
 * ```
 */
export const FindingFilterOptions: React.FC<FindingFilterOptionsProps> = ({
  filters,
  onFilterChange,
}) => {
  /**
   * 해결 여부 필터 변경 핸들러
   * - 체크: 미해결만 (isResolved: false)
   * - 미체크: 전체 (isResolved: undefined)
   */
  const handleUnresolvedChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      isResolved: checked ? false : undefined,
    });
  };

  /**
   * 해결됨 필터 변경 핸들러
   * - 체크: 해결만 (isResolved: true)
   * - 미체크: 전체 (isResolved: undefined)
   */
  const handleResolvedChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      isResolved: checked ? true : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* 해결 여부 필터 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">해결 여부</Label>
        <div className="flex flex-col gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="unresolved-only"
              checked={filters.isResolved === false}
              onCheckedChange={handleUnresolvedChange}
            />
            <Label htmlFor="unresolved-only" className="cursor-pointer text-sm">
              미해결만
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="resolved-only"
              checked={filters.isResolved === true}
              onCheckedChange={handleResolvedChange}
            />
            <Label htmlFor="resolved-only" className="cursor-pointer text-sm">
              해결만
            </Label>
          </div>
        </div>
      </div>

      {/* Severity 필터 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">중요도 (Severity)</Label>
        <Select
          value={filters.severity ?? "all"}
          onValueChange={(value) => {
            onFilterChange({
              ...filters,
              severity: value === "all" ? undefined : value as "CRITICAL" | "WARNING" | "INFO",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="CRITICAL">CRITICAL (심각)</SelectItem>
            <SelectItem value="WARNING">WARNING (경고)</SelectItem>
            <SelectItem value="INFO">INFO (정보)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Priority 필터 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">우선순위 (Priority)</Label>
        <Select
          value={filters.priority ?? "all"}
          onValueChange={(value) => {
            onFilterChange({
              ...filters,
              priority: value === "all" ? undefined : value as "HIGH" | "MEDIUM" | "LOW",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="HIGH">HIGH (높음)</SelectItem>
            <SelectItem value="MEDIUM">MEDIUM (중간)</SelectItem>
            <SelectItem value="LOW">LOW (낮음)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 정렬 순서 선택 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">정렬 순서</Label>
        <Select
          value={filters.sortBy ?? "priority-severity-date"}
          onValueChange={(value) => {
            onFilterChange({
              ...filters,
              sortBy: value as "priority-severity-date" | "severity-date" | "date",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority-severity-date">
              Priority → Severity → 생성일시
            </SelectItem>
            <SelectItem value="severity-date">
              Severity → 생성일시
            </SelectItem>
            <SelectItem value="date">생성일시만</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
