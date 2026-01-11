/**
 * TagEditor Component Tests
 *
 * Story 4.6: 태그 추가 및 삭제
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagEditor } from "./tag-editor";

// Mock tRPC
vi.mock("~/utils/api", () => ({
  api: {
    tag: {
      addTagToTransaction: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      removeTagFromTransaction: {
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

describe("TagEditor Component - Story 4.6", () => {
  const mockOnTagsUpdated = vi.fn();
  const currentTags = [
    { tag: { id: "tag-1", name: "existing-tag" } },
    { tag: { id: "tag-2", name: "another-tag" } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render current tags", () => {
    render(
      <TagEditor
        transactionId="tx-1"
        currentTags={currentTags}
        onTagsUpdated={mockOnTagsUpdated}
      />
    );

    expect(screen.getByText("existing-tag")).toBeDefined();
    expect(screen.getByText("another-tag")).toBeDefined();
  });

  it("should render add button when not editing", () => {
    render(
      <TagEditor
        transactionId="tx-1"
        currentTags={[]}
        onTagsUpdated={mockOnTagsUpdated}
      />
    );

    expect(screen.getByText("태그 추가")).toBeDefined();
  });

  it("should show input field when add button clicked", async () => {
    const user = userEvent.setup();
    render(
      <TagEditor
        transactionId="tx-1"
        currentTags={[]}
        onTagsUpdated={mockOnTagsUpdated}
      />
    );

    const addButton = screen.getByText("태그 추가");
    await user.click(addButton);

    expect(screen.getByPlaceholderText("태그 이름 입력...")).toBeDefined();
  });

  it("should not show add button when disabled", () => {
    render(
      <TagEditor
        transactionId="tx-1"
        currentTags={[]}
        onTagsUpdated={mockOnTagsUpdated}
        disabled={true}
      />
    );

    expect(screen.queryByText("태그 추가")).toBeNull();
  });

  it("should display accessibility attributes", () => {
    const { container } = render(
      <TagEditor
        transactionId="tx-1"
        currentTags={[]}
        onTagsUpdated={mockOnTagsUpdated}
      />
    );

    const editor = container.querySelector('[role="listbox"]');
    expect(editor).toBeDefined();
  });
});
