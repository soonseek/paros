/**
 * 보정권고 안내사항 PDF 생성 서비스
 * 
 * pdf-lib + fontkit 사용, 한글 폰트(Noto Sans KR) 지원
 */

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs/promises";
import * as path from "path";
import { downloadFile } from "~/lib/storage";
import type { TemplateMatchResult, CaseInfo } from "~/types/correction-guide";

// 한글 폰트 경로 (우선순위 순)
const KOREAN_FONT_PATHS = [
  path.join(process.cwd(), "public/fonts/NotoSansKR-Regular.ttf"),
  "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
];

/**
 * 한글 폰트 로드
 */
async function loadKoreanFont(): Promise<Uint8Array | null> {
  for (const fontPath of KOREAN_FONT_PATHS) {
    try {
      const fontBuffer = await fs.readFile(fontPath);
      console.log(`[PDF] 한글 폰트 로드 성공: ${fontPath}`);
      return new Uint8Array(fontBuffer);
    } catch {
      console.log(`[PDF] 폰트 경로 시도 실패: ${fontPath}`);
    }
  }
  console.error("[PDF] 한글 폰트를 찾을 수 없습니다");
  return null;
}

/**
 * 텍스트 줄바꿈 처리 (폰트 메트릭 기반)
 */
function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    
    let currentLine = "";
    for (const char of paragraph) {
      if (currentLine.length >= maxChars) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine += char;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
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

  // 한글 폰트 로드
  const koreanFontBuffer = await loadKoreanFont();
  if (!koreanFontBuffer) {
    throw new Error("한글 폰트를 로드할 수 없습니다. 서버 관리자에게 문의하세요.");
  }

  const font = await pdfDoc.embedFont(koreanFontBuffer);

  // 필터링
  const itemsToInclude = selectedOnly 
    ? matchResults.filter(r => r.isSelected && r.matchedTemplate)
    : matchResults.filter(r => r.matchedTemplate);

  if (itemsToInclude.length === 0) {
    throw new Error("선택된 안내사항이 없습니다.");
  }

  // 페이지 설정 (A4)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const maxCharsPerLine = 45; // 한글 기준 한 줄 최대 글자 수

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // 제목
  const titleFontSize = 20;
  page.drawText("보정권고 안내사항", {
    x: margin,
    y: yPosition,
    size: titleFontSize,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= titleFontSize + 15;

  // 사건 정보
  const infoFontSize = 11;
  page.drawText(`사건번호: ${caseInfo.caseNumber}`, {
    x: margin,
    y: yPosition,
    size: infoFontSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPosition -= infoFontSize + 5;

  page.drawText(`채무자: ${caseInfo.debtorName}`, {
    x: margin,
    y: yPosition,
    size: infoFontSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPosition -= infoFontSize + 5;

  page.drawText(`생성일: ${new Date().toLocaleDateString("ko-KR")}`, {
    x: margin,
    y: yPosition,
    size: infoFontSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPosition -= 25;

  // 구분선
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  yPosition -= 25;

  // 각 항목 렌더링
  const contentFontSize = 10;
  const lineHeight = contentFontSize + 5;
  const titleFontSizeItem = 12;

  for (let idx = 0; idx < itemsToInclude.length; idx++) {
    const item = itemsToInclude[idx];
    if (!item?.matchedTemplate) continue;

    // 새 페이지 필요 체크
    if (yPosition < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }

    // 항목 번호 및 제목
    const itemTitle = `${idx + 1}. ${item.matchedTemplate.title}`;
    page.drawText(itemTitle, {
      x: margin,
      y: yPosition,
      size: titleFontSizeItem,
      font,
      color: rgb(0.15, 0.15, 0.5),
    });
    yPosition -= titleFontSizeItem + 10;

    // 원본 흠결사항 박스
    const defectBoxHeight = 35;
    page.drawRectangle({
      x: margin,
      y: yPosition - defectBoxHeight,
      width: contentWidth,
      height: defectBoxHeight,
      color: rgb(0.96, 0.96, 0.96),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5,
    });
    
    const defectContent = item.itemContent.length > 70 
      ? item.itemContent.substring(0, 70) + "..." 
      : item.itemContent;
    
    page.drawText("[흠결사항]", {
      x: margin + 8,
      y: yPosition - 14,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    page.drawText(defectContent, {
      x: margin + 8,
      y: yPosition - 28,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    yPosition -= defectBoxHeight + 12;

    // 안내 내용
    const contentLines = wrapText(item.matchedTemplate.content, maxCharsPerLine);
    
    for (const line of contentLines) {
      if (yPosition < margin + 30) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: contentFontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= lineHeight;
    }

    // 이미지 삽입
    if (item.matchedTemplate.images && item.matchedTemplate.images.length > 0) {
      yPosition -= 8;
      
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
            const maxImgWidth = contentWidth * 0.7;
            const maxImgHeight = 200;
            const scaleW = maxImgWidth / image.width;
            const scaleH = maxImgHeight / image.height;
            const scale = Math.min(scaleW, scaleH, 1);
            const imgWidth = image.width * scale;
            const imgHeight = image.height * scale;
            
            if (yPosition - imgHeight < margin + 30) {
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
      if (yPosition < margin + 30) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      const fileNames = item.matchedTemplate.files.map(f => f.name).join(", ");
      page.drawText(`[첨부파일] ${fileNames}`, {
        x: margin,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.3, 0.5, 0.7),
      });
      yPosition -= lineHeight;
    }

    // 항목 구분선
    yPosition -= 15;
    if (idx < itemsToInclude.length - 1 && yPosition > margin + 50) {
      page.drawLine({
        start: { x: margin + 20, y: yPosition },
        end: { x: pageWidth - margin - 20, y: yPosition },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
        dashArray: [3, 3],
      });
      yPosition -= 20;
    }
  }

  // 푸터 (모든 페이지에)
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (!p) continue;
    
    p.drawText(`- ${i + 1} / ${pages.length} -`, {
      x: pageWidth / 2 - 20,
      y: 25,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
