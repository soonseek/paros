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
          updatedAt: new Date(), // Explicit timestamp update for auditing
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
