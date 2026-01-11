# Story 4.2 Action Items
## Detailed Implementation Plan for Code Review Fixes

**Created**: 2026-01-10  
**Story**: 4.2 - Confidence Score Display & Uncertain Classification  
**Total Issues**: 7 (1 CRITICAL, 2 HIGH, 4 MEDIUM)  
**Estimated Total Effort**: 18-25 hours  
**Phase**: CRITICAL & HIGH fixes required before release; MEDIUM fixes recommended

---

## Priority Matrix

```
                High
            Impact
                |
                | [CRITICAL] #1
                | [HIGH] #2, #3
         [MEDIUM] #4-7
                |
                +------------ Effort -------->
            Low                              High
```

### Recommended Phase Execution
- **Phase 1 (Release Blocker)**: Issue #1, #2, #3 (9-10 hours) → Must complete before merge
- **Phase 2 (Post-Release)**: Issue #4, #5, #6, #7 (9-15 hours) → Sprint backlog for next iteration

---

## CRITICAL ISSUES

### [CRITICAL] Issue #1: Hardcoded Confidence Thresholds

**ID**: ACTION-4.2-1  
**Severity**: 🔴 CRITICAL  
**Category**: Architecture / Configuration  
**Status**: Not Started  
**Effort Estimate**: 2-3 hours  

#### Problem Statement
Confidence score thresholds (0.5, 0.7) are hardcoded in multiple locations without configuration mechanism.

**Files Affected**:
- `src/components/confidence-badge.tsx` (lines 42-57, 95-100)
- No other files directly dependent (good isolation)

**Current Behavior**:
```tsx
// confidence-badge.tsx - Lines 42-57
const getLevel = () => {
  if (confidenceScore >= 0.7) {    // ← Hardcoded threshold #1
    return { label: "높음", ... };
  }
  if (confidenceScore >= 0.5) {    // ← Hardcoded threshold #2
    return { label: "중간", ... };
  }
  return { label: "낮음", ... };
};

// Lines 95-100
{confidenceScore < 0.7 && (        // ← Hardcoded threshold #3 (duplicate)
  <span>🟡 불확실한 분류</span>
)}
```

#### Root Cause
- No configuration system in place
- Values hardcoded at point of use
- Assumes thresholds never change (incorrect assumption for production)

#### Business Impact
- ❌ Product team cannot adjust confidence levels
- ❌ No support for A/B testing different thresholds
- ❌ No regional variations (different thresholds for KR, US, JP, etc.)
- ❌ Requires developer time to make business logic changes
- 📉 Reduces product velocity for hypothesis testing

#### Technical Impact
- ❌ Violates DRY principle (3+ instances of same threshold)
- ❌ Synchronization risk (change one, forget others)
- ❌ Hard to unit test threshold behavior separately
- ❌ Couples business logic to UI component

#### Acceptance Criteria
- ✅ Thresholds extracted to centralized configuration
- ✅ Single source of truth for confidence thresholds
- ✅ No changes to component behavior (100% test pass rate)
- ✅ Configuration easily overridable for testing/staging
- ✅ No hardcoded values remain in component files

#### Implementation Plan

**Step 1: Create configuration constant file** (15 min)
```bash
touch src/lib/confidence-config.ts
```

**File: `src/lib/confidence-config.ts`**
```typescript
/**
 * Confidence Score Thresholds Configuration
 * 
 * These values define the boundaries for confidence level classification:
 * - HIGH: >= 0.7 (dark green, high confidence)
 * - MEDIUM: 0.5 - 0.7 (yellow, medium confidence)  
 * - LOW: < 0.5 (orange, low confidence)
 * 
 * The UNCERTAIN_LABEL_THRESHOLD (0.7) determines when to show
 * the "불확실한 분류" (uncertain classification) warning.
 * 
 * To adjust thresholds for A/B testing:
 * 1. Override in environment variables: NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD=0.75
 * 2. Or adjust values here and commit to git
 */

export const CONFIDENCE_THRESHOLDS = {
  // High confidence level (green badge)
  HIGH: parseFloat(process.env.NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD ?? "0.7"),
  
  // Medium confidence level (yellow badge)
  MEDIUM: parseFloat(process.env.NEXT_PUBLIC_CONFIDENCE_MEDIUM_THRESHOLD ?? "0.5"),
  
  // Threshold for showing "불확실한 분류" warning label
  UNCERTAIN_LABEL: parseFloat(process.env.NEXT_PUBLIC_CONFIDENCE_UNCERTAIN_THRESHOLD ?? "0.7"),
} as const;

/**
 * Validation helper to ensure confidence scores are within [0, 1] range
 */
export const validateConfidenceScore = (score: unknown): number | null => {
  if (score === null || score === undefined) return null;
  
  const num = Number(score);
  if (isNaN(num) || num < 0 || num > 1) {
    console.warn(
      `[ConfidenceScore] Invalid score: ${score}. Must be between 0 and 1.`,
      new Error().stack?.split('\n')[2]
    );
    return null;
  }
  
  return num;
};

/**
 * Determine confidence level based on score
 */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export const getConfidenceLevel = (score: number | null | undefined): ConfidenceLevel => {
  if (score === null || score === undefined) return "LOW";
  
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "HIGH";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
};
```

**Step 2: Update confidence-badge.tsx** (20 min)
```tsx
// BEFORE (lines 1-20)
import { cn } from "~/lib/utils";

interface ConfidenceBadgeProps {
  confidenceScore: number | null | undefined;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBadge({
  confidenceScore,
  showPercentage = true,
  size = "md",
}: ConfidenceBadgeProps) {
  // AFTER
  import { cn } from "~/lib/utils";
  import { 
    CONFIDENCE_THRESHOLDS, 
    validateConfidenceScore,
    getConfidenceLevel,
    type ConfidenceLevel
  } from "~/lib/confidence-config";

  interface ConfidenceBadgeProps {
    confidenceScore: number | null | undefined;
    showPercentage?: boolean;
    size?: "sm" | "md" | "lg";
  }

  export function ConfidenceBadge({
    confidenceScore,
    showPercentage = true,
    size = "md",
  }: ConfidenceBadgeProps) {
    // Validate input
    const validScore = validateConfidenceScore(confidenceScore);
    
    if (validScore === null) {
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-gray-100 text-gray-500",
            size === "sm" && "text-[10px] px-1.5 py-0.5",
            size === "lg" && "text-sm px-3 py-1"
          )}
        >
          분류 안됨
        </span>
      );
    }

    const percentage = Math.round(validScore * 100);

    // Use centralized configuration
    const getLevel = (): {
      label: string;
      bgColor: string;
      textColor: string;
      icon: string;
    } => {
      const level = getConfidenceLevel(validScore);
      
      switch (level) {
        case "HIGH":
          return {
            label: "높음",
            bgColor: "bg-green-100",
            textColor: "text-green-700",
            icon: "✓",
          };
        case "MEDIUM":
          return {
            label: "중간",
            bgColor: "bg-yellow-100",
            textColor: "text-yellow-700",
            icon: "~",
          };
        case "LOW":
          return {
            label: "낮음",
            bgColor: "bg-orange-100",
            textColor: "text-orange-700",
            icon: "!",
          };
      }
    };
    
    const level = getLevel();

    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            level.bgColor,
            level.textColor,
            size === "sm" && "text-[10px] px-1.5 py-0.5",
            size === "lg" && "text-sm px-3 py-1"
          )}
          title={`신뢰도: ${percentage}%`}
        >
          <span>{level.icon}</span>
          {showPercentage && <span>{percentage}%</span>}
        </span>

        {/* Use centralized configuration for threshold check */}
        {validScore < CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL && (
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
              "bg-orange-50 text-orange-600 border border-orange-200",
              size === "sm" && "text-[10px] px-1.5 py-0.5",
              size === "lg" && "text-sm px-2.5 py-1"
            )}
          >
            🟡 불확실한 분류
          </span>
        )}
      </div>
    );
  }
```

**Step 3: Add environment variables** (10 min)

**File: `.env.local`** (for development)
```
# Confidence Score Thresholds (0.0 - 1.0)
NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD=0.7
NEXT_PUBLIC_CONFIDENCE_MEDIUM_THRESHOLD=0.5
NEXT_PUBLIC_CONFIDENCE_UNCERTAIN_THRESHOLD=0.7
```

**File: `.env.example`** (documentation)
```
# Confidence Score Thresholds (0.0 - 1.0)
# Adjust these for A/B testing or regional variations
NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD=0.7
NEXT_PUBLIC_CONFIDENCE_MEDIUM_THRESHOLD=0.5
NEXT_PUBLIC_CONFIDENCE_UNCERTAIN_THRESHOLD=0.7
```

**File: `env.js`** (Zod validation)
Add to existing zod schema:
```javascript
// Add validation for new environment variables
const schema = z.object({
  // ... existing variables ...
  NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD: z
    .string()
    .default("0.7")
    .transform((v) => {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0 || num > 1) {
        throw new Error("NEXT_PUBLIC_CONFIDENCE_HIGH_THRESHOLD must be 0.0-1.0");
      }
      return num;
    }),
  NEXT_PUBLIC_CONFIDENCE_MEDIUM_THRESHOLD: z
    .string()
    .default("0.5")
    .transform((v) => {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0 || num > 1) {
        throw new Error("NEXT_PUBLIC_CONFIDENCE_MEDIUM_THRESHOLD must be 0.0-1.0");
      }
      return num;
    }),
  NEXT_PUBLIC_CONFIDENCE_UNCERTAIN_THRESHOLD: z
    .string()
    .default("0.7")
    .transform((v) => {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0 || num > 1) {
        throw new Error("NEXT_PUBLIC_CONFIDENCE_UNCERTAIN_THRESHOLD must be 0.0-1.0");
      }
      return num;
    }),
});
```

**Step 4: Add configuration tests** (30 min)

**File: `src/lib/confidence-config.test.ts`**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CONFIDENCE_THRESHOLDS,
  validateConfidenceScore,
  getConfidenceLevel,
} from "./confidence-config";

describe("CONFIDENCE_THRESHOLDS", () => {
  it("has valid threshold values", () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThan(CONFIDENCE_THRESHOLDS.MEDIUM);
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL).toBeGreaterThan(0);
  });

  it("defaults to 0.7 for HIGH threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.7);
  });

  it("defaults to 0.5 for MEDIUM threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(0.5);
  });
});

describe("validateConfidenceScore", () => {
  it("accepts valid scores", () => {
    expect(validateConfidenceScore(0.0)).toBe(0);
    expect(validateConfidenceScore(0.5)).toBe(0.5);
    expect(validateConfidenceScore(0.95)).toBe(0.95);
    expect(validateConfidenceScore(1.0)).toBe(1);
  });

  it("rejects invalid scores", () => {
    expect(validateConfidenceScore(-0.1)).toBeNull();
    expect(validateConfidenceScore(1.1)).toBeNull();
    expect(validateConfidenceScore(NaN)).toBeNull();
    expect(validateConfidenceScore("abc")).toBeNull();
  });

  it("handles null/undefined", () => {
    expect(validateConfidenceScore(null)).toBeNull();
    expect(validateConfidenceScore(undefined)).toBeNull();
  });
});

describe("getConfidenceLevel", () => {
  it("returns HIGH for scores >= 0.7", () => {
    expect(getConfidenceLevel(0.7)).toBe("HIGH");
    expect(getConfidenceLevel(0.95)).toBe("HIGH");
    expect(getConfidenceLevel(1.0)).toBe("HIGH");
  });

  it("returns MEDIUM for scores 0.5-0.7", () => {
    expect(getConfidenceLevel(0.5)).toBe("MEDIUM");
    expect(getConfidenceLevel(0.6)).toBe("MEDIUM");
    expect(getConfidenceLevel(0.69)).toBe("MEDIUM");
  });

  it("returns LOW for scores < 0.5", () => {
    expect(getConfidenceLevel(0.49)).toBe("LOW");
    expect(getConfidenceLevel(0.3)).toBe("LOW");
    expect(getConfidenceLevel(0.0)).toBe("LOW");
  });

  it("returns LOW for null/undefined", () => {
    expect(getConfidenceLevel(null)).toBe("LOW");
    expect(getConfidenceLevel(undefined)).toBe("LOW");
  });
});
```

**Step 5: Update tests** (20 min)
Update `src/components/confidence-badge.test.tsx` to test configuration integration:

```typescript
import { CONFIDENCE_THRESHOLDS } from "~/lib/confidence-config";

describe("ConfidenceBadge with configuration", () => {
  it("uses threshold from CONFIDENCE_THRESHOLDS.HIGH", () => {
    render(<ConfidenceBadge confidenceScore={CONFIDENCE_THRESHOLDS.HIGH} />);
    // Should show "높음" (HIGH level)
    expect(screen.getByText("높음")).toBeInTheDocument();
  });

  it("uses threshold from CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL", () => {
    render(
      <ConfidenceBadge 
        confidenceScore={CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL - 0.01} 
      />
    );
    // Should show "불확실한 분류" label
    expect(screen.getByText("불확실한 분류")).toBeInTheDocument();
  });
});
```

**Step 6: Verify no test regressions** (10 min)
```bash
npm test -- --testPathPattern="confidence-badge|transaction-table"
```

Expected output: ✅ All 46 tests pass (no changes to behavior)

#### Testing Strategy
- ✅ Unit tests: CONFIDENCE_THRESHOLDS configuration values
- ✅ Unit tests: validateConfidenceScore edge cases
- ✅ Unit tests: getConfidenceLevel boundary values
- ✅ Integration tests: ConfidenceBadge with configuration
- ✅ Regression tests: All existing 46 tests still pass
- ✅ Manual test: Adjust `.env.local` and verify threshold changes

#### Validation Checklist
- [ ] Created `src/lib/confidence-config.ts` with constants and validation
- [ ] Updated `src/components/confidence-badge.tsx` to use constants
- [ ] Added environment variable documentation in `.env.example`
- [ ] Created `src/lib/confidence-config.test.ts` with 8+ test cases
- [ ] Updated existing tests to verify configuration usage
- [ ] All 46 original tests pass
- [ ] No hardcoded threshold values remain in component files
- [ ] Configuration is overridable via environment variables
- [ ] Code reviewed for type safety and error handling

#### Completion Criteria
- ✅ Thresholds extracted to single configuration file
- ✅ Environment variables override default values
- ✅ Validation prevents invalid threshold values
- ✅ 100% test pass rate (46/46)
- ✅ Configuration documented in JSDoc comments

---

### [CRITICAL] Issue #1 - Summary

| Aspect | Details |
|--------|---------|
| **Effort** | 2-3 hours |
| **Complexity** | Low (refactor, no new features) |
| **Risk** | Very Low (isolated changes, comprehensive tests) |
| **Blockers** | None |
| **Dependencies** | None |
| **Testing** | 8+ new tests, 46 regression tests |
| **Review Priority** | ⭐⭐⭐⭐⭐ (must complete) |

---

## HIGH PRIORITY ISSUES

### [HIGH] Issue #2: Sort State Not Persisted to URL

**ID**: ACTION-4.2-2  
**Severity**: 🟠 HIGH  
**Category**: State Management / UX  
**Status**: Not Started  
**Effort Estimate**: 2-3 hours  

#### Problem Statement
Sorting state is stored only in component state. When users navigate or refresh, sorting is lost.

**Implementation Plan**

**Step 1: Update TransactionTable to use URL parameters** (45 min)

**File: `src/components/transaction-table.tsx`** (lines 60-70 and 179-189)

**Before**:
```tsx
const [sortField, setSortField] = useState<SortField | null>("date");
const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
```

**After**:
```tsx
import { useRouter, useSearchParams } from "next/navigation";

const router = useRouter();
const searchParams = useSearchParams();

// Get sort state from URL or use defaults
const sortField = (searchParams.get("sortBy") as SortField) || "date";
const sortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";

const handleSort = (field: SortField) => {
  const params = new URLSearchParams(searchParams.toString());
  
  if (sortField === field) {
    // Toggle order: asc -> desc -> null
    if (sortOrder === "asc") {
      params.set("order", "desc");
    } else if (sortOrder === "desc") {
      params.delete("sortBy");
      params.delete("order");
    } else {
      params.set("sortBy", field);
      params.set("order", "asc");
    }
  } else {
    // New field selected
    params.set("sortBy", field);
    params.set("order", "asc");
  }
  
  router.push(`?${params.toString()}`, { scroll: false });
};
```

**Step 2: Add tests for URL persistence** (30 min)

**File: `src/components/transaction-table.test.tsx`** (new tests)

```typescript
import { useRouter, useSearchParams } from "next/navigation";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

describe("TransactionTable URL Persistence", () => {
  let mockRouter: any;
  let mockSearchParams: any;

  beforeEach(() => {
    mockRouter = {
      push: vi.fn(),
    };
    mockSearchParams = new URLSearchParams();
    
    vi.mocked(useRouter).mockReturnValue(mockRouter);
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);
  });

  it("reads sortBy from URL params", () => {
    mockSearchParams = new URLSearchParams("sortBy=depositAmount&order=asc");
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);

    render(<TransactionTable transactions={mockTransactions} />);
    // Should initialize with depositAmount sort
    expect(mockSearchParams.get("sortBy")).toBe("depositAmount");
  });

  it("updates URL when sort is changed", () => {
    render(<TransactionTable transactions={mockTransactions} />);
    
    const sortButton = screen.getByRole("button", { name: /거래일자/ });
    fireEvent.click(sortButton);

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=date&order=asc"),
      expect.any(Object)
    );
  });

  it("persists sort state after page refresh", () => {
    // First render with sort in URL
    mockSearchParams = new URLSearchParams("sortBy=confidenceScore&order=asc");
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);

    const { rerender } = render(
      <TransactionTable transactions={mockTransactions} />
    );

    // Rerender (simulates page refresh)
    rerender(<TransactionTable transactions={mockTransactions} />);

    // Sort state should be restored from URL
    expect(mockSearchParams.get("sortBy")).toBe("confidenceScore");
    expect(mockSearchParams.get("order")).toBe("asc");
  });

  it("shares shareable sort URLs", () => {
    render(<TransactionTable transactions={mockTransactions} />);
    
    fireEvent.click(screen.getByRole("button", { name: /신뢰도 낮은 순/ }));
    
    // URL should contain sort parameters
    const callArgs = mockRouter.push.mock.calls[0][0];
    expect(callArgs).toContain("sortBy=confidenceScore");
    expect(callArgs).toContain("order=asc");
  });
});
```

**Step 3: Test with actual navigation** (20 min)

Create integration test using Next.js test utilities:

```typescript
// e2e/transaction-table-persistence.spec.ts
import { test, expect } from "@playwright/test";

test("sort state persists across navigation", async ({ page }) => {
  // 1. Visit page
  await page.goto("/transactions");
  
  // 2. Apply sort
  await page.click('button:has-text("신뢰도 낮은 순")');
  
  // 3. Verify URL contains sort params
  await expect(page).toHaveURL(/sortBy=confidenceScore&order=asc/);
  
  // 4. Share URL with another user (copy-paste)
  const url = page.url();
  
  // 5. Visit in new page (fresh session)
  const page2 = await context.newPage();
  await page2.goto(url);
  
  // 6. Verify sort is applied
  const firstRow = page2.locator("tbody tr").first();
  // Should show lowest confidence transaction first
  await expect(firstRow).toContainText("30%"); // lowest confidence
});
```

**Step 4: Update handleSort logic** (20 min)

Enhance sorting to handle URL state properly:

```typescript
const handleSort = (field: SortField) => {
  const params = new URLSearchParams(searchParams.toString());
  
  if (sortField === field) {
    // Same field clicked: toggle asc -> desc -> remove
    if (sortOrder === "asc") {
      params.set("order", "desc");
    } else if (sortOrder === "desc") {
      // Remove sort params (go back to default)
      params.delete("sortBy");
      params.delete("order");
    } else {
      // No sort -> asc
      params.set("sortBy", field);
      params.set("order", "asc");
    }
  } else {
    // Different field: start with asc
    params.set("sortBy", field);
    params.set("order", "asc");
  }
  
  // Use shallow routing to avoid page flash
  router.push(`?${params.toString()}`, { scroll: false });
};
```

**Step 5: Backward compatibility** (10 min)

Ensure sorting still works without URL params:

```typescript
const sortField = (searchParams.get("sortBy") as SortField) || "date";
const sortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";

// Fallback values ensure component works even if URL is missing params
```

#### Validation Checklist
- [ ] TransactionTable reads sort state from URL parameters
- [ ] Clicking sort headers updates URL
- [ ] Page refresh maintains sort state
- [ ] URLs are shareable (others see same sort)
- [ ] Default behavior preserved (if no URL params)
- [ ] 3+ new tests for URL persistence
- [ ] All 46 original tests still pass
- [ ] Playwright e2e test validates full flow

#### Completion Criteria
- ✅ Sort state in URL query parameters (`?sortBy=date&order=asc`)
- ✅ Shareable URLs for saved sort views
- ✅ Sort state survives page refresh
- ✅ 100% test pass rate

---

### [HIGH] Issue #3: Missing ARIA Labels & Accessibility

**ID**: ACTION-4.2-3  
**Severity**: 🟠 HIGH  
**Category**: Accessibility (WCAG 2.1 Level A)  
**Status**: Not Started  
**Effort Estimate**: 3-4 hours  

#### Problem Statement
Table lacks semantic HTML and ARIA attributes required for screen reader support.

**WCAG 2.1 Failures**:
- ❌ 1.4.11 Non-text Contrast (insufficient visual indicators)
- ❌ 2.1.1 Keyboard (clickable non-button elements)
- ❌ 2.1.2 No Keyboard Trap
- ❌ 4.1.2 Name, Role, Value (missing ARIA labels)

#### Implementation Plan

**Step 1: Convert clickable divs to buttons** (40 min)

**File: `src/components/transaction-table.tsx`** (lines 280-310)

**Before**:
```tsx
<TableHead
  className="cursor-pointer hover:bg-gray-50"
  onClick={() => handleSort("date")}
>
  <div className="flex items-center">
    거래일자
    {renderSortIcon("date")}
  </div>
</TableHead>
```

**After**:
```tsx
<TableHead scope="col">
  <button
    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    onClick={() => handleSort("date")}
    aria-sort={
      sortField === "date"
        ? sortOrder === "asc"
          ? "ascending"
          : "descending"
        : "none"
    }
    aria-label={`거래일자로 정렬 (현재: ${
      sortField === "date"
        ? sortOrder === "asc"
          ? "오름차순"
          : "내림차순"
        : "정렬 안함"
    })`}
  >
    거래일자
    <ArrowUp
      className="w-4 h-4 flex-shrink-0"
      aria-hidden="true"
      role="img"
    />
  </button>
</TableHead>
```

**Step 2: Add ARIA labels to interactive elements** (30 min)

```tsx
// Search input
<Input
  type="text"
  placeholder="메모, 카테고리 검색..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="pl-10"
  aria-label="거래 검색 (메모, 카테고리, 서브카테고리)"
/>

// Category filter
<select
  value={categoryFilter}
  onChange={(e) => setCategoryFilter(e.target.value)}
  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  aria-label="카테고리로 필터링"
>
  {/* options */}
</select>

// Confidence sort button
<Button
  variant={sortField === "confidenceScore" && sortOrder === "asc" ? "default" : "outline"}
  size="sm"
  onClick={() => handleSort("confidenceScore")}
  aria-pressed={sortField === "confidenceScore"}
  aria-label={
    sortField === "confidenceScore"
      ? "신뢰도 낮은 순 정렬 (현재 활성)"
      : "신뢰도 낮은 순 정렬 활성화"
  }
>
  신뢰도 낮은 순
  {renderSortIcon("confidenceScore")}
</Button>
```

**Step 3: Fix emoji accessibility** (20 min)

**File: `src/components/confidence-badge.tsx`**

**Before**:
```tsx
{confidenceScore < 0.7 && (
  <span className="...">
    🟡 불확실한 분류
  </span>
)}
```

**After**:
```tsx
{confidenceScore < 0.7 && (
  <span
    className="..."
    role="img"
    aria-label="경고: 불확실한 분류"
  >
    <span aria-hidden="true">🟡</span> 불확실한 분류
  </span>
)}
```

**Step 4: Add semantic table structure** (30 min)

**File: `src/components/transaction-table.tsx`**

```tsx
// Before
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>거래일자</TableHead>
      {/* ... */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {sortedTransactions.map((tx) => (
      <TableRow key={tx.id}>
        {/* ... */}
      </TableRow>
    ))}
  </TableBody>
</Table>

// After
<table
  role="grid"
  aria-label="거래 목록 - 신뢰도로 정렬 가능"
  aria-rowcount={sortedTransactions.length}
  className="w-full"
>
  <thead>
    <tr>
      <th scope="col">
        <button
          aria-sort={sortField === "date" ? sortOrder : "none"}
          aria-label="거래일자로 정렬"
        >
          거래일자
        </button>
      </th>
      {/* ... */}
    </tr>
  </thead>
  <tbody>
    {sortedTransactions.map((tx, idx) => (
      <tr
        key={tx.id}
        aria-rowindex={idx + 2}
        className="hover:bg-gray-50"
      >
        {/* ... */}
      </tr>
    ))}
  </tbody>
</table>
```

**Step 5: Test accessibility** (30 min)

**File: `src/components/transaction-table.a11y.test.tsx`** (new)

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

describe("TransactionTable Accessibility", () => {
  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <TransactionTable transactions={mockTransactions} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has sortable column headers", () => {
    render(<TransactionTable transactions={mockTransactions} />);
    
    const dateHeader = screen.getByRole("button", { name: /거래일자/ });
    expect(dateHeader).toHaveAttribute("aria-sort");
  });

  it("supports keyboard navigation for sort", async () => {
    const user = userEvent.setup();
    render(<TransactionTable transactions={mockTransactions} />);
    
    const dateHeader = screen.getByRole("button", { name: /거래일자/ });
    
    // Tab to button
    await user.tab();
    expect(dateHeader).toBeFocused();
    
    // Enter to sort
    await user.keyboard("{Enter}");
    expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("announces search results to screen readers", () => {
    render(<TransactionTable transactions={mockTransactions} />);
    
    const resultText = screen.getByText(/총.*건 표시/);
    expect(resultText).toHaveAttribute("role", "status");
    expect(resultText).toHaveAttribute("aria-live", "polite");
  });
});
```

**Step 6: Install accessibility testing tools** (10 min)

```bash
npm install --save-dev jest-axe @testing-library/user-event
```

#### WCAG Compliance Checklist
- [ ] All interactive elements are buttons or form controls
- [ ] Keyboard navigation works (Tab, Enter, Arrow keys)
- [ ] Color contrast ≥ 4.5:1 for text (WCAG AA)
- [ ] Focus indicators visible (outline or ring)
- [ ] ARIA labels present on all interactive elements
- [ ] Icons have aria-hidden="true" or aria-label
- [ ] Table has proper semantic structure (thead, tbody, th)
- [ ] Emoji uses role="img" with aria-label
- [ ] Empty state message is announced
- [ ] Sort state announced via aria-sort

#### Validation Checklist
- [ ] axe audit passes (0 violations)
- [ ] Keyboard-only navigation works (no mouse required)
- [ ] Screen reader properly announces:
  - [ ] Table structure and purpose
  - [ ] Sortable columns and current sort state
  - [ ] Search results count
  - [ ] Filter changes
  - [ ] Empty state message
- [ ] Focus indicators visible on all buttons
- [ ] Color contrast sufficient (test with WCAG validator)
- [ ] 5+ new a11y tests pass
- [ ] All 46 original tests still pass

#### Completion Criteria
- ✅ WCAG 2.1 Level A compliance
- ✅ Screen reader accessible
- ✅ Full keyboard navigation
- ✅ Visible focus indicators
- ✅ Proper semantic HTML

---

## MEDIUM PRIORITY ISSUES

### [MEDIUM] Issue #4: Type Safety - `any` in Sorting Logic

**ID**: ACTION-4.2-4  
**Severity**: 🟡 MEDIUM  
**Effort Estimate**: 1-2 hours  

**Quick Fix**:
```typescript
// Instead of:
let aValue: any;
let bValue: any;

// Use discriminated union:
type SortValue = Date | number | null;

const getSortValue = (tx: Transaction, field: SortField): SortValue => {
  switch (field) {
    case "date":
      return new Date(tx.transactionDate);
    case "depositAmount":
      return tx.depositAmount ? Number(tx.depositAmount) : null;
    case "confidenceScore":
      return tx.confidenceScore ?? null;
    default:
      return null;
  }
};
```

**Tests**: 5+ edge case tests (boundary values, null handling, type validation)

---

### [MEDIUM] Issue #5: Internationalization (i18n)

**ID**: ACTION-4.2-5  
**Severity**: 🟡 MEDIUM  
**Effort Estimate**: 4-6 hours  

**Plan**:
1. Install i18n library: `npm install next-intl`
2. Create locale files: `locales/ko.json`, `locales/en.json`
3. Update components to use `useTranslations()` hook
4. Add locale switching UI
5. Test with 2+ locales

**Deliverables**:
- Localization files for Korean, English
- Component updates (7 files)
- 5+ locale tests

---

### [MEDIUM] Issue #6: Edge Case Validation

**ID**: ACTION-4.2-6  
**Severity**: 🟡 MEDIUM  
**Effort Estimate**: 1-2 hours  

**Tests to Add**:
- NaN confidence scores
- Negative confidence scores
- Confidence scores > 1.0
- Boundary values (0.5, 0.7)
- -Infinity, Infinity
- Invalid date strings

**Implementation**: Add validation in `confidence-config.ts` + 8 new tests

---

### [MEDIUM] Issue #7: Pagination for Large Datasets

**ID**: ACTION-4.2-7  
**Severity**: 🟡 MEDIUM  
**Effort Estimate**: 3-4 hours  

**Options**:
1. Simple pagination (50 items/page)
2. Virtual scrolling (react-window)
3. Infinite scroll

**Plan**: Implement simple pagination with navigation controls

**Tests**: 5+ pagination tests (page navigation, limits, etc.)

---

## Summary Table

| Issue | Title | Severity | Effort | Phase | Status |
|-------|-------|----------|--------|-------|--------|
| #1 | Hardcoded Thresholds | 🔴 CRITICAL | 2-3h | 1 | Not Started |
| #2 | Sort State Persistence | 🟠 HIGH | 2-3h | 1 | Not Started |
| #3 | ARIA/Accessibility | 🟠 HIGH | 3-4h | 1 | Not Started |
| #4 | Type Safety | 🟡 MEDIUM | 1-2h | 2 | Not Started |
| #5 | i18n Support | 🟡 MEDIUM | 4-6h | 2 | Not Started |
| #6 | Edge Case Tests | 🟡 MEDIUM | 1-2h | 2 | Not Started |
| #7 | Pagination | 🟡 MEDIUM | 3-4h | 2 | Not Started |

**Total Effort**:
- Phase 1 (Release Blocker): 7-10 hours
- Phase 2 (Post-Release): 12-18 hours
- **Total**: 19-28 hours

---

## Execution Timeline

### Phase 1 - Release Blocker (Sprint Current)
**Target**: Complete before code freeze  
**Duration**: 2-3 days

| Day | Task | Duration |
|-----|------|----------|
| **Day 1** | Issue #1 (Hardcoded Thresholds) | 2-3h |
| **Day 2** | Issue #2 (Sort Persistence) | 2-3h |
| **Day 2** | Issue #3 (Accessibility) | 3-4h |
| **Day 3** | QA Testing + A11y Audit | 2h |
| **Day 3** | Code Review + Merge | 1h |

### Phase 2 - Post-Release (Next Sprint)
**Target**: Complete in next sprint  
**Priority**: As backlog items

---

## Testing Strategy

### Unit Tests
- Configuration (8 tests)
- Validation (6 tests)
- Type safety (8 tests)
- Sorting logic (6 tests)
- **Total**: 28 new unit tests

### Integration Tests
- URL persistence (4 tests)
- State management (3 tests)
- **Total**: 7 new integration tests

### Accessibility Tests
- axe audit (automated)
- Keyboard navigation (5 tests)
- Screen reader (5 tests)
- **Total**: 10+ a11y tests

### Regression Tests
- All 46 existing tests must pass

**Grand Total**: 46 existing + ~50 new tests = 96+ tests

---

## Success Metrics

### Code Quality
- ✅ TypeScript strict mode with 0 `any` types
- ✅ No hardcoded configuration values
- ✅ WCAG 2.1 Level A compliance (axe 0 violations)

### User Experience
- ✅ Sort state persists across navigation
- ✅ Shareable sort URLs
- ✅ Keyboard navigation fully functional

### Test Coverage
- ✅ 96+ tests with 95%+ coverage
- ✅ Edge cases documented and tested
- ✅ 0 test failures on release

### Production Readiness
- ✅ Ready for enterprise deployment
- ✅ Accessible to users with disabilities
- ✅ Configurable for different regions/products

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| URL param bugs | Comprehensive integration tests before merge |
| a11y regressions | Automated axe testing + manual screen reader testing |
| Performance impact | Virtualization for large lists; benchmark before/after |
| i18n complexity | Phased approach; start with Korean + English |
| Breaking changes | Backward-compatible defaults for all configurations |

---

## Review Checklist

Before marking as DONE:

- [ ] All code follows project style guide
- [ ] Comments and JSDoc present for complex logic
- [ ] No console.log or debug code left
- [ ] Environment variables documented
- [ ] Tests have 95%+ coverage
- [ ] Regression testing passed (all 46 original tests)
- [ ] Code review approved (2 reviewers)
- [ ] QA sign-off on all AC
- [ ] Accessibility audit passed
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated
- [ ] Release notes prepared

---

## Questions & Clarifications Needed

1. **Threshold Values**: Confirm 0.7 (HIGH) and 0.5 (MEDIUM) are correct
2. **Locale Support**: Which languages needed beyond Korean? (EN, JP, etc.)
3. **Pagination**: Preference for simple pagination vs. infinite scroll?
4. **Performance**: What's the expected max transaction count per view? (100? 1000? 10000?)
5. **Configuration**: Should thresholds be hot-reloadable (no deploy) or env-var only?

---

## Next Steps

1. **Development**: Assign Issue #1, #2, #3 to developers
2. **QA**: Prepare test plan for all 7 issues
3. **Design**: Review accessibility changes with design team
4. **Product**: Confirm threshold values with product manager
5. **Deployment**: Prepare rollback plan in case of issues

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-10  
**Status**: Ready for Development Assignment
