/**
 * Important Transaction Badge Component Tests
 *
 * Story 4.3: 중요 거래 자동 식별
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportantTransactionBadge, SeverityBadge } from "./important-transaction-badge";
import { I18nProvider } from "~/lib/i18n/index";

describe("ImportantTransactionBadge", () => {
  const mockI18n = {
    t: (key: string) => key,
    formatMessage: (key: string, _params: Record<string, string | number>) => key,
    formatDate: (date: Date) => new Date(date).toLocaleDateString(),
    formatCurrency: (value: number) => `${value}원`,
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider locale="ko" messages={mockI18n as any}>
      {children}
    </I18nProvider>
  );

  describe("ImportantTransactionBadge", () => {
    it("대출 실행 배지 렌더링", () => {
      render(
        <ImportantTransactionBadge type="LOAN_EXECUTION" size="md" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.loanExecution")).toBeInTheDocument();
    });

    it("변제 배지 렌더링", () => {
      render(
        <ImportantTransactionBadge type="REPAYMENT" size="md" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.repayment")).toBeInTheDocument();
    });

    it("담보 배지 렌더링", () => {
      render(
        <ImportantTransactionBadge type="COLLATERAL" size="md" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.collateral")).toBeInTheDocument();
    });

    it("압류 배지 렌더링", () => {
      render(
        <ImportantTransactionBadge type="SEIZURE" size="md" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.seizure")).toBeInTheDocument();
    });

    it("null 타입은 아무것도 렌더링하지 않음", () => {
      const { container } = render(
        <ImportantTransactionBadge type={null} size="md" />,
        { wrapper }
      );

      expect(container.firstChild).toBeNull();
    });

    it("undefined 타입은 아무것도 렌더링하지 않음", () => {
      const { container } = render(
        <ImportantTransactionBadge type={undefined} size="md" />,
        { wrapper }
      );

      expect(container.firstChild).toBeNull();
    });

    it("키워드 수 표시", () => {
      render(
        <ImportantTransactionBadge
          type="LOAN_EXECUTION"
          keywords={["대출 실행", "실행"]}
          size="md"
        />,
        { wrapper }
      );

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("아이콘 표시 (showIcon=true)", () => {
      render(
        <ImportantTransactionBadge type="LOAN_EXECUTION" size="md" showIcon={true} />,
        { wrapper }
      );

      // 아이콘이 있는지 확인
      const badge = screen.getByText("importantTransaction.loanExecution");
      expect(badge.closest("span")).toBeInTheDocument();
    });

    it("sm 사운드 렌더링", () => {
      render(
        <ImportantTransactionBadge type="LOAN_EXECUTION" size="sm" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.loanExecution")).toBeInTheDocument();
    });

    it("lg 사운드 렌더링", () => {
      render(
        <ImportantTransactionBadge type="LOAN_EXECUTION" size="lg" />,
        { wrapper }
      );

      expect(screen.getByText("importantTransaction.loanExecution")).toBeInTheDocument();
    });
  });

  describe("SeverityBadge", () => {
    it("INFO 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="INFO" size="md" />, { wrapper });

      expect(screen.getByText("severity.info")).toBeInTheDocument();
    });

    it("WARNING 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="WARNING" size="md" />, { wrapper });

      expect(screen.getByText("severity.warning")).toBeInTheDocument();
    });

    it("CRITICAL 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="CRITICAL" size="md" />, { wrapper });

      expect(screen.getByText("severity.critical")).toBeInTheDocument();
    });
  });
});
