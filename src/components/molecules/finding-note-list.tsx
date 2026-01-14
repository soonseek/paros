/**
 * FindingNoteList Component
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * 메모 목록 컴포넌트:
 * - 메모 목록 렌더링 (최신순 정렬)
 * - 각 메모의 작성자, 내용, 작성일시 표시
 * - 메모 수정/삭제 버튼 (자신의 메모인 경우만)
 * - 빈 상태 처리
 *
 * AC6: 메모 목록 표시
 */

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";

interface FindingNote {
  id: string;
  content: string;
  createdBy: string;
  findingId: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface FindingNoteListProps {
  findingId: string;
  notes: FindingNote[];
}

export const FindingNoteList: React.FC<FindingNoteListProps> = ({
  findingId,
  notes,
}) => {
  const { user } = useAuth();
  const utils = api.useUtils();

  // 수정 상태 관리
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Story 6.3: 메모 수정 mutation (AC3)
  const updateNoteMutation = api.findings.updateNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 수정되었습니다.");
      setEditingNoteId(null);
      setEditingContent("");

      // 메모 목록 갱신
      void utils.findings.getNotesForFinding.invalidate({ findingId });
    },
    onError: (err) => {
      toast.error(err.message || "메모 수정에 실패했습니다.");
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  // Story 6.3: 메모 삭제 mutation (AC4)
  const deleteNoteMutation = api.findings.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("메모가 삭제되었습니다.");

      // 메모 목록 갱신
      void utils.findings.getNotesForFinding.invalidate({ findingId });
    },
    onError: (err) => {
      toast.error(err.message || "메모 삭제에 실패했습니다.");
    },
  });

  // 수정 모드 시작
  const handleEditStart = (note: FindingNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  // 수정 저장 (AC3)
  const handleEditSave = async (noteId: string) => {
    if (!editingContent.trim()) {
      toast.error("메모 내용을 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    updateNoteMutation.mutate({
      noteId,
      content: editingContent.trim(),
    });
  };

  // 삭제 확인 (AC4)
  const handleDelete = async (noteId: string) => {
    if (!confirm("정말 이 메모를 삭제하시겠습니까?")) {
      return;
    }

    deleteNoteMutation.mutate({
      noteId,
    });
  };

  // 빈 상태 처리 (AC6)
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">
          아직 메모가 없습니다. 첫 번째 메모를 추가해보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const isOwnNote = note.createdBy === user?.id;
        const isEditing = editingNoteId === note.id;

        return (
          <Card key={note.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                {/* 작성자 정보 (AC6) */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {note.createdByUser?.name ?? "삭제된 사용자"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                  {/* 수정됨 배지 (AC6) */}
                  {note.updatedAt > note.createdAt && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                      수정됨
                    </span>
                  )}
                </div>

                {/* 메모 내용 (AC6) */}
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                      className="resize-none"
                      disabled={isUpdating}
                      maxLength={5000}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(note.id)}
                        disabled={isUpdating || !editingContent.trim()}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditCancel}
                        disabled={isUpdating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                )}
              </div>

              {/* 수정/삭제 버튼 (자신의 메모인 경우만, AC6) */}
              {isOwnNote && !isEditing && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditStart(note)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(note.id)}
                    disabled={deleteNoteMutation.isPending}
                  >
                    {deleteNoteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
