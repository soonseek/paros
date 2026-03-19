import { describe, expect, it } from "vitest";

import { TRANSACTION_UPLOAD_ACCEPT } from "~/components/upload-zone";

describe("FileUploadZone 업로드 형식", () => {
  it("업비트용 CSV/엑셀 업로드 형식을 허용한다", () => {
    expect(TRANSACTION_UPLOAD_ACCEPT["text/csv"]).toContain(".csv");
    expect(TRANSACTION_UPLOAD_ACCEPT["application/csv"]).toContain(".csv");
    expect(TRANSACTION_UPLOAD_ACCEPT["application/vnd.ms-excel"]).toContain(".xls");
    expect(
      TRANSACTION_UPLOAD_ACCEPT["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    ).toContain(".xlsx");
  });

  it("기존 PDF 업로드도 계속 허용한다", () => {
    expect(TRANSACTION_UPLOAD_ACCEPT["application/pdf"]).toContain(".pdf");
    expect(TRANSACTION_UPLOAD_ACCEPT["application/vnd.epapyrus.plugin.pdf"]).toContain(".pdf");
  });
});