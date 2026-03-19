import { describe, expect, it } from "vitest";

import { parseRowWithTemplate } from "~/lib/template-classifier";

describe("template-classifier 단일 거래금액 처리", () => {
  it("거래구분 매핑이 없고 거래금액만 있으면 음수는 출금으로 본다", () => {
    const result = parseRowWithTemplate(
      ["2025.01.01 20:04:42", "장승용", "NH농협은행", "-6,000", "25,328,431"],
      {
        date: 0,
        memo: 1,
        amount: 3,
        balance: 4,
      },
      false,
    );

    expect(result?.depositAmount).toBeNull();
    expect(result?.withdrawalAmount).toBe(6000);
  });

  it("거래구분 매핑이 없고 거래금액만 있으면 양수/무부호는 입금으로 본다", () => {
    const result = parseRowWithTemplate(
      ["2025.01.02 10:40:36", "이기선", "신한은행", "200,000", "25,518,431"],
      {
        date: 0,
        memo: 1,
        amount: 3,
        balance: 4,
      },
      false,
    );

    expect(result?.depositAmount).toBe(200000);
    expect(result?.withdrawalAmount).toBeNull();
  });
});