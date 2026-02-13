/**
 * Excel Export Service (Story 7.1, Task 3)
 *
 * 전체 분석 결과를 Excel 파일로 생성하는 서비스
 *
 * @module server/services/excel-export-service
 */

import ExcelJS from 'exceljs';
import { db } from '~/server/db';
import {
  createWorkbook,
  createWorksheetWithHeaders,
  addDataRow,
  autoFitColumns,
  writeExcelBuffer,
  formatTags,
  formatTransactionNature,
  formatConfidence,
} from '~/lib/export/excel';
import {
  workbookToDownloadResponse,
  createExcelFilename,
} from '~/lib/export/excel-export-helper';

/**
 * Excel Export Service
 */
export class ExcelExportService {
  /**
   * 전체 분석 결과 Excel 파일 생성 (Story 7.1, AC2)
   *
   * 4개 시트 포함:
   * 1. 사건 기본 정보
   * 2. 거래 내역
   * 3. 발견사항
   * 4. AI 분류 요약
   *
   * @param caseId - 사건 ID
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   */
  async generateFullAnalysisExcel(caseId: string) {
    // 1. 사건 기본 정보 조회 (Task 2.3)
    const caseData = await db.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        courtName: true,
        filingDate: true,
        createdAt: true,
      },
    });

    if (!caseData) {
      throw new Error('사건을 찾을 수 없습니다.');
    }

    // 2. 거래 내역 조회 (Task 2.4)
    const transactions = await db.transaction.findMany({
      where: { caseId },
      include: {
        tags: {
          include: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // 3. 발견사항 조회 (Task 2.5)
    const findings = await db.finding.findMany({
      where: { caseId },
      include: {
        notes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. 워크북 생성 (Task 3.1)
    const workbook = createWorkbook();

    // 5. 사건 기본 정보 시트 생성 (Task 3.2)
    this.createCaseInfoSheet(workbook, caseData);

    // 6. 거래 내역 시트 생성 (Task 3.3)
    this.createTransactionsSheet(workbook, transactions);

    // 7. 발견사항 시트 생성 (Task 3.4)
    this.createFindingsSheet(workbook, findings);

    // 8. AI 분류 요약 시트 생성 (Task 3.5)
    this.createAISummarySheet(workbook, transactions);

    // 9. Buffer → Base64 변환 (Task 4.1)
    const response = await workbookToDownloadResponse(
      workbook,
      createExcelFilename('분석결과', caseData.caseNumber)
    );

    return response;
  }

  /**
   * 사건 기본 정보 시트 생성 (Task 3.2)
   *
   * Story 7.1, AC2: 사건번호, 채무자명, 법원, 접수일, 분석일
   */
  private createCaseInfoSheet(
    workbook: ExcelJS.Workbook,
    caseData: {
      caseNumber: string;
      debtorName: string;
      courtName: string | null;
      filingDate: Date | null;
      createdAt: Date;
    }
  ) {
    const worksheet = createWorksheetWithHeaders(workbook, '사건 기본 정보', [
      '항목',
      '값',
    ]);

    const caseInfo = [
      { 항목: '사건번호', 값: caseData.caseNumber },
      { 항목: '채무자명', 값: caseData.debtorName },
      { 항목: '법원', 값: caseData.courtName ?? '' },
      {
        항목: '접수일',
        값: caseData.filingDate ? caseData.filingDate.toISOString().split('T')[0] : '',
      },
      { 항목: '분석일', 값: new Date().toISOString().split('T')[0] },
    ];

    addDataRow(worksheet, caseInfo);
  }

  /**
   * 거래 내역 시트 생성 (Task 3.3)
   *
   * Story 7.1, AC2: 모든 거래 (날짜, 입금액, 출금액, 메모, 태그, AI 분류, 거래 성격, 신뢰도)
   */
  private createTransactionsSheet(
    workbook: ExcelJS.Workbook,
    transactions: Array<{
      id: string;
      transactionDate: Date;
      depositAmount: { toNumber: () => number } | null;
      withdrawalAmount: { toNumber: () => number } | null;
      memo: string | null;
      transactionNature: string | null;
      category: string | null;
      confidenceScore: number | null;
      tags: Array<{ tag: { name: string } }>;
    }>
  ) {
    const worksheet = createWorksheetWithHeaders(workbook, '거래 내역', [
      '거래ID',
      '날짜',
      '입금액',
      '출금액',
      '메모',
      '태그',
      'AI 분류',
      '거래 성격',
      '신뢰도',
    ]);

    const transactionRows = transactions.map((t) => ({
      거래ID: t.id,
      날짜: t.transactionDate,
      입금액: t.depositAmount?.toNumber() ?? null,
      출금액: t.withdrawalAmount?.toNumber() ?? null,
      메모: t.memo ?? '',
      태그: formatTags(t.tags),
      AI_분류: t.category ?? '',
      거래성격: formatTransactionNature(t.transactionNature),
      신뢰도: t.confidenceScore ?? null,
    }));

    addDataRow(worksheet, transactionRows);
    autoFitColumns(worksheet);
  }

  /**
   * 발견사항 시트 생성 (Task 3.4)
   *
   * Story 7.1, AC2: 발견사항 ID, 유형, 중요도(severity), 중요도(priority), 설명,
   *                 관련 거래 ID, 관련 채권자명, 사용자 메모, 생성일시
   *
   * AC5: severity별 색상 적용
   * - CRITICAL: 빨간색 배경 (FFFFCCCC)
   * - WARNING: 노란색 배경 (FFFFFFCC)
   * - INFO: 주황색 배경 (FFFFE5CC)
   */
  private createFindingsSheet(
    workbook: ExcelJS.Workbook,
    findings: Array<{
      id: string;
      findingType: string;
      severity: string;
      priority: string | null;
      description: string | null;
      relatedTransactionIds: string[];
      relatedCreditorNames: string | null;
      notes: Array<{ content: string }>;
      createdAt: Date;
    }>
  ) {
    const worksheet = createWorksheetWithHeaders(workbook, '발견사항', [
      '발견사항ID',
      '유형',
      '중요도(Severity)',
      '중요도(Priority)',
      '설명',
      '관련 거래 ID',
      '관련 채권자명',
      '사용자 메모',
      '생성일시',
    ]);

    // severity별 색상 (AC5)
    const severityColors: Record<string, string> = {
      CRITICAL: 'FFFFCCCC', // 빨간색
      WARNING: 'FFFFFFCC', // 노란색
      INFO: 'FFFFE5CC', // 주황색
    };

    findings.forEach((finding) => {
      const row = worksheet.addRow([
        finding.id,
        finding.findingType,
        finding.severity,
        finding.priority ?? '',
        finding.description ?? '',
        finding.relatedTransactionIds.join(', '),
        this.parseCreditorNames(finding.relatedCreditorNames).join(', '),
        finding.notes.map((n) => n.content).join('; '),
        finding.createdAt,
      ]);

      // severity별 색상 적용 (AC5)
      const color = severityColors[finding.severity];
      if (color) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
      }
    });

    autoFitColumns(worksheet);
  }

  /**
   * AI 분류 요약 시트 생성 (Task 3.5)
   *
   * Story 7.1, AC2: AI 분류 유형별 건수, 신뢰도 평균, 미분류 거래 수
   */
  private createAISummarySheet(
    workbook: ExcelJS.Workbook,
    transactions: Array<{
      category: string | null;
      confidenceScore: number | null;
    }>
  ) {
    const worksheet = createWorksheetWithHeaders(workbook, 'AI 분류 요약', [
      'AI 분류 유형',
      '건수',
      '신뢰도 평균',
    ]);

    // category별 그룹화
    const categoryMap = new Map<
      string,
      { count: number; totalConfidence: number }
    >();

    let unclassifiedCount = 0;

    transactions.forEach((t) => {
      if (t.category) {
        const current = categoryMap.get(t.category) ?? {
          count: 0,
          totalConfidence: 0,
        };
        current.count += 1;
        if (t.confidenceScore) {
          current.totalConfidence += t.confidenceScore;
        }
        categoryMap.set(t.category, current);
      } else {
        unclassifiedCount += 1;
      }
    });

    // 데이터 행 생성
    const summaryRows = Array.from(categoryMap.entries()).map(
      ([category, data]) => ({
        'AI 분류 유형': category,
        건수: data.count,
        신뢰도_평균: data.count > 0 ? data.totalConfidence / data.count : 0,
      })
    );

    addDataRow(worksheet, summaryRows);

    // 마지막 행: 미분류 거래 수
    if (unclassifiedCount > 0) {
      const row = worksheet.addRow(['미분류', unclassifiedCount, '']);
      // 하이라이트
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // 회색 배경
      };
    }

    autoFitColumns(worksheet);
  }

  /**
   * relatedCreditorNames JSON 파싱 (Epic 6.4 패턴 재사용)
   *
   * @param jsonStr - JSON 배열 문자열
   * @returns 채권자명 배열
   */
  private parseCreditorNames(jsonStr: string | null): string[] {
    if (!jsonStr) {
      return [];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * 선택된 거래들 Excel 파일 생성 (Story 7.2, Task 4.1)
   *
   * Story 7.2 AC1: 선택된 거래들만 포함된 단일 시트 엑셀 파일 생성
   * Story 7.2 AC3: 선택된 컬럼만 포함 (동적 컬럼 생성)
   * Story 7.1 AI 리뷰 이슈 반영:
   *   - MEDIUM #2: N+1 쿼리 최적화 (select 사용)
   *   - LOW #4: 파일 크기 검증 (최대 10MB)
   *
   * @param caseId - 사건 ID
   * @param transactionIds - 선택된 거래 ID 목록
   * @param selectedColumns - 포함할 선택적 컬럼 목록
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   */
  async generateSelectedTransactionsExcel(
    caseId: string,
    transactionIds: string[],
    selectedColumns?: string[]
  ) {
    // Story 7.1 AI 리뷰 LOW #4: 파일 크기 사전 검증
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_TRANSACTIONS = 1000; // Dev Notes: 선택 내보내기 최대 1,000거래

    if (transactionIds.length > MAX_TRANSACTIONS) {
      throw new Error(
        `최대 ${MAX_TRANSACTIONS.toLocaleString()}건까지만 내보낼 수 있습니다.`
      );
    }

    // Story 7.1 AI 리뷰 MEDIUM #2: N+1 쿼리 최적화
    // 필요한 필드만 select로 가져오기 (중복 제거)
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        caseId,
      },
      select: {
        id: true,
        transactionDate: true,
        depositAmount: true,
        withdrawalAmount: true,
        // 선택적 컬럼만 조건부 포함
        ...(selectedColumns?.includes('메모') && { description: true }),
        ...(selectedColumns?.includes('태그') && {
          tags: {
            select: {
              tag: {
                select: {
                  name: true,
                },
              },
            },
          },
        }),
        ...(selectedColumns?.includes('AI 분류') && { category: true }),
        ...(selectedColumns?.includes('거래 성격') && { nature: true }),
        ...(selectedColumns?.includes('신뢰도') && { confidenceScore: true }),
      },
      orderBy: { transactionDate: 'asc' },
    });

    if (transactions.length === 0) {
      throw new Error('선택된 거래가 없습니다. 거래를 선택 후 다시 시도해주세요.');
    }

    // 워크북 생성
    const workbook = createWorkbook();

    // 동적 헤더 생성 (Task 4.3)
    const headers = this.buildDynamicHeaders(selectedColumns);
    const worksheet = createWorksheetWithHeaders(workbook, '선택된 거래 내역', headers);

    // 데이터 행 생성
    transactions.forEach((t: any) => {
      const row: any = {
        거래ID: t.id,
        날짜: t.transactionDate,
        입금액: t.depositAmount?.toNumber() ?? null,
        출금액: t.withdrawalAmount?.toNumber() ?? null,
      };

      // 선택적 컬럼 추가
      if (selectedColumns?.includes('메모')) {
        row.메모 = t.description ?? '';
      }

      if (selectedColumns?.includes('태그')) {
        row.태그 = formatTags(t.tags ?? []);
      }

      if (selectedColumns?.includes('AI 분류')) {
        row.AI_분류 = t.category ?? '';
      }

      if (selectedColumns?.includes('거래 성격')) {
        row.거래성격 = formatTransactionNature(t.nature);
      }

      if (selectedColumns?.includes('신뢰도')) {
        row.신뢰도 = t.confidenceScore?.toNumber() ?? null;
      }

      worksheet.addRow(row);
    });

    autoFitColumns(worksheet);

    // Buffer → Base64 변환
    const caseData = await db.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    });

    if (!caseData) {
      throw new Error('사건을 찾을 수 없습니다.');
    }

    const response = await workbookToDownloadResponse(
      workbook,
      createExcelFilename(`선택거래_${transactions.length}개`, caseData.caseNumber)
    );

    // Story 7.1 AI 리뷰 LOW #4: 생성된 파일 크기 검증
    const binaryString = atob(response.data);
    const fileSize = binaryString.length;

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `파일 크기가 너무 큽니다 (${(fileSize / 1024 / 1024).toFixed(2)}MB). ` +
        `최대 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB까지 지원합니다.`
      );
    }

    return response;
  }

  /**
   * 필터링된 거래들 Excel 파일 생성 (Story 7.2, Task 4.2)
   *
   * Story 7.2 AC2: 필터링된 거래들 + 필터 설명 주석 포함
   * Story 7.2 AC3: 선택된 컬럼만 포함 (동적 컬럼 생성)
   * Story 7.1 AI 리뷰 이슈 반영:
   *   - MEDIUM #2: N+1 쿼리 최적화 (select 사용)
   *   - LOW #4: 파일 크기 검증 (최대 10MB)
   *
   * @param caseId - 사건 ID
   * @param filters - 필터 조건
   * @param selectedColumns - 포함할 선택적 컬럼 목록
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   */
  async generateFilteredTransactionsExcel(
    caseId: string,
    filters: {
      dateRange?: { from?: string; to?: string };
      amountRange?: { min?: number; max?: number };
      category?: string;
      tags?: string[];
    },
    selectedColumns?: string[]
  ) {
    // Story 7.1 AI 리뷰 LOW #4: 파일 크기 사전 검증
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_TRANSACTIONS = 5000; // Dev Notes: 필터 내보내기 최대 5,000거래

    // Prisma where 조건 빌드
    const where: any = { caseId };

    if (filters.dateRange?.from || filters.dateRange?.to) {
      where.transactionDate = {};
      if (filters.dateRange.from) {
        where.transactionDate.gte = new Date(filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        where.transactionDate.lte = new Date(filters.dateRange.to);
      }
    }

    if (filters.amountRange?.min !== undefined || filters.amountRange?.max !== undefined) {
      where.OR = [
        { depositAmount: {} },
        { withdrawalAmount: {} },
      ];

      if (filters.amountRange.min !== undefined) {
        where.OR[0].depositAmount.gte = filters.amountRange.min;
        where.OR[1].withdrawalAmount.gte = filters.amountRange.min;
      }

      if (filters.amountRange.max !== undefined) {
        where.OR[0].depositAmount.lte = filters.amountRange.max;
        where.OR[1].withdrawalAmount.lte = filters.amountRange.max;
      }
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: filters.tags },
          },
        },
      };
    }

    // Story 7.1 AI 리뷰 MEDIUM #2: N+1 쿼리 최적화
    // Story 7.1 AI 리뷰 MEDIUM #2: N+1 쿼리 최적화
    // 필요한 필드만 select로 가져오기 (중복 제거)
    const transactions = await db.transaction.findMany({
      where,
      select: {
        id: true,
        transactionDate: true,
        depositAmount: true,
        withdrawalAmount: true,
        // 선택적 컬럼만 조건부 포함
        ...(selectedColumns?.includes('메모') && { description: true }),
        ...(selectedColumns?.includes('태그') && {
          tags: {
            select: {
              tag: {
                select: {
                  name: true,
                },
              },
            },
          },
        }),
        ...(selectedColumns?.includes('AI 분류') && { category: true }),
        ...(selectedColumns?.includes('거래 성격') && { nature: true }),
        ...(selectedColumns?.includes('신뢰도') && { confidenceScore: true }),
      },
      orderBy: { transactionDate: 'asc' },
      take: MAX_TRANSACTIONS + 1, // +1 to check if exceeds limit
    });

    if (transactions.length > MAX_TRANSACTIONS) {
      throw new Error(
        `필터 결과가 너무 많습니다 (${transactions.length.toLocaleString()}건). ` +
        `최대 ${MAX_TRANSACTIONS.toLocaleString()}건까지만 내보낼 수 있습니다. ` +
        `필터 조건을 좁혀주세요.`
      );
    }

    if (transactions.length === 0) {
      throw new Error('필터링된 거래가 없습니다. 필터 조건을 변경 후 다시 시도해주세요.');
    }

    // 워크북 생성
    const workbook = createWorkbook();

    // 동적 헤더 생성 (Task 4.3)
    const headers = this.buildDynamicHeaders(selectedColumns);
    const worksheet = createWorksheetWithHeaders(workbook, '필터링된 거래 내역', headers);

    // Story 7.2 AC2: 필터 설명 주석 추가
    const filterComment = this.buildFilterComment(filters);
    const commentRow = worksheet.addRow([{ comment: filterComment }]);
    commentRow.font = { italic: true, color: { argb: 'FF666666' } };
    worksheet.addRow([]); // 빈 행 추가

    // 데이터 행 생성
    transactions.forEach((t: any) => {
      const row: any = {
        거래ID: t.id,
        날짜: t.transactionDate,
        입금액: t.depositAmount?.toNumber() ?? null,
        출금액: t.withdrawalAmount?.toNumber() ?? null,
      };

      // 선택적 컬럼 추가
      if (selectedColumns?.includes('메모')) {
        row.메모 = t.description ?? '';
      }

      if (selectedColumns?.includes('태그')) {
        row.태그 = formatTags(t.tags ?? []);
      }

      if (selectedColumns?.includes('AI 분류')) {
        row.AI_분류 = t.category ?? '';
      }

      if (selectedColumns?.includes('거래 성격')) {
        row.거래성격 = formatTransactionNature(t.nature);
      }

      if (selectedColumns?.includes('신뢰도')) {
        row.신뢰도 = t.confidenceScore?.toNumber() ?? null;
      }

      worksheet.addRow(row);
    });

    autoFitColumns(worksheet);

    // Buffer → Base64 변환
    const caseData = await db.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    });

    if (!caseData) {
      throw new Error('사건을 찾을 수 없습니다.');
    }

    const response = await workbookToDownloadResponse(
      workbook,
      createExcelFilename(`필터결과_${transactions.length}개`, caseData.caseNumber)
    );

    // Story 7.1 AI 리뷰 LOW #4: 생성된 파일 크기 검증
    const binaryString = atob(response.data);
    const fileSize = binaryString.length;

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `파일 크기가 너무 큽니다 (${(fileSize / 1024 / 1024).toFixed(2)}MB). ` +
        `최대 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB까지 지원합니다.`
      );
    }

    return response;
  }

  /**
   * 동적 헤더 빌더 (Task 4.3)
   *
   * @param selectedColumns - 선택된 컬럼 목록
   * @returns 엑셀 헤더 배열
   */
  private buildDynamicHeaders(selectedColumns?: string[]): string[] {
    // 기본 컬럼 (항상 포함)
    const headers = ['거래ID', '날짜', '입금액', '출금액'];

    // 선택적 컬럼 추가
    if (selectedColumns?.includes('메모')) {
      headers.push('메모');
    }

    if (selectedColumns?.includes('태그')) {
      headers.push('태그');
    }

    if (selectedColumns?.includes('AI 분류')) {
      headers.push('AI 분류');
    }

    if (selectedColumns?.includes('거래 성격')) {
      headers.push('거래 성격');
    }

    if (selectedColumns?.includes('신뢰도')) {
      headers.push('신뢰도');
    }

    return headers;
  }

  /**
   * 필터 설명 빌더 (Story 7.2 AC2)
   *
   * @param filters - 필터 조건
   * @returns 필터 설명 문자열
   */
  private buildFilterComment(filters: {
    dateRange?: { from?: string; to?: string };
    amountRange?: { min?: number; max?: number };
    category?: string;
    tags?: string[];
  }): string {
    const parts: string[] = [];

    if (filters.dateRange?.from || filters.dateRange?.to) {
      const from = filters.dateRange.from ?? '시작일 미지정';
      const to = filters.dateRange.to ?? '종료일 미지정';
      parts.push(`날짜(${from}~${to})`);
    }

    if (filters.amountRange?.min !== undefined || filters.amountRange?.max !== undefined) {
      const min = filters.amountRange.min ?? '0';
      const max = filters.amountRange.max ?? '무제한';
      parts.push(`금액(${min}~${max})`);
    }

    if (filters.category) {
      parts.push(`카테고리(${filters.category})`);
    }

    if (filters.tags && filters.tags.length > 0) {
      parts.push(`태그(${filters.tags.join(', ')})`);
    }

    // AC2: 한 줄 형식으로 변경
    return parts.length > 0 ? `# 필터: ${parts.join(', ')}` : '';
  }

  /**
   * 발견사항 목록 Excel 파일 생성 (Story 7.3, Task 3.1)
   *
   * Story 7.3 AC1: 발견사항 엑셀 생성
   * Story 7.3 AC2: 발견사항 데이터 포함 (모든 필드)
   * Story 7.3 AC3: severity별 색상 적용
   * Story 7.3 AC5: 필터 및 정렬 옵션 지원
   *
   * @param caseId - 사건 ID
   * @param filters - 필터 옵션 (선택사항)
   * @param sortBy - 정렬 순서 (기본값: "priority-severity-date")
   * @returns Excel 다운로드 응답 (Base64 인코딩)
   */
  async generateFindingsExcel(
    caseId: string,
    filters?: {
      isResolved?: boolean;
      severity?: 'CRITICAL' | 'WARNING' | 'INFO';
      priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    },
    sortBy: 'priority-severity-date' | 'severity-date' | 'date' = 'priority-severity-date'
  ) {
    // Story 7.3, Task 7.2: 파일 크기 검증 (최대 1,000개 Finding)
    const MAX_FINDINGS = 1000;

    // Story 7.3, Task 2.3: Finding 조회 (Epic 6 패턴 재사용)
    let findings = await db.finding.findMany({
      where: {
        caseId,
        ...(filters?.isResolved !== undefined && { isResolved: filters.isResolved }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.priority && { priority: filters.priority }),
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: this.buildSorting(sortBy),
    });

    // Story 7.3, Task 5.1: In-memory sorting for priority-severity-date (Epic 6.5 패턴 재사용)
    if (sortBy === 'priority-severity-date') {
      findings = this.sortFindingsByPriority(findings);
    }

    // Story 7.3, Task 7.2: 파일 크기 검증
    if (findings.length > MAX_FINDINGS) {
      throw new Error(
        `최대 ${MAX_FINDINGS.toLocaleString()}개 발견사항까지만 내보낼 수 있습니다.`
      );
    }

    if (findings.length === 0) {
      throw new Error('내보낼 발견사항이 없습니다.');
    }

    // 워크북 생성
    const workbook = createWorkbook();

    // Story 7.3, Task 3.2: 발견사항 시트 생성
    this.createFindingsExportSheet(workbook, findings);

    // Story 7.3, Task 4.1: 파일명 생성
    const caseData = await db.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    });

    if (!caseData) {
      throw new Error('사건을 찾을 수 없습니다.');
    }

    const response = await workbookToDownloadResponse(
      workbook,
      createExcelFilename('발견사항', caseData.caseNumber)
    );

    return response;
  }

  /**
   * 발견사항 내보내기 전용 시트 생성 (Story 7.3, Task 3.2)
   *
   * Story 7.3 AC2: 모든 필드 포함
   * Story 7.3 AC3: severity별 색상 적용
   * Story 7.3 Task 3.4: FindingType i18n
   * Story 7.3 Task 3.5: JSON 파싱 (relatedCreditorNames)
   * Story 7.3 Task 3.6: FindingNote 합치기
   */
  private createFindingsExportSheet(
    workbook: ExcelJS.Workbook,
    findings: Array<{
      id: string;
      findingType: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
      description: string | null;
      relatedTransactionIds: string[];
      relatedCreditorNames: string | null;
      isResolved: boolean;
      notes: Array<{ content: string }>;
      createdAt: Date;
    }>
  ) {
    // Story 7.3, Task 3.2: 헤더 정의
    const worksheet = createWorksheetWithHeaders(workbook, '발견사항', [
      '발견사항ID',
      '유형',
      'Severity',
      'Priority',
      '설명',
      '관련 거래 ID',
      '관련 채권자명',
      '해결 여부',
      '사용자 메모',
      '생성일시',
    ]);

    // Story 7.3, Task 3.3: severity별 색상 (Epic 6.2 FindingCard 패턴 재사용)
    const severityColors: Record<string, string> = {
      CRITICAL: 'FFFFCCCC', // 빨간색 배경 (red-600)
      WARNING: 'FFFFFFCC', // 노란색 배경 (amber-600)
      INFO: 'FFFFE5CC', // 주황색 배경 (orange-600)
    };

    // Story 7.3, Task 3.3: 해결된 발견사항 색상 (60% 투명도)
    const resolvedColors: Record<string, string> = {
      CRITICAL: 'FFFEEEEE', // 매우 밝은 빨간색
      WARNING: 'FFFFFEEE', // 매우 밝은 노란색
      INFO: 'FFFFFAAA', // 매우 밝은 주황색
    };

    // Story 7.3, Task 3.4: FindingType i18n 매핑
    const FINDING_TYPE_LABELS: Record<string, string> = {
      PREFERENCE_REPAYMENT: '선의성/악의성',
      PRIORITY_REPAYMENT_VIOLATION: '우선변제권 침해',
      COLLATERAL_TIMING_ISSUE: '담보권 타이밍 이슈',
      COLLATERAL_DUPLICATE: '담보권 중복',
      COLLATERAL_DISCHARGE: '담보권 해지',
      IMPORTANT_TRANSACTION: '중요 거래',
    };

    findings.forEach((finding) => {
      const row = worksheet.addRow([
        finding.id,
        // Story 7.3, Task 3.4: FindingType i18n
        FINDING_TYPE_LABELS[finding.findingType] ?? finding.findingType,
        finding.severity,
        finding.priority ?? '',
        finding.description ?? '',
        // Story 7.3, Task 3.5: relatedTransactionIds 쉼표로 구분
        finding.relatedTransactionIds.join(', '),
        // Story 7.3, Task 3.5: JSON 파싱 (Epic 6.4 패턴 재사용)
        this.parseCreditorNames(finding.relatedCreditorNames).join(', '),
        finding.isResolved ? '해결' : '미해결',
        // Story 7.3, Task 3.6: FindingNote 합치기 (쉼표+공백으로 구분)
        finding.notes.map((n) => n.content).join(', '),
        finding.createdAt,
      ]);

      // Story 7.3, Task 3.3: severity별 색상 적용
      const backgroundColor = finding.isResolved
        ? resolvedColors[finding.severity]
        : severityColors[finding.severity];

      if (backgroundColor) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: backgroundColor },
        };
      }

      // 날짜 형식 적용
      const dateCell = row.getCell(10); // 생성일시 열
      if (dateCell.value instanceof Date) {
        dateCell.numFmt = 'yyyy-mm-dd hh:mm:ss';
      }
    });

    autoFitColumns(worksheet);
  }

  /**
   * 정렬 빌더 (Story 7.3, Task 5)
   *
   * Story 7.3, Task 5.1: Priority → Severity → createdAt
   * Story 7.3, Task 5.2: Severity → createdAt
   * Story 7.3, Task 5.3: createdAt만
   */
  private buildSorting(sortBy: 'priority-severity-date' | 'severity-date' | 'date') {
    // Epic 6.5 패턴 재사용 (Prisma orderBy)
    switch (sortBy) {
      case 'priority-severity-date':
        // In-memory sorting 적용 (Task 5.1)
        return [{ createdAt: 'desc' } as const];

      case 'severity-date':
        return [{ severity: 'asc' }, { createdAt: 'desc' }] as const;

      case 'date':
        return [{ createdAt: 'desc' }] as const;

      default:
        return [{ createdAt: 'desc' }] as const;
    }
  }

  /**
   * 다중 기준 정렬 (Story 7.3, Task 5.1)
   *
   * Epic 6.5 패턴 재사용: Priority → Severity → createdAt
   * 1차: priority 순 (HIGH > MEDIUM > LOW > null)
   * 2차: severity 순 (CRITICAL > WARNING > INFO)
   * 3차: createdAt 내림차순 (최신순)
   */
  private sortFindingsByPriority(
    findings: Array<{
      priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      createdAt: Date;
    }>
  ) {
    return [...findings].sort((a, b) => {
      // 1차: priority 순 (HIGH > MEDIUM > LOW > null)
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, null: 3 };
      const aPriority = priorityOrder[a.priority ?? null];
      const bPriority = priorityOrder[b.priority ?? null];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // 2차: 같은 priority 내에서 severity 순 (CRITICAL > WARNING > INFO)
      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      const aSeverity = severityOrder[a.severity];
      const bSeverity = severityOrder[b.severity];

      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }

      // 3차: createdAt 내림차순 (최신순)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * 자금 흐름 추적 결과 Excel 파일 생성 (Story 7.4, MEDIUM #1)
   *
   * Story 7.4 AC2: 4개 시트 Excel 생성
   * - 요약 시트: 사건 정보, 추적 개요, 체인 통계
   * - 체인 시트: 체인 ID, 유형, 깊이, 신뢰도
   * - 거래 상세 시트: 체인별 거래 목록 (N+1 최적화됨)
   * - 시각화 시트: React Flow 그래프 (선택사항)
   *
   * Story 7.4 CRITICAL #3: N+1 Query 최적화 적용
   * - 단일 DB 쿼리로 모든 트랜잭션 로드
   * - 메모리에서 체인별 그룹화
   *
   * @param caseInfo - 사건 기본 정보
   * @param chains - TransactionChain 배열
   * @param transactions - 모든 관련 트랜잭션 (N+1 최적화로 사전 로드)
   * @param includeVisualization - 시각화 시트 포함 여부 (선택사항)
   * @returns Excel Buffer
   */
  async generateFundFlowExcel(
    caseInfo: {
      caseNumber: string | null;
      debtorName: string | null;
      courtName: string | null;
    },
    chains: Array<{
      id: string;
      chainType: 'UPSTREAM' | 'DOWNSTREAM';
      depth: number;
      confidenceScore: { toNumber: () => number } | null;
      startTransactionId: string;
      endTransactionIds: string[];
      path: string;
    }>,
    transactions: Map<string, {
      id: string;
      transactionDate: Date;
      depositAmount: { toNumber: () => number } | null;
      withdrawalAmount: { toNumber: () => number } | null;
      memo: string | null;
      tags: Array<{ tag: { name: string } }>;
      transactionNature: string | null;
      importantTransaction: boolean | null;
    }>,
    includeVisualization: boolean
  ): Promise<Buffer> {
    const { formatDate, formatAmount } = await import('~/lib/export/excel');

    // 1. 워크북 생성
    const workbook = createWorkbook();

    // 2. 요약 시트 생성
    const summarySheet = createWorksheetWithHeaders(workbook, '요약', ['항목', '값']);
    const summaryData = [
      { 항목: '사건번호', 값: caseInfo.caseNumber ?? '' },
      { 항목: '채무자명', 값: caseInfo.debtorName ?? '' },
      { 항목: '법원', 값: caseInfo.courtName ?? '' },
      { 항목: '총 체인 수', 값: chains.length },
      {
        항목: '총 거래 수',
        값: transactions.size,
      },
      {
        항목: 'UPSTREAM 체인',
        값: chains.filter((c) => c.chainType === 'UPSTREAM').length,
      },
      {
        항목: 'DOWNSTREAM 체인',
        값: chains.filter((c) => c.chainType === 'DOWNSTREAM').length,
      },
    ];
    addDataRow(summarySheet, summaryData);

    // 3. 체인 시트 생성
    const chainSheet = createWorksheetWithHeaders(workbook, '체인', [
      '체인ID',
      '체인 유형',
      '깊이',
      '시작 거래',
      '종료 거래',
      '신뢰도',
    ]);
    const chainData = chains.map((chain) => ({
      체인ID: chain.id,
      체인유형: chain.chainType,
      깊이: chain.depth,
      시작거래: chain.startTransactionId,
      종료거래: chain.endTransactionIds.join(', '),
      신뢰도: formatConfidence(chain.confidenceScore?.toNumber()),
    }));
    addDataRow(chainSheet, chainData);
    autoFitColumns(chainSheet);

    // 4. 거래 상세 시트 생성 (Story 7.4 CRITICAL #3: N+1 최적화 적용됨)
    const transactionSheet = createWorksheetWithHeaders(
      workbook,
      '거래 상세',
      ['체인ID', '거래ID', '날짜', '입금액', '출금액', '메모', '태그', '거래성격']
    );

    // 체인별로 거래 데이터 그룹화
    const transactionData: Array<{
      체인ID: string;
      거래ID: string;
      날짜: Date;
      입금액: number | null;
      출금액: number | null;
      메모: string;
      태그: string;
      거래성격: string;
    }> = [];

    for (const chain of chains) {
      const txIds = chain.path
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      for (const txId of txIds) {
        const tx = transactions.get(txId);
        if (tx) {
          transactionData.push({
            체인ID: chain.id,
            거래ID: tx.id,
            날짜: tx.transactionDate,
            입금액: tx.depositAmount ? Number(tx.depositAmount) : null,
            출금액: tx.withdrawalAmount ? Number(tx.withdrawalAmount) : null,
            메모: tx.memo ?? '',
            태그: formatTags(tx.tags),
            거래성격: formatTransactionNature(tx.transactionNature),
          });
        }
      }
    }

    addDataRow(transactionSheet, transactionData);
    autoFitColumns(transactionSheet);

    // 5. 시각화 시트 생성 (선택사항, MEDIUM #2)
    if (includeVisualization) {
      const visualizationSheet = createWorksheetWithHeaders(workbook, '시각화', [
        '메시지',
      ]);
      addDataRow(visualizationSheet, [
        {
          메시지:
            '시각화 기능은 현재 지원되지 않습니다. 추후 html2canvas 라이브러리를 통한 React Flow 그래프 캡처 기능이 추가될 예정입니다.',
        },
      ]);
    }

    // 6. Buffer 변환
    return await writeExcelBuffer(workbook);
  }
}

// 싱글톤 인스턴스
export const excelExportService = new ExcelExportService();
