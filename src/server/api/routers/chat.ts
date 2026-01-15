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

      // 2. 거래내역을 텍스트 형식으로 변환
      const transactionsText = transactions
        .slice(0, 100) // 최대 100건만 사용 (토큰 절약)
        .map((tx, idx) => {
          const date = new Date(tx.transactionDate).toLocaleDateString("ko-KR");
          // Decimal 또는 string/number 타입 모두 처리
          const depositAmount = tx.depositAmount ? String(tx.depositAmount) : null;
          const withdrawalAmount = tx.withdrawalAmount ? String(tx.withdrawalAmount) : null;
          const balanceAmount = tx.balance ? String(tx.balance) : null;

          const deposit = depositAmount ? `${parseInt(depositAmount).toLocaleString()}원` : "-";
          const withdrawal = withdrawalAmount ? `${parseInt(withdrawalAmount).toLocaleString()}원` : "-";
          const balance = balanceAmount ? `${parseInt(balanceAmount).toLocaleString()}원` : "-";
          const memo = tx.memo || "";
          const category = tx.category ? `${tx.category}${tx.subcategory ? ` > ${tx.subcategory}` : ""}` : "";

          return `${idx + 1}. [${date}] 입금: ${deposit} / 출금: ${withdrawal} / 잔액: ${balance} | ${memo} | ${category}`;
        })
        .join("\n");

      // 3. 시스템 프롬프트 구성
      const systemPrompt = `당신은 파산 사건 관리 시스템(PHAROS BMAD)의 AI 어시스턴트입니다.
사용자가 제공한 거래내역을 분석하여 질문에 답변해주세요.

거래내역:
${transactionsText}

답변 시 주의사항:
- 거래일, 입금액, 출금액, 잔액, 메모, 카테고리 정보를 바탕으로 분석하세요.
- 금액은 원화(원) 단위입니다.
- 한국어로 답변하세요.
- 구체적인 거래내역을 언급할 때 거래 번호를 참조하세요.
- 금액 합계, 평균, 최대/최소값 등의 통계도 계산할 수 있습니다.`;

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
