/**
 * CreditorFilterPanel Component
 *
 * Story 6.4: 채권자별 필터링
 *
 * 채권자 필터 패널 컴포넌트:
 * - AC1: 채권자 목록 체크박스 표시
 * - AC2: 단일 채권자 필터링
 * - AC3: 다중 채권자 필터링 (OR 조건)
 * - Story 5.5 패턴: 필터 저장/불러오기 (Task 4)
 */

import { useState, useEffect } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Card } from "~/components/ui/card";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface CreditorFilterPanelProps {
  caseId: string;
  selectedCreditors: string[];
  onSelectionChange: (creditors: string[]) => void;
}

/**
 * Story 6.4 Task 3: CreditorFilterPanel 컴포넌트
 *
 * 채권자 목록을 체크박스로 표시하고,
 * 다중 선택을 통해 OR 조건 필터링을 제공합니다.
 */
export const CreditorFilterPanel: React.FC<CreditorFilterPanelProps> = ({
  caseId,
  selectedCreditors,
  onSelectionChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  // Story 6.4 Task 2: 고유 채권자 목록 조회
  const { data: creditors, isLoading } = api.findings.getUniqueCreditors.useQuery(
    { caseId },
    {
      enabled: !!caseId,
      staleTime: 5 * 60 * 1000, // 5분 캐시
    }
  );

  // 필터링된 채권자 목록 (검색어 기반)
  const filteredCreditors = creditors?.filter((creditor) =>
    creditor.toLowerCase().includes(searchQuery.toLowerCase().trim())
  ) ?? [];

  // 현재 표시된 목록의 모든 채권자가 선택된 경우 selectAll true
  useEffect(() => {
    if (filteredCreditors.length > 0) {
      const allSelected = filteredCreditors.every((creditor) =>
        selectedCreditors.includes(creditor)
      );
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [selectedCreditors, filteredCreditors]);

  // 단일 채권자 토글 (AC2, AC3)
  const handleToggleCreditor = (creditor: string) => {
    if (selectedCreditors.includes(creditor)) {
      // 선택 해제
      onSelectionChange(selectedCreditors.filter((c) => c !== creditor));
    } else {
      // 선택
      onSelectionChange([...selectedCreditors, creditor]);
    }
  };

  // 전체 선택/해제 (AC3)
  const handleToggleSelectAll = () => {
    if (selectAll) {
      // 전체 해제
      onSelectionChange(
        selectedCreditors.filter(
          (c) => !filteredCreditors.includes(c)
        )
      );
    } else {
      // 전체 선택 (현재 검색 결과만)
      const newSelection = [
        ...new Set([...selectedCreditors, ...filteredCreditors]),
      ];
      onSelectionChange(newSelection);
    }
    setSelectAll(!selectAll);
  };

  // 선택 초기화
  const handleClearSelection = () => {
    onSelectionChange([]);
    setSelectAll(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          채권자 목록을 불러오는 중...
        </span>
      </div>
    );
  }

  if (!creditors || creditors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">
          이 사건에 채권자 정보가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더: 검색 및 전체 선택 */}
      <div className="space-y-2">
        {/* 검색 입력 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="채권자명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 전체 선택 및 초기화 버튼 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm">
            <Checkbox
              checked={selectAll}
              onCheckedChange={handleToggleSelectAll}
            />
            <span>
              전체 선택 ({filteredCreditors.length}개 중 {selectedCreditors.length}개 선택됨)
            </span>
          </label>

          {selectedCreditors.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-8 text-xs"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              선택 초기화
            </Button>
          )}
        </div>
      </div>

      {/* 채권자 목록 (AC1) */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-1">
          {filteredCreditors.map((creditor) => (
            <Card key={creditor} className="p-3 hover:bg-muted/50">
              <label className="flex cursor-pointer items-start space-x-3">
                <Checkbox
                  checked={selectedCreditors.includes(creditor)}
                  onCheckedChange={() => handleToggleCreditor(creditor)}
                />
                <span className="text-sm leading-tight">{creditor}</span>
              </label>
            </Card>
          ))}

          {/* 검색 결과 없음 */}
          {filteredCreditors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                "{searchQuery}"에 해당하는 채권자가 없습니다.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 선택된 채권자 요약 */}
      {selectedCreditors.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>선택된 채권자:</strong> {selectedCreditors.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
};
