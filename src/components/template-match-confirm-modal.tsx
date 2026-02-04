/**
 * 템플릿 매칭 확인 모달
 * 
 * 업로드 후 앞 3페이지 분석 결과를 보여주고
 * 사용자가 매칭 결과를 확인/선택할 수 있게 함
 */

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { 
  FileText, 
  Building2, 
  Check, 
  X,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Search,
} from "lucide-react";

interface MatchResult {
  matched: boolean;
  templateId: string | null;
  templateName: string | null;
  bankName: string | null;
  confidence: number;
  identifiers: string[];
}

interface AvailableTemplate {
  id: string;
  name: string;
  bankName: string | null;
  description: string;
  identifiers: string[];
}

interface TemplateMatchConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  totalPages: number;
  previewPages: number;
  headers: string[];
  sampleRows: string[][];
  matchResult: MatchResult;
  availableTemplates: AvailableTemplate[];
  onConfirm: (templateId: string | null) => void; // null이면 자동 매칭 사용
  onSelectTemplate: (templateId: string) => void;
  onUseLLM: () => void;
  isProcessing?: boolean;
}

export function TemplateMatchConfirmModal({
  open,
  onOpenChange,
  fileName,
  totalPages,
  previewPages,
  headers,
  sampleRows,
  matchResult,
  availableTemplates,
  onConfirm,
  onSelectTemplate,
  onUseLLM,
  isProcessing = false,
}: TemplateMatchConfirmModalProps) {
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // 신뢰도에 따른 색상
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-100";
    if (confidence >= 50) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  // 매칭 결과가 맞다고 확인
  const handleConfirmMatch = () => {
    onConfirm(matchResult.templateId);
  };

  // 다른 템플릿 선택
  const handleSelectOther = () => {
    setShowTemplateList(true);
  };

  // 템플릿 선택 확정
  const handleConfirmSelection = () => {
    if (selectedTemplateId) {
      onSelectTemplate(selectedTemplateId);
    }
  };

  // 뒤로가기 (템플릿 목록 → 매칭 결과)
  const handleBack = () => {
    setShowTemplateList(false);
    setSelectedTemplateId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] flex flex-col" data-testid="template-match-confirm-modal">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {showTemplateList ? "템플릿 선택" : "양식 매칭 확인"}
          </DialogTitle>
          <DialogDescription>
            {showTemplateList 
              ? "적용할 템플릿을 선택하세요"
              : `파일의 앞 ${previewPages}페이지를 분석하여 템플릿 매칭을 수행했습니다. 결과를 확인해주세요.`
            }
          </DialogDescription>
        </DialogHeader>

        {!showTemplateList ? (
          /* 매칭 결과 화면 */
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* 왼쪽: 매칭 결과 */}
            <div className="w-1/2 flex flex-col gap-4">
              {/* 파일 정보 */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">업로드 파일</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[250px]" title={fileName}>
                      {fileName}
                    </span>
                    <Badge variant="outline">
                      총 {totalPages}페이지
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    앞 {previewPages}페이지로 매칭 테스트 수행
                  </p>
                </CardContent>
              </Card>

              {/* 매칭 결과 */}
              <Card className={matchResult.matched ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {matchResult.matched ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    매칭 결과
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  {matchResult.matched ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">템플릿</span>
                        <span className="font-medium">{matchResult.templateName}</span>
                      </div>
                      {matchResult.bankName && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">은행/카드사</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {matchResult.bankName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">신뢰도</span>
                        <Badge className={getConfidenceColor(matchResult.confidence)}>
                          {matchResult.confidence}%
                        </Badge>
                      </div>
                      {matchResult.identifiers.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">매칭된 식별자</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {matchResult.identifiers.slice(0, 5).map((id, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {id}
                              </Badge>
                            ))}
                            {matchResult.identifiers.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{matchResult.identifiers.length - 5}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                      <p className="font-medium">자동 매칭 실패</p>
                      <p className="text-sm text-muted-foreground">
                        등록된 템플릿 중 일치하는 양식을 찾지 못했습니다
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 감지된 헤더 */}
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-3 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">감지된 컬럼 헤더 ({headers.length}개)</CardTitle>
                </CardHeader>
                <CardContent className="py-2 flex-1 overflow-auto">
                  <div className="flex flex-wrap gap-1">
                    {headers.map((header, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        [{idx}] {header}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 오른쪽: 샘플 데이터 */}
            <div className="w-1/2 flex flex-col overflow-hidden border-l pl-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                샘플 데이터 (최대 10행)
              </div>
              <Card className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        {headers.slice(0, 6).map((header, idx) => (
                          <TableHead key={idx} className="min-w-[100px] text-xs">
                            {header}
                          </TableHead>
                        ))}
                        {headers.length > 6 && (
                          <TableHead className="text-xs text-muted-foreground">
                            +{headers.length - 6}열
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sampleRows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          <TableCell className="text-xs text-muted-foreground">
                            {rowIdx + 1}
                          </TableCell>
                          {row.slice(0, 6).map((cell, cellIdx) => (
                            <TableCell key={cellIdx} className="text-xs max-w-[150px] truncate">
                              {cell || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          ))}
                          {row.length > 6 && (
                            <TableCell className="text-xs text-muted-foreground">...</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </div>
          </div>
        ) : (
          /* 템플릿 선택 화면 */
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="grid grid-cols-2 gap-3">
                {availableTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="truncate">{template.name}</span>
                        {selectedTemplateId === template.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </CardTitle>
                      {template.bankName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {template.bankName}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 flex items-center justify-between sm:justify-between border-t pt-4">
          {!showTemplateList ? (
            /* 매칭 결과 화면 버튼 */
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={onUseLLM}
                  disabled={isProcessing}
                >
                  <Search className="h-4 w-4 mr-2" />
                  LLM 자동 분석
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSelectOther}
                  disabled={isProcessing}
                >
                  다른 템플릿 선택
                </Button>
                {matchResult.matched && (
                  <Button
                    onClick={handleConfirmMatch}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    맞음, 진행
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* 템플릿 선택 화면 버튼 */
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isProcessing}
              >
                ← 뒤로
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={onUseLLM}
                  disabled={isProcessing}
                >
                  <Search className="h-4 w-4 mr-2" />
                  LLM 자동 분석
                </Button>
                <Button
                  onClick={handleConfirmSelection}
                  disabled={!selectedTemplateId || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  선택한 템플릿으로 진행
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
