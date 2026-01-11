/**
 * Category Editor Component Tests
 *
 * Story 4.5: 수동 분류 수정
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategoryEditor } from "./category-editor";

// Mock i18n
vi.mock("~/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    formatDate: (date: Date) => date.toISOString(),
  }),
}));

// Mock tRPC
vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      updateTransactionClassification: {
        useMutation: () => ({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CategoryEditor", () => {
  const defaultProps = {
    transactionId: "tx-1",
    currentCategory: "입금",
    currentSubcategory: "이체",
    onClassificationUpdated: vi.fn(),
  };

  it("should render current category", () => {
    render(<CategoryEditor {...defaultProps} />);

    expect(screen.getByText("입금")).toBeInTheDocument();
  });

  it("should render '-' when category is null", () => {
    render(<CategoryEditor {...defaultProps} currentCategory={null} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("should show edit button", () => {
    render(<CategoryEditor {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /manualClassification.edit/i });
    expect(editButton).toBeInTheDocument();
  });

  it("should not show edit button when disabled", () => {
    render(<CategoryEditor {...defaultProps} disabled />);

    const editButton = screen.queryByRole("button", { name: /manualClassification.edit/i });
    expect(editButton).not.toBeInTheDocument();
  });

  it("should enter edit mode when edit button is clicked", () => {
    render(<CategoryEditor {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /manualClassification.edit/i });
    fireEvent.click(editButton);

    // Select dropdown should be visible
    const select = screen.getByRole("combobox", { name: /manualClassification.categoryLabel/i });
    expect(select).toBeInTheDocument();
  });

  it("should show save and cancel buttons in edit mode", () => {
    render(<CategoryEditor {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /manualClassification.edit/i });
    fireEvent.click(editButton);

    expect(screen.getByRole("button", { name: /manualClassification.save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manualClassification.cancel/i })).toBeInTheDocument();
  });

  it("should cancel edit when cancel button is clicked", () => {
    render(<CategoryEditor {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /manualClassification.edit/i });
    fireEvent.click(editButton);

    const cancelButton = screen.getByRole("button", { name: /manualClassification.cancel/i });
    fireEvent.click(cancelButton);

    // Should return to display mode
    expect(screen.getByText("입금")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manualClassification.save/i })).not.toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(<CategoryEditor {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /manualClassification.edit/i });
    expect(editButton).toHaveAttribute("aria-label", "manualClassification.edit");
  });
});
