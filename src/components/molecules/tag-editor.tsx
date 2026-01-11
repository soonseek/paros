/**
 * Tag Editor Component
 *
 * Story 4.6: 태그 추가 및 삭제
 *
 * 태그를 추가/삭제하는 에디터 컴포넌트입니다.
 * - 현재 태그 목록 표시 (Badge + 삭제 버튼)
 * - 태그 추가 입력 필드
 * - 자동 완성 드롭다운 (기존 태그 추천)
 * - 태그 추가/삭제 tRPC mutation 호출
 *
 * @param transactionId - 거래 ID
 * @param currentTags - 현재 태그 목록
 * @param onTagsUpdated - 태그 업데이트 콜백
 * @param disabled - 비활성화 여부
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { TagBadge } from "~/components/atoms/tag-badge";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
}

interface TagEditorProps {
  transactionId: string;
  currentTags: Array<{ tag: Tag }>;
  onTagsUpdated: () => void;
  disabled?: boolean;
}

/**
 * 태그 에디터 컴포넌트
 *
 * @example
 * <TagEditor
 *   transactionId="tx-123"
 *   currentTags={transaction.tags}
 *   onTagsUpdated={() => utils.transaction.getPaginatedTransactions.invalidate()}
 * />
 */
export function TagEditor({
  transactionId,
  currentTags,
  onTagsUpdated,
  disabled = false,
}: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // tRPC mutations & queries
  const addMutation = api.tag.addTagToTransaction.useMutation({
    onSuccess: () => {
      toast.success("태그가 추가되었습니다.");
      setNewTagName("");
      setIsAdding(false);
      onTagsUpdated();
    },
    onError: (error) => {
      console.error("태그 추가 실패:", error);
      toast.error(error.message || "태그 추가에 실패했습니다.");
    },
  });

  const removeMutation = api.tag.removeTagFromTransaction.useMutation({
    onSuccess: () => {
      toast.success("태그가 삭제되었습니다.");
      onTagsUpdated();
    },
    onError: (error) => {
      console.error("태그 삭제 실패:", error);
      toast.error(error.message || "태그 삭제에 실패했습니다.");
    },
  });

  const { data: suggestionsData, isLoading: suggestionsLoading } =
    api.tag.getTagSuggestions.useQuery(
      {
        query: newTagName || undefined,
        limit: 5,
      },
      {
        enabled: showSuggestions && newTagName.length > 0,
      }
    );

  // 태그 추가 처리
  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;

    // 중복 체크
    const exists = currentTags.some((t) => t.tag.name === tagName);
    if (exists) {
      toast.info("이미 추가된 태그입니다.");
      setNewTagName("");
      return;
    }

    try {
      await addMutation.mutateAsync({
        transactionId,
        tagName: tagName.trim(),
      });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to add tag:", error);
    }
  };

  // 태그 삭제 처리
  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeMutation.mutateAsync({
        transactionId,
        tagId,
      });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to remove tag:", error);
    }
  };

  // 입력 변경 처리
  const handleInputChange = (value: string) => {
    setNewTagName(value);
    setShowSuggestions(value.length > 0);
  };

  // 제안 선택 처리
  const handleSelectSuggestion = (tagName: string) => {
    setNewTagName(tagName);
    setShowSuggestions(false);
    handleAddTag(tagName);
  };

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (newTagName.trim()) {
        handleAddTag(newTagName);
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

  const tags = currentTags.map((t) => t.tag);

  return (
    <div className="space-y-2" role="listbox" aria-label="태그 편집">
      {/* 현재 태그 목록 */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagBadge
            key={tag.id}
            tagId={tag.id}
            tagName={tag.name}
            onRemove={handleRemoveTag}
            disabled={disabled}
          />
        ))}
      </div>

      {/* 태그 추가 입력 필드 */}
      {isAdding && !disabled ? (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={newTagName}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="태그 이름 입력..."
              disabled={addMutation.isPending}
              className="h-8 text-sm"
              autoFocus
              aria-label="새 태그 이름 입력"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleAddTag(newTagName)}
              disabled={!newTagName.trim() || addMutation.isPending}
              className="h-8"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewTagName("");
                setShowSuggestions(false);
              }}
              disabled={addMutation.isPending}
              className="h-8"
            >
              취소
            </Button>
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
      ) : !disabled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-1" />
          태그 추가
        </Button>
      ) : null}
    </div>
  );
}
