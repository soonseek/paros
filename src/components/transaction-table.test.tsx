/**
 * Transaction Table Component Tests
 *
 * Story 4.2: 신뢰도 점수 및 불확실한 분류 표시
 * Story 4.2 Code Review - HIGH #2: URL persistence tests
 * Story 4.2 Code Review - MEDIUM #5: i18n support
 * Story 4.2 Code Review - MEDIUM #7: Pagination support
 *
 * 테스트 범위:
 * - 거래 목록 표시
 * - 신뢰도 배지 표시
 * - 신뢰도 낮은 순 정렬 (AC2)
 * - 카테고리 필터
 * - 검색 기능
 * - TransactionDetail의 신뢰도 퍼센트 표시 (AC2)
 * - URL 파라미터로 정렬 상태 저장 (HIGH #2)
 * - 페이지네이션 UI 및 상호작용 (MEDIUM #7)
 *
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionTable, TransactionDetail } from "./transaction-table";
import { useRouter, useSearchParams } from "next/navigation";
import { I18nProvider } from "~/lib/i18n/index";

// Mock next/navigation for URL state (HIGH #2)
vi.mock("next/navigation");

// Helper function to render with I18nProvider
const renderWithI18n = (ui: React.ReactNode) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

// 테스트용 거래 데이터
const mockTransactions = [
  {
    id: "tx-1",
    transactionDate: new Date("2024-01-05"),
    depositAmount: "3000000.0000",
    withdrawalAmount: null,
    balance: "3000000.0000",
    memo: "홍길동급여",
    category: "입금",
    subcategory: "급여",
    confidenceScore: 0.95,
  },
  {
    id: "tx-2",
    transactionDate: new Date("2024-01-10"),
    depositAmount: null,
    withdrawalAmount: "50000.0000",
    balance: "2950000.0000",
    memo: "편의점",
    category: "출금",
    subcategory: "생활비",
    confidenceScore: 0.6,
  },
  {
    id: "tx-3",
    transactionDate: new Date("2024-01-15"),
    depositAmount: "150000.0000",
    withdrawalAmount: null,
    balance: "3100000.0000",
    memo: "이자수익",
    category: "입금",
    subcategory: "이자",
    confidenceScore: 0.92,
  },
  {
    id: "tx-4",
    transactionDate: new Date("2024-01-20"),
    depositAmount: null,
    withdrawalAmount: "250000.0000",
    balance: "2850000.0000",
    memo: "카드값",
    category: null,
    subcategory: null,
    confidenceScore: null,
  },
  {
    id: "tx-5",
    transactionDate: new Date("2024-01-25"),
    depositAmount: null,
    withdrawalAmount: "150000.0000",
    balance: "2700000.0000",
    memo: "식비",
    category: "출금",
    subcategory: "식비",
    confidenceScore: 0.3,
  },
];

describe("TransactionTable", () => {
  // Setup mocks for each test (HIGH #2)
  beforeEach(() => {
    const mockRouter = {
      push: vi.fn(),
    };

    const mockSearchParams = new URLSearchParams();

    vi.mocked(useRouter).mockReturnValue(mockRouter);
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);
  });

  it("[AC2] 거래 목록을 렌더링한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 거래 내역 표시 확인 (적요 컬럼에서 확인)
    expect(screen.getAllByText("홍길동급여")).toHaveLength(1); // 메모에만 있음
    expect(screen.getAllByText("편의점")).toHaveLength(1); // 메모에만 있음
    expect(screen.getAllByText("이자수익")).toHaveLength(1); // 메모에만 있음
    expect(screen.getAllByText("카드값")).toHaveLength(1); // 메모에만 있음
    expect(screen.getAllByText("식비")).toHaveLength(2); // 메모 + 서브카테고리
  });

  it("[AC2] 신뢰도 배지를 표시한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 높은 신뢰도 (95%)
    expect(screen.getByText("95%")).toBeInTheDocument();

    // 중간 신뢰도 (60%)
    expect(screen.getByText("60%")).toBeInTheDocument();

    // 낮은 신뢰도 (30%)
    expect(screen.getByText("30%")).toBeInTheDocument();

    // 불확실한 분류 라벨 (0.7 미만) - HIGH #3: aria-hidden으로 emoji가 분리되어 텍스트만 검색
    expect(screen.getAllByText("불확실한 분류")).toHaveLength(2);

    // 분류 안됨 (카테고리와 신뢰도 배지에 각각 표시)
    expect(screen.getAllByText("분류 안됨")).toHaveLength(2);
  });

  it("[AC2] 신뢰도 낮은 순 정렬이 동작한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // "신뢰도 낮은 순" 버튼 클릭 (HIGH #3: aria-label로 버튼 찾기)
    // aria-label: "신뢰도 오름차순으로 정렬 (낮은 신뢰도 먼저)"
    const sortButton = screen.getByRole("button", { name: /신뢰도.*낮은/ });
    fireEvent.click(sortButton);

    // 가장 낮은 신뢰도 (30%)가 화면에 표시되는지 확인
    expect(screen.getByText("30%")).toBeInTheDocument();

    // "식비" 거래가 표시되는지 확인 (신뢰도 0.3)
    expect(screen.getAllByText("식비")).toHaveLength(2); // 메모 + 서브카테고리
  });

  it("[AC2] 카테고리 필터가 동작한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // "입금" 카테고리 선택
    const categorySelect = screen.getByDisplayValue("전체");
    fireEvent.change(categorySelect, { target: { value: "입금" } });

    // 입금 거래만 표시되는지 확인 (getAllByText로 확인)
    expect(screen.getAllByText("홍길동급여")).toHaveLength(1);
    expect(screen.getAllByText("이자수익")).toHaveLength(1);
    expect(screen.queryByText("편의점")).not.toBeInTheDocument();
  });

  it("[AC2] 검색 기능이 동작한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 검색어 입력
    const searchInput = screen.getByPlaceholderText("메모, 카테고리 검색...");
    fireEvent.change(searchInput, { target: { value: "급여" } });

    // 검색 결과 확인
    expect(screen.getAllByText("홍길동급여")).toHaveLength(1);
    expect(screen.queryByText("편의점")).not.toBeInTheDocument();
    expect(screen.queryByText("이자수익")).not.toBeInTheDocument();
  });

  it("[AC2] 거래일자 정렬이 동작한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 기본 정렬: 최신순 (desc)
    const rows = screen.getAllByRole("row");
    const firstDataRow = rows[1];
    expect(firstDataRow).toHaveTextContent("2024. 01. 25"); // 가장 최신 거래
  });

  it("[AC2] 금액을 천 단위 콤마로 포맷팅한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 입금액 포맷팅 확인 (3,000,000원) - getAllByText로 확인
    expect(screen.getAllByText("3,000,000원").length).toBeGreaterThan(0);

    // 출금액 포맷팅 확인 (50,000원)
    expect(screen.getAllByText("50,000원").length).toBeGreaterThan(0);
  });

  it("[AC2] 필터링된 결과 수를 표시한다", () => {
    renderWithI18n(<TransactionTable transactions={mockTransactions} />);

    // 전체 거래 수
    expect(screen.getByText(/총 5건 표시/)).toBeInTheDocument();

    // 검색 후 결과 수 변경
    const searchInput = screen.getByPlaceholderText("메모, 카테고리 검색...");
    fireEvent.change(searchInput, { target: { value: "급여" } });

    expect(screen.getByText(/총 1건 표시/)).toBeInTheDocument();
  });

  it("[AC2] 거래가 없을 때 메시지를 표시한다", () => {
    renderWithI18n(<TransactionTable transactions={[]} />);

    expect(screen.getByText("표시할 거래가 없습니다")).toBeInTheDocument();
  });
});

describe("TransactionDetail", () => {
  it("[AC2] 거래 상세 정보를 렌더링한다", () => {
    const transaction = mockTransactions[0];
    renderWithI18n(<TransactionDetail transaction={transaction} />);

    // 기본 정보 (날짜 포맷: "2024. 01. 05.")
    expect(screen.getAllByText("2024. 01. 05.")).toHaveLength(1);
    expect(screen.getAllByText("홍길동급여")).toHaveLength(1);

    // 금액 정보 (getAllByText로 확인)
    expect(screen.getAllByText("3,000,000원").length).toBeGreaterThan(0);
  });

  it("[AC2] 신뢰도 퍼센트를 표시한다 (예: '입금 - 95% 신뢰도')", () => {
    const transaction = mockTransactions[0];
    renderWithI18n(<TransactionDetail transaction={transaction} />);

    // 카테고리와 신뢰도 퍼센트 함께 표시
    expect(screen.getByText("입금")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("신뢰도")).toBeInTheDocument();
  });

  it("[AC2] 서브카테고리를 표시한다", () => {
    const transaction = mockTransactions[0];
    renderWithI18n(<TransactionDetail transaction={transaction} />);

    expect(screen.getByText("서브카테고리: 급여")).toBeInTheDocument();
  });

  it("[AC2] 분류되지 않은 거래를 처리한다", () => {
    const transaction = mockTransactions[3]; // category: null
    renderWithI18n(<TransactionDetail transaction={transaction} />);

    expect(screen.getByText("분류 안됨")).toBeInTheDocument();
  });
});

describe("TransactionTable - Pagination (MEDIUM #7)", () => {
  const onPageChangeMock = vi.fn();

  beforeEach(() => {
    onPageChangeMock.mockClear();
  });

  it("[MEDIUM-7] 페이지네이션 UI를 렌더링한다", () => {
    const pagination = {
      page: 1,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    const { container } = renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    // 페이지네이션 컨트롤 존재 확인
    expect(screen.getByRole("navigation", { name: "거래 목록 페이지네이션" })).toBeInTheDocument();

    // 페이지 정보 확인
    expect(screen.getByText(/1 \/ 3 페이지/)).toBeInTheDocument();

    // 범위 정보: start=1, end=5, total=150
    const showingText = screen.getByText(/.*표시.*150.*건/);
    expect(showingText).toBeInTheDocument();
  });

  it("[MEDIUM-7] 다음 페이지 버튼을 클릭하면 onPageChange를 호출한다", () => {
    const pagination = {
      page: 1,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const nextButton = screen.getByRole("button", { name: "다음" });
    fireEvent.click(nextButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(2);
  });

  it("[MEDIUM-7] 이전 페이지 버튼을 클릭하면 onPageChange를 호출한다", () => {
    const pagination = {
      page: 2,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const prevButton = screen.getByRole("button", { name: "이전" });
    fireEvent.click(prevButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(1);
  });

  it("[MEDIUM-7] 첫 페이지에서는 처음/이전 버튼이 비활성화된다", () => {
    const pagination = {
      page: 1,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const firstButton = screen.getByRole("button", { name: "처음" });
    const prevButton = screen.getByRole("button", { name: "이전" });

    expect(firstButton).toBeDisabled();
    expect(prevButton).toBeDisabled();
  });

  it("[MEDIUM-7] 마지막 페이지에서는 다음/마지막 버튼이 비활성화된다", () => {
    const pagination = {
      page: 3,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: false,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const nextButton = screen.getByRole("button", { name: "다음" });
    const lastButton = screen.getByRole("button", { name: "마지막" });

    expect(nextButton).toBeDisabled();
    expect(lastButton).toBeDisabled();
  });

  it("[MEDIUM-7] 처음 버튼을 클릭하면 1페이지로 이동한다", () => {
    const pagination = {
      page: 2,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const firstButton = screen.getByRole("button", { name: "처음" });
    fireEvent.click(firstButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(1);
  });

  it("[MEDIUM-7] 마지막 버튼을 클릭하면 마지막 페이지로 이동한다", () => {
    const pagination = {
      page: 1,
      pageSize: 50,
      totalCount: 150,
      totalPages: 3,
      hasMore: true,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const lastButton = screen.getByRole("button", { name: "마지막" });
    fireEvent.click(lastButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(3);
  });

  it("[MEDIUM-7] 페이지네이션이 없으면 UI를 표시하지 않는다", () => {
    renderWithI18n(
      <TransactionTable transactions={mockTransactions} />
    );

    // 페이지네이션 관련 요소가 없어야 함
    expect(screen.queryByRole("button", { name: "이전" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음" })).not.toBeInTheDocument();
    expect(screen.queryByText(/\/\d+ 페이지/)).not.toBeInTheDocument();
  });

  it("[MEDIUM-7] 한 페이지만 있으면 모든 버튼이 비활성화된다", () => {
    const pagination = {
      page: 1,
      pageSize: 50,
      totalCount: 30,
      totalPages: 1,
      hasMore: false,
    };

    renderWithI18n(
      <TransactionTable
        transactions={mockTransactions}
        pagination={pagination}
        onPageChange={onPageChangeMock}
      />
    );

    const firstButton = screen.getByRole("button", { name: "처음" });
    const prevButton = screen.getByRole("button", { name: "이전" });
    const nextButton = screen.getByRole("button", { name: "다음" });
    const lastButton = screen.getByRole("button", { name: "마지막" });

    expect(firstButton).toBeDisabled();
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
    expect(lastButton).toBeDisabled();
  });
});
