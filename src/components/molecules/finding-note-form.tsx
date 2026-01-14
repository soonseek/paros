/**
 * FindingNoteForm Component
 *
 * Story 6.3: 발견사항 메모 추가
 *
 * 메모 입력 폼 컴포넌트:
 * - textarea 입력 필드
 * - "추가" 버튼 (React Query mutation 연결)
 * - 입력 검증 (빈 내용 방지)
 * - 에러 메시지 표시
 *
 * AC1: 메모 추가 UI 제공
 * AC2: 메모 생성 기능
 */

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface FindingNoteFormProps {
  findingId: string;
  onSuccess?: () => void;
}

export const FindingNoteForm: React.FC<FindingNoteFormProps> = ({
  findingId,
  onSuccess,
}) => {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = api.useUtils();

  // Story 6.3: 메모 생성 mutation (AC2)
  const addNoteMutation = api.findings.addNote.useMutation({
    onSuccess: (data) => {
      toast.success("메모가 추가되었습니다.");
      setContent(""); // 입력 필드 초기화

      // 메모 목록 갱신 (React Query invalidation)
      void utils.findings.getNotesForFinding.invalidate({ findingId });

      // 성공 콜백 호출
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "메모 추가에 실패했습니다.");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 입력 검증: 빈 내용 방지 (AC1)
    if (!content.trim()) {
      toast.error("메모 내용을 입력해주세요.");
      return;
    }

    // 입력 검증: 최대 5000자 (Story 6.3 Dev Notes)
    if (content.length > 5000) {
      toast.error("메모 내용은 5000자 이하여야 합니다.");
      return;
    }

    setIsSubmitting(true);

    // 메모 생성 호출 (AC2)
    addNoteMutation.mutate({
      findingId,
      content: content.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="메모를 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="resize-none"
        disabled={isSubmitting}
        maxLength={5000}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length} / 5000자
        </span>

        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          추가
        </Button>
      </div>
    </form>
  );
};
