/**
 * Important Transaction Badge Component
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * 중요 거래 유형을 시각적으로 표시합니다.
 * - LOAN_EXECUTION: 대출 실행 (빨간색)
 * - REPAYMENT: 변제/상환 (파란색)
 * - COLLATERAL: 담보 (주황색)
 * - SEIZURE: 압류 (보라색)
 *
 * @param type - 중요 거래 유형
 * @param keywords - 매칭된 키워드 배열 (선택적)
 * @param size - 배지 크기
 */

"use client";

import { cn } from "~/lib/utils";
import {
  IMPORTANT_TRANSACTION_TYPE_LABELS,
  type ImportantTransactionType,
} from "~/lib/constants/important-keywords";
import { useI18n } from "~/lib/i18n/index";

interface ImportantTransactionBadgeProps {
  type: ImportantTransactionType | null | undefined;
  keywords?: string[] | null;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function ImportantTransactionBadge({
  type,
  keywords,
  size = "md",
  showIcon = true,
}: ImportantTransactionBadgeProps) {
  const { t } = useI18n();

  // 중요 거래가 아니면 null 반환
  if (!type) {
    return null;
  }

  // 중요 거래 유형별 스타일 및 아이콘
  const getTypeConfig = (): {
    label: string;
    bgColor: string;
    textColor: string;
    icon: string;
    borderColor: string;
  } => {
    switch (type) {
      case "LOAN_EXECUTION":
        return {
          label: t("importantTransaction.loanExecution"),
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          icon: "💰",
          borderColor: "border-red-200",
        };
      case "REPAYMENT":
        return {
          label: t("importantTransaction.repayment"),
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          icon: "✓",
          borderColor: "border-blue-200",
        };
      case "COLLATERAL":
        return {
          label: t("importantTransaction.collateral"),
          bgColor: "bg-orange-50",
          textColor: "text-orange-700",
          icon: "🔒",
          borderColor: "border-orange-200",
        };
      case "SEIZURE":
        return {
          label: t("importantTransaction.seizure"),
          bgColor: "bg-purple-50",
          textColor: "text-purple-700",
          icon: "⚠️",
          borderColor: "border-purple-200",
        };
    }
  };

  const config = getTypeConfig();
  const hasKeywords = keywords && keywords.length > 0;

  return (
    <div className="flex items-center gap-1">
      {/* 중요 거래 배지 */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          config.bgColor,
          config.textColor,
          config.borderColor,
          size === "sm" && "text-[10px] px-1.5 py-0.5",
          size === "lg" && "text-sm px-3 py-1"
        )}
        title={hasKeywords ? `매칭된 키워드: ${keywords.join(", ")}` : config.label}
        role="status"
        aria-label={`${t("importantTransaction.important")}: ${config.label}${
          hasKeywords ? ` (${t("importantTransaction.keywords")}: ${keywords.join(", ")})` : ""
        }`}
      >
        {showIcon && <span aria-hidden="true">{config.icon}</span>}
        <span>{config.label}</span>
      </span>

      {/* 키워드 툴팁 (마우스 오버 시 표시) */}
      {hasKeywords && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
            "bg-gray-50 text-gray-500 border border-gray-200"
          )}
          title={`${t("importantTransaction.matchedKeywords")}: ${keywords.join(", ")}`}
          aria-label={`${keywords.length} ${t("importantTransaction.keywordsMatched")}`}
        >
          <span aria-hidden="true">🏷️</span>
          <span>{keywords.length}</span>
        </span>
      )}
    </div>
  );
}

/**
 * 중요 거래 텍스트 컴포넌트
 * 거래 상세 등에서 사용
 */
interface ImportantTransactionTextProps {
  type: ImportantTransactionType | null | undefined;
  keywords?: string[] | null;
}

export function ImportantTransactionText({
  type,
  keywords,
}: ImportantTransactionTextProps) {
  const { t } = useI18n();

  if (!type) {
    return null;
  }

  const label = IMPORTANT_TRANSACTION_TYPE_LABELS[type];
  const hasKeywords = keywords && keywords.length > 0;

  return (
    <div className="space-y-1">
      <span className="font-medium text-gray-900">{label}</span>
      {hasKeywords && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">{t("importantTransaction.matchedKeywords")}:</span>{" "}
          {keywords?.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * 중요 거래 심각도(Severity) 배지 컴포넌트
 * Finding에서 사용
 */
interface SeverityBadgeProps {
  severity: "INFO" | "WARNING" | "CRITICAL";
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({
  severity,
  size = "md",
}: SeverityBadgeProps) {
  const { t } = useI18n();

  const getSeverityConfig = (): {
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: string;
  } => {
    switch (severity) {
      case "INFO":
        return {
          label: t("severity.info"),
          bgColor: "bg-gray-50",
          textColor: "text-gray-700",
          borderColor: "border-gray-300",
          icon: "ℹ️",
        };
      case "WARNING":
        return {
          label: t("severity.warning"),
          bgColor: "bg-yellow-50",
          textColor: "text-yellow-700",
          borderColor: "border-yellow-300",
          icon: "⚠️",
        };
      case "CRITICAL":
        return {
          label: t("severity.critical"),
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          borderColor: "border-red-300",
          icon: "🚨",
        };
    }
  };

  const config = getSeverityConfig();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.bgColor,
        config.textColor,
        config.borderColor,
        size === "sm" && "text-[10px] px-1.5 py-0.5",
        size === "lg" && "text-sm px-3 py-1"
      )}
      role="status"
      aria-label={`${t("severity.severity")}: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
