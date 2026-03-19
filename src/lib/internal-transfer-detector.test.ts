import { describe, expect, it } from "vitest";

import { detectInternalTransfers } from "~/lib/internal-transfer-detector";

describe("internal-transfer-detector", () => {
  it("같은 날 같은 금액의 다른 문서 입출금을 내부이체로 연결한다", () => {
    const matches = detectInternalTransfers([
      {
        id: "w1",
        transactionDate: "2024-01-01T09:00:00.000Z",
        depositAmount: 0,
        withdrawalAmount: 500000,
        memo: "본인계좌 이체",
        documentId: "doc-a",
        documentName: "국민은행",
      },
      {
        id: "d1",
        transactionDate: "2024-01-01T09:05:00.000Z",
        depositAmount: 500000,
        withdrawalAmount: 0,
        memo: "이체입금",
        documentId: "doc-b",
        documentName: "우리은행",
      },
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.fromDocumentName).toBe("국민은행");
    expect(matches[0]?.toDocumentName).toBe("우리은행");
    expect(matches[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("같은 문서 안의 입출금은 내부이체로 연결하지 않는다", () => {
    const matches = detectInternalTransfers([
      {
        id: "w1",
        transactionDate: "2024-01-01T09:00:00.000Z",
        depositAmount: 0,
        withdrawalAmount: 500000,
        memo: "이체",
        documentId: "doc-a",
        documentName: "국민은행",
      },
      {
        id: "d1",
        transactionDate: "2024-01-01T09:05:00.000Z",
        depositAmount: 500000,
        withdrawalAmount: 0,
        memo: "이체입금",
        documentId: "doc-a",
        documentName: "국민은행",
      },
    ]);

    expect(matches).toHaveLength(0);
  });

  it("다음 날 입금도 1일 이내면 연결한다", () => {
    const matches = detectInternalTransfers([
      {
        id: "w1",
        transactionDate: "2024-01-01T18:00:00.000Z",
        depositAmount: 0,
        withdrawalAmount: 800000,
        memo: "송금",
        documentId: "doc-a",
        documentName: "국민은행",
      },
      {
        id: "d1",
        transactionDate: "2024-01-02T09:00:00.000Z",
        depositAmount: 800000,
        withdrawalAmount: 0,
        memo: "받기",
        documentId: "doc-b",
        documentName: "토스뱅크",
      },
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchReason).toContain("1일 이내");
  });
});