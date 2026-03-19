import { ColumnType, inferColumnType } from "~/lib/column-mapping";

export interface HeaderRowDetectionResult {
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function looksLikeHeaderRow(row: string[]): boolean {
  const matchingColumns = row.filter((cell) => {
    return typeof cell === "string" && inferColumnType(cell) !== ColumnType.UNKNOWN;
  });

  return matchingColumns.length >= 2;
}

export function detectHeaderRowFromRawData(
  rawData: unknown[][],
  maxScanRows: number = 5,
): HeaderRowDetectionResult {
  if (rawData.length === 0) {
    return {
      headerRowIndex: 0,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  let headerRowIndex = 0;
  let headers = (rawData[0] || []).map((cell) => String(cell ?? ""));

  if (!looksLikeHeaderRow(headers)) {
    for (let i = 1; i < Math.min(maxScanRows, rawData.length); i++) {
      const candidate = (rawData[i] || []).map((cell) => String(cell ?? ""));
      if (looksLikeHeaderRow(candidate)) {
        headerRowIndex = i;
        headers = candidate;
        break;
      }
    }
  }

  const rows = rawData.slice(headerRowIndex + 1).map((row) =>
    (row || []).map((cell) => String(cell ?? ""))
  );

  return {
    headerRowIndex,
    headers,
    rows,
    totalRows: rows.length,
  };
}