/**
 * BatchTagDialog Component Tests
 *
 * Story 4.6: 태그 추가 및 삭제
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchTagDialog } from "./batch-tag-dialog";

// Mock tRPC
vi.mock("~/utils/api", () => ({
  api: {
    tag: {
      addTagsToMultipleTransactions: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      getTagSuggestions: {
        useQuery: () => ({
          data: {
            tags: [
              { id: "tag-1", name: "suggestion-1", usageCount: 5 },
              { id: "tag-2", name: "suggestion-2", usageCount: 3 },
            ],
          },
          isLoading: false,
        }),
      },
    },
  },
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("BatchTagDialog Component - Story 4.6", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();
  const transactionIds = ["tx-1", "tx-2", "tx-3"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dialog when open", () => {
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText("일괄 태그 추가")).toBeDefined();
    expect(screen.getByText(`${transactionIds.length}개의 거래에 동일한 태그를 추가합니다.`)).toBeDefined();
  });

  it("should not render dialog when closed", () => {
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.queryByText("일괄 태그 추가")).toBeNull();
  });

  it("should render input field and buttons", () => {
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByPlaceholderText("태그 이름 입력...")).toBeDefined();
    expect(screen.getByText("취소")).toBeDefined();
    expect(screen.getByText("태그 추가")).toBeDefined();
  });

  it("should call onClose when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const cancelButton = screen.getByText("취소");
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should display accessibility attributes", () => {
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const input = screen.getByLabelText("태그 이름 입력");
    expect(input).toBeDefined();
  });

  it("should show transaction count in dialog description", () => {
    render(
      <BatchTagDialog
        transactionIds={transactionIds}
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText(`${transactionIds.length}개의 거래에 동일한 태그를 추가합니다.`)).toBeDefined();
  });
});
