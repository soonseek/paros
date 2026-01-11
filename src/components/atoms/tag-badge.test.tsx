/**
 * TagBadge Component Tests
 *
 * Story 4.6: 태그 추가 및 삭제
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagBadge } from "./tag-badge";

describe("TagBadge Component - Story 4.6", () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tag name", () => {
    render(
      <TagBadge
        tagId="tag-1"
        tagName="test-tag"
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText("test-tag")).toBeDefined();
  });

  it("should render remove button when not disabled", () => {
    const { container } = render(
      <TagBadge
        tagId="tag-1"
        tagName="test-tag"
        onRemove={mockOnRemove}
        disabled={false}
      />
    );

    const button = container.querySelector("button");
    expect(button).toBeDefined();
  });

  it("should not render remove button when disabled", () => {
    const { container } = render(
      <TagBadge
        tagId="tag-1"
        tagName="test-tag"
        onRemove={mockOnRemove}
        disabled={true}
      />
    );

    const button = container.querySelector("button");
    expect(button).toBeNull();
  });

  it("should call onRemove with tagId when remove button clicked", async () => {
    const { container } = render(
      <TagBadge
        tagId="tag-1"
        tagName="test-tag"
        onRemove={mockOnRemove}
      />
    );

    const button = container.querySelector("button");
    if (button) {
      button.click();
    }

    expect(mockOnRemove).toHaveBeenCalledWith("tag-1");
  });

  it("should truncate long tag names", () => {
    const longTagName = "a".repeat(200);
    const { container } = render(
      <TagBadge
        tagId="tag-1"
        tagName={longTagName}
        onRemove={mockOnRemove}
      />
    );

    // The truncate class is on the inner span, not the Badge itself
    const textSpan = container.querySelector("span[title]");
    expect(textSpan).toBeDefined();

    // Check that max-width constraint is applied
    expect(textSpan?.className).toContain("max-w-[150px]");
  });
});
