import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { Upload, Loader2, Download } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { FindingList } from "~/components/molecules/finding-list";
import { SimplifiedTransactionTable, type SimplifiedTransaction } from "~/components/simplified-transaction-table";
import { AIChatAssistant } from "~/components/ai-chat-assistant";
import { LoanTrackingModal } from "~/components/loan-tracking-modal";
import { AmountFilterModal } from "~/components/amount-filter-modal";
import { FindingNoteList } from "~/components/molecules/finding-note-list";
import { FindingNoteForm } from "~/components/molecules/finding-note-form";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FileUploadZone } from "~/components/upload-zone";
import { ExportOptionsModal } from "~/components/export/export-options-modal";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";
import { useI18n } from "~/lib/i18n/index";

/**
 * Case Detail Page
 *
 * Displays detailed information about a specific case.
 * 간소화된 UI - 핵심 기능만 유지
 */

// Story 6.3: FindingNoteSection 컴포넌트 (메모 섹션)
const FindingNoteSection: React.FC<{ findingId: string }> = ({ findingId }) => {
  // 메모 목록 조회 (AC6)
  const { data: notes, isLoading } = api.findings.getNotesForFinding.useQuery(
    { findingId },
    {
      enabled: !!findingId,
    }
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">메모</h3>

      {/* Story 6.3: 메모 입력 폼 (AC1) */}
      <FindingNoteForm findingId={findingId} />

      {/* Story 6.3: 메모 목록 (AC6) */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <FindingNoteList findingId={findingId} notes={notes ?? []} />
      )}
    </div>
  );
};

// Story 6.2: Finding 타입 정의
interface Finding {
  id: string;
  findingType: string;
  title: string;
  description: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  priority: "HIGH" | "MEDIUM" | "LOW" | null; // Story 6.5: 사용자 지정 중요도
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  transaction: {
    id: string;
    transactionDate: Date;
    depositAmount: string | null;
    withdrawalAmount: string | null;
    memo: string | null;
  } | null;
  relatedTransactionIds: string[];
  relatedCreditorNames: string | null;
}

// Case status badge colors (reused from Story 2.2)
const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  PENDING: "대기",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  SUSPENDED: "정지",
  CLOSED: "종료",
};

const getStatusLabel = (status: string) => statusLabels[status] ?? status;

const CaseDetailPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;
  const { t, formatDate, formatCurrency } = useI18n();

  // tRPC utils for optimistic updates
  const utils = api.useUtils();

  // Handle SSR hydration
  const [mounted, setMounted] = useState(false);
  
  // 퀵 버튼 모달 상태
  const [isLoanTrackingOpen, setIsLoanTrackingOpen] = useState(false);
  const [isAmountFilterOpen, setIsAmountFilterOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch case details
  const { data: caseItem, isPending, error, refetch } = api.case.getCaseById.useQuery(
    { id: id as string },
    {
      enabled: !!id, // Only fetch when id is available
    }
  );

  // Story 6.2: Fetch findings for this case
  const { data: findings } = api.findings.getFindingsForCase.useQuery(
    { caseId: id as string, includeResolved: false },
    {
      enabled: !!id,
    }
  );

  // Fetch documents for this case (for file filtering)
  const { data: documents } = api.file.getDocumentsForCase.useQuery(
    { caseId: id as string },
    {
      enabled: !!id,
    }
  );

  // State for selected document
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Fetch transactions for selected document
  const { data: transactionsData, isLoading: transactionsLoading } = api.transaction.search.useQuery(
    {
      caseId: id as string,
      ...(selectedDocumentId && { documentId: selectedDocumentId }),
    },
    {
      enabled: !!id,
    }
  );

  // Memoize transactions for AI Chat Assistant (performance optimization)
  const memoizedTransactions = useMemo(() => {
    // 문서 ID → 문서명 매핑
    const docNameMap = new Map<string, string>();
    documents?.forEach(doc => {
      docNameMap.set(doc.id, doc.originalFileName);
    });

    return (transactionsData?.transactions ?? []).map(tx => ({
      ...tx,
      depositAmount: tx.depositAmount ? String(tx.depositAmount) : null,
      withdrawalAmount: tx.withdrawalAmount ? String(tx.withdrawalAmount) : null,
      balance: tx.balance ? String(tx.balance) : null,
      documentName: (tx as { documentId?: string }).documentId 
        ? docNameMap.get((tx as { documentId?: string }).documentId!) ?? null 
        : null,
    }));
  }, [transactionsData?.transactions, documents]);

  // 거래내역 정규화 (SimplifiedTransactionTable용)
  const simplifiedTransactions = useMemo((): SimplifiedTransaction[] => {
    // 문서 ID → 문서명 매핑 생성
    const docNameMap = new Map<string, string>();
    documents?.forEach(doc => {
      docNameMap.set(doc.id, doc.originalFileName);
    });

    return (transactionsData?.transactions ?? []).map(tx => {
      const depositAmount = tx.depositAmount ? Number(tx.depositAmount) : 0;
      const withdrawalAmount = tx.withdrawalAmount ? Number(tx.withdrawalAmount) : 0;
      const isDeposit = depositAmount > 0;
      
      // documentId로 문서명 찾기
      const documentName = (tx as { documentId?: string }).documentId 
        ? docNameMap.get((tx as { documentId?: string }).documentId!) 
        : undefined;
      
      return {
        id: tx.id,
        transactionDate: new Date(tx.transactionDate).toISOString().split('T')[0] ?? '',
        type: isDeposit ? '입금' as const : '출금' as const,
        amount: isDeposit ? depositAmount : -withdrawalAmount,
        balance: tx.balance ? Number(tx.balance) : 0,
        memo: tx.memo ?? '',
        documentName,
      };
    });
  }, [transactionsData?.transactions, documents]);

  // Delete transactions mutation (파일별 삭제용 - 거래내역 + 파일 함께 삭제)
  const deleteTransactionsMutation = api.transaction.deleteByDocument.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "삭제되었습니다");
      // 거래내역 목록 갱신
      void utils.transaction.search.invalidate({
        caseId: id as string,
      });
      // 문서 목록 갱신
      void utils.document.list.invalidate({
        caseId: id as string,
      });
    },
    onError: (err) => {
      toast.error(err.message || "삭제에 실패했습니다");
    },
  });

  // Story 7.1: Excel 내보내기 mutation
  const exportMutation = api.export.exportFullAnalysisResult.useMutation({
    onSuccess: () => {
      toast.success("엑셀 파일이 다운로드되었습니다");
    },
    onError: (err) => {
      toast.error(err.message || "내보내기에 실패했습니다");
    },
  });

  // Story 7.2: 선택된 거래 내보내기 mutation
  const exportSelectedMutation = api.export.exportSelectedTransactions.useMutation({
    onSuccess: (data) => {
      // AC4: 다운로드 피드백 메시지
      const transactionCount = data.base64 ? 1 : 0; // 기본 구현 (향후 개선 여지)
      toast.success(`선택한 거래가 엑셀 파일로 다운로드되었습니다 (${transactionCount}개)`);
    },
    onError: (err) => {
      toast.error(err.message || "선택된 거래 내보내기에 실패했습니다");
    },
  });

  // Story 7.2: 필터링된 거래 내보내기 mutation
  const exportFilteredMutation = api.export.exportFilteredTransactions.useMutation({
    onSuccess: () => {
      // AC4: 다운로드 피드백 메시지
      toast.success("필터링된 거래가 엑셀 파일로 다운로드되었습니다");
    },
    onError: (err) => {
      toast.error(err.message || "필터링된 거래 내보내기에 실패했습니다");
    },
  });

  // Story 7.3: 발견사항 내보내기 mutation
  const exportFindingsMutation = api.export.exportFindings.useMutation({
    onSuccess: () => {
      // AC4: 다운로드 피드백 메시지
      toast.success("발견사항 목록이 엑셀 파일로 다운로드되었습니다");
    },
    onError: (err) => {
      toast.error(err.message || "발견사항 내보내기에 실패했습니다");
    },
  });

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Story 6.2: Finding 클릭 상태 (관련 거래 하이라이트, 상세 모달)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isFindingDetailModalOpen, setIsFindingDetailModalOpen] = useState(false);

  // Story 6.2: FindingCard 클릭 핸들러
  const handleFindingClick = (finding: Finding) => {
    setSelectedFinding(finding);
    setIsFindingDetailModalOpen(true);
  };

  // Story 6.2: Finding 상세 모달 닫기
  const closeFindingDetailModal = () => {
    setIsFindingDetailModalOpen(false);
    // 모달이 닫힐 때 하이라이트도 제거 (선택 사항)
    // setSelectedFinding(null);
  };

  // Story 7.1/7.2/7.3: Excel 내보내기 핸들러
  const handleExport = async (
    option: string,
    transactionIds?: string[],
    selectedColumns?: string[],
    findingFilters?: {
      isResolved?: boolean;
      severity?: "CRITICAL" | "WARNING" | "INFO";
      priority?: "HIGH" | "MEDIUM" | "LOW";
      sortBy?: "priority-severity-date" | "severity-date" | "date";
    }
  ) => {
    let result;

    // Story 7.2/7.3: 옵션별로 다른 mutation 호출
    switch (option) {
      case "selected":
        result = await exportSelectedMutation.mutateAsync({
          caseId: id as string,
          transactionIds: transactionIds!,
          selectedColumns,
        });
        break;
      case "filtered":
        // TODO: Story 8.2에서 필터 상태 관리 구현 후 전달
        result = await exportFilteredMutation.mutateAsync({
          caseId: id as string,
          filters: {
            // 빈 필터로 전체 내보내기 (임시)
          },
          selectedColumns,
        });
        break;
      case "findings":
        // Story 7.3: 발견사항 내보내기
        result = await exportFindingsMutation.mutateAsync({
          caseId: id as string,
          filters: findingFilters,
          sortBy: findingFilters?.sortBy ?? "priority-severity-date",
        });
        break;
      case "full":
      default:
        result = await exportMutation.mutateAsync({
          caseId: id as string,
          option: option as "full" | "transactions" | "findings" | "fundFlow",
        });
        break;
    }

    // 다운로드 트리거 (Story 7.1/7.2 Task 5.2)
    if (result) {
      const { triggerDownload } = await import("~/lib/export/excel-export-helper");
      triggerDownload(result);
    }
  };

  // Fetch notes for this case
  const { data: notes } = api.caseNote.getCaseNotes.useQuery(
    { caseId: id as string },
    {
      enabled: !!id,
    }
  );

  // Create note mutation
  const createNoteMutation = api.caseNote.createCaseNote.useMutation({
    onMutate: async (newNote) => {
      // Cancel outgoing refetches
      await utils.caseNote.getCaseNotes.cancel({ caseId: newNote.caseId });

      // Snapshot previous value
      const previousNotes = utils.caseNote.getCaseNotes.getData({ caseId: newNote.caseId });

      // Optimistically update to the new value
      utils.caseNote.getCaseNotes.setData(
        { caseId: newNote.caseId },
        (old) => [
          ...(old ?? []),
          {
            id: `temp-${Date.now()}`,
            content: newNote.content,
            caseId: newNote.caseId,
            authorId: user?.id ?? "",
            createdAt: new Date(),
            updatedAt: new Date(),
            author: {
              id: user?.id ?? "",
              name: user?.name ?? null,
              email: user?.email ?? "",
            },
          },
        ]
      );

      // Return context with previous value
      return { previousNotes, caseId: newNote.caseId };
    },
    onError: (err, newNote, context) => {
      // Rollback to previous value
      if (context?.previousNotes) {
        utils.caseNote.getCaseNotes.setData({ caseId: context.caseId }, context.previousNotes);
      }
      toast.error(err.message || "메모 추가에 실패했습니다");
    },
    onSettled: (data, error, variables) => {
      // Refetch to ensure consistency
      void utils.caseNote.getCaseNotes.invalidate({ caseId: variables.caseId });
    },
    onSuccess: () => {
      toast.success("메모가 추가되었습니다");
      setNewNoteContent("");
    },
  });

  // Update note mutation
  const updateNoteMutation = api.caseNote.updateCaseNote.useMutation({
    onMutate: async (updatedNote) => {
      // Cancel outgoing refetches
      await utils.caseNote.getCaseNotes.cancel({ caseId: id as string });

      // Snapshot previous value
      const previousNotes = utils.caseNote.getCaseNotes.getData({ caseId: id as string });

      // Optimistically update the note
      utils.caseNote.getCaseNotes.setData(
        { caseId: id as string },
        (old) =>
          old?.map((note) =>
            note.id === updatedNote.id
              ? { ...note, content: updatedNote.content, updatedAt: new Date() }
              : note
          ) ?? []
      );

      // Return context with previous value
      return { previousNotes };
    },
    onError: (err, variables, context) => {
      // Rollback to previous value
      if (context?.previousNotes) {
        utils.caseNote.getCaseNotes.setData({ caseId: id as string }, context.previousNotes);
      }
      toast.error(err.message || "메모 수정에 실패했습니다");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.caseNote.getCaseNotes.invalidate({ caseId: id as string });
    },
    onSuccess: () => {
      toast.success("메모가 수정되었습니다");
      setEditingNoteId(null);
      setEditingNoteContent("");
    },
  });

  // Delete note mutation
  const deleteNoteMutation = api.caseNote.deleteCaseNote.useMutation({
    onMutate: async (deletedNote) => {
      // Cancel outgoing refetches
      await utils.caseNote.getCaseNotes.cancel({ caseId: id as string });

      // Snapshot previous value
      const previousNotes = utils.caseNote.getCaseNotes.getData({ caseId: id as string });

      // Optimistically remove the note
      utils.caseNote.getCaseNotes.setData(
        { caseId: id as string },
        (old) => old?.filter((note) => note.id !== deletedNote.id) ?? []
      );

      // Return context with previous value
      return { previousNotes };
    },
    onError: (err, variables, context) => {
      // Rollback to previous value
      if (context?.previousNotes) {
        utils.caseNote.getCaseNotes.setData({ caseId: id as string }, context.previousNotes);
      }
      toast.error(err.message || "메모 삭제에 실패했습니다");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.caseNote.getCaseNotes.invalidate({ caseId: id as string });
    },
    onSuccess: () => {
      toast.success("메모가 삭제되었습니다");
    },
  });

  // Redirect to login if not authenticated (client-side only)
  useEffect(() => {
    if (mounted && !user) {
      void router.push("/login");
    }
  }, [mounted, user, router]);

  // Handle errors and redirect immediately (prevents unnecessary rendering, client-side only)
  useEffect(() => {
    if (mounted && error) {
      const errorCode = error.data?.code;

      if (errorCode === "NOT_FOUND") {
        toast.error("사건을 찾을 수 없습니다");
        void router.push("/cases");
      } else if (errorCode === "FORBIDDEN") {
        toast.error("권한이 없습니다");
        void router.push("/cases");
      } else {
        // Generic error
        toast.error(error.message || "사건을 불러오는데 실패했습니다");
      }
    }
  }, [mounted, error, router]);

  // Prevent SSR hydration mismatch
  if (!mounted) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // Skip rendering if redirecting
  if (!user || error) {
    return null;
  }

  // Loading state
  if (isPending) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // No case data (shouldn't happen due to error handling above)
  if (!caseItem) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header with navigation - 간소화된 버튼 구성 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">사건 상세</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void router.push("/cases")}>
              목록
            </Button>

            {/* Upload Button - 핵심 기능 */}
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Upload className="w-4 h-4 mr-2" />
                  업로드
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>거래내역서 업로드</DialogTitle>
                  <DialogDescription>
                    엑셀, CSV, PDF 형식의 파일을 업로드하세요
                  </DialogDescription>
                </DialogHeader>

                <FileUploadZone
                  caseId={id as string}
                  onFilesSelected={(files) => {
                    if (files.length > 0) {
                      toast.success(
                        `${files.length}개 파일이 처리되었습니다. 분석이 진행 중입니다...`
                      );
                    }
                  }}
                  onUploadSuccess={(documentId) => {
                    // 분석 완료 후 호출됨 - 데이터 새로고침
                    void refetch();
                    void utils.file.getDocumentsForCase.invalidate({ caseId: id as string });
                    void utils.transaction.search.invalidate({
                      caseId: id as string,
                      ...(selectedDocumentId && { documentId: selectedDocumentId }),
                    });
                    // 모달은 여기서 닫지 않음 - 사용자가 직접 닫거나 완료 메시지 확인 후 닫도록
                  }}
                />
              </DialogContent>
            </Dialog>

            {/* Excel 내보내기 - 핵심 기능 */}
            <ExportOptionsModal
              caseId={id as string}
              onExport={handleExport}
              isExporting={exportMutation.isPending}
            >
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </Button>
            </ExportOptionsModal>
          </div>
        </div>

        {/* 메인 영역: 거래내역(좌) + AI 어시스턴트(우) 2열 배치 */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
          {/* 왼쪽 60%: 거래내역 테이블 */}
          <div className="xl:col-span-3">
            <Card className="p-6 h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">거래내역</h2>
                {documents && documents.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedDocumentId ?? "all"}
                      onChange={(e) => setSelectedDocumentId(e.target.value === "all" ? null : e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="all">전체 파일</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.originalFileName}
                        </option>
                      ))}
                    </select>
                    {selectedDocumentId && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (confirm("선택한 파일과 거래내역을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
                            await deleteTransactionsMutation.mutateAsync({
                              documentId: selectedDocumentId,
                            });
                            setSelectedDocumentId(null); // 삭제 후 선택 초기화
                          }
                        }}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {transactionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : simplifiedTransactions.length > 0 ? (
                  <SimplifiedTransactionTable
                    transactions={simplifiedTransactions}
                    caseId={id as string}
                    showDocumentName={!selectedDocumentId} // 전체 파일 선택시 문서명 표시
                  />
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">거래내역이 없습니다</p>
                    <p className="text-sm text-gray-500 mt-2">
                      거래내역서 파일을 업로드하여 데이터를 가져오세요
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 오른쪽 40%: AI 어시스턴트 */}
          <div className="xl:col-span-2">
            {/* 퀵 버튼 */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIsLoanTrackingOpen(true)}
              >
                대출금 사용 소명자료 생성
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIsAmountFilterOpen(true)}
              >
                금액 이상 입출금건 뽑기
              </Button>
            </div>
            
            <AIChatAssistant
              caseId={id as string}
              transactions={memoizedTransactions}
            />
          </div>
        </div>

        {/* Story 6.2: Split View Layout - 왼쪽 40% 발견사항, 오른쪽 60% 사건 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 왼쪽 40%: 발견사항 목록 */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">발견사항</h2>
              {findings && findings.length > 0 ? (
                <FindingList
                  findings={findings}
                  onUpdate={() => {
                    // Findings 목록 갱신
                    void utils.findings.getFindingsForCase.invalidate({ caseId: id as string });
                  }}
                  onFindingClick={handleFindingClick}
                />
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">발견사항이 없습니다</p>
                </div>
              )}
            </Card>
          </div>

          {/* 오른쪽 60%: 사건 정보 및 메모 */}
          <div className="lg:col-span-3 space-y-6">
            {/* Case Details Card */}
            <Card className="p-6">
              <div className="space-y-6">
                {/* Case Number */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">사건번호</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {caseItem.caseNumber}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">상태</h3>
                    <div className="mt-1">
                      <span
                        className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                          statusColors[caseItem.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {getStatusLabel(caseItem.status)}
                      </span>
                    </div>
                  </div>

                  {/* Filing Date */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">접수일자</h3>
                    <p className="mt-1 text-lg text-gray-900">
                      {caseItem.filingDate
                        ? new Date(caseItem.filingDate).toLocaleDateString("ko-KR")
                        : "-"}
                    </p>
                  </div>
                </div>

                <hr className="border-gray-200" />

                {/* Debtor Name */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500">채무자명</h3>
                  <p className="mt-1 text-lg text-gray-900">{caseItem.debtorName}</p>
                </div>

                {/* Court Name */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500">법원명</h3>
                  <p className="mt-1 text-lg text-gray-900">
                    {caseItem.courtName ?? "-"}
                  </p>
                </div>

                <hr className="border-gray-200" />

                {/* Lawyer Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500">담당 변호사</h3>
                  <div className="mt-1">
                    <p className="text-lg font-medium text-gray-900">
                      {caseItem.lawyer.name ?? caseItem.lawyer.email}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {caseItem.lawyer.email}
                    </p>
                  </div>
                </div>

                <hr className="border-gray-200" />

                {/* Timestamps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">생성일</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(caseItem.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">수정일</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(caseItem.updatedAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Case Notes Section - Story 2.6 */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">사건 메모</h2>

              {/* Add Note Form */}
              <div className="mb-6">
                <Label htmlFor="newNote">새 메모 추가</Label>
                <Textarea
                  id="newNote"
                  placeholder="메모 내용을 입력하세요 (최대 1000자)"
                  value={newNoteContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNoteContent(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-2"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">
                    {newNoteContent.length} / 1000자
                  </p>
                  <Button
                    onClick={() =>
                      createNoteMutation.mutate({
                        caseId: id as string,
                        content: newNoteContent.trim(), // Trim before sending to backend
                      })
                    }
                    disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                  >
                    {createNoteMutation.isPending ? "추가 중..." : "메모 추가"}
                  </Button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-4">
                {!notes || notes.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">등록된 메모가 없습니다</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <Card key={note.id} className="p-4">
                      {editingNoteId === note.id ? (
                        /* Edit Mode */
                        <div>
                          <Label htmlFor={`edit-note-${note.id}`}>메모 수정</Label>
                          <Textarea
                            id={`edit-note-${note.id}`}
                            value={editingNoteContent}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingNoteContent(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="mt-2"
                          />
                          <div className="flex justify-between items-center mt-2">
                            <p className="text-sm text-gray-500">
                              {editingNoteContent.length} / 1000자
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteContent("");
                                }}
                              >
                                취소
                              </Button>
                              <Button
                                onClick={() =>
                                  updateNoteMutation.mutate({
                                    id: note.id,
                                    content: editingNoteContent.trim(), // Trim before sending to backend
                                  })
                                }
                                disabled={
                                  !editingNoteContent.trim() ||
                                  updateNoteMutation.isPending
                                }
                              >
                                {updateNoteMutation.isPending
                                  ? "저장 중..."
                                  : "저장"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">
                                {note.author.name ?? note.author.email}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(note.createdAt).toLocaleString("ko-KR")}
                              </p>
                            </div>
                            {note.authorId === user?.id && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteContent(note.content);
                                  }}
                                  aria-label={`메모 수정: ${note.content.substring(0, 20)}${note.content.length > 20 ? "..." : ""}`}
                                >
                                  수정
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={deleteNoteMutation.isPending}
                                      aria-label={`메모 삭제: ${note.content.substring(0, 20)}${note.content.length > 20 ? "..." : ""}`}
                                    >
                                      삭제
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>메모 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        이 메모를 삭제하시겠습니까? 이 작업은 되돌릴 수
                                        없습니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          deleteNoteMutation.mutate({ id: note.id })
                                        }
                                      >
                                        삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Story 6.2: Finding 상세 모달 */}
      <Dialog open={isFindingDetailModalOpen} onOpenChange={setIsFindingDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              {selectedFinding?.title}
              {selectedFinding && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    selectedFinding.severity === "CRITICAL"
                      ? "bg-red-100 text-red-700"
                      : selectedFinding.severity === "WARNING"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {selectedFinding.severity}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedFinding?.findingType} • {selectedFinding && formatDate(selectedFinding.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedFinding && (
            <div className="space-y-4">
              {/* 설명 */}
              {selectedFinding.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">설명</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">
                    {selectedFinding.description}
                  </p>
                </div>
              )}

              {/* 관련 채권자명 */}
              {selectedFinding.relatedCreditorNames && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">관련 채권자</h3>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      try {
                        const creditors = JSON.parse(selectedFinding.relatedCreditorNames) as string[];
                        return creditors.map((creditor, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                          >
                            {creditor}
                          </span>
                        ));
                      } catch {
                        return (
                          <span className="text-sm text-gray-600">
                            {selectedFinding.relatedCreditorNames}
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* 관련 거래 ID */}
              {selectedFinding.relatedTransactionIds && selectedFinding.relatedTransactionIds.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    관련 거래 ({selectedFinding.relatedTransactionIds.length}건)
                  </h3>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2">
                    {selectedFinding.relatedTransactionIds.map((txId) => (
                      <div
                        key={txId}
                        className="text-sm font-mono text-gray-700 bg-white px-3 py-2 rounded border"
                      >
                        {txId}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 단일 거래 연결 정보 */}
              {selectedFinding.transaction && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">연결된 거래</h3>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">거래일:</span>
                      <span className="font-medium">
                        {formatDate(selectedFinding.transaction.transactionDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">메모:</span>
                      <span className="font-medium">
                        {selectedFinding.transaction.memo ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">입금액:</span>
                      <span className="font-medium text-blue-600">
                        {selectedFinding.transaction.depositAmount
                          ? formatCurrency(Number(selectedFinding.transaction.depositAmount))
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">출금액:</span>
                      <span className="font-medium text-red-600">
                        {selectedFinding.transaction.withdrawalAmount
                          ? formatCurrency(Number(selectedFinding.transaction.withdrawalAmount))
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 해결 정보 */}
              {selectedFinding.isResolved && selectedFinding.resolvedAt && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  <span className="font-medium">✓ 해결됨:</span>
                  <span>{formatDate(selectedFinding.resolvedAt)}</span>
                </div>
              )}

              {/* Story 6.3: 메모 섹션 (AC1, AC6) */}
              <div className="border-t pt-4">
                <FindingNoteSection findingId={selectedFinding.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 대출금 사용 소명자료 생성 모달 */}
      <LoanTrackingModal
        isOpen={isLoanTrackingOpen}
        onClose={() => setIsLoanTrackingOpen(false)}
        caseId={id as string}
      />
      
      {/* 금액 이상 입출금건 필터 모달 */}
      <AmountFilterModal
        isOpen={isAmountFilterOpen}
        onClose={() => setIsAmountFilterOpen(false)}
        caseId={id as string}
      />
    </div>
  );
};

export default CaseDetailPage;
