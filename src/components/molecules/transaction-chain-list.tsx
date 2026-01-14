/**
 * Transaction Chain List Component (Story 5.3)
 *
 * 저장된 거래 체인 목록을 표시하는 컴포넌트
 *
 * 기능:
 * - caseId로 필터링된 체인 목록 표시
 * - chainType별 필터링 지원
 * - 체인 카드 클릭 시 상세 보기 (ChainVisualization)
 * - 체인 삭제 기능
 *
 * @component
 */

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import ChainCard, { type ChainData, ChainType } from "./chain-card";
import ChainVisualization, {
  type ChainVisualizationData,
  type ChainVisualizationNode,
} from "./chain-visualization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Trash2, Filter } from "lucide-react";
import { api } from "~/utils/api";

interface TransactionChainListProps {
  caseId: string;
}

/**
 * Prisma TransactionChain → ChainData 변환
 */
function transformToChainData(prismaChain: any): ChainData {
  return {
    id: prismaChain.id,
    chainType: prismaChain.chainType as ChainType,
    chainDepth: prismaChain.chainDepth,
    totalAmount: prismaChain.totalAmount
      ? Number(prismaChain.totalAmount)
      : null,
    startTx: {
      transactionDate: new Date(prismaChain.startTx.transactionDate),
      depositAmount: prismaChain.startTx.depositAmount
        ? Number(prismaChain.startTx.depositAmount)
        : null,
      withdrawalAmount: prismaChain.startTx.withdrawalAmount
        ? Number(prismaChain.startTx.withdrawalAmount)
        : null,
      memo: prismaChain.startTx.memo,
    },
    endTx: {
      transactionDate: new Date(prismaChain.endTx.transactionDate),
      depositAmount: prismaChain.endTx.depositAmount
        ? Number(prismaChain.endTx.depositAmount)
        : null,
      withdrawalAmount: prismaChain.endTx.withdrawalAmount
        ? Number(prismaChain.endTx.withdrawalAmount)
        : null,
      memo: prismaChain.endTx.memo,
    },
  };
}

/**
 * TransactionChainList 컴포넌트
 */
export default function TransactionChainList({
  caseId,
}: TransactionChainListProps) {
  const [chainTypeFilter, setChainTypeFilter] = useState<string>("all");
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [chainDetail, setChainDetail] =
    useState<ChainVisualizationData | null>(null);

  // tRPC 쿼리
  const { data: chainsData, isLoading } =
    api.transactionChain.getTransactionChains.useQuery({
      caseId,
      chainType:
        chainTypeFilter === "all" ? undefined : (chainTypeFilter as ChainType),
    });

  // 체인 상세 조회
  const { data: detailData } = api.transactionChain.getChainDetail.useQuery(
    {
      chainId: selectedChain?.id || "",
    },
    {
      enabled: !!selectedChain,
    }
  );

  // 체인 삭제 mutation
  const deleteChain = api.transactionChain.deleteChain.useMutation();

  // 상세 데이터 변환
  React.useEffect(() => {
    if (detailData) {
      const { chain, transactions } = detailData;

      // Transaction → ChainVisualizationNode 변환
      const nodes: ChainVisualizationNode[] = transactions.map((tx) => ({
        id: tx.id,
        transactionDate: new Date(tx.transactionDate),
        depositAmount: tx.depositAmount ? Number(tx.depositAmount) : null,
        withdrawalAmount: tx.withdrawalAmount
          ? Number(tx.withdrawalAmount)
          : null,
        memo: tx.memo,
        category: tx.category,
        creditorName: tx.creditorName,
      }));

      setChainDetail({
        chainType: chain.chainType,
        chainDepth: chain.chainDepth,
        nodes,
        totalAmount: chain.totalAmount ? Number(chain.totalAmount) : undefined,
      });
    }
  }, [detailData]);

  // 체인 삭제 핸들러
  const handleDeleteChain = async (chainId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지

    if (!confirm("정말 이 체인을 삭제하시겠습니까?")) {
      return;
    }

    try {
      await deleteChain.mutateAsync({ chainId });
      // 삭제 성공 후 목록 갱신은 tRPC가 자동으로 처리
    } catch (error) {
      console.error("체인 삭제 실패:", error);
      alert("체인 삭제에 실패했습니다.");
    }
  };

  // 체인 카드 클릭 핸들러
  const handleChainClick = (chain: ChainData) => {
    setSelectedChain(chain);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const chains = chainsData?.chains || [];

  if (chains.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>저장된 체인이 없습니다.</p>
        <p className="text-sm mt-2">
          자금 흐름 분석을 시작하여 체인을 식별하세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* 필터 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">체인 필터</span>
          </div>
          <Select value={chainTypeFilter} onValueChange={setChainTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="체인 유형 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value={ChainType.LOAN_EXECUTION}>대출 실행</SelectItem>
              <SelectItem value={ChainType.DEBT_SETTLEMENT}>채무 변제</SelectItem>
              <SelectItem value={ChainType.COLLATERAL_RIGHT}>
                담보권 설정
              </SelectItem>
              <SelectItem value={ChainType.UPSTREAM}>자금 출처</SelectItem>
              <SelectItem value={ChainType.DOWNSTREAM}>자금 사용처</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 체인 목록 */}
        <ScrollArea className="h-[600px] rounded-md border p-4">
          <div className="grid grid-cols-1 gap-4">
            {chains.map((chain) => {
              const chainData = transformToChainData(chain);
              return (
                <div key={chain.id} className="relative group">
                  <ChainCard
                    chain={chainData}
                    onClick={() => handleChainClick(chainData)}
                    isSelected={selectedChain?.id === chain.id}
                  />
                  {/* 삭제 버튼 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteChain(chain.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* 요약 정보 */}
        <div className="text-sm text-muted-foreground text-center">
          총 {chains.length}개 체인
        </div>
      </div>

      {/* 체인 상세 다이얼로그 */}
      <Dialog
        open={!!selectedChain}
        onOpenChange={(open) => !open && setSelectedChain(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>체인 상세 보기</DialogTitle>
          </DialogHeader>
          {chainDetail && <ChainVisualization data={chainDetail} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
