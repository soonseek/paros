/**
 * Excel Export Helper (Epic 6 Retrospective P0 Action Item A2)
 *
 * Epic 5.6 CSV export 패턴을 재사용한 Excel 다운로드 유틸리티
 *
 * 기능:
 * - Buffer → Base64 인코딩 (tRPC JSON 직렬화 지원)
 * - 파일명 생성 헬퍼
 * - MIME 타입 상수
 * - 클라이언트 다운로드 트리거 함수
 *
 * @module lib/export/excel-export-helper
 */

import ExcelJS from 'exceljs';
import { writeExcelBuffer } from './excel';

/**
 * Excel MIME 타입 (Story 5.6)
 *
 * .xlsx 파일의 표준 MIME 타입
 */
export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Excel 다운로드 응답 인터페이스 (Epic 5.6 패턴)
 *
 * tRPC 프로시저에서 클라이언트로 Excel 파일을 전달하기 위한 인터페이스
 * Base64 인코딩된 문자열로 전달하여 tRPC의 JSON 직렬화 제약을 우회
 */
export interface ExcelDownloadResponse {
  /** Base64 인코딩된 Excel 파일 데이터 */
  data: string;
  /** 다운로드될 파일명 (확장자 포함) */
  filename: string;
  /** MIME 타입 */
  mimeType: string;
  /** 성공 여부 */
  success: boolean;
}

/**
 * Excel 워크북을 Base64로 인코딩된 다운로드 응답으로 변환
 *
 * Epic 5.6 패턴: Buffer → Base64 인코딩 → tRPC JSON 직렬화
 *
 * CRITICAL #1: Buffer를 그대로 반환하면 tRPC JSON 직렬화 실패
 * - tRPC는 JSON 직렬화만 지원
 * - Buffer는 JSON으로 직렬화할 수 없음
 * - 해결책: Base64 문자열로 변환하여 전달
 *
 * @param workbook - Excel 워크북
 * @param filename - 다운로드될 파일명 (.xlsx 확장자 포함)
 * @returns Excel 다운로드 응답
 *
 * @example
 * ```typescript
 * const workbook = createWorkbook();
 * // ... 워크시트 추가
 * const response = await workbookToDownloadResponse(workbook, "거래내역.xlsx");
 * return response; // tRPC 프로시저에서 반환
 * ```
 */
export async function workbookToDownloadResponse(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<ExcelDownloadResponse> {
  // 1. 워크북을 Buffer로 변환
  const buffer = await writeExcelBuffer(workbook);

  // 2. CRITICAL: Buffer를 Base64로 인코딩하여 tRPC JSON 직렬화 가능하게 변환
  const base64Data = buffer.toString('base64');

  return {
    data: base64Data,
    filename,
    mimeType: EXCEL_MIME_TYPE,
    success: true,
  };
}

/**
 * 표준 파일명 생성 헬퍼
 *
 * Epic 5.6 패턴: "[접두사]_[사건번호]_[날짜].xlsx"
 *
 * @param prefix - 파일명 접두사 (예: "거래내역", "발견사항")
 * @param caseNumber - 사건 번호 (선택사항)
 * @returns 포맷된 파일명
 *
 * @example
 * ```typescript
 * // 오늘 날짜: 2026-01-13
 * createExcelFilename("거래내역", "CASE-001");
 * // → "거래내역_CASE-001_20260113.xlsx"
 *
 * createExcelFilename("발견사항");
 * // → "발견사항_20260113.xlsx"
 * ```
 */
export function createExcelFilename(prefix: string, caseNumber?: string): string {
  // 1. 날짜 포맷: YYYYMMDD
  const dateStr = formatDate(new Date());

  // 2. 사건 번호 정제 (특수 문자 제거)
  const sanitizedCaseNumber = caseNumber
    ? caseNumber.replace(/[^a-zA-Z0-9가-힣]/g, '_')
    : '';

  // 3. 파일명 조립: "[prefix]_[caseNumber]_[date].xlsx"
  const parts = [prefix, sanitizedCaseNumber, dateStr].filter(Boolean);
  return `${parts.join('_')}.xlsx`;
}

/**
 * 날짜를 YYYYMMDD 형식으로 변환
 *
 * @param date - 날짜 객체
 * @returns YYYYMMDD 형식 문자열
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 클라이언트: Base64 데이터를 다운로드로 트리거
 *
 * Epic 5.6 패턴: data URL 생성 → 링크 클릭 → 정리
 *
 * CRITICAL #2: Base64 데이터를 다운로드하는 방법
 * - data URL 생성: `data:${mimeType};base64,${data}`
 * - 임시 <a> 태그 생성 및 클릭
 * - 메모리 누수 방지: 사용 후 정리
 *
 * @param response - Excel 다운로드 응답
 *
 * @example
 * ```typescript
 * // tRPC 클라이언트에서 사용
 * const result = await api.export.transactions.mutate({ caseId });
 * triggerDownload(result); // 다운로드 트리거
 * ```
 */
export function triggerDownload(response: ExcelDownloadResponse): void {
  const { data, filename, mimeType } = response;

  // 1. data URL 생성
  const dataUrl = `data:${mimeType};base64,${data}`;

  // 2. 임시 <a> 태그 생성
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;

  // 3. DOM에 추가 → 클릭 → 제거
  document.body.appendChild(link);
  link.click();

  // 4. 메모리 누수 방지: 정리
  document.body.removeChild(link);
}

/**
 * Base64 데이터를 Blob으로 변환
 *
 * (선택사항) File API를 사용하는 대체 다운로드 방법
 *
 * @param response - Excel 다운로드 응답
 * @returns Blob 객체
 *
 * @example
 * ```typescript
 * const blob = base64ToBlob(response);
 * const url = URL.createObjectURL(blob);
 * // ... 다운로드 로직
 * URL.revokeObjectURL(url); // 메모리 해제
 * ```
 */
export function base64ToBlob(response: ExcelDownloadResponse): Blob {
  const { data, mimeType } = response;

  // 1. Base64 디코딩
  const byteCharacters = atob(data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  // 2. Uint8Array 생성
  const byteArray = new Uint8Array(byteNumbers);

  // 3. Blob 생성
  return new Blob([byteArray], { type: mimeType });
}
