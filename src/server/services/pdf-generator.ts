/**
 * 보정권고 안내사항 PDF 생성 서비스
 * 
 * pdf-lib 사용, 한글 폰트 지원
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs/promises";
import * as path from "path";
import { downloadFile } from "~/lib/storage";
import type { TemplateMatchResult, CaseInfo } from "~/types/correction-guide";

// 한글 폰트 경로 (시스템 폰트 또는 번들된 폰트)
const KOREAN_FONT_PATHS = [
  "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
  "/app/fonts/NanumGothic.ttf",  // 앱 번들 폰트
];

/**
 * 한글 폰트 로드
 */
async function loadKoreanFont(): Promise<Buffer | null> {
  for (const fontPath of KOREAN_FONT_PATHS) {
    try {
      const fontBuffer = await fs.readFile(fontPath);
      console.log(`[PDF] 한글 폰트 로드 성공: ${fontPath}`);
      return fontBuffer;
    } catch {
      // 다음 폰트 시도
    }
  }
  console.warn("[PDF] 한글 폰트를 찾을 수 없음. 기본 폰트 사용");
  return null;
}

/**
 * 텍스트 줄바꿈 처리
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.5;  // 한글 기준 대략적인 폭
  const charsPerLine = Math.floor(maxWidth / avgCharWidth);
  
  const lines: string[] = [];
  let currentLine = "";
  
  for (const char of text) {
    if (char === "\n") {
      lines.push(currentLine);
      currentLine = "";
      continue;
    }
    
    if (currentLine.length >= charsPerLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine += char;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * 보정권고 안내사항 PDF 생성
 */
export async function generateCorrectionGuidePDF(
  caseInfo: CaseInfo,
  matchResults: TemplateMatchResult[],
  selectedOnly: boolean = true
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // 한글 폰트 로드 시도
  const koreanFontBuffer = await loadKoreanFont();
  let font;
  
  if (koreanFontBuffer) {
    try {
      font = await pdfDoc.embedFont(koreanFontBuffer);
    } catch (e) {
      console.warn("[PDF] 폰트 임베드 실패, 기본 폰트 사용:", e);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // 필터링
  const itemsToInclude = selectedOnly 
    ? matchResults.filter(r => r.isSelected && r.matchedTemplate)
    : matchResults.filter(r => r.matchedTemplate);

  // 페이지 설정
  const pageWidth = 595;  // A4
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // 제목
  const titleFontSize = 18;
  const title = `보정권고 안내사항`;
  page.drawText(title, {
    x: margin,
    y: yPosition,
    size: titleFontSize,
    font,
    color: rgb(0, 0, 0),
  });
  yPosition -= titleFontSize + 10;

  // 사건 정보
  const infoFontSize = 12;
  page.drawText(`사건번호: ${caseInfo.caseNumber}`, {
    x: margin,
    y: yPosition,
    size: infoFontSize,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= infoFontSize + 5;

  page.drawText(`채무자: ${caseInfo.debtorName}`, {
    x: margin,
    y: yPosition,
    size: infoFontSize,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= infoFontSize + 20;

  // 구분선
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  yPosition -= 20;

  // 각 항목 렌더링
  const contentFontSize = 11;
  const lineHeight = contentFontSize + 4;

  for (const item of itemsToInclude) {
    if (!item.matchedTemplate) continue;

    // 새 페이지 필요 체크
    if (yPosition < margin + 100) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }

    // 항목 제목
    const itemTitle = `${item.itemNumber}. ${item.matchedTemplate.title}`;
    page.drawText(itemTitle, {
      x: margin,
      y: yPosition,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.6),
    });
    yPosition -= 20;

    // 원본 흠결사항 (회색 박스)
    page.drawRectangle({
      x: margin,
      y: yPosition - 30,
      width: contentWidth,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
    });
    
    const defectText = `[흠결사항] ${item.itemContent.substring(0, 80)}${item.itemContent.length > 80 ? "..." : ""}`;
    page.drawText(defectText, {
      x: margin + 5,
      y: yPosition - 20,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 40;

    // 안내 내용
    const contentLines = wrapText(item.matchedTemplate.content, contentWidth, contentFontSize);
    
    for (const line of contentLines) {
      if (yPosition < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: contentFontSize,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;
    }

    // 이미지 첨부 표시
    if (item.matchedTemplate.images && item.matchedTemplate.images.length > 0) {
      yPosition -= 10;
      page.drawText(`[첨부 이미지: ${item.matchedTemplate.images.length}개]`, {
        x: margin,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.5, 0.8),
      });
      yPosition -= lineHeight;
      
      // 이미지 실제 삽입 시도
      for (const imageInfo of item.matchedTemplate.images) {
        try {
          const imageBuffer = await downloadFile(imageInfo.key);
          let image;
          
          if (imageInfo.type.includes("png")) {
            image = await pdfDoc.embedPng(imageBuffer);
          } else if (imageInfo.type.includes("jpeg") || imageInfo.type.includes("jpg")) {
            image = await pdfDoc.embedJpg(imageBuffer);
          }
          
          if (image) {
            // 이미지 크기 조절 (최대 폭)
            const maxImgWidth = contentWidth * 0.8;
            const scale = Math.min(1, maxImgWidth / image.width);
            const imgWidth = image.width * scale;
            const imgHeight = image.height * scale;
            
            // 새 페이지 필요 체크
            if (yPosition - imgHeight < margin) {
              page = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }
            
            page.drawImage(image, {
              x: margin,
              y: yPosition - imgHeight,
              width: imgWidth,
              height: imgHeight,
            });
            yPosition -= imgHeight + 10;
          }
        } catch (e) {
          console.warn(`[PDF] 이미지 삽입 실패: ${imageInfo.name}`, e);
        }
      }
    }

    // 첨부파일 표시
    if (item.matchedTemplate.files && item.matchedTemplate.files.length > 0) {
      page.drawText(`[첨부 파일: ${item.matchedTemplate.files.map(f => f.name).join(", ")}]`, {
        x: margin,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.5, 0.8),
      });
      yPosition -= lineHeight;
    }

    // 항목 간 간격
    yPosition -= 20;
  }

  // 푸터
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  if (lastPage) {
    const footerText = `생성일시: ${new Date().toLocaleString("ko-KR")}`;
    lastPage.drawText(footerText, {
      x: margin,
      y: 30,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
