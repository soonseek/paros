import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildLoanTrackingExcelBuffer } from "~/lib/export/loan-tracking-excel";

describe("loan-tracking-excel", () => {
  it("헤더, 요약, 타입별 스타일과 필터를 만든다", async () => {
    const buffer = await buildLoanTrackingExcelBuffer({
      loanDate: "2025-11-14T00:00:00.000Z",
      loanAmount: 23500000,
      loanMemo: "롯데카드론",
      loanDocumentName: "수협은행.pdf",
      summary: {
        totalUsed: 100430,
        transferCount: 1,
        remainingLoan: 23399570,
        exhausted: false,
      },
      trackedItems: [
        {
          date: "2025-11-14T00:00:00.000Z",
          type: "대출실행",
          amount: 23500000,
          remainingLoan: 23500000,
          memo: "롯데카드론",
          documentName: "수협은행.pdf",
        },
        {
          date: "2025-11-14T00:00:00.000Z",
          type: "이동",
          amount: 10000000,
          remainingLoan: 23500000,
          memo: "092이기선",
          documentName: "수협은행.pdf",
          transferTo: "토스뱅크 1925.pdf",
        },
        {
          date: "2025-11-14T00:00:00.000Z",
          type: "출금",
          amount: 30000,
          remainingLoan: 23470000,
          memo: "Te amo",
          documentName: "토스뱅크 1925.pdf",
          transferFrom: "수협은행.pdf",
        },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("대출금 사용 내역");

    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell("A1").value).toBe("대출금 사용 흐름");
    expect(worksheet?.autoFilter).toBeDefined();
    expect(worksheet?.views?.[0]?.state).toBe("frozen");
    expect(worksheet?.getCell("A2").value).toBe("대출 실행일");
    expect(worksheet?.getCell("A3").value).toBe("순번");
    expect(worksheet?.getCell("C4").value).toBe("대출실행");
    expect(worksheet?.getCell("C5").value).toBe("이동");
    expect(worksheet?.getCell("G4").value).toBe("수협은행");
    expect(worksheet?.getCell("H6").value).toBe("↳ 이동 후 사용");
    expect(worksheet?.getColumn(6).width).toBeLessThanOrEqual(18);
  });
});