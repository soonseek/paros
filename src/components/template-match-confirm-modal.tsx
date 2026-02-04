/**
 * 템플릿 매칭 확인 모달
 * 
 * 업로드 후 앞 3페이지 분석 결과를 보여주고
 * 사용자가 매칭 결과를 확인/선택할 수 있게 함
 * 
 * - 왼쪽: 매칭 결과 또는 템플릿 선택 목록 (검색 필터 포함)
 * - 오른쪽: 파싱된 샘플 데이터 또는 템플릿 미리보기
 */

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { api } from "~/utils/api";
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
  FileSpreadsheet,
  Eye,
  Columns,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";

interface ColumnSchema {
  columns: Record<string, { index: number; header: string }>;
}

interface MatchResult {
  matched: boolean;
  templateId: string | null;
  templateName: string | null;
  bankName: string | null;
  confidence: number;
  identifiers: string[];
  columnSchema?: ColumnSchema | null;
  description?: string;
  sampleFileKey?: string | null;
  sampleFileName?: string | null;
  sampleFileMimeType?: string | null;
}

interface AvailableTemplate {
  id: string;
  name: string;
  bankName: string | null;
  description: string;
  identifiers: string[];
  columnSchema: ColumnSchema | null;
  sampleFileKey?: string | null;
  sampleFileName?: string | null;
  sampleFileMimeType?: string | null;
}

interface ParsedSampleRow {
  transactionDate: string;
  deposit: number;
  withdrawal: number;
  balance: number;
  memo: string;
}

interface TemplateMatchConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  totalPages: number;
  previewPages: number;
  headers: string[];
  sampleRows: string[][];
  parsedSampleData: ParsedSampleRow[];
  matchResult: MatchResult;
  availableTemplates: AvailableTemplate[];
  onConfirm: (templateId: string | null) => void;
  onSelectTemplate: (templateId: string) => void;
  onUseLLM: () => void;
  isProcessing?: boolean;
}

// 컬럼 역할 한글명
const COLUMN_ROLE_LABELS: Record<string, string> = {
  date: "거래일자",
  deposit: "입금",
  withdrawal: "출금",
  balance: "잔액",
  memo: "비고",
  ignore: "무시",
  transactionType: "구분",
  amount: "금액",
  description: "적요",
  counterparty: "거래상대",
  accountNumber: "계좌번호",
  transactionTime: "거래시간",
};

export function TemplateMatchConfirmModal({
  open,
  onOpenChange,
  fileName,
  totalPages,
  previewPages,
  headers,
  sampleRows,
  parsedSampleData: initialParsedData,
  matchResult,
  availableTemplates,
  onConfirm,
  onSelectTemplate,
  onUseLLM,
  isProcessing = false,
}: TemplateMatchConfirmModalProps) {
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  
  // 재파싱된 샘플 데이터 상태
  const [reparsedData, setReparsedData] = useState<ParsedSampleRow[] | null>(null);
  const [isReparsing, setIsReparsing] = useState(false);

  // 현재 표시할 파싱된 데이터 (재파싱 결과 또는 초기 데이터)
  const parsedSampleData = reparsedData || initialParsedData;

  // 재파싱 API
  const reparseMutation = api.file.reParseWithTemplate.useMutation({
    onSuccess: (data) => {
      setReparsedData(data.parsedSampleData);
      setIsReparsing(false);
    },
    onError: (error) => {
      console.error("ReParse error:", error);
      setIsReparsing(false);
    },
  });

  // 결과 파싱 재시도 핸들러
  const handleReParse = () => {
    if (!selectedTemplateId) return;
    setIsReparsing(true);
    reparseMutation.mutate({
      templateId: selectedTemplateId,
      headers,
      sampleRows,
    });
  };

  // 검색 필터링된 템플릿 목록
  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return availableTemplates;
    
    const term = searchTerm.toLowerCase();
    return availableTemplates.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.bankName?.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term) ||
      t.identifiers.some(id => id.toLowerCase().includes(term))
    );
  }, [availableTemplates, searchTerm]);

  // 선택된 템플릿 정보
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return availableTemplates.find(t => t.id === selectedTemplateId);
  }, [selectedTemplateId, availableTemplates]);

  // 미리보기 템플릿 정보
  const previewTemplate = useMemo(() => {
    if (!previewTemplateId) return null;
    return availableTemplates.find(t => t.id === previewTemplateId);
  }, [previewTemplateId, availableTemplates]);

  // 모달 열릴 때 재파싱 데이터 초기화
  React.useEffect(() => {
    if (!open) {
      setReparsedData(null);
      setSelectedTemplateId(null);
    }
  }, [open]);

  // 신뢰도에 따른 색상
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-100";
    if (confidence >= 50) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    if (!amount || amount === 0) return '';
    return amount.toLocaleString('ko-KR');
  };

  // 템플릿의 컬럼 매핑 정보 추출
  const getColumnMappings = (schema: ColumnSchema | null) => {
    if (!schema?.columns) return [];
    
    return Object.entries(schema.columns)
      .filter(([_, col]) => col && typeof col === 'object')
      .map(([role, col]) => ({
        role,
        roleLabel: COLUMN_ROLE_LABELS[role] || role,
        header: col.header,
        index: col.index,
      }))
      .sort((a, b) => a.index - b.index);
  };

  // 매칭 결과가 맞다고 확인
  const handleConfirmMatch = () => {
    onConfirm(matchResult.templateId);
  };

  // 다른 템플릿 선택
  const handleSelectOther = () => {
    setShowTemplateList(true);
    setSearchTerm("");
    setPreviewTemplateId(null);
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
    setSearchTerm("");
    setPreviewTemplateId(null);
  };

  // 파싱된 데이터가 있으면 사용, 없으면 OCR 원본 표시
  const hasParsedData = parsedSampleData && parsedSampleData.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[98vw] w-[1600px] h-[95vh] flex flex-col p-0 gap-0" 
        data-testid="template-match-confirm-modal"
      >
        {/* 헤더 */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {showTemplateList ? "템플릿 선택" : "양식 매칭 확인"}
          </DialogTitle>
          <DialogDescription>
            {showTemplateList 
              ? "적용할 템플릿을 선택하세요. 템플릿을 클릭하면 컬럼 매핑을 미리 볼 수 있습니다."
              : `파일의 앞 ${previewPages}페이지를 분석하여 템플릿 매칭을 수행했습니다. 결과를 확인해주세요.`
            }
          </DialogDescription>
        </DialogHeader>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽 패널: 매칭 결과 또는 템플릿 선택 */}
          <div className="w-[40%] flex flex-col border-r overflow-hidden">
            {!showTemplateList ? (
              /* 매칭 결과 화면 */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 파일 정보 */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">업로드 파일</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[300px]" title={fileName}>
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
                        <p className="text-sm text-muted-foreground mb-4">
                          등록된 템플릿 중 일치하는 양식을 찾지 못했습니다
                        </p>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSelectOther}
                          disabled={isProcessing}
                          className="w-full"
                        >
                          <ChevronRight className="h-4 w-4 mr-2" />
                          템플릿 선택하기
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 감지된 헤더 */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">감지된 컬럼 헤더 ({headers.length}개)</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                      {headers.map((header, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          [{idx}] {header}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 템플릿 선택 화면 */
              <div className="flex flex-col h-full overflow-hidden">
                {/* 검색 필터 */}
                <div className="flex-shrink-0 p-4 border-b bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="템플릿명, 은행명, 식별자로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>총 {availableTemplates.length}개 중 {filteredTemplates.length}개 표시</span>
                    {selectedTemplateId && (
                      <Badge variant="default" className="text-xs">
                        선택됨: {selectedTemplate?.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 템플릿 목록 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>검색 결과가 없습니다</p>
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all hover:border-primary/50 ${
                          selectedTemplateId === template.id
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : previewTemplateId === template.id
                            ? "border-blue-300 bg-blue-50/50"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setPreviewTemplateId(template.id);
                        }}
                      >
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span className="truncate flex items-center gap-2">
                              {template.name}
                              {template.bankName && (
                                <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {template.bankName}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {previewTemplateId === template.id && (
                                <Eye className="h-4 w-4 text-blue-500" />
                              )}
                              {selectedTemplateId === template.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 px-3">
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {template.description}
                          </p>
                          {template.identifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
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
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽 패널 */}
          <div className="w-[60%] flex flex-col overflow-hidden bg-muted/30">
            {showTemplateList && previewTemplate ? (
              /* 템플릿 선택 화면: 템플릿 정보 + 재파싱된 샘플 데이터 미리보기 */
              <div className="flex flex-col h-full overflow-hidden">
                {/* 상단: 템플릿 컬럼 매핑 정보 */}
                <div className="flex-shrink-0 border-b">
                  <div className="px-4 py-3 bg-background border-b">
                    <div className="flex items-center gap-2">
                      <Columns className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">템플릿 미리보기: {previewTemplate.name}</span>
                      {previewTemplate.bankName && (
                        <Badge variant="outline" className="text-xs">
                          {previewTemplate.bankName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/20 max-h-[200px] overflow-auto">
                    {previewTemplate.columnSchema ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">인덱스</TableHead>
                            <TableHead>헤더명</TableHead>
                            <TableHead className="w-[100px]">역할</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getColumnMappings(previewTemplate.columnSchema).map((col, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">[{col.index}]</TableCell>
                              <TableCell className="text-sm">{col.header}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {col.roleLabel}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        컬럼 매핑 정보가 없습니다
                      </p>
                    )}
                  </div>
                </div>

                {/* 하단: 재파싱된 샘플 데이터 또는 안내 */}
                <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {reparsedData ? "재파싱된 샘플 데이터" : "샘플 데이터 미리보기"}
                      </span>
                      {reparsedData && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          {selectedTemplate?.name} 적용됨
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {reparsedData ? `${reparsedData.length}건` : `${sampleRows.length}행`}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  {reparsedData && reparsedData.length > 0 ? (
                    /* 재파싱된 데이터 테이블 */
                    <div className="bg-background rounded-lg border overflow-hidden" data-testid="reparsed-data-table">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-green-50">
                              <TableHead className="w-[50px] text-center font-bold">#</TableHead>
                              <TableHead className="w-[120px] font-bold">거래일자</TableHead>
                              <TableHead className="w-[130px] text-right font-bold text-blue-600">입금</TableHead>
                              <TableHead className="w-[130px] text-right font-bold text-red-600">출금</TableHead>
                              <TableHead className="w-[140px] text-right font-bold">잔액</TableHead>
                              <TableHead className="font-bold">비고</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reparsedData.map((row, idx) => (
                              <TableRow key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {row.transactionDate || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-blue-600">
                                  {formatAmount(row.deposit)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-red-600">
                                  {formatAmount(row.withdrawal)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatAmount(row.balance)}
                                </TableCell>
                                <TableCell className="text-sm max-w-[300px] truncate" title={row.memo}>
                                  {row.memo || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    /* 안내 메시지 */
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <RefreshCw className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground mb-2">
                        템플릿을 선택하고 <strong>&apos;결과 파싱 재시도&apos;</strong> 버튼을 눌러
                      </p>
                      <p className="text-muted-foreground">
                        해당 템플릿으로 파싱된 결과를 미리 확인할 수 있습니다.
                      </p>
                      {isReparsing && (
                        <div className="flex items-center gap-2 mt-4 text-primary">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>재파싱 중...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 매칭 결과 화면: 상단에 템플릿 컬럼 매핑, 하단에 샘플 데이터 */
              <div className="flex flex-col h-full overflow-hidden">
                {/* 매칭된 템플릿의 컬럼 매핑 정보 (매칭 성공 시만 표시) */}
                {matchResult.matched && matchResult.columnSchema && (
                  <div className="flex-shrink-0 border-b">
                    <div className="px-4 py-3 bg-background border-b">
                      <div className="flex items-center gap-2">
                        <Columns className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">매칭된 템플릿 컬럼 매핑</span>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          {matchResult.templateName}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50/30 max-h-[200px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">인덱스</TableHead>
                            <TableHead>헤더명</TableHead>
                            <TableHead className="w-[100px]">역할</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getColumnMappings(matchResult.columnSchema).map((col, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">[{col.index}]</TableCell>
                              <TableCell className="text-sm">{col.header}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {col.roleLabel}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* 샘플 데이터 미리보기 */}
                <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {hasParsedData ? "파싱된 거래 데이터 미리보기" : "원본 데이터 미리보기"}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {hasParsedData ? `${parsedSampleData.length}건` : `${sampleRows.length}행`}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  {hasParsedData ? (
                    /* 파싱된 데이터: 일자, 입금, 출금, 잔액, 비고 */
                    <div className="bg-background rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[50px] text-center font-bold">#</TableHead>
                              <TableHead className="w-[120px] font-bold">거래일자</TableHead>
                              <TableHead className="w-[130px] text-right font-bold text-blue-600">입금</TableHead>
                              <TableHead className="w-[130px] text-right font-bold text-red-600">출금</TableHead>
                              <TableHead className="w-[140px] text-right font-bold">잔액</TableHead>
                              <TableHead className="font-bold">비고</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedSampleData.map((row, idx) => (
                              <TableRow key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {row.transactionDate || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-blue-600">
                                  {formatAmount(row.deposit)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-red-600">
                                  {formatAmount(row.withdrawal)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatAmount(row.balance)}
                                </TableCell>
                                <TableCell className="text-sm max-w-[300px] truncate" title={row.memo}>
                                  {row.memo || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    /* 원본 OCR 데이터 */
                    <div className="bg-background rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[50px] text-center font-bold">#</TableHead>
                              {headers.map((header, idx) => (
                                <TableHead key={idx} className="min-w-[100px] text-xs font-medium whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">[{idx}]</span>
                                    <span>{header}</span>
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sampleRows.map((row, rowIdx) => (
                              <TableRow key={rowIdx} className={rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                  {rowIdx + 1}
                                </TableCell>
                                {row.map((cell, cellIdx) => (
                                  <TableCell key={cellIdx} className="text-xs whitespace-nowrap">
                                    {cell || <span className="text-muted-foreground italic">-</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <DialogFooter className="flex-shrink-0 flex items-center justify-between sm:justify-between border-t px-6 py-4">
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
                disabled={isProcessing || isReparsing}
              >
                ← 뒤로
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={onUseLLM}
                  disabled={isProcessing || isReparsing}
                >
                  <Search className="h-4 w-4 mr-2" />
                  LLM 자동 분석
                </Button>
                {/* 결과 파싱 재시도 버튼 */}
                <Button
                  variant="outline"
                  onClick={handleReParse}
                  disabled={!selectedTemplateId || isProcessing || isReparsing}
                  data-testid="reparse-button"
                >
                  {isReparsing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  결과 파싱 재시도
                </Button>
                <Button
                  onClick={handleConfirmSelection}
                  disabled={!selectedTemplateId || isProcessing || isReparsing}
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

// 샘플 파일 미리보기 컴포넌트
function SampleFilePreview({ templateId }: { templateId: string }) {
  const { data, isLoading, error } = api.template.getSampleFile.useQuery(
    { templateId },
    { enabled: !!templateId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            양식 샘플 파일
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            양식 샘플 파일
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            샘플 파일을 불러올 수 없습니다
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPdf = data.mimeType === "application/pdf";
  const dataUrl = `data:${data.mimeType};base64,${data.base64}`;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          양식 샘플 파일
          <Badge variant="outline" className="text-xs">
            {data.fileName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="border rounded-lg overflow-hidden bg-white">
          {isPdf ? (
            <iframe
              src={dataUrl}
              className="w-full h-[400px]"
              title="PDF Preview"
            />
          ) : (
            <img
              src={dataUrl}
              alt="Template Sample"
              className="w-full h-auto max-h-[400px] object-contain"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
