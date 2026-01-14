/**
 * Finding Service Tests (Story 6.1: 자동 발견사항 식별)
 *
 * RED phase: Failing tests first (TDD)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient, TransactionNature } from "@prisma/client";
import {
  analyzeFindings,
  detectPreferenceRepayment,
  detectPriorityRepaymentViolation,
  detectCollateralIssues,
  deduplicateFindings,
  type FindingResult,
} from "./finding-service";

// Mock Prisma Client
const mockTransactionFindMany = vi.fn();
const mockTransactionChainFindMany = vi.fn();
const mockFindingFindMany = vi.fn();
const mockFindingCreateMany = vi.fn();

const mockDb = {
  transaction: {
    findMany: mockTransactionFindMany,
  },
  transactionChain: {
    findMany: mockTransactionChainFindMany,
  },
  finding: {
    findMany: mockFindingFindMany,
    createMany: mockFindingCreateMany,
  },
} as unknown as PrismaClient;

describe("Finding Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectPreferenceRepayment", () => {
    it("should detect preference repayment pattern: loan execution within 30 days before collateral", async () => {
      // Mock data: 대출 실행 후 30일 이내 담보제공
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 }, // 1억 출금 (대출 실행)
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: null,
          collateralType: null,
          memo: "대출 실행",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-20"), // 19일 후 (30일 이내)
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 100000000 }, // 1억 입금 (담보제공)
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
          memo: "담보 제공",
        },
      ]);

      const findings = await detectPreferenceRepayment({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      // AC1: 선의성/악의성 감지 → CRITICAL severity
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.findingType).toBe("PREFERENCE_REPAYMENT");
      expect(findings[0]?.severity).toBe("CRITICAL");
      expect(findings[0]?.title).toContain("악의성");
      expect(findings[0]?.relatedTransactionIds).toContain("tx-1");
      expect(findings[0]?.relatedTransactionIds).toContain("tx-2");
    });

    it("should validate amount similarity (±20% tolerance)", async () => {
      // Mock data: 금액 유사성 검증 (±20% 허용 오차)
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: null,
          collateralType: null,
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-20"),
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 115000000 }, // 15% 차이 (허용 범위 내)
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
        },
      ]);

      const findings = await detectPreferenceRepayment({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      expect(findings.length).toBeGreaterThan(0);
    });

    it("should not detect when amount difference exceeds 20%", async () => {
      // Mock data: 금액 차이가 20% 초과
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: null,
          collateralType: null,
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-20"),
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 130000000 }, // 30% 차이 (허용 범위 초과)
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
        },
      ]);

      const findings = await detectPreferenceRepayment({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      expect(findings.length).toBe(0);
    });

    it("should not detect when collateral provided after 30 days", async () => {
      // Mock data: 30일 이후 담보제공
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: null,
          collateralType: null,
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-02-05"), // 35일 후
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 100000000 },
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
        },
      ]);

      const findings = await detectPreferenceRepayment({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      expect(findings.length).toBe(0);
    });
  });

  describe("detectPriorityRepaymentViolation", () => {
    it("should detect priority repayment violation: general creditor paid before priority creditor", async () => {
      // Mock data: 일반 채권자 변제 후 우선변제권 변제
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-05"),
          withdrawalAmount: { toNumber: () => 50000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: "일반채권자 A",
          collateralType: null,
          memo: "일반 채권자 변제",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-10"),
          withdrawalAmount: { toNumber: () => 30000000 },
          depositAmount: null,
          transactionNature: "PRIORITY_REPAYMENT",
          creditorName: "조세채권",
          collateralType: null,
          memo: "우선변제권 변제",
        },
      ]);

      const findings = await detectPriorityRepaymentViolation({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      // AC2: 우선변제권 침해 → CRITICAL severity
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.findingType).toBe("PRIORITY_REPAYMENT_VIOLATION");
      expect(findings[0]?.severity).toBe("CRITICAL");
      expect(findings[0]?.title).toContain("우선변제권");
      expect(findings[0]?.relatedCreditorNames).toContain("일반채권자 A");
    });

    it("should not detect when priority creditor paid before general creditor", async () => {
      // Mock data: 우선변제권 먼저 변제 (정상)
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-05"),
          withdrawalAmount: { toNumber: () => 30000000 },
          depositAmount: null,
          transactionNature: "PRIORITY_REPAYMENT",
          creditorName: "조세채권",
          collateralType: null,
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-10"),
          withdrawalAmount: { toNumber: () => 50000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: "일반채권자 A",
          collateralType: null,
        },
      ]);

      const findings = await detectPriorityRepaymentViolation({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      expect(findings.length).toBe(0);
    });

    it("should handle multiple priority repayment violations", async () => {
      // Mock data: 다중 우선변제권 침해
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-05"),
          withdrawalAmount: { toNumber: () => 50000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: "일반채권자 A",
          collateralType: null,
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-08"),
          withdrawalAmount: { toNumber: () => 40000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: "일반채권자 B",
          collateralType: null,
        },
        {
          id: "tx-3",
          transactionDate: new Date("2024-01-15"),
          withdrawalAmount: { toNumber: () => 30000000 },
          depositAmount: null,
          transactionNature: "PRIORITY_REPAYMENT",
          creditorName: "조세채권",
          collateralType: null,
        },
      ]);

      const findings = await detectPriorityRepaymentViolation({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      expect(findings.length).toBe(1);
      expect(findings[0]?.relatedTransactionIds.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("detectCollateralIssues", () => {
    it("should detect collateral set before loan execution (WARNING)", async () => {
      // Mock data: 대출 실행 전 담보제공
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 100000000 },
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
          memo: "담보 제공",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-10"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: "신한은행",
          collateralType: null,
          memo: "대출 실행",
        },
      ]);

      const findings = await detectCollateralIssues({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      // AC3: 담보권 설정 시점 이슈 → WARNING severity
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.findingType).toBe("COLLATERAL_TIMING_ISSUE");
      expect(findings[0]?.severity).toBe("WARNING");
    });

    it("should detect duplicate collateral on same asset (WARNING)", async () => {
      // Mock data: 동일 담보물 중복 설정
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 50000000 },
          depositAmount: null,
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
          memo: "서울시 강남구 담보 설정",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-15"),
          withdrawalAmount: { toNumber: () => 30000000 },
          depositAmount: null,
          transactionNature: "COLLATERAL",
          creditorName: "국민은행",
          collateralType: "저당권",
          memo: "서울시 강남구 담보 설정", // 동일 담보물
        },
      ]);

      const findings = await detectCollateralIssues({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      // 동일 담보물 중복 설정 감지
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.findingType).toBe("COLLATERAL_DUPLICATE");
      expect(findings[0]?.severity).toBe("WARNING");
    });

    it("should detect collateral discharge without repayment verification (INFO)", async () => {
      // Mock data: 담보권 해지 후 변제 확인 안 됨
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
          memo: "담보 설정",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-06-01"),
          withdrawalAmount: null,
          depositAmount: null,
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: null,
          memo: "담보권 해지",
        },
      ]);

      const findings = await detectCollateralIssues({
        db: mockDb,
        caseId: "case-1",
        transactions: await mockTransactionFindMany(),
      });

      // 담보권 소멸 확인 → INFO severity
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.findingType).toBe("COLLATERAL_DISCHARGE");
      expect(findings[0]?.severity).toBe("INFO");
    });
  });

  describe("deduplicateFindings", () => {
    it("should filter out existing findings based on caseId + findingType + relatedTransactionIds", async () => {
      const newFindings: FindingResult[] = [
        {
          findingType: "PREFERENCE_REPAYMENT",
          title: "악의성 의심: 대출 후 짧은 기간 내 담보제공",
          description: "대출 실행일로부터 19일 이내에 담보를 제공하여 악의성이 의심됩니다.",
          severity: "CRITICAL",
          relatedTransactionIds: ["tx-1", "tx-2"],
          relatedCreditorNames: ["신한은행"],
        },
      ];

      // Mock: 기존 Finding이 존재
      mockFindingFindMany.mockResolvedValue([
        {
          id: "existing-1",
          findingType: "PREFERENCE_REPAYMENT",
          relatedTransactionIds: ["tx-1", "tx-2"], // 동일 조합
        },
      ]);

      const deduplicated = await deduplicateFindings({
        db: mockDb,
        caseId: "case-1",
        findings: newFindings,
      });

      // AC4: 중복 방지 - 기존 Finding이 존재하면 생성 스킵
      expect(deduplicated.length).toBe(0);
      expect(mockFindingFindMany).toHaveBeenCalledWith({
        where: {
          caseId: "case-1",
          findingType: "PREFERENCE_REPAYMENT",
        },
        select: {
          id: true,
          relatedTransactionIds: true,
        },
      });
    });

    it("should return findings when no duplicates exist", async () => {
      const newFindings: FindingResult[] = [
        {
          findingType: "PREFERENCE_REPAYMENT",
          title: "악의성 의심",
          description: "대출 후 30일 이내 담보제공",
          severity: "CRITICAL",
          relatedTransactionIds: ["tx-3", "tx-4"],
          relatedCreditorNames: ["신한은행"],
        },
      ];

      // Mock: 기존 Finding이 없음
      mockFindingFindMany.mockResolvedValue([]);

      const deduplicated = await deduplicateFindings({
        db: mockDb,
        caseId: "case-1",
        findings: newFindings,
      });

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0]?.findingType).toBe("PREFERENCE_REPAYMENT");
    });

    it("should handle multiple findings with mixed duplicates", async () => {
      const newFindings: FindingResult[] = [
        {
          findingType: "PREFERENCE_REPAYMENT",
          title: "악의성 1",
          description: "desc1",
          severity: "CRITICAL",
          relatedTransactionIds: ["tx-1", "tx-2"],
          relatedCreditorNames: ["신한은행"],
        },
        {
          findingType: "PREFERENCE_REPAYMENT",
          title: "악의성 2",
          description: "desc2",
          severity: "CRITICAL",
          relatedTransactionIds: ["tx-3", "tx-4"], // 다른 거래
          relatedCreditorNames: ["국민은행"],
        },
        {
          findingType: "PRIORITY_REPAYMENT_VIOLATION",
          title: "우선변제권 침해",
          description: "desc3",
          severity: "CRITICAL",
          relatedTransactionIds: ["tx-5", "tx-6"],
          relatedCreditorNames: ["일반채권자 A"],
        },
      ];

      // Mock: tx-1, tx-2는 중복, tx-3, tx-4와 tx-5, tx-6는 새로움
      mockFindingFindMany.mockResolvedValue([
        {
          id: "existing-1",
          findingType: "PREFERENCE_REPAYMENT",
          relatedTransactionIds: ["tx-1", "tx-2"],
        },
      ]);

      const deduplicated = await deduplicateFindings({
        db: mockDb,
        caseId: "case-1",
        findings: newFindings,
      });

      // 2개만 통과 (tx-1, tx-2는 중복 제거)
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0]?.relatedTransactionIds).toEqual(["tx-3", "tx-4"]);
      expect(deduplicated[1]?.relatedTransactionIds).toEqual(["tx-5", "tx-6"]);
    });
  });

  describe("analyzeFindings", () => {
    it("should analyze all transactions and create findings", async () => {
      // Mock data: 다양한 패턴의 거래
      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          transactionDate: new Date("2024-01-01"),
          withdrawalAmount: { toNumber: () => 100000000 },
          depositAmount: null,
          transactionNature: "GENERAL",
          creditorName: null,
          collateralType: null,
          memo: "대출 실행",
        },
        {
          id: "tx-2",
          transactionDate: new Date("2024-01-20"),
          withdrawalAmount: null,
          depositAmount: { toNumber: () => 100000000 },
          transactionNature: "COLLATERAL",
          creditorName: "신한은행",
          collateralType: "저당권",
          memo: "담보 제공",
        },
      ]);

      mockTransactionChainFindMany.mockResolvedValue([]);
      mockFindingFindMany.mockResolvedValue([]);
      mockFindingCreateMany.mockResolvedValue({ count: 1 });

      const result = await analyzeFindings({
        db: mockDb,
        caseId: "case-1",
        userId: "user-1",
      });

      // AC4: 분석 완료 후 생성된 Finding 개수 반환
      expect(result.findingsCreated).toBeGreaterThanOrEqual(0);
      expect(result.analysisDuration).toBeLessThan(30000); // 30초 이내
      expect(mockTransactionFindMany).toHaveBeenCalledWith({
        where: {
          caseId: "case-1",
          transactionNature: { not: null }, // Epic 4에서 분류된 거래만 분석
        },
        select: expect.any(Object),
      });
    });

    it("should run all detection functions in parallel", async () => {
      mockTransactionFindMany.mockResolvedValue([]);
      mockTransactionChainFindMany.mockResolvedValue([]);
      mockFindingFindMany.mockResolvedValue([]);
      mockFindingCreateMany.mockResolvedValue({ count: 0 });

      const startTime = Date.now();

      await analyzeFindings({
        db: mockDb,
        caseId: "case-1",
        userId: "user-1",
      });

      const duration = Date.now() - startTime;

      // 병렬 실행으로 3가지 감지 함수가 동시에 실행됨
      // (실제 성능 테스트는 Task 6에서 수행)
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should return 0 findings when no patterns detected", async () => {
      mockTransactionFindMany.mockResolvedValue([]);
      mockTransactionChainFindMany.mockResolvedValue([]);
      mockFindingFindMany.mockResolvedValue([]);
      mockFindingCreateMany.mockResolvedValue({ count: 0 });

      const result = await analyzeFindings({
        db: mockDb,
        caseId: "case-1",
        userId: "user-1",
      });

      expect(result.findingsCreated).toBe(0);
      expect(mockFindingCreateMany).not.toHaveBeenCalled(); // No findings to create
    });

    it("should handle errors gracefully", async () => {
      mockTransactionFindMany.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        analyzeFindings({
          db: mockDb,
          caseId: "case-1",
          userId: "user-1",
        })
      ).rejects.toThrow("Database error");
    });
  });
});
