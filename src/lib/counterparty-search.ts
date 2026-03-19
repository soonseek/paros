export interface CounterpartySearchCandidate {
  memo?: string | null;
  creditorName?: string | null;
  rawMetadata?: unknown;
}

export interface CounterpartyMatchResult {
  matched: boolean;
  matchedFields: string[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDenseText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function flattenMetadataValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenMetadataValues(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenMetadataValues(item));
  }

  return [];
}

export function matchCounterpartyQuery(
  transaction: CounterpartySearchCandidate,
  query: string,
): CounterpartyMatchResult {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { matched: false, matchedFields: [] };
  }

  const queryText = normalizeText(trimmedQuery);
  const queryDense = normalizeDenseText(trimmedQuery);
  const queryDigits = normalizeDigits(trimmedQuery);
  const matchedFields = new Set<string>();

  const evaluateValue = (fieldLabel: string, value: string | null | undefined) => {
    if (!value) return;

    const text = normalizeText(value);
    const dense = normalizeDenseText(value);
    const digits = normalizeDigits(value);

    const matchedByText = queryText.length > 0 && (text.includes(queryText) || dense.includes(queryDense));
    const matchedByDigits = queryDigits.length >= 4 && digits.includes(queryDigits);

    if (matchedByText || matchedByDigits) {
      matchedFields.add(fieldLabel);
    }
  };

  evaluateValue("비고", transaction.memo);
  evaluateValue("채권자명", transaction.creditorName);

  for (const value of flattenMetadataValues(transaction.rawMetadata)) {
    const beforeSize = matchedFields.size;
    evaluateValue("원본데이터", value);
    if (matchedFields.size > beforeSize) {
      break;
    }
  }

  return {
    matched: matchedFields.size > 0,
    matchedFields: [...matchedFields],
  };
}