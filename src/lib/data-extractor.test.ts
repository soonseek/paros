import { describe, expect, it, vi } from "vitest";

import {
  extractAndSaveTransactions,
  inferReferenceDateFromRows,
  mergePairedRows,
  normalizeMemoText,
  parseBalance,
  parseDate,
  resolveTransactionDateFromRow,
  type ColumnMapping,
} from "~/lib/data-extractor";

describe("data-extractor 회귀 방지", () => {
  it("년도 없는 날짜는 문서 기준 연도를 사용한다", () => {
    const parsed = parseDate("01.08", {
      referenceDate: new Date("2024-01-31T00:00:00.000Z"),
    });

    expect(parsed?.getFullYear()).toBe(2024);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(8);
  });

  it("구분자 없는 YYYYMMDD 날짜도 파싱한다", () => {
    const parsed = parseDate("20251125");

    expect(parsed?.getFullYear()).toBe(2025);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(25);
  });

  it("마이너스통장 잔액의 부호를 보존한다", () => {
    expect(parseBalance("-49,146,022")).toBe(-49146022);
    expect(parseBalance("-49,246,022 중소벤처기업진")).toBe(-49246022);
  });

  it("연말 기준 날짜는 연초로 넘어가면 다음 해로 보정한다", () => {
    const parsed = parseDate("01.02", {
      referenceDate: new Date("2024-12-31T00:00:00.000Z"),
    });

    expect(parsed?.getFullYear()).toBe(2025);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(2);
  });

  it("시간이 붙은 메모는 순수 비고만 남긴다", () => {
    expect(normalizeMemoText("11:01: 자동이체")).toBe("자동이체");
    expect(normalizeMemoText("2025.01.08 17:10: F/B출금")).toBe("F/B출금");
  });

  it("문서에서 기준 날짜를 찾아 연도 추론에 사용한다", () => {
    const rows = [
      ["1", "2024.01.08", "출금"],
      ["", "01.09", "입금"],
    ];

    const referenceDate = inferReferenceDateFromRows(rows, 1);

    expect(referenceDate?.getFullYear()).toBe(2024);
    expect(referenceDate?.getMonth()).toBe(0);
    expect(referenceDate?.getDate()).toBe(8);
  });

  it("행 재파싱용 날짜 해석은 이전 날짜를 이어받고 date column 메모를 추출한다", () => {
    const mapping: Pick<ColumnMapping, "date"> = { date: 1 };
    const first = resolveTransactionDateFromRow(
      ["1", "2024.01.08 17:10: F/B출금"],
      mapping,
      { referenceDate: new Date("2024-01-08T00:00:00.000Z") }
    );
    const second = resolveTransactionDateFromRow(
      ["", "11:01: 자동이체"],
      mapping,
      { lastKnownDate: first.transactionDate, referenceDate: first.transactionDate }
    );

    expect(first.transactionDate?.getFullYear()).toBe(2024);
    expect(first.extractedMemoFromDate).toBe("F/B출금");
    expect(second.dateCarriedForward).toBe(true);
    expect(second.transactionDate?.getDate()).toBe(8);
    expect(second.extractedMemoFromDate).toBe("자동이체");
  });

  it("pair 템플릿은 2행을 1건으로 병합한다", () => {
    const merged = mergePairedRows([
      ["1", "2024.01.08", "출금", "100,000"],
      ["", "", "NH올원뱅크", ""],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.[2]).toContain("출금");
    expect(merged[0]?.[2]).toContain("NH올원뱅크");
  });

  it("저장 단계에서도 날짜 이어받기와 메모 정리가 적용된다", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: { transaction: { createMany: typeof createMany } }) => Promise<unknown>) => {
        return await callback({ transaction: { createMany } });
      }),
    };

    const rawData = [
      ["순번", "거래일시적요", "찾으신금액", "맡기신금액", "잔액", "비고"],
      ["1", "2024.01.08 17:10: F/B출금", "100,000", "", "900,000", "11:01: 자동이체"],
      ["", "11:02: 추가출금", "50,000", "", "850,000", ""],
    ];

    await extractAndSaveTransactions(
      prisma as never,
      "doc-1",
      "case-1",
      rawData,
      {
        date: 1,
        withdrawal: 2,
        deposit: 3,
        balance: 4,
        memo: 5,
      },
      0
    );

    const inserted = createMany.mock.calls[0]?.[0]?.data as Array<{
      transactionDate: Date;
      memo?: string;
      withdrawalAmount?: number | null;
    }>;

    expect(inserted).toHaveLength(2);
    expect(inserted[0]?.transactionDate.getFullYear()).toBe(2024);
    expect(inserted[0]?.memo).toBe("자동이체");
    expect(inserted[1]?.transactionDate.getFullYear()).toBe(2024);
    expect(inserted[1]?.transactionDate.getDate()).toBe(8);
    expect(inserted[1]?.memo).toBe("추가출금");
    expect(inserted[1]?.withdrawalAmount).toBe(50000);
  });

  it("날짜 이어받기 중 섞여든 합계/푸터 행은 저장하지 않는다", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: { transaction: { createMany: typeof createMany } }) => Promise<unknown>) => {
        return await callback({ transaction: { createMany } });
      }),
    };

    const rawData = [
      ["거래일자", "비고", "입금", "출금", "잔액"],
      ["2025-12-12 10:18:55", "004주식회사 공감커뮤", "", "178,440", "0"],
      ["", "168,738,553 원", "", "171,747,184", "0"],
      ["", "이기선", "", "10,047,411,129", "0"],
    ];

    const result = await extractAndSaveTransactions(
      prisma as never,
      "doc-1",
      "case-1",
      rawData,
      {
        date: 0,
        memo: 1,
        deposit: 2,
        withdrawal: 3,
        balance: 4,
      },
      0,
    );

    const inserted = createMany.mock.calls[0]?.[0]?.data as Array<{ memo?: string }>;

    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.memo).toBe("004주식회사 공감커뮤");
    expect(result.skipped).toBe(2);
    expect(result.errors.some((error) => error.error.includes("summary/footer"))).toBe(true);
  });
});