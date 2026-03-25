import { describe, expect, it } from "vitest";

import { isUnsupportedTransactionStatementError } from "~/components/upload-zone";
import { UNSUPPORTED_MERGED_LEDGER_MESSAGE } from "~/lib/woori-merged-ledger";

describe("upload-zone unsupported document handling", () => {
  it("전처리 필요 문서 에러를 다이얼로그 대상으로 분류한다", () => {
    expect(isUnsupportedTransactionStatementError(UNSUPPORTED_MERGED_LEDGER_MESSAGE)).toBe(true);
  });

  it("일반 에러는 다이얼로그 대상이 아니다", () => {
    expect(isUnsupportedTransactionStatementError("파일 업로드 실패")).toBe(false);
  });
});