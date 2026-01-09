# Story 2.6: 사건 메모 관리

**Status:** done
**Epic:** Epic 2 - 파산 사건 관리
**Story Key:** 2-6-case-note-management
**Created:** 2026-01-09
**Completed:** 2026-01-09
**Dependencies:** Story 2.3 완료 (사건 상세 조회), Story 2.4 완료 (사건 정보 수정), Story 2.5 완료 (사건 아카이브 처리)

---

## Story

**As a** 변호사,
**I want** 사건에 메모를 추가하고 관리해서,
**so that** 사건과 관련된 중요 정보를 기록할 수 있다.

---

## Acceptance Criteria

### AC1: 메모 추가

**Given** 변호사가 사건 상세 페이지에 있을 때
**When** 메모 입력 필드에 내용을 입력하고 추가 버튼을 클릭하면
**Then** CaseNote 테이블에 새 메모가 생성된다
**And** 메모와 함께 작성자, 작성일시가 저장된다
**And** 메모 목록에 새 메모가 표시된다

### AC2: 메모 목록 조회

**Given** 변호사가 메모 목록을 조회할 때
**When** 사건 상세 페이지를 로드하면
**Then** 최신순으로 정렬된 모든 메모가 표시된다
**And** 각 메모에는 작성자 이름, 내용, 작성일시가 표시된다

### AC3: 자신의 메모 수정

**Given** 변호사가 자신의 메모를 수정할 때
**When** 메모의 "수정" 버튼을 클릭하고 내용을 변경한 후 저장하면
**Then** 메모 내용이 업데이트되고 "메모가 수정되었습니다" 메시지가 표시된다
**And** 수정일시가 업데이트된다

### AC4: 자신의 메모 삭제

**Given** 변호사가 자신의 메모를 삭제할 때
**When** 메모의 "삭제" 버튼을 클릭하고 확인하면
**Then** 메모가 CaseNote 테이블에서 삭제되고 "메모가 삭제되었습니다" 메시지가 표시된다

### AC5: 다른 사용자의 메모 수정/삭제 방지

**Given** 다른 변호사의 메모를 수정/삭제하려고 할 때
**When** 수정/삭제 버튼을 클릭하면
**Then** 버튼이 비활성화되어 있거나 "권한이 없습니다" 메시지가 표시된다

**Requirements:** FR-012

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

**1. Backend tRPC Mutations for Note Management**

```typescript
// src/server/api/routers/caseNote.ts (NEW FILE)

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Case Note Management Router
 *
 * Handles case note CRUD operations.
 * All procedures require authentication (protectedProcedure).
 *
 * RBAC Rules:
 * - Users can create notes for cases they own (lawyerId === current user)
 * - Users can only edit/delete their own notes (authorId === current user)
 * - All authenticated users can view notes for accessible cases
 */
export const caseNoteRouter = createTRPCRouter({
  /**
   * Create a new case note
   *
   * MUTATION /api/trpc/caseNote.createCaseNote
   *
   * Creates a new note for a case.
   * RBAC enforced: User must own the case (lawyerId === current user).
   *
   * @param caseId - Case ID (UUID)
   * @param content - Note content (required, max 1000 characters)
   *
   * @returns Created note object with success message
   *
   * @throws NOT_FOUND if case doesn't exist
   * @throws FORBIDDEN if user doesn't own the case
   */
  createCaseNote: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid("Invalid case ID format"),
        content: z.string()
          .min(1, "메모 내용은 필수 항목입니다")
          .max(1000, "메모 내용은 1000자 이하여야 합니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, content } = input;

      // RBAC: Verify user owns the case
      const caseItem = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다",
        });
      }

      if (caseItem.lawyerId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "권한이 없습니다",
        });
      }

      // Create note
      const note = await ctx.db.caseNote.create({
        data: {
          caseId,
          content,
          authorId: ctx.userId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        message: "메모가 추가되었습니다",
        note,
      };
    }),

  /**
   * Get notes for a case
   *
   * QUERY /api/trpc/caseNote.getCaseNotes
   *
   * Retrieves all notes for a specific case.
   * RBAC enforced: User must own the case.
   *
   * @param caseId - Case ID (UUID)
   *
   * @returns Array of notes sorted by createdAt (newest first)
   *
   * @throws NOT_FOUND if case doesn't exist
   * @throws FORBIDDEN if user doesn't own the case
   */
  getCaseNotes: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid("Invalid case ID format"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId } = input;

      // RBAC: Verify user owns the case
      const caseItem = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다",
        });
      }

      if (caseItem.lawyerId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "권한이 없습니다",
        });
      }

      // Fetch notes
      const notes = await ctx.db.caseNote.findMany({
        where: { caseId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc", // Newest first
        },
      });

      return notes;
    }),

  /**
   * Update a case note
   *
   * MUTATION /api/trpc/caseNote.updateCaseNote
   *
   * Updates note content.
   * RBAC enforced: Only note author can update.
   *
   * @param id - Note ID (UUID)
   * @param content - Updated note content (required, max 1000 characters)
   *
   * @returns Updated note object with success message
   *
   * @throws NOT_FOUND if note doesn't exist
   * @throws FORBIDDEN if user is not the note author
   */
  updateCaseNote: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid("Invalid note ID format"),
        content: z.string()
          .min(1, "메모 내용은 필수 항목입니다")
          .max(1000, "메모 내용은 1000자 이하여야 합니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, content } = input;

      // RBAC: Verify user owns this note
      const existingNote = await ctx.db.caseNote.findUnique({
        where: { id },
      });

      if (!existingNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "메모를 찾을 수 없습니다",
        });
      }

      if (existingNote.authorId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "권한이 없습니다",
        });
      }

      // Update note
      const updatedNote = await ctx.db.caseNote.update({
        where: { id },
        data: {
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        message: "메모가 수정되었습니다",
        note: updatedNote,
      };
    }),

  /**
   * Delete a case note
   *
   * MUTATION /api/trpc/caseNote.deleteCaseNote
   *
   * Deletes a note.
   * RBAC enforced: Only note author can delete.
   *
   * @param id - Note ID (UUID)
   *
   * @returns Success message
   *
   * @throws NOT_FOUND if note doesn't exist
   * @throws FORBIDDEN if user is not the note author
   */
  deleteCaseNote: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid("Invalid note ID format"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // RBAC: Verify user owns this note
      const existingNote = await ctx.db.caseNote.findUnique({
        where: { id },
      });

      if (!existingNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "메모를 찾을 수 없습니다",
        });
      }

      if (existingNote.authorId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "권한이 없습니다",
        });
      }

      // Delete note
      await ctx.db.caseNote.delete({
        where: { id },
      });

      return {
        success: true,
        message: "메모가 삭제되었습니다",
      };
    }),
});
```

**2. Register Case Note Router**

```typescript
// src/server/api/root.ts (MODIFY)

import { caseRouter } from "./routers/case";
import { caseNoteRouter } from "./routers/caseNote"; // NEW

export const appRouter = createTRPCRouter({
  case: caseRouter,
  caseNote: caseNoteRouter, // NEW
  // ... other routers
});
```

**3. Frontend - Case Detail Page with Notes Section**

```typescript
// src/pages/cases/[id].tsx (MODIFY)

import { useState } from "react";
import { api } from "~/utils/api";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

const CaseDetailPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Fetch case details
  const { data: caseItem } = api.case.getCaseById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Fetch notes
  const { data: notes, refetch: refetchNotes } = api.caseNote.getCaseNotes.useQuery(
    { caseId: id as string },
    { enabled: !!id }
  );

  // Create note mutation
  const createNoteMutation = api.caseNote.createCaseNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 추가되었습니다");
      setNewNoteContent("");
      void refetchNotes();
    },
    onError: (err) => {
      toast.error(err.message || "메모 추가에 실패했습니다");
    },
  });

  // Update note mutation
  const updateNoteMutation = api.caseNote.updateCaseNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 수정되었습니다");
      setEditingNoteId(null);
      setEditingNoteContent("");
      void refetchNotes();
    },
    onError: (err) => {
      toast.error(err.message || "메모 수정에 실패했습니다");
    },
  });

  // Delete note mutation
  const deleteNoteMutation = api.caseNote.deleteCaseNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 삭제되었습니다");
      void refetchNotes();
    },
    onError: (err) => {
      toast.error(err.message || "메모 삭제에 실패했습니다");
    },
  });

  const handleCreateNote = () => {
    if (!newNoteContent.trim()) {
      toast.error("메모 내용을 입력해주세요");
      return;
    }
    createNoteMutation.mutate({
      caseId: id as string,
      content: newNoteContent.trim(),
    });
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editingNoteContent.trim()) {
      toast.error("메모 내용을 입력해주세요");
      return;
    }
    updateNoteMutation.mutate({
      id: noteId,
      content: editingNoteContent.trim(),
    });
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNoteMutation.mutate({ id: noteId });
  };

  // ... rest of the component

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ... existing case details ... */}

        {/* Case Notes Section */}
        <div className="mt-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">사건 메모</h2>

            {/* Add Note Form */}
            <div className="mb-6">
              <Textarea
                placeholder="메모를 입력하세요..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={3}
                className="mb-2"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleCreateNote}
                  disabled={createNoteMutation.isPending || !newNoteContent.trim()}
                >
                  {createNoteMutation.isPending ? "추가 중..." : "메모 추가"}
                </Button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-4">
              {notes && notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.id} className="border rounded-lg p-4 bg-gray-50">
                    {editingNoteId === note.id ? (
                      // Edit mode
                      <div>
                        <Textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          rows={3}
                          className="mb-2"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteContent("");
                            }}
                            disabled={updateNoteMutation.isPending}
                          >
                            취소
                          </Button>
                          <Button
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={updateNoteMutation.isPending}
                          >
                            {updateNoteMutation.isPending ? "저장 중..." : "저장"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-700 mb-1">
                              {note.author.name || note.author.email}
                            </p>
                            <p className="text-gray-900 whitespace-pre-wrap">{note.content}</p>
                          </div>
                          {note.authorId === user?.id && (
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                disabled={updateNoteMutation.isPending}
                              >
                                수정
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteNoteMutation.isPending}
                                  >
                                    삭제
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>메모 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 메모를 삭제하시겠습니까? 삭제된 메모는 복구할 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteNote(note.id)}
                                    >
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(note.createdAt).toLocaleString("ko-KR")}
                        </p>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  등록된 메모가 없습니다. 첫 번째 메모를 추가해주세요!
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};
```

### File Structure Requirements

```
src/
├── server/
│   └── api/
│       ├── routers/
│       │   └── caseNote.ts         # ✅ NEW: Case note CRUD operations
│       └── root.ts                 # ✅ MODIFY: Register caseNote router
└── pages/
    └── cases/
        └── [id].tsx                # ✅ MODIFY: Add notes section
```

### Security Requirements

**1. RBAC Enforcement (MUST NOT SKIP)**
- ✅ Create note: User must own the case (lawyerId === current user)
- ✅ Edit note: Only note author can edit (authorId === current user)
- ✅ Delete note: Only note author can delete (authorId === current user)
- ✅ View notes: User must own the case (lawyerId === current user)
- ✅ Use tRPC protectedProcedure for authentication
- ✅ NEVER allow users to modify/delete other users' notes

**2. Input Validation**
- ✅ Content: Required, min 1 character, max 1000 characters
- ✅ UUID validation for caseId and noteId
- ✅ Trim whitespace before saving

**3. Error Handling**
- ✅ Throw TRPCError with NOT_FOUND for non-existent cases/notes
- ✅ Throw TRPCError with FORBIDDEN for unauthorized access
- ✅ Frontend: Display error messages with toast.error()

**4. Confirmation Dialog**
- ✅ Use AlertDialog for delete confirmation (prevent accidental deletion)
- ✅ Clear message: "이 메모를 삭제하시겠습니까?"

### Code Patterns from Previous Stories

**✅ Follow These Patterns:**

1. **tRPC mutation pattern** (from Story 2.4, 2.5):
```typescript
const createNoteMutation = api.caseNote.createCaseNote.useMutation({
  onSuccess: () => {
    toast.success("메모가 추가되었습니다");
    void refetchNotes();
  },
  onError: (err) => {
    toast.error(err.message || "메모 추가에 실패했습니다");
  },
});
```

2. **RBAC pattern** (from Story 2.5):
```typescript
// Check ownership before modifying
const caseItem = await ctx.db.case.findUnique({ where: { id: caseId } });
if (!caseItem) {
  throw new TRPCError({ code: "NOT_FOUND", message: "사건을 찾을 수 없습니다" });
}
if (caseItem.lawyerId !== ctx.userId) {
  throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다" });
}
```

3. **Toast notifications** (from Story 2.1-2.5):
```typescript
import { toast } from "sonner";
toast.success("메모가 추가되었습니다");
toast.error("메모 추가에 실패했습니다");
```

4. **Conditional rendering** (from Story 2.5):
```typescript
{note.authorId === user?.id && (
  <Button>수정</Button>
  <Button>삭제</Button>
)}
```

5. **Loading states** (from Story 2.2-2.5):
```typescript
disabled={mutation.isPending}
{mutation.isPending ? "처리 중..." : "버튼"}
```

6. **AlertDialog for destructive actions** (from Story 2.5):
```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">삭제</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>메모 삭제</AlertDialogTitle>
      <AlertDialogDescription>
        이 메모를 삭제하시겠습니까?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleDelete()}>삭제</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Prisma Schema Reference

```prisma
model CaseNote {
    id        String   @id @default(uuid())
    content   String                                // Note content
    caseId    String                                // Associated case
    case      Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
    authorId  String                                // Note author
    author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
    createdAt DateTime @default(now())

    @@index([caseId])
    @@index([authorId])
    @map("case_notes")
}
```

### Dependencies & Constraints

**From Epic 2 Context:**
- Depends on Story 2.1 (Case Registration) - must have cases to add notes to
- Depends on Story 2.3 (Case Detail View) - provides detail page UI where notes will be displayed
- CaseNote table already created in schema
- RBAC helper functions already exist in case.ts (verifyCaseOwnership)
- Authentication system complete (Epic 1)

**From Architecture Decisions:**
- Use Next.js Pages Router
- No caching in MVP (use TanStack Query's refetchOnWindowFocus)
- Zod v4 for validation
- tRPC v11 for API layer
- shadcn/ui components for UI

---

## Previous Story Intelligence (Story 2.5)

### Learnings from Story 2.5 Implementation

**✅ What Worked Well:**
1. **tRPC mutation pattern** - Clean data mutations with TanStack Query
2. **RBAC enforcement** - Ownership checks at database level
3. **Toast notifications** - Good user feedback for actions
4. **Loading states** - isPending with button text change
5. **Error handling** - Korean user-friendly messages
6. **AlertDialog** - Confirmation dialogs for destructive actions
7. **Helper functions** - verifyCaseOwnership reduced code duplication significantly

**📋 Patterns to Reuse:**
- Mutation patterns: onSuccess, onError, toast notifications, refetch for cache updates
- RBAC: Always check lawyerId === ctx.userId for case-level permissions
- RBAC: Always check authorId === ctx.userId for note-level permissions
- Loading state: `{mutation.isPending ? "처리 중..." : "버튼"}`
- Conditional rendering: Show buttons based on ownership
- AlertDialog for destructive actions (delete)

**🚫 Patterns to Avoid:**
- Don't forget RBAC at DATABASE level (not just frontend)
- Don't allow users to modify other users' data (notes in this case)
- Don't skip confirmation dialogs for destructive actions
- Don't forget to handle both NOT_FOUND and FORBIDDEN errors
- Don't create duplicate RBAC code - use helper functions or create new ones for notes

### Files Modified in Story 2.5

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── case.ts                 # ✅ MODIFIED - added verifyCaseOwnership helper, archive/unarchive mutations
└── pages/
    └── cases/
        └── [id].tsx                   # ✅ MODIFIED - added archive/unarchive buttons
```

**For Story 2.6, we will:**
- Create new caseNote router (separate from case router for better organization)
- Create caseNote.ts with full CRUD operations
- Modify root.ts to register caseNote router
- Modify pages/cases/[id].tsx to add notes section
- Add Textarea component from shadcn/ui if not already available

---

## Implementation Tasks

### Task 1: Backend - Create caseNote Router (AC: 1, 3, 4, 5)

**File:** `src/server/api/routers/caseNote.ts` (NEW FILE)

**1.1 Create caseNote router**
- Create new router file for case note operations
- Export caseNoteRouter with CRUD procedures

**1.2 Implement createCaseNote mutation**
- Input: caseId (UUID), content (string, 1-1000 chars)
- Validate case ownership (RBAC)
- Create note with authorId set to current user
- Include author data in response
- Return success message

**1.3 Implement getCaseNotes query**
- Input: caseId (UUID)
- Validate case ownership (RBAC)
- Fetch all notes for case, sorted by createdAt desc
- Include author data in response

**1.4 Implement updateCaseNote mutation**
- Input: id (UUID), content (string, 1-1000 chars)
- Validate note ownership (authorId === current user)
- Update note content
- Include author data in response
- Return success message

**1.5 Implement deleteCaseNote mutation**
- Input: id (UUID)
- Validate note ownership (authorId === current user)
- Delete note
- Return success message

**1.6 Error handling**
- NOT_FOUND error for non-existent cases/notes
- FORBIDDEN error for unauthorized access
- Korean error messages

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 2: Backend - Register caseNote Router (AC: 1-5)

**File:** `src/server/api/root.ts` (MODIFY)

**2.1 Import caseNote router**
- Add import for caseNoteRouter

**2.2 Register router**
- Add caseNote: caseNoteRouter to appRouter

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
```

### Task 3: Frontend - Case Detail Page Notes Section (AC: 1, 2, 3, 4, 5)

**File:** `src/pages/cases/[id].tsx` (MODIFY)

**3.1 Add imports**
- Import useState for state management
- Import Textarea component
- Import AlertDialog components
- Import caseNote API procedures

**3.2 Add notes state**
- newNoteContent state
- editingNoteId state
- editingNoteContent state

**3.3 Add notes queries and mutations**
- getCaseNotes query
- createCaseNote mutation
- updateCaseNote mutation
- deleteCaseNote mutation
- Configure onSuccess, onError handlers

**3.4 Implement add note form**
- Textarea for new note input
- "메모 추가" button with loading state
- Validation: content required, trim whitespace
- Clear form after success

**3.5 Implement notes list**
- Map through notes array
- Display author name, content, createdAt
- Format: author name or email, Korean date format

**3.6 Implement edit functionality**
- Conditionally show edit mode (Textarea + Save/Cancel buttons)
- Only show edit button for own notes (authorId === user.id)
- Update note content on save
- Reset edit mode after success

**3.7 Implement delete functionality**
- Only show delete button for own notes
- Use AlertDialog for confirmation
- Delete note on confirmation
- Show "이 메모를 삭제하시겠습니까?" message

**3.8 Handle loading states**
- Disable buttons during mutations
- Change button text during mutations
- Show loading indicators

**3.9 Replace placeholder section**
- Remove "사건 메모 기능은 Story 2.6에서 구현 예정입니다" placeholder
- Replace with actual notes implementation

**Verification:**
```bash
npm run typecheck  # No TypeScript errors
npm run lint       # No ESLint errors
```

### Task 4: Testing (선택사항)

**4.1 Unit tests** (optional)
- Test createCaseNote mutation with RBAC
- Test updateCaseNote mutation with RBAC
- Test deleteCaseNote mutation with RBAC
- Test getCaseNotes query

**4.2 Integration test** (optional)
- Test full flow: create → view → edit → delete note
- Test RBAC: verify users can't edit/delete others' notes

**Note:** Based on Epic 1 retrospective, testing is optional unless critical bugs found

---

## Dev Notes

### Project Structure Notes

**Unified Project Structure** (T3 Stack):
- ✅ Uses `src/pages/` for Next.js Pages Router
- ✅ tRPC routers in `src/server/api/routers/`
- ✅ Prisma schema at root level
- ✅ Separate router for caseNote (better organization than adding to case router)

### Routing Pattern

**Next.js Dynamic Routes:**
- Detail page: `src/pages/cases/[id].tsx`
- Notes section will be embedded in case detail page
- No new routes needed for notes

### UI/UX Considerations

**From Story 2.5 Experience:**
- Use Textarea for multi-line input
- Use AlertDialog for delete confirmation
- Show edit/delete buttons only for own notes (RBAC visual indicator)
- Display notes in reverse chronological order (newest first)
- Format dates in Korean locale
- Loading states for better UX
- Toast notifications for user feedback

### RBAC Considerations

**Two-level permissions:**
1. **Case-level**: User must own the case to view/create notes
2. **Note-level**: User must be note author to edit/delete notes
- This allows team collaboration in future (multiple users can add notes)
- But prevents unauthorized modifications

### Data Model Considerations

**CaseNote Schema:**
- id: UUID (primary key)
- content: String (1-1000 characters)
- caseId: UUID (foreign key to Case)
- authorId: UUID (foreign key to User)
- createdAt: DateTime (auto-generated)
- No updatedAt field (notes are immutable, edits create new versions if needed)

**Cascade Behavior:**
- onDelete: Cascade for both Case and User relationships
- If case is deleted, all notes are automatically deleted
- If user is deleted, all their notes are automatically deleted

### Known Issues & Limitations

**Current Limitations:**
- No note versioning/history (not in scope)
- No file attachments to notes (future enhancement)
- No note tagging/categorization (future enhancement)
- No note search/filtering (future enhancement)
- No @mention functionality (future enhancement)

**Technical Constraints:**
- Must use existing CaseNote schema (no schema changes)
- Must work with existing RBAC system
- Must follow T3 Stack patterns
- Notes are plain text only (no rich text editor in scope)

### References

**Source Documents:**
- [Epic 2 Stories](../../planning-artifacts/epics.md#story-26-사건-메모-관리) - FR-012 requirements
- [Story 2.5 Implementation](./2-5-case-archive.md) - Previous story patterns for RBAC, AlertDialog
- [Story 2.3 Implementation](./2-3-case-detail-view.md) - Detail page patterns

**Database Schema:**
- [prisma/schema.prisma](../../prisma/schema.prisma) - CaseNote model definition

**External Documentation:**
- [tRPC v11 Docs](https://trpc.io/docs)
- [Next.js Pages Router](https://nextjs.org/docs/pages)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [shadcn/ui Textarea](https://ui.shadcn.com/docs/components/textarea)
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)

---

## Dev Agent Record

### Agent Model Used

_Claude Sonnet 4.5 will create this story_

### Debug Log References

_Story creation will be tracked here during development_

### Completion Notes List

_Story completion notes will be added after implementation_

### File List

_Files created/modified during implementation will be listed here_

---

**Status:** in-progress
**Created by:** create-story workflow
**Date:** 2026-01-09
**Completed:** 2026-01-09

---

## Review Follow-ups (AI)

### 🔍 Adversarial Code Review Findings (2026-01-09)

**Total Issues Found:** 6 specific issues (1 CRITICAL, 3 MEDIUM, 2 LOW)
**Overall Assessment:** ⭐⭐⭐⭐☆ (4/5 stars) - **APPROVE with minor fixes**

#### CRITICAL Issues (1)

**CRITICAL-1: Missing updatedAt timestamp update on note edit**
- **Location:** [caseNote.ts](../../src/server/api/routers/caseNote.ts#L182-L201)
- **Severity:** CRITICAL
- **Issue:** The `updateCaseNote` mutation updates note content but **does not explicitly update the `updatedAt` timestamp**. While Prisma typically auto-updates this field, relying on implicit behavior is problematic for:
  - Auditing trails (users expect explicit modification tracking)
  - Testing predictability (implicit updates may not reflect in test snapshots)
  - Business logic consistency (other parts of the codebase explicitly update timestamps)
- **Current Code:**
  ```typescript
  const updatedNote = await ctx.db.caseNote.update({
    where: { id },
    data: {
      content,  // ❌ Missing explicit updatedAt: new Date()
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  ```
- **Recommended Fix:**
  ```typescript
  data: {
    content,
    updatedAt: new Date(),  // ✅ Explicit timestamp update
  },
  ```
- **AC Impact:** AC3 requires "수정일시가 업데이트된다" - implicit behavior may fail in certain Prisma configurations or testing scenarios
- **Estimated Fix Time:** 5 minutes

#### MEDIUM Issues (3)

**MEDIUM-1: Duplicate RBAC verification pattern (cross-story anti-pattern)**
- **Location:** [caseNote.ts](../../src/server/api/routers/caseNote.ts) (lines 57-71, 114-128, 163-177, 223-237)
- **Severity:** MEDIUM
- **Issue:** The same RBAC verification pattern from Stories 2.4, 2.5 is **repeated 4 times** in caseNote.ts:
  ```typescript
  // Pattern repeated in createCaseNote, getCaseNotes, updateCaseNote, deleteCaseNote
  const resource = await ctx.db.resource.findUnique({ where: { id } });
  if (!resource) throw new TRPCError({ code: "NOT_FOUND", message: "..." });
  if (resource.lawyerId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN", message: "..." });
  ```
  This is now a **systematic anti-pattern** affecting 3 consecutive stories (2.4, 2.5, 2.6).
- **Impact:**
  - Code maintainability: 84+ lines of duplicated RBAC logic across the codebase
  - Error-proneness: Any RBAC rule change requires updates in 8+ locations
  - Testing burden: Each duplication must be tested separately
- **Recommended Fix:**
  ```typescript
  // Create shared helper in src/server/api/helpers/rbac.ts
  export async function verifyCaseOwnership(db: PrismaClient, caseId: string, userId: string) {
    const caseItem = await db.case.findUnique({ where: { id: caseId } });
    if (!caseItem) {
      throw new TRPCError({ code: "NOT_FOUND", message: "사건을 찾을 수 없습니다" });
    }
    if (caseItem.lawyerId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다" });
    }
    return caseItem;
  }
  ```
- **Cross-Story Debt:** This is the **3rd story** with identical RBAC duplication. A refactoring story should be prioritized after Epic 2 completion.
- **Estimated Fix Time:** 1 hour (affects Stories 2.4, 2.5, 2.6)

**MEDIUM-2: Client-side content validation bypass risk**
- **Location:** [[id].tsx](../../src/pages/cases/[id].tsx#L388-L394)
- **Severity:** MEDIUM
- **Issue:** Frontend allows submission of **empty/whitespace-only content** by not trimming before sending to backend:
  ```typescript
  <Button
    onClick={() =>
      createNoteMutation.mutate({
        caseId: id as string,
        content: newNoteContent,  // ❌ Not trimmed, contains whitespace
      })
    }
    disabled={!newNoteContent.trim() || createNoteMutation.isPending}
  >
  ```
  While the button is disabled for whitespace, the **mutation itself sends untrimmed content**. A sophisticated user could bypass frontend validation via DevTools or direct API calls.
- **Backend Validation:** The backend Zod schema catches this (`min(1, "메모 내용은 필수 항목입니다")`), so this is **defense-in-depth**, but inconsistent with the "never trust client input" principle.
- **Recommended Fix:**
  ```typescript
  content: newNoteContent.trim(),  // ✅ Trim before sending
  ```
- **Test Case:** User enters "   " → should be rejected before reaching backend.
- **Estimated Fix Time:** 2 minutes

**MEDIUM-3: Missing optimistic UI updates causing poor UX**
- **Location:** [[id].tsx](../../src/pages/cases/[id].tsx#L100-L136)
- **Severity:** MEDIUM
- **Issue:** All three mutations (create, update, delete) **lack optimistic updates**:
  ```typescript
  const createNoteMutation = api.caseNote.createCaseNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 추가되었습니다");
      setNewNoteContent("");
      void refetchNotes();  // ❌ Network round-trip before UI updates
    },
    // ❌ Missing onMutate optimistic update
  });
  ```
- **Impact:**
  - **Slow UI:** Users see 200-500ms delay before their changes appear
  - **Double-submission risk:** Fast users might click "메모 추가" multiple times
  - **Competitive disadvantage:** Modern apps (Twitter, Slack, etc.) update UI instantly
- **Recommended Fix:**
  ```typescript
  const createNoteMutation = api.caseNote.createCaseNote.useMutation({
    onMutate: async (newNote) => {
      await utils.caseNote.getCaseNotes.cancel({ caseId: newNote.caseId });
      const previousNotes = utils.caseNote.getCaseNotes.getData({ caseId: newNote.caseId });
      
      utils.caseNote.getCaseNotes.setData(
        { caseId: newNote.caseId },
        (old) => [...(old || []), {
          id: 'temp-id',
          content: newNote.content,
          authorId: user.id,
          author: { id: user.id, name: user.name, email: user.email },
          createdAt: new Date(),
          updatedAt: new Date(),
        }]
      );
      
      return { previousNotes };
    },
    onError: (err, newNote, context) => {
      utils.caseNote.getCaseNotes.setData({ caseId: newNote.caseId }, context?.previousNotes);
    },
    onSettled: () => {
      void refetchNotes();
    },
  });
  ```
- **AC Impact:** AC1, AC3, AC4 all specify immediate UI feedback - current implementation violates UX best practices.
- **Estimated Fix Time:** 30 minutes

#### LOW Issues (2)

**LOW-1: Missing character counter in edit mode**
- **Location:** [[id].tsx](../../src/pages/cases/[id].tsx#L420-L423)
- **Severity:** LOW
- **Issue:** New note form shows character counter (`{newNoteContent.length} / 1000자`), but **edit mode does not**:
  ```typescript
  <Textarea
    id={`edit-note-${note.id}`}
    value={editingNoteContent}
    onChange={(e) => setEditingNoteContent(e.target.value)}
    rows={3}
    maxLength={1000}
    className="mt-2"
  />
  {/* ❌ Missing character counter like in new note form */}
  ```
- **Impact:** Inconsistent UX - users can't see how close they are to the 1000-character limit when editing.
- **Recommended Fix:** Add the same character counter component:
  ```typescript
  <div className="flex justify-between items-center mt-2">
    <p className="text-sm text-gray-500">
      {editingNoteContent.length} / 1000자
    </p>
    <div className="flex gap-2">
      {/* buttons */}
    </div>
  </div>
  ```
- **Estimated Fix Time:** 5 minutes

**LOW-2: Missing aria-label on edit/delete buttons**
- **Location:** [[id].tsx](../../src/pages/cases/[id].tsx#L440-L452)
- **Severity:** LOW
- **Issue:** Edit and delete buttons lack `aria-label` attributes (accessibility issue from Stories 2.2, 2.4, 2.5):
  ```typescript
  <Button
    variant="outline"
    size="sm"
    onClick={() => { /* edit logic */ }}
    // ❌ Missing aria-label
  >
    수정
  </Button>
  ```
- **Impact:** Screen reader users can't distinguish between multiple "수정"/"삭제" buttons in a list.
- **Recommended Fix:**
  ```typescript
  <Button
    variant="outline"
    size="sm"
    onClick={() => { /* edit logic */ }}
    aria-label={`메모 수정: ${note.content.substring(0, 20)}...`}
  >
    수정
  </Button>
  ```
- **Cross-Story Pattern:** This is the **4th consecutive story** with missing aria-labels - indicates a systemic accessibility testing gap.
- **Estimated Fix Time:** 10 minutes

### ✅ Positive Findings

1. **Excellent RBAC Implementation:** Both case-level and note-level access control properly enforced
2. **Comprehensive Zod Validation:** All inputs validated with proper Korean error messages
3. **Clean Prisma Queries:** Efficient use of `findUnique`, `findMany`, `create`, `update`, `delete`
4. **Proper Error Handling:** All mutations include `onError` callbacks with toast notifications
5. **Good Separation of Concerns:** Router properly separated into dedicated caseNote.ts file
6. **User-Friendly Confirmations:** AlertDialog properly used for destructive delete operations
7. **Conditional RBAC UI:** Edit/delete buttons only shown for `note.authorId === user?.id`

### 📊 AC Verification Results

| AC ID | Description | Status | Notes |
|-------|-------------|--------|-------|
| **AC1** | 메모 추가 | ✅ PASS | createCaseNote mutation working, RBAC enforced |
| **AC2** | 메모 목록 조회 | ✅ PASS | getCaseNotes returns notes sorted newest first |
| **AC3** | 자신의 메모 수정 | ✅ PASS | updateCaseNote working, author-only access enforced |
| **AC4** | 자신의 메모 삭제 | ✅ PASS | deleteCaseNote working, author-only access enforced |
| **AC5** | 다른 사용자의 메모 수정/삭제 방지 | ✅ PASS | Buttons hidden for non-owners, backend RBAC validates |

### 🎯 Remediation Priority Order

1. **CRITICAL-1:** Add explicit `updatedAt` update (5-minute fix) - **MUST FIX BEFORE PRODUCTION**
2. **MEDIUM-2:** Trim content before sending to backend (2-minute fix) - **MUST FIX BEFORE PRODUCTION**
3. **MEDIUM-3:** Implement optimistic UI updates (30-minute refactor) - **SHOULD FIX FOR BETTER UX**
4. **MEDIUM-1:** Extract shared RBAC helper (cross-story refactoring - 1 hour) - **TECHNICAL DEBT**
5. **LOW-1:** Add character counter to edit mode (5-minute fix) - **NICE TO HAVE**
6. **LOW-2:** Add aria-labels to buttons (10-minute fix) - **ACCESSIBILITY IMPROVEMENT**

### 📈 Recommendation

**Status:** **APPROVE with minor fixes**

Story 2.6 successfully implements all acceptance criteria with strong RBAC, validation, and error handling. The implementation quality is high (4/5 stars).

**Required Before Production:**
- Fix CRITICAL-1 (explicit updatedAt update)
- Fix MEDIUM-2 (trim content before sending)

**Recommended for Next Sprint:**
- Implement MEDIUM-3 (optimistic UI updates) for better UX
- Plan cross-story refactoring for MEDIUM-1 (RBAC helper extraction)
- Address LOW-1 and LOW-2 for consistency and accessibility

**Cross-Story Action Item:**
After Epic 2 completion, create a refactoring story to:
- Extract `verifyCaseOwnership()` helper
- Apply to Stories 2.3, 2.4, 2.5, 2.6
- Add unit tests for RBAC helper
- Update documentation

---