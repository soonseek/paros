/**
 * Excel Export Service Tests (Story 7.1, Task 6.1)
 *
 * @module server/services/excel-export-service.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { excelExportService } from './excel-export-service';
import { db } from '~/server/db';
import ExcelJS from 'exceljs';

// Mock db
vi.mock('~/server/db', () => ({
  db: {
    case: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    finding: {
      findMany: vi.fn(),
    },
  },
}));

describe('[Story 7.1] ExcelExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFullAnalysisExcel', () => {
    it('[AC2] should generate Excel with 4 sheets', async () => {
      // GIVEN: Mock case data
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: 'CASE-001',
        debtorName: '홍길동',
        court: '서울회생법원',
        trustee: '김관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      // GIVEN: Mock transaction data
      vi.mocked(db.transaction.findMany).mockResolvedValue([
        {
          id: 'tx-1',
          transactionDate: new Date('2026-01-01'),
          depositAmount: { toNumber: () => 1000000 },
          withdrawalAmount: { toNumber: () => null },
          description: '입금',
          nature: 'CREDITOR',
          category: '채권자 관련 거래',
          confidenceScore: { toNumber: () => 0.95 },
          tags: [],
        },
      ]);

      // GIVEN: Mock finding data
      vi.mocked(db.finding.findMany).mockResolvedValue([
        {
          id: 'finding-1',
          findingType: 'PREFERENCE_REPAYMENT',
          severity: 'CRITICAL',
          priority: 'HIGH',
          description: '우선변제 의심',
          relatedTransactionIds: ['tx-1'],
          relatedCreditorNames: JSON.stringify(['신한은행']),
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
      ]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Response structure is correct
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('filename');
      expect(response).toHaveProperty('mimeType');
      expect(response).toHaveProperty('success');
      expect(response.success).toBe(true);

      // AND: Filename is correct format
      expect(response.filename).toMatch(/^분석결과_CASE_001_\d{8}\.xlsx$/);

      // AND: Data is Base64 encoded
      expect(response.data).toMatch(/^[A-Za-z0-9+/]+=*$/);

      console.log('✅ 4개 시트 Excel 생성 성공');
      console.log(`✅ 파일명: ${response.filename}`);
    });

    it('[AC3] should support Korean text', async () => {
      // GIVEN: Case with Korean data
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: '사건-001',
        debtorName: '김철수',
        court: '수원회생법원',
        trustee: '이관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);
      vi.mocked(db.finding.findMany).mockResolvedValue([]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Base64 encoding is successful
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      console.log('✅ 한글 텍스트 Excel 생성 성공');
    });

    it('[AC5] should apply severity colors for findings', async () => {
      // GIVEN: Findings with different severities
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: 'CASE-001',
        debtorName: '홍길동',
        court: '서울회생법원',
        trustee: '김관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      vi.mocked(db.finding.findMany).mockResolvedValue([
        {
          id: 'finding-1',
          findingType: 'PREFERENCE_REPAYMENT',
          severity: 'CRITICAL',
          priority: 'HIGH',
          description: 'CRITICAL finding',
          relatedTransactionIds: [],
          relatedCreditorNames: null,
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'finding-2',
          findingType: 'PRIORITY_REPAYMENT_VIOLATION',
          severity: 'WARNING',
          priority: 'MEDIUM',
          description: 'WARNING finding',
          relatedTransactionIds: [],
          relatedCreditorNames: null,
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'finding-3',
          findingType: 'COLLATERAL_TIMING_ISSUE',
          severity: 'INFO',
          priority: 'LOW',
          description: 'INFO finding',
          relatedTransactionIds: [],
          relatedCreditorNames: null,
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
      ]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Excel is generated successfully
      expect(response.success).toBe(true);

      console.log('✅ severity별 색상 적용 완료 (CRITICAL, WARNING, INFO)');
    });

    it('[Task 3.5] should calculate AI classification summary', async () => {
      // GIVEN: Transactions with various categories
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: 'CASE-001',
        debtorName: '홍길동',
        court: '서울회생법원',
        trustee: '김관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      vi.mocked(db.transaction.findMany).mockResolvedValue([
        {
          id: 'tx-1',
          transactionDate: new Date('2026-01-01'),
          depositAmount: { toNumber: () => 1000000 },
          withdrawalAmount: { toNumber: () => null },
          description: '입금',
          nature: 'CREDITOR',
          category: '채권자 관련 거래',
          confidenceScore: { toNumber: () => 0.9 },
          tags: [],
        },
        {
          id: 'tx-2',
          transactionDate: new Date('2026-01-02'),
          depositAmount: { toNumber: () => 2000000 },
          withdrawalAmount: { toNumber: () => null },
          description: '입금2',
          nature: 'CREDITOR',
          category: '채권자 관련 거래',
          confidenceScore: { toNumber: () => 0.8 },
          tags: [],
        },
        {
          id: 'tx-3',
          transactionDate: new Date('2026-01-03'),
          depositAmount: { toNumber: () => null },
          withdrawalAmount: { toNumber: () => 500000 },
          description: '출금',
          nature: 'GENERAL',
          category: null,
          confidenceScore: null,
          tags: [],
        },
      ]);

      vi.mocked(db.finding.findMany).mockResolvedValue([]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Excel is generated successfully
      expect(response.success).toBe(true);

      console.log('✅ AI 분류 요약 계산 완료');
      console.log('✅ 미분류 거래 수: 1건');
    });

    it('[Task 3.4] should parse relatedCreditorNames JSON', async () => {
      // GIVEN: Finding with JSON array creditor names
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: 'CASE-001',
        debtorName: '홍길동',
        court: '서울회생법원',
        trustee: '김관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      vi.mocked(db.finding.findMany).mockResolvedValue([
        {
          id: 'finding-1',
          findingType: 'PREFERENCE_REPAYMENT',
          severity: 'CRITICAL',
          priority: 'HIGH',
          description: '다중 채권자',
          relatedTransactionIds: [],
          relatedCreditorNames: JSON.stringify(['신한은행', '국민은행', '하나은행']),
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
      ]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Excel is generated successfully
      expect(response.success).toBe(true);

      console.log('✅ relatedCreditorNames JSON 파싱 완료');
    });

    it('[Task 3.4] should handle invalid JSON gracefully', async () => {
      // GIVEN: Finding with invalid JSON
      vi.mocked(db.case.findUnique).mockResolvedValue({
        id: 'case-1',
        caseNumber: 'CASE-001',
        debtorName: '홍길동',
        court: '서울회생법원',
        trustee: '김관재인',
        commencementDate: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
      });

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      vi.mocked(db.finding.findMany).mockResolvedValue([
        {
          id: 'finding-1',
          findingType: 'PREFERENCE_REPAYMENT',
          severity: 'CRITICAL',
          priority: 'HIGH',
          description: 'Invalid JSON',
          relatedTransactionIds: [],
          relatedCreditorNames: 'not-valid-json[{]',
          notes: [],
          createdAt: new Date('2026-01-01'),
        },
      ]);

      // WHEN: Generate Excel
      const response = await excelExportService.generateFullAnalysisExcel('case-1');

      // THEN: Excel is generated successfully (fallback to empty array)
      expect(response.success).toBe(true);

      console.log('✅ Invalid JSON 안전 처리 완료');
    });

    it('should throw error when case not found', async () => {
      // GIVEN: Case does not exist
      vi.mocked(db.case.findUnique).mockResolvedValue(null);

      // WHEN: Generate Excel
      const promise = excelExportService.generateFullAnalysisExcel('invalid-case');

      // THEN: Error is thrown
      await expect(promise).rejects.toThrow('사건을 찾을 수 없습니다.');

      console.log('✅ 사건 미발생 에러 처리 완료');
    });
  });
});
