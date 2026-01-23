/**
 * LLM 기반 컬럼 분석기
 * 
 * Python 서비스 없이 Next.js 내에서 직접 OpenAI API를 호출하여
 * 거래내역서의 컬럼 구조를 분석합니다.
 */

import { env } from "~/env";

export interface LLMColumnAnalysisResult {
  success: boolean;
  columnMapping: {
    date?: string;           // 거래일자 컬럼명
    deposit?: string;        // 입금액 컬럼명
    withdrawal?: string;     // 출금액 컬럼명
    amount?: string;         // 단일 금액 컬럼명 (입출금 통합)
    transactionType?: string; // 거래구분 컬럼명 ([+]/[-] 등)
    balance?: string;        // 잔액 컬럼명
    memo?: string;           // 비고 컬럼명
  };
  transactionTypeMethod: 'separate_columns' | 'type_column' | 'sign_in_type' | 'amount_sign';
  memoInAmountColumn: boolean; // 비고가 입금/출금 컬럼에 섞여있는 특수 케이스
  confidence: number;
  reasoning: string;
  error?: string;
}

/**
 * LLM을 사용하여 테이블 헤더와 샘플 데이터로 컬럼 구조 분석
 */
export async function analyzeColumnsWithLLM(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<LLMColumnAnalysisResult> {
  if (!env.OPENAI_API_KEY) {
    console.warn("[Column Analyzer] OpenAI API 키가 없어 룰베이스로 폴백");
    return createFallbackResult("OpenAI API 키가 설정되지 않았습니다");
  }

  // 샘플 데이터 준비 (최대 5행)
  const sampleData = sampleRows.slice(0, 5).map(row => {
    const rowData: Record<string, string> = {};
    headers.forEach(h => {
      rowData[h] = String(row[h] ?? '');
    });
    return rowData;
  });

  const prompt = `당신은 은행 거래내역서 컬럼 분석 전문가입니다.
아래 테이블의 헤더와 샘플 데이터를 분석하여 각 컬럼의 역할을 파악하세요.

## 헤더
${JSON.stringify(headers, null, 2)}

## 샘플 데이터 (최대 5행)
${JSON.stringify(sampleData, null, 2)}

## 분석 요청
다음 JSON 형식으로 컬럼 매핑을 반환하세요:

{
  "columnMapping": {
    "date": "거래일자에 해당하는 컬럼명",
    "deposit": "입금액 컬럼명 (분리형일 경우)",
    "withdrawal": "출금액 컬럼명 (분리형일 경우)",
    "amount": "단일 금액 컬럼명 (통합형일 경우, 예: 거래금액)",
    "transactionType": "거래구분 컬럼명 ([+]/[-] 또는 입금/출금 표시)",
    "balance": "잔액 컬럼명",
    "memo": "비고/적요 컬럼명"
  },
  "transactionTypeMethod": "입출금 구분 방식 (아래 중 택1)",
  "memoInAmountColumn": true/false,
  "confidence": 0.0~1.0 사이의 신뢰도,
  "reasoning": "분석 근거 설명"
}

## transactionTypeMethod 옵션:
- "separate_columns": 입금액/출금액이 별도 컬럼으로 분리됨
- "type_column": 거래구분 컬럼에 "입금"/"출금" 텍스트로 표시
- "sign_in_type": 거래구분 컬럼에 [+]/[-] 기호로 표시
- "amount_sign": 금액 자체에 +/- 부호가 포함됨

## 중요 주의사항:
- 해당하지 않는 컬럼은 null로 설정
- "거래 후 잔액", "거래후잔액" 등은 balance로 매핑
- "거래금액", "금액" 등 단일 컬럼이면 amount로 매핑

## 비고(memo) 컬럼 인식 - 매우 중요!
다음 컬럼명들은 모두 비고(memo)로 매핑해야 합니다:
- "비고", "적요", "내용", "거래내용", "메모"
- "계좌 정보", "계좌정보", "결제 정보", "결제정보"
- "계좌 정보/ 결제 정보", "계좌정보/결제정보"
- "상대방", "거래처", "거래상대", "받는분", "보내는분"
- "은행/계좌" 형태가 아닌 텍스트 설명 컬럼

예: "계좌 정보/ 결제 정보" → memo로 매핑!

## 특수 케이스 - 비고가 금액 컬럼에 섞여있는 경우:
일부 은행에서는 입금/출금 컬럼에 금액 대신 비고(적요)가 들어가는 경우가 있습니다:
- 입금 거래: 출금금액 컬럼에 비고가 들어감 (입금금액에는 숫자)
- 출금 거래: 입금금액 컬럼에 비고가 들어감 (출금금액에는 숫자)

샘플 데이터를 확인하여 이런 패턴이 있는지 확인하세요:
- 입금금액 컬럼에 숫자가 아닌 텍스트(한글, 상호명 등)가 있으면서 출금금액은 숫자인 경우
- 출금금액 컬럼에 숫자가 아닌 텍스트가 있으면서 입금금액은 숫자인 경우

이 패턴이 발견되면 "memoInAmountColumn": true로 설정하세요.
이 경우 별도의 memo 컬럼은 null로 설정하세요.

- JSON만 반환하고 다른 텍스트는 포함하지 마세요`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 비용 효율적인 모델 사용
        messages: [
          { role: "system", content: "You are a JSON-only response bot. Return only valid JSON without markdown code blocks." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1, // 일관성 있는 응답
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Column Analyzer] OpenAI API 오류:", response.status, errorData);
      return createFallbackResult(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return createFallbackResult("LLM 응답이 비어있습니다");
    }

    // JSON 파싱 (마크다운 코드 블록 제거)
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(jsonStr);

    console.log("[Column Analyzer] LLM 분석 결과:", result);

    return {
      success: true,
      columnMapping: {
        date: result.columnMapping?.date || undefined,
        deposit: result.columnMapping?.deposit || undefined,
        withdrawal: result.columnMapping?.withdrawal || undefined,
        amount: result.columnMapping?.amount || undefined,
        transactionType: result.columnMapping?.transactionType || undefined,
        balance: result.columnMapping?.balance || undefined,
        memo: result.columnMapping?.memo || undefined,
      },
      transactionTypeMethod: result.transactionTypeMethod || 'separate_columns',
      memoInAmountColumn: result.memoInAmountColumn || false,
      confidence: result.confidence || 0.8,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    console.error("[Column Analyzer] LLM 분석 실패:", error);
    return createFallbackResult(error instanceof Error ? error.message : "알 수 없는 오류");
  }
}

/**
 * 폴백 결과 생성 (LLM 실패 시)
 */
function createFallbackResult(error: string): LLMColumnAnalysisResult {
  return {
    success: false,
    columnMapping: {},
    transactionTypeMethod: 'separate_columns',
    memoInAmountColumn: false,
    confidence: 0,
    reasoning: '',
    error,
  };
}
