/**
 * Transaction Nature Badge Component
 *
 * Story 4.4: 거래 성격 판단
 *
 * 거래의 성격(채권자 관련, 담보 관련, 우선변제 관련, 일반 거래)을 시각적으로 표시하는 배지 컴포넌트
 */

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useI18n } from "~/lib/i18n";

/**
 * 거래 성격 타입
 */
export type TransactionNatureType =
  | "CREDITOR"
  | "COLLATERAL"
  | "PRIORITY_REPAYMENT"
  | "GENERAL"
  | null;

/**
 * 담보 유형
 */
export type CollateralType = "MORTGAGE" | "LIEN" | "POSSESSION" | null;

interface TransactionNatureBadgeProps {
  nature: TransactionNatureType;
  creditorName?: string | null;
  collateralType?: CollateralType;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

/**
 * 거래 성격별 스타일 설정
 */
const NATURE_STYLES = {
  CREDITOR: {
    variant: "secondary" as const,
    className: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
    icon: "👤",
  },
  COLLATERAL: {
    variant: "secondary" as const,
    className: "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300",
    icon: "🔒",
  },
  PRIORITY_REPAYMENT: {
    variant: "secondary" as const,
    className: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300",
    icon: "⚠️",
  },
  GENERAL: {
    variant: "outline" as const,
    className: "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-300",
    icon: "",
  },
};

/**
 * 거래 성격 배지 컴포넌트
 *
 * @example
 * <TransactionNatureBadge nature="CREDITOR" creditorName="김주택" />
 * <TransactionNatureBadge nature="PRIORITY_REPAYMENT" size="lg" showIcon />
 */
export function TransactionNatureBadge({
  nature,
  creditorName,
  collateralType,
  size = "md",
  showIcon = false,
}: TransactionNatureBadgeProps) {
  const { t } = useI18n();

  // null이면 아무것도 렌더링하지 않음
  if (!nature) {
    return null;
  }

  const style = NATURE_STYLES[nature];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  // 툴팁 내용 생성
  const getTooltipContent = () => {
    const natureLabel = t(`transactionNature.types.${nature}`);
    let details = "";

    if (nature === "CREDITOR" && creditorName) {
      details = `\n${t("transactionNature.creditorName")}: ${creditorName}`;
    } else if (nature === "COLLATERAL" && collateralType) {
      const collateralLabel = t(`transactionNature.collateralTypes.${collateralType}`);
      details = `\n${t("transactionNature.collateralType")}: ${collateralLabel}`;
    }

    return `${natureLabel}${details}`;
  };

  const badgeContent = (
    <Badge
      variant={style.variant}
      className={`${sizeClasses[size]} ${style.className} font-medium`}
      role="status"
      aria-label={`${t("transactionNature.label")}: ${t(`transactionNature.types.${nature}`)}${creditorName ? `, ${t("transactionNature.creditorName")}: ${creditorName}` : ""}${collateralType ? `, ${t("transactionNature.collateralType")}: ${collateralType}` : ""}`}
    >
      {showIcon && style.icon && <span className="mr-1">{style.icon}</span>}
      {t(`transactionNature.types.${nature}`)}
    </Badge>
  );

  // 툴팁이 필요한 경우만 Tooltip으로 감싸기
  if (creditorName || collateralType) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{badgeContent}</span>
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

/**
 * 심각도(Serverty) 배지 컴포넌트 (Finding용)
 *
 * Story 4.3: FindingCard에서 사용
 * Story 4.4: PRIORITY_REPAYMENT Finding에서도 활용
 */
export function SeverityBadge({
  severity,
  size = "md",
}: {
  severity: "INFO" | "WARNING" | "CRITICAL";
  size?: "sm" | "md" | "lg";
}) {
  const { t } = useI18n();

  const SEVERITY_STYLES = {
    INFO: {
      variant: "secondary" as const,
      className: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
      icon: "ℹ️",
    },
    WARNING: {
      variant: "secondary" as const,
      className: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300",
      icon: "⚠️",
    },
    CRITICAL: {
      variant: "secondary" as const,
      className: "bg-red-100 text-red-800 hover:bg-red-200 border-red-300",
      icon: "🔴",
    },
  };

  const style = SEVERITY_STYLES[severity];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      variant={style.variant}
      className={`${sizeClasses[size]} ${style.className} font-medium`}
      role="status"
      aria-label={`Severity: ${severity}`}
    >
      <span className="mr-1">{style.icon}</span>
      {t(`finding.severity.${severity}`)}
    </Badge>
  );
}
