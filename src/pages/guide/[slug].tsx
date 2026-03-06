/**
 * 보정권고 안내사항 공개 페이지
 * 
 * 인증 없이 공유 링크로 접근 가능
 * 수동 추가 항목 및 편집된 내용 반영
 */

import { type NextPage } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { 
  FileText, 
  Download, 
  Image as ImageIcon,
  File,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  Hash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { api } from "~/utils/api";
import { useState } from "react";

// 매칭 결과 타입
interface MatchedTemplate {
  id: string;
  title: string;
  content: string;
  images: Array<{ key: string; name: string; type: string; size: number }>;
  files: Array<{ key: string; name: string; type: string; size: number }>;
}

interface TemplateMatchResult {
  itemNumber: number;
  itemContent: string;
  matchedTemplate: MatchedTemplate | null;
  confidenceScore: number;
  matchReason: string;
  isSelected: boolean;
}

// 수동 추가 안내사항 타입
interface ManualGuideItem {
  id: string;
  title: string;
  defectContent: string;
  content: string;
}

const SharedGuidePage: NextPage = () => {
  const router = useRouter();
  const { slug } = router.query;
  
  // 흠결사항 펼침 상태
  const [expandedDefects, setExpandedDefects] = useState<Set<string>>(new Set());
  
  // 분석 결과 조회
  const { data: analysis, isLoading, error } = api.correctionGuide.getAnalysisByShareSlug.useQuery(
    { slug: slug as string },
    { enabled: !!slug, retry: false }
  );

  // 파일 다운로드 핸들러
  const handleFileDownload = async (fileKey: string, fileName: string) => {
    try {
      const response = await fetch(`/api/correction-guide/download?key=${encodeURIComponent(fileKey)}`);
      if (!response.ok) throw new Error("다운로드 실패");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("파일 다운로드 실패:", error);
      alert("파일 다운로드에 실패했습니다");
    }
  };

  // 흠결사항 펼침/접힘 토글
  const toggleDefectExpand = (key: string) => {
    setExpandedDefects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">안내사항을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 또는 만료
  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              페이지를 찾을 수 없습니다
            </h1>
            <p className="text-gray-600 mb-4">
              공유 링크가 만료되었거나 존재하지 않습니다.
            </p>
            <p className="text-sm text-gray-500">
              담당 법무사/변호사에게 새로운 링크를 요청해주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matchResults = (analysis.matchedTemplates as unknown as TemplateMatchResult[]) ?? [];
  const manualItems = (analysis.manualItems as unknown as ManualGuideItem[]) ?? [];
  const editedContents = (analysis.editedContents as unknown as Record<string, string>) ?? {};
  
  // 선택된 AI 매칭 항목 (중복 제거)
  const selectedItems = matchResults.filter(r => r.isSelected && r.matchedTemplate);
  const seenTemplateIds = new Set<string>();
  const deduplicatedItems: TemplateMatchResult[] = [];
  
  for (const item of selectedItems) {
    if (item.matchedTemplate) {
      if (!seenTemplateIds.has(item.matchedTemplate.id)) {
        seenTemplateIds.add(item.matchedTemplate.id);
        deduplicatedItems.push(item);
      }
    }
  }

  const totalItems = deduplicatedItems.length + manualItems.length;

  return (
    <>
      <Head>
        <title>보정권고 안내사항 - {analysis.case?.caseNumber}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white print:bg-white">
        {/* 헤더 */}
        <header className="bg-white border-b shadow-sm print:shadow-none sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-6 w-6 text-blue-600" />
                  보정권고 안내사항
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    {analysis.case?.caseNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {analysis.case?.debtorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(analysis.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="print:hidden"
                onClick={() => window.print()}
              >
                인쇄
              </Button>
            </div>
          </div>
        </header>

        {/* 본문 */}
        <main className="max-w-3xl mx-auto px-4 py-8">
          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 print:hidden">
            <p className="text-blue-800 text-sm">
              <strong>📋 안내사항 확인</strong><br />
              아래 내용을 참고하여 보정서류를 준비해주세요.
              첨부된 이미지와 파일을 다운로드하여 확인하실 수 있습니다.
            </p>
          </div>

          {/* 안내사항 목록 */}
          <div className="space-y-8">
            {totalItems === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  표시할 안내사항이 없습니다.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* AI 매칭 항목 */}
                {deduplicatedItems.map((item, index) => {
                  const contentKey = `matched-${item.itemNumber}`;
                  const displayContent = editedContents[contentKey] ?? item.matchedTemplate?.content ?? "";
                  const defectKey = `defect-matched-${item.itemNumber}`;
                  const isDefectExpanded = expandedDefects.has(defectKey);
                  
                  return (
                    <Card key={item.itemNumber} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* 항목 헤더 */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 text-white">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full font-bold">
                            {index + 1}
                          </span>
                          <h2 className="text-lg font-semibold">
                            {item.matchedTemplate?.title}
                          </h2>
                        </div>
                      </div>
                      
                      <CardContent className="pt-5 pb-6">
                        {/* 원본 흠결사항 (접히는 형태) */}
                        <Collapsible open={isDefectExpanded} onOpenChange={() => toggleDefectExpand(defectKey)}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full text-left bg-gray-100 rounded-lg p-3 mb-5 border-l-4 border-gray-400 hover:bg-gray-200 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500">📌 흠결사항 {isDefectExpanded ? "" : "(클릭하여 확인)"}</span>
                                {isDefectExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="bg-gray-100 rounded-lg p-3 mb-5 -mt-5 pt-1 border-l-4 border-gray-400 border-t border-gray-200">
                              <p className="text-gray-700 text-sm">{item.itemContent}</p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* 안내 내용 */}
                        <div className="prose prose-sm max-w-none mb-5">
                          <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                            {displayContent}
                          </p>
                        </div>

                        {/* 첨부 이미지 */}
                        {item.matchedTemplate?.images && item.matchedTemplate.images.length > 0 && (
                          <div className="mt-6 pt-5 border-t">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <ImageIcon className="h-4 w-4 text-blue-600" />
                              참고 이미지
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {item.matchedTemplate.images.map((img, imgIdx) => (
                                <div key={imgIdx} className="border rounded-lg overflow-hidden bg-gray-50">
                                  <img
                                    src={`/api/correction-guide/download?key=${encodeURIComponent(img.key)}`}
                                    alt={img.name}
                                    className="w-full h-auto max-h-56 object-contain"
                                    loading="lazy"
                                  />
                                  <div className="p-2 bg-white border-t text-xs text-gray-600 flex items-center justify-between">
                                    <span className="truncate">{img.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 print:hidden"
                                      onClick={() => handleFileDownload(img.key, img.name)}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 첨부 파일 */}
                        {item.matchedTemplate?.files && item.matchedTemplate.files.length > 0 && (
                          <div className="mt-6 pt-5 border-t">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <File className="h-4 w-4 text-blue-600" />
                              첨부 파일
                            </h4>
                            <div className="space-y-2">
                              {item.matchedTemplate.files.map((file, fileIdx) => (
                                <div 
                                  key={fileIdx} 
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <File className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">
                                        {file.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFileDownload(file.key, file.name)}
                                    className="print:hidden"
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    다운로드
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* 수동 추가 항목 */}
                {manualItems.map((item, index) => {
                  const defectKey = `defect-manual-${item.id}`;
                  const isDefectExpanded = expandedDefects.has(defectKey);
                  
                  return (
                    <Card key={item.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* 항목 헤더 */}
                      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-4 text-white">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full font-bold">
                            {deduplicatedItems.length + index + 1}
                          </span>
                          <h2 className="text-lg font-semibold">
                            {item.title}
                          </h2>
                        </div>
                      </div>
                      
                      <CardContent className="pt-5 pb-6">
                        {/* 흠결사항 (있는 경우) */}
                        {item.defectContent && (
                          <Collapsible open={isDefectExpanded} onOpenChange={() => toggleDefectExpand(defectKey)}>
                            <CollapsibleTrigger asChild>
                              <button className="w-full text-left bg-purple-50 rounded-lg p-3 mb-5 border-l-4 border-purple-400 hover:bg-purple-100 transition-colors">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-purple-600">📌 흠결사항 {isDefectExpanded ? "" : "(클릭하여 확인)"}</span>
                                  {isDefectExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-purple-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-purple-400" />
                                  )}
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="bg-purple-50 rounded-lg p-3 mb-5 -mt-5 pt-1 border-l-4 border-purple-400 border-t border-purple-200">
                                <p className="text-purple-800 text-sm">{item.defectContent}</p>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* 안내 내용 */}
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                            {item.content}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>

          {/* 푸터 */}
          <div className="mt-12 pt-6 border-t text-center text-sm text-gray-500 print:mt-8">
            <p>이 문서는 자동 생성된 안내 문서입니다.</p>
            <p className="mt-1">
              문의사항은 담당 법무사/변호사에게 연락해주세요.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              생성일시: {new Date(analysis.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default SharedGuidePage;
