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
}

/**
 * Parse PDF using Upstage Document Parse API
 *
 * @param pdfBuffer - PDF file buffer
 * @returns Parsed table data with headers and rows
 * @throws Error if API call fails
 */
export async function parsePdfWithUpstage(
  pdfBuffer: Buffer
): Promise<TableData> {
  const apiKey = env.UPSTAGE_API_KEY;

  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다");
  }

  // Create FormData for multipart upload
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("document", blob, "document.pdf");

  // Add Upstage API parameters (based on official Python guide)
  // Reference: https://console.upstage.ai/docs/capabilities/digitize/document-parsing
  formData.append("model", "document-parse-nightly");
  formData.append("ocr", "auto"); // Auto OCR mode
  formData.append("chart_recognition", "true"); // Enable chart recognition
  formData.append("coordinates", "true"); // Enable coordinate extraction
  formData.append("output_formats", '["html","text"]'); // Request both HTML and text
  formData.append("base64_encoding", '["figure"]'); // Base64 encode figures

  try {
    console.log("[Upstage API] Calling document-digitization endpoint...");
    console.log("[Upstage API] Parameters: model=document-parse-nightly, ocr=auto, chart_recognition=true, coordinates=true, output_formats=[html]");

    const response = await fetch(
      "https://api.upstage.ai/v1/document-digitization",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

    // Find table elements or concatenate all text
    const tableElements = data.elements.filter(el => el.category === "table");
    const listElements = data.elements.filter(el => el.category === "list");

    console.log(`[Upstage API] Found ${tableElements.length} table elements`);
    console.log(`[Upstage API] Found ${listElements.length} list elements`);

    if (tableElements.length > 0) {
      console.log(`[Upstage API] Processing ${tableElements.length} table(s)...`);
      // Process table elements from HTML
      return extractFromTableElementsHTML(tableElements);
    }

    // Try list elements (some PDFs use list format for tables)
    if (listElements.length > 0) {
      console.log(`[Upstage API] Processing ${listElements.length} list(s)...`);
      try {
        return extractFromTableElementsHTML(listElements);
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
        return extractTableFromText(data.content.html);
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

  // Parse all tables and filter for transaction history tables (must have date column)
  const allRows: string[][] = [];
  let headers: string[] = [];
  let validTableCount = 0;

  for (let i = 0; i < tableElements.length; i++) {
    const tableHTML = tableElements[i]?.content?.html;
    if (!tableHTML) continue;

    console.log(`[HTML Table] Processing table ${i + 1}/${tableElements.length}...`);
    console.log(`[HTML Table] Raw HTML preview:`, tableHTML.substring(0, 300));

    const tableData = parseHTMLTable(tableHTML);

    // Validate table has date column (required for transaction history)
    const hasDateColumn = tableData.headers.some(header => {
      const columnType = inferColumnType(header);
      return columnType === ColumnType.DATE;
    });

    if (!hasDateColumn) {
      console.log(`[HTML Table] ⚠️ Table ${i + 1} skipped - No date column found (not a transaction table)`);
      console.log(`[HTML Table]    Headers:`, tableData.headers.join(", "));
      continue;
    }

    console.log(`[HTML Table] ✓ Table ${i + 1} validated - Has date column`);
    validTableCount++;

    // Use headers from first valid table
    if (validTableCount === 1 && tableData.headers.length > 0) {
      headers = tableData.headers;
    }

    // Add rows (skip header rows from subsequent tables)
    allRows.push(...tableData.rows);
  }

  if (validTableCount === 0) {
    console.error("[HTML Table] ✗ No valid transaction history tables found (all tables missing date column)");
    throw new Error("PDF에서 거래내역 테이블을 찾을 수 없습니다 (날짜 열이 없는 테이블만 있음)");
  }

  console.log(`[HTML Table] Combined: ${validTableCount} valid tables, ${headers.length} columns, ${allRows.length} total rows`);

  return {
    headers,
    rows: allRows,
    totalRows: allRows.length,
  };
}

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
  const headers = extractCellsFromHTML(headerRow);

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
  console.log("[HTML Table] Headers:", headers);

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
