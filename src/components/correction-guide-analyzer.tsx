/**
 * 보정권고 안내사항 분석 컴포넌트
 * 
 * - 파일 업로드 (드래그앤드롭)
 * - 분석 결과 표시
 * - 항목 선택/해제
 * - PDF/링크 추출
 */

import { useState, useRef, useCallback } from "react";
import { 
  Upload, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  FileText,
  Download,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  File,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/utils/api";
import { toast } from "sonner";
import Link from "next/link";

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

interface Analysis {
  id: string;
  caseId: string;
  originalFileName: string | null;
  analysisStatus: string;
  extractedItems: unknown;
  matchedTemplates: unknown;
  selectedItems: unknown;
  shareSlug: string | null;
  shareExpiresAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

interface CorrectionGuideAnalyzerProps {
  caseId: string;
  userRole?: string;
}

export function CorrectionGuideAnalyzer({ caseId, userRole }: CorrectionGuideAnalyzerProps) {
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 상태
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  // 분석 결과 목록 조회
  const { data: analyses, isLoading: isLoadingAnalyses } = api.correctionGuide.getAnalysesForCase.useQuery(
    { caseId },
    { enabled: !!caseId }
  );

  // 분석 실행 mutation
  const analyzeMutation = api.correctionGuide.analyzeDocument.useMutation({
    onSuccess: () => {
      toast.success("보정권고서 분석이 완료되었습니다");
      void utils.correctionGuide.getAnalysesForCase.invalidate({ caseId });
    },
    onError: (error) => {
      toast.error(error.message || "분석에 실패했습니다");
    },
  });

  // 선택 항목 업데이트 mutation
  const updateSelectionMutation = api.correctionGuide.updateSelectedItems.useMutation({
    onSuccess: () => {
      void utils.correctionGuide.getAnalysesForCase.invalidate({ caseId });
    },
  });

  // PDF 생성 mutation
  const generatePdfMutation = api.correctionGuide.generatePDF.useMutation({
    onSuccess: (data) => {
      // Base64 → Blob → 다운로드
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("PDF가 다운로드되었습니다");
    },
    onError: (error) => {
      toast.error(error.message || "PDF 생성에 실패했습니다");
    },
  });

  // 공유 링크 생성 mutation
  const createShareLinkMutation = api.correctionGuide.createShareLink.useMutation({
    onSuccess: (data) => {
      void utils.correctionGuide.getAnalysesForCase.invalidate({ caseId });
      toast.success("공유 링크가 생성되었습니다");
    },
    onError: (error) => {
      toast.error(error.message || "링크 생성에 실패했습니다");
    },
  });

  // 분석 삭제 mutation
  const deleteAnalysisMutation = api.correctionGuide.deleteAnalysis.useMutation({
    onSuccess: () => {
      toast.success("분석 결과가 삭제되었습니다");
      void utils.correctionGuide.getAnalysesForCase.invalidate({ caseId });
    },
    onError: (error) => {
      toast.error(error.message || "삭제에 실패했습니다");
    },
  });

  // 파일 처리
  const handleFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file) return;
    
    // 파일 타입 검증
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("PDF 또는 이미지 파일만 업로드할 수 있습니다");
      return;
    }

    // 파일 크기 검증 (최대 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("파일 크기는 20MB를 초과할 수 없습니다");
      return;
    }

    setIsUploading(true);
    
    try {
      // Base64 변환
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // data:application/pdf;base64, 부분 제거
          const base64 = result.split(",")[1];
          resolve(base64 ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 분석 실행
      await analyzeMutation.mutateAsync({
        caseId,
        fileName: file.name,
        fileData,
        fileType: file.type,
      });
    } catch (error) {
      console.error("파일 업로드 실패:", error);
    } finally {
      setIsUploading(false);
    }
  }, [caseId, analyzeMutation]);

  // 드래그앤드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // 항목 선택 토글
  const handleItemToggle = (analysisId: string, itemNumber: number, currentSelected: number[]) => {
    const newSelected = currentSelected.includes(itemNumber)
      ? currentSelected.filter(n => n !== itemNumber)
      : [...currentSelected, itemNumber];
    
    updateSelectionMutation.mutate({
      analysisId,
      selectedItemNumbers: newSelected,
    });
  };

  // 공유 링크 복사
  const copyShareLink = (slug: string) => {
    const url = `${window.location.origin}/guide/${slug}`;
    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("링크가 복사되었습니다");
  };

  // 신뢰도에 따른 색상
  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-blue-600 bg-blue-50";
    if (score >= 50) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  // 최신 분석 결과
  const latestAnalysis = analyses?.[0];
  const matchResults = latestAnalysis?.matchedTemplates as unknown as TemplateMatchResult[] ?? [];
  const selectedItems = (latestAnalysis?.selectedItems as number[]) ?? [];

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg sm:text-xl font-bold dark:text-gray-100">
            보정권고 안내사항 만들기
          </h2>
          {(userRole === "ADMIN" || userRole === "SUPER") && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link 
                    href="/admin/correction-guide-templates"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    템플릿 관리
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>ADMIN 사용자에게만 보이는 링크입니다</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* 기존 분석 결과가 있으면 액션 버튼 표시 */}
        {latestAnalysis && latestAnalysis.analysisStatus === "completed" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generatePdfMutation.mutate({ 
                analysisId: latestAnalysis.id,
                selectedOnly: true,
              })}
              disabled={generatePdfMutation.isPending}
            >
              {generatePdfMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              문서 추출
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (latestAnalysis.shareSlug) {
                  copyShareLink(latestAnalysis.shareSlug);
                } else {
                  setSelectedAnalysisId(latestAnalysis.id);
                  setShareDialogOpen(true);
                }
              }}
              disabled={createShareLinkMutation.isPending}
            >
              {createShareLinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : latestAnalysis.shareSlug ? (
                <Copy className="h-4 w-4 mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {latestAnalysis.shareSlug ? "링크 복사" : "링크 추출"}
            </Button>
          </div>
        )}
      </div>

      {/* 업로드 영역 (분석 중이 아닐 때) */}
      {(!latestAnalysis || latestAnalysis.analysisStatus === "failed") && !isUploading && !analyzeMutation.isPending && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging 
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
              : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-blue-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => e.target.files && void handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                보정권고/명령서를 여기에 드롭하세요
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                또는 클릭하여 파일 선택
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, 이미지 파일 지원 (최대 20MB)
            </p>
          </div>
        </div>
      )}

      {/* 분석 중 표시 */}
      {(isUploading || analyzeMutation.isPending) && (
        <div className="py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">
            보정권고서 분석 중...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            OCR 및 AI 매칭 작업이 진행됩니다. 잠시만 기다려주세요.
          </p>
        </div>
      )}

      {/* 분석 결과 표시 */}
      {latestAnalysis && latestAnalysis.analysisStatus === "completed" && matchResults.length > 0 && (
        <div className="space-y-4">
          {/* 분석 정보 */}
          <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>{latestAnalysis.originalFileName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{matchResults.length}개 항목 추출</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                다시 분석
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => e.target.files && void handleFiles(e.target.files)}
              />
            </div>
          </div>

          {/* 매칭 결과 목록 */}
          <div className="space-y-3">
            {matchResults.map((item) => (
              <Collapsible
                key={item.itemNumber}
                open={expandedItems.has(item.itemNumber)}
                onOpenChange={(open: boolean) => {
                  const newExpanded = new Set(expandedItems);
                  if (open) {
                    newExpanded.add(item.itemNumber);
                  } else {
                    newExpanded.delete(item.itemNumber);
                  }
                  setExpandedItems(newExpanded);
                }}
              >
                <div className={`border rounded-lg overflow-hidden ${
                  item.isSelected ? "border-blue-200 bg-blue-50/30" : "border-gray-200"
                }`}>
                  {/* 항목 헤더 */}
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800">
                    <Checkbox
                      checked={selectedItems.includes(item.itemNumber)}
                      onCheckedChange={() => handleItemToggle(
                        latestAnalysis.id,
                        item.itemNumber,
                        selectedItems
                      )}
                    />
                    
                    <CollapsibleTrigger asChild>
                      <button className="flex-1 flex items-center justify-between text-left">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full text-sm font-medium">
                            {item.itemNumber}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {item.matchedTemplate?.title ?? "매칭된 템플릿 없음"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getConfidenceColor(item.confidenceScore)}>
                            {item.confidenceScore}%
                          </Badge>
                          {expandedItems.has(item.itemNumber) ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  {/* 항목 상세 */}
                  <CollapsibleContent>
                    <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 space-y-4">
                      {/* 원본 흠결사항 */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 mb-1">원본 흠결사항</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border">
                          {item.itemContent}
                        </p>
                      </div>

                      {/* 매칭 근거 */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 mb-1">매칭 판단 근거</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.matchReason}
                        </p>
                      </div>

                      {/* 템플릿 내용 */}
                      {item.matchedTemplate && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 mb-1">안내 내용</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {item.matchedTemplate.content}
                          </p>
                        </div>
                      )}

                      {/* 첨부 이미지/파일 표시 */}
                      {item.matchedTemplate?.images && item.matchedTemplate.images.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            첨부 이미지
                          </h4>
                          <div className="flex gap-2 overflow-x-auto">
                            {item.matchedTemplate.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={`/api/correction-guide/download?key=${encodeURIComponent(img.key)}`}
                                alt={img.name}
                                className="h-20 w-auto rounded border"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {item.matchedTemplate?.files && item.matchedTemplate.files.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <File className="h-3 w-3" />
                            첨부 파일
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {item.matchedTemplate.files.map((file, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {file.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>

          {/* 선택 요약 */}
          <div className="flex items-center justify-between pt-3 border-t text-sm">
            <span className="text-muted-foreground">
              {selectedItems.length}개 항목 선택됨
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                const allNumbers = matchResults.map(r => r.itemNumber);
                const allSelected = selectedItems.length === allNumbers.length;
                updateSelectionMutation.mutate({
                  analysisId: latestAnalysis.id,
                  selectedItemNumbers: allSelected ? [] : allNumbers,
                });
              }}
            >
              {selectedItems.length === matchResults.length ? "전체 해제" : "전체 선택"}
            </Button>
          </div>
        </div>
      )}

      {/* 분석 실패 */}
      {latestAnalysis && latestAnalysis.analysisStatus === "failed" && (
        <div className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
            분석에 실패했습니다
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {latestAnalysis.errorMessage ?? "알 수 없는 오류가 발생했습니다"}
          </p>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* 공유 링크 생성 다이얼로그 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공유 링크 생성</DialogTitle>
            <DialogDescription>
              고객에게 안내사항을 공유할 수 있는 링크를 생성합니다.
              인증 없이 접근 가능하며, 선택한 항목만 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={async () => {
                if (selectedAnalysisId) {
                  await createShareLinkMutation.mutateAsync({ analysisId: selectedAnalysisId });
                  setShareDialogOpen(false);
                }
              }}
              disabled={createShareLinkMutation.isPending}
            >
              {createShareLinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              링크 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
