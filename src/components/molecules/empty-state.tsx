/**
 * Empty State Component (Story 8.1, Task 7: 검색 결과 없음 처리)
 *
 * 검색 결과 없음 메시지 표시
 *
 * @module components/molecules/empty-state
 */

import { SearchX, FilterX } from "lucide-react";
import { Button } from "~/components/ui/button";

/**
 * Props 인터페이스 (Story 8.1, Task 7.2)
 */
interface EmptyStateProps {
  /** Empty State 타입 */
  type?: "search" | "filter";
  /** 커스텀 메시지 */
  message?: string;
  /** 안내 문구 */
  description?: string;
  /** 리셋 버튼 핸들러 */
  onReset?: () => void;
  /** 리셋 버튼 텍스트 */
  resetButtonText?: string;
  /** 컴포넌트 크기 */
  size?: "default" | "compact";
}

/**
 * EmptyState 컴포넌트 (Story 8.1, AC5)
 *
 * 검색 결과가 없을 때 메시지와 리셋 버튼 표시
 */
export function EmptyState({
  type = "search",
  message,
  description,
  onReset,
  resetButtonText = "필터 초기화",
  size = "default",
}: EmptyStateProps) {
  // 기본 메시지 (AC5)
  const defaultMessage = type === "search" ? "검색 결과가 없습니다" : "표시할 거래가 없습니다";

  // 기본 안내 문구 (AC5)
  const defaultDescription =
    "검색 조건을 초기화하려면 필터 리셋 버튼을 클릭하세요";

  // 아이콘 선택
  const Icon = type === "search" ? SearchX : FilterX;

  // 컴팩트 모드 여부
  const isCompact = size === "compact";

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        isCompact ? "py-8" : "py-16"
      }`}
      role="status"
      aria-live="polite"
    >
      {/* 아이콘 */}
      <div className={`text-gray-400 mb-4 ${isCompact ? "h-12 w-12" : "h-16 w-16"}`}>
        <Icon className="h-full w-full" />
      </div>

      {/* 메시지 (AC5) */}
      <h3 className={`font-semibold text-gray-900 mb-2 ${isCompact ? "text-lg" : "text-xl"}`}>
        {message ?? defaultMessage}
      </h3>

      {/* 안내 문구 (AC5) */}
      <p className={`text-gray-500 mb-6 max-w-md ${isCompact ? "text-sm" : "text-base"}`}>
        {description ?? defaultDescription}
      </p>

      {/* 리셋 버튼 (AC8) */}
      {onReset && (
        <Button
          variant="outline"
          onClick={onReset}
          aria-label={resetButtonText}
        >
          {resetButtonText}
        </Button>
      )}
    </div>
  );
}
