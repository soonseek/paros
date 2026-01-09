import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Upload, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/utils/api";
import { FILE_VALIDATION } from "~/lib/file-validation";
import { ProgressBar } from "~/components/atoms/ProgressBar";
import { useRealtimeProgress } from "~/hooks/use-realtime-progress";
import { FilePreviewModal } from "~/components/file-preview-modal";
import { FileDeleteButton } from "~/components/file-delete-button";

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

  // Story 3.5: Get analysis result query for completion summary
  const getAnalysisResultQuery = api.file.getAnalysisResult.useQuery(
    { documentId: analyzingDocumentId ?? "" },
    {
      enabled: false, // Only fetch when explicitly called
      refetchOnWindowFocus: false,
    }
  );

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
                const { document, analysisResult } = result.data;

                // Extract column names from columnMapping
                const columns = Object.keys(analysisResult.columnMapping ?? {});

                const newCompletionData = {
                  fileName: document.fileName,
                  totalTransactions: analysisResult.totalRows,
                  columns,
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
              return `파일 "${rejection.file.name}"이(가) 50MB 제한을 초과했습니다 (${(rejection.file.size / 1024 / 1024).toFixed(2)}MB)`;
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
      // Story 3.6: Extract data after analysis completes
      for (const documentId of uploadedDocumentIds) {
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

          await analyzeFileMutation.mutateAsync({ documentId });

          // Story 3.6: After analysis completes, extract data and save to DB
          // Note: Progress tracking is handled by useRealtimeProgress hook
          await extractDataMutation.mutateAsync({ documentId });

          // Story 3.7: Update document status to completed
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.id === documentId
                ? { ...doc, analysisStatus: "completed" }
                : doc
            )
          );
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
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // LOW-2 fix: Keyboard navigation
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <Card className="p-6">
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        aria-label="파일 업로드 영역 - 드래그앤드롭 또는 클릭하여 파일 선택"
      >
        <input {...getInputProps()} ref={fileInputRef} />
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">파일 처리 중...</p>
          </>
        ) : (
          <>
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">파일을 놓아주세요...</p>
            ) : (
              <>
                <p className="text-gray-600 mb-2">
                  파일을 드래그앤드롭하거나 클릭하여 선택하세요
                </p>
                <p className="text-sm text-gray-500">
                  지원 형식: 엑셀(.xlsx, .xls), CSV, PDF (최대 50MB)
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* Error Messages */}
      {fileErrors.length > 0 && (
        <div className="mt-4 space-y-2">
          {fileErrors.map((error, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md"
            >
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Story 3.5: Real-time Progress Display */}
      {(analyzingDocumentId || completionData || failedDocumentId) && (
        <div className="mt-4">
          <ProgressBar
            progress={progress}
            stage={stage}
            error={progressError}
            completionData={completionData ?? undefined}
            onRetry={failedDocumentId ? handleRetry : undefined}
          />
        </div>
      )}

      {/* Story 3.7: Uploaded Documents List with Preview/Delete Buttons */}
      {uploadedDocuments.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-medium text-gray-900">
            업로드된 파일 ({uploadedDocuments.length}개):
          </h3>
          {uploadedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-md"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-gray-500">
                  업로드: {doc.uploadedAt.toLocaleString("ko-KR")} | 상태:{" "}
                  {doc.analysisStatus}
                </p>
              </div>
              <div className="flex gap-2 ml-2">
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
          ))}
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-medium text-gray-900">
            선택된 파일 ({selectedFiles.length}개):
          </h3>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                disabled={isProcessing}
                className="ml-2 text-gray-500 hover:text-red-600"
                aria-label={`파일 제거: ${file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
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
    </>
  );
}
