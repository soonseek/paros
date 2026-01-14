/**
 * Export Fund Flow Button Component (Story 7.4: 자금 흐름 추적 결과 내보내기)
 *
 * 자금 흐름 추적 결과 내보내기 버튼
 *
 * @module components/molecules/export-fund-flow-button
 */

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";
import { ExportFundFlowModal } from "./export-fund-flow-modal";
import type { FundFlowFilters } from "~/lib/filter-utils";

/**
 * Props 인터페이스 (Story 5.6, Task 3.1)
 */
interface ExportFundFlowButtonProps {
  /** 사건 ID */
  caseId: string;
  /** 선택된 체인 ID 목록 (선택 내보내기용) */
  selectedChainIds?: string[];
  /** 현재 필터 상태 (필터링 내보내기용) */
  filters?: FundFlowFilters;
  /** 사용 가능한 내보내기 옵션 */
  availableOptions?: Array<"all" | "filtered" | "selected">;
  /** 버튼 크기 */
  size?: "default" | "sm" | "lg" | "icon";
  /** 버튼 variant */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  /** 커스텀 버튼 텍스트 */
  buttonText?: string;
  /** 커스텀 버튼 아이콘 */
  icon?: React.ReactNode;
}

/**
 * ExportFundFlowButton 컴포넌트 (Story 5.6, AC1)
 *
 * 내보내기 버튼을 클릭하면 내보내기 옵션 모달을 표시
 */
export function ExportFundFlowButton({
  caseId,
  selectedChainIds = [],
  filters,
  availableOptions = ["all", "filtered", "selected"],
  size = "default",
  variant = "default",
  buttonText = "내보내기",
  icon = <Download className="h-4 w-4" />,
}: ExportFundFlowButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setIsModalOpen(true)}
      >
        {icon}
        {buttonText}
      </Button>

      <ExportFundFlowModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        caseId={caseId}
        selectedChainIds={selectedChainIds}
        filters={filters}
        availableOptions={availableOptions}
      />
    </>
  );
}
