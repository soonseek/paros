import { describe, expect, it } from "vitest";

import { flattenMetadataValues, matchCounterpartyQuery } from "~/lib/counterparty-search";

describe("counterparty-search", () => {
  it("원본 메타데이터에서 문자열 값을 평탄화한다", () => {
    const values = flattenMetadataValues({
      originalData: {
        sender: "홍길동",
        account: "110-123-456789",
        extra: ["메모", 1234],
      },
    });

    expect(values).toContain("홍길동");
    expect(values).toContain("110-123-456789");
    expect(values).toContain("1234");
  });

  it("이름으로 비고와 채권자명을 검색한다", () => {
    const result = matchCounterpartyQuery(
      {
        memo: "홍길동 임차보증금 반환",
        creditorName: "홍길동",
      },
      "홍길동",
    );

    expect(result.matched).toBe(true);
    expect(result.matchedFields).toContain("비고");
    expect(result.matchedFields).toContain("채권자명");
  });

  it("계좌번호는 하이픈이 달라도 검색된다", () => {
    const result = matchCounterpartyQuery(
      {
        memo: "일반 이체",
        rawMetadata: {
          originalData: {
            accountNumber: "110-123-456789",
          },
        },
      },
      "110123456789",
    );

    expect(result.matched).toBe(true);
    expect(result.matchedFields).toContain("원본데이터");
  });
});