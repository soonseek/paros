/**
 * Excel Export Utility (Story 5.6: 추적 결과 내보내기)
 *
 * 자금 흐름 추적 결과를 엑셀 형식으로 내보내기 위한 유틸리티
 *
 * @module lib/export/excel
 */

import ExcelJS from 'exceljs';

/**
 * 셀 스타일 인터페이스 (Story 5.6, Task 5)
 */
export interface CellStyle {
  font?: {
    bold?: boolean;
    size?: number;
    name?: string;
    color?: { argb: string };
  };
  fill?: {
    type: 'pattern';
    pattern: 'solid';
    fgColor?: { argb: string };
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle' | 'bottom';
    wrapText?: boolean;
  };
  border?: {
    top?: { style: 'thin' | 'medium' | 'thin'; color?: { argb: string } };
    left?: { style: 'thin' | 'medium' | 'thin'; color?: { argb: string } };
    bottom?: { style: 'thin' | 'medium' | 'thin'; color?: { argb: string } };
    right?: { style: 'thin' | 'medium' | 'thin'; color?: { argb: string } };
  };
  numFmt?: string;
}

/**
 * 헤더 스타일 (Story 5.6, AC5)
 * - 굵게, 크기 12, 파란색 배경, 흰색 글자
 */
export const HEADER_STYLE: CellStyle = {
  font: { bold: true, size: 12, name: 'Malgun Gothic', color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }, // blue-600
  },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  },
};

/**
 * 데이터 셀 스타일 (Story 5.6, AC5)
 * - 보통, 크기 10, 테두리
 */
export const DATA_STYLE: CellStyle = {
  font: { size: 10, name: 'Malgun Gothic' },
  alignment: { vertical: 'middle', wrapText: true },
  border: {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  },
};

/**
 * 숫자 서식 (Story 5.6, AC5)
 * - 천 단위 구분 기호, "원" 단위
 */
export const CURRENCY_FORMAT = '#,##0"원"';

/**
 * 날짜 서식 (Story 5.6, AC5)
 * - "yyyy-mm-dd" 형식
 */
export const DATE_FORMAT = 'yyyy-mm-dd';

/**
 * 거래 행 데이터 인터페이스 (Story 5.6, Task 2.2)
 */
export interface TransactionRow {
  체인ID: string;
  거래ID: string;
  날짜: Date;
  입금액: number | null;
  출금액: number | null;
  메모: string;
  태그: string;
  거래성격: string;
  신뢰도: string;
}

/**
 * 체인 행 데이터 인터페이스 (Story 5.6, Task 2.2)
 */
export interface ChainRow {
  체인ID: string;
  체인유형: string;
  깊이: number;
  시작거래날짜: Date;
  종료거래날짜: Date;
  신뢰도: string;
  관련거래수: number;
}

/**
 * 엑셀 워크북 생성 헬퍼 함수 (Story 5.6, Task 1.2)
 *
 * @returns ExcelJS Workbook 인스턴스
 */
export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'paros BMad System';
  workbook.created = new Date();
  return workbook;
}

/**
 * 워크시트 생성 및 헤더 스타일 적용 (Story 5.6, Task 1.2)
 *
 * @param workbook - 엑셀 워크북
 * @param sheetName - 시트 이름
 * @param headers - 헤더 열 목록
 * @returns ExcelJS Worksheet 인스턴스
 */
export function createWorksheetWithHeaders(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  // 헤더 행 추가
  worksheet.addRow(headers);

  // 헤더 스타일 적용
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.style = HEADER_STYLE;
  });

  // 컬럼 너비 설정
  headers.forEach((_, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = 15; // 기본 너비
  });

  return worksheet;
}

/**
 * 데이터 행 추가 (Story 5.6, Task 1.2)
 *
 * @param worksheet - 워크시트
 * @param data - 데이터 배열
 * @param styles - 셀 스타일 배열 (선택사항)
 */
export function addDataRow<T>(
  worksheet: ExcelJS.Worksheet,
  data: T[],
  styles?: Partial<CellStyle>[]
): void {
  data.forEach((item) => {
    const row = worksheet.addRow(Object.values(item as Record<string, unknown>));

    // 데이터 스타일 적용
    row.eachCell((cell, colNumber) => {
      const baseStyle = DATA_STYLE;
      const customStyle = styles?.[colNumber - 1];

      // 날짜 형식 처리
      if (cell.value instanceof Date) {
        cell.numFmt = DATE_FORMAT;
      }

      // 금액 형식 처리 (입금액, 출금액 열)
      const header = worksheet.getRow(1).getCell(colNumber).text;
      if (header === '입금액' || header === '출금액') {
        const amount = cell.value as number;
        if (amount !== null && amount !== undefined && !isNaN(amount)) {
          cell.numFmt = CURRENCY_FORMAT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.value = '';
        }
      }

      cell.style = { ...baseStyle, ...customStyle };
    });
  });
}

/**
 * 컬럼 너비 자동 조정 (Story 5.6, Task 1.2)
 *
 * @param worksheet - 워크시트
 */
export function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;

    if (column.eachCell) {
      column.eachCell({ includeEmpty: true }, (cell) => {
        const text = cell.text ?? '';
        const length = text.length;
        if (length > maxLength) {
          maxLength = length;
        }
      });
    }

    // 최소 10, 최대 50 너비
    const width = Math.min(Math.max(maxLength + 2, 10), 50);
    column.width = width;
  });
}

/**
 * 엑셀 파일을 Buffer로 변환 (Story 5.6, Task 2.3)
 *
 * @param workbook - 엑셀 워크북
 * @returns Excel 파일 Buffer
 */
export async function writeExcelBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

/**
 * 날짜를 "yyyy-mm-dd" 문자열로 변환 (Story 5.6, AC5)
 *
 * @param date - 날짜 객체
 * @returns 포맷된 날짜 문자열
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 금액을 천 단위 구분 기호로 변환 (Story 5.6, AC5)
 *
 * @param amount - 금액
 * @returns 포맷된 금액 문자열
 */
export function formatAmount(amount: number | null): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * 태그 배열을 쉼표로 구분된 문자열로 변환 (Story 5.6, Task 2.2)
 *
 * @param tags - 태그 배열
 * @returns 쉼표로 구분된 태그 문자열
 */
export function formatTags(tags: { tag: { name: string } }[] | undefined): string {
  if (!tags || tags.length === 0) {
    return '';
  }
  return tags.map((t) => t.tag.name).join(', ');
}

/**
 * 거래 성격을 한국어로 변환 (Story 5.6, Task 2.2)
 *
 * @param nature - 거래 성격
 * @returns 한국어 거래 성격
 */
export function formatTransactionNature(nature: string | null): string {
  const natureMap: Record<string, string> = {
    CREDITOR: '채권자 관련',
    COLLATERAL: '담보 관련',
    PRIORITY_REPAYMENT: '우선 변제',
    GENERAL: '일반',
  };

  if (!nature) {
    return '';
  }

  return natureMap[nature] ?? nature;
}

/**
 * 신뢰도 점수를 백분율로 변환 (Story 5.6, Task 2.2)
 *
 * @param confidence - 신뢰도 점수 (0-1)
 * @returns 백분율 문자열
 */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined || isNaN(confidence)) {
    return '';
  }
  return `${Math.round(confidence * 100)}%`;
}
