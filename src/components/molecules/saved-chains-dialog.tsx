/**
 * Saved Chains Dialog Component (Story 5.3)
 *
 * 저장된 거래 체인 목록을 다이얼로그로 표시하는 컴포넌트
 *
 * 기능:
 * - "저장된 체인 보기" 버튼 클릭 시 다이얼로그 표시
 * - TransactionChainList를 사용하여 체인 목록 표시
 * - 체인 클릭 시 ChainVisualization 모달
 *
 * @component
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { List } from "lucide-react";
import TransactionChainList from "./transaction-chain-list";

interface SavedChainsDialogProps {
  caseId: string;
}

/**
 * SavedChainsDialog 컴포넌트
 */
export default function SavedChainsDialog({
  caseId,
}: SavedChainsDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <List className="mr-2 h-4 w-4" />
          저장된 체인 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>저장된 거래 체인</DialogTitle>
        </DialogHeader>
        <TransactionChainList caseId={caseId} />
      </DialogContent>
    </Dialog>
  );
}
