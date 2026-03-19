import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InternalTransferLinkModal } from "~/components/internal-transfer-link-modal";

vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      detectInternalTransfers: {
        useQuery: vi.fn(() => ({
          data: {
            matches: [
              {
                withdrawalTransactionId: "w1",
                depositTransactionId: "d1",
                withdrawalDate: "2024-01-01T09:00:00.000Z",
                depositDate: "2024-01-01T09:05:00.000Z",
                amount: 500000,
                fromDocumentId: "doc-a",
                fromDocumentName: "국민은행",
                toDocumentId: "doc-b",
                toDocumentName: "우리은행",
                withdrawalMemo: "이체",
                depositMemo: "입금",
                confidence: 0.92,
                matchReason: "같은 날 동일 금액 + 이체 키워드 일치",
              },
            ],
            summary: {
              total: 1,
              totalAmount: 500000,
              sameDayCount: 1,
              nextDayCount: 0,
              documentPairCount: 1,
            },
          },
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
    },
  },
}));

describe("InternalTransferLinkModal", () => {
  it("요약과 연결 결과를 표시한다", () => {
    render(<InternalTransferLinkModal isOpen={true} onClose={vi.fn()} caseId="case-1" />);

    expect(screen.queryByTestId("internal-transfer-summary-card")).not.toBeNull();
    expect(screen.getByTestId("internal-transfer-total-amount").textContent).toContain("500,000원");
    expect(screen.getByTestId("internal-transfer-row-w1").textContent).toContain("국민은행");
    expect(screen.getByTestId("internal-transfer-row-w1").textContent).toContain("우리은행");
  });
});