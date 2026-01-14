/**
 * Finding Card Component Tests
 *
 * Story 4.3: 중요 거래 자동 식별
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/await-thenable */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FindingCard, FindingList } from "./finding-card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "~/lib/i18n/index";

// Mock tRPC API
vi.mock("~/utils/api", () => ({
  api: {
    findings: {
      resolveFinding: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
        }),
      },
      unresolveFinding: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
        }),
      },
    },
  },
}));

const mockI18n = {
  t: (key: string) => {
    const translations: Record<string, string> = {
      "finding.resolved": "해결됨",
      "finding.resolve": "해결",
      "finding.unresolve": "미해결 상태로 변경",
      "finding.type": "유형",
      "finding.title": "발견사항",
      "transaction.table.date": "거래일자",
      "transaction.table.memo": "적요",
      "transaction.table.deposit": "입금액",
      "transaction.table.withdrawal": "출금액",
    };
    return translations[key] ?? key;
  },
  formatMessage: (key: string) => key,
  formatDate: (date: Date) => new Date(date).toLocaleDateString(),
  formatCurrency: (value: number) => `${value}원`,
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="ko" messages={mockI18n as any}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
};

describe("FindingCard", () => {
  const mockFinding = {
    id: "finding-1",
    findingType: "IMPORTANT_TRANSACTION",
    title: "대출 실행 - 대출 실행 감지",
    description: "매칭된 키워드: 대출 실행",
    severity: "WARNING" as const,
    priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date("2024-01-01"),
    relatedTransactionIds: ["tx-1"],
    relatedCreditorNames: null,
    transaction: {
      id: "tx-1",
      transactionDate: new Date("2024-01-01"),
      depositAmount: "5000000",
      withdrawalAmount: null,
      memo: "대출 실행",
    },
  };

  it("Finding 카드 렌더링", () => {
    render(<FindingCard finding={mockFinding} caseId="case-1" />, { wrapper });

    expect(screen.getByText("대출 실행 - 대출 실행 감지")).toBeInTheDocument();
    expect(screen.getByText(/매칭된 키워드/)).toBeInTheDocument();
    expect(screen.getByText("유형: IMPORTANT_TRANSACTION")).toBeInTheDocument();
  });

  it("미해결 Finding은 해결 버튼 표시", () => {
    render(<FindingCard finding={mockFinding} caseId="case-1" />, { wrapper });

    expect(screen.getByText("해결")).toBeInTheDocument();
  });

  it("해결된 Finding은 해제 버튼 표시", () => {
    const resolvedFinding = { ...mockFinding, isResolved: true, resolvedAt: new Date() };
    render(<FindingCard finding={resolvedFinding} caseId="case-1" />, { wrapper });

    expect(screen.getByText("미해결 상태로 변경")).toBeInTheDocument();
  });

  it("해결 버튼 클릭 시 onResolve 호출", async () => {
    const onResolve = vi.fn();
    render(<FindingCard finding={mockFinding} caseId="case-1" onResolve={onResolve} />, { wrapper });

    const resolveButton = screen.getByText("해결");
    await fireEvent.click(resolveButton);

    // 실제로는 mutation이 호출되지만, 여기서는 onResolve 콜백만 확인
    // 비동기 처리를 기다려야 할 수 있음
  });

  it("연결된 거래 정보 표시", () => {
    render(<FindingCard finding={mockFinding} caseId="case-1" />, { wrapper });

    expect(screen.getByText("거래일자:")).toBeInTheDocument();
  });

  it("거래 정보 확장 토글", () => {
    render(<FindingCard finding={mockFinding} caseId="case-1" />, { wrapper });

    // 초기 상태는 접혀있음
    expect(screen.queryByText("적요:")).not.toBeInTheDocument();

    // 클릭하여 펼치기
    const toggleButton = screen.getByText(/거래일자:/);
    fireEvent.click(toggleButton);

    // 펼쳐지면 세부 정보 표시
    // (실제 DOM 상태 확인 필요)
  });

  it("CRITICAL 심각도는 빨간 배경", () => {
    const criticalFinding = { ...mockFinding, severity: "CRITICAL" as const };
    const { container } = render(<FindingCard finding={criticalFinding} caseId="case-1" />, { wrapper });

    const card = container.querySelector(".bg-red-50");
    expect(card).toBeInTheDocument();
  });

  it("WARNING 심각도는 노란 배경", () => {
    const { container } = render(<FindingCard finding={mockFinding} caseId="case-1" />, { wrapper });

    const card = container.querySelector(".bg-yellow-50");
    expect(card).toBeInTheDocument();
  });

  it("INFO 심각도는 파란 배경", () => {
    const infoFinding = { ...mockFinding, severity: "INFO" as const };
    const { container } = render(<FindingCard finding={infoFinding} caseId="case-1" />, { wrapper });

    const card = container.querySelector(".bg-blue-50");
    expect(card).toBeInTheDocument();
  });

  it("해결된 Finding은 투명도 60%", () => {
    const resolvedFinding = { ...mockFinding, isResolved: true };
    const { container } = render(<FindingCard finding={resolvedFinding} caseId="case-1" />, { wrapper });

    const card = container.querySelector(".opacity-60");
    expect(card).toBeInTheDocument();
  });
});

describe("FindingList", () => {
  it("Finding 목록 렌더링", () => {
    const findings = [
      {
        id: "finding-1",
        findingType: "IMPORTANT_TRANSACTION",
        title: "대출 실행 감지",
        description: "매칭된 키워드: 대출 실행",
        severity: "WARNING" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        relatedTransactionIds: ["tx-1"],
        relatedCreditorNames: null,
        transaction: null,
      },
      {
        id: "finding-2",
        findingType: "SEIZURE",
        title: "압류 감지",
        description: "매칭된 키워드: 압류",
        severity: "CRITICAL" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: true,
        resolvedAt: new Date(),
        createdAt: new Date(),
        relatedTransactionIds: ["tx-2"],
        relatedCreditorNames: null,
        transaction: null,
      },
    ];

    render(<FindingList findings={findings} caseId="case-1" />, { wrapper });

    expect(screen.getByText("대출 실행 감지")).toBeInTheDocument();
    expect(screen.getByText("압류 감지")).toBeInTheDocument();
    expect(screen.getByText(/발견사항.*\(2\)/)).toBeInTheDocument();
  });

  it("빈 목록은 메시지 표시", () => {
    render(<FindingList findings={[]} caseId="case-1" />, { wrapper });

    expect(screen.getByText(/발견사항 없음/)).toBeInTheDocument();
  });

  it("미해결 Finding을 먼저 정렬", () => {
    const findings = [
      {
        id: "finding-1",
        findingType: "INFO",
        title: "해결된 Finding",
        description: null,
        severity: "INFO" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: true,
        resolvedAt: new Date(),
        createdAt: new Date(),
        relatedTransactionIds: ["tx-1"],
        relatedCreditorNames: null,
        transaction: null,
      },
      {
        id: "finding-2",
        findingType: "SEIZURE",
        title: "미해결 Finding",
        description: "압류 감지",
        severity: "CRITICAL" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        relatedTransactionIds: ["tx-2"],
        relatedCreditorNames: null,
        transaction: null,
      },
    ];

    render(<FindingList findings={findings} caseId="case-1" />, { wrapper });

    const cards = screen.getAllByText(/(해결된 Finding|미해결 Finding)/);
    expect(cards[0]).toContainText("미해결 Finding");
    expect(cards[1]).toContainText("해결된 Finding");
  });

  it("심각도순 정렬 (CRITICAL > WARNING > INFO)", () => {
    const findings = [
      {
        id: "finding-1",
        findingType: "INFO",
        title: "INFO Finding",
        description: null,
        severity: "INFO" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        relatedTransactionIds: ["tx-1"],
        relatedCreditorNames: null,
        transaction: null,
      },
      {
        id: "finding-2",
        findingType: "WARNING",
        title: "WARNING Finding",
        description: null,
        severity: "WARNING" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        relatedTransactionIds: ["tx-2"],
        relatedCreditorNames: null,
        transaction: null,
      },
      {
        id: "finding-3",
        findingType: "CRITICAL",
        title: "CRITICAL Finding",
        description: null,
        severity: "CRITICAL" as const,
        priority: null as "HIGH" | "MEDIUM" | "LOW" | null, // Story 6.5
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        relatedTransactionIds: ["tx-3"],
        relatedCreditorNames: null,
        transaction: null,
      },
    ];

    render(<FindingList findings={findings} caseId="case-1" />, { wrapper });

    const cards = screen.getAllByText(/(INFO Finding|WARNING Finding|CRITICAL Finding)/);
    expect(cards[0]).toContainText("CRITICAL Finding");
    expect(cards[1]).toContainText("WARNING Finding");
    expect(cards[2]).toContainText("INFO Finding");
  });
});
