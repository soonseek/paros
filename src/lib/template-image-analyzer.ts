/**
 * Template Image Analyzer
 * 
 * 거래내역서 이미지를 분석하여 템플릿 초안을 자동 생성
 * OpenAI GPT-4o Vision API 사용
 */

import { env } from "~/env";

export interface TemplateAnalysisResult {
  success: boolean;
  error?: string;
  
  // 추천 템플릿 정보
  suggestedName?: string;
  suggestedBankName?: string;
  suggestedDescription?: string;
  suggestedIdentifiers?: string[];
  
  // 감지된 컬럼 구조
  detectedHeaders?: string[];
  suggestedColumnSchema?: {
    columns: Record<string, {
      index: number;
      header: string;
      whenDeposit?: "amount" | "memo" | "skip";
      whenWithdrawal?: "amount" | "memo" | "skip";
    }>;
  };
  
  // 분석 메타데이터
  confidence?: number;
  reasoning?: string;
}

/**
 * 이미지를 Base64로 변환
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * 거래내역서 이미지 분석
 */
export async function analyzeTemplateImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<TemplateAnalysisResult> {
  if (!env.OPENAI_API_KEY) {
    return {
      success: false,
      error: "OpenAI API 키가 설정되지 않았습니다",
    };
  }

  // 동적 import로 openai 로드
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const base64Image = bufferToBase64(imageBuffer);
  const imageUrl = `data:${mimeType};base64,${base64Image}`;

  const prompt = `이 이미지는 은행 거래내역서입니다. 이미지를 분석하여 다음 정보를 JSON 형식으로 추출하세요:

## 분석 요청

1. **은행명**: 이미지에서 은행 로고나 텍스트를 찾아 은행명을 추출
2. **특징 설명**: 이 거래내역서의 특징을 2-3문장으로 설명 (컬럼 구조, 특이사항 등)
3. **식별자 키워드**: 이 거래내역서를 식별할 수 있는 고유한 키워드들 (헤더 텍스트, 은행명 등)
4. **헤더 컬럼**: 테이블의 헤더 행에 있는 모든 컬럼명을 순서대로
5. **컬럼 매핑**: 각 컬럼의 역할 (date, deposit, withdrawal, balance, memo, transactionType, amount)

## 특수 케이스 확인

일부 은행(부산은행 등)에서는 입금/출금 컬럼에 금액 대신 비고가 혼합되어 있습니다:
- 입금 거래 시: 입금 컬럼에 금액, 출금 컬럼에 비고(거래처명)
- 출금 거래 시: 출금 컬럼에 금액, 입금 컬럼에 비고(거래처명)

이런 패턴이 보이면 whenDeposit, whenWithdrawal 필드로 표시하세요.

## 응답 형식 (JSON만 반환)

{
  "bankName": "은행명",
  "description": "이 거래내역서의 특징 설명 (2-3문장)",
  "identifiers": ["식별자1", "식별자2", "식별자3"],
  "headers": ["컬럼1", "컬럼2", "컬럼3", ...],
  "columnMapping": {
    "date": { "index": 0, "header": "거래일자" },
    "deposit": { 
      "index": 1, 
      "header": "맡기신금액",
      "whenDeposit": "amount",
      "whenWithdrawal": "memo"
    },
    "withdrawal": { 
      "index": 2, 
      "header": "찾으신금액",
      "whenDeposit": "memo",
      "whenWithdrawal": "amount"
    },
    "balance": { "index": 3, "header": "잔액" },
    "memo": { "index": 4, "header": "비고" }
  },
  "confidence": 0.0~1.0,
  "reasoning": "분석 근거"
}

주의사항:
- 이미지에서 보이는 실제 컬럼명을 정확히 사용하세요
- 인덱스는 0부터 시작합니다
- 해당하지 않는 컬럼은 columnMapping에서 생략하세요
- whenDeposit/whenWithdrawal은 특수 케이스에서만 사용합니다
- JSON만 반환하고 다른 텍스트는 포함하지 마세요`;

  try {
    console.log("[Template Image Analyzer] Analyzing image with GPT-4o Vision...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    console.log("[Template Image Analyzer] Raw response:", content.substring(0, 500));

    // JSON 파싱
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Template Image Analyzer] Failed to parse JSON from response");
      return {
        success: false,
        error: "이미지 분석 결과를 파싱할 수 없습니다",
      };
    }

    const result = JSON.parse(jsonMatch[0]) as {
      bankName: string;
      description: string;
      identifiers: string[];
      headers: string[];
      columnMapping: Record<string, {
        index: number;
        header: string;
        whenDeposit?: "amount" | "memo" | "skip";
        whenWithdrawal?: "amount" | "memo" | "skip";
      }>;
      confidence: number;
      reasoning: string;
    };

    console.log("[Template Image Analyzer] Successfully parsed analysis result");
    console.log("[Template Image Analyzer] Bank:", result.bankName);
    console.log("[Template Image Analyzer] Headers:", result.headers);
    console.log("[Template Image Analyzer] Confidence:", result.confidence);

    // 템플릿 이름 생성
    const suggestedName = result.bankName 
      ? `${result.bankName}_${new Date().toISOString().slice(0, 10)}`
      : `미지정_${new Date().toISOString().slice(0, 10)}`;

    return {
      success: true,
      suggestedName,
      suggestedBankName: result.bankName,
      suggestedDescription: result.description,
      suggestedIdentifiers: result.identifiers,
      detectedHeaders: result.headers,
      suggestedColumnSchema: {
        columns: result.columnMapping,
      },
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("[Template Image Analyzer] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다",
    };
  }
}
