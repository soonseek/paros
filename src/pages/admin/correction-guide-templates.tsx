import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  ChevronLeft,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Upload,
  X,
  Download,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { AppHeader } from "~/components/app-header";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";
import type { FileInfo } from "~/types/correction-guide";

interface TemplateFormData {
  title: string;
  content: string;
  images: FileInfo[];
  files: FileInfo[];
  specialNotes: string;
  priority: number;
  isActive: boolean;
}

const defaultFormData: TemplateFormData = {
  title: "",
  content: "",
  images: [],
  files: [],
  specialNotes: "",
  priority: 0,
  isActive: true,
};

// 파일 크기 포맷팅
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const CorrectionGuideTemplatesPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const utils = api.useUtils();

  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [showInactive, setShowInactive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth check - ADMIN과 SUPER 역할만 접근 허용
  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "SUPER") {
      void router.push("/cases");
    }
  }, [user, router]);

  // 템플릿 목록 조회
  const { data: templates, isLoading } = api.correctionGuide.getTemplates.useQuery(
    { includeInactive: showInactive },
    { enabled: mounted && !!user }
  );

  // 파일 업로드 mutation
  const uploadFileMutation = api.correctionGuide.uploadFile.useMutation();

  // 파일 삭제 mutation
  const deleteFileMutation = api.correctionGuide.deleteFile.useMutation();

  // 생성 mutation
  const createMutation = api.correctionGuide.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 생성되었습니다");
      setIsModalOpen(false);
      setFormData(defaultFormData);
      void utils.correctionGuide.getTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "템플릿 생성에 실패했습니다");
    },
  });

  // 수정 mutation
  const updateMutation = api.correctionGuide.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 수정되었습니다");
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      void utils.correctionGuide.getTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "템플릿 수정에 실패했습니다");
    },
  });

  // 삭제 mutation
  const deleteMutation = api.correctionGuide.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 삭제되었습니다");
      void utils.correctionGuide.getTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "템플릿 삭제에 실패했습니다");
    },
  });

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (
    files: FileList | null,
    isImage: boolean
  ) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedFiles: FileInfo[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // 파일 크기 검증 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: 파일 크기는 10MB를 초과할 수 없습니다`);
          continue;
        }

        // Base64로 변환
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // data:image/png;base64, 부분 제거
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 업로드
        const result = await uploadFileMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          fileType: file.type,
          fileSize: file.size,
          isImage,
        });

        uploadedFiles.push(result);
        toast.success(`${file.name} 업로드 완료`);
      }

      // 폼 데이터 업데이트
      if (uploadedFiles.length > 0) {
        setFormData((prev) => ({
          ...prev,
          [isImage ? "images" : "files"]: [
            ...(isImage ? prev.images : prev.files),
            ...uploadedFiles,
          ],
        }));
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("파일 업로드 중 오류가 발생했습니다");
    } finally {
      setIsUploading(false);
    }
  }, [uploadFileMutation]);

  // 파일 삭제 핸들러 (폼에서만 제거, 실제 삭제는 저장 시 또는 취소 시)
  const handleRemoveFile = useCallback((fileKey: string, isImage: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [isImage ? "images" : "files"]: isImage
        ? prev.images.filter((f) => f.key !== fileKey)
        : prev.files.filter((f) => f.key !== fileKey),
    }));
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template: NonNullable<typeof templates>[0]) => {
    setEditingId(template.id);
    setFormData({
      title: template.title,
      content: template.content,
      images: (template.images as unknown as FileInfo[]) ?? [],
      files: (template.files as unknown as FileInfo[]) ?? [],
      specialNotes: template.specialNotes ?? "",
      priority: template.priority,
      isActive: template.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        title: formData.title.trim(),
        content: formData.content.trim(),
        images: formData.images,
        files: formData.files,
        specialNotes: formData.specialNotes.trim() || null,
        priority: formData.priority,
        isActive: formData.isActive,
      });
    } else {
      createMutation.mutate({
        title: formData.title.trim(),
        content: formData.content.trim(),
        images: formData.images,
        files: formData.files,
        specialNotes: formData.specialNotes.trim() || undefined,
        priority: formData.priority,
      });
    }
  };

  // 모달 닫기 시 업로드된 파일 정리 (저장하지 않은 경우)
  const handleCloseModal = useCallback(async () => {
    // 새 생성 모드에서 파일이 업로드되었다면 삭제
    if (!editingId) {
      for (const img of formData.images) {
        try {
          await deleteFileMutation.mutateAsync({ fileKey: img.key });
        } catch (e) {
          console.error("Failed to cleanup image:", e);
        }
      }
      for (const file of formData.files) {
        try {
          await deleteFileMutation.mutateAsync({ fileKey: file.key });
        } catch (e) {
          console.error("Failed to cleanup file:", e);
        }
      }
    }
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
  }, [editingId, formData, deleteFileMutation]);

  if (!mounted || (user && user.role !== "ADMIN" && user.role !== "SUPER")) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader showBack backHref="/cases" />
      
      <div className="px-4 py-6 max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                돌아가기
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold dark:text-gray-100">
              보정권고 안내사항 템플릿 관리
            </h1>
            <p className="text-muted-foreground mt-1">
              보정권고/명령서 분석 시 고객에게 제공할 안내사항 템플릿을 관리합니다
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked === true)}
              />
              <Label htmlFor="show-inactive" className="text-sm">
                비활성 포함
              </Label>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              새 템플릿
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {templates?.length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">전체 템플릿</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {templates?.filter((t) => t.isActive).length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">활성 템플릿</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">
                {templates?.filter((t) => !t.isActive).length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">비활성 템플릿</div>
            </CardContent>
          </Card>
        </div>

        {/* 템플릿 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              템플릿 목록
            </CardTitle>
            <CardDescription>
              보정권고 항목과 매칭되는 안내사항 템플릿입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="space-y-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`${!template.isActive ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">
                              {template.title}
                            </h3>
                            {!template.isActive && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                비활성
                              </span>
                            )}
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              우선순위: {template.priority}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {template.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {((template.images as unknown as FileInfo[])?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                이미지 {(template.images as unknown as FileInfo[]).length}개
                              </span>
                            )}
                            {((template.files as unknown as FileInfo[])?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                파일 {(template.files as unknown as FileInfo[]).length}개
                              </span>
                            )}
                            {template.specialNotes && (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                특이사항 있음
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  &quot;{template.title}&quot; 템플릿을 삭제하시겠습니까?
                                  <br />이 작업은 되돌릴 수 없으며, 첨부된 파일도 함께 삭제됩니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ id: template.id })}
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">등록된 템플릿이 없습니다</p>
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  첫 템플릿 만들기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 생성/수정 모달 */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "템플릿 수정" : "새 템플릿 생성"}
            </DialogTitle>
            <DialogDescription>
              보정권고 안내사항 템플릿의 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 제목 */}
            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="예: 소득 증빙 서류 제출 안내"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            {/* 내용 */}
            <div className="space-y-2">
              <Label htmlFor="content">
                내용 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                AI가 보정권고 항목과 매칭할 때 참고하는 내용입니다
              </p>
              <Textarea
                id="content"
                placeholder="이 안내사항이 적용되는 상황과 고객에게 안내할 내용을 상세히 작성하세요..."
                rows={5}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
              />
            </div>

            {/* 이미지 첨부 */}
            <div className="space-y-2">
              <Label>이미지 첨부</Label>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, GIF, WebP 형식 (최대 10MB)
              </p>
              
              {/* 이미지 목록 */}
              {formData.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {formData.images.map((img) => (
                    <div
                      key={img.key}
                      className="relative group bg-gray-100 dark:bg-gray-800 rounded-lg p-2"
                    >
                      <img
                        src={`/api/correction-guide/download?key=${encodeURIComponent(img.key)}`}
                        alt={img.name}
                        className="w-full h-24 object-cover rounded"
                      />
                      <p className="text-xs truncate mt-1">{img.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(img.size)}</p>
                      <button
                        onClick={() => handleRemoveFile(img.key, true)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 업로드 영역 */}
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => imageInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      클릭하여 이미지 선택
                    </p>
                  </>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, true)}
              />
            </div>

            {/* 파일 첨부 */}
            <div className="space-y-2">
              <Label>파일 첨부</Label>
              <p className="text-xs text-muted-foreground">
                PDF, 문서 파일 등 (최대 10MB)
              </p>

              {/* 파일 목록 */}
              {formData.files.length > 0 && (
                <div className="space-y-2 mb-2">
                  {formData.files.map((file) => (
                    <div
                      key={file.key}
                      className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-lg p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/correction-guide/download?key=${encodeURIComponent(file.key)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleRemoveFile(file.key, false)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 업로드 영역 */}
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      클릭하여 파일 선택
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, false)}
              />
            </div>

            {/* 특이사항 */}
            <div className="space-y-2">
              <Label htmlFor="specialNotes">특이사항 (AI 지침)</Label>
              <p className="text-xs text-muted-foreground">
                AI가 이 템플릿을 활용할 때 참고해야 할 추가 지침
              </p>
              <Textarea
                id="specialNotes"
                placeholder="예: 이 안내사항은 채무자가 급여소득자인 경우에만 적용됩니다..."
                rows={3}
                value={formData.specialNotes}
                onChange={(e) =>
                  setFormData({ ...formData, specialNotes: e.target.value })
                }
              />
            </div>

            {/* 우선순위 */}
            <div className="space-y-2">
              <Label htmlFor="priority">우선순위</Label>
              <p className="text-xs text-muted-foreground">
                높을수록 먼저 매칭됩니다 (기본값: 0)
              </p>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            {/* 활성화 (수정 시에만) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked === true })
                  }
                />
                <Label htmlFor="isActive">활성화</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal} disabled={isUploading}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || isUploading}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : editingId ? (
                "수정"
              ) : (
                "생성"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CorrectionGuideTemplatesPage;
