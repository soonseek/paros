export interface TableDataLike {
  headers: string[];
  rows: string[][];
  totalRows?: number;
}

export const UNSUPPORTED_MERGED_LEDGER_MESSAGE =
  "거래내역의 일자, 비고 등 표현이 완전하지 않은 문서(우리은행 일부 내역 등)";

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, "");
}

function findDate(value: string): string {
  const match = value.match(/(20\d{2}\.\d{2}\.\d{2})/);
  return match?.[1] || "";
}

function findTime(value: string): string {
  const normalized = value.replace(/;/g, ":");
  const match = normalized.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
  return match?.[1] || "";
}

function extractMemoFromMerged(value: string): string {
  const normalized = value.replace(/;/g, ":");
  const withoutDate = normalized.replace(/20\d{2}\.\d{2}\.\d{2}/, "");
  const withoutTime = withoutDate.replace(/\d{1,2}:\d{2}(?::\d{2})?\s*:?[ ]*/, "");
  return withoutTime.replace(/^[:\s]+/, "").trim();
}

function numericTokens(value: string): string[] {
  return value.match(/-?[\d,]+/g) || [];
}

function firstNumeric(value: string): string {
  return numericTokens(value)[0] || "";
}

function splitTextAndTrailingAmount(value: string): { text: string; amount: string } {
  const match = value.match(/^(.*?)(-?[\d,]+)\s*$/);
  if (!match) {
    return { text: value.trim(), amount: "" };
  }

  return {
    text: (match[1] || "").trim(),
    amount: match[2] || "",
  };
}

function splitBalanceAndBranch(balanceCell: string, branchCell: string): { balance: string; branch: string } {
  if (branchCell.trim()) {
    return {
      balance: firstNumeric(balanceCell),
      branch: branchCell.trim(),
    };
  }

  const match = balanceCell.match(/^(-?[\d,]+)\s+(.*)$/);
  if (match) {
    return {
      balance: match[1] || "",
      branch: (match[2] || "").trim(),
    };
  }

  return {
    balance: firstNumeric(balanceCell),
    branch: "",
  };
}

function buildMergedDateMemo(date: string, time: string, memo: string): string {
  const prefix = [date, time].filter(Boolean).join(" ").trim();
  if (prefix && memo) {
    return `${prefix}: ${memo}`;
  }
  return prefix || memo;
}

function looksLikeWooriMergedHeader(headers: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.length === 8 &&
    normalizedHeaders[0] === "No." &&
    Boolean(normalizedHeaders[1]?.includes("거래일시적요")) &&
    Boolean(normalizedHeaders[2]?.includes("기재내용")) &&
    Boolean(normalizedHeaders[3]?.includes("지급(원)")) &&
    Boolean(normalizedHeaders[4]?.includes("입금(원)")) &&
    Boolean(normalizedHeaders[5]?.includes("거래후잔액(원)")) &&
    Boolean(normalizedHeaders[6]?.includes("취급점")) &&
    Boolean(normalizedHeaders[7]?.includes("메모수표"));
}

function countProfileSignals(rows: string[][]): number {
  let signals = 0;

  if (rows.some((row) => /\b\d+\s+20\d{2}\.\d{2}\.\d{2}\b/.test(row[0] || ""))) {
    signals += 1;
  }

  if (rows.some((row) => /^\d{1,2}:\d{2}[:;]?\s+/.test(row[1] || ""))) {
    signals += 1;
  }

  if (rows.some((row) => numericTokens(row[4] || "").length >= 2)) {
    signals += 1;
  }

  if (rows.some((row) => /^-?[\d,]+\s+[가-힣A-Za-z]/.test(row[6] || ""))) {
    signals += 1;
  }

  if (rows.some((row) => row[2] === "" && /.*-?[\d,]+\s*$/.test(row[3] || ""))) {
    signals += 1;
  }

  return signals;
}

export function detectWooriMergedLedgerProfile(headers: string[], rows: string[][]): boolean {
  if (!looksLikeWooriMergedHeader(headers)) {
    return false;
  }

  return countProfileSignals(rows.slice(0, 10)) >= 3;
}

function normalizeRow(row: string[]): string[] {
  const normalized = new Array(8).fill("") as string[];

  const rowNumberCell = row[0] || "";
  const mergedDateCell = row[1] || "";
  const col2 = row[2] || "";
  const col3 = row[3] || "";
  const col4 = row[4] || "";
  const col5 = row[5] || "";
  const col6 = row[6] || "";
  const col7 = row[7] || "";

  const rowNumber = (rowNumberCell.match(/^\d+/)?.[0] || "").trim();
  const dateFrom0 = findDate(rowNumberCell);
  const dateFrom1 = findDate(mergedDateCell);
  const timeFrom1 = findTime(mergedDateCell);
  const memoFrom1 = extractMemoFromMerged(mergedDateCell);

  normalized[0] = rowNumber;

  if (dateFrom0 && timeFrom1) {
    const memo = memoFrom1;
    normalized[1] = buildMergedDateMemo(dateFrom0, timeFrom1, memo);

    if (!col2.trim() && /.*-?[\d,]+\s*$/.test(col3)) {
      const split = splitTextAndTrailingAmount(col3);
      const balanceBranch = splitBalanceAndBranch(col6, "");

      normalized[2] = split.text;
      normalized[3] = split.amount;
      normalized[4] = firstNumeric(col4);
      normalized[5] = balanceBranch.balance;
      normalized[6] = balanceBranch.branch;
      normalized[7] = col7.trim();
      return normalized;
    }

    const balanceBranch = splitBalanceAndBranch(col5, col6);
    normalized[2] = col2.trim();
    normalized[3] = firstNumeric(col3);
    normalized[4] = firstNumeric(col4);
    normalized[5] = balanceBranch.balance;
    normalized[6] = balanceBranch.branch;
    normalized[7] = col7.trim();
    return normalized;
  }

  if (dateFrom1 && !memoFrom1 && numericTokens(col4).length >= 2) {
    const amountTokens = numericTokens(col4);
    const balanceBranch = splitBalanceAndBranch(col5, col6);

    normalized[1] = buildMergedDateMemo(dateFrom1, timeFrom1, col2.trim());
    normalized[2] = col3.trim();
    normalized[3] = amountTokens[0] || "";
    normalized[4] = amountTokens[1] || "";
    normalized[5] = balanceBranch.balance;
    normalized[6] = balanceBranch.branch;
    normalized[7] = col7.trim();
    return normalized;
  }

  const balanceBranch = splitBalanceAndBranch(col5, col6);
  normalized[1] = buildMergedDateMemo(dateFrom1, timeFrom1, memoFrom1);
  normalized[2] = col2.trim();
  normalized[3] = firstNumeric(col3);
  normalized[4] = firstNumeric(col4);
  normalized[5] = balanceBranch.balance;
  normalized[6] = balanceBranch.branch;
  normalized[7] = col7.trim();
  return normalized;
}

export function maybeNormalizeWooriMergedLedgerTable<T extends TableDataLike>(table: T): T {
  if (!detectWooriMergedLedgerProfile(table.headers, table.rows)) {
    return table;
  }

  const normalizedRows = table.rows.map((row) => normalizeRow(row));

  return {
    ...table,
    rows: normalizedRows,
    totalRows: normalizedRows.length,
  };
}