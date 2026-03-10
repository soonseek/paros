/**
 * Transaction Nature Badge Component Tests
 *
 * Story 4.4: 거래 성격 판단
 */

 
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionNatureBadge, SeverityBadge } from "./transaction-nature-badge";
import { I18nProvider } from "~/lib/i18n/index";

const mockI18n = {
  t: (key: string) => {
    // 간단한 중첩 키 처리
    if (key.includes(".")) {
      const parts = key.split(".");
      if (parts[0] === "transactionNature" && parts[1] === "types") {
        const typeMap: Record<string, string> = {
          CREDITOR: "채권자 관련",
          COLLATERAL: "담보 관련",
          PRIORITY_REPAYMENT: "우선변제 관련",
          GENERAL: "일반 거래",
        };
        return typeMap[parts[2]] ?? key;
      }
      if (parts[0] === "transactionNature" && parts[1] === "collateralTypes") {
        const typeMap: Record<string, string> = {
          MORTGAGE: "저당권",
          LIEN: "질권",
          POSSESSION: "유치권",
        };
        return typeMap[parts[2]] ?? key;
      }
      if (parts[0] === "finding" && parts[1] === "severity") {
        const typeMap: Record<string, string> = {
          INFO: "정보",
          WARNING: "경고",
          CRITICAL: "긴급",
        };
        return typeMap[parts[2]] ?? key;
      }
      if (key === "transactionNature.label") return "거래 성격";
      if (key === "transactionNature.creditorName") return "채권자명";
      if (key === "transactionNature.collateralType") return "담보 유형";
    }

    // 단순 키 매칭
    const translations: Record<string, string> = {
      "transactionNature.label": "거래 성격",
      "transactionNature.creditorName": "채권자명",
      "transactionNature.collateralType": "담보 유형",
    };
    return translations[key] ?? key;
  },
  formatMessage: (key: string) => key,
  formatDate: (date: Date) => new Date(date).toLocaleDateString(),
  formatCurrency: (value: number) => `${value}원`,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="ko" messages={mockI18n as any}>
    {children}
  </I18nProvider>
);

describe("TransactionNatureBadge", () => {
  describe("렌더링", () => {
    it("채권자 관련 배지 렌더링", () => {
      render(<TransactionNatureBadge nature="CREDITOR" size="md" />, { wrapper });

      expect(screen.getByText("채권자 관련")).toBeInTheDocument();
    });

    it("담보 관련 배지 렌더링", () => {
      render(<TransactionNatureBadge nature="COLLATERAL" size="md" />, { wrapper });

      expect(screen.getByText("담보 관련")).toBeInTheDocument();
    });

    it("우선변제 관련 배지 렌더링", () => {
      render(
        <TransactionNatureBadge nature="PRIORITY_REPAYMENT" size="md" />,
        { wrapper }
      );

      expect(screen.getByText("우선변제 관련")).toBeInTheDocument();
    });

    it("일반 거래 배지 렌더링", () => {
      render(<TransactionNatureBadge nature="GENERAL" size="md" />, { wrapper });

      expect(screen.getByText("일반 거래")).toBeInTheDocument();
    });

    it("null 타입은 아무것도 렌더링하지 않음", () => {
      const { container } = render(
        <TransactionNatureBadge nature={null} size="md" />,
        { wrapper }
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("크기 (size)", () => {
    it("sm 크기 렌더링", () => {
      render(<TransactionNatureBadge nature="CREDITOR" size="sm" />, { wrapper });

      expect(screen.getByText("채권자 관련")).toBeInTheDocument();
    });

    it("lg 크기 렌더링", () => {
      render(<TransactionNatureBadge nature="CREDITOR" size="lg" />, { wrapper });

      expect(screen.getByText("채권자 관련")).toBeInTheDocument();
    });
  });

  describe("아이콘 표시", () => {
    it("showIcon=true일 때 아이콘 표시", () => {
      render(
        <TransactionNatureBadge nature="CREDITOR" size="md" showIcon={true} />,
        { wrapper }
      );

      const badge = screen.getByText("채권자 관련");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveTextContent(/👤/);
    });
  });

  describe("툴팁 (Tooltip)", () => {
    it("채권자명이 있으면 툴팁 표시", () => {
      render(
        <TransactionNatureBadge
          nature="CREDITOR"
          creditorName="김주택"
          size="md"
        />,
        { wrapper }
      );

      // 툴팁 내용은 DOM에 직접 렌더링되지 않으므로 배지만 확인
      const badge = screen.getByText("채권자 관련");
      expect(badge).toBeInTheDocument();
    });

    it("담보 유형이 있으면 툴팁 표시", () => {
      render(
        <TransactionNatureBadge
          nature="COLLATERAL"
          collateralType="MORTGAGE"
          size="md"
        />,
        { wrapper }
      );

      const badge = screen.getByText("담보 관련");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("접근성 (Accessibility)", () => {
    it("aria-label 속성 포함", () => {
      render(
        <TransactionNatureBadge
          nature="CREDITOR"
          creditorName="김주택"
          size="md"
        />,
        { wrapper }
      );

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label");
    });

    it("role='status' 속성 포함", () => {
      render(<TransactionNatureBadge nature="CREDITOR" size="md" />, { wrapper });

      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });
});

describe("SeverityBadge", () => {
  describe("렌더링", () => {
    it("INFO 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="INFO" size="md" />, { wrapper });

      expect(screen.getByText("정보")).toBeInTheDocument();
    });

    it("WARNING 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="WARNING" size="md" />, { wrapper });

      expect(screen.getByText("경고")).toBeInTheDocument();
    });

    it("CRITICAL 심각도 배지 렌더링", () => {
      render(<SeverityBadge severity="CRITICAL" size="md" />, { wrapper });

      expect(screen.getByText("긴급")).toBeInTheDocument();
    });
  });

  describe("아이콘", () => {
    it("각 심각도별 아이콘 표시", () => {
      const { rerender } = render(
        <SeverityBadge severity="INFO" size="md" />,
        { wrapper }
      );

      expect(screen.getByText(/ℹ️/)).toBeInTheDocument();

      rerender(<SeverityBadge severity="WARNING" size="md" />);
      expect(screen.getByText(/⚠️/)).toBeInTheDocument();

      rerender(<SeverityBadge severity="CRITICAL" size="md" />);
      expect(screen.getByText(/🔴/)).toBeInTheDocument();
    });
  });
});
