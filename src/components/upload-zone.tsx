import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Upload, X, AlertCircle, FileText, FileSpreadsheet, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/utils/api";
import { FILE_VALIDATION } from "~/lib/file-validation";
import { ProgressBar } from "~/components/atoms/ProgressBar";
import { useRealtimeProgress } from "~/hooks/use-realtime-progress";
import { FilePreviewModal } from "~/components/file-preview-modal";
import { FileDeleteButton } from "~/components/file-delete-button";
import { TemplateMatchConfirmModal } from "~/components/template-match-confirm-modal";

interface FileUploadProps {
  caseId: string;
  onFilesSelected: (files: File[]) => void;
  onUploadSuccess?: (documentId: string) => void;
}

/**
 * Uploaded document metadata interface
 */
interface UploadedDocument {
  id: string;
  name: string;
  uploadedAt: Date;
  analysisStatus: string;
}

// Use centralized constant (MEDIUM-1 fix)
const MAX_FILE_SIZE = FILE_VALIDATION.MAX_FILE_SIZE_BYTES;

/**
 * Helper function to convert File to Base64 string
 *
 * @param file - File object to convert
 * @returns Promise resolving to Base64 string (without data URL prefix)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract Base64 content (remove data:application/vnd.ms-excel;base64, prefix)
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to convert file to Base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FileUploadZone({ caseId, onFilesSelected, onUploadSuccess }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Story 3.5: Track analysis progress state
  const [analyzingDocumentId, setAnalyzingDocumentId] = useState<string | null>(null);

  // Story 3.5: Track failed document for retry (AC4)
  const [failedDocumentId, setFailedDocumentId] = useState<string | null>(null);

  // Story 3.5: Track completion data for summary display
  const [completionData, setCompletionData] = useState<{
    fileName: string;
    totalTransactions?: number;
    columns?: string[];
    llmAnalysis?: {
      transactionTypeMethod: string;
      memoInAmountColumn?: boolean;
      reasoning: string;
      confidence: number;
      columnMapping: Record<string, string | undefined>;
    };
  } | null>(null);

  // Story 3.7: Track uploaded documents for preview/delete
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [previewDocument, setPreviewDocument] = useState<UploadedDocument | null>(null);

  // Story 3.5: Load completion data from localStorage on mount (AC5)
  useEffect(() => {
    const storageKey = `completion_${caseId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved) as {
          completionData: {
            fileName: string;
            totalTransactions?: number;
            columns?: string[];
          };
          timestamp: number;
        };
        // Only restore if saved within last hour (AC5: Show recent results)
        const savedAt = data.timestamp ?? 0;
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (savedAt > oneHourAgo) {
          setCompletionData(data.completionData);
        } else {
          // Remove old data
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error("[LocalStorage Load Error]", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Backend upload mutation (Story 3.3)
  const uploadFileMutation = api.file.uploadFile.useMutation();

  // Story 3.4: Backend analyzeFile mutation
  const analyzeFileMutation = api.file.analyzeFile.useMutation();

  // Story 3.6: Backend extractData mutation
  const extractDataMutation = api.file.extractData.useMutation();

  // Pre-analyze file for template matching (앞 3페이지만)
  const preAnalyzeFileMutation = api.file.preAnalyzeFile.useMutation();

  // Analyze with manually selected template
  const analyzeWithTemplateMutation = api.file.analyzeWithTemplate.useMutation();

  // 템플릿 매칭 확인 모달 상태
  const [isMatchConfirmModalOpen, setIsMatchConfirmModalOpen] = useState(false);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [preAnalysisData, setPreAnalysisData] = useState<{
    fileName: string;
    totalPages: number;
    previewPages: number;
    headers: string[];
    sampleRows: string[][];
    matchResult: {
      matched: boolean;
      templateId: string | null;
      templateName: string | null;
      bankName: string | null;
      confidence: number;
      identifiers: string[];
    };
    availableTemplates: {
      id: string;
      name: string;
      bankName: string | null;
      description: string;
      identifiers: string[];
    }[];
  } | null>(null);
  const [isModalProcessing, setIsModalProcessing] = useState(false);

  // Story 3.5: Get analysis result query for completion summary
  const getAnalysisResultQuery = api.file.getAnalysisResult.useQuery(
    { documentId: analyzingDocumentId ?? "" },
    {
      enabled: false, // Only fetch when explicitly called
      refetchOnWindowFocus: false,
    }
  );

  // tRPC utils for query invalidation (Bugfix: Issue #4)
  const utils = api.useUtils();

  // Story 3.5: Real-time progress tracking
  const { progress, stage, error: progressError } = useRealtimeProgress(
    caseId,
    analyzingDocumentId ?? "",
    {
      onComplete: () => {
        // Fetch analysis result for completion summary
        void (async () => {
          if (analyzingDocumentId) {
            try {
              const result = await getAnalysisResultQuery.refetch();
              if (result.data?.success && result.data.analysisResult) {
                const { document, analysisResult, savedTransactionCount } = result.data;

                // Extract column mapping
                const columnMapping = analysisResult.columnMapping as Record<string, string | undefined> ?? {};
                const columns = Object.keys(columnMapping);

                // Extract LLM analysis metadata if available
                const llmAnalysisData = analysisResult.llmAnalysis as {
                  transactionTypeMethod?: string;
                  memoInAmountColumn?: boolean;
                  reasoning?: string;
                } | null;
                
                // Extract template match info from reasoning
                let templateMatch: { templateName: string; bankName?: string; layer: number; confidence: number } | undefined;
                if (llmAnalysisData?.reasoning) {
                  console.log("[Upload Zone] Parsing templateMatch from reasoning:", llmAnalysisData.reasoning);
                  // "템플릿 매칭 (Layer 2): 입출금거래내역 [기업은행]" 파싱
                  const templateRegex = /템플릿 매칭 \(Layer (\d+)\): ([^\[]+)(?:\[([^\]]+)\])?/;
                  const match = llmAnalysisData.reasoning.match(templateRegex);
                  if (match) {
                    templateMatch = {
                      templateName: match[2].trim(),
                      bankName: match[3] || undefined,
                      layer: parseInt(match[1]),
                      confidence: analysisResult.confidence,
                    };
                    console.log("[Upload Zone] Extracted templateMatch:", templateMatch);
                  } else {
                    console.log("[Upload Zone] No template match found in reasoning");
                  }
                }
                
                console.log("[Upload Zone] Final completionData:", {
                  fileName: document.fileName,
                  hasTemplateMatch: !!templateMatch,
                  templateMatch,
                  savedTransactionCount,
                });

                const newCompletionData = {
                  fileName: document.fileName,
                  // 실제 저장된 거래 건수 사용 (totalRows 대신)
                  totalTransactions: savedTransactionCount ?? analysisResult.totalRows,
                  columns,
                  templateMatch,
                  // Include LLM analysis result for UI display
                  llmAnalysis: llmAnalysisData ? {
                    transactionTypeMethod: llmAnalysisData.transactionTypeMethod ?? "unknown",
                    memoInAmountColumn: llmAnalysisData.memoInAmountColumn,
                    reasoning: llmAnalysisData.reasoning ?? "",
                    confidence: analysisResult.confidence,
                    columnMapping,
                  } : undefined,
                };

                setCompletionData(newCompletionData);

                // Save to localStorage for persistence (AC5)
                const storageKey = `completion_${caseId}`;
                try {
                  localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                      completionData: newCompletionData,
                      timestamp: Date.now(),
                    })
                  );
                } catch (error) {
                  console.error("[LocalStorage Save Error]", error);
                }
              }
            } catch (error) {
              console.error("[Analysis Result Fetch Error]", error);
            }
          }

          // Bugfix Issue #4: Invalidate queries to refresh transaction list
          void (async () => {
            try {
              // Invalidate transaction search query (실제 사용하는 쿼리)
              await utils.transaction.search.invalidate({ caseId });
              // Invalidate document list to refresh uploaded files
              await utils.document.list.invalidate({ caseId });
              // Invalidate file analysis status
              await utils.file.getAnalysisStatus.invalidate({ caseId });
              console.log("[Query Invalidation] All related queries invalidated after upload");
            } catch (error) {
              console.error("[Query Invalidation Error]", error);
            }
          })();

          toast.success("파일 분석이 완료되었습니다");
          // Reset analyzing document ID after completion
          setAnalyzingDocumentId(null);
        })();
      },
      onError: (error) => {
        toast.error(error);
        // Store failed document ID for retry (AC4)
        if (analyzingDocumentId) {
          setFailedDocumentId(analyzingDocumentId);
        }
        // Reset analyzing document ID on error
        setAnalyzingDocumentId(null);
        setCompletionData(null);
      },
    }
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setIsProcessing(true);

      // Handle file size rejections
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((rejection) => {
          const errors = rejection.errors.map((err) => {
            if (err.code === "file-too-large") {
              return `파일 "${rejection.file.name}"이(가) 1GB 제한을 초과했습니다 (${(rejection.file.size / 1024 / 1024).toFixed(2)}MB)`;
            }
            if (err.code === "file-invalid-type") {
              return `파일 "${rejection.file.name}"은(는) 지원하지 않는 형식입니다`;
            }
            return `파일 "${rejection.file.name}" 업로드 실패`;
          });
          setFileErrors((prev) => [...prev, ...errors]);
          errors.forEach((err) => toast.error(err));
        });
      }

      // Upload each file to S3 (Story 3.3)
      const successfullyUploadedFiles: File[] = [];
      const uploadedDocumentIds: string[] = [];

      for (const file of acceptedFiles) {
        try {
          // Convert file to Base64 for upload
          const fileBuffer = await fileToBase64(file);

          // Call backend upload (includes validation from Story 3.2)
          const result = await uploadFileMutation.mutateAsync({
            caseId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileBuffer,
            allowDuplicates: true, // Allow duplicate file uploads
          });

          if (result.success) {
            successfullyUploadedFiles.push(file);
            toast.success(`${file.name}: ${result.message}`);

            // Story 3.5: Store document ID for analysis
            if (result.document?.id) {
              uploadedDocumentIds.push(result.document.id);

              // Story 3.7: Track uploaded document for preview/delete
              const newDoc: UploadedDocument = {
                id: result.document.id,
                name: file.name,
                uploadedAt: new Date(),
                analysisStatus: "pending", // Initial status before analysis
              };
              setUploadedDocuments((prev) => [...prev, newDoc]);

              // Notify parent component of successful upload
              if (onUploadSuccess) {
                onUploadSuccess(result.document.id);
              }
            }
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "파일 업로드 실패";
          setFileErrors((prev) => [...prev, `${file.name}: ${errorMsg}`]);
          toast.error(`${file.name}: ${errorMsg}`);
        }
      }

      // Story 3.5: Start file analysis for each uploaded document
      // 새로운 흐름: 1단계 - 앞 3페이지 분석 → 매칭 확인 모달 → 2단계 - 전체 분석
      for (let idx = 0; idx < uploadedDocumentIds.length; idx++) {
        const documentId = uploadedDocumentIds[idx];
        
        try {
          setAnalyzingDocumentId(documentId);

          // Story 3.7: Update document status to analyzing
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.id === documentId
                ? { ...doc, analysisStatus: "analyzing" }
                : doc
            )
          );

          toast.info("양식 매칭 테스트 중... (앞 3페이지 분석)");

          // 1단계: 앞 3페이지만 추출하여 템플릿 매칭 테스트
          const preAnalysisResult = await preAnalyzeFileMutation.mutateAsync({ documentId });
          
          // 매칭 확인 모달 표시 (성공/실패 모두)
          setPendingDocumentId(documentId);
          setPreAnalysisData({
            fileName: preAnalysisResult.fileName,
            totalPages: preAnalysisResult.totalPdfPages,
            previewPages: preAnalysisResult.previewPages,
            headers: preAnalysisResult.headers,
            sampleRows: preAnalysisResult.sampleRows,
            matchResult: preAnalysisResult.matchResult,
            availableTemplates: preAnalysisResult.availableTemplates,
          });
          setIsMatchConfirmModalOpen(true);
          
          // 모달이 열리면 여기서 중단하고 사용자 확인 대기
          setIsProcessing(false);
          return;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "파일 처리 실패";
          setFileErrors((prev) => [...prev, `처리 실패: ${errorMsg}`]);
          toast.error(`파일 처리 실패: ${errorMsg}`);
          setAnalyzingDocumentId(null);

          // Story 3.7: Update document status to failed
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.id === documentId
                ? { ...doc, analysisStatus: "failed" }
                : doc
            )
          );
        }
      }
                : doc
            )
          );

          // Query invalidation을 여기서도 실행 (onComplete 외에 추가)
          await utils.transaction.search.invalidate({ caseId });
          await utils.document.list.invalidate({ caseId });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "파일 처리 실패";
          setFileErrors((prev) => [...prev, `처리 실패: ${errorMsg}`]);
          toast.error(`파일 처리 실패: ${errorMsg}`);
          setAnalyzingDocumentId(null);

          // Story 3.7: Update document status to failed
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.id === documentId
                ? { ...doc, analysisStatus: "failed" }
                : doc
            )
          );
        }
      }

      // Check for duplicates (MEDIUM-3 fix)
      const newFiles = successfullyUploadedFiles.filter(
        (newFile) =>
          !selectedFiles.some(
            (existingFile) =>
              existingFile.name === newFile.name && existingFile.size === newFile.size
          )
      );

      // Report duplicates
      if (newFiles.length < successfullyUploadedFiles.length) {
        const duplicateCount = successfullyUploadedFiles.length - newFiles.length;
        const dupMsg = `${duplicateCount}개의 중복 파일이 건너뛰기되었습니다`;
        setFileErrors((prev) => [...prev, dupMsg]);
        toast.info(dupMsg);
      }

      // Note: Successfully uploaded files are NOT added to selectedFiles
      // since they've been uploaded to S3 and saved in the database
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      onFilesSelected(newFiles);

      // Clear errors after 5 seconds
      setTimeout(() => {
        setFileErrors([]);
      }, 5000);

      setIsProcessing(false);
    },
    [onFilesSelected, selectedFiles, uploadFileMutation, analyzeFileMutation, extractDataMutation, caseId, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xlsx", ".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
    maxSize: MAX_FILE_SIZE, // MEDIUM-1 fix: 50MB limit
    disabled: isProcessing,
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to get file icon based on type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return FileText;
    if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') return FileSpreadsheet;
    return FileCheck;
  };

  // Story 3.7: Handle document deletion
  const handleDeleteDocument = useCallback((documentId: string) => {
    setUploadedDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    // Clear completion data if deleted document was the one showing completion
    setCompletionData(null);
  }, []);

  // Story 3.5: Handle retry button click (AC4)
  const handleRetry = useCallback(async () => {
    if (!failedDocumentId) return;

    try {
      // Reset failed state
      setFailedDocumentId(null);
      setCompletionData(null);

      // Restart analysis
      setAnalyzingDocumentId(failedDocumentId);
      await analyzeFileMutation.mutateAsync({ documentId: failedDocumentId });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "파일 분석 실패";
      toast.error(`재시도 실패: ${errorMsg}`);
    }
  }, [failedDocumentId, analyzeFileMutation]);

  // 템플릿 수동 선택 핸들러
  const handleSelectTemplate = useCallback(async (templateId: string, templateName: string) => {
    if (!pendingDocumentId) return;
    
    setIsTemplateModalOpen(false);
    setIsProcessing(true);
    
    try {
      toast.info(`템플릿 "${templateName}" 적용 중...`);
      
      // 선택된 템플릿으로 분석 진행
      await analyzeWithTemplateMutation.mutateAsync({
        documentId: pendingDocumentId,
        templateId,
      });
      
      // 데이터 추출
      await extractDataMutation.mutateAsync({ documentId: pendingDocumentId });
      
      // 완료 처리
      setUploadedDocuments((prev) =>
        prev.map((doc) =>
          doc.id === pendingDocumentId
            ? { ...doc, analysisStatus: "completed" }
            : doc
        )
      );
      
      toast.success(`템플릿 "${templateName}" 적용 완료`);
      
      // Invalidate queries
      await utils.transaction.search.invalidate({ caseId });
      await utils.document.list.invalidate({ caseId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "템플릿 적용 실패";
      toast.error(errorMsg);
      
      setUploadedDocuments((prev) =>
        prev.map((doc) =>
          doc.id === pendingDocumentId
            ? { ...doc, analysisStatus: "failed" }
            : doc
        )
      );
    } finally {
      setPendingDocumentId(null);
      setPendingFileName("");
      setPreAnalysisData(null);
      setAnalyzingDocumentId(null);
      setIsProcessing(false);
    }
  }, [pendingDocumentId, analyzeWithTemplateMutation, extractDataMutation, utils, caseId]);

  // LLM 자동 분석 (Layer 2) 핸들러
  const handleUseLLMAnalysis = useCallback(async () => {
    if (!pendingDocumentId) return;
    
    setIsTemplateModalOpen(false);
    setIsProcessing(true);
    
    try {
      toast.info("LLM 자동 분석 중...");
      
      // 기존 LLM 분석 로직 사용
      await analyzeFileMutation.mutateAsync({ 
        documentId: pendingDocumentId,
        useLlmAnalysis: true,
      });
      
      // 데이터 추출
      await extractDataMutation.mutateAsync({ documentId: pendingDocumentId });
      
      // 완료 처리
      setUploadedDocuments((prev) =>
        prev.map((doc) =>
          doc.id === pendingDocumentId
            ? { ...doc, analysisStatus: "completed" }
            : doc
        )
      );
      
      toast.success("LLM 분석 완료");
      
      // Invalidate queries
      await utils.transaction.search.invalidate({ caseId });
      await utils.document.list.invalidate({ caseId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "LLM 분석 실패";
      toast.error(errorMsg);
      
      setUploadedDocuments((prev) =>
        prev.map((doc) =>
          doc.id === pendingDocumentId
            ? { ...doc, analysisStatus: "failed" }
            : doc
        )
      );
    } finally {
      setPendingDocumentId(null);
      setPendingFileName("");
      setPreAnalysisData(null);
      setAnalyzingDocumentId(null);
      setIsProcessing(false);
    }
  }, [pendingDocumentId, analyzeFileMutation, extractDataMutation, utils, caseId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // LOW-2 fix: Keyboard navigation
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {/* 세로 스택 레이아웃 */}
          <div className="space-y-4">
            {/* 드래그앤드롭 영역 */}
            <div
              {...getRootProps()}
              role="button"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onClick={(e) => {
                // 명시적 클릭 처리 (모달 내에서 이벤트 전파 보장)
                if (!isProcessing && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-all duration-200 ease-in-out
                ${isDragActive 
                  ? "border-primary bg-primary/5 scale-[1.01]" 
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
                }
                ${isProcessing ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}
              `}
              aria-label="파일 업로드 영역"
            >
              <input {...getInputProps()} ref={fileInputRef} />
              {isProcessing ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/30 border-t-primary" />
                  <p className="text-sm font-medium text-muted-foreground">파일 처리 중...</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <div className={`rounded-full p-2 ${isDragActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Upload className={`size-5 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {isDragActive ? (
                        <span className="text-primary">파일을 놓아주세요</span>
                      ) : (
                        <>파일을 드래그하거나 <span className="text-primary underline">클릭</span></>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Excel, CSV, PDF • 최대 1GB</p>
                  </div>
                </div>
              )}
            </div>

            {/* 분석 결과 */}
            {(analyzingDocumentId || completionData || failedDocumentId) && (
              <ProgressBar
                progress={progress}
                stage={stage}
                error={progressError}
                completionData={completionData ?? undefined}
                onRetry={failedDocumentId ? handleRetry : undefined}
              />
            )}
          </div>

          {/* Error Messages */}
          {fileErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              {fileErrors.map((error, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ))}
            </div>
          )}

          {/* Story 3.7: Uploaded Documents List with Preview/Delete Buttons */}
          {uploadedDocuments.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                업로드된 파일 ({uploadedDocuments.length}개)
              </h3>
              <div className="space-y-2">
                {uploadedDocuments.map((doc) => {
                  const FileIcon = getFileIcon(doc.name);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg hover:bg-success/10 transition-colors"
                    >
                      <div className="shrink-0 p-2 rounded-md bg-success/10">
                        <FileIcon className="size-5 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.uploadedAt.toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewDocument(doc)}
                          disabled={analyzingDocumentId === doc.id}
                        >
                          미리보기
                        </Button>
                        <FileDeleteButton
                          documentId={doc.id}
                          documentName={doc.name}
                          analysisStatus={doc.analysisStatus}
                          onDeleteSuccess={() => handleDeleteDocument(doc.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                선택된 파일 ({selectedFiles.length}개)
              </h3>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => {
                  const FileIcon = getFileIcon(file.name);
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="shrink-0 p-2 rounded-md bg-background">
                        <FileIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        disabled={isProcessing}
                        className="shrink-0"
                        aria-label={`파일 제거: ${file.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Story 3.7: File Preview Modal */}
      {previewDocument && (
        <FilePreviewModal
          documentId={previewDocument.id}
          documentName={previewDocument.name}
          uploadedAt={previewDocument.uploadedAt}
          totalTransactions={0} // Will be fetched from API
          open={!!previewDocument}
          onOpenChange={(open) => !open && setPreviewDocument(null)}
        />
      )}

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onSelectTemplate={handleSelectTemplate}
        onUseLLMAnalysis={handleUseLLMAnalysis}
        pdfHeaders={preAnalysisData?.headers}
        pdfSampleRows={preAnalysisData?.sampleRows}
        fileName={pendingFileName}
      />
    </>
  );
}
