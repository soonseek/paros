/**
 * 보정권고 안내사항 공개 페이지
 * 
 * 인증 없이 공유 링크로 접근 가능
 * 깔끔한 문서 형식으로 표시
 */

import { type NextPage } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { 
  FileText, 
  Download, 
  CheckCircle2,
  Image as ImageIcon,
  File,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
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
  const selectedItems = matchResults.filter(r => r.isSelected && r.matchedTemplate);

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
            {selectedItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  표시할 안내사항이 없습니다.
                </CardContent>
              </Card>
            ) : (
              selectedItems.map((item, index) => (
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
                    {/* 원본 흠결사항 */}
                    <div className="bg-gray-100 rounded-lg p-4 mb-5 border-l-4 border-gray-400">
                      <p className="text-xs font-semibold text-gray-500 mb-1">📌 흠결사항</p>
                      <p className="text-gray-700 text-sm">
                        {item.itemContent}
                      </p>
                    </div>

                    {/* 안내 내용 */}
                    <div className="prose prose-sm max-w-none mb-5">
                      <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                        {item.matchedTemplate?.content}
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
              ))
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
