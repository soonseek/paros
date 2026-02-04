/**
 * Transaction Template Router
 * 
 * 거래내역서 템플릿 CRUD API
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";

// 컬럼 정의 스키마
const columnDefinitionSchema = z.object({
  index: z.number(),
  header: z.string(),
  whenDeposit: z.enum(["amount", "memo", "skip"]).optional(),
  whenWithdrawal: z.enum(["amount", "memo", "skip"]).optional(),
});

// 템플릿 컬럼 스키마
const columnSchemaSchema = z.object({
  columns: z.object({
    date: columnDefinitionSchema.optional(),
    deposit: columnDefinitionSchema.optional(),
    withdrawal: columnDefinitionSchema.optional(),
    balance: columnDefinitionSchema.optional(),
    memo: columnDefinitionSchema.optional(),
    transactionType: columnDefinitionSchema.optional(),
    amount: columnDefinitionSchema.optional(),
  }),
  parseRules: z.object({
    isDeposit: z.string().optional(),
    memoExtraction: z.string().optional(),
    rowMergePattern: z.enum(["pair", "none"]).optional(), // 행 병합 패턴
  }).optional(),
});

export const templateRouter = createTRPCRouter({
  /**
   * 템플릿 목록 조회
   */
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      const templates = await ctx.db.transactionTemplate.findMany({
        where: input?.includeInactive ? {} : { isActive: true },
        orderBy: [
          { priority: "desc" },
          { name: "asc" },
        ],
      });

      return templates.map(t => ({
        ...t,
        columnSchema: t.columnSchema as object,
      }));
    }),

  /**
   * 단일 템플릿 조회
   */
  getById: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 생성 (관리자 전용)
   */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "템플릿 이름은 필수입니다"),
      bankName: z.string().optional(),
      description: z.string().min(10, "설명은 최소 10자 이상이어야 합니다"),
      identifiers: z.array(z.string()).default([]),
      columnSchema: columnSchemaSchema,
      priority: z.number().default(0),
      isActive: z.boolean().default(true),
      // 샘플 파일 정보 (필수)
      sampleFileKey: z.string().min(1, "샘플 파일은 필수입니다"),
      sampleFileName: z.string().min(1, "샘플 파일명은 필수입니다"),
      sampleFileMimeType: z.string().min(1, "샘플 파일 타입은 필수입니다"),
    }))
    .mutation(async ({ ctx, input }) => {
      // 중복 체크: 은행명 + 이름이 모두 동일한 경우만
      const existing = await ctx.db.transactionTemplate.findFirst({
        where: {
          name: input.name,
          bankName: input.bankName || null,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `이미 동일한 템플릿이 존재합니다 (은행: ${input.bankName || "미지정"}, 이름: ${input.name})`,
        });
      }

      const template = await ctx.db.transactionTemplate.create({
        data: {
          name: input.name,
          bankName: input.bankName,
          description: input.description,
          identifiers: input.identifiers,
          columnSchema: input.columnSchema,
          priority: input.priority,
          isActive: input.isActive,
          sampleFileKey: input.sampleFileKey,
          sampleFileName: input.sampleFileName,
          sampleFileMimeType: input.sampleFileMimeType,
          createdBy: ctx.userId,
        },
      });

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 수정 (관리자 전용)
   */
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      bankName: z.string().nullable().optional(),
      description: z.string().min(10).optional(),
      identifiers: z.array(z.string()).optional(),
      columnSchema: columnSchemaSchema.optional(),
      priority: z.number().optional(),
      isActive: z.boolean().optional(),
      // 샘플 파일 정보 (수정 시 선택)
      sampleFileKey: z.string().optional(),
      sampleFileName: z.string().optional(),
      sampleFileMimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // 템플릿 존재 확인
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      // 중복 체크: 은행명 + 이름이 모두 동일한 다른 템플릿이 있는지
      if (updateData.name || updateData.bankName !== undefined) {
        const checkName = updateData.name || existing.name;
        const checkBankName = updateData.bankName !== undefined ? updateData.bankName : existing.bankName;
        
        const duplicate = await ctx.db.transactionTemplate.findFirst({
          where: {
            id: { not: id }, // 자기 자신 제외
            name: checkName,
            bankName: checkBankName,
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `이미 동일한 템플릿이 존재합니다 (은행: ${checkBankName || "미지정"}, 이름: ${checkName})`,
          });
        }
      }

      const template = await ctx.db.transactionTemplate.update({
        where: { id },
        data: updateData,
      });

      return {
        ...template,
        columnSchema: template.columnSchema as object,
      };
    }),

  /**
   * 템플릿 삭제 (관리자 전용)
   */
  delete: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      await ctx.db.transactionTemplate.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * 템플릿 복제 (관리자 전용)
   */
  duplicate: adminProcedure
    .input(z.object({
      id: z.string(),
      newName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.transactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "템플릿을 찾을 수 없습니다",
        });
      }

      // 새 이름 중복 체크
      const duplicate = await ctx.db.transactionTemplate.findUnique({
        where: { name: input.newName },
      });

      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 동일한 이름의 템플릿이 존재합니다",
        });
      }

      const newTemplate = await ctx.db.transactionTemplate.create({
        data: {
          name: input.newName,
          bankName: existing.bankName,
          description: existing.description,
          identifiers: existing.identifiers,
          columnSchema: existing.columnSchema as object,
          priority: existing.priority,
          isActive: false, // 복제된 템플릿은 비활성화 상태로 시작
          createdBy: ctx.userId,
        },
      });

      return {
        ...newTemplate,
        columnSchema: newTemplate.columnSchema as object,
      };
    }),

  /**
   * 템플릿 통계 조회
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const templates = await ctx.db.transactionTemplate.findMany({
        select: {
          id: true,
          name: true,
          bankName: true,
          isActive: true,
          matchCount: true,
          successRate: true,
        },
        orderBy: { matchCount: "desc" },
      });

      const totalActive = templates.filter(t => t.isActive).length;
      const totalMatches = templates.reduce((sum, t) => sum + t.matchCount, 0);

      return {
        totalTemplates: templates.length,
        activeTemplates: totalActive,
        totalMatches,
        templates,
      };
    }),

  /**
   * 템플릿 테스트 - PDF 파일로 매칭 테스트 (Upstage 파싱 후)
   */
  testMatchWithFile: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("application/pdf"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { classifyTransaction } = await import("~/lib/template-classifier");
      const { extractTablesFromPDF } = await import("~/lib/pdf-ocr");
      const { SettingsService } = await import("~/server/services/settings-service");
      
      // DB에서 Upstage API 키 가져오기
      const settingsService = new SettingsService(ctx.db);
      const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
      
      if (!upstageApiKey) {
        return {
          matched: false,
          error: "Upstage API 키가 설정되지 않았습니다. 관리자 설정 페이지에서 API 키를 입력해주세요.",
          headers: [],
          sampleRows: [],
        };
      }
      
      // Base64를 Buffer로 변환
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      
      console.log(`[Template Test] Processing file: ${input.fileName} (${fileBuffer.length} bytes)`);
      
      // Upstage로 PDF 파싱 (첫 3페이지만)
      let headers: string[] = [];
      let sampleRows: string[][] = [];
      let pageTexts: string[] = [];
      
      try {
        const pdfResult = await extractTablesFromPDF(fileBuffer, 3, upstageApiKey); // maxPages = 3, API key 전달
        
        if (pdfResult.headers && pdfResult.headers.length > 0) {
          headers = pdfResult.headers;
          sampleRows = pdfResult.rows.slice(0, 10); // 샘플로 최대 10행
          pageTexts = pdfResult.pageTexts || []; // 페이지 텍스트 추출
          
          console.log(`[Template Test] Extracted headers: ${headers.join(", ")}`);
          console.log(`[Template Test] Sample rows: ${sampleRows.length}`);
          console.log(`[Template Test] Page texts: ${pageTexts.length} items`);
          if (pageTexts.length > 0) {
            console.log(`[Template Test] Page texts preview: ${pageTexts.slice(0, 3).join(" | ")}`);
          }
        } else {
          return {
            matched: false,
            error: "PDF에서 테이블 헤더를 추출할 수 없습니다",
            headers: [],
            sampleRows: [],
          };
        }
      } catch (error) {
        console.error("[Template Test] PDF parsing error:", error);
        return {
          matched: false,
          error: error instanceof Error ? error.message : "PDF 파싱 실패",
          headers: [],
          sampleRows: [],
        };
      }
      
      // 템플릿 매칭 테스트 (페이지 텍스트 전달)
      const result = await classifyTransaction(ctx.db, headers, sampleRows, pageTexts);

      if (result) {
        // 템플릿 정보 조회 (은행명 포함)
        const matchedTemplate = await ctx.db.transactionTemplate.findUnique({
          where: { id: result.templateId },
          select: { bankName: true },
        });
        
        return {
          matched: true,
          layer: result.layer,
          layerName: result.layerName,
          templateId: result.templateId,
          templateName: result.templateName,
          bankName: matchedTemplate?.bankName || null,
          confidence: result.confidence,
          columnMapping: result.columnMapping,
          headers,
          sampleRows: sampleRows.slice(0, 5), // UI에 표시할 샘플
        };
      }

      return {
        matched: false,
        message: "Layer 1, 2에서 매칭되지 않음. Layer 3 (LLM 폴백) 필요",
        headers,
        sampleRows: sampleRows.slice(0, 5),
      };
    }),

  /**
   * 파일 분석 - 이미지 또는 PDF에서 템플릿 초안 자동 생성
   */
  analyzeFile: adminProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const isPdf = input.mimeType === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf");
      
      console.log(`[Template Analyze] Processing ${isPdf ? "PDF" : "Image"}: ${input.fileName}`);
      
      if (isPdf) {
        // PDF 파일: Upstage 파싱 → LLM 분석
        const { extractTablesFromPDF } = await import("~/lib/pdf-ocr");
        const { default: OpenAI } = await import("openai");
        const { env } = await import("~/env");
        const { SettingsService } = await import("~/server/services/settings-service");
        
        // DB에서 Upstage API 키 가져오기
        const settingsService = new SettingsService(ctx.db);
        const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
        
        if (!upstageApiKey) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Upstage API 키가 설정되지 않았습니다. 관리자 설정 페이지에서 API 키를 입력해주세요.",
          });
        }
        
        // PDF 파싱
        let headers: string[] = [];
        let sampleRows: string[][] = [];
        let pageTexts: string[] = [];
        
        try {
          const pdfResult = await extractTablesFromPDF(fileBuffer, 3, upstageApiKey);
          headers = pdfResult.headers;
          sampleRows = pdfResult.rows.slice(0, 10);
          pageTexts = pdfResult.pageTexts || [];
          
          console.log(`[Template Analyze] Extracted ${headers.length} headers, ${sampleRows.length} rows, ${pageTexts.length} page texts`);
          if (pageTexts.length > 0) {
            console.log(`[Template Analyze] Page texts preview: ${pageTexts.slice(0, 3).join(" | ")}`);
          }
        } catch (error) {
          console.error("[Template Analyze] PDF parsing error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "PDF 파싱 실패",
          });
        }
        
        if (headers.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PDF에서 테이블 헤더를 추출할 수 없습니다",
          });
        }
        
        // LLM으로 템플릿 초안 생성
        if (!env.OPENAI_API_KEY) {
          // API 키 없으면 기본 정보만 반환
          // 페이지 텍스트에서 식별자 추출 (첫 3개 단어)
          const fallbackIdentifiers = pageTexts.length > 0 
            ? pageTexts.slice(0, 3).map(t => t.split(/\s+/)[0]).filter(Boolean)
            : headers.slice(0, 3);
          
          return {
            success: true,
            suggestedName: `템플릿_${new Date().toISOString().slice(0, 10)}`,
            suggestedBankName: "",
            suggestedDescription: `헤더: ${headers.join(", ")}`,
            suggestedIdentifiers: fallbackIdentifiers,
            detectedHeaders: headers,
            suggestedColumnSchema: { columns: {} },
            confidence: 0.5,
            reasoning: "OpenAI API 키 없음 - 기본 정보만 추출됨",
          };
        }
        
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const sampleDataStr = sampleRows.slice(0, 5).map(row => row.join(" | ")).join("\n");
        const pageTextsStr = pageTexts.slice(0, 10).join(" / ");
        
        // 헤더를 인덱스와 함께 명시적으로 포맷 (LLM이 정확한 인덱스를 파악하도록)
        const headersWithIndex = headers.map((h, idx) => `[${idx}] ${h}`).join("\n");
        
        const prompt = `다음은 은행 거래내역서 PDF에서 추출한 정보입니다.
이 정보를 분석하여 템플릿 초안을 생성하세요.

## 페이지 텍스트 (문서 상단의 은행명, 타이틀 등)
${pageTextsStr || "(없음)"}

## 테이블 헤더 (인덱스와 컬럼명)
${headersWithIndex}

## 샘플 데이터 (최대 5행)
${sampleDataStr}

## 응답 형식 (JSON만 반환)
{
  "bankName": "추정되는 은행명 (페이지 텍스트에서 추출, 확실하지 않으면 빈 문자열)",
  "description": "이 거래내역서의 특징 설명 (2-3문장)",
  "identifiers": ["식별자1", "식별자2", "식별자3"],
  "columnMapping": {
    "date": { "index": 0, "header": "거래일자 컬럼명" },
    "deposit": { "index": 1, "header": "입금 컬럼명", "whenDeposit": "amount", "whenWithdrawal": "memo" },
    "withdrawal": { "index": 2, "header": "출금 컬럼명", "whenDeposit": "memo", "whenWithdrawal": "amount" },
    "balance": { "index": 3, "header": "잔액 컬럼명" },
    "memo": { "index": 4, "header": "비고 컬럼명" }
  },
  "confidence": 0.0~1.0,
  "reasoning": "분석 근거"
}

중요:
- **identifiers**: 페이지 텍스트(문서 상단)에서 이 문서를 구분할 수 있는 고유 키워드 2-4개 추출 (예: "국민은행", "입출금거래내역", "보통예금")
  테이블 헤더가 아닌 페이지 상단의 은행명, 계좌 종류, 문서 타이틀 등에서 추출해야 함
- **index**: 위의 "테이블 헤더" 섹션에 표시된 [숫자]를 정확히 사용 (0부터 시작)
  예: "[3] 입금금액"이면 deposit의 index는 3
- **header**: 위의 "테이블 헤더" 섹션에 표시된 컬럼명을 정확히 복사 (띄어쓰기 제거된 상태)
- 해당 없는 컬럼은 columnMapping에서 생략
- whenDeposit/whenWithdrawal은 입금/출금에 따라 역할이 바뀌는 특수 케이스에서만 사용
- JSON만 반환

예시 (위 헤더가 "[0] 거래일자, [1] 구분, [2] 출금금액, [3] 입금금액, [4] 잔액"인 경우):
"date": { "index": 0, "header": "거래일자" },
"deposit": { "index": 3, "header": "입금금액" },
"withdrawal": { "index": 2, "header": "출금금액" },
"balance": { "index": 4, "header": "잔액" }`;

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 1500,
          });
          
          const content = response.choices[0]?.message?.content?.trim() || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (!jsonMatch) {
            throw new Error("LLM 응답 파싱 실패");
          }
          
          const result = JSON.parse(jsonMatch[0]);
          
          return {
            success: true,
            suggestedName: result.bankName 
              ? `${result.bankName}_${new Date().toISOString().slice(0, 10)}`
              : `템플릿_${new Date().toISOString().slice(0, 10)}`,
            suggestedBankName: result.bankName || "",
            suggestedDescription: result.description || "",
            suggestedIdentifiers: result.identifiers || headers.slice(0, 3),
            detectedHeaders: headers,
            suggestedColumnSchema: { columns: result.columnMapping || {} },
            confidence: result.confidence || 0.7,
            reasoning: result.reasoning || "",
          };
        } catch (error) {
          console.error("[Template Analyze] LLM error:", error);
          console.error("[Template Analyze] LLM error details:", error instanceof Error ? error.stack : String(error));
          
          // LLM 실패해도 기본 정보는 반환 (페이지 텍스트 활용)
          const fallbackIdentifiers = pageTexts.length > 0 
            ? pageTexts.slice(0, 3).flatMap(t => t.split(/\s+/).slice(0, 2)).filter(Boolean).slice(0, 4)
            : headers.slice(0, 3);
          
          return {
            success: true,
            suggestedName: `템플릿_${new Date().toISOString().slice(0, 10)}`,
            suggestedBankName: "",
            suggestedDescription: `헤더: ${headers.join(", ")}`,
            suggestedIdentifiers: fallbackIdentifiers,
            detectedHeaders: headers,
            suggestedColumnSchema: { columns: {} },
            confidence: 0.5,
            reasoning: `LLM 분석 실패 - 기본 정보만 추출됨 (오류: ${error instanceof Error ? error.message : String(error)})`,
          };
        }
      } else {
        // 이미지 파일: 기존 Vision API 사용
        const { analyzeTemplateImage } = await import("~/lib/template-image-analyzer");
        
        const result = await analyzeTemplateImage(fileBuffer, input.mimeType);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "이미지 분석 실패",
          });
        }
        
        return {
          success: true,
          suggestedName: result.suggestedName,
          suggestedBankName: result.suggestedBankName,
          suggestedDescription: result.suggestedDescription,
          suggestedIdentifiers: result.suggestedIdentifiers,
          detectedHeaders: result.detectedHeaders,
          suggestedColumnSchema: result.suggestedColumnSchema,
          confidence: result.confidence,
          reasoning: result.reasoning,
        };
      }
    }),
});
