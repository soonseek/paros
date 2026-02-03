/**
 * Template Selection Modal
 * 
 * Layer 1 매칭 실패 시 사용자가 수동으로 템플릿을 선택할 수 있는 모달
 * - 모든 활성 템플릿 목록 표시
 * - 각 템플릿의 PDF 미리보기 지원
 * - "Layer 2 (LLM 자동 판단)" 버튼으로 자동 분석 진행
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { 
  FileText, 
  Building2, 
  Sparkles, 
  Check, 
  ChevronRight,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import { api } from "~/utils/api";

interface TemplateSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: string, templateName: string) => void;
  onUseLLMAnalysis: () => void;
  // PDF 미리보기용 데이터
  pdfHeaders?: string[];
  pdfSampleRows?: string[][];
  fileName?: string;
}

interface Template {
  id: string;
  name: string;
  bankName: string | null;
  description: string;
  identifiers: string[];
  isActive: boolean;
  priority: number;
  matchCount: number;
  columnSchema: {
    columns: Record<string, { header: string; index: number }>;
  };
}

export function TemplateSelectionModal({
  open,
  onOpenChange,
  onSelectTemplate,
  onUseLLMAnalysis,
  pdfHeaders = [],
  pdfSampleRows = [],
  fileName = "",
}: TemplateSelectionModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  // 템플릿 목록 조회
  const { data: templates, isLoading } = api.template.list.useQuery(
    { includeInactive: false },
    { enabled: open }
  );

  // 선택 초기화
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId(null);
      setPreviewTemplateId(null);
    }
  }, [open]);

  const handleConfirmSelection = () => {
    if (selectedTemplateId) {
      const template = templates?.find(t => t.id === selectedTemplateId);
      if (template) {
        onSelectTemplate(selectedTemplateId, template.name);
      }
    }
  };

  const handleLLMAnalysis = () => {
    onUseLLMAnalysis();
    onOpenChange(false);
  };

  // 컬럼 매핑 헤더명 목록 추출
  const getColumnHeaders = (template: Template): string[] => {
    const columns = template.columnSchema?.columns || {};
    return Object.values(columns)
      .filter((col): col is { header: string; index: number } => 
        col !== undefined && typeof col === 'object' && 'header' in col
      )
      .map(col => col.header);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col" data-testid="template-selection-modal">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            템플릿 선택
          </DialogTitle>
          <DialogDescription>
            자동 매칭에 실패했습니다. 아래 목록에서 적합한 템플릿을 선택하거나 LLM 자동 분석을 사용하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 왼쪽: 템플릿 목록 */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              템플릿 목록 ({templates?.length ?? 0}개)
            </div>
            <ScrollArea className="flex-1 pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-2">
                  {(templates as Template[]).map((template) => (
                    <Card
                      key={template.id}
                      data-testid={`template-item-${template.id}`}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border"
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              {template.name}
                              {selectedTemplateId === template.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </CardTitle>
                            {template.bankName && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                {template.bankName}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {template.matchCount}회 사용
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplateId(
                                  previewTemplateId === template.id ? null : template.id
                                );
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                        {/* 식별자 배지 */}
                        {template.identifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.identifiers.slice(0, 3).map((id, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
                                {id}
                              </Badge>
                            ))}
                            {template.identifiers.length > 3 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                +{template.identifiers.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        {/* 컬럼 매핑 미리보기 */}
                        {previewTemplateId === template.id && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="text-xs font-medium mb-1">컬럼 매핑:</div>
                            <div className="flex flex-wrap gap-1">
                              {getColumnHeaders(template).map((header, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                  {header}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">등록된 템플릿이 없습니다</p>
                  <p className="text-xs">관리자 페이지에서 템플릿을 추가하세요</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 오른쪽: PDF 미리보기 */}
          <div className="w-1/2 flex flex-col overflow-hidden border-l pl-4">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              업로드된 파일 미리보기
              {fileName && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {fileName}
                </Badge>
              )}
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="p-3 pb-2 flex-shrink-0">
                <CardTitle className="text-sm">감지된 헤더 ({pdfHeaders.length}개)</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex-1 overflow-hidden flex flex-col">
                {pdfHeaders.length > 0 ? (
                  <>
                    {/* 헤더 */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {pdfHeaders.map((header, idx) => (
                        <Badge key={idx} className="text-xs">
                          [{idx}] {header}
                        </Badge>
                      ))}
                    </div>

                    <Separator className="my-2" />

                    {/* 샘플 데이터 */}
                    <div className="text-xs font-medium mb-2">
                      샘플 데이터 ({pdfSampleRows.length}행)
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="space-y-1">
                        {pdfSampleRows.slice(0, 10).map((row, rowIdx) => (
                          <div
                            key={rowIdx}
                            className="text-xs bg-muted/30 rounded p-1.5 font-mono overflow-x-auto whitespace-nowrap"
                          >
                            {row.map((cell, cellIdx) => (
                              <span key={cellIdx} className="inline-block">
                                {cellIdx > 0 && <span className="text-muted-foreground mx-1">|</span>}
                                {cell || <span className="text-muted-foreground">(빈값)</span>}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">파일 미리보기 데이터가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex-shrink-0 flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="template-modal-cancel"
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleLLMAnalysis}
              data-testid="template-modal-llm-btn"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Layer 2 (LLM 자동 판단)
            </Button>

            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedTemplateId}
              data-testid="template-modal-confirm"
            >
              선택한 템플릿 적용
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
