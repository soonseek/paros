/**
 * Fund Flow Filter Store (Story 5.5: 추적 필터링)
 *
 * Zustand store for global filter state management
 * Client-side state with React Query integration
 *
 * @module store/fundFlowFilterStore
 */

import { create } from "zustand";
import type { TransactionNature } from "@prisma/client";
import type { FundFlowFilters } from "~/lib/filter-utils";

/**
 * Filter store state interface
 */
interface FundFlowFilterState {
  // Current active filters
  filters: FundFlowFilters;

  // UI state
  isFilterPanelOpen: boolean;

  // Actions
  setDateRange: (start: Date | null, end: Date | null) => void;
  setAmountRange: (min: number | null, max: number | null) => void;
  setTags: (tags: string[]) => void;
  setTransactionNature: (natures: TransactionNature[]) => void;
  setImportantOnly: (importantOnly: boolean) => void;

  // Bulk update
  setFilters: (filters: Partial<FundFlowFilters>) => void;

  // Reset
  resetFilters: () => void;

  // Filter panel toggle
  toggleFilterPanel: () => void;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;

  // Check if any filters are active
  hasActiveFilters: () => boolean;
  getActiveFilterCount: () => number;
}

/**
 * Default empty filters
 */
const defaultFilters: FundFlowFilters = {};

/**
 * Create Zustand store for fund flow filter state (Story 5.5, Task 1.2)
 */
export const useFundFlowFilterStore = create<FundFlowFilterState>((set, get) => ({
  // Initial state
  filters: defaultFilters,
  isFilterPanelOpen: false,

  // Individual filter setters
  setDateRange: (start, end) =>
    set((state) => ({
      filters: {
        ...state.filters,
        dateRange: start && end ? { start, end } : undefined,
      },
    })),

  setAmountRange: (min, max) =>
    set((state) => {
      // LOW #1: 유효성 검증
      if (min !== null && max !== null) {
        if (min < 0 || max < 0) {
          console.warn('[FundFlowFilterStore] 음수 금액은 허용되지 않습니다');
          return state; // 유효하지 않으면 상태 변경 없음
        }
        if (min > max) {
          console.warn('[FundFlowFilterStore] 최소 금액이 최대 금액보다 클 수 없습니다');
          return state; // 유효하지 않으면 상태 변경 없음
        }
      }

      return {
        filters: {
          ...state.filters,
          amountRange: min !== null && max !== null ? { min, max } : undefined,
        },
      };
    }),

  setTags: (tags) =>
    set((state) => ({
      filters: {
        ...state.filters,
        tags: tags.length > 0 ? tags : undefined,
      },
    })),

  setTransactionNature: (natures) =>
    set((state) => ({
      filters: {
        ...state.filters,
        transactionNature: natures.length > 0 ? natures : undefined,
      },
    })),

  setImportantOnly: (importantOnly) =>
    set((state) => ({
      filters: {
        ...state.filters,
        importantOnly: importantOnly || undefined,
      },
    })),

  // Bulk update filters
  setFilters: (newFilters) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...newFilters,
      },
    })),

  // Reset all filters
  resetFilters: () =>
    set({
      filters: defaultFilters,
    }),

  // Filter panel UI controls
  toggleFilterPanel: () =>
    set((state) => ({
      isFilterPanelOpen: !state.isFilterPanelOpen,
    })),

  openFilterPanel: () =>
    set({
      isFilterPanelOpen: true,
    }),

  closeFilterPanel: () =>
    set({
      isFilterPanelOpen: false,
    }),

  // Utility functions
  hasActiveFilters: () => {
    const { filters } = get();
    return (
      filters.dateRange !== undefined ||
      filters.amountRange !== undefined ||
      filters.tags !== undefined ||
      filters.transactionNature !== undefined ||
      filters.importantOnly !== undefined
    );
  },

  getActiveFilterCount: () => {
    const { filters } = get();
    let count = 0;

    if (filters.dateRange) count++;
    if (filters.amountRange) count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.transactionNature && filters.transactionNature.length > 0) count++;
    if (filters.importantOnly) count++;

    return count;
  },
}));
