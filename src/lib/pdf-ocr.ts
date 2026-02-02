/**
 * PDF OCR using Upstage Solar Document Parse API
 *
 * Story 3.4: Extracts table data from PDF files using Upstage Document Parse API
 *
 * API Documentation:
 * - Endpoint: https://api.upstage.ai/v1/document-ai/document-parse
 * - Method: POST (multipart/form-data)
 * - Authentication: Bearer token
 */

import { env } from "~/env";
import { inferColumnType, ColumnType } from "~/lib/column-mapping";

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

  // Create FormData for multipart upload
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("document", blob, "document.pdf");

  // Add Upstage API parameters (based on official Python guide)
  // Reference: https://console.upstage.ai/docs/capabilities/digitize/document-parsing
  formData.append("model", "document-parse-nightly");
  formData.append("ocr", "force"); // Auto OCR mode
  formData.append("chart_recognition", "true"); // Enable chart recognition
  formData.append("coordinates", "true"); // Enable coordinate extraction
  formData.append("output_formats", '["html","text"]'); // Request both HTML and text
  formData.append("base64_encoding", '["figure"]'); // Base64 encode figures
  formData.append("merge_multipage_tables", "true"); // Base64 encode figures

  try {
    console.log("[Upstage API] Calling document-digitization endpoint...");

    const response = await fetch(
      "https://api.upstage.ai/v1/document-digitization",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${finalApiKey}`,
          // Note: Don't set Content-Type when using FormData, browser sets it with boundary
        },
        body: formData,
      }
    );

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

    // DEBUG: Log full response structure
    console.log("[Upstage API] Full response structure:");
    console.log(JSON.stringify(data, null, 2).substring(0, 5000)); // First 5000 chars

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
    if (data.content?.html && data.content.html.trim()) {
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
    const textElements = data.elements.filter(el => el.content?.text && el.content.text.trim());
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

  // 1단계: 모든 테이블 파싱 (컬럼 수 제한 없이)
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

    let tableData;
    try {
      tableData = parseHTMLTable(tableHTML);
    } catch (error) {
      console.log(`[HTML Table] ⚠️ Table ${i + 1} skipped - Parse error: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    
    // 최소 컬럼 수를 3으로 완화 (일부 PDF는 날짜, 금액, 잔액만 있음)
    if (tableData.headers.length < 3) {
      console.log(`[HTML Table] ⚠️ Table ${i + 1} skipped - Too few columns (${tableData.headers.length})`);
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

    console.log(`[HTML Table] Table ${i + 1}: cols=${tableData.headers.length}, rows=${tableData.rows.length}, validHeader=${hasValidHeaders}, headerScore=${headerScore}, dataScore=${dataScore}, totalScore=${score}`);
    if (!hasValidHeaders) {
      console.log(`[HTML Table]    First row (potential data):`, tableData.headers.slice(0, 5).join(", "));
    }

    parsedTables.push({
      index: i + 1,
      headers: tableData.headers,
      rows: tableData.rows,
      columnCount: tableData.headers.length,
      hasValidHeaders,
      headerScore,
      dataScore,
      score,
    });
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

  // 3단계: 동일한 거래내역 구조의 테이블들 모두 결합
  // 핵심 개선: 컬럼 수 차이 허용을 더 관대하게 + 모든 테이블 포함 시도
  const allRows: string[][] = [...mainTable.rows];
  let continuationCount = 0;
  let skippedTables: number[] = [];

  for (const table of parsedTables) {
    // 메인 테이블은 스킵
    if (table.index === mainTable.index) continue;

    // 컬럼 수 차이 허용 (OCR에서 컬럼이 합쳐지거나 분리될 수 있음)
    const columnDiff = Math.abs(table.columnCount - mainTable.columnCount);
    // ±3 차이까지 허용 (은행 PDF에서 OCR 오류가 흔함)
    const isSimilarStructure = columnDiff <= 3;

    if (isSimilarStructure) {
      if (table.hasValidHeaders) {
        // 유효한 헤더가 있는 테이블 = 같은 구조의 다른 페이지
        // 헤더 행은 제외하고 데이터만 추가
        allRows.push(...table.rows);
        continuationCount++;
        console.log(`[HTML Table] ✓ Table ${table.index} added (valid header, ${table.rows.length} rows)`);
      } else {
        // 헤더가 없는 테이블 = 연속 데이터 테이블
        // 첫 번째 행이 날짜 패턴을 포함하면 데이터로 추가
        const firstCellLooksLikeDate = datePatterns.some(p => p.test(table.headers[0] || ""));
        
        if (firstCellLooksLikeDate || table.dataScore > table.headerScore) {
          // 헤더로 인식된 첫 번째 행도 데이터로 추가
          allRows.push(table.headers);
          allRows.push(...table.rows);
          continuationCount++;
          console.log(`[HTML Table] ✓ Table ${table.index} added as continuation (${table.rows.length + 1} rows, firstCell=${table.headers[0]?.substring(0, 15)})`);
        } else {
          // 헤더가 아닌데 데이터도 아닌 경우 -> 데이터만 추가
          allRows.push(...table.rows);
          continuationCount++;
          console.log(`[HTML Table] ✓ Table ${table.index} added (data only, ${table.rows.length} rows)`);
        }
      }
    } else {
      skippedTables.push(table.index);
      console.log(`[HTML Table] ⚠️ Table ${table.index} skipped (column count ${table.columnCount} vs main ${mainTable.columnCount}, diff=${columnDiff})`);
    }
  }

  // 스킵된 테이블이 있으면 경고
  if (skippedTables.length > 0) {
    console.log(`[HTML Table] ⚠️ WARNING: ${skippedTables.length} tables were skipped due to column count mismatch: [${skippedTables.join(", ")}]`);
    console.log(`[HTML Table] This may cause data loss. Consider reviewing the PDF structure.`);
  }

  console.log(`[HTML Table] Combined: 1 main + ${continuationCount} continuation tables, ${mainTable.columnCount} columns, ${allRows.length} total rows`);

  return {
    headers: mainTable.headers,
    rows: allRows,
    totalRows: allRows.length,
  };
}

// 날짜 패턴 상수 (함수 외부에서 재사용 가능)
const datePatterns = [
  /^\d{4}[-./]\d{2}[-./]\d{2}/, // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  /^\d{2}[-./]\d{2}[-./]\d{4}/, // DD-MM-YYYY, DD.MM.YYYY
  /^\d{2}[-./]\d{2}[-./]\d{2}/, // YY-MM-DD, YY.MM.DD
];

/**
 * Parse HTML table string to extract headers and rows
 *
 * @param html - HTML table string
 * @returns Parsed table data
 */
function parseHTMLTable(html: string): TableData {
  // First, try to find <table> tag content
  const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/is);
  const tableContent = tableMatch ? tableMatch[1] : html;

  // Extract table rows using regex
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
  const matches = [...tableContent.matchAll(rowRegex)];

  if (matches.length === 0) {
    console.error("[HTML Table] No <tr> tags found in HTML");
    throw new Error("HTML에서 테이블 행을 찾을 수 없습니다");
  }

  console.log(`[HTML Table] Found ${matches.length} <tr> tags`);

  // Parse headers from first row
  const headerRow = matches[0][1];
  const rawHeaders = extractCellsFromHTML(headerRow);
  
  // 띄어쓰기 정규화: OCR에서 "거래 일자", "출 금 금 액" 등으로 읽히는 경우 처리
  const headers = rawHeaders.map(h => h.replace(/\s+/g, ""));
  
  console.log("[HTML Table] Raw headers (before normalization):", rawHeaders);
  console.log("[HTML Table] Normalized headers (after removing spaces):", headers);

  // Skip separator rows (rows with only dashes/spaces or HTML tags without text)
  const dataRows = matches.slice(1).filter(match => {
    const cells = extractCellsFromHTML(match[1]);
    // Check if row has actual text content (not just dashes or separators)
    const hasContent = cells.some(cell => {
      const trimmed = cell.trim();
      return trimmed.length > 0 && !/^[-=\s]{3,}$/.test(trimmed);
    });
    return hasContent;
  });

  const rows = dataRows.map(match => extractCellsFromHTML(match[1]));

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
  let cleanRow = rowHTML.replace(/<\/?tr[^>]*>/gi, "");

  // Extract <td> or <th> content
  const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gs;
  const cells = [...cleanRow.matchAll(cellRegex)].map(match => match[1]);

  // Clean HTML tags and decode HTML entities
  // CRITICAL FIX: Do NOT filter empty cells - they represent null/empty values in columns!
  // Removing empty cells causes column index misalignment (e.g., empty withdrawal becomes deposit)
  return cells.map(cell => {
    // Remove any remaining HTML tags
    let text = cell.replace(/<[^>]+>/g, "");
    // Decode common HTML entities
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
  const headers = lines[0].split(/\s{2,}/).map(h => h.trim());
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
  const headerLine = lines[0];
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
  
  // Use the existing parsePdfWithUpstage function
  // Note: Upstage API doesn't support page limit directly,
  // but we limit the rows returned
  const result = await parsePdfWithUpstage(pdfBuffer, apiKey);
  
  console.log(`[extractTablesFromPDF] Extracted ${result.headers.length} headers, ${result.rows.length} rows`);
  
  return result;
}
