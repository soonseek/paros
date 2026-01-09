import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Role } from "@prisma/client";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Case Management Router
 *
 * Handles bankruptcy case registration and management operations.
 * All procedures require authentication (protectedProcedure).
 *
 * RBAC Rules:
 * - All authenticated users can create cases (lawyerId is automatically set to current user)
 * - Only ADMIN and LAWYER can create cases
 * - Users can only view their own cases (enforced via lawyerId filter)
 * - Only users with proper access can view cases (enforced via RBAC middleware)
 */
export const caseRouter = createTRPCRouter({
  /**
   * Create a new bankruptcy case
   *
   * POST /api/trpc/case.createCase
   *
   * Creates a new case with the provided information.
   * The case is automatically linked to the currently authenticated user (lawyerId).
   *
   * @param caseNumber - Unique case number (required)
   * @param debtorName - Name of the debtor (required)
   * @param courtName - Name of the court (optional)
   * @param filingDate - Date of case filing (optional)
   *
   * @returns Created case object with success message
   *
   * @throws CONFLICT if caseNumber already exists
   */
  createCase: protectedProcedure
    .input(
      z.object({
        caseNumber: z.string()
          .min(1, "사건번호는 필수 항목입니다")
          .regex(
            /^\d{4}(하|타)\d{5}$/,
            "사건번호 형식이 올바르지 않습니다 (예: 2023하12345)"
          ),
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseNumber, debtorName, courtName, filingDate } = input;

      // RBAC: Check user role - only LAWYER and ADMIN can create cases
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });

      if (!user || (user.role !== Role.LAWYER && user.role !== Role.ADMIN)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "사건을 생성할 권한이 없습니다",
        });
      }

      // Check if caseNumber already exists
      const existingCase = await ctx.db.case.findUnique({
        where: { caseNumber },
      });

      if (existingCase) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 존재하는 사건번호입니다",
        });
      }

      // Create new case with lawyerId set to current user
      const newCase = await ctx.db.case.create({
        data: {
          caseNumber,
          debtorName,
          courtName,
          filingDate,
          lawyerId: ctx.userId, // Automatically link to current authenticated user
          status: "PENDING", // Default status
        },
      });

      // Security: Increment tokenVersion to maintain session integrity
      // This invalidates existing refresh tokens after sensitive action
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { tokenVersion: { increment: 1 } },
      });

      return {
        success: true,
        message: "사건이 등록되었습니다",
        case: newCase,
      };
    }),

  /**
   * Get cases with filtering and pagination
   *
   * QUERY /api/trpc/case.getCases
   *
   * Retrieves cases for the currently authenticated user with optional filtering.
   * RBAC enforced: Users can only see their own cases (lawyerId = current user).
   *
   * @param search - Search term for case number or debtor name (optional, case-insensitive, partial match)
   * @param courtName - Filter by court name (optional)
   * @param filingDateFrom - Filter by filing date start (optional)
   * @param filingDateTo - Filter by filing date end (optional)
   * @param page - Page number for pagination (default: 1)
   * @param sortBy - Field to sort by (default: 'filingDate')
   * @param sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
   *
   * @returns Paginated list of cases with metadata
   */
  getCases: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        courtName: z.string().optional(),
        filingDateFrom: z.date().optional(),
        filingDateTo: z.date().optional(),
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
        page,
        sortBy,
        sortOrder,
      } = input;

      const pageSize = 20;
      const skip = (page - 1) * pageSize;

      // Build where clause with RBAC enforcement
      const where: {
        lawyerId: string;
        isArchived: boolean;
        OR?: Array<{
          caseNumber?: { contains: string; mode: 'insensitive' };
          debtorName?: { contains: string; mode: 'insensitive' };
        }>;
        courtName?: string;
        filingDate?: { gte?: Date; lte?: Date };
      } = {
        lawyerId: ctx.userId, // ✅ CRITICAL: RBAC enforcement - only user's own cases
        isArchived: false, // Active cases only
      };

      // Add search filter (case number or debtor name)
      if (search && search.trim()) {
        where.OR = [
          { caseNumber: { contains: search.trim(), mode: 'insensitive' } },
          { debtorName: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      // Add court name filter
      if (courtName && courtName.trim()) {
        where.courtName = courtName.trim();
      }

      // Add date range filter
      if (filingDateFrom || filingDateTo) {
        where.filingDate = {};
        if (filingDateFrom) {
          where.filingDate.gte = filingDateFrom;
        }
        if (filingDateTo) {
          where.filingDate.lte = filingDateTo;
        }
      }

      // Fetch cases with pagination and sorting
      const cases = await ctx.db.case.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        take: pageSize,
        skip,
      });

      // Get total count for pagination
      const total = await ctx.db.case.count({ where });

      // Calculate total pages
      const totalPages = Math.ceil(total / pageSize);

      return {
        cases,
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    }),

  /**
   * Get a single case by ID
   *
   * QUERY /api/trpc/case.getCaseById
   *
   * Retrieves detailed information about a specific case.
   * RBAC enforced: Users can only view their own cases (lawyerId check).
   *
   * @param id - Case ID (UUID)
   *
   * @returns Case object with lawyer information
   *
   * @throws NOT_FOUND if case doesn't exist
   * @throws FORBIDDEN if user doesn't own the case
   */
  getCaseById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid("Invalid case ID format"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { id } = input;

      // Fetch case with lawyer information
      const caseItem = await ctx.db.case.findUnique({
        where: { id },
        include: {
          lawyer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Case not found
      if (!caseItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다",
        });
      }

      // RBAC: Verify user owns this case
      if (caseItem.lawyerId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "권한이 없습니다",
        });
      }

      return caseItem;
    }),

  /**
   * Update a case
   *
   * MUTATION /api/trpc/case.updateCase
   *
   * Updates case information (debtorName, courtName, filingDate, status).
   * Case number (caseNumber) and lawyerId cannot be changed.
   * RBAC enforced: Only the case owner can update it.
   *
   * @param id - Case ID (UUID)
   * @param debtorName - Name of the debtor (required)
   * @param courtName - Name of the court (optional)
   * @param filingDate - Date of case filing (optional)
   * @param status - Case status (required)
   *
   * @returns Updated case object with success message
   *
   * @throws NOT_FOUND if case doesn't exist
   * @throws FORBIDDEN if user doesn't own the case
   */
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
        courtName: z.string()
          .optional()
          .transform(value => value && value.trim() !== "" ? value.trim() : undefined),
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

      // Note: Case update is not a security-sensitive operation like password/email change
      // so we don't increment tokenVersion here to avoid logging users out from other devices

      return {
        success: true,
        message: "사건이 업데이트되었습니다",
        case: updatedCase,
      };
    }),
});
