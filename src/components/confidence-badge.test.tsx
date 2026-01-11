/**
 * Confidence Badge Component Tests
 *
 * Story 4.2: 신뢰도 점수 및 불확실한 분류 표시
 * Story 4.2 Code Review - CRITICAL #1: Configuration integration tests
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 *
 * 테스트 범위:
 * - 높은 신뢰도 (0.7+) 표시
 * - 중간 신뢰도 (0.5~0.7) 표시
 * - 낮은 신뢰도 (0.5-) 표시 및 불확실한 분류 라벨
 * - 신뢰도 점수가 없는 경우 표시
 * - ConfidenceText 텍스트 표시
 * - Configuration 설정 사용 (CRITICAL #1)
 * - Edge cases (MEDIUM #6)
 *
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge, ConfidenceText } from "./confidence-badge";
import { CONFIDENCE_THRESHOLDS } from "~/lib/confidence-config";
import { I18nProvider } from "~/lib/i18n/index";

// Helper function to render with I18nProvider
const renderWithI18n = (ui: React.ReactNode) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe("ConfidenceBadge", () => {
  it("[AC2] 0.7 이상 - 높은 신뢰도 표시 (녹색)", () => {
    const { container } = renderWithI18n(<ConfidenceBadge confidenceScore={0.85} />);

    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(container.querySelector(".text-green-700")).toBeInTheDocument();
  });

  it("[AC2] 0.5 ~ 0.7 - 중간 신뢰도 표시 (노란색)", () => {
    const { container } = renderWithI18n(<ConfidenceBadge confidenceScore={0.6} />);

    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(container.querySelector(".text-yellow-700")).toBeInTheDocument();
  });

  it("[AC2] 0.5 미만 - 낮은 신뢰도 표시 (주황색)", () => {
    const { container } = renderWithI18n(<ConfidenceBadge confidenceScore={0.3} />);

    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(container.querySelector(".text-orange-700")).toBeInTheDocument();
  });

  it("[AC2] 0.7 미만 - 불확실한 분류 라벨 표시", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.5} />);

    // HIGH #3: aria-hidden으로 emoji가 분리되어 텍스트만 검색
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("[AC2] 0.7 이상 - 불확실한 분류 라벨 미표시", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.8} />);

    // HIGH #3: aria-hidden으로 emoji가 분리되어 텍스트만 검색
    expect(screen.queryByText("불확실한 분류")).not.toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("[AC2] 신뢰도 점수가 null인 경우 - 분류 안됨 표시", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={null} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
    expect(screen.getByText("분류 안됨")).toHaveClass("text-gray-500");
  });

  it("[AC2] 신뢰도 점수가 undefined인 경우 - 분류 안됨 표시", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={undefined} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[AC2] showPercentage=false - 퍼센트 미표시", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.85} showPercentage={false} />);

    expect(screen.queryByText("85%")).not.toBeInTheDocument();
    // 아이콘만 표시되어야 함
  });
});

describe("ConfidenceText", () => {
  it("[AC2] 카테고리와 신뢰도 퍼센트 함께 표시", () => {
    renderWithI18n(<ConfidenceText confidenceScore={0.92} category="입금" />);

    expect(screen.getByText("입금")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("신뢰도")).toBeInTheDocument();
  });

  it("[AC2] 신뢰도 점수가 null인 경우", () => {
    renderWithI18n(<ConfidenceText confidenceScore={null} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[AC2] 카테고리가 없는 경우", () => {
    renderWithI18n(<ConfidenceText confidenceScore={0.75} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("신뢰도")).toBeInTheDocument();
  });

  it("[AC2] 퍼센트 반올림 표시", () => {
    renderWithI18n(<ConfidenceText confidenceScore={0.856} category="출금" />);

    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("신뢰도")).toBeInTheDocument();
  });
});

describe("ConfidenceBadge - Configuration Integration", () => {
  it("[CRITICAL-1] uses CONFIDENCE_THRESHOLDS.HIGH for high confidence", () => {
    renderWithI18n(
      <ConfidenceBadge
        confidenceScore={CONFIDENCE_THRESHOLDS.HIGH}
      />
    );
    // Should show "높음" (HIGH level)
    expect(screen.queryAllByText("분류 안됨").length).toBe(0); // Not showing "분류 안됨"
    expect(screen.queryByText("불확실한 분류")).not.toBeInTheDocument();
  });

  it("[CRITICAL-1] uses CONFIDENCE_THRESHOLDS.MEDIUM for medium confidence", () => {
    renderWithI18n(
      <ConfidenceBadge
        confidenceScore={CONFIDENCE_THRESHOLDS.MEDIUM}
      />
    );
    // Should show "중간" (MEDIUM level)
    const mediumPercent = Math.round(CONFIDENCE_THRESHOLDS.MEDIUM * 100);
    expect(screen.getByText(`${mediumPercent}%`)).toBeInTheDocument();
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
  });

  it("[CRITICAL-1] uses CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL for uncertain label", () => {
    // Just below UNCERTAIN_LABEL threshold
    renderWithI18n(
      <ConfidenceBadge
        confidenceScore={CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL - 0.01}
      />
    );
    // Should show "불확실한 분류" label (HIGH #3: 텍스트만 검색)
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
  });

  it("[CRITICAL-1] at exactly UNCERTAIN_LABEL threshold, no uncertain label", () => {
    // Exactly at UNCERTAIN_LABEL threshold
    renderWithI18n(
      <ConfidenceBadge
        confidenceScore={CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL}
      />
    );
    // Should NOT show "불확실한 분류" label (HIGH #3: 텍스트만 검색)
    expect(screen.queryByText("불확실한 분류")).not.toBeInTheDocument();
  });
});

describe("ConfidenceBadge - Edge Cases (MEDIUM #6)", () => {
  it("[MEDIUM-6] handles NaN gracefully - shows '분류 안됨'", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={NaN} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[MEDIUM-6] handles negative score - shows '분류 안됨'", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={-0.5} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[MEDIUM-6] handles score > 1.0 - shows '분류 안됨'", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={1.5} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[MEDIUM-6] handles Infinity - shows '분류 안됨'", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={Infinity} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });

  it("[MEDIUM-6] handles boundary 0.7 (HIGH threshold)", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.7} />);

    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.queryByText("불확실한 분류")).not.toBeInTheDocument();
  });

  it("[MEDIUM-6] handles boundary 0.5 (MEDIUM threshold)", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.5} />);

    expect(screen.getByText("50%")).toBeInTheDocument();
    // HIGH #3: aria-hidden으로 emoji가 분리되어 텍스트만 검색
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
  });

  it("[MEDIUM-6] handles boundary just below 0.7", () => {
    renderWithI18n(<ConfidenceBadge confidenceScore={0.69} />);

    expect(screen.getByText("69%")).toBeInTheDocument();
    // HIGH #3: aria-hidden으로 emoji가 분리되어 텍스트만 검색
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
  });
});
