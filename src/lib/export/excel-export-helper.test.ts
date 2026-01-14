/**
 * Excel Export Helper Tests (Epic 6 Retrospective P0 Action Item A2)
 *
 * Epic 5.6 CSV export 패턴 재사용 검증
 *
 * @module lib/export/excel-export-helper.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ExcelJS from 'exceljs';
import {
  workbookToDownloadResponse,
  createExcelFilename,
  triggerDownload,
  base64ToBlob,
  EXCEL_MIME_TYPE,
  type ExcelDownloadResponse,
} from './excel-export-helper';
import { createWorkbook, createWorksheetWithHeaders } from './excel';

// Mock document methods for browser environment
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
};

const mockCreateElement = vi.fn(() => mockLink as any);
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

describe('[P0] Epic 6 Retrospective - Action Item A2: Excel Export Helper', () => {
  describe('EXCEL_MIME_TYPE', () => {
    it('[P0] should have correct Excel MIME type', () => {
      // THEN: MIME type is .xlsx standard
      expect(EXCEL_MIME_TYPE).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('createExcelFilename', () => {
    it('[P0] should generate filename with prefix and date', () => {
      // GIVEN: Today's date (fixed for test)
      vi.useFakeTimers().setSystemTime(new Date('2026-01-13'));

      // WHEN: Creating filename without case number
      const filename = createExcelFilename('거래내역');

      // THEN: Filename format is "prefix_date.xlsx"
      expect(filename).toBe('거래내역_20260113.xlsx');

      vi.useRealTimers();
    });

    it('[P0] should include case number when provided', () => {
      // GIVEN: Fixed date
      vi.useFakeTimers().setSystemTime(new Date('2026-01-13'));

      // WHEN: Creating filename with case number
      const filename = createExcelFilename('거래내역', 'CASE-001');

      // THEN: Filename format is "prefix_caseNumber_date.xlsx"
      // Note: Hyphens are also sanitized to underscores for filesystem compatibility
      expect(filename).toBe('거래내역_CASE_001_20260113.xlsx');

      vi.useRealTimers();
    });

    it('[P0] should sanitize special characters in case number', () => {
      // GIVEN: Fixed date and case number with special characters
      vi.useFakeTimers().setSystemTime(new Date('2026-01-13'));

      // WHEN: Case number has spaces and special characters
      const filename = createExcelFilename('거래내역', 'CASE/001-Test #123');

      // THEN: Special characters are replaced with underscore
      expect(filename).toBe('거래내역_CASE_001_Test__123_20260113.xlsx');

      vi.useRealTimers();
    });

    it('[P0] should support Korean characters in filename', () => {
      // GIVEN: Fixed date and Korean prefix
      vi.useFakeTimers().setSystemTime(new Date('2026-01-13'));

      // WHEN: Creating filename with Korean text
      const filename = createExcelFilename('발견사항', '사건-001');

      // THEN: Korean characters are preserved
      expect(filename).toBe('발견사항_사건_001_20260113.xlsx');

      vi.useRealTimers();
    });
  });

  describe('workbookToDownloadResponse', () => {
    it('[P0] should convert workbook to Base64 encoded response', async () => {
      // GIVEN: A workbook with data
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, '테스트', ['ID', '값']);
      worksheet.addRow([1, '테스트 데이터']);

      // WHEN: Converting to download response
      const response = await workbookToDownloadResponse(workbook, 'test.xlsx');

      // THEN: Response structure matches Epic 5.6 pattern
      expect(response).toEqual({
        data: expect.any(String),
        filename: 'test.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      });

      // AND: Data is Base64 encoded string
      expect(response.data).toBeDefined();
      expect(response.data.length).toBeGreaterThan(0);

      // AND: Data is valid Base64 (only Base64 characters)
      expect(response.data).toMatch(/^[A-Za-z0-9+/]+=*$/);

      console.log(`✅ Base64 인코딩 길이: ${response.data.length}자`);
      console.log(`✅ Base64 앞부분: ${response.data.substring(0, 50)}...`);
    });

    it('[P0] should generate valid Base64 that can be decoded', async () => {
      // GIVEN: A workbook with known content
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, '테스트', ['메시지']);
      worksheet.addRow(['Hello, World!']);

      // WHEN: Converting to download response
      const response = await workbookToDownloadResponse(workbook, 'test.xlsx');

      // THEN: Base64 can be decoded back to Buffer
      const buffer = Buffer.from(response.data, 'base64');
      expect(buffer.length).toBeGreaterThan(0);

      console.log(`✅ 디코딩된 Buffer 크기: ${buffer.length} bytes`);
    });

    it('[P0] should preserve Korean text in Base64 encoding', async () => {
      // GIVEN: A workbook with Korean content
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, '한글', ['메시지']);
      worksheet.addRow(['안녕하세요!']);
      worksheet.addRow(['대출 실행금']);
      worksheet.addRow(['신한은행']);

      // WHEN: Converting to Base64
      const response = await workbookToDownloadResponse(workbook, 'korean.xlsx');

      // THEN: Base64 encoding is successful
      expect(response.data).toBeDefined();
      expect(response.success).toBe(true);

      // AND: Can be decoded back
      const buffer = Buffer.from(response.data, 'base64');
      expect(buffer.length).toBeGreaterThan(0);

      console.log(`✅ 한글 포함 Excel Base64 인코딩 성공`);
      console.log(`✅ 원본 데이터: 3행`);
      console.log(`✅ 인코딩 후 크기: ${buffer.length} bytes`);
    });

    it('[P0] should handle large workbooks efficiently', async () => {
      // GIVEN: A workbook with 1000 rows
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, '대용량', [
        'ID',
        '데이터',
      ]);

      for (let i = 0; i < 1000; i++) {
        worksheet.addRow([i + 1, `데이터 ${i + 1}`]);
      }

      // WHEN: Converting to Base64
      const startTime = Date.now();
      const response = await workbookToDownloadResponse(workbook, 'large.xlsx');
      const endTime = Date.now();

      // THEN: Conversion completes within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // 1초 이내

      // AND: Response is valid
      expect(response.success).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      console.log(`✅ 1000행 Base64 변환 시간: ${duration}ms`);
    });
  });

  describe('base64ToBlob', () => {
    it('[P0] should convert Base64 to Blob', () => {
      // GIVEN: Base64 encoded data
      const response: ExcelDownloadResponse = {
        data: Buffer.from('Hello, World!').toString('base64'),
        filename: 'test.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      };

      // WHEN: Converting to Blob
      const blob = base64ToBlob(response);

      // THEN: Blob is created with correct properties
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe(EXCEL_MIME_TYPE);
      expect(blob.size).toBe(13); // "Hello, World!" length

      console.log(`✅ Blob 크기: ${blob.size} bytes`);
      console.log(`✅ Blob MIME 타입: ${blob.type}`);
    });

    it('[P0] should convert Excel Base64 to Blob', () => {
      // GIVEN: Simple Excel data as Base64
      const excelData = Buffer.from('Excel test data').toString('base64');
      const response: ExcelDownloadResponse = {
        data: excelData,
        filename: 'excel.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      };

      // WHEN: Converting to Blob
      const blob = base64ToBlob(response);

      // THEN: Blob has correct MIME type
      expect(blob.type).toBe(EXCEL_MIME_TYPE);
      expect(blob.size).toBeGreaterThan(0);

      console.log(`✅ Excel → Base64 → Blob 변환 성공`);
    });
  });

  describe('triggerDownload (browser)', () => {
    let originalDocument: typeof document;

    beforeEach(() => {
      // Save original document
      originalDocument = global.document;

      // Mock document methods properly
      const mockBody = {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      };

      global.document = {
        body: mockBody as any,
        createElement: mockCreateElement as any,
      } as any;

      // Reset mocks
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Restore original document
      global.document = originalDocument;
    });

    it('[P0] should trigger download with data URL', () => {
      // GIVEN: Excel download response
      const response: ExcelDownloadResponse = {
        data: Buffer.from('test data').toString('base64'),
        filename: 'test.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      };

      // WHEN: Triggering download
      triggerDownload(response);

      // THEN: Creates link with data URL
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe(
        `data:${EXCEL_MIME_TYPE};base64,${response.data}`
      );
      expect(mockLink.download).toBe('test.xlsx');

      // AND: Clicks the link
      expect(mockLink.click).toHaveBeenCalled();

      // AND: Adds and removes from DOM
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();

      console.log(`✅ 다운로드 트리거 정상 동작 확인`);
    });

    it('[P0] should use correct MIME type for Excel files', () => {
      // GIVEN: Excel response
      const response: ExcelDownloadResponse = {
        data: 'dGVzdA==', // "test" in Base64
        filename: '엑셀파일.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      };

      // WHEN: Triggering download
      triggerDownload(response);

      // THEN: Uses Excel MIME type in data URL
      expect(mockLink.href).toContain(EXCEL_MIME_TYPE);
      expect(mockLink.href).toMatch(/^data:application\/vnd\.openxmlformats/);

      console.log(`✅ Excel MIME 타입 사용 확인`);
    });

    it('[P0] should handle Korean filenames', () => {
      // GIVEN: Response with Korean filename
      const response: ExcelDownloadResponse = {
        data: 'dGVzdA==',
        filename: '거래내역_20260113.xlsx',
        mimeType: EXCEL_MIME_TYPE,
        success: true,
      };

      // WHEN: Triggering download
      triggerDownload(response);

      // THEN: Korean filename is preserved
      expect(mockLink.download).toBe('거래내역_20260113.xlsx');

      console.log(`✅ 한글 파일명 지원 확인`);
    });
  });

  describe('[P0] Epic 5.6 Pattern Compliance', () => {
    it('[P0] should follow Epic 5.6 Base64 encoding pattern', async () => {
      // GIVEN: Workbook
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, 'Sheet1', ['Column1']);
      worksheet.addRow(['Data1']);

      // WHEN: Using Epic 5.6 pattern
      const response = await workbookToDownloadResponse(workbook, 'test.xlsx');

      // THEN: Follows Epic 5.6 structure exactly
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('filename');
      expect(response).toHaveProperty('mimeType');
      expect(response).toHaveProperty('success');
      expect(response.success).toBe(true);

      // AND: Data is Base64 string (not Buffer)
      expect(typeof response.data).toBe('string');
      expect(response.data).not.toBeInstanceOf(Buffer);

      console.log(`✅ Epic 5.6 Base64 패턴 준수 완료`);
    });

    it('[P0] should support tRPC JSON serialization', async () => {
      // GIVEN: Large workbook
      const workbook = createWorkbook();
      const worksheet = createWorksheetWithHeaders(workbook, 'Sheet1', ['Data']);
      for (let i = 0; i < 100; i++) {
        worksheet.addRow([`Row ${i}`]);
      }

      // WHEN: Converting to response (JSON-serializable)
      const response = await workbookToDownloadResponse(workbook, 'test.xlsx');

      // THEN: Response is JSON-serializable (no Buffer, no circular refs)
      const json = JSON.stringify(response);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);

      // AND: Can be parsed back
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(response);

      console.log(`✅ tRPC JSON 직렬화 호환성 확인`);
      console.log(`✅ JSON 크기: ${json.length} bytes`);
    });
  });
});
