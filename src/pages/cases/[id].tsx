import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
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
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Case Detail Page
 *
 * Displays detailed information about a specific case.
 * Story 2.3: 사건 상세 조회
 */

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

  // tRPC utils for optimistic updates
  const utils = api.useUtils();

  // Fetch case details
  const { data: caseItem, isPending, error } = api.case.getCaseById.useQuery(
    { id: id as string },
    {
      enabled: !!id, // Only fetch when id is available
    }
  );

  // Archive mutation
  const archiveMutation = api.case.archiveCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 아카이브되었습니다");
      void router.push("/cases");
    },
    onError: (err) => {
      toast.error(err.message || "사건 아카이브에 실패했습니다");
    },
  });

  // Unarchive mutation
  const unarchiveMutation = api.case.unarchiveCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 복원되었습니다");
      void router.push("/cases");
    },
    onError: (err) => {
      toast.error(err.message || "사건 복원에 실패했습니다");
    },
  });

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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

  // Redirect to login if not authenticated
  if (!user) {
    void router.push("/auth/login");
    return null;
  }

  // Handle errors and redirect immediately (prevents unnecessary rendering)
  if (error) {
    const errorCode = error.data?.code;

    if (errorCode === "NOT_FOUND") {
      toast.error("사건을 찾을 수 없습니다");
      void router.push("/cases");
      return null;
    } else if (errorCode === "FORBIDDEN") {
      toast.error("권한이 없습니다");
      void router.push("/cases");
      return null;
    } else {
      // Generic error
      toast.error(error.message || "사건을 불러오는데 실패했습니다");
      return null;
    }
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
      <div className="max-w-4xl mx-auto">
        {/* Header with navigation */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">사건 상세</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void router.push("/cases")}>
              목록으로 돌아가기
            </Button>
            <Button
              onClick={() => void router.push(`/cases/${Array.isArray(id) ? id[0] : id}/edit`)}
            >
              수정
            </Button>

            {/* Upload Button - Story 3.1 */}
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  거래내역서 업로드
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>거래내역서 업로드</DialogTitle>
                  <DialogDescription>
                    엑셀, CSV, PDF 형식의 거래내역서 파일을 업로드하세요
                  </DialogDescription>
                </DialogHeader>

                <FileUploadZone
                  caseId={id as string}
                  onFilesSelected={(files) => {
                    // File upload logic will be implemented in Story 3.3 (S3 upload)
                    // For now, just show the selected files
                    toast.success(
                      `${files.length}개 파일이 선택되었습니다. 업로드 기능은 Story 3.3에서 구현됩니다.`
                    );
                  }}
                />
              </DialogContent>
            </Dialog>
            {/* Archive/Unarchive Button - Conditional Rendering */}
            {caseItem?.isArchived ? (
              <Button
                variant="secondary"
                onClick={() => unarchiveMutation.mutate({ id: id as string })}
                disabled={unarchiveMutation.isPending}
              >
                {unarchiveMutation.isPending ? "복원 중..." : "복원"}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? "아카이브 중..." : "아카이브"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>사건 아카이브</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 사건을 아카이브하시겠습니까? 아카이브된 사건은 기본 목록에서 숨겨집니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => archiveMutation.mutate({ id: id as string })}
                    >
                      아카이브
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

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
        <div className="mt-6">
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
  );
};

export default CaseDetailPage;
