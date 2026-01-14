/**
 * Findings Router Integration Tests (Story 6.1)
 *
 * tRPC 라우터 통합 테스트
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { contextFactory } from "~/server/api/trpc";
import { findingsRouter } from "./findings";

// Mock Prisma Client
const mockDb = {
  finding: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  case: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock context
const mockCtx = {
  db: mockDb,
  userId: "test-user-id",
};

describe("Findings Router Integration Tests (Story 6.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeFindings", () => {
    it("should successfully analyze findings and return count", async () => {
      // Mock: 사건 존재
      mockDb.case.findUnique = vi.fn().mockResolvedValue({
        id: "case-1",
        lawyerId: "test-user-id",
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      // Mock: Finding.createMany 성공
      mockDb.finding.createMany = vi.fn().mockResolvedValue({
        count: 3,
      });

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      const result = await caller.analyzeFindings({
        caseId: "case-1",
      });

      expect(result).toEqual({
        findingsCreated: 3,
        analysisDuration: expect.any(Number),
      });

      expect(mockDb.finding.createMany).toHaveBeenCalled();
    });

    it("should throw NOT_FOUND when case does not exist", async () => {
      // Mock: 사건 미존재
      mockDb.case.findUnique = vi.fn().mockResolvedValue(null);

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      await expect(
        caller.analyzeFindings({
          caseId: "non-existent-case",
        })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should throw FORBIDDEN when user lacks permission", async () => {
      // Mock: 사건 존재하지만 사용자가 변호사가 아님
      mockDb.case.findUnique = vi.fn().mockResolvedValue({
        id: "case-1",
        lawyerId: "different-lawyer-id",
      });

      // Mock: 사용자는 Admin도 아님
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      await expect(
        caller.analyzeFindings({
          caseId: "case-1",
        })
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  describe("getFindingsForCase", () => {
    it("should return findings for a case", async () => {
      // Mock: 사건 존재
      mockDb.case.findUnique = vi.fn().mockResolvedValue({
        id: "case-1",
        lawyerId: "test-user-id",
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      // Mock: Finding 목록 반환
      const mockFindings = [
        {
          id: "finding-1",
          findingType: "PREFERENCE_REPAYMENT",
          title: "악의성 의심",
          description: "대출 후 30일 이내 담보제공",
          severity: "CRITICAL",
          isResolved: false,
          resolvedAt: null,
          createdAt: new Date("2024-01-13"),
          relatedTransactionIds: ["tx-1", "tx-2"],
          relatedCreditorNames: JSON.stringify(["신한은행"]),
          transaction: null,
          case: {
            id: "case-1",
            caseNumber: "2024-001",
            debtorName: "홍길동",
          },
          notes: [],
        },
      ];

      mockDb.finding.findMany = vi.fn().mockResolvedValue(mockFindings);

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      const result = await caller.getFindingsForCase({
        caseId: "case-1",
        includeResolved: false,
      });

      expect(result).toEqual(mockFindings);
      expect(mockDb.finding.findMany).toHaveBeenCalledWith({
        where: {
          caseId: "case-1",
          isResolved: false,
        },
        include: {
          transaction: {
            select: {
              id: true,
              transactionDate: true,
              depositAmount: true,
              withdrawalAmount: true,
              memo: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });
    });

    it("should throw NOT_FOUND when case does not exist", async () => {
      // Mock: 사건 미존재
      mockDb.case.findUnique = vi.fn().mockResolvedValue(null);

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      await expect(
        caller.getFindingsForCase({
          caseId: "non-existent-case",
          includeResolved: false,
        })
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("resolveFinding", () => {
    it("should resolve a finding successfully", async () => {
      // Mock: Finding 존재
      mockDb.finding.findUnique = vi.fn().mockResolvedValue({
        id: "finding-1",
        isResolved: false,
        case: {
          id: "case-1",
          lawyerId: "test-user-id",
        },
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      // Mock: Finding 업데이트 성공
      const updatedFinding = {
        id: "finding-1",
        isResolved: true,
        resolvedAt: new Date(),
      };
      mockDb.finding.update = vi.fn().mockResolvedValue(updatedFinding);

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      const result = await caller.resolveFinding({
        findingId: "finding-1",
      });

      expect(result).toEqual(updatedFinding);
      expect(mockDb.finding.update).toHaveBeenCalledWith({
        where: { id: "finding-1" },
        data: {
          isResolved: true,
          resolvedAt: expect.any(Date),
        },
      });
    });

    it("should throw BAD_REQUEST when finding is already resolved", async () => {
      // Mock: Finding 이미 해결됨
      mockDb.finding.findUnique = vi.fn().mockResolvedValue({
        id: "finding-1",
        isResolved: true,
        case: {
          id: "case-1",
          lawyerId: "test-user-id",
        },
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      await expect(
        caller.resolveFinding({
          findingId: "finding-1",
        })
      ).rejects.toThrow("BAD_REQUEST");
    });
  });

  describe("unresolveFinding", () => {
    it("should unresolve a finding successfully", async () => {
      // Mock: Finding 존재 (해결됨)
      mockDb.finding.findUnique = vi.fn().mockResolvedValue({
        id: "finding-1",
        isResolved: true,
        case: {
          id: "case-1",
          lawyerId: "test-user-id",
        },
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      // Mock: Finding 업데이트 성공
      const updatedFinding = {
        id: "finding-1",
        isResolved: false,
        resolvedAt: null,
      };
      mockDb.finding.update = vi.fn().mockResolvedValue(updatedFinding);

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      const result = await caller.unresolveFinding({
        findingId: "finding-1",
      });

      expect(result).toEqual(updatedFinding);
      expect(mockDb.finding.update).toHaveBeenCalledWith({
        where: { id: "finding-1" },
        data: {
          isResolved: false,
          resolvedAt: null,
        },
      });
    });

    it("should throw BAD_REQUEST when finding is already unresolved", async () => {
      // Mock: Finding 이미 미해결 상태
      mockDb.finding.findUnique = vi.fn().mockResolvedValue({
        id: "finding-1",
        isResolved: false,
        case: {
          id: "case-1",
          lawyerId: "test-user-id",
        },
      });

      // Mock: 사용자 권한 확인
      mockDb.user.findUnique = vi.fn().mockResolvedValue({
        id: "test-user-id",
        role: "LAWYER",
      });

      const caller = findingsRouter.createCaller(contextFactory({ userId: "test-user-id", req: {} as any, res: {} as any }));

      await expect(
        caller.unresolveFinding({
          findingId: "finding-1",
        })
      ).rejects.toThrow("BAD_REQUEST");
    });
  });
});
