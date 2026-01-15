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

interface UpstageDocumentParseResponse {
  elements?: Array<{
    id: string;
    type: string; // "text", "table", "figure", etc.
    category?: string; // "table", "text", etc.
    content?: {
      html?: string;
      text?: string;
    };
    bbox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    page?: number;
  }>;
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
    standard: number[];
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
  formData.append("output_formats", '["html"]'); // Output format as JSON array string
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

    // Extract text from elements
    if (!data.elements || data.elements.length === 0) {
      console.error("[Upstage API] No elements in response");
      throw new Error("Upstage API에서 데이터를 추출하지 못했습니다");
    }

    // Find table elements or concatenate all text
    const tableElements = data.elements.filter(el => el.category === "table");

    if (tableElements.length > 0) {
      console.log(`[Upstage API] Found ${tableElements.length} table(s)`);
      // Process table elements from HTML
      return extractFromTableElementsHTML(tableElements);
    }

    // Fallback: Concatenate all text elements
    const allText = data.elements
      .filter(el => el.content?.html || el.content?.text)
      .map(el => el.content?.html || el.content?.text || "")
      .join("\n");

    console.log(`[Upstage API] Extracted ${allText.length} characters of text`);
    console.log("[Upstage API] Text preview:", allText.substring(0, 200));

    if (!allText.trim()) {
      console.error("[Upstage API] No text content found");
      throw new Error("Upstage API에서 텍스트를 추출하지 못했습니다");
    }

    // Try to parse as table
    return extractTableFromText(allText);
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

  // Parse all tables and combine them
  const allRows: string[][] = [];
  let headers: string[] = [];

  for (let i = 0; i < tableElements.length; i++) {
    const tableHTML = tableElements[i]?.content?.html;
    if (!tableHTML) continue;

    console.log(`[HTML Table] Processing table ${i + 1}/${tableElements.length}...`);

    const tableData = parseHTMLTable(tableHTML);

    // Use headers from first table
    if (i === 0) {
      headers = tableData.headers;
    }

    // Add rows (skip header rows from subsequent tables)
    allRows.push(...tableData.rows);
  }

  console.log(`[HTML Table] Combined: ${headers.length} columns, ${allRows.length} total rows`);

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
  // Extract table rows using regex
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
  const matches = [...html.matchAll(rowRegex)];

  if (matches.length === 0) {
    throw new Error("HTML에서 테이블 행을 찾을 수 없습니다");
  }

  // Parse headers from first row
  const headerRow = matches[0][1];
  const headers = extractCellsFromHTML(headerRow);

  // Parse data rows (skip header row)
  const rows = matches.slice(1).map(match => extractCellsFromHTML(match[1]));

  console.log(`[HTML Table] ${headers.length} columns, ${rows.length} rows`);
  console.log("[Headers]", headers);

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
  // Split into lines and filter
  const lines = text.split("\n").filter(line => line.trim());

  // Find table-like structures (lines with | separator are markdown tables)
  const tableLines = lines.filter(line => line.includes("|"));

  if (tableLines.length < 2) {
    // If no markdown table found, try to parse as space-separated columns
    return parseSpaceSeparatedTable(text);
  }

  // Parse markdown table
  return parseMarkdownTable(tableLines.join("\n"));
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

  // Try to detect column alignment by looking at consistent spacing patterns
  // For now, simple split by 2+ spaces
  const headers = lines[0].split(/\s{2,}/).map(h => h.trim());
  const rows = lines.slice(1).map(line =>
    line.split(/\s{2,}/).map(cell => cell.trim())
  );

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
