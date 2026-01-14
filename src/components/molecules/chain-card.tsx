/**
 * Chain Card Component (Story 5.3)
 *
 * 체인 요약을 표시하는 카드 컴포넌트
 *
 * 기능:
 * - 체인 유형별 아이콘 및 색상
 * - 신뢰도 배지 표시 (ConfidenceBadge)
 * - confidenceScore < 0.6 시 경고 메시지
 * - 체인 깊이 및 총 금액 표시
 *
 * @component
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  AlertTriangle,
  Shield,
  CheckCircle2,
} from "lucide-react";

/**
 * 체인 유형 Enum
 */
export enum ChainType {
  LOAN_EXECUTION = "LOAN_EXECUTION",       // 대출 실행: 입금 → 이체 → 담보제공
  DEBT_SETTLEMENT = "DEBT_SETTLEMENT",     // 채무 변제: 변제 → 출처 → 정산
  COLLATERAL_RIGHT = "COLLATERAL_RIGHT",   // 담보권 설정: 설정 → 유입 → 해지
  UPSTREAM = "UPSTREAM",                   // 상류 추적 (Story 5.1)
  DOWNSTREAM = "DOWNSTREAM",               // 하류 추적 (Story 5.2)
}

/**
 * 체인 데이터 인터페이스
 */
export interface ChainData {
  id: string;
  chainType: ChainType;
  chainDepth: number;
  totalAmount: number | null;
  startTx: {
    transactionDate: Date;
    depositAmount: number | null;
    withdrawalAmount: number | null;
    memo: string | null;
  };
  endTx: {
    transactionDate: Date;
    depositAmount: number | null;
    withdrawalAmount: number | null;
    memo: string | null;
  };
  confidenceScore?: number; // 체인 평균 신뢰도 (계산 필요 시)
}

interface ChainCardProps {
  chain: ChainData;
  onClick?: () => void;
  isSelected?: boolean;
}

/**
 * 체인 유형별 메타데이터 반환
 */
function getChainTypeMetadata(chainType: ChainType) {
  switch (chainType) {
    case ChainType.LOAN_EXECUTION:
      return {
        label: "대출 실행",
        description: "대출 실행 체인",
        icon: TrendingUp,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      };
    case ChainType.DEBT_SETTLEMENT:
      return {
        label: "채무 변제",
        description: "채무 변제 체인",
        icon: Shield,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      };
    case ChainType.COLLATERAL_RIGHT:
      return {
        label: "담보권 설정",
        description: "담보권 설정 체인",
        icon: CheckCircle2,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
      };
    case ChainType.UPSTREAM:
      return {
        label: "자금 출처",
        description: "자금 출처 추적",
        icon: ArrowUpCircle,
        color: "text-cyan-600",
        bgColor: "bg-cyan-50",
        borderColor: "border-cyan-200",
      };
    case ChainType.DOWNSTREAM:
      return {
        label: "자금 사용처",
        description: "자금 사용처 추적",
        icon: ArrowDownCircle,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
      };
    default:
      return {
        label: "알 수 없음",
        description: "알 수 없는 체인 유형",
        icon: AlertTriangle,
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
      };
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
 * ChainCard 컴포넌트
 */
export default function ChainCard({
  chain,
  onClick,
  isSelected = false,
}: ChainCardProps) {
  const metadata = getChainTypeMetadata(chain.chainType);
  const Icon = metadata.icon;

  // 신뢰도가 제공된 경우 경고 표시 (AC4: confidenceScore < 0.6)
  const showWarning =
    chain.confidenceScore !== undefined && chain.confidenceScore < 0.6;

  return (
    <Card
      className={`
        cursor-pointer transition-all hover:shadow-md
        ${isSelected ? "ring-2 ring-primary" : ""}
        ${metadata.bgColor} ${metadata.borderColor}
      `}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-5 w-5 ${metadata.color}`} />
            <span>{metadata.label}</span>
            <Badge variant="outline" className="ml-2">
              {chain.chainDepth}단계
            </Badge>
          </CardTitle>
          {chain.confidenceScore !== undefined && (
            <Badge
              variant={getConfidenceBadgeVariant(chain.confidenceScore)}
              className="ml-2"
            >
              {getConfidencePercent(chain.confidenceScore)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 경고 메시지 (AC4) */}
        {showWarning && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              불확실한 체인입니다. 검토가 필요합니다.
            </p>
          </div>
        )}

        {/* 시작 거래 */}
        <div className="rounded-md border bg-background/50 p-3">
          <div className="text-xs text-muted-foreground mb-1">시작 거래</div>
          <div className="flex justify-between text-sm">
            <span>날짜: {formatDate(chain.startTx.transactionDate)}</span>
            <span className="font-medium">
              {formatAmount(chain.startTx.depositAmount || chain.startTx.withdrawalAmount)}
            </span>
          </div>
          {chain.startTx.memo && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {chain.startTx.memo}
            </div>
          )}
        </div>

        {/* 끝 거래 */}
        <div className="rounded-md border bg-background/50 p-3">
          <div className="text-xs text-muted-foreground mb-1">끝 거래</div>
          <div className="flex justify-between text-sm">
            <span>날짜: {formatDate(chain.endTx.transactionDate)}</span>
            <span className="font-medium">
              {formatAmount(chain.endTx.depositAmount || chain.endTx.withdrawalAmount)}
            </span>
          </div>
          {chain.endTx.memo && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {chain.endTx.memo}
            </div>
          )}
        </div>

        {/* 총 금액 */}
        {chain.totalAmount && (
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">총 금액</span>
            <span className="font-semibold">{formatAmount(chain.totalAmount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
