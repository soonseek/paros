export interface InternalTransferCandidate {
  id: string;
  transactionDate: string;
  depositAmount: number;
  withdrawalAmount: number;
  memo: string;
  documentId: string;
  documentName: string;
}

export interface DetectedInternalTransfer {
  withdrawalTransactionId: string;
  depositTransactionId: string;
  withdrawalDate: string;
  depositDate: string;
  amount: number;
  fromDocumentId: string;
  fromDocumentName: string;
  toDocumentId: string;
  toDocumentName: string;
  withdrawalMemo: string;
  depositMemo: string;
  confidence: number;
  matchReason: string;
}

function hasTransferKeyword(value: string): boolean {
  return /(이체|송금|입금이체|출금이체|보내기|받기|振込)/i.test(value);
}

function getDayDiff(left: Date, right: Date): number {
  return Math.abs(left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24);
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function detectInternalTransfers(
  candidates: InternalTransferCandidate[],
  maxDayDiff: number = 1,
): DetectedInternalTransfer[] {
  const withdrawals = candidates
    .filter((tx) => tx.withdrawalAmount > 0)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  const deposits = candidates
    .filter((tx) => tx.depositAmount > 0)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  const usedDepositIds = new Set<string>();
  const matches: DetectedInternalTransfer[] = [];

  for (const withdrawal of withdrawals) {
    const withdrawalDate = new Date(withdrawal.transactionDate);

    const possibleDeposits = deposits.filter((deposit) => {
      if (usedDepositIds.has(deposit.id)) return false;
      if (deposit.documentId === withdrawal.documentId) return false;
      if (deposit.depositAmount !== withdrawal.withdrawalAmount) return false;

      const depositDate = new Date(deposit.transactionDate);
      return getDayDiff(withdrawalDate, depositDate) <= maxDayDiff;
    });

    if (possibleDeposits.length === 0) continue;

    possibleDeposits.sort((left, right) => {
      const leftDiff = getDayDiff(withdrawalDate, new Date(left.transactionDate));
      const rightDiff = getDayDiff(withdrawalDate, new Date(right.transactionDate));
      return leftDiff - rightDiff;
    });

    const matchedDeposit = possibleDeposits[0];
    if (!matchedDeposit) continue;

    usedDepositIds.add(matchedDeposit.id);

    const depositDate = new Date(matchedDeposit.transactionDate);
    const sameDay = toDateKey(withdrawalDate) === toDateKey(depositDate);
    const keywordMatched = hasTransferKeyword(withdrawal.memo) || hasTransferKeyword(matchedDeposit.memo);
    const confidence = Math.min(0.95, (sameDay ? 0.85 : 0.72) + (keywordMatched ? 0.1 : 0));

    matches.push({
      withdrawalTransactionId: withdrawal.id,
      depositTransactionId: matchedDeposit.id,
      withdrawalDate: withdrawal.transactionDate,
      depositDate: matchedDeposit.transactionDate,
      amount: withdrawal.withdrawalAmount,
      fromDocumentId: withdrawal.documentId,
      fromDocumentName: withdrawal.documentName,
      toDocumentId: matchedDeposit.documentId,
      toDocumentName: matchedDeposit.documentName,
      withdrawalMemo: withdrawal.memo,
      depositMemo: matchedDeposit.memo,
      confidence,
      matchReason: sameDay
        ? (keywordMatched ? "같은 날 동일 금액 + 이체 키워드 일치" : "같은 날 동일 금액 일치")
        : (keywordMatched ? "1일 이내 동일 금액 + 이체 키워드 일치" : "1일 이내 동일 금액 일치"),
    });
  }

  return matches;
}