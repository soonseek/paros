import { describe, expect, it } from "vitest";

import { detectHeaderRowFromRawData, looksLikeHeaderRow } from "~/lib/header-row-detector";

describe("header-row-detector", () => {
  it("헤더처럼 보이는 행을 인식한다", () => {
    expect(looksLikeHeaderRow(["거래일자", "찾으신금액", "맡기신금액", "잔액"]))
      .toBe(true);
  });

  it("상단 안내 행이 있어도 실제 헤더 행을 찾는다", () => {
    const result = detectHeaderRowFromRawData([
      ["우체국 예금거래내역", "", "", ""],
      ["조회기간", "2024.01.01~2024.01.31", "", ""],
      ["거래일자", "적요", "찾으신금액", "맡기신금액", "잔액"],
      ["2024.01.02", "보험료", "10,000", "", "90,000"],
    ]);

    expect(result.headerRowIndex).toBe(2);
    expect(result.headers[0]).toBe("거래일자");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.[1]).toBe("보험료");
  });

  it("첫 행이 이미 헤더면 그대로 사용한다", () => {
    const result = detectHeaderRowFromRawData([
      ["거래일자", "내용", "찾으신금액", "맡기신금액", "비고", "잔액"],
      ["2024.01.03", "ATM", "20,000", "", "", "70,000"],
    ]);

    expect(result.headerRowIndex).toBe(0);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0]?.[0]).toBe("2024.01.03");
  });
});