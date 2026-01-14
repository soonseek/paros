/**
 * Fund Destination Trace Result Component (Story 5.2)
 *
 * 자금 사용처 추적 결과를 표시하는 컴포넌트
 *
 * 기능:
 * - 추적된 거래 체인 목록 렌더링
 * - 각 거래의 연관 강도 표시 (Badge)
 * - "계속 추적" 버튼 (depth < 5)
 * - "자금 사용처를 찾을 수 없습니다" 메시지
 * - Story 5.3: 체인 저장 버튼 추가
 *
 * @component
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ArrowDownCircle, ChevronRight, AlertCircle, Save } from "lucide-react";
import { api } from "~/utils/api";
import { toast } from "sonner";
import { ExportFundFlowButton } from "./export-fund-flow-button";

/**
 * 추적된 거래 체인의 노드
 */
export interface ChainNode {
  transactionId: string;
  depth: number;
  amount: number;
  transactionDate: Date;
  memo: string | null;
  category: string | null;
  creditorName: string | null;
  matchReason: string; // 연결 사유
  confidence: number; // 연결 신뢰도 (0.0 ~ 1.0)
}

/**
 * 추적된 거래 체인
 */
export interface TransactionChain {
  nodes: ChainNode[];
  totalAmount: number;
  maxDepth: number;
  path: string; // CSV: "tx1,tx2,tx3"
}

/**
 * 추적 결과
 */
export interface TracingResult {
  startTransaction: {
    id: string;
    caseId: string;
    transactionDate: Date;
    depositAmount: number | null;
    withdrawalAmount: number | null;
    memo: string | null;
    category: string | null;
    creditorName: string | null;
  };
  chains: TransactionChain[];
  totalChains: number;
  totalTransactions: number;
  responseTimeMs: number;
  maxDepth: number;
}

interface FundDestinationTraceResultProps {
  result: TracingResult | null;
  isLoading: boolean;
  error: string | null;
  depth: number;
  onContinueTracing: () => void;
}

/**
 * 신뢰도에 따른 Badge 색상 반환
 */
function getConfidenceBadgeVariant(confidence: number): "default" | "secondary" | "destructive" | "outline" {
  if (confidence >= 0.8) return "default"; // 높음: 파란색
  if (confidence >= 0.6) return "secondary"; // 중간: 회색
  return "destructive"; // 낮음: 빨간색
}

/**
 * 신뢰도 퍼센트 문자열 반환
 */
function getConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * 날짜 포맷팅
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 금액 포맷팅
 */
function formatAmount(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

/**
 * FundDestinationTraceResult 컴포넌트
 */
export default function FundDestinationTraceResult({
  result,
  isLoading,
  error,
  depth,
  onContinueTracing,
}: FundDestinationTraceResultProps) {
  // Story 5.3: 체인 저장 mutation
  const saveChainMutation = api.fundFlow.saveChain.useMutation({
    onSuccess: () => {
      toast.success("체인이 저장되었습니다.");
    },
    onError: (error) => {
      console.error("체인 저장 실패:", error);
      toast.error("체인 저장에 실패했습니다.");
    },
  });

  // 체인 저장 핸들러
  const handleSaveChain = async (
    chain: TransactionChain,
    startTxId: string,
    chainIndex: number
  ) => {
    try {
      // 마지막 노드의 ID를 endTxId로 사용
      const lastNode = chain.nodes[chain.nodes.length - 1];
      if (!lastNode) {
        toast.error("체인의 마지막 노드를 찾을 수 없습니다.");
        return;
      }

      const endTxId = lastNode.transactionId;

      await saveChainMutation.mutateAsync({
        caseId: result!.startTransaction.caseId,
        startTxId,
        endTxId,
        chainType: "DOWNSTREAM",
        chainDepth: chain.nodes.length - 1,
        path: chain.path,
        totalAmount: chain.totalAmount,
      });
    } catch (error) {
      console.error("체인 저장 실패:", error);
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5" />
            자금 사용처 추적 중...
          </CardTitle>
          <CardDescription>자금 흐름을 분석하고 있습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            추적 실패
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // 결과 없음
  if (!result || result.chains.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            자금 사용처를 찾을 수 없습니다
          </CardTitle>
          <CardDescription>
            해당 거래와 일치하거나 유사한 입금 거래를 찾을 수 없습니다
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { startTransaction, chains, totalChains, totalTransactions, responseTimeMs } = result;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="h-5 w-5 text-orange-600" />
          자금 사용처 추적 결과
        </CardTitle>
        <CardDescription>
          {totalChains}개 체인 발견 • {totalTransactions}개 거래 분석 •{" "}
          응답 시간: {responseTimeMs}ms
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 시작 거래 정보 */}
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            시작 거래
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm">날짜:</span>
              <span className="text-sm font-medium">
                {formatDate(startTransaction.transactionDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">금액:</span>
              <span className="text-sm font-medium">
                {startTransaction.withdrawalAmount
                  ? formatAmount(Number(startTransaction.withdrawalAmount))
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">메모:</span>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {startTransaction.memo || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* 추적 체인 목록 */}
        <ScrollArea className="h-[400px] rounded-md border">
          <div className="p-4 space-y-4">
            {chains.map((chain, chainIndex) => (
              <div
                key={chainIndex}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                {/* 체인 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    체인 {chainIndex + 1} ({chain.nodes.length}단계)
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      총 {formatAmount(chain.totalAmount)}
                    </Badge>
                    {/* Story 5.3: 체인 저장 버튼 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSaveChain(chain, startTransaction.id, chainIndex)
                      }
                      disabled={saveChainMutation.isPending}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      저장
                    </Button>
                  </div>
                </div>

                {/* 체인 노드들 */}
                <div className="space-y-2">
                  {chain.nodes.map((node, nodeIndex) => (
                    <div key={node.transactionId} className="relative">
                      {/* 노드 카드 */}
                      <div className="flex items-start gap-3 rounded-md border p-3 bg-background hover:bg-muted/50 transition-colors">
                        {/* 깊이 표시 */}
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {node.depth}
                          </div>
                          {nodeIndex < chain.nodes.length - 1 && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* 거래 정보 */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {node.memo || "메모 없음"}
                            </span>
                            <Badge
                              variant={getConfidenceBadgeVariant(node.confidence)}
                              className="ml-2"
                            >
                              {getConfidencePercent(node.confidence)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>날짜: {formatDate(node.transactionDate)}</div>
                            <div>금액: {formatAmount(node.amount)}</div>
                            {node.category && (
                              <div>분류: {node.category}</div>
                            )}
                            {node.creditorName && (
                              <div>채권자: {node.creditorName}</div>
                            )}
                            <div className="text-muted-foreground/80">
                              {node.matchReason}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 계속 추적 버튼 (depth < 5) */}
        {depth < 5 && (
          <div className="flex justify-center gap-3">
            <Button onClick={onContinueTracing} size="lg">
              <ArrowDownCircle className="mr-2 h-4 w-4" />
              계속 추적 (현재: {depth}단계)
            </Button>
          </div>
        )}

        {/* 최대 깊이 도달 안내 */}
        {depth >= 5 && (
          <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              최대 추적 깊이(5단계)에 도달했습니다. 더 이상 추적할 수 없습니다.
            </p>
          </div>
        )}

        {/* Story 5.6: 엑셀 내보내기 버튼 */}
        {result && result.chains.length > 0 && (
          <div className="flex justify-center pt-4 border-t">
            <ExportFundFlowButton
              caseId={result.startTransaction.caseId}
              availableOptions={["all"]}
              buttonText="엑셀로 내보내기"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
