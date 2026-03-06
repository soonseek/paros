/**
 * 보정권고 안내사항 분석 컴포넌트
 * 
 * 2열 레이아웃: 왼쪽(카드 리스트), 오른쪽(미리보기)
 * 개선된 UX: 기본 펼침, 매칭 없음 강조, 토스트 메시지
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  FileWarning,
  Sparkles,
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
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set()); // 접힌 항목만 추적
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
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
      try {
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
        
        toast.success("PDF 문서가 다운로드되었습니다");
      } catch (e) {
        toast.error("PDF 다운로드 중 오류가 발생했습니다");
      }
    },
    onError: (error) => {
      toast.error(error.message || "PDF 생성에 실패했습니다");
    },
  });

  // 공유 링크 생성 mutation
  const createShareLinkMutation = api.correctionGuide.createShareLink.useMutation({
    onSuccess: (data) => {
      void utils.correctionGuide.getAnalysesForCase.invalidate({ caseId });
      // 링크 바로 복사
      const url = `${window.location.origin}/guide/${data.shareSlug}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success("공유 링크가 생성되어 클립보드에 복사되었습니다", {
          description: url,
          duration: 5000,
        });
      }).catch(() => {
        toast.success("공유 링크가 생성되었습니다", {
          description: url,
          duration: 5000,
        });
      });
      setShareDialogOpen(false);
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
    
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("PDF 또는 이미지 파일만 업로드할 수 있습니다");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("파일 크기는 20MB를 초과할 수 없습니다");
      return;
    }

    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64 ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

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

  // 아이템 접기/펴기
  const toggleCollapse = (itemNumber: number) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemNumber)) {
        newSet.delete(itemNumber);
      } else {
        newSet.add(itemNumber);
      }
      return newSet;
    });
  };

  // 공유 링크 복사
  const copyShareLink = async (slug: string) => {
    const url = `${window.location.origin}/guide/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크가 클립보드에 복사되었습니다", {
        description: url,
        duration: 3000,
      });
    } catch (error) {
      // 클립보드 API 실패 시 대체 방법
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("링크가 클립보드에 복사되었습니다", {
          description: url,
          duration: 3000,
        });
      } catch {
        toast.error("링크 복사에 실패했습니다. 직접 복사해주세요: " + url);
      }
      document.body.removeChild(textArea);
    }
  };

  // 신뢰도에 따른 스타일
  const getConfidenceStyle = (score: number) => {
    if (score >= 90) return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800" };
    if (score >= 70) return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" };
    if (score >= 50) return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" };
    return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" };
  };

  // 최신 분석 결과
  const latestAnalysis = analyses?.[0];
  const matchResults = (latestAnalysis?.matchedTemplates as unknown as TemplateMatchResult[]) ?? [];
  const selectedItems = (latestAnalysis?.selectedItems as number[]) ?? [];

  // 선택된 항목만 필터링 (미리보기용)
  const selectedMatchResults = useMemo(() => {
    return matchResults.filter(r => selectedItems.includes(r.itemNumber) && r.matchedTemplate);
  }, [matchResults, selectedItems]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (!latestAnalysis) return;
    const allNumbers = matchResults.filter(r => r.matchedTemplate).map(r => r.itemNumber);
    const allSelected = selectedItems.length === allNumbers.length;
    updateSelectionMutation.mutate({
      analysisId: latestAnalysis.id,
      selectedItemNumbers: allSelected ? [] : allNumbers,
    });
  };

  // 분석 결과가 없거나 로딩 중일 때
  const showUploadArea = !latestAnalysis || latestAnalysis.analysisStatus === "failed";
  const isProcessing = isUploading || analyzeMutation.isPending;
  const hasResults = latestAnalysis && latestAnalysis.analysisStatus === "completed" && matchResults.length > 0;

  return (
    <Card className="p-0 overflow-hidden">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 border-b bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold dark:text-gray-100">
              보정권고 안내사항 만들기
            </h2>
            <p className="text-xs text-muted-foreground">
              AI가 보정명령서를 분석하여 맞춤 안내사항을 생성합니다
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(userRole === "ADMIN" || userRole === "SUPER") && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link 
                    href="/admin/correction-guide-templates"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30"
                  >
                    템플릿 관리
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>안내사항 템플릿을 추가/수정합니다</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* 업로드 영역 */}
        {showUploadArea && !isProcessing && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]" 
                : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-blue-400 hover:bg-blue-50/50"
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
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center">
                <Upload className="h-10 w-10 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-lg text-gray-700 dark:text-gray-300">
                  보정권고/명령서 업로드
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  파일을 드래그하거나 클릭하여 선택하세요
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">PDF</Badge>
                <Badge variant="secondary">JPG</Badge>
                <Badge variant="secondary">PNG</Badge>
                <span>최대 20MB</span>
              </div>
            </div>
          </div>
        )}

        {/* 분석 중 */}
        {isProcessing && (
          <div className="py-16 text-center">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 relative" />
            </div>
            <p className="font-semibold text-lg text-gray-700 dark:text-gray-300 mt-6">
              AI 분석 중...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              문서를 인식하고 템플릿을 매칭하고 있습니다
            </p>
          </div>
        )}

        {/* 분석 실패 */}
        {latestAnalysis && latestAnalysis.analysisStatus === "failed" && !isProcessing && (
          <div className="py-12 text-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
          </div>
        )}

        {/* 분석 결과 - 2열 레이아웃 */}
        {hasResults && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽: 카드 리스트 */}
            <div className="space-y-4">
              {/* 액션 바 */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{latestAnalysis.originalFileName}</span>
                  <Badge variant="outline">{matchResults.length}개 항목</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
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

              {/* 항목 선택 바 */}
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 inline mr-1" />
                  {selectedItems.length}개 선택됨
                </span>
                <Button variant="link" size="sm" className="h-6 p-0" onClick={handleSelectAll}>
                  {selectedItems.length === matchResults.filter(r => r.matchedTemplate).length ? "전체 해제" : "전체 선택"}
                </Button>
              </div>

              {/* 카드 목록 */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {matchResults.map((item) => {
                  const isExpanded = !collapsedItems.has(item.itemNumber);
                  const isSelected = selectedItems.includes(item.itemNumber);
                  const hasTemplate = !!item.matchedTemplate;
                  const confidenceStyle = getConfidenceStyle(item.confidenceScore);

                  return (
                    <div
                      key={item.itemNumber}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        !hasTemplate 
                          ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20" 
                          : isSelected 
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/20" 
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      }`}
                    >
                      {/* 항목 헤더 */}
                      <div 
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          !hasTemplate ? "bg-red-100/50 dark:bg-red-900/30" : ""
                        }`}
                        onClick={() => toggleCollapse(item.itemNumber)}
                      >
                        {hasTemplate ? (
                          <Checkbox
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => handleItemToggle(
                              latestAnalysis.id,
                              item.itemNumber,
                              selectedItems
                            )}
                          />
                        ) : (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <FileWarning className="h-4 w-4 text-red-500" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full text-xs font-bold">
                              {item.itemNumber}
                            </span>
                            <span className={`font-medium truncate ${!hasTemplate ? "text-red-600 dark:text-red-400" : ""}`}>
                              {hasTemplate ? item.matchedTemplate?.title : "매칭된 템플릿 없음"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {hasTemplate ? (
                            <Badge className={`${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border} border`}>
                              {item.confidenceScore}%
                            </Badge>
                          ) : (
                            <Badge variant="destructive">매칭 실패</Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* 항목 상세 */}
                      {isExpanded && (
                        <div className="p-4 border-t bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                          {/* 원본 흠결사항 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              원본 흠결사항
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2.5 rounded-lg border text-wrap break-words">
                              {item.itemContent}
                            </p>
                          </div>

                          {/* 매칭 근거 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI 판단 근거
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                              {item.matchReason}
                            </p>
                          </div>

                          {/* 템플릿 내용 미리보기 */}
                          {hasTemplate && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">안내 내용</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
                                {item.matchedTemplate?.content}
                              </p>
                            </div>
                          )}

                          {/* 첨부 파일 */}
                          {hasTemplate && (item.matchedTemplate?.images?.length ?? 0) + (item.matchedTemplate?.files?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {item.matchedTemplate?.images?.map((img, idx) => (
                                <Badge key={`img-${idx}`} variant="secondary" className="text-xs">
                                  <ImageIcon className="h-3 w-3 mr-1" />
                                  {img.name}
                                </Badge>
                              ))}
                              {item.matchedTemplate?.files?.map((file, idx) => (
                                <Badge key={`file-${idx}`} variant="secondary" className="text-xs">
                                  <File className="h-3 w-3 mr-1" />
                                  {file.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  className="flex-1"
                  onClick={() => generatePdfMutation.mutate({ 
                    analysisId: latestAnalysis.id,
                    selectedOnly: true,
                  })}
                  disabled={generatePdfMutation.isPending || selectedItems.length === 0}
                >
                  {generatePdfMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  문서 추출 (PDF)
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (latestAnalysis.shareSlug) {
                      void copyShareLink(latestAnalysis.shareSlug);
                    } else {
                      setSelectedAnalysisId(latestAnalysis.id);
                      setShareDialogOpen(true);
                    }
                  }}
                  disabled={createShareLinkMutation.isPending || selectedItems.length === 0}
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
            </div>

            {/* 오른쪽: 미리보기 */}
            <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-900">
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Eye className="h-4 w-4" />
                  안내사항 미리보기
                </div>
                <Badge variant="secondary">{selectedMatchResults.length}개 항목</Badge>
              </div>
              
              <div className="p-4 max-h-[700px] overflow-y-auto">
                {selectedMatchResults.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>왼쪽에서 포함할 항목을 선택하세요</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedMatchResults.map((item, idx) => (
                      <div key={item.itemNumber} className="pb-6 border-b last:border-0">
                        {/* 항목 제목 */}
                        <h3 className="text-base font-bold text-blue-700 dark:text-blue-400 mb-3">
                          {idx + 1}. {item.matchedTemplate?.title}
                        </h3>
                        
                        {/* 흠결사항 원문 */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 text-sm">
                          <p className="text-xs text-gray-500 mb-1">[흠결사항]</p>
                          <p className="text-gray-600 dark:text-gray-400">{item.itemContent}</p>
                        </div>
                        
                        {/* 안내 내용 */}
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {item.matchedTemplate?.content}
                        </div>
                        
                        {/* 첨부 이미지 */}
                        {item.matchedTemplate?.images && item.matchedTemplate.images.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {item.matchedTemplate.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="border rounded-lg overflow-hidden">
                                <img
                                  src={`/api/correction-guide/download?key=${encodeURIComponent(img.key)}`}
                                  alt={img.name}
                                  className="w-full h-auto max-h-48 object-contain bg-gray-50"
                                  loading="lazy"
                                />
                                <p className="px-2 py-1 text-xs text-gray-500 bg-gray-50">{img.name}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* 첨부 파일 */}
                        {item.matchedTemplate?.files && item.matchedTemplate.files.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.matchedTemplate.files.map((file, fileIdx) => (
                              <a
                                key={fileIdx}
                                href={`/api/correction-guide/download?key=${encodeURIComponent(file.key)}`}
                                download={file.name}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                              >
                                <File className="h-3 w-3" />
                                {file.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 공유 링크 생성 다이얼로그 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공유 링크 생성</DialogTitle>
            <DialogDescription>
              고객에게 안내사항을 공유할 수 있는 링크를 생성합니다.
              인증 없이 접근 가능하며, 선택된 항목만 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              ✓ 선택된 {selectedItems.length}개 항목이 공유됩니다<br />
              ✓ 이미지와 첨부파일도 함께 확인할 수 있습니다<br />
              ✓ 링크는 영구적으로 유효합니다
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={async () => {
                if (selectedAnalysisId) {
                  await createShareLinkMutation.mutateAsync({ analysisId: selectedAnalysisId });
                }
              }}
              disabled={createShareLinkMutation.isPending}
            >
              {createShareLinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              링크 생성 및 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
