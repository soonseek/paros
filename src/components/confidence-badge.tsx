/**
 * Confidence Badge Component
 *
 * Story 4.2: 신뢰도 점수 및 불확실한 분류 표시
 * Story 4.2 Code Review - CRITICAL #1: Extracted hardcoded thresholds to config
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 *
 * AI 분류의 신뢰도 점수를 시각적으로 표시합니다.
 * - CONFIDENCE_THRESHOLDS.HIGH 이상: 높은 신뢰도 (녹색)
 * - CONFIDENCE_THRESHOLDS.MEDIUM ~ HIGH: 중간 신뢰도 (노란색)
 * - CONFIDENCE_THRESHOLDS.MEDIUM 미만: 낮은 신뢰도 (주황색)
 *
 * @param confidenceScore - 0.0 ~ 1.0 사이의 신뢰도 점수
 */

"use client";

import { cn } from "~/lib/utils";
import {
  CONFIDENCE_THRESHOLDS,
  validateConfidenceScore,
  getConfidenceLevel,
  isUncertainClassification,
} from "~/lib/confidence-config";
import { useI18n } from "~/lib/i18n/index";

interface ConfidenceBadgeProps {
  confidenceScore: number | null | undefined;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBadge({
  confidenceScore,
  showPercentage = true,
  size = "md",
}: ConfidenceBadgeProps) {
  const { t } = useI18n();

  // Validate input using centralized validation
  const validScore = validateConfidenceScore(confidenceScore);

  // Handle invalid scores (null, undefined, out of range, NaN)
  if (validScore === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          "bg-gray-100 text-gray-500",
          size === "sm" && "text-[10px] px-1.5 py-0.5",
          size === "lg" && "text-sm px-3 py-1"
        )}
        role="status"
        aria-label={t("confidence.notClassified")}
      >
        {t("confidence.notClassified")}
      </span>
    );
  }

  const percentage = Math.round(validScore * 100);

  // Use centralized configuration for level determination
  const getLevel = (): {
    label: string;
    bgColor: string;
    textColor: string;
    icon: string;
  } => {
    const level = getConfidenceLevel(validScore);

    switch (level) {
      case "HIGH":
        return {
          label: t("confidence.high"),
          bgColor: "bg-green-100",
          textColor: "text-green-700",
          icon: "✓",
        };
      case "MEDIUM":
        return {
          label: t("confidence.medium"),
          bgColor: "bg-yellow-100",
          textColor: "text-yellow-700",
          icon: "~",
        };
      case "LOW":
        return {
          label: t("confidence.low"),
          bgColor: "bg-orange-100",
          textColor: "text-orange-700",
          icon: "!",
        };
    }
  };

  const level = getLevel();
  const isUncertain = isUncertainClassification(validScore);

  return (
    <div className="flex items-center gap-2">
      {/* 신뢰도 배지 */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          level.bgColor,
          level.textColor,
          size === "sm" && "text-[10px] px-1.5 py-0.5",
          size === "lg" && "text-sm px-3 py-1"
        )}
        title={`${t("confidence.confidenceScore")}: ${percentage}%`}
        role="status"
        aria-label={`AI ${t("confidence.confidenceScore")} ${percentage}%, ${level.label} ${
          isUncertain ? t("confidence.uncertain") : ""
        }`}
      >
        <span aria-hidden="true">{level.icon}</span>
        {showPercentage && <span>{percentage}%</span>}
      </span>

      {/* Use centralized configuration for threshold check */}
      {isUncertain && (
        <span
          className={cn(
            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
            "bg-orange-50 text-orange-600 border border-orange-200",
            size === "sm" && "text-[10px] px-1.5 py-0.5",
            size === "lg" && "text-sm px-2.5 py-1"
          )}
          role="alert"
          aria-label={`${t("confidence.uncertain")} - review recommended`}
        >
          <span aria-hidden="true">🟡</span> {t("confidence.uncertain")}
        </span>
      )}
    </div>
  );
}

/**
 * 신뢰도 점수를 텍스트로만 표시하는 컴포넌트
 * 거래 상세 등에서 사용
 *
 * Story 4.2 Code Review - CRITICAL #1: Uses centralized validation
 * Story 4.2 Code Review - HIGH #3: Accessibility improvements
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 */
interface ConfidenceTextProps {
  confidenceScore: number | null | undefined;
  category?: string;
}

export function ConfidenceText({
  confidenceScore,
  category,
}: ConfidenceTextProps) {
  const { t } = useI18n();

  // Validate using centralized function
  const validScore = validateConfidenceScore(confidenceScore);

  if (validScore === null) {
    return (
      <span className="text-gray-500" role="status" aria-label={t("confidence.notClassified")}>
        {t("confidence.notClassified")}
      </span>
    );
  }

  const percentage = Math.round(validScore * 100);

  return (
    <span className="text-sm text-gray-600" role="status">
      {category && (
        <span className="font-medium">{category}</span>
      )}
      <span> - </span>
      <span className="font-medium">{percentage}%</span>
      <span> {t("confidence.confidenceScore")}</span>
    </span>
  );
}
