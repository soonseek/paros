/**
 * 보정권고 안내사항 관련 타입 정의
 */

// 파일 정보 타입
export interface FileInfo {
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// 매칭된 템플릿 정보
export interface MatchedTemplate {
  id: string;
  title: string;
  content: string;
  images: FileInfo[];
  files: FileInfo[];
}

// 템플릿 매칭 결과
export interface TemplateMatchResult {
  itemNumber: number;
  itemContent: string;
  matchedTemplate: MatchedTemplate | null;
  confidenceScore: number;
  matchReason: string;
  isSelected: boolean;
}

// 사건 정보
export interface CaseInfo {
  caseNumber: string;
  debtorName: string;
}

// 추출된 흠결사항 항목
export interface ExtractedDefectItem {
  number: number;
  content: string;
}
