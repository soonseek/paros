import { autoFitColumns, createWorkbook } from "~/lib/export/excel";

export interface LoanTrackingExportItem {
  date: string;
  type: "대출실행" | "출금" | "이동";
  amount: number;
  remainingLoan: number;
  memo: string;
  documentName: string;
  transferTo?: string;
  transferFrom?: string;
}

export interface LoanTrackingExportResult {
  loanDate: string;
  loanAmount: number;
  loanMemo: string;
  loanDocumentName: string;
  trackedItems: LoanTrackingExportItem[];
  summary: {
    totalUsed: number;
    transferCount: number;
    remainingLoan: number;
    exhausted: boolean;
  };
}

const COLORS = {
  title: "FF0F172A",
  headerBg: "FF1E293B",
  headerText: "FFFFFFFF",
  summaryBg: "FFF8FAFC",
  summaryLabel: "FF475569",
  summaryValue: "FF0F172A",
  loanBg: "FFE0F2FE",
  loanText: "FF0C4A6E",
  transferBg: "FFF3E8FF",
  transferText: "FF6B21A8",
  withdrawalBg: "FFFFFFFF",
  withdrawalText: "FF7F1D1D",
  exhaustedBg: "FFDCFCE7",
  exhaustedText: "FF166534",
  border: "FFE2E8F0",
  subtle: "FF64748B",
  zebra: "FFF8FAFC",
} as const;

function formatDateOnly(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}

function setCellBorder(cell: { border: unknown }) {
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function setFilledRowStyle(
  row: { eachCell: (callback: (cell: any, colNumber: number) => void) => void },
  fillColor: string,
  textColor: string,
) {
  row.eachCell((cell, colNumber) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    };
    cell.font = {
      name: "Malgun Gothic",
      size: 10,
      color: { argb: textColor },
      bold: colNumber <= 5,
    };
    setCellBorder(cell);
  });
}

function getFlowLabel(item: LoanTrackingExportItem): string {
  if (item.transferTo) {
    return `→ ${shortenDocumentName(item.transferTo)}`;
  }

  if (item.transferFrom) {
    return `↳ 이동 후 사용`;
  }

  return "";
}

function shortenDocumentName(value: string): string {
  return value.replace(/\.(pdf|xlsx?|csv)$/i, "").trim();
}

export async function buildLoanTrackingExcelBuffer(
  result: LoanTrackingExportResult,
): Promise<ArrayBuffer> {
  const workbook = createWorkbook();
  const worksheet = workbook.addWorksheet("대출금 사용 내역");

  worksheet.views = [{ state: "frozen", ySplit: 3 }];

  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "대출금 사용 흐름";
  titleCell.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: COLORS.title } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };

  const summaryRow = worksheet.addRow([
    "대출 실행일",
    formatDateOnly(result.loanDate),
    "대출금",
    result.loanAmount,
    "사용 금액",
    result.summary.totalUsed,
    "잔여 금액",
    result.summary.remainingLoan,
  ]);
  summaryRow.height = 24;
  summaryRow.eachCell((cell, index) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.summaryBg },
    };
    cell.font = {
      name: "Malgun Gothic",
      size: 10,
      bold: index % 2 === 1,
      color: { argb: index % 2 === 1 ? COLORS.summaryLabel : COLORS.summaryValue },
    };
    cell.alignment = {
      horizontal: index % 2 === 0 ? "right" : "left",
      vertical: "middle",
    };
    setCellBorder(cell);
    if (index === 4 || index === 6 || index === 8) {
      cell.numFmt = '#,##0"원"';
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
  });

  worksheet.addRow(["순번", "날짜", "구분", "금액", "남은 대출금", "비고", "파일", "흐름"]);
  const headerRow = worksheet.getRow(3);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerBg },
    };
    cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: COLORS.headerText } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    setCellBorder(cell);
  });

  worksheet.autoFilter = {
    from: "A3",
    to: "H3",
  };

  result.trackedItems.forEach((item, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      formatDateOnly(item.date),
      item.type,
      item.amount,
      item.remainingLoan,
      item.memo || "",
      shortenDocumentName(item.documentName || ""),
      getFlowLabel(item),
    ]);

    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Malgun Gothic", size: 10, color: { argb: COLORS.summaryValue } };
      cell.alignment = {
        horizontal: colNumber === 1 || colNumber === 3 ? "center" : colNumber === 4 || colNumber === 5 ? "right" : "left",
        vertical: "middle",
        wrapText: colNumber === 6,
      };
      setCellBorder(cell);
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      });
    }

    row.getCell(4).numFmt = '#,##0"원"';
    row.getCell(5).numFmt = '#,##0"원"';

    if (item.transferFrom) {
      row.getCell(6).alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
      row.getCell(8).alignment = { horizontal: "left", vertical: "middle", wrapText: false, indent: 1 };
    }

    if (item.type === "대출실행") {
      setFilledRowStyle(row, COLORS.loanBg, COLORS.loanText);
    } else if (item.type === "이동") {
      setFilledRowStyle(row, COLORS.transferBg, COLORS.transferText);
    } else {
      row.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF7ED" },
      };
      row.getCell(3).font = {
        name: "Malgun Gothic",
        size: 10,
        bold: true,
        color: { argb: COLORS.withdrawalText },
      };
      row.getCell(4).font = {
        name: "Malgun Gothic",
        size: 10,
        bold: true,
        color: { argb: COLORS.withdrawalText },
      };
    }

    if (item.remainingLoan === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.exhaustedBg },
        };
        setCellBorder(cell);
      });
      row.getCell(5).font = {
        name: "Malgun Gothic",
        size: 11,
        bold: true,
        color: { argb: COLORS.exhaustedText },
      };
      row.getCell(3).font = {
        name: "Malgun Gothic",
        size: 10,
        bold: true,
        color: { argb: COLORS.exhaustedText },
      };
    }
  });

  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 10;
  worksheet.getColumn(4).width = 13;
  worksheet.getColumn(5).width = 13;
  worksheet.getColumn(6).width = 18;
  worksheet.getColumn(7).width = 13;
  worksheet.getColumn(8).width = 12;

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}