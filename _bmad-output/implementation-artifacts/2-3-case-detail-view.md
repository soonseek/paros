# Story 2.3: 사건 상세 조회

**Status:** done
**Epic:** Epic 2 - 파산 사건 관리
**Story Key:** 2-3-case-detail-view
**Created:** 2026-01-08
**Completed:** 2026-01-08
**Dependencies:** Story 2.2 완료 (사건 목록)

---

## Story

**As a** 변호사,
**I want** 특정 사건의 상세 정보를 조회해서,
**so that** 사건의 모든 정보를 확인할 수 있다.

---

## Acceptance Criteria

### AC1: 사건 상세 정보 표시

**Given** 로그인된 변호사가 사건 목록에서 특정 사건을 클릭했을 때
**When** 사건 상세 페이지로 이동하면
**Then** 사건의 모든 정보가 표시된다:
- 사건번호 (caseNumber)
- 채무자명 (debtorName)
- 법원명 (courtName)
- 접수일자 (filingDate)
- 상태 (status)
- 생성일 (createdAt)
- 수정일 (updatedAt)
- 담당 변호사 (lawyerId → lawyer.name/email)

### AC2: RBAC 권한 검증

**Given** 변호사가 자신의 사건이 아닌 다른 사건에 접근하려고 할 때
**When** URL을 통해 직접 접근을 시도하면
**Then** "권한이 없습니다" 에러 메시지가 표시되고 사건 목록으로 리다이렉트된다

**구현 세부사항:**
- `lawyerId !== ctx.userId`인 경우 403 Forbidden 반환
- toast.error()로 사용자에게 알림
- router.push("/cases")로 리다이렉트

### AC3: 존재하지 않는 사건 처리

**Given** 존재하지 않는 사건 ID로 접근하려고 할 때
**When** URL을 통해 접근을 시도하면
**Then** "사건을 찾을 수 없습니다" 에러 메시지가 표시되고 사건 목록으로 리다이렉트된다

**구현 세부사항:**
- Prisma findUnique가 null을 반환하는 경우 404 처리
- toast.error()로 사용자에게 알림
- router.push("/cases")로 리다이렉트

### AC4: 네비게이션 연동

**Given** 사건 상세 페이지에서
**When** "목록으로 돌아가기" 버튼을 클릭하면
**Then** 사건 목록 페이지로 이동한다

**Given** 사건 상세 페이지에서
**When** "수정" 버튼을 클릭하면 (Story 2.4)
**Then** 사건 수정 페이지로 이동한다 (Story 2.4에서 구현)

**Requirements:** FR-009

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
- **Routing:** Next.js dynamic routes: `/cases/[id].tsx`

### Architecture Compliance

**1. tRPC Query for Single Case**
```typescript
// src/server/api/routers/case.ts

getCaseById: protectedProcedure
  .input(z.object({ id: z.string().uuid("Invalid case ID") }))
  .query(async ({ ctx, input }) => {
    // RBAC: Verify user owns this case
    const caseItem = await ctx.db.case.findUnique({
      where: { id: input.id },
      include: {
        lawyer: {  // Include lawyer information
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    // Case not found
    if (!caseItem) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사건을 찾을 수 없습니다",
      });
    }

    // RBAC: Check ownership
    if (caseItem.lawyerId !== ctx.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "권한이 없습니다",
      });
    }

    return caseItem;
  }),
```

**2. Frontend Page with Dynamic Route**
```typescript
// src/pages/cases/[id].tsx (NEW FILE)

import { useRouter } from "next/router";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";

const CaseDetailPage = () => {
  const router = useRouter();
  const { id } = router.query; // Get case ID from URL
  const { user } = useAuth();

  // Fetch case details
  const { data: caseItem, isPending, error } = api.case.getCaseById.useQuery(
    id as string,
    {
      enabled: !!id, // Only fetch when id is available
      onError: (err) => {
        toast.error(err.message);
        router.push("/cases");
      }
    }
  );

  // Handle case not found or forbidden (from TRPCError)
  useEffect(() => {
    if (error?.data?.code === "NOT_FOUND") {
      toast.error("사건을 찾을 수 없습니다");
      router.push("/cases");
    }
    if (error?.data?.code === "FORBIDDEN") {
      toast.error("권한이 없습니다");
      router.push("/cases");
    }
  }, [error]);

  // Render case details...
};
```

**3. URL Navigation from List Page**
```typescript
// src/pages/cases/index.tsx (MODIFY - remove toast.info placeholder)

// Replace this line in handleRowClick:
const handleRowClick = (caseId: string) => {
  router.push(`/cases/${caseId}`); // Navigate to case detail
};
```

### File Structure Requirements

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts          # ✅ MODIFY: Add getCaseById query
├── pages/
│   └── cases/
│       ├── index.tsx            # ✅ MODIFY: Update row click navigation
│       └── [id].tsx             # ✅ NEW: Case detail page with dynamic route
└── components/
    └── ui/
        └── card.tsx             # ✅ OPTIONAL: Use existing Card component
```

### Security Requirements

**1. RBAC Enforcement (MUST NOT SKIP)**
- ✅ ALWAYS verify `caseItem.lawyerId === ctx.userId` before returning data
- ✅ Use tRPC protectedProcedure for authentication
- ✅ Include lawyer relation to display lawyer info
- ✅ NEVER return case data without ownership check

**2. Error Handling**
- ✅ Throw TRPCError with NOT_FOUND for non-existent cases
- ✅ Throw TRPCError with FORBIDDEN for unauthorized access
- ✅ Frontend: Display error messages with toast.error()
- ✅ Redirect to /cases on error

**3. Input Validation**
- ✅ Validate case ID is valid UUID format
- ✅ Use Zod schema: `z.string().uuid()`

### Code Patterns from Story 2.2

**✅ Follow These Patterns:**

1. **TRPCError for errors** (from Story 2.1):
```typescript
throw new TRPCError({
  code: "FORBIDDEN",
  message: "권한이 없습니다",  // ✅ Korean message
});
```

2. **Toast notifications** (from Story 2.1 & 2.2):
```typescript
import { toast } from "sonner";
toast.error("사건을 찾을 수 없습니다");
```

3. **Authentication check** (from Story 2.2):
```typescript
const { user } = useAuth();
if (!user) {
  void router.push("/auth/login");
  return null;
}
```

4. **TanStack Query v5 isPending** (from Story 2.2):
```typescript
const { data, isPending } = api.case.getCaseById.useQuery(id);
// Use isPending for loading state
```

5. **Korean date formatting** (from Story 2.2):
```typescript
{caseItem.filingDate
  ? new Date(caseItem.filingDate).toLocaleDateString("ko-KR")
  : "-"}
```

6. **Status badges** (from Story 2.2):
```typescript
const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  CLOSED: "bg-gray-100 text-gray-800",
};
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
    isArchived        Boolean      @default(false)
    lawyerId          String
    lawyer            User         @relation(fields: [lawyerId], references: [id], onDelete: Restrict)
    notes             CaseNote[]   // Story 2.6
    createdAt         DateTime     @default(now())
    updatedAt         DateTime     @updatedAt

    @@index([lawyerId])
    @@map("cases")
}
```

### Dependencies & Constraints

**From Epic 2 Context:**
- Depends on Story 2.1 (Case Registration) - must have cases in database
- Depends on Story 2.2 (Case List) - provides navigation link from list
- Case table already created with proper indexes
- RBAC helper functions already exist in `src/lib/rbac.ts`
- Authentication system complete (Epic 1)

**From Architecture Decisions:**
- Use Next.js dynamic routes for detail pages
- No caching in MVP (use TanStack Query's refetchOnWindowFocus)
- Zod v4 for validation
- tRPC v11 for API layer

---

## Previous Story Intelligence (Story 2.2)

### Learnings from Story 2.2 Implementation

**✅ What Worked Well:**
1. **tRPC query pattern** - Clean data fetching with TanStack Query
2. **RBAC enforcement** - lawyerId filter at database level
3. **Toast notifications** - Good user feedback for errors
4. **Loading states** - isPending for loading indicator
5. **Error boundaries** - Try-catch with toast.error() and redirect

**📋 Patterns to Reuse:**
- Error handling: Korean user-friendly messages
- Loading state: `isPending` (not `isLoading`)
- Date formatting: `toLocaleDateString("ko-KR")`
- Status badges with color coding
- Authentication check: Early redirect if !user

**🚫 Patterns to Avoid:**
- Don't forget RBAC at DATABASE level (not just frontend)
- Don't use `isLoading` - use `isPending` for TanStack Query v5
- Don't skip UUID validation for case IDs
- Don't forget to handle both NOT_FOUND and FORBIDDEN errors

### Files Modified in Story 2.2

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts                 # ✅ MODIFIED - added getCases query
└── pages/
    └── cases/
        └── index.tsx                   # ✅ MODIFIED - full table UI
```

**For Story 2.3, we will:**
- Modify `case.ts` again to add getCaseById query
- Create NEW `pages/cases/[id].tsx` for detail page
- Modify `pages/cases/index.tsx` to update row click navigation

---

## Implementation Tasks

### Task 1: Backend - tRPC Query for Single Case (AC: 1, 2, 3)

**File:** `src/server/api/routers/case.ts` (MODIFY)

**1.1 Add getCaseById input schema**
```typescript
z.object({
  id: z.string().uuid("Invalid case ID format"),
})
```

**1.2 Implement getCaseById query with RBAC**
- Use `protectedProcedure` for authentication
- Include lawyer relation: `include: { lawyer: { select: { id, name, email } } }`
- Check if case exists (NOT_FOUND error)
- Check RBAC: `caseItem.lawyerId !== ctx.userId` (FORBIDDEN error)
- Return case with lawyer info

**1.3 Error handling**
- Throw TRPCError with NOT_FOUND code if case doesn't exist
- Throw TRPCError with FORBIDDEN code if user doesn't own the case
- Korean error messages

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 2: Frontend - Case Detail Page (AC: 1, 4)

**File:** `src/pages/cases/[id].tsx` (NEW FILE)

**2.1 Create dynamic route page**
- Use Next.js dynamic route: `[id].tsx`
- Extract `id` from `router.query`
- Add authentication check (redirect if !user)

**2.2 Implement data fetching**
- Use `api.case.getCaseById.useQuery(id as string)`
- Add `enabled: !!id` to prevent fetch when id is undefined
- Handle loading state with isPending
- Handle errors with toast and redirect

**2.3 Display case details**
- Use Card component or custom layout
- Display all case fields:
  - 사건번호 (caseNumber) - readonly
  - 채무자명 (debtorName)
  - 법원명 (courtName)
  - 접수일자 (filingDate) - formatted with toLocaleDateString("ko-KR")
  - 상태 (status) - with badge component
  - 생성일 (createdAt) - formatted
  - 수정일 (updatedAt) - formatted
  - 담당 변호사 (lawyer.name, lawyer.email)

**2.4 Add navigation buttons**
- "목록으로 돌아가기" → router.push("/cases")
- "수정" → router.push(`/cases/${id}/edit`) (Story 2.4 placeholder with toast.info)

**2.5 Add empty/loading states**
- Loading skeleton while isPending
- Error state if case not found

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
npm run lint       # No ESLint errors
```

### Task 3: Update List Page Navigation (AC: 4)

**File:** `src/pages/cases/index.tsx` (MODIFY)

**3.1 Update handleRowClick function**
- Replace `toast.info("사건 상세 보기는 Story 2.3에서...")` with actual navigation
- Navigate to detail page: `router.push(`/cases/${caseId}`)`

**Verification:**
- Click on table row should navigate to detail page
- URL should change to `/cases/{uuid}`

### Task 4: Error Handling & User Feedback (AC: 2, 3)

**4.1 Handle NOT_FOUND error**
- In useEffect, check for `error?.data?.code === "NOT_FOUND"`
- Display toast.error("사건을 찾을 수 없습니다")
- Redirect to `/cases`

**4.2 Handle FORBIDDEN error**
- In useEffect, check for `error?.data?.code === "FORBIDDEN"`
- Display toast.error("권한이 없습니다")
- Redirect to `/cases`

**4.3 Add loading state**
- Display loading spinner or skeleton while isPending
- Show "로딩 중..." message

**File:** `src/pages/cases/[id].tsx`

### Task 5: Testing (선택사항)

**5.1 Unit tests** (optional)
- Test getCaseById query with various scenarios
- Test RBAC enforcement

**5.2 Integration test** (optional)
- Test full flow: list → detail → back to list

**Note:** Based on Epic 1 retrospective, testing is optional unless critical bugs found

---

## Dev Notes

### Project Structure Alignment

**Unified Project Structure** (T3 Stack):
- ✅ Uses `src/pages/` for Next.js Pages Router
- ✅ Dynamic routes: `[id].tsx` pattern
- ✅ tRPC routers in `src/server/api/routers/`
- ✅ Prisma schema at root level

### Routing Pattern

**Next.js Dynamic Routes:**
- File path: `src/pages/cases/[id].tsx`
- Access ID: `const { id } = router.query`
- URL example: `/cases/550e8400-e29b-41d4-a716-446655440000`

### UI/UX Considerations

**From Story 2.2 Experience:**
- Use Card component for clean layout
- Display dates in Korean format
- Use status badges with colors
- Back button for navigation
- Loading states for better UX

### Known Issues & Limitations

**Current Limitations:**
- Case note display not in scope (Story 2.6)
- Case editing not in scope (Story 2.4)
- File attachments not in scope (Epic 3)

**Technical Constraints:**
- Must use existing Case model (no schema changes)
- Must work with existing RBAC system
- Must follow T3 Stack patterns

### References

**Source Documents:**
- [Epic 2 Stories](../../planning-artifacts/epics.md#story-23-사건-상세-조회) - FR-009 requirements
- [Architecture: tRPC](../../planning-artifacts/architecture.md#api--communication-patterns) - tRPC v11 patterns
- [Architecture: Database](../../planning-artifacts/architecture.md#data-architecture) - Prisma patterns
- [Story 2.2 Implementation](./2-2-case-list-search.md) - Previous story patterns

**Database Schema:**
- [prisma/schema.prisma](../../prisma/schema.prisma) - Case model definition

**External Documentation:**
- [tRPC v11 Docs](https://trpc.io/docs)
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

**Task 1: Backend getCaseById Query**
- Added getCaseById procedure with UUID validation
- Implemented RBAC check: `caseItem.lawyerId !== ctx.userId`
- Added lawyer relation inclusion
- Error handling: NOT_FOUND and FORBIDDEN with Korean messages
- File: `src/server/api/routers/case.ts` (lines 244-284)

**Task 2: Frontend Case Detail Page**
- Created new dynamic route page: `src/pages/cases/[id].tsx` (215 lines)
- Implemented data fetching with `api.case.getCaseById.useQuery`
- Fixed tRPC query parameter format: `{ id: id as string }`
- Added comprehensive error handling in useEffect
- Authentication check and redirect
- Displayed all case fields with Korean formatting
- Added status badges (reused from Story 2.2)
- Navigation buttons: Back to list, Edit (placeholder for Story 2.4)
- Added case notes placeholder for Story 2.6

**Task 3: Update List Page Navigation**
- Modified `src/pages/cases/index.tsx` handleRowClick
- Replaced toast.info placeholder with actual navigation
- Now correctly routes to `/cases/${caseId}`

**Task 4: Error Handling & User Feedback**
- NOT_FOUND: "사건을 찾을 수 없습니다" → redirect to /cases
- FORBIDDEN: "권한이 없습니다" → redirect to /cases
- Generic errors handled with toast.error
- Loading state with "로딩 중..." message

**TypeScript Issues:**
- Fixed tRPC useQuery parameter format (must be object)
- Removed onError callback (moved to useEffect for type safety)
- No TypeScript errors in Story 2.3 files

### File List

**Modified:**
- `src/server/api/routers/case.ts` - Added getCaseById query (lines 229-284)
- `src/pages/cases/index.tsx` - Updated handleRowClick navigation (lines 94-97)

**Created:**
- `src/pages/cases/[id].tsx` - New dynamic route page (215 lines)

**Next Steps:**
1. Run code review workflow for Story 2.3
2. If review passes, proceed to Story 2.4 (사건 정보 수정)

---

## Review Follow-ups (AI)

**Code Review Date:** 2026-01-08
**Reviewer:** BMAD Code Review Workflow
**Overall Assessment:** 우수한 구현 - 3개 사소한 개선 사항 발견 (0 CRITICAL, 0 HIGH, 2 MEDIUM, 1 LOW)

### Action Items

#### [x] MEDIUM-1: useEffect 종속성 누락으로 인한 React Hook 경고 위험 ✅ FIXED 2026-01-08

**Location:** `src/pages/cases/[id].tsx` (lines 68-83)

**Issue:**
```typescript
useEffect(() => {
  if (error) {
    const errorCode = error.data?.code;
    // ... error handling logic
  }
}, [error, router]);  // 'router'는 종속성이 필요 없음 (안정적 참조)
```

**Description:**
- `router` 객체는 Next.js에서 안정적 참조(stable reference)로 보장되지만, React ESLint 규칙에 따르면 useEffect에 사용된 모든 변수를 종속성에 포함해야 경고가 발생하지 않습니다.
- 현재는 동작에 문제가 없으나, StrictMode에서 경고가 나타날 수 있습니다.

**Recommended Fix:**
```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (error) {
    const errorCode = error.data?.code;
    // ... error handling logic
  }
}, [error]);  // 'router' 제거 또는 ESLint 주석 추가
```

**Priority:** MEDIUM (기능적 결함 아님, 코드 품질 개선)

---

#### [x] MEDIUM-2: 라우터 푸시 후 렌더링 계속 진행으로 인한 리소스 낭비 ✅ FIXED 2026-01-08

**Location:** `src/pages/cases/[id].tsx` (lines 68-83, 54-56)

**Issue:**
```typescript
// 1) useEffect에서 에러 처리
if (errorCode === "NOT_FOUND") {
  toast.error("사건을 찾을 수 없습니다");
  void router.push("/cases");  // 비동기 네비게이션 시작
}

// 2) 인증 체크에서도 동일한 패턴
if (!user) {
  void router.push("/auth/login");
  return null;  // 즉시 반환 - 좋음
}

// 3) 로딩 상태와 데이터 상태도 계속 진행됨
```

**Description:**
- `void router.push()`는 비동기 작업입니다. useEffect에서 라우터 푸시 후에도 컴포넌트는 계속 렌더링됩니다.
- 사용자가 NOT_FOUND/FORBIDDEN 오류를 만나면:
  1. 에러 토스트 표시
  2. 라우터 푸시 시작 (비동기)
  3. **컴포넌트가 계속 렌더링되어 caseItem 데이터 표시 시도**
  4. 그 후에 /cases 페이지로 이동
- 이로 인해 사용자는 순간적으로 상세 페이지를 볼 수 있어 UX 저하 가능

**Recommended Fix:**
```typescript
const CaseDetailPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;
  
  const { data: caseItem, isPending, error } = api.case.getCaseById.useQuery(
    { id: id as string },
    {
      enabled: !!id,
    }
  );
  
  // Handle errors and redirect - useEffect 제거
  if (error) {
    const errorCode = error.data?.code;
    
    if (errorCode === "NOT_FOUND") {
      toast.error("사건을 찾을 수 없습니다");
      router.push("/cases");  // 네비게이션 후 렌더링 중단
      return null;
    } else if (errorCode === "FORBIDDEN") {
      toast.error("권한이 없습니다");
      router.push("/cases");
      return null;
    }
  }
  
  // 나머지 로직...
```

**Priority:** MEDIUM (UX 개선, 사용자 경험 향상)

---

#### [x] LOW-1: 로딩 상태에서 대기 텍스트만 표시되어 시각적 피드백 부족 ✅ FIXED 2026-01-08

**Location:** `src/pages/cases/[id].tsx` (lines 88-98)

**Issue:**
```typescript
if (isPending) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">로딩 중...</p>  {/* 텍스트만 표시 */}
        </div>
      </div>
    </div>
  );
}
```

**Description:**
- Story 2.2(cases/index.tsx)에서는 로딩 시 스피너를 사용하여 명확한 시각적 피드백 제공
- Story 2.3에서는 "로딩 중..." 텍스트만 표시하여 사용자 경험 저하
- 일관성을 위해 Story 2.2와 동일한 로딩 UI 사용 권장

**Recommended Fix:**
```typescript
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
```

**Priority:** LOW (UI/UX 개선, 일관성 확보)

---

### Positive Findings

**✅ Excellent Implementation:**

1. **RBAC 완벽 구현:** `caseItem.lawyerId !== ctx.userId` 체크로 FORBIDDEN 에러 처리
2. **UUID 검증 철저:** `z.string().uuid("Invalid case ID format")`로 입력 검증
3. **에러 타입 안전성:** errorCode별로 적절한 에러 메시지 표시
4. **관계 데이터 포함:** lawyer 관계를 include하여 N+1 쿼리 문제 방지
5. **네비게이션 연동:** Story 2.2에서 handleRowClick으로 완벽 연결

### AC Verification Results

| AC | 설명 | 상태 | 비고 |
|----|------|------|------|
| AC1 | 모든 필드와 변호사 정보 표시 | ✅ PASS | 모든 필드와 lawyer 관계 데이터 포함 |
| AC2 | RBAC 검증(lawyerId 체크) | ✅ PASS | 백엔드에서 lawyerId !== ctx.userId 체크 |
| AC3 | NOT_FOUND 처리 | ✅ PASS | 404 시 라우터 푸시 + 토스트 에러 |
| AC4 | 네비게이션(목록, 수정) | ✅ PASS | 목록 버튼 동작, 수정 버튼은 Story 2.4 예약 |

### Recommendation

**Original Status:** in-progress (3 action items assigned)

**Suggested Path:**
1. ✅ MEDIUM-2 수정 완료 (UX 개선 효과 가장 큼)
2. ✅ MEDIUM-1 수정 완료 (코드 품질 개선)
3. ✅ LOW-1 수정 완료 (UI 일관성 확보)
4. ✅ 모든 수정 완료 - status → done

**Final Status:** ✅ **DONE** - 2026-01-08

**Follow-up Actions Completed:**
- ✅ useEffect 제거하여 렌더링 중단 로직 개선 (MEDIUM-1, MEDIUM-2)
- ✅ 에러 발생 시 즉시 return null로 불필요한 렌더링 방지
- ✅ 로딩 상태에 스피너 추가하여 UI 일관성 확보 (LOW-1)
- ✅ TypeScript 검증 통과 (Story 2.3 파일 무오류)

**Modified Files:**
- `src/pages/cases/[id].tsx`: useEffect 제거, 에러 처리 개선, 로딩 스피너 추가
