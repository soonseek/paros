/**
 * Search Types (Story 8.1: 다차원 검색 구현, Story 8.2: 복합 필터링 구현)
 *
 * 다차원 검색 필터 타입 정의
 *
 * @module types/search
 */

/**
 * 거래 유형 enum (Story 8.2, AC3)
 */
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

/**
 * 거래 성격 enum (Story 8.2, AC4, Epic 4)
 */
export type TransactionNature = "CREDITOR" | "COLLATERAL" | "PRIORITY_REPAYMENT";

/**
 * 검색 필터 인터페이스 (Story 8.1, Task 1.3)
 */
export interface SearchFilters {
  /** 키워드 검색 (메모 필드) */
  keyword?: string;
  /** 날짜 범위 검색 */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  /** 금액 범위 검색 */
  amountRange?: {
    min?: number;
    max?: number;
  };
  /** 태그 검색 (다중 선택, OR 조건) */
  tags?: string[];
}

/**
 * 확장 검색 필터 인터페이스 (Story 8.2, ExtendedSearchFilters)
 * Story 8.1 SearchFilters를 상속받아 4개 추가 필터 포함
 */
export interface ExtendedSearchFilters extends SearchFilters {
  /** 거래 유형 필터 (다중 선택, OR 조건) */
  transactionType?: TransactionType[];
  /** 거래 성격 필터 (다중 선택, OR 조건) */
  transactionNature?: TransactionNature[];
  /** 중요 거래만 보기 */
  isImportantOnly?: boolean;
  /** AI 신뢰도 범위 */
  confidenceRange?: {
    min?: number;
    max?: number;
  };
}

/**
 * 검색 옵션 타입 (Story 8.1, Task 9)
 */
export interface SearchOptions {
  /** 검색 결과 개수 제한 */
  limit?: number;
  /** 검색 결과 오프셋 */
  offset?: number;
  /** 정렬 필드 */
  sortBy?: "date" | "depositAmount" | "withdrawalAmount" | "confidenceScore";
  /** 정렬 순서 */
  sortOrder?: "asc" | "desc";
}

/**
 * 검색 결과 메타데이터 (Story 8.1, AC6)
 */
export interface SearchResultMetadata {
  /** 총 결과 수 */
  totalCount: number;
  /** 필터링된 결과 수 */
  filteredCount: number;
  /** 검색 실행 시간 (ms) */
  searchTime: number;
  /** 3초 이내 응답 여부 (NFR-003) */
  withinSLA: boolean;
}

/**
 * Transaction type for search filters
 */
export interface Transaction {
  depositAmount?: string | number | null;
  withdrawalAmount?: string | number | null;
  confidenceScore?: number | null;
  transactionDate?: Date | string | null;
  memo?: string | null;
  tags?: { tag: { name: string } }[];
  category?: string | null;
  transactionNature?: string | null;
  importantTransaction?: boolean | null;
}
