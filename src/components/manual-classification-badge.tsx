/**
 * Manual Classification Badge Component
 *
 * Story 4.5: 수동 분류 수정
 *
 * 사용자가 수동으로 수정한 카테고리를 표시하는 배지 컴포넌트
 * - "수정됨" 배지 표시
 * - 툴팁: 원본 분류 결과 및 수정 일시
 */

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useI18n } from "~/lib/i18n";

interface ManualClassificationBadgeProps {
  isManuallyClassified: boolean;
  originalCategory?: string | null;
  originalSubcategory?: string | null;
  manualClassificationDate?: Date | null;
  size?: "sm" | "md" | "lg";
}

/**
 * 수동 분류 수정 배지 컴포넌트
 *
 * @example
 * <ManualClassificationBadge
 *   isManuallyClassified={true}
 *   originalCategory="입금"
 *   originalSubcategory="이체"
 *   manualClassificationDate={new Date()}
 * />
 */
export function ManualClassificationBadge({
  isManuallyClassified,
  originalCategory,
  originalSubcategory,
  manualClassificationDate,
  size = "sm",
}: ManualClassificationBadgeProps) {
  const { t, formatDate } = useI18n();

  // 수동 수정이 아니면 아무것도 렌더링하지 않음
  if (!isManuallyClassified) {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  // 툴팁 내용 생성
  const getTooltipContent = () => {
    let content = "";

    if (originalCategory) {
      content = `${t("manualClassification.original")}: ${originalCategory}`;
      if (originalSubcategory) {
        content += ` > ${originalSubcategory}`;
      }
    }

    if (manualClassificationDate) {
      content += `\n${t("manualClassification.modifiedDate")}: ${formatDate(manualClassificationDate)}`;
    }

    return content;
  };

  const badgeContent = (
    <Badge
      variant="secondary"
      className={`${sizeClasses[size]} bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 font-medium`}
      role="status"
      aria-label={`${t("manualClassification.modifiedBadge")}${
        originalCategory ? `, ${t("manualClassification.original")}: ${originalCategory}` : ""
      }`}
    >
      <span className="mr-1" aria-hidden="true">
        ✏️
      </span>
      {t("manualClassification.modifiedBadge")}
    </Badge>
  );

  // 툴팁이 필요한 경우만 Tooltip으로 감싸기
  if (originalCategory || manualClassificationDate) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{badgeContent}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="whitespace-pre-line text-sm">{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}
