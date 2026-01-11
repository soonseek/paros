/**
 * Manual Classification Badge Component Tests
 *
 * Story 4.5: 수동 분류 수정
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManualClassificationBadge } from "./manual-classification-badge";

// Mock i18n
vi.mock("~/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    formatDate: (date: Date) => "2026-01-11",
  }),
}));

describe("ManualClassificationBadge", () => {
  it("should not render when not manually classified", () => {
    const { container } = render(
      <ManualClassificationBadge
        isManuallyClassified={false}
        originalCategory="입금"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render badge when manually classified", () => {
    render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        originalSubcategory="이체"
        manualClassificationDate={new Date("2026-01-11")}
      />
    );

    expect(screen.getByText("manualClassification.modifiedBadge")).toBeInTheDocument();
  });

  it("should show pencil icon", () => {
    render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
      />
    );

    const badge = screen.getByRole("status");
    expect(badge.textContent).toContain("✏️");
  });

  it("should have tooltip when original category exists", () => {
    render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        originalSubcategory="이체"
        manualClassificationDate={new Date("2026-01-11")}
      />
    );

    // Check if tooltip content includes original category
    const badge = screen.getByRole("status");
    const ariaLabel = badge.getAttribute("aria-label");

    expect(ariaLabel).toContain("manualClassification.modifiedBadge");
    expect(ariaLabel).toContain("입금");
  });

  it("should include modification date in tooltip", () => {
    const testDate = new Date("2026-01-11T10:30:00");

    render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        manualClassificationDate={testDate}
      />
    );

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
  });

  it("should apply size classes correctly", () => {
    const { rerender } = render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        size="sm"
      />
    );

    const badgeSm = screen.getByRole("status");
    expect(badgeSm.className).toContain("text-xs");

    rerender(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        size="lg"
      />
    );

    const badgeLg = screen.getByRole("status");
    expect(badgeLg.className).toContain("text-base");
  });

  it("should have proper accessibility attributes", () => {
    render(
      <ManualClassificationBadge
        isManuallyClassified={true}
        originalCategory="입금"
        originalSubcategory="이체"
      />
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("role", "status");
  });
});
