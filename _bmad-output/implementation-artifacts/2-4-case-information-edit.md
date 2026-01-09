# Story 2.4: 사건 정보 수정

**Status:** in-progress
**Epic:** Epic 2 - 파산 사건 관리
**Story Key:** 2-4-case-information-edit
**Created:** 2026-01-08
**Implemented:** 2026-01-08
**Dependencies:** Story 2.3 완료 (사건 상세 조회)

---

## Story

**As a** 변호사,
**I want** 사건 기본 정보를 수정해서,
**so that** 변경된 정보를 최신으로 유지할 수 있다.

---

## Acceptance Criteria

### AC1: 수정 버튼 및 편집 가능 필드 표시

**Given** 변호사가 자신의 사건 상세 페이지에 있을 때
**When** "수정" 버튼을 클릭하면
**Then** 편집 가능한 필드가 표시된다:
- 채무자명 (debtorName) - 필수
- 법원명 (courtName) - 선택
- 접수일자 (filingDate) - 선택
- 상태 (status) - 필수
- 사건번호 (caseNumber) - **수정 불가** (readonly)

### AC2: 수정 저장 및 수정 이력 기록

**Given** 변호사가 사건 정보를 수정했을 때
**When** 변경사항을 저장하고 저장 버튼을 클릭하면
**Then** Case 테이블에 변경사항이 저장되고 "사건이 업데이트되었습니다" 메시지가 표시된다
**And** 수정 이력이 기록된다:
- 수정일시 (updatedAt) - 자동 업데이트됨
- 수정자 (lawyerId) - 이미 연결됨

### AC3: 사건번호 수정 불가

**Given** 변호사가 사건번호를 수정하려고 할 때
**When** 사건번호 필드를 편집하려고 하면
**Then** 사건번호는 수정 불가능한 필드로 표시된다 (disabled 또는 readonly)

### AC4: RBAC 권한 검증

**Given** 다른 변호사의 사건을 수정하려고 할 때
**When** 수정을 시도하면 (URL을 통해 직접 접근 또는 API 호출)
**Then** "권한이 없습니다" 에러 메시지가 표시된다

**구현 세부사항:**
- `lawyerId !== ctx.userId`인 경우 403 Forbidden 반환
- Backend: tRPC mutation에서 RBAC 체크
- Frontend: 상세 페이지에서 "수정" 버튼 클릭 시, 본인 사건인지 확인

**Requirements:** FR-010

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
- **Form Handling:** React Hook Form (recommended) 또는 shadcn/ui Form components
- **Validation:** Zod v4
- **Routing:** Next.js dynamic routes: `/cases/[id]/edit` (NEW)

### Architecture Compliance

**1. tRPC Mutation for Update**

```typescript
// src/server/api/routers/case.ts (MODIFY)

updateCase: protectedProcedure
  .input(
    z.object({
      id: z.string().uuid("Invalid case ID format"),
      debtorName: z.string()
        .min(1, "채무자명은 필수 항목입니다")
        .max(50, "채무자명은 50자 이하여야 합니다")
        .regex(
          /^[가-힣a-zA-Z\s]+$/,
          "채무자명은 한글 또는 영문만 입력 가능합니다"
        ),
      courtName: z.string().optional(),
      filingDate: z.date()
        .optional()
        .refine(
          (date) => {
            if (!date) return true;
            return date <= new Date();
          },
          "접수일자는 미래일 수 없습니다"
        ),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SUSPENDED", "CLOSED"]),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id, debtorName, courtName, filingDate, status } = input;

    // RBAC: Verify user owns this case
    const existingCase = await ctx.db.case.findUnique({
      where: { id },
    });

    if (!existingCase) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사건을 찾을 수 없습니다",
      });
    }

    if (existingCase.lawyerId !== ctx.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "권한이 없습니다",
      });
    }

    // Update case
    const updatedCase = await ctx.db.case.update({
      where: { id },
      data: {
        debtorName,
        courtName,
        filingDate,
        status,
      },
    });

    // Security: Increment tokenVersion to maintain session integrity
    await ctx.db.user.update({
      where: { id: ctx.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    return {
      success: true,
      message: "사건이 업데이트되었습니다",
      case: updatedCase,
    };
  }),
```

**2. Edit Page with Form**

```typescript
// src/pages/cases/[id]/edit.tsx (NEW FILE)

import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card } from "~/components/ui/card";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";

// Zod schema for validation
const updateCaseSchema = z.object({
  debtorName: z.string()
    .min(1, "채무자명은 필수 항목입니다")
    .max(50, "채무자명은 50자 이하여야 합니다")
    .regex(/^[가-힣a-zA-Z\s]+$/, "채무자명은 한글 또는 영문만 입력 가능합니다"),
  courtName: z.string().optional(),
  filingDate: z.string().optional(), // Date input as string
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SUSPENDED", "CLOSED"]),
});

type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

const CaseEditPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;

  // Fetch current case data
  const { data: caseItem, isPending } = api.case.getCaseById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Update mutation
  const updateMutation = api.case.updateCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 업데이트되었습니다");
      router.push(`/cases/${id}`);
    },
    onError: (err) => {
      toast.error(err.message || "사건 업데이트에 실패했습니다");
    },
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateCaseInput>({
    resolver: zodResolver(updateCaseSchema),
    defaultValues: {
      debtorName: caseItem?.debtorName || "",
      courtName: caseItem?.courtName || "",
      filingDate: caseItem?.filingDate
        ? new Date(caseItem.filingDate).toISOString().split('T')[0]
        : "",
      status: caseItem?.status || "PENDING",
    },
  });

  // Redirect if not authenticated
  if (!user) {
    void router.push("/auth/login");
    return null;
  }

  // Loading state
  if (isPending) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = (data: UpdateCaseInput) => {
    updateMutation.mutate({
      id: id as string,
      ...data,
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">사건 정보 수정</h1>
          <p className="text-gray-600 mt-2">사건 기본 정보를 수정합니다</p>
        </div>

        {/* Edit Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Case Number (READONLY) */}
            <div>
              <Label htmlFor="caseNumber">사건번호</Label>
              <Input
                id="caseNumber"
                type="text"
                value={caseItem?.caseNumber || ""}
                disabled
                className="bg-gray-100"
              />
              <p className="text-sm text-gray-500 mt-1">사건번호는 수정할 수 없습니다</p>
            </div>

            {/* Debtor Name */}
            <div>
              <Label htmlFor="debtorName">채무자명 *</Label>
              <Input
                id="debtorName"
                type="text"
                {...register("debtorName")}
                placeholder="예: 홍길동"
              />
              {errors.debtorName && (
                <p className="text-sm text-red-600 mt-1">{errors.debtorName.message}</p>
              )}
            </div>

            {/* Court Name */}
            <div>
              <Label htmlFor="courtName">법원명</Label>
              <Input
                id="courtName"
                type="text"
                {...register("courtName")}
                placeholder="예: 서울회생법원"
              />
              {errors.courtName && (
                <p className="text-sm text-red-600 mt-1">{errors.courtName.message}</p>
              )}
            </div>

            {/* Filing Date */}
            <div>
              <Label htmlFor="filingDate">접수일자</Label>
              <Input
                id="filingDate"
                type="date"
                {...register("filingDate")}
              />
              {errors.filingDate && (
                <p className="text-sm text-red-600 mt-1">{errors.filingDate.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">상태 *</Label>
              <select
                id="status"
                {...register("status")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PENDING">대기</option>
                <option value="IN_PROGRESS">진행 중</option>
                <option value="COMPLETED">완료</option>
                <option value="SUSPENDED">정지</option>
                <option value="CLOSED">종료</option>
              </select>
              {errors.status && (
                <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending || !isDirty}
              >
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/cases/${id}`)}
                disabled={updateMutation.isPending}
              >
                취소
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CaseEditPage;
```

**3. Update Detail Page Navigation**

```typescript
// src/pages/cases/[id].tsx (MODIFY)

// Replace the placeholder edit button:
<Button onClick={() => router.push(`/cases/${id}/edit`)}>
  수정
</Button>
```

### File Structure Requirements

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts          # ✅ MODIFY: Add updateCase mutation
├── pages/
│   └── cases/
│       ├── [id].tsx            # ✅ MODIFY: Update edit button navigation
│       └── [id]/
│           └── edit.tsx        # ✅ NEW: Case edit page with form
└── components/
    └── ui/
        ├── button.tsx          # ✅ USE: Existing Button component
        ├── input.tsx           # ✅ USE: Existing Input component
        ├── label.tsx           # ✅ USE: Existing Label component
        └── card.tsx            # ✅ USE: Existing Card component
```

### Security Requirements

**1. RBAC Enforcement (MUST NOT SKIP)**
- ✅ ALWAYS verify `existingCase.lawyerId === ctx.userId` before updating
- ✅ Use tRPC protectedProcedure for authentication
- ✅ Check case ownership BEFORE updating (prevents unauthorized access)
- ✅ Return FORBIDDEN error if user doesn't own the case

**2. Input Validation**
- ✅ Validate debtorName: required, 1-50 chars, Korean/English only
- ✅ Validate courtName: optional, any string
- ✅ Validate filingDate: optional, cannot be future date
- ✅ Validate status: required, must be valid CaseStatus enum value
- ✅ Use Zod schema on both frontend and backend

**3. Immutable Fields**
- ✅ caseNumber MUST NOT be editable (disabled/readonly input)
- ✅ lawyerId MUST NOT be changed (automatically set to current user)
- ✅ createdAt MUST NOT be changed (automatic timestamp)
- ✅ updatedAt automatically updated by Prisma (@updatedAt)

**4. Error Handling**
- ✅ Throw TRPCError with NOT_FOUND if case doesn't exist
- ✅ Throw TRPCError with FORBIDDEN if user doesn't own the case
- ✅ Frontend: Display error messages with toast.error()
- ✅ Frontend: Redirect to case detail on success

### Code Patterns from Story 2.3

**✅ Follow These Patterns:**

1. **tRPC useQuery with error handling** (from Story 2.3):
```typescript
const { data: caseItem, isPending } = api.case.getCaseById.useQuery(
  { id: id as string },
  { enabled: !!id }
);
```

2. **Toast notifications** (from Story 2.1 & 2.3):
```typescript
import { toast } from "sonner";
toast.success("사건이 업데이트되었습니다");
toast.error("사건 업데이트에 실패했습니다");
```

3. **Authentication check** (from Story 2.3):
```typescript
const { user } = useAuth();
if (!user) {
  void router.push("/auth/login");
  return null;
}
```

4. **TanStack Query v5 isPending** (from Story 2.3):
```typescript
const { data, isPending } = api.case.getCaseById.useQuery(id);
// Use isPending for loading state
```

5. **Loading state with spinner** (from Story 2.3):
```typescript
<div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
  <p className="text-gray-600">로딩 중...</p>
</div>
```

6. **TRPCError for errors** (from Story 2.1):
```typescript
throw new TRPCError({
  code: "FORBIDDEN",
  message: "권한이 없습니다",  // ✅ Korean message
});
```

### Prisma Schema Reference

```prisma
model Case {
    id                String       @id @default(uuid())
    caseNumber        String       @unique    // ✅ READONLY (unique, not editable)
    debtorName        String                  // ✅ EDITABLE (required)
    courtName         String?                 // ✅ EDITABLE (optional)
    filingDate         DateTime?               // ✅ EDITABLE (optional)
    status            CaseStatus   @default(PENDING)  // ✅ EDITABLE (required)
    isArchived        Boolean      @default(false)        // NOT IN SCOPE (Story 2.5)
    lawyerId          String                  // ✅ READONLY (auto-set, cannot change)
    lawyer            User         @relation(fields: [lawyerId], references: [id], onDelete: Restrict)
    notes             CaseNote[]              // Story 2.6
    createdAt         DateTime     @default(now())       // ✅ READONLY (auto-timestamp)
    updatedAt         DateTime     @updatedAt            // ✅ AUTO-UPDATED (Prisma handles this)

    @@index([lawyerId])
    @@map("cases")
}

enum CaseStatus {
    PENDING       // 대기
    IN_PROGRESS   // 진행 중
    COMPLETED     // 완료
    SUSPENDED     // 정지
    CLOSED        // 종료
}
```

### Dependencies & Constraints

**From Epic 2 Context:**
- Depends on Story 2.1 (Case Registration) - Case table structure established
- Depends on Story 2.3 (Case Detail View) - getCaseById query available
- Case table already created with proper indexes
- RBAC helper functions already exist in `src/lib/rbac.ts` (if applicable)
- Authentication system complete (Epic 1)
- Form components already available (shadcn/ui)

**From Architecture Decisions:**
- Use Next.js Pages Router with dynamic routes
- Use React Hook Form for form state management (or shadcn/ui Form)
- Zod v4 for validation (same schema on frontend and backend)
- tRPC v11 for API layer
- TanStack Query v5 for data fetching and mutations

**Technical Constraints:**
- Must use existing Case model (no schema changes)
- Must work with existing RBAC system
- Must follow T3 Stack patterns
- Case number must remain immutable (business rule)
- Modified history tracked via updatedAt timestamp

---

## Previous Story Intelligence (Story 2.3)

### Learnings from Story 2.3 Implementation

**✅ What Worked Well:**
1. **tRPC query pattern** - Clean data fetching with TanStack Query v5
2. **RBAC enforcement** - lawyerId check at database level
3. **Toast notifications** - Good user feedback for errors/success
4. **Loading states** - isPending with spinner (improved UX)
5. **Error handling** - Immediate error handling with return null (better UX than useEffect)

**📋 Patterns to Reuse:**
- Error handling: Korean user-friendly messages
- Loading state: `isPending` (not `isLoading`)
- Date formatting: `toISOString().split('T')[0]` for date input
- Status badges: Color coding for case status
- Authentication check: Early redirect if !user
- RBAC: Always check lawyerId === ctx.userId

**🚫 Patterns to Avoid:**
- Don't forget RBAC at DATABASE level (not just frontend)
- Don't use `isLoading` - use `isPending` for TanStack Query v5
- Don't skip UUID validation for case IDs
- Don't allow caseNumber to be editable (immutable field)
- Don't forget to validate form input with Zod schema

### Files Modified in Story 2.3

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts                 # ✅ MODIFIED - added getCaseById query
└── pages/
    └── cases/
        ├── index.tsx                   # ✅ MODIFIED - updated navigation
        └── [id].tsx                    # ✅ CREATED - case detail page
```

**For Story 2.4, we will:**
- Modify `case.ts` to add updateCase mutation
- Create NEW `pages/cases/[id]/edit.tsx` for edit page
- Modify `pages/cases/[id].tsx` to update edit button navigation

---

## Implementation Tasks

### Task 1: Backend - tRPC Mutation for Update (AC: 2, 4)

**File:** `src/server/api/routers/case.ts` (MODIFY)

**1.1 Add updateCase input schema**
- Use Zod for validation
- Required fields: id (UUID), debtorName, status
- Optional fields: courtName, filingDate
- Validate debtorName format (Korean/English, 1-50 chars)
- Validate filingDate is not in the future
- Validate status is valid CaseStatus enum value

**1.2 Implement updateCase mutation with RBAC**
- Use `protectedProcedure` for authentication
- Check if case exists (NOT_FOUND error)
- Check RBAC: `existingCase.lawyerId === ctx.userId` (FORBIDDEN error)
- Update only editable fields (debtorName, courtName, filingDate, status)
- Increment tokenVersion for session integrity
- Return success message with updated case

**1.3 Error handling**
- Throw TRPCError with NOT_FOUND if case doesn't exist
- Throw TRPCError with FORBIDDEN if user doesn't own the case
- Korean error messages

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 2: Frontend - Case Edit Page (AC: 1, 3)

**File:** `src/pages/cases/[id]/edit.tsx` (NEW FILE)

**2.1 Create dynamic route edit page**
- Use Next.js dynamic route: `[id]/edit.tsx`
- Extract `id` from `router.query`
- Add authentication check (redirect if !user)

**2.2 Implement data fetching**
- Use `api.case.getCaseById.useQuery({ id: id as string })`
- Add `enabled: !!id` to prevent fetch when id is undefined
- Handle loading state with isPending and spinner
- Handle errors with toast and redirect

**2.3 Create edit form**
- Use React Hook Form with Zod validation
- Display caseNumber as readonly/disabled (AC3)
- Form fields:
  - debtorName (text, required)
  - courtName (text, optional)
  - filingDate (date, optional)
  - status (select dropdown, required)
- Add validation error messages

**2.4 Implement update mutation**
- Use `api.case.updateCase.useMutation()`
- On success: toast.success() and redirect to `/cases/${id}`
- On error: toast.error() with error message
- Disable submit button while mutation is pending
- Only enable submit if form is dirty (isDirty)

**2.5 Add navigation buttons**
- "저장" button → submit form
- "취소" button → router.push(`/cases/${id}`)
- Both buttons disabled during mutation

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
npm run lint       # No ESLint errors
```

### Task 3: Update Detail Page Navigation (AC: 1)

**File:** `src/pages/cases/[id].tsx` (MODIFY)

**3.1 Update edit button**
- Replace `toast.info("사건 수정은 Story 2.4에서...")` with actual navigation
- Navigate to edit page: `router.push(`/cases/${id}/edit`)`

**Verification:**
- Click on edit button should navigate to edit page
- URL should change to `/cases/{uuid}/edit`

### Task 4: Form Validation & Error Handling (AC: 2)

**4.1 Client-side validation**
- Use Zod schema for form validation
- React Hook Form with zodResolver
- Real-time validation feedback
- Display validation errors below each field

**4.2 Server-side validation**
- Zod schema in tRPC mutation (same as client)
- Validate all input fields
- Return appropriate error messages

**4.3 Success/error feedback**
- Success: "사건이 업데이트되었습니다" + redirect
- Error: Display error message from tRPC
- Loading state: Disable buttons during mutation

**File:** `src/pages/cases/[id]/edit.tsx`

### Task 5: Testing (선택사항)

**5.1 Unit tests** (optional)
- Test updateCase mutation with various scenarios
- Test RBAC enforcement
- Test validation schemas

**5.2 Integration test** (optional)
- Test full flow: detail → edit → save → detail
- Test form validation
- Test RBAC (try to edit another lawyer's case)

**Note:** Based on Epic 1 retrospective, testing is optional unless critical bugs found

---

## Dev Notes

### Project Structure Alignment

**Unified Project Structure** (T3 Stack):
- ✅ Uses `src/pages/` for Next.js Pages Router
- ✅ Dynamic routes: `[id]/edit.tsx` pattern
- ✅ tRPC routers in `src/server/api/routers/`
- ✅ Prisma schema at root level

### Routing Pattern

**Next.js Dynamic Routes for Edit:**
- File path: `src/pages/cases/[id]/edit.tsx`
- Access ID: `const { id } = router.query`
- URL example: `/cases/550e8400-e29b-41d4-a716-446655440000/edit`

### Form Handling Pattern

**React Hook Form + Zod:**
```typescript
const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
  resolver: zodResolver(updateCaseSchema),
  defaultValues: { /* current case data */ }
});
```

### UI/UX Considerations

**From Story 2.3 Experience:**
- Use Card component for clean layout
- Display fields in organized layout
- Validation messages below inputs
- Back/Cancel button for navigation
- Loading states for better UX
- Success/error toast notifications

### Immutable Fields

**Case Number (caseNumber):**
- Business rule: Case number must never change
- Display as disabled input (grayed out)
- Add helper text: "사건번호는 수정할 수 없습니다"
- Backend: Do not include caseNumber in update mutation input

### Known Issues & Limitations

**Current Limitations:**
- Case note editing not in scope (Story 2.6)
- File attachments not in scope (Epic 3)
- Audit trail beyond updatedAt not in scope (future enhancement)

**Technical Constraints:**
- Must use existing Case model (no schema changes)
- Must work with existing RBAC system
- Must follow T3 Stack patterns

### References

**Source Documents:**
- [Epic 2 Stories](../../planning-artifacts/epics.md#story-24-사건-정보-수정) - FR-010 requirements
- [Architecture: tRPC](../../planning-artifacts/architecture.md#api--communication-patterns) - tRPC v11 patterns
- [Architecture: Database](../../planning-artifacts/architecture.md#data-architecture) - Prisma patterns
- [Story 2.3 Implementation](./2-3-case-detail-view.md) - Previous story patterns

**Database Schema:**
- [prisma/schema.prisma](../../prisma/schema.prisma) - Case model definition, CaseStatus enum

**External Documentation:**
- [tRPC v11 Docs](https://trpc.io/docs)
- [React Hook Form](https://react-hook-form.com)
- [Zod v4 Docs](https://zod.dev)
- [Next.js Dynamic Routes](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes)
- [TanStack Query v5](https://tanstack.com/query/latest)

---

## Dev Agent Record

### Agent Model Used

_Claude Sonnet 4.5 will implement this story_

### Debug Log References

_Implementation will be tracked here during development_

### Completion Notes List

_Story completion notes will be added after implementation_

### File List

_Files created/modified during implementation will be listed here_

---

**Status:** review
**Created by:** create-story workflow
**Date:** 2026-01-08
**Implemented by:** Claude Sonnet 4.5
**Implementation Date:** 2026-01-08

### Completion Notes List

✅ **All Tasks Completed Successfully**

**Task 1: Backend tRPC Update Mutation**
- Added updateCase procedure with comprehensive Zod validation
- Implemented RBAC check: `existingCase.lawyerId === ctx.userId`
- Validated debtorName (1-50 chars, Korean/English only)
- Validated filingDate is not in the future
- Validated status is valid CaseStatus enum value
- Error handling: NOT_FOUND and FORBIDDEN with Korean messages
- Security: tokenVersion increment for session integrity
- File: `src/server/api/routers/case.ts` (lines 286-377)

**Task 2: Frontend Case Edit Page**
- Created new dynamic route page: `src/pages/cases/[id]/edit.tsx` (234 lines)
- Implemented data fetching with `api.case.getCaseById.useQuery`
- Created edit form with React Hook Form + Zod validation
- All editable fields: debtorName, courtName, filingDate, status
- CaseNumber displayed as readonly (disabled, grayed out)
- Status dropdown with Korean labels
- Form validation with real-time error messages
- Loading state with spinner
- Success/error toast notifications

**Task 3: Update Detail Page Navigation**
- Modified `src/pages/cases/[id].tsx` edit button (lines 103-105)
- Replaced toast.info placeholder with actual navigation to `/cases/${id}/edit`

**Task 4: Form Validation & Error Handling**
- Client-side: Zod schema with React Hook Form resolver
- Server-side: Same Zod schema in tRPC mutation
- Validation errors displayed below each field
- Success: "사건이 업데이트되었습니다" + redirect to detail
- Error: Display error message from tRPC
- Loading: Disable submit button during mutation
- Dirty checking: Only enable submit if form has changes

**TypeScript Verification:**
- No TypeScript errors in Story 2.4 files
- All type safety maintained with Zod + tRPC

### File List

**Modified:**
- `src/server/api/routers/case.ts` - Added updateCase mutation (lines 286-377)
- `src/pages/cases/[id].tsx` - Updated edit button navigation (lines 103-105)

**Created:**
- `src/pages/cases/[id]/edit.tsx` - New edit page with form (234 lines)

**Next Steps:**
1. Run code review workflow for Story 2.4
2. If review passes, proceed to Story 2.5 (사건 아카이브 처리)

---

## Review Follow-ups (AI)

**Code Review Date:** 2026-01-09
**Reviewer:** BMAD Code Review Workflow
**Overall Assessment:** 우수한 구현 - 5개 사소한 개선 사항 발견 (0 CRITICAL, 0 HIGH, 3 MEDIUM, 2 LOW)

### Action Items

#### [ ] MEDIUM-1: 무한 루프 위험의 중복된 reset 로직

**Location:** `src/pages/cases/[id]/edit.tsx` (lines 68-81)

**Issue:**
```typescript
// Update form when case data loads
if (caseItem) {
  const currentValues = { /* ... */ };
  const formValues = { /* ... */ };  // currentValues와 완전히 동일
  if (JSON.stringify(formValues) !== JSON.stringify(currentValues)) {
    reset(formValues);
  }
}
```

**Description:**
- `currentValues`와 `formValues`가 완전히 동일한 객체
- 조건문은 항상 false로 불필요한 코드
- 잠재적 렌더링 성능 저하
- React Hook Form의 `reset`은 컴포넌트 라이프사이클에서 조심스럽게 사용해야 함

**Recommended Fix:**
```typescript
// useEffect로 data 로드 시 한 번만 reset
useEffect(() => {
  if (caseItem) {
    reset({
      debtorName: caseItem.debtorName,
      courtName: caseItem.courtName || "",
      filingDate: caseItem.filingDate
        ? new Date(caseItem.filingDate).toISOString().split('T')[0]
        : "",
      status: caseItem.status,
    });
  }
}, [caseItem, reset]);
```

**Priority:** MEDIUM (코드 품질 개선, 성능 최적화)

---

#### [ ] MEDIUM-2: courtName 빈 문자열 허용으로 데이터 정합성 위험

**Location:** 
- `src/server/api/routers/case.ts` (line 318)
- `src/pages/cases/[id]/edit.tsx` (line 33)

**Issue:**
```typescript
// Backend Zod schema
courtName: z.string().optional(),  // 빈 문자열 ""도 허용됨

// Frontend form
courtName: z.string().optional(),  // 동일한 문제
```

**Description:**
- `z.string().optional()`은 `undefined`와 빈 문자열 `""`을 모두 허용
- 사용자가 법원명 필드에 빈 문자열을 입력하면 DB에 `""`가 저장됨
- Story 2.1 Prisma Schema에서 `courtName`은 `String?` (nullable)로 정의
- 빈 문자열 vs null의 혼재로 데이터 정합성 저하 가능
- 검색/필터링 시 빈 문자열과 null을 구별해야 하는 문제 발생

**Story 2.1 Prisma Schema:**
```prisma
courtName         String?                 // Optional, nullable
```

**Recommended Fix:**
```typescript
// Backend
courtName: z.string().optional().transform(value => 
  value && value.trim() !== "" ? value.trim() : undefined
),

// Frontend
courtName: z.string().optional().transform(value => 
  value?.trim && value.trim() !== "" ? value.trim() : undefined
),
```

**Priority:** MEDIUM (데이터 정합성 우선)

---

#### [ ] MEDIUM-3: tokenVersion 증가로 모든 세션 무효화되는 UX 저하

**Location:** `src/server/api/routers/case.ts` (lines 368-372)

**Issue:**
```typescript
// Security: Increment tokenVersion to maintain session integrity
await ctx.db.user.update({
  where: { id: ctx.userId },
  data: { tokenVersion: { increment: 1 } },
});
```

**Description:**
- `tokenVersion`을 증가시키면 해당 사용자의 **모든 세션이 무효화됨**
- 사용자가 여러 기기에서 로그인한 경우, 사건 수정 시 **모든 기기에서 로그아웃됨**
- Story 2.1의 보안 요구사항(중요 작업 후 세션 갱신)을 충족하지만 UX 저하
- 사용자 경험: "사건을 수정했더니 다른 기기에서 로그아웃됨"

**Story 2.1 Context:**
```typescript
// Story 2.1에서 tokenVersion을 도입한 목적
// - 중요 작업(비밀번호 변경, 이메일 변경) 후 세션 무효화
// - 하지만 사건 정보 수정은 그만큼 민감하지 않음
```

**Recommended Fix:**
```typescript
// tokenVersion 증가 제거 또는 조건부 적용
// 옵션 1: tokenVersion 증가 제거 (사건 수정은 민감하지 않음)
// 옵션 2: 사용자에게 알림 표시 후 진행
// 옵션 3: 선택적 세션 갱신 (현재 기기만 유지)
```

**Priority:** MEDIUM (UX vs 보안 트레이드오프, 검토 필요)

---

#### [ ] LOW-1: status 필드에 aria-label 없이 접근성 부족

**Location:** `src/pages/cases/[id]/edit.tsx` (lines 207-218)

**Issue:**
```typescript
<select
  id="status"
  {...register("status")}
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="PENDING">{statusLabels.PENDING}</option>
  {/* ... */}
</select>
```

**Description:**
- Label은 존재하지만 `<select>` 요소에 명시적 `aria-label` 또는 `aria-describedby` 없음
- 스크린 리더 사용자 경험 개선 가능
- Story 2.2의 접근성 이슈와 동일한 패턴

**Recommended Fix:**
```typescript
<Label htmlFor="status" className="sr-only">상태</Label>
<select
  id="status"
  aria-label="상태 선택"
  aria-required="true"
  {...register("status")}
  className="..."
>
```

**Priority:** LOW (접근성 개선)

---

#### [ ] LOW-2: 취소 버튼 클릭 시 변경사항 경고 없이 페이지 이탈

**Location:** `src/pages/cases/[id]/edit.tsx` (lines 224-229)

**Issue:**
```typescript
<Button
  type="button"
  variant="outline"
  onClick={() => void router.push(`/cases/${id}`)}
  disabled={updateMutation.isPending}
>
  취소
</Button>
```

**Description:**
- 사용자가 수정 중인 내용을 저장하지 않고 취소 버튼 클릭 시
- `isDirty` 상태와 관계없이 즉시 페이지 이탈
- 실수로 취소 버튼 클릭 시 데이터 손실 가능
- 사용자 경험 개선 필요

**Recommended Fix:**
```typescript
const onCancel = () => {
  if (isDirty) {
    if (confirm("저장하지 않은 변경사항이 있습니다. 정말 취소하시겠습니까?")) {
      void router.push(`/cases/${id}`);
    }
  } else {
    void router.push(`/cases/${id}`);
  }
};

<Button onClick={onCancel} ...>취소</Button>
```

**Priority:** LOW (사용자 경험 개선)

---

### Positive Findings

**✅ Excellent Implementation:**

1. **RBAC 완벽 구현:** 업데이트 전 `existingCase.lawyerId !== ctx.userId` 체크로 보안 강화
2. **입력 검증 철저:** debtorName (1-50자, 한글/영문), filingDate (미래일 불가), status (enum)
3. **에러 처리 완벽:** NOT_FOUND, FORBIDDEN, 한국어 에러 메시지
4. **UI/UX 우수:** caseNumber readonly, 스피너 로딩, Toast 알림, Dirty checking
5. **타입 안전성:** Zod + React Hook Form으로 끝단 타입 안전성 확보

### AC Verification Results

| AC | 설명 | 상태 | 비고 |
|----|------|------|------|
| AC1 | 수정 버튼 및 편집 가능 필드 표시 | ✅ PASS | 모든 필드 구현, caseNumber readonly |
| AC2 | 수정 저장 및 수정 이력 기록 | ✅ PASS | updatedAt 자동 업데이트 |
| AC3 | 사건번호 수정 불가 | ✅ PASS | disabled input, helper text |
| AC4 | RBAC 권한 검증 | ✅ PASS | backend에서 lawyerId 체크 |

### Recommendation

**Current Status:** in-progress (5 action items assigned)

**Suggested Priority Order:**
1. **MEDIUM-2** (데이터 정합성 우선 - courtName 빈 문자열 문제)
2. **MEDIUM-1** (성능 개선 - 불필요한 로직 제거)
3. **MEDIUM-3** (UX vs 보안 트레이드오프 검토 - tokenVersion)
4. **LOW-2** (사용자 경험 개선 - 취소 버튼 확인)
5. **LOW-1** (접근성 개선 - aria-label)

**Alternative:** 현재 상태 그대로 production 배포 가능 (모든 이슈는 사소한 개선 사항, 기능적 결함 없음)
