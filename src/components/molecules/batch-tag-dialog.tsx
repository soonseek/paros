/**
 * Batch Tag Dialog Component
 *
 * Story 4.6: 태그 추가 및 삭제
 *
 * 여러 거래에 동일한 태그를 일괄 추가하는 다이얼로그 컴포넌트입니다.
 * - 선택된 거래 수 표시
 * - 태그 이름 입력 필드 (자동 완성 포함)
 * - "추가" 버튼
 * - tRPC mutation 호출 (addTagsToMultipleTransactions)
 *
 * @param transactionIds - 태그를 추가할 거래 ID 목록
 * @param open - 다이얼로그 열림 여부
 * @param onClose - 닫기 콜백
 * @param onComplete - 완료 콜백
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { api } from "~/utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
}

interface BatchTagDialogProps {
  transactionIds: string[];
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * 일괄 태그 추가 다이얼로그 컴포넌트
 *
 * @example
 * <BatchTagDialog
 *   transactionIds={["tx-1", "tx-2", "tx-3"]}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onComplete={() => refetch()}
 * />
 */
export function BatchTagDialog({
  transactionIds,
  open,
  onClose,
  onComplete,
}: BatchTagDialogProps) {
  const [tagName, setTagName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // tRPC mutation
  const batchAddMutation = api.tag.addTagsToMultipleTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${data.createdCount}개 거래에 태그 "${tagName}"이(가) 추가되었습니다.`
      );
      setTagName("");
      setShowSuggestions(false);
      onComplete();
      onClose();
    },
    onError: (error) => {
      console.error("일괄 태그 추가 실패:", error);
      toast.error(error.message || "일괄 태그 추가에 실패했습니다.");
    },
  });

  // 자동 완성 쿼리
  const { data: suggestionsData, isLoading: suggestionsLoading } =
    api.tag.getTagSuggestions.useQuery(
      {
        query: tagName || undefined,
        limit: 5,
      },
      {
        enabled: showSuggestions && tagName.length > 0,
      }
    );

  // 태그 추가 처리
  const handleAddTag = async (name: string) => {
    if (!name.trim()) {
      toast.error("태그 이름을 입력해 주세요.");
      return;
    }

    try {
      await batchAddMutation.mutateAsync({
        transactionIds,
        tagName: name.trim(),
      });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to add tags:", error);
    }
  };

  // 입력 변경 처리
  const handleInputChange = (value: string) => {
    setTagName(value);
    setShowSuggestions(value.length > 0);
  };

  // 제안 선택 처리
  const handleSelectSuggestion = (name: string) => {
    setTagName(name);
    setShowSuggestions(false);
    handleAddTag(name);
  };

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagName.trim()) {
        handleAddTag(tagName);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 다이얼로그가 열릴 때 입력 필드 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // 다이얼로그가 닫힐 때 상태 초기화
  const handleClose = () => {
    setTagName("");
    setShowSuggestions(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            일괄 태그 추가
          </DialogTitle>
          <DialogDescription>
            {transactionIds.length}개의 거래에 동일한 태그를 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 태그 입력 필드 */}
          <div className="relative">
            <label
              htmlFor="batch-tag-input"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              태그 이름
            </label>
            <div className="mt-2">
              <Input
                ref={inputRef}
                id="batch-tag-input"
                type="text"
                value={tagName}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="태그 이름 입력..."
                disabled={batchAddMutation.isPending}
                autoFocus
                aria-label="태그 이름 입력"
              />
            </div>

            {/* 자동 완성 드롭다운 */}
            {showSuggestions && suggestionsData?.tags && suggestionsData.tags.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
                role="listbox"
                aria-label="태그 제안"
              >
                {suggestionsLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  suggestionsData.tags.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion.name)}
                      className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      role="option"
                    >
                      <span>{suggestion.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.usageCount}회 사용
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 안내 메시지 */}
          <p className="text-sm text-muted-foreground">
            💡 팁: 기존 태그를 선택하거나 새 태그를 입력할 수 있습니다.
            입력 후 Enter 키를 누르거나 제안을 선택하세요.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={batchAddMutation.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => handleAddTag(tagName)}
            disabled={!tagName.trim() || batchAddMutation.isPending}
          >
            {batchAddMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                추가 중...
              </>
            ) : (
              <>
                <TagIcon className="h-4 w-4 mr-2" />
                태그 추가
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
