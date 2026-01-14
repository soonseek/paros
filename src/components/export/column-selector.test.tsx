/**
 * ColumnSelector Component Tests (Story 7.2, Task 6.1)
 *
 * @module components/export/column-selector.test
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ColumnSelector } from "./column-selector";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("ColumnSelector Component", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  /**
   * AC1: 사용 가능한 모든 컬럼 표시
   */
  describe("AC1: 컬럼 목록 표시", () => {
    it("모든 컬럼 체크박스 렌더링", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류", "거래 성격", "신뢰도"]}
          onColumnChange={mockOnChange}
        />
      );

      // 모든 예상 컬럼 확인
      expect(screen.getByLabelText("메모")).toBeInTheDocument();
      expect(screen.getByLabelText("태그")).toBeInTheDocument();
      expect(screen.getByLabelText("AI 분류")).toBeInTheDocument();
      expect(screen.getByLabelText("거래 성격")).toBeInTheDocument();
      expect(screen.getByLabelText("신뢰도")).toBeInTheDocument();
    });

    it("선택된 컬럼은 체크된 상태로 표시", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류", "거래 성격"]}
          onColumnChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText("AI 분류")).toBeChecked();
      expect(screen.getByLabelText("거래 성격")).toBeChecked();
      expect(screen.getByLabelText("메모")).not.toBeChecked();
      expect(screen.getByLabelText("태그")).not.toBeChecked();
      expect(screen.getByLabelText("신뢰도")).not.toBeChecked();
    });
  });

  /**
   * AC2: 컬럼 토글 기능
   */
  describe("AC2: 컬럼 토글", () => {
    it("체크박스 클릭 시 컬럼 추가", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류"]}
          onColumnChange={mockOnChange}
        />
      );

      const memoCheckbox = screen.getByLabelText("메모");
      fireEvent.click(memoCheckbox);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(["AI 분류", "메모"]);
    });

    it("체크박스 클릭 시 컬럼 제거", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류", "메모"]}
          onColumnChange={mockOnChange}
        />
      );

      const memoCheckbox = screen.getByLabelText("메모");
      fireEvent.click(memoCheckbox);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(["AI 분류"]);
    });

    it("여러 컬럼 토글 가능", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류"]}
          onColumnChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByLabelText("메모"));
      expect(mockOnChange).toHaveBeenLastCalledWith(["AI 분류", "메모"]);

      fireEvent.click(screen.getByLabelText("태그"));
      expect(mockOnChange).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByLabelText("AI 분류"));
      // AI 분류 제거됨 (최종 3번째 호출 확인)
      expect(mockOnChange).toHaveBeenCalledTimes(3);
    });
  });

  /**
   * AC3: localStorage 영구 저장
   */
  describe("AC3: localStorage 저장", () => {
    it("컬럼 선택 변경 시 localStorage에 저장", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류"]}
          onColumnChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByLabelText("메모"));

      expect(localStorageMock.getItem("export-columns")).toBe(
        JSON.stringify(["AI 분류", "메모"])
      );
    });

    it("마운트 시 localStorage에서 불러오기", () => {
      const savedColumns = ["메모", "태그", "신뢰도"];
      localStorageMock.setItem(
        "export-columns",
        JSON.stringify(savedColumns)
      );

      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={[]}
          onColumnChange={mockOnChange}
        />
      );

      // useEffect가 실행되어 onColumnChange 호출
      expect(mockOnChange).toHaveBeenCalledWith(savedColumns);
    });

    it("localStorage 손상 시 무시하고 계속 진행", () => {
      localStorageMock.setItem("export-columns", "invalid-json");

      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={["AI 분류"]}
          onColumnChange={mockOnChange}
        />
      );

      // 손상된 JSON은 무시되어야 함
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  /**
   * 기본 UI 확인
   */
  describe("UI 확인", () => {
    it("포함할 열 선택 레이블 표시", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={[]}
          onColumnChange={mockOnChange}
        />
      );

      expect(screen.getByText("포함할 열 선택")).toBeInTheDocument();
    });

    it("모든 컬럼 레이블 올바르게 표시", () => {
      const mockOnChange = vi.fn();
      render(
        <ColumnSelector
          selectedColumns={[]}
          onColumnChange={mockOnChange}
        />
      );

      expect(screen.getByText("메모")).toBeInTheDocument();
      expect(screen.getByText("태그")).toBeInTheDocument();
      expect(screen.getByText("AI 분류")).toBeInTheDocument();
      expect(screen.getByText("거래 성격")).toBeInTheDocument();
      expect(screen.getByText("신뢰도")).toBeInTheDocument();
    });
  });
});
