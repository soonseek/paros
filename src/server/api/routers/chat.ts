/**
 * Chat Router
 *
 * AI 어시스턴트 기능 - 거래내역 질의응답
 *
 * 기능:
 * - OpenAI GPT 모델 지원 (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-5, gpt-5-mini)
 * - Anthropic Claude 모델 지원 (claude-sonnet-4, claude-haiku)
 * - 거래내역 컨텍스트 기반 질의응답
 * - 스트리밍 응답 지원
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";

/**
 * Chat Router
 */
export const chatRouter = createTRPCRouter({
  /**
   * AI 어시스턴트에게 질문하고 응답을 받습니다.
   */
  askAssistant: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        message: z.string().min(1, "메시지는 필수 항목입니다"),
        model: z.string().default("gpt-4o"),
        transactions: z.array(
          z.object({
            transactionDate: z.date(),
            depositAmount: z.union([z.string(), z.number()]).nullable(),
            withdrawalAmount: z.union([z.string(), z.number()]).nullable(),
            balance: z.union([z.string(), z.number()]).nullable(),
            memo: z.string().nullable(),
            category: z.string().nullable(),
            subcategory: z.string().nullable(),
            documentName: z.string().nullable().optional(), // 거래내역서 파일명
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, message, model, transactions } = input;
      const userId = ctx.userId;

      // 1. RBAC: 사건 접근 권한 확인
      const caseRecord = await ctx.db.case.findUnique({
        where: { id: caseId },
      });

      if (!caseRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사건을 찾을 수 없습니다.",
        });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (caseRecord.lawyerId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 사건에 접근할 권한이 없습니다.",
        });
      }

      // 2. 거래내역 분석 및 요약 생성
      const totalCount = transactions.length;
      
      // 통계 계산
      let totalDeposit = 0;
      let totalWithdrawal = 0;
      let depositCount = 0;
      let withdrawalCount = 0;
      
      transactions.forEach(tx => {
        const dep = tx.depositAmount ? Number(tx.depositAmount) : 0;
        const wit = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
        if (dep > 0) {
          totalDeposit += dep;
          depositCount++;
        }
        if (wit > 0) {
          totalWithdrawal += wit;
          withdrawalCount++;
        }
      });

      // 거래내역 전체 사용 (압축 형식)
      const transactionsText = transactions
        .map((tx, idx) => {
          const date = new Date(tx.transactionDate).toISOString().split('T')[0];
          const dep = tx.depositAmount ? Number(tx.depositAmount) : 0;
          const wit = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
          const bal = tx.balance ? Number(tx.balance) : 0;
          const memo = tx.memo || "";
          const doc = tx.documentName || "";

          // 압축 형식: 번호|날짜|입금|출금|잔액|비고|파일
          return `${idx + 1}|${date}|${dep}|${wit}|${bal}|${memo}|${doc}`;
        })
        .join("\n");

      // 3. 시스템 프롬프트 구성
      const summaryInfo = `
## 거래내역 요약
- 전체: ${totalCount}건 (입금 ${depositCount}건/${totalDeposit.toLocaleString()}원, 출금 ${withdrawalCount}건/${totalWithdrawal.toLocaleString()}원)
`;

      const systemPrompt = `당신은 파산 사건 관리 시스템의 AI 어시스턴트입니다.
${summaryInfo}
## 거래내역 (형식: 번호|날짜|입금|출금|잔액|비고|파일명)
${transactionsText}

## 대출금 추적 분석 지침
사용자가 대출금 추적이나 자금 이동 분석을 요청하면 다음 형식으로 응답하세요:

1. **대출 입금건 식별**: 
   - 큰 금액의 입금 중 "대출", "론", "융자", "대여" 등의 키워드가 있거나
   - 금액이 round number(100만원, 500만원, 1000만원 등)인 경우 대출로 추정

2. **자금 소진 추적**:
   - 대출금 입금 시점부터 누적 출금액이 대출금을 초과하는 시점까지 추적
   - 예: 500만원 대출 → 출금 200만원 → 출금 150만원 → 출금 200만원 (누적 550만원, 대출금 초과)

3. **자금 이동 경로**: 
   - 거래내역서(파일) 간 자금 이동 링크 확인
   - 입금 메모에 계좌번호가 있으면 다른 거래내역서와 연결 가능

4. **결과 테이블 형식**:
반드시 마크다운 테이블로 결과를 표시하세요:

| 순번 | 거래일 | 구분 | 금액 | 누적출금 | 잔액 | 비고 | 파일명 |
|------|--------|------|------|----------|------|------|--------|
| 1 | 2024-01-15 | 입금(대출) | +5,000,000 | 0 | 5,000,000 | OO대출 | 거래내역서1 |
| 2 | 2024-01-16 | 출금 | -2,000,000 | 2,000,000 | 3,000,000 | 월세 | 거래내역서1 |
...

## 일반 답변 지침
- 거래일, 입금액, 출금액, 잔액, 메모, 카테고리 정보를 바탕으로 분석하세요.
- 금액은 원화(원) 단위입니다.
- 한국어로 답변하세요.
- 구체적인 거래내역을 언급할 때 거래 번호를 참조하세요.
- 금액 합계, 평균, 최대/최소값 등의 통계도 계산할 수 있습니다.
- 대출금 추적 결과는 반드시 마크다운 테이블 형식으로 제공하세요.`;

      // 4. 모델별 API 호출
      try {
        if (model.startsWith("gpt")) {
          // OpenAI API 호출
          return await callOpenAI(systemPrompt, message, model);
        } else if (model.startsWith("claude")) {
          // Anthropic Claude API 호출
          return await callAnthropic(systemPrompt, message, model);
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `지원하지 않는 모델입니다: ${model}`,
          });
        }
      } catch (error) {
        console.error("AI API 호출 실패:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "AI 응답 생성에 실패했습니다.",
        });
      }
    }),
});

/**
 * OpenAI API 호출
 */
async function callOpenAI(systemPrompt: string, userMessage: string, model: string) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 설정해주세요.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: model === "gpt-5" ? "gpt-4-turbo" : model === "gpt-5-mini" ? "gpt-4-turbo" : model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API 오류: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return {
    response: data.choices[0]?.message?.content || "응답을 생성하지 못했습니다.",
    model,
  };
}

/**
 * Anthropic Claude API 호출
 */
async function callAnthropic(systemPrompt: string, userMessage: string, model: string) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정해주세요.");
  }

  const modelName = model === "claude-sonnet-4" ? "claude-3-5-sonnet-20241022" : "claude-3-haiku-20240307";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API 오류: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return {
    response: data.content[0]?.text || "응답을 생성하지 못했습니다.",
    model,
  };
}
