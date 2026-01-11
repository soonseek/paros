/**
 * AIClassificationButton Component Tests
 *
 * Story 4.1, CRITICAL-1 FIX: 컴포넌트 테스트
 *
 * 테스트 범위:
 * - 완료 상태면 버튼 비활성화
 * - 클릭 시 확인 다이얼로그 표시
 * - 분류 시작 버튼 클릭 → API 호출
 *
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIClassificationButton } from "./ai-classification-button";

// tRPC 모킹
vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      classifyTransactions: {
        useMutation: vi.fn(),
      },
    },
  },
}));

// SSE 훅 모킹
vi.mock("~/hooks/use-classification-progress", () => ({
  useClassificationProgress: vi.fn(() => ({
    progress: null,
    isConnected: false,
    error: null,
  })),
}));

describe("AIClassificationButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[AC1] 완료 상태면 버튼 비활성화", () => {
    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="completed"
      />
    );

    const button = screen.getByRole("button", { name: "분류 완료" });
    expect(button).toBeDisabled();
  });

  it("[AC1] 진행 중 상태면 버튼 비활성화 및 로딩 표시", () => {
    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="processing"
      />
    );

    const button = screen.getByRole("button", { name: /분류 중/ });
    expect(button).toBeDisabled();
  });

  it("[AC1] 대기 상태면 버튼 활성화", () => {
    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="pending"
      />
    );

    const button = screen.getByRole("button", { name: "AI 분류 시작" });
    expect(button).not.toBeDisabled();
  });

  it("클릭 시 확인 다이얼로그 표시", async () => {
    const user = userEvent.setup();

    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="pending"
      />
    );

    const button = screen.getByRole("button", { name: "AI 분류 시작" });
    await user.click(button);

    expect(
      screen.getByRole("alertdialog", { name: "AI 분류 시작 확인" })
    ).toBeInTheDocument();
    expect(screen.getByText("AI 분류 시작 확인")).toBeInTheDocument();
    expect(
      screen.getByText(/AI가 거래 내역을 분석하여 자동으로 카테고리를 분류합니다/)
    ).toBeInTheDocument();
  });

  it("[AC1] 분류 시작 버튼 클릭 → API 호출", async () => {
    const user = userEvent.setup();
    const mockMutateAsync = vi.fn().mockResolvedValue({
      jobId: "job-123",
      total: 100,
      message: "100건의 거래 분류를 시작했습니다.",
    });

    const { api } = await import("~/utils/api");
    vi.mocked(api.transaction.classifyTransactions.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="pending"
        onClassificationComplete={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "AI 분류 시작" });
    await user.click(button);

    const confirmButton = screen.getByRole("button", { name: "시작" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ documentId: "doc-1" });
    });
  });

  it("확인 다이얼로그에서 취소 버튼 클릭 → API 미호출", async () => {
    const user = userEvent.setup();
    const mockMutateAsync = vi.fn();

    const { api } = await import("~/utils/api");
    vi.mocked(api.transaction.classifyTransactions.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    render(
      <AIClassificationButton
        documentId="doc-1"
        classificationStatus="pending"
      />
    );

    const button = screen.getByRole("button", { name: "AI 분류 시작" });
    await user.click(button);

    const cancelButton = screen.getByRole("button", { name: "취소" });
    await user.click(cancelButton);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
