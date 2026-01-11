/**
 * Finding Generator Service Tests
 *
 * Story 4.3: 중요 거래 자동 식별
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  convertDetectionToFindingParams,
  createFinding,
  generateFindingsForTransactions,
  calculateFindingStats,
  type FindingCreateParams,
} from "./finding-generator";
import type { ImportantTransactionDetectionResult } from "./types";

// Mock Prisma Client
const mockDb = {
  finding: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

describe("Finding Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("convertDetectionToFindingParams", () => {
    it("중요 거래 감지 결과를 Finding 생성 파라미터로 변환", () => {
      const detectionResult: ImportantTransactionDetectionResult = {
        isImportant: true,
        type: "LOAN_EXECUTION",
        matchedKeywords: ["대출 실행", "실행"],
        confidence: 1.0,
      };

      const params = convertDetectionToFindingParams(
        "case-1",
        "tx-1",
        "대출 실행 500만원",
        detectionResult
      );

      expect(params).not.toBeNull();
      expect(params?.caseId).toBe("case-1");
      expect(params?.transactionId).toBe("tx-1");
      expect(params?.findingType).toBe("IMPORTANT_TRANSACTION");
      expect(params?.severity).toBe("WARNING");
      expect(params?.title).toContain("대출 실행");
      expect(params?.description).toContain("대출 실행 500만원");
      expect(params?.description).toContain("매칭된 키워드");
    });

    it("압류는 CRITICAL 심각도", () => {
      const detectionResult: ImportantTransactionDetectionResult = {
        isImportant: true,
        type: "SEIZURE",
        matchedKeywords: ["압류"],
        confidence: 1.0,
      };

      const params = convertDetectionToFindingParams(
        "case-1",
        "tx-1",
        "급여 압류",
        detectionResult
      );

      expect(params?.severity).toBe("CRITICAL");
      expect(params?.findingType).toBe("SEIZURE");
    });

    it("변제는 INFO 심각도", () => {
      const detectionResult: ImportantTransactionDetectionResult = {
        isImportant: true,
        type: "REPAYMENT",
        matchedKeywords: ["변제"],
        confidence: 1.0,
      };

      const params = convertDetectionToFindingParams(
        "case-1",
        "tx-1",
        "변제 완료",
        detectionResult
      );

      expect(params?.severity).toBe("INFO");
    });

    it("중요 거래가 아니면 null 반환", () => {
      const detectionResult: ImportantTransactionDetectionResult = {
        isImportant: false,
        type: null,
        matchedKeywords: [],
        confidence: 1.0,
      };

      const params = convertDetectionToFindingParams(
        "case-1",
        "tx-1",
        "일반 거래",
        detectionResult
      );

      expect(params).toBeNull();
    });

    it("알 수 없는 중요 거래 유형은 null 반환", () => {
      const detectionResult: ImportantTransactionDetectionResult = {
        isImportant: true,
        type: "UNKNOWN" as any,
        matchedKeywords: [],
        confidence: 1.0,
      };

      const params = convertDetectionToFindingParams(
        "case-1",
        "tx-1",
        "알 수 없음",
        detectionResult
      );

      expect(params).toBeNull();
    });
  });

  describe("createFinding", () => {
    it("중복 Finding이 있으면 기존 Finding 반환", async () => {
      const existingFinding = { id: "existing-1" };
      mockDb.finding.findFirst.mockResolvedValue(existingFinding);

      const params: FindingCreateParams = {
        caseId: "case-1",
        transactionId: "tx-1",
        findingType: "IMPORTANT_TRANSACTION",
        title: "대출 실행 - 대출 실행 감지",
        description: "매칭된 키워드: 대출 실행",
        severity: "WARNING",
      };

      const result = await createFinding(mockDb as any, params);

      expect(result).toEqual(existingFinding);
      expect(mockDb.finding.create).not.toHaveBeenCalled();
    });

    it("중복 Finding이 없으면 새 Finding 생성", async () => {
      mockDb.finding.findFirst.mockResolvedValue(null);
      const newFinding = { id: "new-1", ...mockParams };
      mockDb.finding.create.mockResolvedValue(newFinding);

      const params: FindingCreateParams = {
        caseId: "case-1",
        transactionId: "tx-1",
        findingType: "IMPORTANT_TRANSACTION",
        title: "대출 실행 - 대출 실행 감지",
        description: "매칭된 키워드: 대출 실행",
        severity: "WARNING",
      };

      const result = await createFinding(mockDb as any, params);

      expect(result).toEqual(newFinding);
      expect(mockDb.finding.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: "case-1",
          transactionId: "tx-1",
          findingType: "IMPORTANT_TRANSACTION",
        }),
      });
    });
  });

  describe("generateFindingsForTransactions", () => {
    it("중요 거래에 대한 Finding 생성", async () => {
      mockDb.finding.findFirst.mockResolvedValue(null);
      mockDb.finding.create.mockResolvedValue({ id: "finding-1" });

      const transactions = [
        { id: "tx-1", memo: "대출 실행" },
        { id: "tx-2", memo: "일반 거래" },
      ];

      const detectionResults = new Map<string, ImportantTransactionDetectionResult>();
      detectionResults.set("tx-1", {
        isImportant: true,
        type: "LOAN_EXECUTION",
        matchedKeywords: ["대출 실행"],
        confidence: 1.0,
      });
      detectionResults.set("tx-2", {
        isImportant: false,
        type: null,
        matchedKeywords: [],
        confidence: 1.0,
      });

      const findings = await generateFindingsForTransactions(
        mockDb as any,
        "case-1",
        transactions,
        detectionResults
      );

      expect(findings).toHaveLength(1);
      expect(mockDb.finding.create).toHaveBeenCalledTimes(1);
    });

    it("진행률 콜백 호출", async () => {
      mockDb.finding.findFirst.mockResolvedValue(null);
      mockDb.finding.create.mockResolvedValue({ id: "finding-1" });

      const transactions = [
        { id: "tx-1", memo: "대출 실행" },
        { id: "tx-2", memo: "일반" },
      ];

      const detectionResults = new Map<string, ImportantTransactionDetectionResult>();
      detectionResults.set("tx-1", {
        isImportant: true,
        type: "LOAN_EXECUTION",
        matchedKeywords: [],
        confidence: 1.0,
      });
      detectionResults.set("tx-2", {
        isImportant: false,
        type: null,
        matchedKeywords: [],
        confidence: 1.0,
      });

      const progressCallback = vi.fn();

      await generateFindingsForTransactions(
        mockDb as any,
        "case-1",
        transactions,
        detectionResults,
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe("calculateFindingStats", () => {
    it("Finding 통계 계산", () => {
      const findings = [
        { findingType: "IMPORTANT_TRANSACTION", severity: "WARNING" },
        { findingType: "IMPORTANT_TRANSACTION", severity: "CRITICAL" },
        { findingType: "SEIZURE", severity: "CRITICAL" },
        { findingType: "SEIZURE", severity: "INFO" },
      ];

      const stats = calculateFindingStats(findings);

      expect(stats.total).toBe(4);
      expect(stats.byType.IMPORTANT_TRANSACTION).toBe(2);
      expect(stats.byType.SEIZURE).toBe(2);
      expect(stats.bySeverity.CRITICAL).toBe(2);
      expect(stats.bySeverity.WARNING).toBe(1);
      expect(stats.bySeverity.INFO).toBe(1);
    });
  });
});

const mockParams: FindingCreateParams = {
  caseId: "case-1",
  transactionId: "tx-1",
  findingType: "IMPORTANT_TRANSACTION",
  title: "대출 실행 - 대출 실행 감지",
  description: "매칭된 키워드: 대출 실행",
  severity: "WARNING",
};
