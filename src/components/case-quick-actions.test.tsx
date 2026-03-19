import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CaseQuickActions } from "~/components/case-quick-actions";

describe("CaseQuickActions", () => {
  it("4개의 큰 아이콘 버튼을 표시한다", () => {
    render(
      <CaseQuickActions
        onLoanTrackingOpen={vi.fn()}
        onAmountFilterOpen={vi.fn()}
        onCounterpartyFilterOpen={vi.fn()}
        onInternalTransferOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId("case-quick-actions-card").textContent).toContain("빠른 실행");
    expect(screen.getByTestId("case-loan-tracking-open-button").textContent).toContain("대출금 사용 소명자료 생성");
    expect(screen.getByTestId("case-amount-filter-open-button").textContent).toContain("금액 이상 입출금건 뽑기");
    expect(screen.getByTestId("case-counterparty-filter-open-button").textContent).toContain("특정 인물 거래 찾기");
    expect(screen.getByTestId("case-internal-transfer-open-button").textContent).toContain("내부 계좌이체 연결");
  });

  it("버튼 클릭 시 각 핸들러를 호출한다", () => {
    const onLoanTrackingOpen = vi.fn();
    const onAmountFilterOpen = vi.fn();
    const onCounterpartyFilterOpen = vi.fn();
    const onInternalTransferOpen = vi.fn();

    render(
      <CaseQuickActions
        onLoanTrackingOpen={onLoanTrackingOpen}
        onAmountFilterOpen={onAmountFilterOpen}
        onCounterpartyFilterOpen={onCounterpartyFilterOpen}
        onInternalTransferOpen={onInternalTransferOpen}
      />,
    );

    fireEvent.click(screen.getByTestId("case-loan-tracking-open-button"));
    fireEvent.click(screen.getByTestId("case-amount-filter-open-button"));
    fireEvent.click(screen.getByTestId("case-counterparty-filter-open-button"));
    fireEvent.click(screen.getByTestId("case-internal-transfer-open-button"));

    expect(onLoanTrackingOpen).toHaveBeenCalledTimes(1);
    expect(onAmountFilterOpen).toHaveBeenCalledTimes(1);
    expect(onCounterpartyFilterOpen).toHaveBeenCalledTimes(1);
    expect(onInternalTransferOpen).toHaveBeenCalledTimes(1);
  });
});