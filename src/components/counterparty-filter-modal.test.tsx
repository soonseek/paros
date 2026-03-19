import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CounterpartyFilterModal } from "~/components/counterparty-filter-modal";

vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      filterByCounterparty: {
        useQuery: vi.fn(() => ({
          data: {
            transactions: [
              {
                id: "tx-1",
                transactionDate: "2024-01-01T00:00:00.000Z",
                type: "입금",
                amount: 1200000,
                depositAmount: 1200000,
                withdrawalAmount: 0,
                balance: 3000000,
                memo: "홍길동 입금",
                creditorName: "",
                matchedFields: ["비고"],
                documentId: "doc-1",
                documentName: "국민은행.pdf",
              },
            ],
            summary: {
              total: 1,
              depositCount: 1,
              withdrawalCount: 0,
              depositTotal: 1200000,
              withdrawalTotal: 0,
              query: "홍길동",
            },
          },
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
    },
  },
}));

describe("CounterpartyFilterModal", () => {
  it("검색 요약과 일치 위치를 표시한다", () => {
    render(<CounterpartyFilterModal isOpen={true} onClose={vi.fn()} caseId="case-1" />);

    expect(screen.queryByTestId("counterparty-filter-summary-card")).not.toBeNull();
    expect(screen.getByTestId("counterparty-filter-deposit-total").textContent).toContain("1,200,000원");
    expect(screen.getByTestId("counterparty-filter-document-group-0").textContent).toContain("국민은행.pdf");
    expect(screen.getByTestId("counterparty-filter-row-match-tx-1").textContent).toContain("비고");
  });

  it("검색 입력값을 바꿀 수 있다", () => {
    render(<CounterpartyFilterModal isOpen={true} onClose={vi.fn()} caseId="case-1" />);

    fireEvent.change(screen.getByTestId("counterparty-filter-input"), {
      target: { value: "110-123-456789" },
    });

    expect((screen.getByTestId("counterparty-filter-input") as HTMLInputElement).value).toBe("110-123-456789");
  });
});