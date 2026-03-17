/**
 * PDF OCR using Upstage Solar Document Parse API
 *
 * Story 3.4: Extracts table data from PDF files using Upstage Document Parse API
 *
 * API Documentation:
 * - Endpoint: https://api.upstage.ai/v1/document-ai/document-parse
 * - Method: POST (multipart/form-data)
 * - Authentication: Bearer token
 * 
 * 대용량 PDF 처리:
 * - Upstage API는 파일 크기 제한이 있음 (~50MB 정도)
 * - 대용량 PDF는 페이지 단위로 분할하여 처리
 * - 각 청크 결과를 병합하여 반환
 */

import { env } from "~/env";
import { inferColumnType, ColumnType } from "~/lib/column-mapping";
import { PDFDocument } from "pdf-lib";

interface UpstageDocumentParseResponse {
  elements?: Array<{
    id: string | number;
    type?: string; // "text", "table", "figure", etc.
    category?: string; // "table", "text", etc.
    content?: {
      html?: string;
      text?: string;
      markdown?: string;
    };
    bbox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    page?: number;
  }>;
  content?: {
    html?: string;
    text?: string;
    markdown?: string;
  };
  bboxes?: Array<{
    x: number;
    y: number;
    page: number;
    id: number;
  }>;
  model?: string;
  ocr?: boolean;
  usage?: {
    pages: number;
    standard?: number[];
  };
}

interface TableData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  pageTexts?: string[]; // 테이블 외 페이지 텍스트 (문서 상단 헤더 등)
}

/**
 * Parse PDF using Upstage Document Parse API
 *
 * @param pdfBuffer - PDF file buffer
 * @param apiKey - Upstage API key (from DB settings)
 * @returns Parsed table data with headers and rows
 * @throws Error if API call fails
 */
export async function parsePdfWithUpstage(
  pdfBuffer: Buffer,
  apiKey?: string
): Promise<TableData> {
  // API 키 우선순위: 1) 인자로 전달된 키, 2) 환경변수
  const finalApiKey = apiKey || env.UPSTAGE_API_KEY;

  if (!finalApiKey) {
    throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다. 관리자 설정 페이지에서 API 키를 입력해주세요.");
  }

  // Upstage API 파일 크기 제한 (~30MB 안전선)
  const UPSTAGE_SIZE_LIMIT = 30 * 1024 * 1024; // 30MB
  const PAGES_PER_CHUNK = 50; // 청크당 최대 페이지 수

  // 파일 크기가 제한을 초과하면 청크 분할 처리
  if (pdfBuffer.length > UPSTAGE_SIZE_LIMIT) {
    console.log(`[PDF Chunking] 파일 크기 ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB가 제한(${UPSTAGE_SIZE_LIMIT / 1024 / 1024}MB)을 초과합니다. 청크 분할 처리 시작...`);
    return await parsePdfInChunks(pdfBuffer, finalApiKey, PAGES_PER_CHUNK);
  }

  // 일반 처리 (파일 크기가 제한 이하)
  return await parseSinglePdf(pdfBuffer, finalApiKey);
}

/**
 * PDF를 청크로 분할하여 처리
 */
async function parsePdfInChunks(
  pdfBuffer: Buffer,
  apiKey: string,
  pagesPerChunk: number
): Promise<TableData> {
  // PDF 로드
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  
  console.log(`[PDF Chunking] 총 ${totalPages}페이지, ${pagesPerChunk}페이지씩 분할 처리`);

  const allHeaders: string[] = [];
  const allRows: string[][] = [];
  const allPageTexts: string[] = [];
  let headersSet = false;

  // 페이지를 청크로 분할
  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const endPage = Math.min(startPage + pagesPerChunk, totalPages);
    const chunkNum = Math.floor(startPage / pagesPerChunk) + 1;
    const totalChunks = Math.ceil(totalPages / pagesPerChunk);
    
    console.log(`[PDF Chunking] 청크 ${chunkNum}/${totalChunks} 처리 중 (페이지 ${startPage + 1}-${endPage})...`);

    try {
      // 해당 페이지만 추출하여 새 PDF 생성
      const chunkPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: endPage - startPage }, (_, i) => startPage + i);
      const copiedPages = await chunkPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(page => chunkPdf.addPage(page));
      
      const chunkBuffer = Buffer.from(await chunkPdf.save());
      console.log(`[PDF Chunking] 청크 ${chunkNum} 크기: ${(chunkBuffer.length / 1024 / 1024).toFixed(2)}MB`);

      // Upstage API 호출
      const chunkResult = await parseSinglePdf(chunkBuffer, apiKey);

      // 첫 번째 청크에서 헤더 설정
      if (!headersSet && chunkResult.headers.length > 0) {
        allHeaders.push(...chunkResult.headers);
        headersSet = true;
        console.log(`[PDF Chunking] 헤더 설정 완료: ${allHeaders.join(", ")}`);
      }

      // 행 데이터 추가
      allRows.push(...chunkResult.rows);
      
      // 페이지 텍스트 추가
      if (chunkResult.pageTexts) {
        allPageTexts.push(...chunkResult.pageTexts);
      }

      console.log(`[PDF Chunking] 청크 ${chunkNum} 완료: ${chunkResult.rows.length}행 추출`);

      // API 레이트 리밋 방지를 위한 딜레이
      if (endPage < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[PDF Chunking] 청크 ${chunkNum} 처리 실패:`, error);
      // 한 청크가 실패해도 계속 진행
      continue;
    }
  }

  console.log(`[PDF Chunking] 전체 처리 완료: 헤더 ${allHeaders.length}개, 행 ${allRows.length}개`);

  return {
    headers: allHeaders,
    rows: allRows,
    totalRows: allRows.length,
    pageTexts: allPageTexts,
  };
}

/**
 * 단일 PDF 처리 (청크 또는 작은 파일)
 */
async function parseSinglePdf(
  pdfBuffer: Buffer,
  apiKey: string
): Promise<TableData> {

  // Create FormData for multipart upload
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("document", blob, "document.pdf");

  // Upstage API parameters - 거래내역 파싱에 필요한 최소 옵션만 설정
  formData.append("model", "document-parse");
  formData.append("ocr", "auto"); // auto: 텍스트 PDF는 직접 파싱, 이미지 PDF만 OCR
  formData.append("output_formats", '["html","text"]'); // HTML for tables, text for template matching
  formData.append("merge_multipage_tables", "true"); // 다중 페이지 테이블 병합

  try {
    console.log("[Upstage API] Calling document-digitization endpoint...");

    // 90초 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch(
      "https://api.upstage.ai/v1/document-digitization",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Upstage API Error]", response.status, errorText);
      throw new Error(
        `Upstage API 호출 실패: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as UpstageDocumentParseResponse;

    console.log("[Upstage API] Response received");
    console.log(`[Upstage API] Elements count: ${data.elements?.length || 0}`);
    console.log(`[Upstage API] Pages: ${data.usage?.pages || 0}`);

    // Extract text from elements
    if (!data.elements || data.elements.length === 0) {
      console.error("[Upstage API] No elements in response");
      throw new Error("Upstage API에서 데이터를 추출하지 못했습니다");
    }

    // DEBUG: Log all element types
    console.log("[Upstage API] Element types:");
    data.elements.forEach((el, idx) => {
      console.log(`  [${idx}] type=${el.type}, category=${el.category}, hasHTML=${!!el.content?.html}, hasText=${!!el.content?.text}`);
      if (el.category === "table") {
        console.log(`      [TABLE ${idx}] HTML preview:`, el.content?.html?.substring(0, 200));
      }
    });

    // 페이지 텍스트 추출 (테이블 외 텍스트 - 문서 헤더, 은행명 등)
    const nonTableElements = data.elements.filter(el => 
      el.category !== "table" && 
      el.category !== "list" &&
      el.content?.text?.trim()
    );
    const pageTexts = nonTableElements
      .map(el => el.content?.text?.trim() || "")
      .filter(text => text.length > 0);
    
    console.log(`[Upstage API] ========== PAGE TEXTS EXTRACTION ==========`);
    console.log(`[Upstage API] Extracted ${pageTexts.length} page text elements (non-table text)`);
    if (pageTexts.length > 0) {
      console.log(`[Upstage API] Page texts (for template identifiers):`);
      pageTexts.slice(0, 10).forEach((text, idx) => {
        console.log(`  [${idx + 1}] ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });
    } else {
      console.warn(`[Upstage API] ⚠️ WARNING: No page texts found! Template identifier matching may fail.`);
    }
    console.log(`[Upstage API] ===============================================`);

    // Find table elements or concatenate all text
    const tableElements = data.elements.filter(el => el.category === "table");
    const listElements = data.elements.filter(el => el.category === "list");

    console.log(`[Upstage API] Found ${tableElements.length} table elements`);
    console.log(`[Upstage API] Found ${listElements.length} list elements`);

    if (tableElements.length > 0) {
      console.log(`[Upstage API] Processing ${tableElements.length} table(s)...`);
      // Process table elements from HTML
      const result = extractFromTableElementsHTML(tableElements);
      result.pageTexts = pageTexts; // 페이지 텍스트 추가
      return result;
    }

    // Try list elements (some PDFs use list format for tables)
    if (listElements.length > 0) {
      console.log(`[Upstage API] Processing ${listElements.length} list(s)...`);
      try {
        const result = extractFromTableElementsHTML(listElements);
        result.pageTexts = pageTexts;
        return result;
      } catch (error) {
        console.log("[Upstage API] List processing failed, trying fallback...");
      }
    }

    // Fallback: Try top-level content field first (Story 3.4 PDF table image support)
    console.log("[Upstage API] Using fallback: checking top-level content field...");

    // Check top-level content.html field (contains full HTML including table images)
    if (data.content?.html?.trim()) {
      console.log(`[Upstage API] Found top-level content.html (${data.content.html.length} chars)`);
      console.log("[Upstage API] Content.html preview:", data.content.html.substring(0, 500));

      try {
        const result = extractTableFromText(data.content.html);
        result.pageTexts = pageTexts;
        return result;
      } catch (error) {
        console.log("[Upstage API] Failed to parse from content.html, trying element fields...");
      }
    }

    // Next, try text content from elements
    console.log("[Upstage API] Trying element text fields...");
    const textElements = data.elements.filter(el => el.content?.text?.trim());
    if (textElements.length > 0) {
      const allText = textElements.map(el => el.content?.text || "").join("\n");
      console.log(`[Upstage API] Extracted ${allText.length} characters from text fields`);
      console.log("[Upstage API] Text preview:", allText.substring(0, 300));

      if (allText.trim()) {
        return extractTableFromText(allText);
      }
    }

    // Finally, try HTML fields from elements
    console.log("[Upstage API] No text content, trying element HTML fields...");
    const allHtmlText = data.elements
      .filter(el => el.content?.html)
      .map(el => el.content?.html || "")
      .join("\n");

    console.log(`[Upstage API] Extracted ${allHtmlText.length} characters from HTML fields`);

    if (!allHtmlText.trim()) {
      console.error("[Upstage API] No content found");
      throw new Error("Upstage API에서 데이터를 추출하지 못했습니다");
    }

    // Try to parse as table
    return extractTableFromText(allHtmlText);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error("[PDF OCR Error] Upstage API 요청 타임아웃 (90초)");
      throw new Error("Upstage API 응답 시간 초과 (90초). 문서가 너무 크거나 복잡할 수 있습니다.");
    }
    console.error("[PDF OCR Error]", error);
    throw new Error(
      `PDF 파싱 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract table data from Upstage API table elements (HTML format)
 *
 * @param tableElements - Array of table elements with HTML content
 * @returns Parsed table data (all tables combined)
 */
function extractFromTableElementsHTML(tableElements: Array<{
  content?: {
    html?: string;
    text?: string;
  };
}>): TableData {
  if (tableElements.length === 0) {
    throw new Error("테이블 HTML을 찾을 수 없습니다");
  }

  console.log(`[HTML Table] Extracting data from ${tableElements.length} tables...`);

  // 1단계: 모든 테이블 파싱 (중첩 테이블 포함)
  interface ParsedTable {
    index: number;
    headers: string[];
    rows: string[][];
    columnCount: number;
    hasValidHeaders: boolean; // 헤더가 실제 헤더인지 (날짜 컬럼 등)
    headerScore: number; // 헤더 품질 점수
    dataScore: number; // 데이터 품질 점수
    score: number;
  }

  const parsedTables: ParsedTable[] = [];

  for (let i = 0; i < tableElements.length; i++) {
    const tableHTML = tableElements[i]?.content?.html;
    if (!tableHTML) {
      console.log(`[HTML Table] ⚠️ Table ${i + 1} skipped - No HTML content`);
      continue;
    }

    console.log(`[HTML Table] Processing table ${i + 1}/${tableElements.length}...`);
    console.log(`[HTML Table] Table ${i + 1} HTML length: ${tableHTML.length}, preview: ${tableHTML.substring(0, 100)}...`);

    // 중첩 테이블 추출: 재귀적으로 모든 <table> 추출
    // 핵심 수정: 중첩 테이블이 있으면 가장 안쪽 테이블만 사용 (중복 방지)
    const extractLeafTables = (html: string, level: number = 0): string[] => {
      const tables: string[] = [];
      let searchPos = 0;
      
      const indent = '  '.repeat(level);
      console.log(`${indent}[extractLeafTables] Level ${level} 검색 시작 (HTML length: ${html.length})`);
      
      // 무한 재귀 방지: 레벨 10 이상이면 중단
      if (level > 10) {
        console.log(`${indent}[extractLeafTables] ⚠️ Max recursion depth reached`);
        return tables;
      }
      
      while (searchPos < html.length) {
        const startIdx = html.indexOf('<table', searchPos);
        if (startIdx === -1) {
          console.log(`${indent}[extractLeafTables] 더 이상 <table 태그 없음`);
          break;
        }
        
        console.log(`${indent}[extractLeafTables] <table 발견 at position ${startIdx}`);
        
        // 매칭되는 </table> 찾기 (중첩 레벨 고려)
        let depth = 0;
        let endIdx = -1;
        
        for (let k = startIdx; k < html.length; k++) {
          if (html.substring(k, k + 6) === '<table') {
            depth++;
          } else if (html.substring(k, k + 8) === '</table>') {
            depth--;
            if (depth === 0) {
              endIdx = k + 8;
              break;
            }
          }
        }
        
        if (endIdx > startIdx) {
          const extractedTable = html.substring(startIdx, endIdx);
          
          // 내부 콘텐츠 확인 (외부 <table> 태그 제외)
          const tableTagEndPos = extractedTable.indexOf('>') + 1;
          const innerContent = extractedTable.substring(tableTagEndPos, extractedTable.lastIndexOf('</table>'));
          
          if (innerContent.includes('<table')) {
            // 중첩 테이블 발견: 외부 테이블은 무시하고 내부 테이블만 재귀 탐색
            console.log(`${indent}[extractLeafTables] 내부에 <table 태그 발견, 외부 테이블 스킵 후 내부만 추출...`);
            const innerTables = extractLeafTables(innerContent, level + 1);
            if (innerTables.length > 0) {
              console.log(`${indent}[extractLeafTables] Found ${innerTables.length} leaf table(s) inside`);
              tables.push(...innerTables);
            }
          } else {
            // 중첩 테이블 없음: 이 테이블이 리프 테이블 (실제 데이터)
            tables.push(extractedTable);
            console.log(`${indent}[extractLeafTables] ✓ Leaf table ${tables.length}: ${startIdx}~${endIdx} (${extractedTable.length} chars)`);
          }
          
          searchPos = endIdx;
        } else {
          console.log(`${indent}[extractLeafTables] ⚠️ No matching </table> found`);
          break;
        }
      }
      
      console.log(`${indent}[extractLeafTables] Level ${level} 완료: ${tables.length}개 리프 테이블`);
      return tables;
    };
    
    const allTables = extractLeafTables(tableHTML);
    console.log(`[HTML Table] 총 ${allTables.length}개 리프 테이블 추출 완료 (중첩 제거됨)`);
    
    // 각 테이블을 개별 파싱
    for (let j = 0; j < allTables.length; j++) {
      const singleTableHTML = allTables[j];
      if (!singleTableHTML) continue;
      
      console.log(`[HTML Table] Parsing table ${j + 1}/${allTables.length} (length: ${singleTableHTML.length})...`);
      
      let tableData;
      try {
        tableData = parseHTMLTable(singleTableHTML);
      } catch (error) {
        console.log(`[HTML Table] ⚠️ Table ${j + 1} skipped - Parse error: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      
      // 최소 컬럼 수를 3으로 완화 (일부 PDF는 날짜, 금액, 잔액만 있음)
      if (tableData.headers.length < 3) {
        console.log(`[HTML Table] ⚠️ Table ${j + 1} skipped - Too few columns (${tableData.headers.length})`);
        continue;
      }

      // 헤더가 실제 헤더인지 검사 (날짜 컬럼명 포함 여부)
      let headerScore = 0;
      let hasDateColumn = false;
      let hasAmountColumn = false;

      for (const header of tableData.headers) {
        const columnType = inferColumnType(header);
        
        if (columnType === ColumnType.DATE) {
          hasDateColumn = true;
          headerScore += 10;
        }
        if (columnType === ColumnType.DEPOSIT || columnType === ColumnType.WITHDRAWAL || columnType === ColumnType.AMOUNT) {
          hasAmountColumn = true;
          headerScore += 10;
        }
        if (columnType === ColumnType.BALANCE) {
          headerScore += 10;
        }
        if (columnType === ColumnType.TRANSACTION_TYPE) {
          headerScore += 5;
        }
        if (columnType === ColumnType.MEMO) {
          headerScore += 3;
        }
      }

      // 데이터 품질 점수: 첫 번째 행이 날짜 패턴을 포함하는지 확인
      let dataScore = 0;
      const datePatterns = [
        /^\d{4}[-./]\d{2}[-./]\d{2}/, // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
        /^\d{2}[-./]\d{2}[-./]\d{4}/, // DD-MM-YYYY, DD.MM.YYYY
        /^\d{2}[-./]\d{2}[-./]\d{2}/, // YY-MM-DD, YY.MM.DD
      ];
      
      // 첫 번째 헤더가 날짜 패턴이면 -> 이건 데이터 행임 (헤더 아님)
      const firstCellLooksLikeDate = datePatterns.some(p => p.test(tableData.headers[0] || ""));
      if (firstCellLooksLikeDate) {
        dataScore += 20; // 데이터 행일 가능성 높음
        headerScore = 0; // 헤더 점수 리셋
      }

      // 데이터 행 수에 따른 점수
      dataScore += Math.min(tableData.rows.length * 2, 20);
      
      const score = headerScore + dataScore + tableData.headers.length;
      const hasValidHeaders = hasDateColumn && !firstCellLooksLikeDate;

      const tableId = `${i + 1}-${j + 1}`;
      console.log(`[HTML Table] Table ${tableId}: cols=${tableData.headers.length}, rows=${tableData.rows.length}, validHeader=${hasValidHeaders}, headerScore=${headerScore}, dataScore=${dataScore}, totalScore=${score}`);
      if (!hasValidHeaders) {
        console.log(`[HTML Table]    First row (potential data):`, tableData.headers.slice(0, 5).join(", "));
      }

      parsedTables.push({
        index: parsedTables.length + 1, // 전체 테이블 카운트
        headers: tableData.headers,
        rows: tableData.rows,
        columnCount: tableData.headers.length,
        hasValidHeaders,
        headerScore,
        dataScore,
        score,
      });
    }
  }

  if (parsedTables.length === 0) {
    throw new Error("PDF에서 유효한 테이블을 찾을 수 없습니다");
  }

  // 2단계: 메인 테이블 선택 (유효한 헤더가 있는 테이블 중 최고 점수)
  const tablesWithHeaders = parsedTables.filter(t => t.hasValidHeaders);
  
  let mainTable: ParsedTable;
  
  if (tablesWithHeaders.length === 0) {
    // 유효한 헤더가 있는 테이블이 없으면, 가장 높은 headerScore를 가진 테이블 선택
    console.log("[HTML Table] ⚠️ No tables with valid headers found, selecting best candidate...");
    parsedTables.sort((a, b) => b.headerScore - a.headerScore || b.score - a.score);
    mainTable = parsedTables[0]!;
    
    // 그래도 헤더 점수가 0이면 에러
    if (mainTable.headerScore === 0) {
      console.error("[HTML Table] ✗ No tables with recognizable columns found");
      throw new Error("PDF에서 거래내역 테이블을 찾을 수 없습니다 (날짜 열이 없는 테이블만 있음)");
    }
  } else {
    tablesWithHeaders.sort((a, b) => b.score - a.score);
    mainTable = tablesWithHeaders[0]!;
  }

  console.log(`[HTML Table] Main table: #${mainTable.index} with ${mainTable.columnCount} columns, ${mainTable.rows.length} data rows`);
  console.log(`[HTML Table] Headers:`, mainTable.headers.join(", "));

  // 모든 파싱된 테이블 요약 출력
  console.log(`[HTML Table] All parsed tables summary:`);
  parsedTables.forEach(t => {
    console.log(`  Table ${t.index}: cols=${t.columnCount}, validHeader=${t.hasValidHeaders}, rows=${t.rows.length}, score=${t.score}`);
  });

  // 메인 테이블의 날짜 컬럼 인덱스 감지 (행 정렬에 사용)
  let mainDateColumnIndex = -1;
  for (let hi = 0; hi < mainTable.headers.length; hi++) {
    const colType = inferColumnType(mainTable.headers[hi] || "");
    if (colType === ColumnType.DATE) {
      mainDateColumnIndex = hi;
      break;
    }
  }
  console.log(`[HTML Table] Main table date column index: ${mainDateColumnIndex}`);

  // 3단계: 동일한 거래내역 구조의 테이블들 모두 결합 + 컬럼 정렬
  // 중요: 원본 순서(테이블 인덱스 순) 유지하여 페이지 1→2→3 순서 보장
  const includedTables: { index: number; rows: string[][] }[] = [];
  const skippedTables: number[] = [];
  let alignedRowCount = 0;

  // 날짜 패턴 체크: 테이블의 행 중 날짜 데이터가 있는지 확인
  const datePatternCheck = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/;
  const tableHasDateData = (rows: string[][]): boolean => {
    // 첫 5개 행 중 하나라도 날짜가 있으면 거래 데이터 테이블로 판단
    const checkRows = rows.slice(0, 5);
    return checkRows.some(row => row.some(cell => datePatternCheck.test(cell || '')));
  };

  // 메인 테이블 자체를 먼저 포함 대상에 추가
  includedTables.push({ index: mainTable.index, rows: mainTable.rows });

  for (const table of parsedTables) {
    if (table.index === mainTable.index) continue;

    const columnDiff = Math.abs(table.columnCount - mainTable.columnCount);
    const isSimilarStructure = columnDiff <= 3;

    if (isSimilarStructure) {
      // 메인 테이블 이전에 나오는 테이블: 날짜 데이터가 있어야만 포함
      // (페이지 상단 정보 테이블 - 고객전화번호, 계좌번호 등 - 제외)
      if (table.index < mainTable.index) {
        const allTableRows = [table.headers, ...table.rows];
        if (!tableHasDateData(allTableRows)) {
          skippedTables.push(table.index);
          console.log(`[HTML Table] ⚠️ Table ${table.index} skipped (before main table, no date data → likely info/header table)`);
          continue;
        }
      }

      const needsAlignment = table.columnCount !== mainTable.columnCount;
      
      const alignRow = (row: string[]): string[] => {
        if (needsAlignment) {
          alignedRowCount++;
          return alignRowToMainTable(row, mainTable.columnCount, mainDateColumnIndex);
        }
        return row;
      };

      const tableRows: string[][] = [];

      if (table.hasValidHeaders) {
        tableRows.push(...table.rows.map(alignRow));
        console.log(`[HTML Table] ✓ Table ${table.index} added (valid header, ${table.rows.length} rows, aligned=${needsAlignment})`);
      } else {
        const firstCellLooksLikeDate = datePatterns.some(p => p.test(table.headers[0] || ""));
        
        if (firstCellLooksLikeDate || table.dataScore > table.headerScore) {
          tableRows.push(alignRow(table.headers));
          tableRows.push(...table.rows.map(alignRow));
          console.log(`[HTML Table] ✓ Table ${table.index} added as continuation (${table.rows.length + 1} rows, aligned=${needsAlignment}, firstCell=${table.headers[0]?.substring(0, 15)})`);
        } else {
          tableRows.push(...table.rows.map(alignRow));
          console.log(`[HTML Table] ✓ Table ${table.index} added (data only, ${table.rows.length} rows, aligned=${needsAlignment})`);
        }
      }

      if (tableRows.length > 0) {
        includedTables.push({ index: table.index, rows: tableRows });
      }
    } else {
      skippedTables.push(table.index);
      console.log(`[HTML Table] ⚠️ Table ${table.index} skipped (column count ${table.columnCount} vs main ${mainTable.columnCount}, diff=${columnDiff})`);
    }
  }

  // 원본 테이블 순서대로 행 결합 (테이블 인덱스 = 문서 내 출현 순서)
  includedTables.sort((a, b) => a.index - b.index);
  const allRows: string[][] = [];
  for (const t of includedTables) {
    allRows.push(...t.rows);
  }
  const continuationCount = includedTables.length - 1;

  if (skippedTables.length > 0) {
    console.log(`[HTML Table] ⚠️ WARNING: ${skippedTables.length} tables were skipped due to column count mismatch: [${skippedTables.join(", ")}]`);
  }

  if (alignedRowCount > 0) {
    console.log(`[HTML Table] ✓ ${alignedRowCount} rows were column-aligned to match main table structure`);
  }

  // 4단계: 최종 행 정규화 - 모든 행이 메인 테이블과 동일한 컬럼 수를 갖도록 보장
  const normalizedRows = allRows.map(row => {
    if (row.length === mainTable.columnCount) return row;
    return alignRowToMainTable(row, mainTable.columnCount, mainDateColumnIndex);
  });

  console.log(`[HTML Table] Combined: 1 main + ${continuationCount} continuation tables, ${mainTable.columnCount} columns, ${normalizedRows.length} total rows`);

  return {
    headers: mainTable.headers,
    rows: normalizedRows,
    totalRows: normalizedRows.length,
  };
}

// 날짜 패턴 상수 (함수 외부에서 재사용 가능)
const datePatterns = [
  /^\d{4}[-./]\d{2}[-./]\d{2}/, // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  /^\d{2}[-./]\d{2}[-./]\d{4}/, // DD-MM-YYYY, DD.MM.YYYY
  /^\d{2}[-./]\d{2}[-./]\d{2}/, // YY-MM-DD, YY.MM.DD
];

// 날짜 포함 여부 확인 (문자열 어디에서든)
const datePatternAnywhere = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/;

/**
 * 연속 테이블 행을 메인 테이블 컬럼 구조에 맞춰 정렬
 * 
 * 핵심 전략: 행에서 날짜가 있는 컬럼 위치를 찾고, 
 * 메인 테이블의 날짜 컬럼 위치와 일치하도록 행 전체를 시프트
 * 
 * @param row - 정렬할 행 데이터
 * @param mainColumnCount - 메인 테이블의 컬럼 수
 * @param mainDateColumnIndex - 메인 테이블에서 날짜 컬럼의 인덱스 (-1이면 미검출)
 * @returns 정렬된 행 데이터
 */
function alignRowToMainTable(
  row: string[],
  mainColumnCount: number,
  mainDateColumnIndex: number,
): string[] {
  // 행에서 날짜 위치 찾기
  let rowDateIndex = -1;
  for (let i = 0; i < row.length; i++) {
    const cell = (row[i] || '').trim();
    if (cell && datePatternAnywhere.test(cell)) {
      rowDateIndex = i;
      break;
    }
  }

  // 날짜 위치를 기준으로 시프트량 계산
  // 컬럼 수가 다를 때만 시프트 (같은 컬럼 수는 보통 같은 구조)
  if (rowDateIndex >= 0 && mainDateColumnIndex >= 0 && rowDateIndex !== mainDateColumnIndex && row.length !== mainColumnCount) {
    const shift = mainDateColumnIndex - rowDateIndex;
    const aligned = new Array(mainColumnCount).fill('') as string[];
    
    for (let i = 0; i < row.length; i++) {
      const newIndex = i + shift;
      if (newIndex >= 0 && newIndex < mainColumnCount) {
        aligned[newIndex] = row[i] || '';
      }
    }
    
    console.log(`[Row Align] 날짜 기반 정렬: rowDateIdx=${rowDateIndex} → mainDateIdx=${mainDateColumnIndex}, shift=${shift}, cols ${row.length}→${mainColumnCount}`);
    return aligned;
  }

  // 이미 정렬 OK + 컬럼 수 같으면 그대로 반환
  if (row.length === mainColumnCount) {
    return row;
  }

  // 날짜 기반 정렬 불가 → 단순 패딩/트리밍
  if (row.length < mainColumnCount) {
    const padded = [...row];
    while (padded.length < mainColumnCount) padded.push('');
    return padded;
  }

  // 컬럼이 많으면 잘라내기
  return row.slice(0, mainColumnCount);
}


/**
 * Parse HTML table string to extract headers and rows
 *
 * @param html - HTML table string
 * @returns Parsed table data
 */
function parseHTMLTable(html: string): TableData {
  // First, try to find <table> tag content
  const tableMatch = /<table[^>]*>(.*?)<\/table>/is.exec(html);
  const tableContent = tableMatch?.[1] ?? html;

  // Extract table rows using regex
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
  const matches = [...tableContent.matchAll(rowRegex)];

  if (matches.length === 0) {
    console.error("[HTML Table] No <tr> tags found in HTML");
    throw new Error("HTML에서 테이블 행을 찾을 수 없습니다");
  }

  console.log(`[HTML Table] Found ${matches.length} <tr> tags`);

  // 모든 행의 컬럼 수를 계산하여 가장 많은 컬럼을 가진 행을 헤더로 선택
  let maxColumns = 0;
  let headerRowIndex = 0;
  
  for (let i = 0; i < Math.min(matches.length, 5); i++) {
    const matchContent = matches[i]?.[1];
    if (!matchContent) continue;
    const cells = extractCellsFromHTML(matchContent);
    if (cells.length > maxColumns) {
      maxColumns = cells.length;
      headerRowIndex = i;
    }
  }
  
  console.log(`[HTML Table] 헤더 행 선택: row ${headerRowIndex + 1} (${maxColumns} columns)`);
  
  // Parse headers from selected row
  const headerRow = matches[headerRowIndex]?.[1] ?? '';
  const rawHeaders = extractCellsFromHTML(headerRow);
  
  // 띄어쓰기 정규화: OCR에서 "거래 일자", "출 금 금 액" 등으로 읽히는 경우 처리
  const headers = rawHeaders.map(h => h.replace(/\s+/g, ""));
  
  console.log("[HTML Table] Raw headers (before normalization):", rawHeaders);
  console.log("[HTML Table] Normalized headers (after removing spaces):", headers);

  // Skip separator rows (rows with only dashes/spaces or HTML tags without text)
  const dataRows = matches.slice(headerRowIndex + 1).filter(match => {
    const matchContent = match?.[1];
    if (!matchContent) return false;
    const cells = extractCellsFromHTML(matchContent);
    // Check if row has actual text content (not just dashes or separators)
    const hasContent = cells.some(cell => {
      const trimmed = cell.trim();
      return trimmed.length > 0 && !/^[-=\s]{3,}$/.test(trimmed);
    });
    return hasContent;
  });

  const rows = dataRows.map(match => extractCellsFromHTML(match?.[1] ?? ''));

  console.log(`[HTML Table] ${headers.length} columns, ${rows.length} data rows`);
  console.log("[HTML Table] Final headers:", headers);

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Extract cell values from HTML table row
 *
 * @param rowHTML - HTML table row string
 * @returns Array of cell values
 */
function extractCellsFromHTML(rowHTML: string): string[] {
  // Remove <tr> tags
  const cleanRow = rowHTML.replace(/<\/?tr[^>]*>/gi, "");

  // Extract <td> or <th> content
  // IMPORTANT: Do NOT expand colspan - header colspan causes misalignment with data rows
  // because header may have colspan=2 but data rows have individual cells.
  // The ±3 column tolerance + date-based alignment handles column count differences.
  const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gs;
  const cells = [...cleanRow.matchAll(cellRegex)].map(match => match[1]);

  // Clean HTML tags and decode HTML entities
  // CRITICAL: Do NOT filter empty cells - they represent null/empty values in columns!
  return cells.map(cell => {
    if (!cell) return '';
    let text = cell.replace(/<[^>]+>/g, "");
    text = text.replace(/&nbsp;/g, " ")
             .replace(/&lt;/g, "<")
             .replace(/&gt;/g, ">")
             .replace(/&amp;/g, "&")
             .replace(/<br\s*\/?>/gi, " ")
             .trim();
    return text;
  });
}

/**
 * Extract table data from Upstage API response text
 *
 * @param text - Extracted text (markdown or plain text)
 * @returns Table data with headers and rows
 */
function extractTableFromText(text: string): TableData {
  // Remove HTML tags from text
  const cleanText = text.replace(/<[^>]+>/g, "").trim();

  console.log("[Text Extract] Cleaning HTML tags, original length:", text.length, "cleaned:", cleanText.length);

  // Split into lines and filter
  const lines = cleanText.split("\n").filter(line => line.trim());

  console.log("[Text Extract] Lines after filtering:", lines.length);

  // Find table-like structures (lines with | separator are markdown tables)
  const tableLines = lines.filter(line => line.includes("|"));

  let tableData: TableData;

  if (tableLines.length >= 2) {
    console.log("[Text Extract] Found markdown table format");
    // Parse markdown table
    tableData = parseMarkdownTable(tableLines.join("\n"));
  } else {
    console.log("[Text Extract] No markdown table, trying space-separated format");
    // If no markdown table found, try to parse as space-separated columns
    tableData = parseSpaceSeparatedTable(cleanText);
  }

  // Validate table has date column (required for transaction history)
  const hasDateColumn = tableData.headers.some(header => {
    const columnType = inferColumnType(header);
    return columnType === ColumnType.DATE;
  });

  if (!hasDateColumn) {
    console.error("[Text Extract] ✗ No date column found in parsed table (not a transaction table)");
    console.error("[Text Extract]    Headers:", tableData.headers.join(", "));
    throw new Error("PDF에서 거래내역 테이블을 찾을 수 없습니다 (날짜 열이 없는 테이블만 있음)");
  }

  console.log("[Text Extract] ✓ Table validated - Has date column");
  return tableData;
}

/**
 * Parse space-separated table (fallback)
 *
 * @param text - Plain text with space-separated columns
 * @returns Parsed table data
 */
function parseSpaceSeparatedTable(text: string): TableData {
  const lines = text.split("\n").filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error("테이블을 찾을 수 없습니다");
  }

  console.log("[Space-separated] Raw lines:", lines.length);
  console.log("[Space-separated] First line:", lines[0]);

  // Try to detect column alignment by looking at consistent spacing patterns
  // For now, simple split by 2+ spaces
  const firstLine = lines[0] ?? '';
  const headers = firstLine.split(/\s{2,}/).map(h => h.trim());
  const rows = lines.slice(1).map(line =>
    line.split(/\s{2,}/).map(cell => cell.trim())
  );

  console.log("[Space-separated] Parsed headers:", headers);
  console.log("[Space-separated] Parsed rows:", rows.length);

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Parse markdown table to extract headers and rows
 *
 * @param markdownTable - Table in markdown format
 * @returns Parsed headers and rows
 */
function parseMarkdownTable(markdownTable: string): TableData {
  const lines = markdownTable.trim().split("\n").filter(Boolean);

  if (lines.length < 2) {
    throw new Error("테이블 형식이 올바르지 않습니다");
  }

  // Extract header row (first line)
  const headerLine = lines[0] ?? '';
  const headers = parseMarkdownRow(headerLine);

  // Skip separator line (second line, starts with |---)
  let dataLines = lines.slice(2);

  // Filter out empty rows
  dataLines = dataLines.filter((line) => line.trim() !== "" && line.includes("|"));

  // Parse data rows
  const rows = dataLines.map((line) => parseMarkdownRow(line));

  console.log(`[Table Extracted] ${headers.length} columns, ${rows.length} rows`);
  console.log("[Headers]", headers);

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Parse a single markdown table row
 *
 * @param rowLine - Markdown row string
 * @returns Array of cell values
 */
function parseMarkdownRow(rowLine: string): string[] {
  // Remove leading/trailing |
  let cleanLine = rowLine.trim();
  if (cleanLine.startsWith("|")) {
    cleanLine = cleanLine.slice(1);
  }
  if (cleanLine.endsWith("|")) {
    cleanLine = cleanLine.slice(0, -1);
  }

  // Split by | and trim each cell
  return cleanLine.split("|").map((cell) => cell.trim());
}


/**
 * Extract tables from PDF for template testing
 * 
 * @param pdfBuffer - PDF file buffer
 * @param maxPages - Maximum pages to process (default: 3)
 * @param apiKey - Upstage API key (from DB settings)
 * @returns TableData with headers and rows
 */
export async function extractTablesFromPDF(
  pdfBuffer: Buffer,
  maxPages: number = 3,
  apiKey?: string
): Promise<TableData> {
  console.log(`[extractTablesFromPDF] Processing PDF (maxPages: ${maxPages})...`);
  
  // maxPages로 페이지 제한: 큰 PDF에서 타임아웃 방지
  let processBuffer = pdfBuffer;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    
    if (totalPages > maxPages) {
      console.log(`[extractTablesFromPDF] Limiting from ${totalPages} to ${maxPages} pages`);
      const limitedPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: maxPages }, (_, i) => i);
      const copiedPages = await limitedPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(page => limitedPdf.addPage(page));
      processBuffer = Buffer.from(await limitedPdf.save());
    }
  } catch (e) {
    console.warn(`[extractTablesFromPDF] Page limiting failed, using full PDF:`, e);
  }
  
  const result = await parsePdfWithUpstage(processBuffer, apiKey);
  
  console.log(`[extractTablesFromPDF] Extracted ${result.headers.length} headers, ${result.rows.length} rows`);
  
  return result;
}
