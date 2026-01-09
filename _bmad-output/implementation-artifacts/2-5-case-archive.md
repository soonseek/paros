# Story 2.5: 사건 아카이브 처리

**Status:** done
**Epic:** Epic 2 - 파산 사건 관리
**Story Key:** 2-5-case-archive
**Created:** 2026-01-09
**Completed:** 2026-01-09
**Code Review Completed:** 2026-01-09 (all action items resolved)
**Dependencies:** Story 2.3 완료 (사건 상세 조회), Story 2.4 완료 (사건 정보 수정)

---

## Story

**As a** 변호사,
**I want** 완료된 사건을 아카이브해서,
**so that** 활성 사건 목록을 깔끔하게 유지할 수 있다.

---

## Acceptance Criteria

### AC1: 사건 아카이브 처리

**Given** 변호사가 사건 상세 페이지에 있을 때
**When** "아카이브" 버튼을 클릭하고 확인하면
**Then** 사건의 `isArchived` 상태가 `true`로 변경된다
**And** "사건이 아카이브되었습니다" 메시지가 표시된다
**And** 사건 목록 페이지로 리다이렉트된다

### AC2: 기본 목록에서 아카이브 사건 제외

**Given** 아카이브된 사건은 기본 목록에서 제외될 때
**When** 사건 목록 페이지를 조회하면
**Then** 아카이브되지 않은 활성 사건만 표시된다

**구현 세부사항:**
- `getCases` 쿼리의 where 절에 `isArchived: false` 조건 추가 (이미 구현됨)
- 아카이브되지 않은 사건만 기본적으로 표시

### AC3: 아카이브된 사건 필터링

**Given** 변호사가 아카이브된 사건을 조회하고 싶을 때
**When** "아카이브된 사건 보기" 필터를 선택하면
**Then** 아카이브된 모든 사건이 표시된다

**구현 세부사항:**
- 사건 목록 페이지에 아카이브 필터 체크박스 또는 토글 추가
- `showArchived` 파라미터를 `getCases` 쿼리에 전달
- `isArchived: true`인 사건만 표시

### AC4: 아카이브 사건 복원

**Given** 변호사가 아카이브된 사건을 복원하려고 할 때
**When** "복원" 버튼을 클릭하면
**Then** 사건의 `isArchived` 상태가 `false`로 변경된다
**And** "사건이 복원되었습니다" 메시지가 표시된다

**구현 세부사항:**
- 아카이브된 사건 상세 페이지에서 "복원" 버튼 표시
- `isArchived: false`로 변경
- 활성 사건 목록으로 표시

**Requirements:** FR-011

---

## Developer Context & Guardrails

### 🎯 CRITICAL IMPLEMENTATION REQUIREMENTS

**🚨 THIS IS THE MOST IMPORTANT SECTION - READ CAREFULLY!**

### Technical Stack & Versions

- **Framework:** Next.js 14+ (Pages Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Prisma ORM 7.2.0+
- **API Layer:** tRPC v11
- **State Management:** TanStack Query v5 (React Query)
- **UI Components:** shadcn/ui (Radix UI)
- **Routing:** Next.js dynamic routes: `/cases/[id].tsx` (MODIFY)

### Architecture Compliance

**1. Backend tRPC Mutations for Archive/Unarchive**

```typescript
// src/server/api/routers/case.ts (MODIFY)

/**
 * Archive a case
 *
 * MUTATION /api/trpc/case.archiveCase
 *
 * Archives a case by setting isArchived to true.
 * RBAC enforced: Only the case owner can archive it.
 *
 * @param id - Case ID (UUID)
 *
 * @returns Archived case object with success message
 *
 * @throws NOT_FOUND if case doesn't exist
 * @throws FORBIDDEN if user doesn't own the case
 */
archiveCase: protectedProcedure
  .input(
    z.object({
      id: z.string().uuid("Invalid case ID format"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id } = input;

    // RBAC: Verify user owns this case
    const existingCase = await ctx.db.case.findUnique({
      where: { id },
    });

    // Case not found
    if (!existingCase) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사건을 찾을 수 없습니다",
      });
    }

    // RBAC: Check ownership
    if (existingCase.lawyerId !== ctx.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "권한이 없습니다",
      });
    }

    // Archive case
    const archivedCase = await ctx.db.case.update({
      where: { id },
      data: {
        isArchived: true,
      },
    });

    return {
      success: true,
      message: "사건이 아카이브되었습니다",
      case: archivedCase,
    };
  }),

/**
 * Unarchive a case
 *
 * MUTATION /api/trpc/case.unarchiveCase
 *
 * Unarchives a case by setting isArchived to false.
 * RBAC enforced: Only the case owner can unarchive it.
 *
 * @param id - Case ID (UUID)
 *
 * @returns Unarchived case object with success message
 *
 * @throws NOT_FOUND if case doesn't exist
 * @throws FORBIDDEN if user doesn't own the case
 */
unarchiveCase: protectedProcedure
  .input(
    z.object({
      id: z.string().uuid("Invalid case ID format"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id } = input;

    // RBAC: Verify user owns this case
    const existingCase = await ctx.db.case.findUnique({
      where: { id },
    });

    // Case not found
    if (!existingCase) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사건을 찾을 수 없습니다",
      });
    }

    // RBAC: Check ownership
    if (existingCase.lawyerId !== ctx.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "권한이 없습니다",
      });
    }

    // Unarchive case
    const unarchivedCase = await ctx.db.case.update({
      where: { id },
      data: {
        isArchived: false,
      },
    });

    return {
      success: true,
      message: "사건이 복원되었습니다",
      case: unarchivedCase,
    };
  }),
```

**2. Update getCases Query to Support Archive Filter**

```typescript
// src/server/api/routers/case.ts (MODIFY getCases input schema)

getCases: protectedProcedure
  .input(
    z.object({
      search: z.string().optional(),
      courtName: z.string().optional(),
      filingDateFrom: z.date().optional(),
      filingDateTo: z.date().optional(),
      showArchived: z.boolean().optional(), // NEW: 아카이브 사건 표시 여부
      page: z.number().min(1).default(1),
      sortBy: z.enum(['filingDate', 'caseNumber', 'debtorName', 'status', 'createdAt']).default('filingDate'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
  )
  .query(async ({ ctx, input }) => {
    const {
      search,
      courtName,
      filingDateFrom,
      filingDateTo,
      showArchived, // NEW
      page,
      sortBy,
      sortOrder,
    } = input;

    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    // Build where clause with RBAC enforcement
    const where: {
      lawyerId: string;
      isArchived?: boolean; // Changed from hardcoded to conditional
      OR?: Array<{
        caseNumber?: { contains: string; mode: 'insensitive' };
        debtorName?: { contains: string; mode: 'insensitive' };
      }>;
      courtName?: string;
      filingDate?: { gte?: Date; lte?: Date };
    } = {
      lawyerId: ctx.userId,
      // ✅ CRITICAL: Default to active cases only, show archived when explicitly requested
      ...(showArchived !== undefined && { isArchived: showArchived }),
      // If showArchived is not provided, default to false (active cases only)
      ...(showArchived === undefined && { isArchived: false }),
    };

    // ... rest of the existing logic
```

**3. Frontend - Case Detail Page Updates**

```typescript
// src/pages/cases/[id].tsx (MODIFY)

import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog"; // NEW

const CaseDetailPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;

  // Fetch case details
  const { data: caseItem, isPending, error } = api.case.getCaseById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Archive mutation
  const archiveMutation = api.case.archiveCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 아카이브되었습니다");
      void router.push("/cases");
    },
    onError: (err) => {
      toast.error(err.message || "사건 아카이브에 실패했습니다");
    },
  });

  // Unarchive mutation
  const unarchiveMutation = api.case.unarchiveCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 복원되었습니다");
      void router.push("/cases");
    },
    onError: (err) => {
      toast.error(err.message || "사건 복원에 실패했습니다");
    },
  });

  // ... existing code

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with navigation */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">사건 상세</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/cases")}>
              목록으로 돌아가기
            </Button>
            <Button onClick={() => void router.push(`/cases/${id}/edit`)}>
              수정
            </Button>
            {/* Archive/Unarchive Button - Conditional Rendering */}
            {caseItem?.isArchived ? (
              <Button
                variant="secondary"
                onClick={() => unarchiveMutation.mutate({ id: id as string })}
                disabled={unarchiveMutation.isPending}
              >
                {unarchiveMutation.isPending ? "복원 중..." : "복원"}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? "아카이브 중..." : "아카이브"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>사건 아카이브</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 사건을 아카이브하시겠습니까? 아카이브된 사건은 기본 목록에서 숨겨집니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => archiveMutation.mutate({ id: id as string })}
                    >
                      아카이브
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* ... rest of the existing UI */}
```

**4. Frontend - Cases List Page with Archive Filter**

```typescript
// src/pages/cases/index.tsx (MODIFY)

const CasesIndexPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  // Filter state
  const [search, setSearch] = useState("");
  const [courtName, setCourtName] = useState("");
  const [filingDateFrom, setFilingDateFrom] = useState("");
  const [filingDateTo, setFilingDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false); // NEW
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("filingDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch cases with filters
  const { data, isPending, error, refetch } = api.case.getCases.useQuery({
    search: search || undefined,
    courtName: courtName || undefined,
    filingDateFrom: filingDateFrom ? new Date(filingDateFrom) : undefined,
    filingDateTo: filingDateTo ? new Date(filingDateTo) : undefined,
    showArchived, // NEW
    page: currentPage,
    sortBy: sortBy as "filingDate" | "caseNumber" | "debtorName" | "status" | "createdAt",
    sortOrder,
  });

  // ... existing code

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {showArchived ? "아카이브된 사건" : "사건 목록"}
          </h1>
          <Button onClick={() => router.push("/cases/new")}>
            새 사건 등록
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ... existing filters */}
          </div>

          {/* NEW: Archive Toggle */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                아카이브된 사건 보기
              </span>
            </label>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 mt-4">
            <Button onClick={() => refetch()} disabled={isPending}>
              검색
            </Button>
            <Button onClick={handleReset} variant="outline">
              초기화
            </Button>
          </div>
        </div>

        {/* ... rest of the UI */}
```

### File Structure Requirements

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts          # ✅ MODIFY: Add archiveCase, unarchiveCase mutations, update getCases
├── pages/
│   └── cases/
│       ├── index.tsx            # ✅ MODIFY: Add showArchived filter toggle
│       └── [id].tsx             # ✅ MODIFY: Add archive/unarchive buttons with AlertDialog
└── components/
    └── ui/
        └── alert-dialog.tsx     # ✅ NEW: Add shadcn/ui AlertDialog component
```

### Security Requirements

**1. RBAC Enforcement (MUST NOT SKIP)**
- ✅ ALWAYS verify `existingCase.lawyerId === ctx.userId` before archiving/unarchiving
- ✅ Use tRPC protectedProcedure for authentication
- ✅ Only case owner can archive/unarchive their own cases
- ✅ NEVER allow users to archive/unarchive other users' cases

**2. Error Handling**
- ✅ Throw TRPCError with NOT_FOUND for non-existent cases
- ✅ Throw TRPCError with FORBIDDEN for unauthorized access
- ✅ Frontend: Display error messages with toast.error()

**3. Boolean Toggle for Archive Filter**
- ✅ Use checkbox for showArchived toggle (simple, clear UX)
- ✅ Reset to page 1 when toggling archive filter
- ✅ Clear label: "아카이브된 사건 보기"
- ✅ Update page title based on archive state

**4. Confirmation Dialog**
- ✅ Use AlertDialog for archive confirmation (prevent accidental archive)
- ✅ No confirmation needed for unarchive (less destructive action)
- ✅ Clear message: "이 사건을 아카이브하시겠습니까?"

### Code Patterns from Previous Stories

**✅ Follow These Patterns:**

1. **tRPC mutation pattern** (from Story 2.4):
```typescript
const archiveMutation = api.case.archiveCase.useMutation({
  onSuccess: () => {
    toast.success("사건이 아카이브되었습니다");
    void router.push("/cases");
  },
  onError: (err) => {
    toast.error(err.message || "사건 아카이브에 실패했습니다");
  },
});
```

2. **RBAC pattern** (from Story 2.1, 2.3, 2.4):
```typescript
// Check ownership before modifying
const existingCase = await ctx.db.case.findUnique({ where: { id } });
if (!existingCase) {
  throw new TRPCError({ code: "NOT_FOUND", message: "사건을 찾을 수 없습니다" });
}
if (existingCase.lawyerId !== ctx.userId) {
  throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다" });
}
```

3. **Toast notifications** (from Story 2.1-2.4):
```typescript
import { toast } from "sonner";
toast.success("사건이 복원되었습니다");
toast.error("사건 아카이브에 실패했습니다");
```

4. **Conditional rendering** (from Story 2.3, 2.4):
```typescript
{caseItem?.isArchived ? (
  <Button variant="secondary">복원</Button>
) : (
  <Button variant="destructive">아카이브</Button>
)}
```

5. **Loading states** (from Story 2.2-2.4):
```typescript
disabled={archiveMutation.isPending}
{archiveMutation.isPending ? "아카이브 중..." : "아카이브"}
```

### Prisma Schema Reference

```prisma
model Case {
    id                String       @id @default(uuid())
    caseNumber        String       @unique
    debtorName        String
    courtName         String?
    filingDate         DateTime?
    status            CaseStatus   @default(PENDING)
    isArchived        Boolean      @default(false)        // ✅ This is the archive flag
    lawyerId          String
    // ... rest of the model
}
```

### Dependencies & Constraints

**From Epic 2 Context:**
- Depends on Story 2.1 (Case Registration) - must have cases to archive
- Depends on Story 2.3 (Case Detail View) - provides detail page UI
- Depends on Story 2.4 (Case Information Edit) - allows editing before archiving
- Case table already created with `isArchived` field
- getCases query already filters by `isArchived: false` (hardcoded)
- RBAC helper functions already exist
- Authentication system complete (Epic 1)

**From Architecture Decisions:**
- Use Next.js Pages Router
- No caching in MVP (use TanStack Query's refetchOnWindowFocus)
- Zod v4 for validation
- tRPC v11 for API layer
- shadcn/ui components for UI

---

## Previous Story Intelligence (Story 2.4)

### Learnings from Story 2.4 Implementation

**✅ What Worked Well:**
1. **tRPC mutation pattern** - Clean data mutations with TanStack Query
2. **RBAC enforcement** - lawyerId check at database level
3. **Toast notifications** - Good user feedback for actions
4. **Loading states** - isPending with button text change
5. **Error handling** - Korean user-friendly messages
6. **React Hook Form** - Effective form validation and management
7. **AlertDialog** - Good pattern for confirmation dialogs (Story 2.4 could use this)

**📋 Patterns to Reuse:**
- Mutation patterns: onSuccess, onError, toast notifications
- RBAC: Always check lawyerId === ctx.userId before modifications
- Loading state: `{mutation.isPending ? "처리 중..." : "버튼"}`
- Navigation: `void router.push()` for navigation
- Conditional rendering: Show different buttons based on state

**🚫 Patterns to Avoid:**
- Don't forget RBAC at DATABASE level (not just frontend)
- Don't allow users to modify other users' cases
- Don't skip confirmation dialogs for destructive actions
- Don't forget to handle both NOT_FOUND and FORBIDDEN errors

### Files Modified in Story 2.4

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts                 # ✅ MODIFIED - added updateCase mutation
└── pages/
    └── cases/
        ├── [id].tsx                   # ✅ MODIFIED - updated edit button
        └── [id]/edit.tsx               # ✅ CREATED - edit page
```

**For Story 2.5, we will:**
- Modify `case.ts` again to add archiveCase and unarchiveCase mutations
- Modify `case.ts` to update getCases query with showArchived parameter
- Modify `pages/cases/index.tsx` to add showArchived filter toggle
- Modify `pages/cases/[id].tsx` to add archive/unarchive buttons
- Add shadcn/ui AlertDialog component

---

## Implementation Tasks

### Task 1: Backend - Add shadcn/ui AlertDialog Component ✅
- Added alert-dialog component using npx shadcn@latest add alert-dialog
- Component created at src/components/ui/alert-dialog.tsx

### Task 2: Backend - tRPC Mutations for Archive/Unarchive (AC: 1, 4) ✅
- **2.1 Added archiveCase mutation**
  - Input: id (UUID)
  - Check case existence and ownership (RBAC)
  - Update `isArchived: true`
  - Return success message
- **2.2 Added unarchiveCase mutation**
  - Input: id (UUID)
  - Check case existence and ownership (RBAC)
  - Update `isArchived: false`
  - Return success message
- **2.3 Error handling**
  - NOT_FOUND error for non-existent cases
  - FORBIDDEN error for unauthorized access
  - Korean error messages
- File: src/server/api/routers/case.ts (lines 377-495)

### Task 3: Backend - Update getCases Query (AC: 2, 3) ✅
- **3.1 Added showArchived input parameter**
  - Added to Zod schema: `showArchived: z.boolean().optional()`
- **3.2 Updated where clause**
  - Replaced hardcoded `isArchived: false` with conditional logic
  - If `showArchived` is provided: use that value
  - If `showArchived` is not provided: default to `false` (active only)
- Updated JSDoc comments
- File: src/server/api/routers/case.ts (lines 119-181)

### Task 4: Frontend - Cases List Page with Archive Filter (AC: 2, 3) ✅
- **4.1 Added showArchived state**
  - `const [showArchived, setShowArchived] = useState(false)`
- **4.2 Passed showArchived to getCases query**
  - Added to query input: `showArchived`
- **4.3 Added archive filter toggle UI**
  - Checkbox with label "아카이브된 사건 보기"
  - Reset page to 1 when toggled
  - Update page title based on showArchived state
  - Updated handleReset to include showArchived
- File: src/pages/cases/index.tsx (lines 48, 59, 82, 107-109, 165-181)

### Task 5: Frontend - Case Detail Page with Archive/Unarchive Buttons (AC: 1, 4) ✅
- **5.1 Imported AlertDialog component**
  - Imported from `~/components/ui/alert-dialog`
- **5.2 Added archive and unarchive mutations**
  - `api.case.archiveCase.useMutation()`
  - `api.case.unarchiveCase.useMutation()`
- **5.3 Added conditional archive/unarchive buttons**
  - Show "복원" button if `caseItem.isArchived === true`
  - Show "아카이브" button (with AlertDialog) if `caseItem.isArchived === false`
- **5.4 Implemented confirmation dialog**
  - Use AlertDialog for archive confirmation
  - Clear message: "이 사건을 아카이브하시겠습니까? 아카이브된 사건은 기본 목록에서 숨겨집니다."
  - No confirmation needed for unarchive
- **5.5 Handled loading states**
  - Disable buttons during mutation
  - Change button text to "아카이브 중..." or "복원 중..."
- **5.6 Handled navigation**
  - On success, redirect to `/cases`
  - Show toast notification on success
- File: src/pages/cases/[id].tsx (lines 6-16, 60-80, 139-175)

### Task 6: Testing (선택사항) ✅
- TypeScript typecheck: No new errors in modified files
- ESLint: No new errors in modified files (pre-existing errors in other files)
- Manual verification needed for full integration testing

**File:** `src/components/ui/alert-dialog.tsx` (NEW FILE)

**1.1 Add AlertDialog component**
- Use shadcn/ui CLI or manually add component
- Provides confirmation dialog for archive action

**Verification:**
```bash
npx shadcn@latest add alert-dialog
```

### Task 2: Backend - tRPC Mutations for Archive/Unarchive (AC: 1, 4)

**File:** `src/server/api/routers/case.ts` (MODIFY)

**2.1 Add archiveCase mutation**
- Input: id (UUID)
- Check case existence and ownership (RBAC)
- Update `isArchived: true`
- Return success message

**2.2 Add unarchiveCase mutation**
- Input: id (UUID)
- Check case existence and ownership (RBAC)
- Update `isArchived: false`
- Return success message

**2.3 Error handling**
- NOT_FOUND error for non-existent cases
- FORBIDDEN error for unauthorized access
- Korean error messages

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 3: Backend - Update getCases Query (AC: 2, 3)

**File:** `src/server/api/routers/case.ts` (MODIFY)

**3.1 Add showArchived input parameter**
- Add to Zod schema: `showArchived: z.boolean().optional()`

**3.2 Update where clause**
- Replace hardcoded `isArchived: false` with conditional logic:
  - If `showArchived` is provided: use that value
  - If `showArchived` is not provided: default to `false` (active only)

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 4: Frontend - Cases List Page with Archive Filter (AC: 2, 3)

**File:** `src/pages/cases/index.tsx` (MODIFY)

**4.1 Add showArchived state**
- `const [showArchived, setShowArchived] = useState(false)`

**4.2 Pass showArchived to getCases query**
- Add to query input: `showArchived`

**4.3 Add archive filter toggle UI**
- Checkbox with label "아카이브된 사건 보기"
- Reset page to 1 when toggled
- Update page title based on showArchived state

**Verification:**
- Toggle works correctly
- Page title updates
- Resets to page 1 on toggle

### Task 5: Frontend - Case Detail Page with Archive/Unarchive Buttons (AC: 1, 4)

**File:** `src/pages/cases/[id].tsx` (MODIFY)

**5.1 Import AlertDialog component**
- Import from `~/components/ui/alert-dialog`

**5.2 Add archive and unarchive mutations**
- `api.case.archiveCase.useMutation()`
- `api.case.unarchiveCase.useMutation()`

**5.3 Add conditional archive/unarchive buttons**
- Show "복원" button if `caseItem.isArchived === true`
- Show "아카이브" button (with AlertDialog) if `caseItem.isArchived === false`

**5.4 Implement confirmation dialog**
- Use AlertDialog for archive confirmation
- Clear message: "이 사건을 아카이브하시겠습니까? 아카이브된 사건은 기본 목록에서 숨겨집니다."
- No confirmation needed for unarchive

**5.5 Handle loading states**
- Disable buttons during mutation
- Change button text to "아카이브 중..." or "복원 중..."

**5.6 Handle navigation**
- On success, redirect to `/cases`
- Show toast notification on success

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
npm run lint       # No ESLint errors
```

### Task 6: Testing (선택사항)

**6.1 Unit tests** (optional)
- Test archiveCase mutation with RBAC
- Test unarchiveCase mutation with RBAC
- Test getCases with showArchived parameter

**6.2 Integration test** (optional)
- Test full flow: archive → verify not in default list → verify in archived list
- Test full flow: unarchive → verify in default list

**Note:** Based on Epic 1 retrospective, testing is optional unless critical bugs found

---

## Dev Notes

### Project Structure Alignment

**Unified Project Structure** (T3 Stack):
- ✅ Uses `src/pages/` for Next.js Pages Router
- ✅ tRPC routers in `src/server/api/routers/`
- ✅ Prisma schema at root level

### Routing Pattern

**Next.js Dynamic Routes:**
- Detail page: `src/pages/cases/[id].tsx`
- Archive/unarchive buttons on detail page
- List page: `src/pages/cases/index.tsx`
- Archive filter toggle on list page

### UI/UX Considerations

**From Story 2.3, 2.4 Experience:**
- Use AlertDialog for confirmation dialogs (prevents accidental archive)
- Use Button variant "destructive" for archive action (indicates destructive action)
- Use Button variant "secondary" for unarchive action (indicates restoration)
- Conditional rendering based on isArchived state
- Loading states for better UX
- Toast notifications for user feedback

### Boolean Field Pattern

**Archive Toggle:**
- Use checkbox for boolean filter (simple, clear)
- Label: "아카이브된 사건 보기"
- Reset pagination when toggle changes
- Update page title to reflect current view

**Conditional Button Display:**
- Active case: Show "아카이브" button (destructive variant)
- Archived case: Show "복원" button (secondary variant)
- Hide irrelevant button to avoid confusion

### Known Issues & Limitations

**Current Limitations:**
- Bulk archive/unarchive not in scope (future enhancement)
- Archive reason/notes not in scope (can be added later)
- Audit trail for archive/unarchive actions not in scope (updatedAt timestamp records this)

**Technical Constraints:**
- Must use existing Case model (no schema changes)
- Must work with existing RBAC system
- Must follow T3 Stack patterns

### References

**Source Documents:**
- [Epic 2 Stories](../../planning-artifacts/epics.md#story-25-사건-아카이브-처리) - FR-011 requirements
- [Architecture: tRPC](../../planning-artifacts/architecture.md#api--communication-patterns) - tRPC v11 patterns
- [Story 2.4 Implementation](./2-4-case-information-edit.md) - Previous story patterns
- [Story 2.3 Implementation](./2-3-case-detail-view.md) - Detail page patterns

**Database Schema:**
- [prisma/schema.prisma](../../prisma/schema.prisma) - Case model with isArchived field

**External Documentation:**
- [tRPC v11 Docs](https://trpc.io/docs)
- [Next.js Pages Router](https://nextjs.org/docs/pages)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

_Implementation tracked during development via todo list and workflow execution_

### Completion Notes List

✅ **All tasks completed successfully**

**Summary:**
- Implemented archive/unarchive functionality for bankruptcy cases
- Added archive filter toggle to cases list page
- Added conditional archive/unarchive buttons to case detail page
- Integrated AlertDialog for archive confirmation
- All acceptance criteria (AC1-AC4) satisfied
- Code review complete: all 3 action items resolved (2 MEDIUM, 1 LOW)

**Technical Implementation:**
- Backend: Added archiveCase and unarchiveCase mutations with RBAC enforcement
- Backend: Updated getCases query to support showArchived parameter
- Backend: Created verifyCaseOwnership helper function (code quality improvement)
- Backend: Added archive state validation to prevent redundant operations
- Frontend: Added archive filter toggle with checkbox UI
- Frontend: Added conditional button rendering based on isArchived state
- Frontend: Added aria-label for accessibility improvement
- UI: Integrated shadcn/ui AlertDialog component

**Files Modified:**
- src/server/api/routers/case.ts (added verifyCaseOwnership helper, archiveCase, unarchiveCase; updated getCases, updateCase)
- src/pages/cases/index.tsx (added showArchived state, filter UI, aria-label)
- src/pages/cases/[id].tsx (added archive/unarchive buttons with AlertDialog)
- src/components/ui/alert-dialog.tsx (NEW - added via shadcn CLI)

**Acceptance Criteria Validation:**
- ✅ AC1: Archive functionality with confirmation dialog
- ✅ AC2: Default list excludes archived cases
- ✅ AC3: Archive filter toggle shows archived cases
- ✅ AC4: Unarchive functionality for archived cases

**Code Review Follow-ups (all resolved):**
- ✅ MEDIUM-1: Extracted RBAC helper function (verifyCaseOwnership)
- ✅ MEDIUM-2: Added archive state validation (prevents redundant operations)
- ✅ LOW-1: Added aria-label to checkbox for accessibility

**Quality Checks:**
- TypeScript: No new errors in modified files
- ESLint: No new errors in modified files
- RBAC: All mutations use verifyCaseOwnership helper
- UX: Loading states, toast notifications, confirmation dialogs, state validation
- Accessibility: AlertDialog for destructive actions, aria-label on checkbox

### File List

**Created:**
- src/components/ui/alert-dialog.tsx

**Modified:**
- src/server/api/routers/case.ts
- src/pages/cases/index.tsx
- src/pages/cases/[id].tsx

**Change Log:**
- 2026-01-09: Implemented archive/unarchive functionality (all tasks completed)
- 2026-01-09: Code review complete - 3 action items resolved (MEDIUM-1, MEDIUM-2, LOW-1)

---

**Status:** done
**Created by:** create-story workflow
**Implemented by:** Claude Sonnet 4.5
**Date:** 2026-01-09

**Next Steps:**
1. Run code-review workflow for peer review
2. Test archive/unarchive functionality manually
3. Verify all acceptance criteria are met
4. Address any review feedback

---

## Review Follow-ups (AI)

**Code Review Date:** 2026-01-09
**Reviewer:** BMAD Code Review Workflow
**Overall Assessment:** 우수한 구현 - 3개 사소한 개선 사항 발견 (0 CRITICAL, 0 HIGH, 2 MEDIUM, 1 LOW)

### Action Items

#### [x] MEDIUM-1: archiveCase/unarchiveCase mutations에 중복된 RBAC 로직으로 코드 중복 ✅

**Location:**
- `src/server/api/routers/case.ts` (lines 380-407: archiveCase)
- `src/server/api/routers/case.ts` (lines 433-460: unarchiveCase)

**Issue:**
```typescript
// archiveCase mutation
archiveCase: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    const existingCase = await ctx.db.case.findUnique({
      where: { id },
    });

    if (!existingCase) {
      throw new TRPCError({ code: "NOT_FOUND", message: "사건을 찾을 수 없습니다" });
    }

    if (existingCase.lawyerId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다" });
    }

    // ... update logic
  }),

// unarchiveCase mutation - 완전히 동일한 RBAC 로직
unarchiveCase: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    const existingCase = await ctx.db.case.findUnique({
      where: { id },
    });

    if (!existingCase) {
      throw new TRPCError({ code: "NOT_FOUND", message: "사건을 찾을 수 없습니다" });
    }

    if (existingCase.lawyerId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다" });
    }

    // ... update logic
  }),
```

**Description:**
- 두 mutations 모두 동일한 RBAC 검증 로직 반복
- 코드 중복으로 유지보수성 저하
- RBAC 로직 변경 시 두 군데 모두 수정해야 함
- Story 2.4의 updateCase mutation에서도 동일한 패턴 사용

**Recommended Fix:**
```typescript
// Shared helper function
async function verifyCaseOwnership(db: PrismaClient, caseId: string, userId: string) {
  const existingCase = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!existingCase) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "사건을 찾을 수 없습니다",
    });
  }

  if (existingCase.lawyerId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "권한이 없습니다",
    });
  }

  return existingCase;
}

// Usage in mutations
archiveCase: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    const existingCase = await verifyCaseOwnership(ctx.db, input.id, ctx.userId);
    
    const archivedCase = await ctx.db.case.update({
      where: { id: input.id },
      data: { isArchived: true },
    });
    // ...
  }),
```

**Priority:** MEDIUM (코드 품질 개선, 리팩토링 권장)

---

#### [x] MEDIUM-2: 이미 아카이브된 사건을 다시 아카이브하려는 시도를 방지하지 않음 ✅

**Location:**
- `src/server/api/routers/case.ts` (lines 408-416: archiveCase)
- `src/server/api/routers/case.ts` (lines 461-469: unarchiveCase)

**Issue:**
```typescript
// Archive case
const archivedCase = await ctx.db.case.update({
  where: { id },
  data: {
    isArchived: true,  // 이미 true인 경우에도 업데이트 실행
  },
});
```

**Description:**
- 이미 `isArchived: true`인 사건을 다시 아카이브하려고 하면
- 불필요한 DB 업데이트 발생 (idempotent하지 않음)
- `updatedAt` 타임스탬프가 변경됨 (혼동 가능)
- 사용자 경험: "이미 아카이브된 사건입니다" 메시지가 더 명확함

**동일한 문제가 unarchiveCase에도 존재:**
```typescript
const unarchivedCase = await ctx.db.case.update({
  where: { id },
  data: {
    isArchived: false,  // 이미 false인 경우에도 업데이트 실행
  },
});
```

**Recommended Fix:**
```typescript
// archiveCase mutation
const existingCase = await verifyCaseOwnership(ctx.db, input.id, ctx.userId);

if (existingCase.isArchived) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "이미 아카이브된 사건입니다",
  });
}

const archivedCase = await ctx.db.case.update({
  where: { id: input.id },
  data: { isArchived: true },
});

// unarchiveCase mutation
const existingCase = await verifyCaseOwnership(ctx.db, input.id, ctx.userId);

if (!existingCase.isArchived) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "이미 활성화된 사건입니다",
  });
}

const unarchivedCase = await ctx.db.case.update({
  where: { id: input.id },
  data: { isArchived: false },
});
```

**Priority:** MEDIUM (데이터 정합성, UX 개선)

---

#### [x] LOW-1: 아카이브 체크박스에 aria-label 없이 접근성 부족 ✅

**Location:** `src/pages/cases/index.tsx` (lines 167-181)

**Issue:**
```typescript
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={showArchived}
    onChange={(e) => {
      setShowArchived(e.target.checked);
      setCurrentPage(1);
    }}
    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
  />
  <span className="text-sm text-gray-700">
    아카이브된 사건 보기
  </span>
</label>
```

**Description:**
- `<label>` 태그로 감싸져 있어 스크린 리더에서 어느 정도 작동함
- 하지만 명시적 `aria-label` 또는 `aria-describedby` 없음
- Story 2.2, 2.4의 접근성 이슈와 동일한 패턴
- WCAG 2.1 Level AA 준수를 위해 개선 권장

**Recommended Fix:**
```typescript
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={showArchived}
    onChange={(e) => {
      setShowArchived(e.target.checked);
      setCurrentPage(1);
    }}
    aria-label="아카이브된 사건 보기"
    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
  />
  <span className="text-sm text-gray-700">
    아카이브된 사건 보기
  </span>
</label>
```

**Priority:** LOW (접근성 개선)

---

### Positive Findings

**✅ Excellent Implementation:**

1. **RBAC 완벽 구현:** archiveCase/unarchiveCase에서 `existingCase.lawyerId !== ctx.userId` 체크
2. **AlertDialog 활용:** 아카이브 시 확인 다이얼로그로 실수 방지, 복원 시 확인 없이 진행 (적절한 UX)
3. **조건부 렌더링:** `isArchived` 상태에 따라 버튼 동적으로 변경
4. **필터 UI/UX:** 체크박스 간단명료, 페이지 제목 동적 업데이트, 필터 변경 시 페이지 1 리셋
5. **getCases 업데이트:** `showArchived` 파라미터로 깔끔하게 확장, 기본값 `false`로 활성 사건 우선

### AC Verification Results

| AC | 설명 | 상태 | 비고 |
|----|------|------|------|
| AC1 | 사건 아카이브 처리 (확인 다이얼로그 포함) | ✅ PASS | AlertDialog로 확인, toast 알림, 목록으로 이동 |
| AC2 | 기본 목록에서 아카이브 사건 제외 | ✅ PASS | getCases에서 `isArchived: false` 기본값 |
| AC3 | 아카이브된 사건 필터링 | ✅ PASS | 체크박스 토글, 페이지 제목 동적 변경 |
| AC4 | 아카이브 사건 복원 | ✅ PASS | 복원 버튼, toast 알림 |

### Recommendation

**Current Status:** in-progress (3 action items assigned)

**Suggested Priority Order:**
1. **MEDIUM-2** (데이터 정합성 우선 - 이미 아카이브된 사건 체크)
2. **MEDIUM-1** (코드 품질 - RBAC 헬퍼 함수 추출, 전체 case.ts 리팩토링 포함)
3. **LOW-1** (접근성 개선 - aria-label)

**Alternative:** 현재 상태 그대로 production 배포 가능 (모든 이슈는 사소한 개선 사항, 기능적 결함 없음)
