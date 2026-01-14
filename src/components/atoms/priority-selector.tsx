/**
 * PrioritySelector Component
 *
 * Story 6.5: 중요도 지정
 *
 * 중요도 선택 컴포넌트:
 * - AC1: 높음, 중간, 낮음 중 하나를 선택
 * - AC2: 드롭다운에서 새 중요도를 선택하면 업데이트
 * - 아이콘: ⬆️ (HIGH), ➡️ (MEDIUM), ⬇️ (LOW)
 * - 색상 코딩: red-600 (HIGH), amber-600 (MEDIUM), green-600 (LOW)
 * - "초기화" 옵션: priority를 null로 재설정
 */

import { Check } from "lucide-react";
import { Loader2 } from "lucide-react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";

type PriorityValue = "HIGH" | "MEDIUM" | "LOW" | null;

interface PrioritySelectorProps {
  findingId: string;
  currentPriority: PriorityValue;
  onUpdate?: () => void;
}

/**
 * Priority 선택 옵션 설정
 */
const PRIORITY_OPTIONS = [
  { value: "HIGH", label: "높음", icon: "⬆️", color: "text-red-600" },
  { value: "MEDIUM", label: "중간", icon: "➡️", color: "text-amber-600" },
  { value: "LOW", label: "낮음", icon: "⬇️", color: "text-green-600" },
  { value: null, label: "초기화", icon: "↺", color: "text-gray-600" },
] as const;

/**
 * PrioritySelector 컴포넌트
 */
export const PrioritySelector: React.FC<PrioritySelectorProps> = ({
  findingId,
  currentPriority,
  onUpdate,
}) => {
  const utils = api.useUtils();

  // updatePriority mutation
  const updatePriorityMutation = api.findings.updatePriority.useMutation({
    onSuccess: () => {
      toast.success("중요도가 업데이트되었습니다.");
      // Finding 관련 쿼리 무효화
      void utils.findings.getFindingsForCase.invalidate({ caseId: undefined });
      onUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message || "중요도 업데이트에 실패했습니다.");
    },
  });

  // resetPriority mutation
  const resetPriorityMutation = api.findings.resetPriority.useMutation({
    onSuccess: () => {
      toast.success("중요도가 초기화되었습니다.");
      void utils.findings.getFindingsForCase.invalidate({ caseId: undefined });
      onUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message || "중요도 초기화에 실패했습니다.");
    },
  });

  const handlePriorityChange = async (value: string) => {
    // 빈 문자열이면 초기화 (null)
    if (value === "" || value === "null") {
      resetPriorityMutation.mutate({ findingId });
    } else {
      // priority 업데이트
      updatePriorityMutation.mutate({
        findingId,
        priority: value as "HIGH" | "MEDIUM" | "LOW",
      });
    }
  };

  const isPending =
    updatePriorityMutation.isPending || resetPriorityMutation.isPending;

  // 현재 priority 값을 Select에 맞게 변환
  const selectValue = currentPriority ?? "null";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectValue}
        onValueChange={handlePriorityChange}
        disabled={isPending}
      >
        <SelectTrigger className="w-[140px]">
          {isPending ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">업데이트 중...</span>
            </div>
          ) : (
            <SelectValue placeholder="중요도 선택" />
          )}
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value ?? "null"} value={option.value ?? "null"}>
              <span className={`flex items-center gap-2 ${option.color}`}>
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
