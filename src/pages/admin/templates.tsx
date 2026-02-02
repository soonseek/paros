/**
 * Transaction Template Management Page
 * 
 * 거래내역서 템플릿 관리 - 에디터 환경
 */

import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Play,
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  Info,
  ImagePlus,
  Sparkles,
} from "lucide-react";

// 컬럼 타입 옵션
const COLUMN_TYPES = [
  { value: "date", label: "거래일자" },
  { value: "deposit", label: "입금액" },
  { value: "withdrawal", label: "출금액" },
  { value: "balance", label: "잔액" },
  { value: "memo", label: "비고" },
  { value: "transactionType", label: "거래구분" },
  { value: "amount", label: "거래금액 (단일)" },
];

// 역할 옵션 (입금/출금 시)
const ROLE_OPTIONS = [
  { value: "amount", label: "금액" },
  { value: "memo", label: "비고" },
  { value: "skip", label: "무시" },
];

interface ColumnDefinition {
  index: number;
  header: string;
  whenDeposit?: "amount" | "memo" | "skip";
  whenWithdrawal?: "amount" | "memo" | "skip";
}

interface ColumnSchema {
  columns: Record<string, ColumnDefinition>;
  parseRules?: {
    isDeposit?: string;
    memoExtraction?: string;
  };
}

interface TemplateFormData {
  name: string;
  bankName: string;
  description: string;
  identifiers: string[];
  columnSchema: ColumnSchema;
  priority: number;
  isActive: boolean;
}

const emptyColumnSchema: ColumnSchema = {
  columns: {},
  parseRules: {},
};

const emptyFormData: TemplateFormData = {
  name: "",
  bankName: "",
  description: "",
  identifiers: [],
  columnSchema: emptyColumnSchema,
  priority: 0,
  isActive: true,
};

const TemplatesPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  // State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyFormData);
  const [identifiersInput, setIdentifiersInput] = useState("");
  const [testFileName, setTestFileName] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]); // AI 분석으로 추출된 헤더

  // API
  const templatesQuery = api.template.list.useQuery({ includeInactive: true });
  const statsQuery = api.template.getStats.useQuery();
  const createMutation = api.template.create.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 생성되었습니다");
      setIsEditorOpen(false);
      resetForm();
      void templatesQuery.refetch();
      void statsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = api.template.update.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 수정되었습니다");
      setIsEditorOpen(false);
      resetForm();
      void templatesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = api.template.delete.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 삭제되었습니다");
      void templatesQuery.refetch();
      void statsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const duplicateMutation = api.template.duplicate.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 복제되었습니다");
      void templatesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const testMatchMutation = api.template.testMatchWithFile.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: (error) => toast.error(error.message),
  });
  const analyzeFileMutation = api.template.analyzeFile.useMutation({
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        name: data.suggestedName || prev.name,
        bankName: data.suggestedBankName || prev.bankName,
        description: data.suggestedDescription || prev.description,
        columnSchema: data.suggestedColumnSchema || prev.columnSchema,
      }));
      setIdentifiersInput((data.suggestedIdentifiers || []).join(", "));
      setDetectedHeaders(data.detectedHeaders || []); // 분석된 헤더 저장
      toast.success(`AI 분석 완료! (신뢰도: ${Math.round((data.confidence || 0) * 100)}%)`);
    },
    onError: (error) => toast.error(error.message),
  });

  // Auth check
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      void router.push("/cases");
    }
  }, [user, router]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const resetForm = () => {
    setFormData(emptyFormData);
    setIdentifiersInput("");
    setEditingId(null);
    setDetectedHeaders([]); // 분석된 헤더 초기화
  };

  // 중복 헤더 검사
  const getDuplicateHeaders = (): string[] => {
    const headers = Object.values(formData.columnSchema.columns).map(col => col.header);
    const duplicates = headers.filter((header, index) => 
      header && headers.indexOf(header) !== index
    );
    return [...new Set(duplicates)]; // 중복 제거
  };

  const hasDuplicateHeaders = getDuplicateHeaders().length > 0;

  const openCreateEditor = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const openEditEditor = (template: any) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      bankName: template.bankName || "",
      description: template.description,
      identifiers: template.identifiers || [],
      columnSchema: template.columnSchema || emptyColumnSchema,
      priority: template.priority,
      isActive: template.isActive,
    });
    setIdentifiersInput((template.identifiers || []).join(", "));
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    // identifiers 파싱
    const identifiers = identifiersInput
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const data = {
      ...formData,
      identifiers,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleDuplicate = (id: string, name: string) => {
    const newName = prompt("새 템플릿 이름을 입력하세요:", `${name}_복사본`);
    if (newName) {
      duplicateMutation.mutate({ id, newName });
    }
  };

  const handleTestFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // PDF 파일 검증
    if (file.type !== "application/pdf") {
      toast.error("PDF 파일만 업로드할 수 있습니다");
      return;
    }

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("파일 크기는 50MB 이하여야 합니다");
      return;
    }

    setTestFileName(file.name);
    setTestResult(null);

    // FileReader로 Base64 변환
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) {
        testMatchMutation.mutate({
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type,
        });
      }
    };
    reader.onerror = () => {
      toast.error("파일을 읽는 중 오류가 발생했습니다");
    };
    reader.readAsDataURL(file);

    // input 초기화
    event.target.value = "";
  };

  const handleTemplateFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이미지 또는 PDF 파일 검증
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    
    if (!isImage && !isPdf) {
      toast.error("이미지 또는 PDF 파일만 업로드할 수 있습니다");
      return;
    }

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("파일 크기는 50MB 이하여야 합니다");
      return;
    }

    // FileReader로 Base64 변환
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) {
        analyzeFileMutation.mutate({
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type,
        });
      }
    };
    reader.onerror = () => {
      toast.error("파일을 읽는 중 오류가 발생했습니다");
    };
    reader.readAsDataURL(file);

    // input 초기화
    event.target.value = "";
  };

  const updateColumnSchema = (columnType: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      columnSchema: {
        ...prev.columnSchema,
        columns: {
          ...prev.columnSchema.columns,
          [columnType]: {
            ...prev.columnSchema.columns[columnType],
            [field]: value,
          },
        },
      },
    }));
  };

  const removeColumn = (columnType: string) => {
    setFormData(prev => {
      const { [columnType]: _, ...rest } = prev.columnSchema.columns;
      return {
        ...prev,
        columnSchema: {
          ...prev.columnSchema,
          columns: rest,
        },
      };
    });
  };

  const addColumn = (columnType: string) => {
    setFormData(prev => ({
      ...prev,
      columnSchema: {
        ...prev.columnSchema,
        columns: {
          ...prev.columnSchema.columns,
          [columnType]: { index: 0, header: "" },
        },
      },
    }));
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로
            </Button>
            <div>
              <h1 className="text-2xl font-bold">거래내역서 템플릿 관리</h1>
              <p className="text-sm text-muted-foreground">
                은행별 거래내역서 형식을 정의하고 관리합니다
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsTestDialogOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              매칭 테스트
            </Button>
            <Button onClick={openCreateEditor}>
              <Plus className="h-4 w-4 mr-2" />
              새 템플릿
            </Button>
          </div>
        </div>

        {/* Stats */}
        {statsQuery.data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{statsQuery.data.totalTemplates}</div>
                <div className="text-sm text-muted-foreground">전체 템플릿</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{statsQuery.data.activeTemplates}</div>
                <div className="text-sm text-muted-foreground">활성 템플릿</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{statsQuery.data.totalMatches}</div>
                <div className="text-sm text-muted-foreground">총 매칭 횟수</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Template List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              템플릿 목록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : templatesQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                등록된 템플릿이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>은행</TableHead>
                    <TableHead>식별자</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>매칭 횟수</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templatesQuery.data?.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.bankName || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.identifiers.slice(0, 3).map((id, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {id}
                            </Badge>
                          ))}
                          {template.identifiers.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.identifiers.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{template.priority}</TableCell>
                      <TableCell>{template.matchCount}</TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditEditor(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(template.id, template.name)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(template.id, template.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Editor Dialog */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="w-[50vw] !max-w-[50vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "템플릿 수정" : "새 템플릿 생성"}
              </DialogTitle>
              <DialogDescription>
                거래내역서의 특징과 컬럼 구조를 정의합니다
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* AI 파일 분석 */}
              {!editingId && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                        <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div>
                        <h3 className="font-medium text-purple-800 dark:text-purple-200">AI 자동 분석</h3>
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          거래내역서 PDF 또는 스크린샷을 업로드하면 자동으로 템플릿 초안을 생성합니다
                        </p>
                      </div>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        onChange={handleTemplateFileUpload}
                        className="hidden"
                        id="template-file-upload"
                        disabled={analyzeFileMutation.isPending}
                      />
                      <Button
                        asChild
                        variant="outline"
                        className="bg-white dark:bg-gray-800 cursor-pointer"
                        disabled={analyzeFileMutation.isPending}
                      >
                        <label htmlFor="template-file-upload" className="cursor-pointer">
                          {analyzeFileMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              분석 중...
                            </>
                          ) : (
                            <>
                              <ImagePlus className="h-4 w-4 mr-2" />
                              파일 업로드
                            </>
                          )}
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>템플릿 이름 *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: 부산은행_일반계좌"
                    disabled={analyzeFileMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>은행명</Label>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="예: 부산은행"
                    disabled={analyzeFileMutation.isPending}
                  />
                </div>
              </div>

              {/* 설명 */}
              <div className="space-y-2">
                <Label>템플릿 설명 (특징) *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="이 템플릿이 적용되는 거래내역서의 특징을 상세히 기술하세요. LLM이 유사도 매칭에 사용합니다."
                  rows={4}
                  disabled={analyzeFileMutation.isPending}
                />
              </div>

              {/* 식별자 */}
              <div className="space-y-2">
                <Label>식별자 (키워드)</Label>
                <Input
                  value={identifiersInput}
                  onChange={(e) => setIdentifiersInput(e.target.value)}
                  placeholder="쉼표로 구분. 예: 국민은행, 거래내역, 입출금"
                  disabled={analyzeFileMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  문서 상단의 은행명, 타이틀 등 페이지 텍스트에서 이 키워드들이 모두 포함되면 자동 매칭됩니다 (Layer 1)
                </p>
              </div>

              {/* 우선순위 & 활성화 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>우선순위</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    disabled={analyzeFileMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">높을수록 먼저 매칭 시도</p>
                </div>
                <div className="space-y-2">
                  <Label>활성화</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                      disabled={analyzeFileMutation.isPending}
                    />
                    <label htmlFor="isActive" className="text-sm cursor-pointer">
                      {formData.isActive ? "활성" : "비활성"}
                    </label>
                  </div>
                </div>
              </div>

              {/* 컬럼 스키마 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">컬럼 매핑</Label>
                  <Select onValueChange={addColumn} disabled={analyzeFileMutation.isPending}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="컬럼 추가" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_TYPES.filter(t => !formData.columnSchema.columns[t.value]).map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg">
                  {Object.keys(formData.columnSchema.columns).length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      컬럼을 추가하세요
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>컬럼 타입</TableHead>
                          <TableHead>인덱스</TableHead>
                          <TableHead>헤더명</TableHead>
                          <TableHead>입금 시</TableHead>
                          <TableHead>출금 시</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(formData.columnSchema.columns).map(([type, col]) => (
                          <TableRow key={type}>
                            <TableCell className="font-medium">
                              {COLUMN_TYPES.find(t => t.value === type)?.label || type}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-20"
                                value={col.index}
                                onChange={(e) => updateColumnSchema(type, "index", parseInt(e.target.value) || 0)}
                                disabled={analyzeFileMutation.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              {detectedHeaders.length > 0 ? (
                                <Select
                                  value={col.header}
                                  onValueChange={(v) => updateColumnSchema(type, "header", v)}
                                  disabled={analyzeFileMutation.isPending}
                                >
                                  <SelectTrigger className={`w-48 ${
                                    getDuplicateHeaders().includes(col.header) ? 'border-red-500 bg-red-50' : ''
                                  }`}>
                                    <SelectValue placeholder="헤더 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {detectedHeaders.map((header, idx) => (
                                      <SelectItem key={idx} value={header}>
                                        [{idx}] {header}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  className={`w-48 ${
                                    getDuplicateHeaders().includes(col.header) ? 'border-red-500 bg-red-50' : ''
                                  }`}
                                  value={col.header}
                                  onChange={(e) => updateColumnSchema(type, "header", e.target.value)}
                                  placeholder="컬럼 헤더명"
                                  disabled={analyzeFileMutation.isPending}
                                />
                              )}
                              {getDuplicateHeaders().includes(col.header) && (
                                <p className="text-xs text-red-500 mt-1">중복된 헤더</p>
                              )}
                            </TableCell>
                            <TableCell>
                              {(type === "deposit" || type === "withdrawal") && (
                                <Select
                                  value={col.whenDeposit || "amount"}
                                  onValueChange={(v) => updateColumnSchema(type, "whenDeposit", v)}
                                  disabled={analyzeFileMutation.isPending}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLE_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {(type === "deposit" || type === "withdrawal") && (
                                <Select
                                  value={col.whenWithdrawal || "amount"}
                                  onValueChange={(v) => updateColumnSchema(type, "whenWithdrawal", v)}
                                  disabled={analyzeFileMutation.isPending}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLE_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeColumn(type)}
                                disabled={analyzeFileMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* 특수 케이스 설명 */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">입금/출금에 따른 역할 변경</p>
                      <p className="text-muted-foreground mt-1">
                        부산은행 등 일부 은행에서는 입금 거래 시 출금 컬럼에 비고가, 
                        출금 거래 시 입금 컬럼에 비고가 들어갑니다. 
                        이 경우 "입금 시"/"출금 시" 역할을 다르게 설정하세요.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              {hasDuplicateHeaders && (
                <p className="text-sm text-red-500 mr-auto">
                  중복된 헤더가 있습니다. 수정 후 저장해주세요.
                </p>
              )}
              <Button 
                variant="outline" 
                onClick={() => setIsEditorOpen(false)}
                disabled={analyzeFileMutation.isPending}
              >
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  createMutation.isPending || 
                  updateMutation.isPending || 
                  analyzeFileMutation.isPending ||
                  hasDuplicateHeaders
                }
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Dialog */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="w-[50vw] !max-w-[50vw]">
            <DialogHeader>
              <DialogTitle>템플릿 매칭 테스트</DialogTitle>
              <DialogDescription>
                거래내역서 PDF 파일을 업로드하여 문서 상단의 은행명, 타이틀 등을 기준으로 어떤 템플릿과 매칭되는지 테스트합니다
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* PDF 업로드 */}
              <div className="space-y-2">
                <Label>거래내역서 PDF 파일</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleTestFileUpload}
                    className="hidden"
                    id="test-pdf-upload"
                    disabled={testMatchMutation.isPending}
                  />
                  <Button
                    asChild
                    variant="outline"
                    disabled={testMatchMutation.isPending}
                  >
                    <label htmlFor="test-pdf-upload" className="cursor-pointer">
                      {testMatchMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          PDF 업로드
                        </>
                      )}
                    </label>
                  </Button>
                  {testFileName && (
                    <span className="text-sm text-muted-foreground">{testFileName}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  첫 3페이지를 OCR로 파싱하여 페이지 텍스트(은행명, 타이틀 등)를 기준으로 템플릿 매칭을 테스트합니다
                </p>
              </div>

              {/* 결과 */}
              {testResult && (
                <Card className={testResult.matched ? "border-green-200 bg-green-50" : testResult.error ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
                  <CardContent className="pt-4">
                    {testResult.error ? (
                      <div>
                        <p className="font-medium text-red-700">오류 발생</p>
                        <p className="text-sm text-red-600">{testResult.error}</p>
                      </div>
                    ) : testResult.matched ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">Layer {testResult.layer}</Badge>
                          <span className="font-medium">{testResult.templateName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          매칭 방식: {testResult.layerName === "exact_match" ? "정확 매칭 (키워드)" : "유사도 매칭 (LLM)"}
                        </p>
                        <p className="text-sm">신뢰도: {Math.round(testResult.confidence * 100)}%</p>
                        
                        {/* 추출된 헤더 */}
                        {testResult.headers && testResult.headers.length > 0 && (
                          <div className="text-sm">
                            <p className="font-medium">추출된 헤더:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {testResult.headers.map((h: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{h}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 컬럼 매핑 */}
                        <div className="text-xs">
                          <p className="font-medium">컬럼 매핑:</p>
                          <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-32">
                            {JSON.stringify(testResult.columnMapping, null, 2)}
                          </pre>
                        </div>

                        {/* 샘플 데이터 */}
                        {testResult.sampleRows && testResult.sampleRows.length > 0 && (
                          <div className="text-xs">
                            <p className="font-medium">샘플 데이터 ({testResult.sampleRows.length}행):</p>
                            <div className="bg-white p-2 rounded mt-1 overflow-auto max-h-32">
                              {testResult.sampleRows.map((row: string[], i: number) => (
                                <div key={i} className="text-xs text-muted-foreground truncate">
                                  {row.join(" | ")}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium text-amber-700">매칭 실패</p>
                          <p className="text-sm text-muted-foreground">{testResult.message}</p>
                        </div>
                        
                        {/* 추출된 헤더 (매칭 실패 시에도 표시) */}
                        {testResult.headers && testResult.headers.length > 0 && (
                          <div className="text-sm">
                            <p className="font-medium">추출된 헤더:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {testResult.headers.map((h: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{h}</Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              이 헤더를 기준으로 새 템플릿을 생성하세요
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsTestDialogOpen(false);
                setTestResult(null);
                setTestFileName("");
              }}>
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TemplatesPage;
