/**
 * Tag Badge Component
 *
 * Story 4.6: 태그 추가 및 삭제
 *
 * 태그를 표시하고 삭제 버튼을 제공하는 배지 컴포넌트입니다.
 * - 태그 이름 표시 (배지)
 * - "x" 버튼 (삭제)
 * - 호버 시 삭제 표시
 *
 * @param tagId - 태그 ID
 * @param tagName - 태그 이름
 * @param onRemove - 삭제 콜백 함수
 * @param disabled - 비활성화 여부
 */

"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X } from "lucide-react";

interface TagBadgeProps {
  tagId: string;
  tagName: string;
  onRemove: (tagId: string) => void;
  disabled?: boolean;
}

export function TagBadge({
  tagId,
  tagName,
  onRemove,
  disabled = false,
}: TagBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 pr-1 transition-colors",
        "!whitespace-normal",
        !disabled && "hover:bg-destructive/10 group"
      )}
    >
      <span className="max-w-[150px] truncate" title={tagName}>
        {tagName}
      </span>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-4 w-4 p-0 rounded-full opacity-50 hover:opacity-100",
            "hover:bg-destructive/20 hover:text-destructive"
          )}
          onClick={() => onRemove(tagId)}
          aria-label={`태그 ${tagName} 삭제`}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">태그 삭제</span>
        </Button>
      )}
    </Badge>
  );
}
