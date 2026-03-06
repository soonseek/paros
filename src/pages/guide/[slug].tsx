/**
 * 보정권고 안내사항 공개 페이지
 * 
 * 인증 없이 공유 링크로 접근 가능
 */

import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import Head from "next/head";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Image as ImageIcon,
  File,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/utils/api";

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

const SharedGuidePage: NextPage = () => {
  const router = useRouter();
  const { slug } = router.query;
  
  // 분석 결과 조회
  const { data: analysis, isLoading, error } = api.correctionGuide.getAnalysisByShareSlug.useQuery(
    { slug: slug as string },
    { enabled: !!slug }
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

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
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
  const selectedItems = matchResults.filter(r => r.isSelected && r.matchedTemplate);

  return (
    <>
      <Head>
        <title>보정권고 안내사항 - {analysis.case?.caseNumber}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  보정권고 안내사항
                </h1>
                <p className="text-sm text-gray-500">
                  사건번호: {analysis.case?.caseNumber} | 채무자: {analysis.case?.debtorName}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </header>

        {/* 본문 */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          {/* 안내 메시지 */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <p className="text-blue-800 text-sm">
                아래 안내사항을 참고하여 보정서류를 준비해주세요.
                첨부된 이미지와 파일을 확인하시고, 궁금한 사항은 담당 법무사/변호사에게 문의해주세요.
              </p>
            </CardContent>
          </Card>

          {/* 안내사항 목록 */}
          <div className="space-y-6">
            {selectedItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  표시할 안내사항이 없습니다.
                </CardContent>
              </Card>
            ) : (
              selectedItems.map((item, index) => (
                <Card key={item.itemNumber} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm">
                          {index + 1}
                        </span>
                        <CardTitle className="text-lg">
                          {item.matchedTemplate?.title}
                        </CardTitle>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    </div>
                    
                    {/* 원본 흠결사항 */}
                    <div className="mt-3 p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
                      <span className="font-medium text-gray-700">흠결사항: </span>
                      {item.itemContent}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-4">
                    {/* 안내 내용 */}
                    <div className="prose prose-sm max-w-none mb-4">
                      <p className="whitespace-pre-wrap text-gray-700">
                        {item.matchedTemplate?.content}
                      </p>
                    </div>

                    {/* 첨부 이미지 */}
                    {item.matchedTemplate?.images && item.matchedTemplate.images.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          참고 이미지 ({item.matchedTemplate.images.length}개)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {item.matchedTemplate.images.map((img, imgIdx) => (
                            <div key={imgIdx} className="border rounded-lg overflow-hidden">
                              <img
                                src={`/api/correction-guide/download?key=${encodeURIComponent(img.key)}`}
                                alt={img.name}
                                className="w-full h-auto max-h-64 object-contain bg-gray-100"
                                loading="lazy"
                              />
                              <div className="p-2 bg-gray-50 text-xs text-gray-600 truncate">
                                {img.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 첨부 파일 */}
                    {item.matchedTemplate?.files && item.matchedTemplate.files.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <File className="h-4 w-4" />
                          첨부 파일 ({item.matchedTemplate.files.length}개)
                        </h4>
                        <div className="space-y-2">
                          {item.matchedTemplate.files.map((file, fileIdx) => (
                            <div 
                              key={fileIdx} 
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-700 truncate">
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
              ))
            )}
          </div>

          {/* 푸터 */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>이 페이지는 자동 생성된 안내 문서입니다.</p>
            <p className="mt-1">
              생성일시: {new Date(analysis.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default SharedGuidePage;
