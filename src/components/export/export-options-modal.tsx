/**
 * Export Options Modal (Story 7.1, Task 1.1; Story 7.2, Task 2.2)
 *
 * Excel 내보내기 옵션을 선택하는 모달 컴포넌트
 *
 * @module components/export/export-options-modal
 */

import { useState, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Progress } from "~/components/ui/progress";
import {
  ColumnSelector,
  type OptionalColumn,
} from "./column-selector";
import {
  FindingFilterOptions,
  type FindingFilterOptions as FindingFilters,
} from "./finding-filter-options";

/**
 * Export 옵션 타입 (Story 7.2 확장, Story 7.3 활성화)
 */
export type ExportOption =
  | "full"
  | "selected"
  | "filtered"
  | "transactions"
  | "findings"
  | "fundFlow";

/**
 * ExportOptionsModal 컴포넌트 Props (Story 7.2 확장, Story 7.3 Finding 필터 추가)
 */
export interface ExportOptionsModalProps {
  /** 사건 ID */
  caseId: string;
  /** 내보내기 mutation (tRPC) */
  onExport: (option: ExportOption, transactionIds?: string[], selectedColumns?: OptionalColumn[], findingFilters?: FindingFilters) => Promise<void>;
  /** 현재 진행률 (0-100) */
  progress?: number;
  /** 내보내기 중 여부 */
  isExporting?: boolean;
  /** 트리거 요소 (버튼 등) */
  children: React.ReactNode;
  /** 선택된 거래 ID 목록 (Story 7.2) */
  selectedTransactionIds?: string[];
  /** 필터링된 결과인지 여부 (Story 7.2) */
  isFiltered?: boolean;
}

/**
 * ExportOptionsModal 컴포넌트
 *
 * Story 7.1, AC1: 내보내기 옵션 모달 표시
 * Story 7.2, AC1/AC2/AC3: 선택/필터 내보내기, 포함할 열 선택
 * - "전체 분석 결과 내보내기" (기본 선택)
 * - "선택 내보내기" (Story 7.2, AC1)
 * - "필터 결과 내보내기" (Story 7.2, AC2)
 * - 진행률 표시 (SSE Progress 표시)
 * - 포함할 열 선택 (Story 7.2, AC3)
 *
 * @example
 * ```tsx
 * <ExportOptionsModal
 *   caseId={caseId}
 *   onExport={async (option, transactionIds, selectedColumns) => {
 *     await exportMutation.mutateAsync({ caseId, option, transactionIds, selectedColumns });
 *   }}
 *   progress={progress}
 *   isExporting={isExporting}
 *   selectedTransactionIds={selectedIds}
 *   isFiltered={hasFilters}
 * >
 *   <Button variant="outline">
 *     <Download className="w-4 h-4 mr-2" />
 *     내보내기
 *   </Button>
 * </ExportOptionsModal>
 * ```
 */
export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  caseId,
  onExport,
  progress = 0,
  isExporting = false,
  children,
  selectedTransactionIds = [],
  isFiltered = false,
}) => {
  const [open, setOpen] = useState(false);
  const [exportOption, setExportOption] = useState<ExportOption>("full");
  const [selectedColumns, setSelectedColumns] = useState<OptionalColumn[]>([
    "AI 분류",
    "거래 성격",
    "신뢰도",
  ]);
  // Story 7.3: Finding 필터 옵션
  const [findingFilters, setFindingFilters] = useState<FindingFilters>({
    sortBy: "priority-severity-date",
  });

  /**
   * 모달이 열릴 때 기본 옵션 설정 (Story 7.2)
   * - 선택된 거래가 있으면 "selected"를 기본으로
   * - 필터가 적용되어 있으면 "filtered"를 기본으로
   */
  useEffect(() => {
    if (open) {
      if (selectedTransactionIds.length > 0) {
        setExportOption("selected");
      } else if (isFiltered) {
        setExportOption("filtered");
      } else {
        setExportOption("full");
      }
    }
  }, [open, selectedTransactionIds.length, isFiltered]);

  /**
   * 내보내기 핸들러 (Story 7.2 확장, Story 7.3 Finding 필터 전달)
   * - 옵션 선택 → 내보내기 시작 → 진행률 표시 → 완료 후 모달 닫기
   */
  const handleExport = async () => {
    try {
      await onExport(
        exportOption,
        exportOption === "selected" ? selectedTransactionIds : undefined,
        selectedColumns,
        exportOption === "findings" ? findingFilters : undefined
      );
      // 성공 시 모달 닫기
      setOpen(false);
    } catch (error) {
      // 에러는 부모 컴포넌트에서 toast로 표시
      console.error("Export failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>분석 결과 내보내기</DialogTitle>
          <DialogDescription>
            내보내기 옵션을 선택하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AC1: 내보내기 옵션 라디오 버튼 (Story 7.2 확장) */}
          <div className="space-y-2">
            <Label>내보내기 옵션</Label>
            <RadioGroup
              value={exportOption}
              onValueChange={(value) => setExportOption(value as ExportOption)}
              disabled={isExporting}
            >
              {/* Story 7.1: "전체 분석 결과 내보내기" */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="cursor-pointer">
                  전체 분석 결과 내보내기
                </Label>
              </div>

              {/* Story 7.2, AC1: "선택 내보내기" */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="selected"
                  id="selected"
                  disabled={selectedTransactionIds.length === 0}
                />
                <Label
                  htmlFor="selected"
                  className={`cursor-pointer ${
                    selectedTransactionIds.length === 0
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  선택 내보내기 ({selectedTransactionIds.length}개)
                </Label>
              </div>

              {/* Story 7.2, AC2: "필터 결과 내보내기" */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="filtered"
                  id="filtered"
                  disabled={!isFiltered}
                />
                <Label
                  htmlFor="filtered"
                  className={`cursor-pointer ${
                    !isFiltered ? "text-muted-foreground" : ""
                  }`}
                >
                  현재 필터 결과 내보내기
                </Label>
              </div>

              {/* 향후 스토리를 위한 옵션 */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="transactions" id="transactions" disabled />
                <Label htmlFor="transactions" className="cursor-pointer text-muted-foreground">
                  거래 내역 내보내기 (향후 지원)
                </Label>
              </div>

              {/* Story 7.3: 발견사항 내보내기 */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="findings" id="findings" />
                <Label htmlFor="findings" className="cursor-pointer">
                  발견사항 내보내기
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fundFlow" id="fundFlow" disabled />
                <Label htmlFor="fundFlow" className="cursor-pointer text-muted-foreground">
                  자금 흐름 추적 결과 내보내기 (향후 지원)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Story 7.2, AC3: 포함할 열 선택 (거래 내보내기만) */}
          {exportOption !== "findings" && (
            <ColumnSelector
              selectedColumns={selectedColumns}
              onColumnChange={setSelectedColumns}
            />
          )}

          {/* Story 7.3, AC5: Finding 필터 옵션 */}
          {exportOption === "findings" && (
            <FindingFilterOptions
              filters={findingFilters}
              onFilterChange={setFindingFilters}
            />
          )}

          {/* 진행률 표시 (SSE Progress 표시) */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>내보내는 중...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>

        {/* 내보내기 버튼 (Primary action) */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            취소
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                내보내는 중...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
