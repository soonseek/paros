/**
 * Template-based Transaction Classifier
 * 
 * 3단계 분류 파이프라인:
 * Layer 1: 템플릿 키워드 매칭 (identifiers 기반 정확 매칭 - 페이지 텍스트 사용)
 * Layer 2: LLM 유사도 분류 (템플릿 description과 헤더 비교)
 * Layer 3: 기존 LLM 컬럼 매핑 (현재 방식)
 */

import { PrismaClient } from "@prisma/client";
import { env } from "~/env";

/**
 * 문자열 정규화 - 띄어쓰기 제거 및 소문자 변환
 * OCR에서 "거래 일자", "거래일자", "거 래 일 자" 등 다양하게 읽힐 수 있음
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

/**
 * 정규화된 문자열 비교
 */
export function normalizedMatch(source: string, target: string): boolean {
  return normalizeText(source).includes(normalizeText(target));
}

// 템플릿 컬럼 스키마 타입
export interface ColumnDefinition {
  index: number;
  header: string;
  whenDeposit?: "amount" | "memo" | "skip";  // 입금 시 역할
  whenWithdrawal?: "amount" | "memo" | "skip"; // 출금 시 역할
}

export interface TemplateColumnSchema {
  columns: {
    date?: ColumnDefinition;
    deposit?: ColumnDefinition;
    withdrawal?: ColumnDefinition;
    balance?: ColumnDefinition;
    memo?: ColumnDefinition;
    transactionType?: ColumnDefinition;
    amount?: ColumnDefinition; // 단일 금액 컬럼
  };
  parseRules?: {
    isDeposit?: string;  // 입금 판별 조건 (JS 표현식)
    memoExtraction?: string; // 비고 추출 규칙
    rowMergePattern?: "pair" | "none"; // 행 병합 패턴 (2행 → 1거래)
  };
}

export interface TransactionTemplate {
  id: string;
  name: string;
  bankName: string | null;
  description: string;
  identifiers: string[];
  columnSchema: TemplateColumnSchema;
  isActive: boolean;
  priority: number;
}

export interface ClassificationResult {
  layer: 1 | 2 | 3;
  layerName: "exact_match" | "similarity_match" | "llm_fallback";
  templateId?: string;
  templateName?: string;
  bankName?: string;  // 은행/카드사명 추가
  confidence: number;
  columnMapping: Record<string, number>;
  memoInAmountColumn?: boolean;
  parseRules?: TemplateColumnSchema["parseRules"];
}

/**
 * Layer 1: 정확한 키워드 매칭
 * 페이지 텍스트(문서 헤더)에 템플릿의 identifiers가 모두 포함되어 있는지 확인
 * 띄어쓰기를 제거하고 비교
 */
export function matchByIdentifiers(
  headers: string[],
  templates: TransactionTemplate[],
  pageTexts?: string[] // 페이지 텍스트 (테이블 외 문서 텍스트)
): TransactionTemplate | null {
  // 페이지 텍스트가 있으면 우선 사용, 없으면 헤더 사용
  const searchText = pageTexts && pageTexts.length > 0 
    ? pageTexts.join(" ") 
    : headers.join(" ");
  
  const normalizedSearchText = normalizeText(searchText);
  
  console.log(`[Template Classifier] Layer 1: Searching in ${pageTexts?.length || 0} page texts + ${headers.length} headers`);
  console.log(`[Template Classifier] Headers (normalized): ${headers.map(h => normalizeText(h)).join(", ")}`);
  console.log(`[Template Classifier] Normalized search text (first 200 chars): ${normalizedSearchText.substring(0, 200)}`);
  
  // 우선순위 순으로 정렬
  const sortedTemplates = [...templates]
    .filter(t => t.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const template of sortedTemplates) {
    if (template.identifiers.length === 0) continue;
    
    // 모든 identifiers가 검색 텍스트에 포함되어야 함 (띄어쓰기 제거 후 비교)
    const matchResults = template.identifiers.map(identifier => ({
      identifier,
      normalized: normalizeText(identifier),
      matched: normalizedSearchText.includes(normalizeText(identifier))
    }));
    
    const allMatch = matchResults.every(r => r.matched);
    
    console.log(`[Template Classifier] Testing template "${template.name}":`);
    matchResults.forEach(r => {
      console.log(`  - "${r.identifier}" (normalized: "${r.normalized}") -> ${r.matched ? "✓ MATCH" : "✗ NO MATCH"}`);
    });
    
    if (allMatch) {
      console.log(`[Template Classifier] Layer 1 MATCH: "${template.name}" (all ${template.identifiers.length} identifiers matched)`);
      return template;
    }
  }
  
  console.log("[Template Classifier] Layer 1: No exact match found");
  return null;
}

/**
 * Layer 2: LLM 유사도 매칭
 * 템플릿의 description과 현재 헤더/샘플 데이터를 비교
 */
export async function matchBySimilarity(
  headers: string[],
  sampleRows: string[][],
  templates: TransactionTemplate[]
): Promise<{ template: TransactionTemplate; confidence: number } | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn("[Template Classifier] Layer 2 skipped: No OpenAI API key");
    return null;
  }

  const activeTemplates = templates.filter(t => t.isActive);
  if (activeTemplates.length === 0) {
    return null;
  }

  // 동적 import로 openai 로드
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  // 템플릿 목록을 프롬프트에 포함
  const templateDescriptions = activeTemplates.map((t, i) => 
    `${i + 1}. "${t.name}" (${t.bankName || "은행명 미지정"})\n   특징: ${t.description.substring(0, 200)}...`
  ).join("\n");

  const sampleDataStr = sampleRows.slice(0, 3).map(row => row.join(" | ")).join("\n");

  const prompt = `다음 거래내역서의 헤더와 샘플 데이터를 분석하여, 가장 적합한 템플릿을 선택하세요.

## 헤더
${headers.join(", ")}

## 샘플 데이터 (최대 3행)
${sampleDataStr}

## 사용 가능한 템플릿
${templateDescriptions}

## 응답 형식 (JSON만 반환)
{
  "matchedTemplateIndex": 1~N 사이의 숫자 또는 null (매칭되는 템플릿이 없으면),
  "confidence": 0.0~1.0 사이의 신뢰도,
  "reasoning": "선택 이유"
}

- 헤더와 샘플 데이터가 템플릿의 특징과 70% 이상 일치하면 매칭
- 확실하지 않으면 null 반환`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    
    // JSON 파싱
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Template Classifier] Layer 2: Invalid JSON response");
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as {
      matchedTemplateIndex: number | null;
      confidence: number;
      reasoning: string;
    };

    if (result.matchedTemplateIndex === null || result.confidence < 0.7) {
      console.log(`[Template Classifier] Layer 2: No confident match (confidence: ${result.confidence})`);
      return null;
    }

    const matchedTemplate = activeTemplates[result.matchedTemplateIndex - 1];
    if (!matchedTemplate) {
      return null;
    }

    console.log(`[Template Classifier] Layer 2 MATCH: "${matchedTemplate.name}" (confidence: ${result.confidence})`);
    console.log(`[Template Classifier] Reasoning: ${result.reasoning}`);

    return {
      template: matchedTemplate,
      confidence: result.confidence,
    };
  } catch (error) {
    console.error("[Template Classifier] Layer 2 error:", error);
    return null;
  }
}

/**
 * 템플릿 스키마를 숫자 기반 컬럼 매핑으로 변환
 */
export function convertSchemaToMapping(
  schema: TemplateColumnSchema,
  headers: string[]
): { columnMapping: Record<string, number>; memoInAmountColumn: boolean } {
  const columnMapping: Record<string, number> = {};
  let memoInAmountColumn = false;

  const { columns } = schema;

  // 각 컬럼 정의를 인덱스로 변환
  if (columns.date) {
    const idx = findColumnIndex(columns.date, headers);
    if (idx !== -1) columnMapping.date = idx;
  }

  if (columns.deposit) {
    const idx = findColumnIndex(columns.deposit, headers);
    if (idx !== -1) {
      columnMapping.deposit = idx;
      // 입금/출금에 따라 역할이 달라지는 특수 케이스
      if (columns.deposit.whenDeposit === "amount" && columns.deposit.whenWithdrawal === "memo") {
        memoInAmountColumn = true;
      }
    }
  }

  if (columns.withdrawal) {
    const idx = findColumnIndex(columns.withdrawal, headers);
    if (idx !== -1) {
      columnMapping.withdrawal = idx;
      if (columns.withdrawal.whenDeposit === "memo" && columns.withdrawal.whenWithdrawal === "amount") {
        memoInAmountColumn = true;
      }
    }
  }

  if (columns.balance) {
    const idx = findColumnIndex(columns.balance, headers);
    if (idx !== -1) columnMapping.balance = idx;
  }

  if (columns.memo && !memoInAmountColumn) {
    const idx = findColumnIndex(columns.memo, headers);
    if (idx !== -1) columnMapping.memo = idx;
  }

  if (columns.transactionType) {
    const idx = findColumnIndex(columns.transactionType, headers);
    if (idx !== -1) columnMapping.transaction_type = idx;
  }

  if (columns.amount) {
    const idx = findColumnIndex(columns.amount, headers);
    if (idx !== -1) columnMapping.amount = idx;
  }

  return { columnMapping, memoInAmountColumn };
}

/**
 * 컬럼 정의에서 실제 인덱스 찾기
 * 띄어쓰기를 제거하고 비교
 */
function findColumnIndex(colDef: ColumnDefinition, headers: string[]): number {
  // 1. index가 지정되어 있고 유효하면 사용
  if (colDef.index !== undefined && colDef.index >= 0 && colDef.index < headers.length) {
    return colDef.index;
  }

  // 2. header 이름으로 찾기 (띄어쓰기 제거 후 비교)
  if (colDef.header) {
    const normalizedTarget = normalizeText(colDef.header);
    const idx = headers.findIndex(h => {
      const normalizedHeader = normalizeText(h);
      return normalizedHeader.includes(normalizedTarget) ||
             normalizedTarget.includes(normalizedHeader);
    });
    if (idx !== -1) {
      console.log(`[findColumnIndex] Matched "${colDef.header}" to header[${idx}]="${headers[idx]}" (normalized)`);
      return idx;
    }
  }

  return -1;
}

/**
 * 메인 분류 함수 - 3단계 파이프라인 실행
 */
export async function classifyTransaction(
  prisma: PrismaClient,
  headers: string[],
  sampleRows: string[][],
  pageTexts?: string[] // 페이지 텍스트 (테이블 외 문서 텍스트)
): Promise<ClassificationResult | null> {
  console.log("[Template Classifier] Starting 3-layer classification pipeline...");
  console.log("[Template Classifier] Headers:", headers.slice(0, 5).join(", "));
  console.log("[Template Classifier] Page texts count:", pageTexts?.length || 0);

  // 템플릿 로드
  const templates = await prisma.transactionTemplate.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  console.log(`[Template Classifier] Loaded ${templates.length} active templates`);

  if (templates.length === 0) {
    console.log("[Template Classifier] No templates found, skipping to Layer 3");
    return null; // Layer 3 폴백
  }

  const parsedTemplates: TransactionTemplate[] = templates.map(t => ({
    ...t,
    columnSchema: t.columnSchema as TemplateColumnSchema,
  }));

  // Layer 1: 정확한 키워드 매칭 (페이지 텍스트 사용)
  console.log("[Template Classifier] Layer 1: Exact keyword matching...");
  const exactMatch = matchByIdentifiers(headers, parsedTemplates, pageTexts);
  
  if (exactMatch) {
    const { columnMapping, memoInAmountColumn } = convertSchemaToMapping(
      exactMatch.columnSchema,
      headers
    );

    // 매칭 횟수 증가
    await prisma.transactionTemplate.update({
      where: { id: exactMatch.id },
      data: { matchCount: { increment: 1 } },
    });

    return {
      layer: 1,
      layerName: "exact_match",
      templateId: exactMatch.id,
      templateName: exactMatch.name,
      bankName: exactMatch.bankName || undefined,
      confidence: 1.0,
      columnMapping,
      memoInAmountColumn,
      parseRules: exactMatch.columnSchema.parseRules,
    };
  }

  // Layer 2: LLM 유사도 매칭
  console.log("[Template Classifier] Layer 2: LLM similarity matching...");
  const similarityMatch = await matchBySimilarity(headers, sampleRows, parsedTemplates);
  
  if (similarityMatch) {
    const { columnMapping, memoInAmountColumn } = convertSchemaToMapping(
      similarityMatch.template.columnSchema,
      headers
    );

    // 매칭 횟수 증가
    await prisma.transactionTemplate.update({
      where: { id: similarityMatch.template.id },
      data: { matchCount: { increment: 1 } },
    });

    return {
      layer: 2,
      layerName: "similarity_match",
      templateId: similarityMatch.template.id,
      templateName: similarityMatch.template.name,
      bankName: similarityMatch.template.bankName || undefined,
      confidence: similarityMatch.confidence,
      columnMapping,
      memoInAmountColumn,
      parseRules: similarityMatch.template.columnSchema.parseRules,
    };
  }

  // Layer 3: 폴백 (기존 LLM 컬럼 분석)
  console.log("[Template Classifier] Layer 3: Falling back to LLM column analysis...");
  return null; // 호출자가 기존 analyzeColumnsWithLLM 사용
}

/**
 * 템플릿 기반 Row 파싱
 * 입금/출금에 따라 값의 위치가 달라지는 특수 케이스 처리
 */
export function parseRowWithTemplate(
  row: string[],
  columnMapping: Record<string, number>,
  memoInAmountColumn: boolean,
  parseRules?: TemplateColumnSchema["parseRules"]
): {
  date: string | null;
  depositAmount: number | null;
  withdrawalAmount: number | null;
  balance: number | null;
  memo: string;
} {
  const getValue = (key: string): string | null => {
    const idx = columnMapping[key];
    if (idx === undefined || idx < 0 || idx >= row.length) return null;
    return row[idx]?.toString().trim() || null;
  };

  const parseAmount = (val: string | null): number | null => {
    if (!val) return null;
    const cleaned = val.replace(/[,₩원\s]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const dateVal = getValue("date");
  const balanceVal = parseAmount(getValue("balance"));
  
  let depositAmount: number | null = null;
  let withdrawalAmount: number | null = null;
  let memo = "";

  if (memoInAmountColumn) {
    // 특수 케이스: 입금/출금 컬럼에 비고가 혼합됨
    const depositRaw = getValue("deposit");
    const withdrawalRaw = getValue("withdrawal");

    const depositParsed = parseAmount(depositRaw);
    const withdrawalParsed = parseAmount(withdrawalRaw);

    if (depositParsed !== null && depositParsed > 0) {
      // 입금 거래: 입금금액에 숫자, 출금금액 컬럼에 비고
      depositAmount = depositParsed;
      memo = withdrawalRaw && !parseAmount(withdrawalRaw) ? withdrawalRaw : "";
    } else if (withdrawalParsed !== null && withdrawalParsed > 0) {
      // 출금 거래: 출금금액에 숫자, 입금금액 컬럼에 비고
      withdrawalAmount = withdrawalParsed;
      memo = depositRaw && !parseAmount(depositRaw) ? depositRaw : "";
    }
  } else {
    // 일반 케이스
    depositAmount = parseAmount(getValue("deposit"));
    withdrawalAmount = parseAmount(getValue("withdrawal"));
    
    // 단일 금액 컬럼 + 거래구분
    if (columnMapping.amount !== undefined) {
      const amount = parseAmount(getValue("amount"));
      const txType = getValue("transaction_type") || "";
      
      const isDeposit = txType.includes("+") || 
        txType.includes("입금") || 
        txType.includes("받기");

      if (isDeposit) {
        depositAmount = amount;
      } else {
        withdrawalAmount = amount;
      }
    }

    memo = getValue("memo") || "";
  }

  return {
    date: dateVal,
    depositAmount,
    withdrawalAmount,
    balance: balanceVal,
    memo,
  };
}
