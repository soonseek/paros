/**
 * Chat Router
 *
 * AI 어시스턴트 기능 - 거래내역 질의응답
 * 
 * Function Calling을 사용하여 DB에서 필요한 데이터만 조회
 * - 전체 거래내역을 LLM에 전달하지 않음 (토큰 절약)
 * - LLM이 필요한 쿼리를 생성하고 DB에서 조회
 *
 * 지원 모델:
 * - OpenAI: gpt-4o, gpt-4o-mini, gpt-5 (o3)
 * - Anthropic: claude-sonnet-4, claude-haiku
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { type PrismaClient, Prisma } from "@prisma/client";

// Function definitions for OpenAI
const functions = [
  {
    name: "search_transactions",
    description: "거래내역을 검색합니다. 키워드, 금액 범위, 날짜 범위, 거래 유형(입금/출금) 등으로 검색할 수 있습니다.",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색할 키워드 (비고, 적요에서 검색). 예: '카카오', '대출', '월세'",
        },
        minAmount: {
          type: "number",
          description: "최소 금액 (원). 예: 1000000 (100만원)",
        },
        maxAmount: {
          type: "number",
          description: "최대 금액 (원). 예: 50000000 (5천만원)",
        },
        transactionType: {
          type: "string",
          enum: ["deposit", "withdrawal", "all"],
          description: "거래 유형. deposit=입금, withdrawal=출금, all=전체",
        },
        startDate: {
          type: "string",
          description: "시작 날짜 (YYYY-MM-DD 형식). 예: '2024-01-01'",
        },
        endDate: {
          type: "string",
          description: "종료 날짜 (YYYY-MM-DD 형식). 예: '2024-12-31'",
        },
        limit: {
          type: "number",
          description: "결과 개수 제한 (기본값: 50, 최대: 200)",
        },
        orderBy: {
          type: "string",
          enum: ["date_asc", "date_desc", "amount_desc", "amount_asc"],
          description: "정렬 기준. date_asc=날짜 오름차순, date_desc=날짜 내림차순, amount_desc=금액 내림차순",
        },
      },
      required: [],
    },
  },
  {
    name: "get_transaction_summary",
    description: "거래내역 전체 요약 통계를 가져옵니다. 총 건수, 입금/출금 합계 등.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "track_fund_usage",
    description: "특정 입금(대출금 등)의 자금 사용 추적. 입금 이후 출금 내역을 누적하여 자금 소진 경로를 분석합니다.",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "대출금 등 추적할 입금의 키워드. 예: '카카오', '대출', '신한'",
        },
        amount: {
          type: "number",
          description: "추적할 입금 금액 (정확한 금액 또는 근사치)",
        },
        amountTolerance: {
          type: "number",
          description: "금액 허용 오차 (기본값: 0). 예: 100000 (10만원)",
        },
      },
      required: [],
    },
  },
];

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, message, model } = input;
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

      // 2. 거래내역 요약 통계 (간략히)
      const summary = await getTransactionSummary(ctx.db, caseId);

      // 3. 시스템 프롬프트 구성 (거래내역 없이, 도구 설명만)
      const systemPrompt = `당신은 파산 사건 관리 시스템의 AI 어시스턴트입니다.

## 거래내역 요약
- 전체: ${summary.totalCount}건
- 입금: ${summary.depositCount}건 / ${summary.totalDeposit.toLocaleString()}원
- 출금: ${summary.withdrawalCount}건 / ${summary.totalWithdrawal.toLocaleString()}원
- 기간: ${summary.dateRange}

## 사용 가능한 도구
1. **search_transactions**: 거래내역 검색 (키워드, 금액, 날짜, 유형으로 필터링)
2. **get_transaction_summary**: 전체 요약 통계
3. **track_fund_usage**: 대출금 등 특정 입금의 자금 사용 추적

## 지침
- 사용자 질문에 따라 적절한 도구를 사용하여 DB에서 데이터를 조회하세요.
- "카카오톡 2천만원 대출" → search_transactions(keyword="카카오", minAmount=19000000, maxAmount=21000000, transactionType="deposit")
- "대출금 사용 내역 추적" → track_fund_usage(keyword="대출", amount=20000000)
- 결과는 마크다운 테이블 형식으로 보기 좋게 정리하세요.
- 한국어로 답변하세요.`;

      // 4. 모델별 API 호출 (Function Calling)
      try {
        if (model.startsWith("gpt")) {
          return await callOpenAIWithFunctions(ctx.db, caseId, systemPrompt, message, model);
        } else if (model.startsWith("claude")) {
          // Claude는 tools 사용
          return await callAnthropicWithTools(ctx.db, caseId, systemPrompt, message, model);
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
 * 거래내역 요약 통계
 */
async function getTransactionSummary(db: PrismaClient, caseId: string) {
  const stats = await db.transaction.aggregate({
    where: { caseId },
    _count: true,
    _sum: {
      depositAmount: true,
      withdrawalAmount: true,
    },
  });

  const dateRange = await db.transaction.aggregate({
    where: { caseId },
    _min: { transactionDate: true },
    _max: { transactionDate: true },
  });

  const depositCount = await db.transaction.count({
    where: { caseId, depositAmount: { gt: 0 } },
  });

  const withdrawalCount = await db.transaction.count({
    where: { caseId, withdrawalAmount: { gt: 0 } },
  });

  const minDate = dateRange._min.transactionDate;
  const maxDate = dateRange._max.transactionDate;
  const dateRangeStr = minDate && maxDate
    ? `${minDate.toISOString().split('T')[0]} ~ ${maxDate.toISOString().split('T')[0]}`
    : "N/A";

  return {
    totalCount: stats._count,
    totalDeposit: Number(stats._sum.depositAmount || 0),
    totalWithdrawal: Number(stats._sum.withdrawalAmount || 0),
    depositCount,
    withdrawalCount,
    dateRange: dateRangeStr,
  };
}

/**
 * 거래내역 검색 (Function Call 실행)
 */
async function searchTransactions(
  db: PrismaClient,
  caseId: string,
  params: {
    keyword?: string;
    minAmount?: number;
    maxAmount?: number;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    orderBy?: string;
  }
) {
  const {
    keyword,
    minAmount,
    maxAmount,
    transactionType = "all",
    startDate,
    endDate,
    limit = 50,
    orderBy = "date_desc",
  } = params;

  const where: Prisma.TransactionWhereInput = { caseId };

  // 키워드 검색
  if (keyword) {
    where.OR = [
      { memo: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
      { subcategory: { contains: keyword, mode: "insensitive" } },
    ];
  }

  // 금액 범위
  if (transactionType === "deposit" || transactionType === "all") {
    if (minAmount !== undefined || maxAmount !== undefined) {
      const amountFilter: Prisma.DecimalNullableFilter = {};
      if (minAmount !== undefined) amountFilter.gte = minAmount;
      if (maxAmount !== undefined) amountFilter.lte = maxAmount;
      
      if (transactionType === "deposit") {
        where.depositAmount = amountFilter;
      } else if (transactionType === "withdrawal") {
        where.withdrawalAmount = amountFilter;
      } else {
        // all - 입금 또는 출금에서 검색
        where.OR = [
          ...(where.OR || []),
          { depositAmount: amountFilter },
          { withdrawalAmount: amountFilter },
        ];
      }
    }
  }

  if (transactionType === "deposit") {
    where.depositAmount = { ...((where.depositAmount as object) || {}), gt: 0 };
  } else if (transactionType === "withdrawal") {
    where.withdrawalAmount = { ...((where.withdrawalAmount as object) || {}), gt: 0 };
  }

  // 날짜 범위
  if (startDate || endDate) {
    where.transactionDate = {};
    if (startDate) where.transactionDate.gte = new Date(startDate);
    if (endDate) where.transactionDate.lte = new Date(endDate + "T23:59:59");
  }

  // 정렬
  let orderByClause: Prisma.TransactionOrderByWithRelationInput = { transactionDate: "desc" };
  switch (orderBy) {
    case "date_asc":
      orderByClause = { transactionDate: "asc" };
      break;
    case "date_desc":
      orderByClause = { transactionDate: "desc" };
      break;
    case "amount_desc":
      orderByClause = { depositAmount: "desc" };
      break;
    case "amount_asc":
      orderByClause = { depositAmount: "asc" };
      break;
  }

  const transactions = await db.transaction.findMany({
    where,
    orderBy: orderByClause,
    take: Math.min(limit, 200),
    select: {
      transactionDate: true,
      depositAmount: true,
      withdrawalAmount: true,
      balance: true,
      memo: true,
      category: true,
      document: { select: { originalFileName: true } },
    },
  });

  return transactions.map((tx, idx) => ({
    no: idx + 1,
    date: tx.transactionDate.toISOString().split('T')[0],
    deposit: Number(tx.depositAmount || 0),
    withdrawal: Number(tx.withdrawalAmount || 0),
    balance: Number(tx.balance || 0),
    memo: tx.memo || "",
    file: tx.document?.originalFileName || "",
  }));
}

/**
 * 자금 사용 추적 (Function Call 실행)
 */
async function trackFundUsage(
  db: PrismaClient,
  caseId: string,
  params: {
    keyword?: string;
    amount?: number;
    amountTolerance?: number;
  }
) {
  const { keyword, amount, amountTolerance = 0 } = params;

  // 1. 대출금 입금 찾기
  const depositWhere: Prisma.TransactionWhereInput = {
    caseId,
    depositAmount: { gt: 0 },
  };

  if (keyword) {
    depositWhere.memo = { contains: keyword, mode: "insensitive" };
  }

  if (amount !== undefined) {
    depositWhere.depositAmount = {
      gte: amount - amountTolerance,
      lte: amount + amountTolerance,
    };
  }

  const loanDeposit = await db.transaction.findFirst({
    where: depositWhere,
    orderBy: { depositAmount: "desc" },
    select: {
      id: true,
      transactionDate: true,
      depositAmount: true,
      memo: true,
      document: { select: { originalFileName: true } },
    },
  });

  if (!loanDeposit) {
    return {
      found: false,
      message: `조건에 맞는 입금 내역을 찾지 못했습니다. (키워드: ${keyword || "없음"}, 금액: ${amount?.toLocaleString() || "없음"}원)`,
    };
  }

  const loanAmount = Number(loanDeposit.depositAmount);

  // 2. 대출금 입금 이후 출금 내역 추적
  const withdrawals = await db.transaction.findMany({
    where: {
      caseId,
      transactionDate: { gte: loanDeposit.transactionDate },
      withdrawalAmount: { gt: 0 },
    },
    orderBy: { transactionDate: "asc" },
    take: 100,
    select: {
      transactionDate: true,
      withdrawalAmount: true,
      balance: true,
      memo: true,
      document: { select: { originalFileName: true } },
    },
  });

  // 3. 누적 출금액 계산
  let cumulativeWithdrawal = 0;
  const trackingResult = [
    {
      no: 1,
      date: loanDeposit.transactionDate.toISOString().split('T')[0],
      type: "입금(대출)",
      amount: loanAmount,
      cumulative: 0,
      balance: loanAmount,
      memo: loanDeposit.memo || "",
      file: loanDeposit.document?.originalFileName || "",
    },
  ];

  for (const tx of withdrawals) {
    const withdrawalAmount = Number(tx.withdrawalAmount);
    cumulativeWithdrawal += withdrawalAmount;

    trackingResult.push({
      no: trackingResult.length + 1,
      date: tx.transactionDate.toISOString().split('T')[0],
      type: "출금",
      amount: -withdrawalAmount,
      cumulative: cumulativeWithdrawal,
      balance: Number(tx.balance || 0),
      memo: tx.memo || "",
      file: tx.document?.originalFileName || "",
    });

    // 대출금 전액 소진 시 중단
    if (cumulativeWithdrawal >= loanAmount) {
      break;
    }
  }

  return {
    found: true,
    loanAmount,
    loanDate: loanDeposit.transactionDate.toISOString().split('T')[0],
    loanMemo: loanDeposit.memo,
    totalWithdrawn: cumulativeWithdrawal,
    exhausted: cumulativeWithdrawal >= loanAmount,
    tracking: trackingResult,
  };
}

/**
 * Function Call 실행
 */
async function executeFunctionCall(
  db: PrismaClient,
  caseId: string,
  functionName: string,
  args: Record<string, unknown>
): Promise<string> {
  console.log(`[Chat] Executing function: ${functionName}`, args);

  switch (functionName) {
    case "search_transactions": {
      const results = await searchTransactions(db, caseId, args as Parameters<typeof searchTransactions>[2]);
      if (results.length === 0) {
        return "검색 조건에 맞는 거래내역이 없습니다.";
      }
      // 테이블 형식으로 반환
      const header = "| 순번 | 거래일 | 입금 | 출금 | 잔액 | 비고 | 파일 |";
      const separator = "|------|--------|------|------|------|------|------|";
      const rows = results.map(r => 
        `| ${r.no} | ${r.date} | ${r.deposit > 0 ? r.deposit.toLocaleString() : ""} | ${r.withdrawal > 0 ? r.withdrawal.toLocaleString() : ""} | ${r.balance.toLocaleString()} | ${r.memo} | ${r.file} |`
      );
      return `검색 결과: ${results.length}건\n\n${header}\n${separator}\n${rows.join("\n")}`;
    }

    case "get_transaction_summary": {
      const summary = await getTransactionSummary(db, caseId);
      return JSON.stringify(summary, null, 2);
    }

    case "track_fund_usage": {
      const result = await trackFundUsage(db, caseId, args as Parameters<typeof trackFundUsage>[2]);
      if (!result.found) {
        return result.message || "대출금을 찾지 못했습니다.";
      }
      // 테이블 형식으로 반환
      const header = "| 순번 | 거래일 | 구분 | 금액 | 누적출금 | 잔액 | 비고 | 파일 |";
      const separator = "|------|--------|------|------|----------|------|------|------|";
      const rows = result.tracking!.map(r => 
        `| ${r.no} | ${r.date} | ${r.type} | ${r.amount > 0 ? "+" : ""}${r.amount.toLocaleString()} | ${r.cumulative.toLocaleString()} | ${r.balance.toLocaleString()} | ${r.memo} | ${r.file} |`
      );
      const summary = `\n\n**요약**: 대출금 ${result.loanAmount?.toLocaleString()}원 (${result.loanDate}) → 누적 출금 ${result.totalWithdrawn?.toLocaleString()}원 (${result.exhausted ? "전액 소진" : "일부 소진"})`;
      return `${header}\n${separator}\n${rows.join("\n")}${summary}`;
    }

    default:
      return `알 수 없는 함수: ${functionName}`;
  }
}

/**
 * OpenAI API 호출 (Function Calling)
 */
async function callOpenAIWithFunctions(
  db: PrismaClient,
  caseId: string,
  systemPrompt: string,
  userMessage: string,
  model: string
) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 설정해주세요.");
  }

  // 모델 매핑 (gpt-5 → o3)
  let actualModel = model;
  if (model === "gpt-5") {
    actualModel = "o3";
  } else if (model === "gpt-5-mini") {
    actualModel = "o3-mini";
  }

  const messages: Array<{ role: string; content: string; name?: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  // 첫 번째 호출 (Function calling)
  let response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: actualModel,
      messages,
      functions,
      function_call: "auto",
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API 오류: ${response.status} ${JSON.stringify(errorData)}`);
  }

  let data = await response.json();
  let assistantMessage = data.choices[0]?.message;

  // Function call 처리 (최대 3회 반복)
  let iterations = 0;
  while (assistantMessage?.function_call && iterations < 3) {
    iterations++;
    const functionCall = assistantMessage.function_call;
    const functionName = functionCall.name;
    const functionArgs = JSON.parse(functionCall.arguments || "{}");

    // Function 실행
    const functionResult = await executeFunctionCall(db, caseId, functionName, functionArgs);

    // 메시지 히스토리에 추가
    messages.push({
      role: "assistant",
      content: "",
      ...assistantMessage,
    });
    messages.push({
      role: "function",
      name: functionName,
      content: functionResult,
    });

    // 다음 호출
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: actualModel,
        messages,
        functions,
        function_call: "auto",
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API 오류: ${response.status} ${JSON.stringify(errorData)}`);
    }

    data = await response.json();
    assistantMessage = data.choices[0]?.message;
  }

  return {
    response: assistantMessage?.content || "응답을 생성하지 못했습니다.",
    model,
  };
}

/**
 * Anthropic Claude API 호출 (Tools)
 */
async function callAnthropicWithTools(
  db: PrismaClient,
  caseId: string,
  systemPrompt: string,
  userMessage: string,
  model: string
) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정해주세요.");
  }

  const modelName = model === "claude-sonnet-4" ? "claude-sonnet-4-20250514" : "claude-3-haiku-20240307";

  // Anthropic tools 형식으로 변환
  const tools = functions.map(f => ({
    name: f.name,
    description: f.description,
    input_schema: f.parameters,
  }));

  const messages: Array<{ role: string; content: unknown }> = [
    { role: "user", content: userMessage },
  ];

  let response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 4000,
      system: systemPrompt,
      messages,
      tools,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API 오류: ${response.status} ${JSON.stringify(errorData)}`);
  }

  let data = await response.json();

  // Tool use 처리 (최대 3회 반복)
  let iterations = 0;
  while (data.stop_reason === "tool_use" && iterations < 3) {
    iterations++;
    
    // assistant 메시지 추가
    messages.push({ role: "assistant", content: data.content });

    // tool_use 블록 찾기
    const toolUseBlock = data.content.find((block: { type: string }) => block.type === "tool_use");
    if (!toolUseBlock) break;

    const functionResult = await executeFunctionCall(db, caseId, toolUseBlock.name, toolUseBlock.input);

    // tool_result 추가
    messages.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: toolUseBlock.id,
        content: functionResult,
      }],
    });

    // 다음 호출
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4000,
        system: systemPrompt,
        messages,
        tools,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API 오류: ${response.status} ${JSON.stringify(errorData)}`);
    }

    data = await response.json();
  }

  // 최종 텍스트 응답 추출
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  return {
    response: textBlock?.text || "응답을 생성하지 못했습니다.",
    model,
  };
}
