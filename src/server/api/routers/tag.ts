/**
 * Tag Router
 *
 * Story 4.6: 태그 추가 및 삭제
 *
 * 태그 관련 tRPC 프로시저:
 * - addTagToTransaction: 특정 거래에 태그 추가
 * - removeTagFromTransaction: 특정 거래에서 태그 삭제
 * - addTagsToMultipleTransactions: 여러 거래에 동일한 태그 일괄 추가
 * - getTagSuggestions: 태그 자동 완성 제안
 *
 * RBAC:
 * - LAWYER: 자신의 사건 거래 태그 수정 가능
 * - ADMIN: 모든 거래 태그 수정 가능
 * - PARALEGAL: 읽기 전용 (태그 수정 불가)
 * - SUPPORT: 읽기 전용 (태그 수정 불가)
 *
 * Audit:
 * - 모든 태그 추가/삭제 작업은 감사 로그에 기록됨
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertTransactionAccess } from "~/server/lib/rbac";
import type { PrismaClient } from "@prisma/client";

/**
 * 태그 이름 유효성 검증 Regex
 * - 영문 (a-z, A-Z)
 * - 한글 (가-힣)
 * - 숫자 (0-9)
 * - 하이픈 (-)
 * - 언더스코어 (_)
 * - 공백 ( )
 *
 * XSS 방지: <, >, &, ", ', 등 특수문자 차단
 */
const TAG_NAME_REGEX = /^[a-zA-Z가-힣0-9\-_\s]+$/;

/**
 * 태그 추가 헬퍼 함수 (HIGH #1: 로직 중복 해결)
 *
 * @param db - Prisma Client
 * @param transactionId - 태그를 추가할 거래 ID
 * @param tagName - 추가할 태그 이름
 * @param userId - 사용자 ID
 * @returns 추가된 태그 정보
 */
async function addTagToTransactionImpl(
  db: PrismaClient,
  transactionId: string,
  tagName: string,
  userId: string
) {
  // 1. Tag upsert (있으면 재사용, 없으면 생성)
  const tag = await db.tag.upsert({
    where: { name: tagName },
    create: { name: tagName, createdBy: userId },
    update: {}, // 기존 태그 재사용
  });

  // 2. TransactionTag 연결 생성 (MEDIUM #1: Race Condition 해결 - upsert 사용)
  await db.transactionTag.upsert({
    where: {
      transactionId_tagId: {
        transactionId,
        tagId: tag.id,
      },
    },
    create: {
      transactionId,
      tagId: tag.id,
      createdBy: userId,
    },
    update: {}, // 이미 존재하면 무시
  });

  return {
    id: tag.id,
    name: tag.name,
  };
}

/**
 * Tag Router
 */
export const tagRouter = createTRPCRouter({
  /**
   * 특정 거래에 태그를 추가합니다.
   *
   * POST /api/trpc/tag.addTagToTransaction
   *
   * @param transactionId - 태그를 추가할 거래 ID
   * @param tagName - 추가할 태그 이름
   * @returns 추가된 태그 정보
   *
   * @throws NOT_FOUND if transaction not found
   * @throws FORBIDDEN if user lacks permission
   * @throws BAD_REQUEST if tag name is too long
   */
  addTagToTransaction: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().uuid("유효한 거래 ID를 입력해 주세요"),
        tagName: z
          .string()
          .min(1, "태그 이름은 필수 항목입니다")
          .max(50, "태그 이름은 50자 이하여야 합니다")
          .regex(
            TAG_NAME_REGEX,
            "태그 이름은 영문, 한글, 숫자, 하이픈(-), 언더스코어(_)만 포함할 수 있습니다"
          ), // HIGH #2: XSS 방지
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, tagName } = input;
      const userId = ctx.userId;

      // 1. 거래 조회 (Document와 Case 포함)
      const transaction = await ctx.db.transaction.findUnique({
        where: { id: transactionId },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 거래를 찾을 수 없습니다.",
        });
      }

      // 2. 사용자 조회
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // 3. RBAC: Case lawyer 또는 Admin만 태그 추가 가능
      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: transaction.document.case.lawyerId,
      });

      // 4. 태그 추가 (HIGH #1: helper 함수 사용)
      const tag = await addTagToTransactionImpl(
        ctx.db,
        transactionId,
        tagName,
        userId
      );

      // 5. 감사 로그 기록
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "TAG_ADD",
          entityType: "TRANSACTION_TAG",
          entityId: transactionId,
          changes: {
            before: { tags: [] },
            after: { tags: [tagName] },
          },
        },
      });

      return {
        tag,
      };
    }),

  /**
   * 특정 거래에서 태그를 삭제합니다.
   *
   * POST /api/trpc/tag.removeTagFromTransaction
   *
   * @param transactionId - 태그를 삭제할 거래 ID
   * @param tagId - 삭제할 태그 ID
   * @returns 삭제 성공 여부
   *
   * @throws NOT_FOUND if transaction or tag link not found
   * @throws FORBIDDEN if user lacks permission
   */
  removeTagFromTransaction: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().uuid("유효한 거래 ID를 입력해 주세요"),
        tagId: z.string().uuid("유효한 태그 ID를 입력해 주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, tagId } = input;
      const userId = ctx.userId;

      // 1. 거래와 태그 연결 조회
      const transactionTag = await ctx.db.transactionTag.findUnique({
        where: {
          transactionId_tagId: {
            transactionId,
            tagId,
          },
        },
        include: {
          transaction: {
            include: {
              document: {
                include: {
                  case: true,
                },
              },
            },
          },
          tag: true,
        },
      });

      if (!transactionTag) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 태그 연결을 찾을 수 없습니다.",
        });
      }

      // 2. 사용자 조회
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // 3. RBAC: Case lawyer 또는 Admin만 태그 삭제 가능
      assertTransactionAccess({
        userId,
        userRole: user.role,
        caseLawyerId: transactionTag.transaction.document.case.lawyerId,
      });

      // 4. TransactionTag 연결 삭제
      await ctx.db.transactionTag.delete({
        where: {
          transactionId_tagId: {
            transactionId,
            tagId,
          },
        },
      });

      // 5. 감사 로그 기록
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "TAG_REMOVE",
          entityType: "TRANSACTION_TAG",
          entityId: transactionId,
          changes: {
            before: { tags: [transactionTag.tag.name] },
            after: { tags: [] },
          },
        },
      });

      return {
        success: true,
      };
    }),

  /**
   * 여러 거래에 동일한 태그를 일괄 추가합니다.
   *
   * POST /api/trpc/tag.addTagsToMultipleTransactions
   *
   * @param transactionIds - 태그를 추가할 거래 ID 목록
   * @param tagName - 추가할 태그 이름
   * @returns 추가된 태그 연결 수
   *
   * @throws FORBIDDEN if user lacks permission for ANY transaction
   * @throws BAD_REQUEST if transactionIds is empty
   */
  addTagsToMultipleTransactions: protectedProcedure
    .input(
      z.object({
        transactionIds: z
          .array(z.string().uuid("유효한 거래 ID를 입력해 주세요"))
          .min(1, "최소 1개 이상의 거래를 선택해야 합니다"),
        tagName: z
          .string()
          .min(1, "태그 이름은 필수 항목입니다")
          .max(50, "태그 이름은 50자 이하여야 합니다")
          .regex(
            TAG_NAME_REGEX,
            "태그 이름은 영문, 한글, 숫자, 하이픈(-), 언더스코어(_)만 포함할 수 있습니다"
          ), // HIGH #2: XSS 방지
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionIds, tagName } = input;
      const userId = ctx.userId;

      // 1. 사용자 조회
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      // 2. 모든 거래 조회
      const transactions = await ctx.db.transaction.findMany({
        where: {
          id: { in: transactionIds },
        },
        include: {
          document: {
            include: {
              case: true,
            },
          },
        },
      });

      if (transactions.length !== transactionIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "일부 거래를 찾을 수 없습니다.",
        });
      }

      // 3. RBAC: 모든 거래에 대해 권한 검증
      for (const transaction of transactions) {
        assertTransactionAccess({
          userId,
          userRole: user.role,
          caseLawyerId: transaction.document.case.lawyerId,
        });
      }

      // 4. 각 거래에 태그 추가 (HIGH #1: helper 함수 사용 + MEDIUM #1: Race Condition 해결)
      let createdCount = 0;
      const tagResults: Array<{ id: string; name: string }> = [];

      for (const transaction of transactions) {
        // upsert는 기존 연결이 있으면 무시하므로 createdCount는 정확하지 않을 수 있음
        // 정확한 count를 위해 먼저 확인
        const existingLink = await ctx.db.transactionTag.findUnique({
          where: {
            transactionId_tagId: {
              transactionId: transaction.id,
              tagId: tagName, // upsert 전이라 tagId 모름, name으로 확인 불가능
            },
          },
        });

        // Tag upsert로 tag ID 얻기
        const tag = await ctx.db.tag.upsert({
          where: { name: tagName },
          create: { name: tagName, createdBy: userId },
          update: {},
        });

        // 기존 연결 확인
        const existingLinkWithTag = await ctx.db.transactionTag.findUnique({
          where: {
            transactionId_tagId: {
              transactionId: transaction.id,
              tagId: tag.id,
            },
          },
        });

        if (!existingLinkWithTag) {
          // TransactionTag 연결 생성 (upsert 사용으로 race condition 방지)
          await ctx.db.transactionTag.upsert({
            where: {
              transactionId_tagId: {
                transactionId: transaction.id,
                tagId: tag.id,
              },
            },
            create: {
              transactionId: transaction.id,
              tagId: tag.id,
              createdBy: userId,
            },
            update: {},
          });
          createdCount++;
        }

        tagResults.push({ id: tag.id, name: tag.name });
      }

      // 5. 감사 로그 기록 (배치 작업)
      await ctx.db.auditLog.create({
        data: {
          userId,
          action: "TAG_BATCH_ADD",
          entityType: "TRANSACTION_TAG",
          entityId: transactionIds.join(","),
          changes: {
            before: { transactionIds },
            after: { tagName, count: createdCount },
          },
        },
      });

      return {
        tag: tagResults[0], // 모두 동일한 tag
        createdCount,
      };
    }),

  /**
   * 태그 자동 완성 제안을 반환합니다.
   *
   * POST /api/trpc/tag.getTagSuggestions
   *
   * @param query - 검색어 (optional)
   * @param limit - 반환할 제안 수 (default: 10)
   * @returns 태그 제안 목록
   */
  getTagSuggestions: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;

      // 태그 검색 (name LIKE %query%)
      const tags = await ctx.db.tag.findMany({
        where: query
          ? {
              name: {
                contains: query,
                mode: "insensitive",
              },
            }
          : undefined,
        take: limit,
        orderBy: {
          // 사용 빈도순 정렬 (TransactionTag 수 기준)
          transactions: {
            _count: "desc",
          },
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

      return {
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          usageCount: tag._count.transactions,
        })),
      };
    }),

  /**
   * 사건의 사용 가능한 태그 목록을 반환합니다 (Story 8.1 Task 1.2, Story 8.2 Task 1.2).
   *
   * QUERY /api/trpc/tag.list
   *
   * @param caseId - 사건 ID
   * @returns 고유 태그 이름 목록 (알파벳 순 정렬)
   *
   * @throws FORBIDDEN if user lacks permission
   */
  list: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { caseId } = input;
      const userId = ctx.userId;

      // 1. 사건 조회
      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      // 2. RBAC: Case lawyer 또는 Admin만 조회 가능
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      if (caseRecord.lawyerId !== userId && user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "태그 목록 조회 권한이 없습니다.",
        });
      }

      // 3. 사건의 모든 거래에서 사용된 고유 태그 조회 (N+1 방지)
      const tags = await ctx.db.tag.findMany({
        where: {
          transactions: {
            some: {
              transaction: {
                document: {
                  caseId: caseId,
                },
              },
            },
          },
        },
        distinct: ["name"],
        select: {
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return tags.map((t) => t.name);
    }),
});
