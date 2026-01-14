/**
 * Chain Visualization Component (Story 5.3)
 *
 * 체인에 포함된 모든 거래들을 순서대로 표시하고,
 * 각 거래 간의 관계를 화살표로 표시하는 컴포넌트
 *
 * 기능 (AC3):
 * - 체인에 포함된 모든 거래들이 순서대로 표시
 * - 각 거래 간의 관계가 화살표로 표시
 * - confidenceScore 표시
 * - confidenceScore < 0.6 시 경고 메시지 (AC4)
 *
 * @component
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  ChevronDown,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

/**
 * 체인 노드 인터페이스
 */
export interface ChainVisualizationNode {
  id: string;
  transactionDate: Date;
  depositAmount: number | null;
  withdrawalAmount: number | null;
  memo: string | null;
  category: string | null;
  creditorName: string | null;
}

/**
 * 체인 시각화 데이터 인터페이스
 */
export interface ChainVisualizationData {
  chainType: string;
  chainDepth: number;
  nodes: ChainVisualizationNode[];
  confidenceScore?: number; // 체인 평균 신뢰도
  totalAmount?: number;
}

interface ChainVisualizationProps {
  data: ChainVisualizationData;
}

/**
 * 체인 유형별 라벨 반환
 */
function getChainTypeLabel(chainType: string): string {
  switch (chainType) {
    case "LOAN_EXECUTION":
      return "대출 실행 체인";
    case "DEBT_SETTLEMENT":
      return "채무 변제 체인";
    case "COLLATERAL_RIGHT":
      return "담보권 설정 체인";
    case "UPSTREAM":
      return "자금 출처 추적";
    case "DOWNSTREAM":
      return "자금 사용처 추적";
    default:
      return "알 수 없는 체인";
  }
}

/**
 * 신뢰도에 따른 배지 변환 반환
 */
function getConfidenceBadgeVariant(
  confidence: number
): "default" | "secondary" | "destructive" | "outline" {
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
function formatAmount(amount: number | null): string {
  if (!amount) return "-";
  return `${Number(amount).toLocaleString()}원`;
}

/**
 * 방향 아이콘 반환 (입금/출금 구분)
 */
function getDirectionIcon(
  depositAmount: number | null,
  withdrawalAmount: number | null
): React.ReactNode {
  if (depositAmount && !withdrawalAmount) {
    return <ArrowUp className="h-4 w-4 text-green-600" />; // 입금
  }
  if (withdrawalAmount && !depositAmount) {
    return <ArrowDown className="h-4 w-4 text-red-600" />; // 출금
  }
  return <Minus className="h-4 w-4 text-gray-600" />; // 이체/기타
}

/**
 * ChainVisualization 컴포넌트
 */
export default function ChainVisualization({
  data,
}: ChainVisualizationProps) {
  const { chainType, chainDepth, nodes, confidenceScore, totalAmount } = data;

  // 경고 표시 (AC4: confidenceScore < 0.6)
  const showWarning = confidenceScore !== undefined && confidenceScore < 0.6;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{getChainTypeLabel(chainType)}</CardTitle>
          {confidenceScore !== undefined && (
            <Badge
              variant={getConfidenceBadgeVariant(confidenceScore)}
              className="ml-2"
            >
              신뢰도: {getConfidencePercent(confidenceScore)}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {nodes.length}개 거래 • {chainDepth}단계 깊이
          {totalAmount && ` • 총 ${formatAmount(totalAmount)}`}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 경고 메시지 (AC4) */}
        {showWarning && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">불확실한 체인입니다</p>
              <p className="text-xs mt-1">
                신뢰도가 {getConfidencePercent(confidenceScore!)}로 낮습니다. 검토가
                필요합니다.
              </p>
            </div>
          </div>
        )}

        {/* 체인 노드 목록 (순서대로 표시, AC3) */}
        <ScrollArea className="h-[500px] rounded-md border">
          <div className="p-4 space-y-4">
            {nodes.map((node, index) => (
              <div key={node.id} className="relative">
                {/* 노드 카드 */}
                <div className="flex items-start gap-4">
                  {/* 깊이 표시 */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {index + 1}
                    </div>
                    {index < nodes.length - 1 && (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* 거래 정보 */}
                  <div className="flex-1 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getDirectionIcon(node.depositAmount, node.withdrawalAmount)}
                        <span className="text-sm font-medium">
                          {index === 0
                            ? "시작 거래"
                            : index === nodes.length - 1
                            ? "끝 거래"
                            : `중간 거래 ${index}`}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Depth {index}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">날짜:</span>
                        <span className="ml-2 font-medium">
                          {formatDate(node.transactionDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">금액:</span>
                        <span className="ml-2 font-medium">
                          {formatAmount(
                            node.depositAmount || node.withdrawalAmount
                          )}
                        </span>
                      </div>
                      {node.category && (
                        <div>
                          <span className="text-muted-foreground">분류:</span>
                          <span className="ml-2 font-medium">{node.category}</span>
                        </div>
                      )}
                      {node.creditorName && (
                        <div>
                          <span className="text-muted-foreground">채권자:</span>
                          <span className="ml-2 font-medium">
                            {node.creditorName}
                          </span>
                        </div>
                      )}
                    </div>

                    {node.memo && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">메모:</span>
                        <p className="text-sm mt-1 truncate">{node.memo}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
