import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountFilterModal } from "~/components/amount-filter-modal";

vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      filterByAmount: {
        useQuery: vi.fn(() => ({
          data: {
            transactions: [
              {
                id: "tx-1",
                transactionDate: "2024-01-01T00:00:00.000Z",
                type: "입금",
                amount: 1500000,
                depositAmount: 1500000,
                withdrawalAmount: 0,
                balance: 2000000,
                memo: "첫 입금",
                documentId: "doc-1",
                documentName: "국민은행.pdf",
              },
              {
                id: "tx-2",
                transactionDate: "2024-01-02T00:00:00.000Z",
                type: "출금",
                amount: 1200000,
                depositAmount: 0,
                withdrawalAmount: 1200000,
                balance: 800000,
                memo: "이체",
                documentId: "doc-2",
                documentName: "우리은행.pdf",
              },
            ],
            summary: {
              total: 2,
              depositCount: 1,
              withdrawalCount: 1,
              depositTotal: 1500000,
              withdrawalTotal: 1200000,
              minAmount: 1000000,
            },
          },
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
    },
  },
}));

describe("AmountFilterModal", () => {
  it("문서 그룹과 분리 모드를 표시한다", () => {
    render(<AmountFilterModal isOpen={true} onClose={vi.fn()} caseId="case-1" />);

    expect(screen.queryByTestId("amount-filter-summary-card")).not.toBeNull();
    expect(screen.getByTestId("amount-filter-deposit-total").textContent).toContain("1,500,000원");
    expect(screen.getByTestId("amount-filter-withdrawal-total").textContent).toContain("1,200,000원");
    expect(screen.getByTestId("amount-filter-document-group-0").textContent).toContain("국민은행.pdf");
    expect(screen.getByTestId("amount-filter-document-group-1").textContent).toContain("우리은행.pdf");
    expect(screen.getByTestId("amount-filter-row-deposit-tx-1").textContent).toContain("1,500,000원");
    expect(screen.getByTestId("amount-filter-row-withdrawal-tx-2").textContent).toContain("1,200,000원");
  });

  it("토글을 누르면 구분+금액 모드로 전환한다", () => {
    render(<AmountFilterModal isOpen={true} onClose={vi.fn()} caseId="case-1" />);

    fireEvent.click(screen.getByTestId("amount-filter-display-mode-toggle"));

    expect(screen.getByTestId("amount-filter-row-type-tx-1").textContent).toContain("입금");
    expect(screen.getByTestId("amount-filter-row-amount-tx-2").textContent).toContain("1,200,000원");
  });
});