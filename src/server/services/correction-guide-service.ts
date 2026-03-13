/**
 * 보정권고 안내사항 분석 서비스
 * 
 * 1. Upstage Document Parse로 PDF/이미지 OCR
 * 2. "흠결사항" 섹션에서 1~n번 항목 추출
 * 3. GPT-5.2로 각 항목에 대한 템플릿 매칭 + 신뢰도 산출
 */

import { type PrismaClient, type CorrectionGuideTemplate, type Prisma } from "@prisma/client";
import { SettingsService } from "./settings-service";
import { randomBytes } from "crypto";
import type { FileInfo, TemplateMatchResult, ExtractedDefectItem } from "~/types/correction-guide";

export class CorrectionGuideService {
  private settingsService: SettingsService;

  constructor(private db: PrismaClient) {
    this.settingsService = new SettingsService(db);
  }

  /**
   * Upstage Document Parse API로 PDF/이미지 파싱
   */
  async parseDocumentWithUpstage(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const apiKey = await this.settingsService.getSetting("UPSTAGE_API_KEY");
    
    if (!apiKey) {
      throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
    }

    console.log(`[CorrectionGuideService] Upstage Document Parse 호출: ${fileName} (${mimeType})`);

    // Upstage Document Parse API 호출
    const formData = new FormData();
    // Buffer를 Uint8Array로 변환하여 Blob 생성
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    formData.append("document", blob, fileName);
    formData.append("mode", "enhanced");  // 이미지/복잡한 문서용
    formData.append("ocr", "force");      // OCR 강제 적용
    formData.append("output_format", "text");  // 텍스트 추출

    const response = await fetch("https://api.upstage.ai/v1/document-ai/document-parse", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CorrectionGuideService] Upstage API 에러: ${response.status}`, errorText);
      throw new Error(`Upstage API 오류: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { content?: { text?: string }, text?: string };
    
    // 응답에서 텍스트 추출
    const extractedText = result.content?.text ?? result.text ?? "";
    
    console.log(`[CorrectionGuideService] OCR 완료: ${extractedText.length}자 추출`);
    
    return extractedText;
  }

  /**
   * 텍스트에서 "흠결사항" 섹션의 항목들 추출
   */
  extractDefectItems(text: string): ExtractedDefectItem[] {
    const items: ExtractedDefectItem[] = [];
    
    // "흠결사항" 키워드 이후의 텍스트 찾기
    const defectSectionMatch = /흠결사항[\s\S]*?(?=(?:\n\n[가-힣]+\s*$|$))/i.exec(text);
    
    if (!defectSectionMatch) {
      console.log("[CorrectionGuideService] '흠결사항' 섹션을 찾을 수 없음, 전체 텍스트에서 번호 항목 추출 시도");
      // 흠결사항 섹션이 없으면 전체 텍스트에서 번호 패턴 찾기
      return this.extractNumberedItems(text);
    }

    const defectSection = defectSectionMatch[0];
    return this.extractNumberedItems(defectSection);
  }

  /**
   * 번호가 붙은 항목들 추출 (1. 2. 3. 또는 ① ② ③ 등)
   * 번호가 100 이상인 경우는 날짜 등 오인식으로 판단하여 제외
   */
  private extractNumberedItems(text: string): ExtractedDefectItem[] {
    const items: ExtractedDefectItem[] = [];
    const MAX_VALID_NUMBER = 99;  // 100 이상은 날짜 등 오인식으로 판단
    
    // 다양한 번호 패턴 매칭
    // 1. 숫자. 또는 숫자) 또는 ① ② 등
    const patterns = [
      /(\d+)\.\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g,   // 1. 내용
      /(\d+)\)\s*([^\n]+(?:\n(?!\d+\))[^\n]+)*)/g,   // 1) 내용
      /([①②③④⑤⑥⑦⑧⑨⑩])\s*([^\n]+(?:\n(?![①②③④⑤⑥⑦⑧⑨⑩])[^\n]+)*)/g,  // ① 내용
    ];

    // 원문자를 숫자로 변환하는 맵
    const circleToNum: Record<string, number> = {
      "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
      "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
    };

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const numOrCircle = match[1];
        const content = match[2]?.trim() ?? "";
        
        if (!content || content.length < 5) continue;  // 너무 짧은 항목 무시
        
        // 번호 파싱
        let num: number;
        if (numOrCircle && circleToNum[numOrCircle]) {
          num = circleToNum[numOrCircle];
        } else {
          num = parseInt(numOrCircle ?? "0", 10);
        }
        
        // 유효한 번호 범위 체크 (1~99)
        if (num > 0 && num <= MAX_VALID_NUMBER && !items.find(i => i.number === num)) {
          items.push({
            number: num,
            content: content.replace(/\s+/g, " ").trim(),
          });
        }
      }
    }

    // 번호순 정렬
    items.sort((a, b) => a.number - b.number);
    
    console.log(`[CorrectionGuideService] ${items.length}개 항목 추출됨`);
    
    return items;
  }

  /**
   * GPT-5.2로 템플릿 매칭 수행
   */
  async matchTemplatesWithGPT(
    defectItems: ExtractedDefectItem[],
    templates: CorrectionGuideTemplate[]
  ): Promise<TemplateMatchResult[]> {
    const openaiApiKey = await this.settingsService.getSetting("OPENAI_API_KEY");
    
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
    }

    if (templates.length === 0) {
      // 템플릿이 없으면 매칭 없이 반환
      return defectItems.map(item => ({
        itemNumber: item.number,
        itemContent: item.content,
        matchedTemplate: null,
        confidenceScore: 0,
        matchReason: "매칭 가능한 템플릿이 없습니다",
        isSelected: true,
      }));
    }

    console.log(`[CorrectionGuideService] GPT-5.2로 ${defectItems.length}개 항목 매칭 시작`);

    // 템플릿 정보 요약
    const templateSummary = templates.map(t => ({
      id: t.id,
      title: t.title,
      content: t.content.substring(0, 500),  // 내용 일부만
      specialNotes: t.specialNotes ?? "",
    }));

    // GPT 프롬프트 구성
    const systemPrompt = `당신은 법률 문서 분석 전문가입니다. 보정권고/명령서의 흠결사항 각각에 대해:
1. 가장 적절한 안내 템플릿을 매칭하고
2. 템플릿 원문을 **최소한으로만 수정**하여 흠결사항의 구체적 사실을 대입하세요.

**수정 원칙 (매우 중요):**
- 템플릿의 어투, 문체, 간결함을 그대로 유지하세요
- 확대 해석하거나 친절한 설명을 추가하지 마세요
- 수정은 오직 "특수 사실의 대입" 수준만 허용합니다
  예: "XX 은행" → "하나은행", "해당 서류" → "주민등록등본" 등
- 템플릿에 없는 문장이나 안내를 새로 만들지 마세요
- 템플릿 원문이 3줄이면 수정본도 3줄 이내로 유지하세요

응답 형식 (JSON):
{
  "matches": [
    {
      "itemNumber": 1,
      "templateId": "template-uuid 또는 null",
      "confidenceScore": 85,
      "reason": "매칭 판단 근거",
      "customizedContent": "템플릿 원문에서 특수 사실만 대입한 수정본"
    }
  ]
}

confidenceScore는 0-100 사이:
- 90 이상: 매우 확실한 매칭
- 70-89: 높은 확률
- 50-69: 중간 확률
- 50 미만: 낮은 확률 (null 반환 권장)

매칭되는 템플릿이 없으면 templateId를 null로, customizedContent는 흠결사항 원문을 그대로 넣으세요.`;

    const userPrompt = `## 안내 템플릿 목록
${JSON.stringify(templateSummary, null, 2)}

## 보정권고서 흠결사항 목록
${defectItems.map(item => `${item.number}. ${item.content}`).join("\n")}

각 흠결사항에 대해 가장 적합한 템플릿을 매칭하고, 템플릿 원문에서 흠결사항의 구체적 사실(기관명, 서류명, 기한, 인명 등)만 대입하여 customizedContent를 작성하세요. 어투와 분량은 템플릿 원문 그대로 유지하세요.`;

    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",  // GPT-5.2는 아직 공식 API에 없으므로 gpt-4o 사용
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CorrectionGuideService] OpenAI API 에러: ${response.status}`, errorText);
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const gptResult = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = gptResult.choices?.[0]?.message?.content ?? "{}";

    let matchData: { matches?: Array<{ itemNumber: number; templateId?: string | null; confidenceScore: number; reason: string; customizedContent?: string }> };
    try {
      matchData = JSON.parse(content) as typeof matchData;
    } catch {
      console.error("[CorrectionGuideService] GPT 응답 파싱 실패:", content);
      matchData = { matches: [] };
    }

    // 결과 조합 - customizedContent 우선 사용, originalContent도 함께 반환
    const results: TemplateMatchResult[] = defectItems.map(item => {
      const match = matchData.matches?.find(m => m.itemNumber === item.number);
      const template = match?.templateId 
        ? templates.find(t => t.id === match.templateId) 
        : null;

      // GPT가 생성한 맞춤 안내문이 있으면 사용, 없으면 템플릿 원문 사용
      const finalContent = match?.customizedContent 
        ?? template?.content 
        ?? "";

      return {
        itemNumber: item.number,
        itemContent: item.content,
        matchedTemplate: template ? {
          id: template.id,
          title: template.title,
          content: finalContent,
          originalContent: template.content, // 템플릿 원본 내용
          images: (template.images as unknown as FileInfo[]) ?? [],
          files: (template.files as unknown as FileInfo[]) ?? [],
        } : match?.customizedContent ? {
          // 템플릿 매칭이 없어도 GPT가 안내문을 생성한 경우
          id: "ai-generated",
          title: `흠결사항 ${item.number} 안내`,
          content: match.customizedContent,
          originalContent: null,
          images: [],
          files: [],
        } : null,
        confidenceScore: match?.confidenceScore ?? 0,
        matchReason: match?.reason ?? "매칭 결과를 찾을 수 없습니다",
        isSelected: !!(template ?? match?.customizedContent),  // 매칭 또는 AI 생성 안내문이 있으면 기본 선택
      };
    });

    console.log(`[CorrectionGuideService] 매칭 완료: ${results.filter(r => r.matchedTemplate).length}/${results.length}개 매칭됨`);

    return results;
  }

  /**
   * 공유용 슬러그 생성
   */
  generateShareSlug(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * 분석 결과 저장
   */
  async saveAnalysis(
    caseId: string,
    documentS3Key: string,
    originalFileName: string,
    extractedItems: ExtractedDefectItem[],
    matchedTemplates: TemplateMatchResult[]
  ) {
    return this.db.correctionGuideAnalysis.create({
      data: {
        caseId,
        documentS3Key,
        originalFileName,
        analysisStatus: "completed",
        extractedItems: JSON.parse(JSON.stringify(extractedItems)) as Prisma.InputJsonValue,
        matchedTemplates: JSON.parse(JSON.stringify(matchedTemplates)) as Prisma.InputJsonValue,
        selectedItems: matchedTemplates.filter(m => m.isSelected).map(m => m.itemNumber) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 사용자 선택 항목 업데이트
   */
  async updateSelectedItems(analysisId: string, selectedItemNumbers: number[]) {
    const analysis = await this.db.correctionGuideAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new Error("분석 결과를 찾을 수 없습니다");
    }

    const matchedTemplates = analysis.matchedTemplates as unknown as TemplateMatchResult[];
    const updatedTemplates = matchedTemplates.map(t => ({
      ...t,
      isSelected: selectedItemNumbers.includes(t.itemNumber),
    }));

    return this.db.correctionGuideAnalysis.update({
      where: { id: analysisId },
      data: {
        matchedTemplates: JSON.parse(JSON.stringify(updatedTemplates)) as Prisma.InputJsonValue,
        selectedItems: selectedItemNumbers as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 공유 링크 생성
   */
  async createShareLink(analysisId: string, expiresInDays?: number) {
    const slug = this.generateShareSlug();
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return this.db.correctionGuideAnalysis.update({
      where: { id: analysisId },
      data: {
        shareSlug: slug,
        shareExpiresAt: expiresAt,
      },
    });
  }

  /**
   * 공유 링크로 분석 결과 조회 (인증 없음)
   */
  async getAnalysisByShareSlug(slug: string) {
    const analysis = await this.db.correctionGuideAnalysis.findUnique({
      where: { shareSlug: slug },
      include: {
        case: {
          select: {
            caseNumber: true,
            debtorName: true,
          },
        },
      },
    });

    if (!analysis) {
      return null;
    }

    // 만료 확인
    if (analysis.shareExpiresAt && analysis.shareExpiresAt < new Date()) {
      return null;
    }

    return analysis;
  }
}
