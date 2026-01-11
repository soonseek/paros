/**
 * Category Editor Component
 *
 * Story 4.5: 수동 분류 수정
 *
 * 거래의 카테고리를 수동으로 수정하는 드롭다운 에디터 컴포넌트
 */

"use client";

import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { useI18n } from "~/lib/i18n";
import { api } from "~/utils/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface CategoryEditorProps {
  transactionId: string;
  currentCategory: string | null;
  currentSubcategory: string | null;
  onClassificationUpdated: () => void;
  disabled?: boolean;
}

/**
 * 카테고리 목록 (Story 4.1 AI 분류 기준)
 */
const CATEGORIES = [
  { value: "입금", label: "category.deposit" },
  { value: "출금", label: "category.withdrawal" },
  { value: "이체", label: "category.transfer" },
  { value: "수수료", label: "category.fee" },
  { value: "기타", label: "category.other" },
];

/**
 * 카테고리 에디터 컴포넌트
 *
 * @example
 * <CategoryEditor
 *   transactionId="tx-123"
 *   currentCategory="입금"
 *   currentSubcategory="이체"
 *   onClassificationUpdated={() => refetch()}
 * />
 */
export function CategoryEditor({
  transactionId,
  currentCategory,
  currentSubcategory,
  onClassificationUpdated,
  disabled = false,
}: CategoryEditorProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    currentCategory ?? ""
  );
  const [originalCategory, setOriginalCategory] = useState<string>(
    currentCategory ?? ""
  );

  // tRPC mutations
  const updateMutation = api.transaction.updateTransactionClassification.useMutation({
    onSuccess: () => {
      toast.success(t("manualClassification.success"));
      setIsEditing(false);
      setOriginalCategory(selectedCategory);
      onClassificationUpdated();
    },
    onError: (error) => {
      console.error("카테고리 수정 실패:", error);
      toast.error(error.message || t("manualClassification.error.updateFailed"));
      // 에러 시 원본 값 복원
      setSelectedCategory(originalCategory);
    },
  });

  const handleSave = async () => {
    if (!selectedCategory || selectedCategory === originalCategory) {
      setIsEditing(false);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        transactionId,
        category: selectedCategory,
        subcategory: currentSubcategory ?? undefined,
      });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Failed to update classification:", error);
    }
  };

  const handleCancel = () => {
    setSelectedCategory(originalCategory);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  if (isEditing && !disabled) {
    return (
      <div className="flex items-center gap-1">
        <Select
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          disabled={updateMutation.isPending}
          aria-label={t("manualClassification.edit")}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[120px] text-xs"
            aria-label={t("manualClassification.categoryLabel")}
          >
            <SelectValue placeholder={t("transaction.table.category")} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {t(category.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleSave}
          disabled={updateMutation.isPending || !selectedCategory}
          aria-label={t("manualClassification.save")}
        >
          <Check className="h-3 w-3" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          aria-label={t("manualClassification.cancel")}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">{currentCategory ?? "-"}</span>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
          onClick={handleEdit}
          aria-label={t("manualClassification.edit")}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
