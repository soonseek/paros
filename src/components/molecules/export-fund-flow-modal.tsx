/**
 * Export Fund Flow Modal Component (Story 7.4: 자금 흐름 추적 결과 내보내기)
 *
 * 자금 흐름 추적 결과 내보내기 옵션 모달
 *
 * @module components/molecules/export-fund-flow-modal
 */

import { useState } from "react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import type { FundFlowFilters } from "~/lib/filter-utils";

/**
 * 내보내기 옵션 타입 (Story 5.6, AC1)
 */
export type ExportOption = "all" | "filtered" | "selected";

/**
 * Props 인터페이스 (Story 5.6, Task 3.2)
 */
interface ExportFundFlowModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 사건 ID */
  caseId: string;
  /** 선택된 체인 ID 목록 (선택 내보내기용) */
  selectedChainIds?: string[];
  /** 현재 필터 상태 (필터링 내보내기용) */
  filters?: FundFlowFilters;
  /** 사용 가능한 내보내기 옵션 */
  availableOptions?: ExportOption[];
}

/**
 * 내보내기 옵션 라디오 아이템 컴포넌트
 */
interface ExportOptionItemProps {
  value: ExportOption;
  selected: ExportOption;
  onSelect: (value: ExportOption) => void;
  label: string;
  description: string;
  disabled?: boolean;
}

function ExportOptionItem({
  value,
  selected,
  onSelect,
  label,
  description,
  disabled = false,
}: ExportOptionItemProps) {
  return (
    <div
      className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
        selected === value
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !disabled && onSelect(value)}
    >
      <div className="flex h-5 items-center">
        <div
          className={`h-4 w-4 rounded-full border-2 ${
            selected === value ? "border-blue-500 bg-blue-500" : "border-gray-300"
          }`}
        >
          {selected === value && (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

/**
 * ExportFundFlowModal 컴포넌트 (Story 5.6, AC1)
 *
 * 내보내기 옵션을 선택하고 엑셀 파일을 다운로드하는 모달
 */
export function ExportFundFlowModal({
  open,
  onOpenChange,
  caseId,
  selectedChainIds = [],
  filters,
  availableOptions = ["all", "filtered", "selected"],
}: ExportFundFlowModalProps) {
  // 내보내기 옵션 상태
  const [exportOption, setExportOption] = useState<ExportOption>("all");
  const [includeVisualization, setIncludeVisualization] = useState(false);

  // tRPC mutation
  const exportMutation = api.fundFlow.exportFundFlowResult.useMutation();

  /**
   * 내보내기 실행 핸들러 (Story 5.6, AC4)
   */
  const handleExport = async () => {
    try {
      // 엑셀 파일 생성 요청
      const result = await exportMutation.mutateAsync({
        caseId,
        chainIds: exportOption === "selected" ? selectedChainIds : undefined,
        exportOption,
        includeVisualization,
        filters: exportOption === "filtered" ? filters : undefined,
      });

      if (!result?.data) {
        throw new Error("응답 데이터가 없습니다");
      }

      // CRITICAL #1: Base64 데이터를 디코딩하여 Blob 생성
      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], {
        type: result.mimeType,
      });

      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      // 성공 메시지 (AC4)
      toast.success(`${result.filename} 다운로드 완료`);

      // 모달 닫기
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
      toast.error(`내보내기 실패: ${errorMsg}`);
    }
  };

  /**
   * 옵션 선택 가능 여부 확인
   */
  const canSelectFiltered = availableOptions.includes("filtered") && filters && Object.keys(filters).length > 0;
  const canSelectSelected = availableOptions.includes("selected") && selectedChainIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>자금 흐름 추적 결과 내보내기</DialogTitle>
          <DialogDescription>
            내보내기 옵션을 선택하고 엑셀 파일로 다운로드하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 내보내기 옵션 (AC1) */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">내보내기 범위</Label>

            <ExportOptionItem
              value="all"
              selected={exportOption}
              onSelect={setExportOption}
              label="체인 전체 내보내기"
              description="모든 추적 체인과 거래를 포함하여 내보냅니다."
            />

            <ExportOptionItem
              value="filtered"
              selected={exportOption}
              onSelect={setExportOption}
              label="필터링된 결과만 내보내기"
              description="현재 적용된 필터 조건에 맞는 결과만 내보냅니다."
              disabled={!canSelectFiltered}
            />

            <ExportOptionItem
              value="selected"
              selected={exportOption}
              onSelect={setExportOption}
              label="선택된 체인만 내보내기"
              description={`선택한 ${selectedChainIds.length}개 체인만 내보냅니다.`}
              disabled={!canSelectSelected}
            />
          </div>

          {/* 시각화 포함 옵션 (AC1) */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-visualization"
              checked={includeVisualization}
              onCheckedChange={(checked) => setIncludeVisualization(checked === true)}
            />
            <Label htmlFor="include-visualization" className="text-sm cursor-pointer">
              시각화 그래프 포함 (선택사항)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exportMutation.isPending}
          >
            취소
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="min-w-[120px]"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                내보내기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
