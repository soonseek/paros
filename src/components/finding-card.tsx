/**
 * Finding Card Component
 *
 * Story 4.3: 중요 거래 자동 식별
 * Story 6.1: 자동 발견사항 식별 (다중 거래 지원)
 *
 * 발견사항(Finding)을 표시하는 카드 컴포넌트
 * - 발견사항 유형, 제목, 설명 표시
 * - 심각도(Severity) 배지 표시
 * - 해결 상태 표시
 * - 해결/미해결 토글 기능
 * - 연결된 거래 정보 표시
 * - Story 6.1: 다중 거래 ID 및 채권자명 표시
 */

"use client";

import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle, Users } from "lucide-react";
import { useI18n } from "~/lib/i18n/index";
import { SeverityBadge } from "./important-transaction-badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { api } from "~/utils/api";
import { PrioritySelector } from "./atoms/priority-selector";

interface Transaction {
  id: string;
  transactionDate: Date;
  depositAmount: string | null;
  withdrawalAmount: string | null;
  memo: string | null;
}

interface Finding {
  id: string;
  findingType: string;
  title: string;
  description: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  priority: "HIGH" | "MEDIUM" | "LOW" | null; // Story 6.5: 사용자 지정 중요도
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  transaction: Transaction | null;
  // Story 6.1: 다중 거래 지원
  relatedTransactionIds: string[];
  relatedCreditorNames: string | null; // JSON 문자열: ["채권자1", "채권자2"]
}

interface FindingCardProps {
  finding: Finding;
  caseId: string; // Story 6.5: PrioritySelector에 필요
  onResolve?: (findingId: string) => void;
  onUnresolve?: (findingId: string) => void;
  // Story 6.2: 클릭 핸들러 (관련 거래 하이라이트, 상세 모달)
  onClick?: (finding: Finding) => void;
}

export function FindingCard({ finding, caseId, onResolve, onUnresolve, onClick }: FindingCardProps) {
  const { t, formatDate, formatCurrency } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isUnresolving, setIsUnresolving] = useState(false);

  // tRPC mutations
  const resolveMutation = api.findings.resolveFinding.useMutation();
  const unresolveMutation = api.findings.unresolveFinding.useMutation();

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await resolveMutation.mutateAsync({ findingId: finding.id });
      onResolve?.(finding.id);
    } catch (error) {
      console.error("Finding 해결 실패:", error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleUnresolve = async () => {
    setIsUnresolving(true);
    try {
      await unresolveMutation.mutateAsync({ findingId: finding.id });
      onUnresolve?.(finding.id);
    } catch (error) {
      console.error("Finding 미해결 상태 변경 실패:", error);
    } finally {
      setIsUnresolving(false);
    }
  };

  // Story 6.2: 심각도별 색상 스타일 (AC 요구사항 준수)
  const getSeverityBgColor = () => {
    if (finding.isResolved) return "";

    switch (finding.severity) {
      case "CRITICAL":
        return "bg-red-50 border-red-600";
      case "WARNING":
        return "bg-amber-50 border-amber-600";
      case "INFO":
        return "bg-orange-50 border-orange-600";
      default:
        return "";
    }
  };

  // Story 6.2: 클릭 핸들러
  const handleCardClick = () => {
    onClick?.(finding);
  };

  return (
    <Card
      className={`transition-all cursor-pointer hover:shadow-md ${finding.isResolved ? "opacity-60" : ""} ${getSeverityBgColor()}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`발견사항: ${finding.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{finding.title}</CardTitle>
              <SeverityBadge severity={finding.severity} size="sm" />
              {/* Story 6.5: 중요도 선택 컴포넌트 */}
              <div onClick={(e) => e.stopPropagation()}>
                <PrioritySelector
                  findingId={finding.id}
                  currentPriority={finding.priority}
                  onUpdate={() => {
                    // PrioritySelector's onUpdate doesn't pass findingId,
                    // but FindingCard's onResolve expects it
                    onResolve?.(finding.id);
                  }}
                />
              </div>
              {finding.isResolved && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                  aria-label={t("finding.resolved")}
                >
                  <CheckCircle className="w-3 h-3" aria-hidden="true" />
                  {t("finding.resolved")}
                </span>
              )}
            </div>
            <CardDescription className="text-xs">
              {t("finding.type")}: {finding.findingType} •{" "}
              {formatDate(finding.createdAt)}
            </CardDescription>
          </div>

          {/* 해결/미해결 버튼 */}
          {!finding.isResolved ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation(); // Story 6.2: 카드 클릭 이벤트 전파 방지
                handleResolve();
              }}
              disabled={isResolving}
              aria-label={t("finding.resolve")}
            >
              <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
              {t("finding.resolve")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation(); // Story 6.2: 카드 클릭 이벤트 전파 방지
                handleUnresolve();
              }}
              disabled={isUnresolving}
              aria-label={t("finding.unresolve")}
            >
              <XCircle className="w-4 h-4 mr-1" aria-hidden="true" />
              {t("finding.unresolve")}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 설명 */}
        {finding.description && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {finding.description}
          </div>
        )}

        {/* Story 6.1: 관련 채권자명 표시 (다중 거래 Finding) */}
        {finding.relatedCreditorNames && (
          <div className="border rounded-md p-3 bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4" aria-hidden="true" />
              관련 채권자
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                try {
                  const creditors = JSON.parse(finding.relatedCreditorNames) as string[];
                  return creditors.map((creditor, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                    >
                      {creditor}
                    </span>
                  ));
                } catch {
                  return (
                    <span className="text-xs text-gray-500">
                      {finding.relatedCreditorNames}
                    </span>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {/* Story 6.1: 관련 거래 ID 표시 */}
        {finding.relatedTransactionIds && finding.relatedTransactionIds.length > 0 && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">관련 거래:</span> {finding.relatedTransactionIds.length}건
            {finding.relatedTransactionIds.length <= 3 && (
              <span className="ml-2 text-gray-500">
                ({finding.relatedTransactionIds.join(", ")})
              </span>
            )}
            {finding.relatedTransactionIds.length > 3 && (
              <span className="ml-2 text-gray-500">
                (외 {finding.relatedTransactionIds.length - 3}건)
              </span>
            )}
          </div>
        )}

        {/* 연결된 거래 정보 (단일 거래) */}
        {finding.transaction && (
          <div className="border rounded-md p-3 bg-gray-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Story 6.2: 카드 클릭 이벤트 전파 방지
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center justify-between w-full text-left"
              aria-expanded={isExpanded}
              aria-label={`거래 정보 ${isExpanded ? "접기" : "펼치기"}`}
            >
              <span className="text-sm font-medium text-gray-700">
                {t("transaction.table.date")}: {formatDate(finding.transaction.transactionDate)}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
              )}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("transaction.table.memo")}:</span>
                  <span className="font-medium">{finding.transaction.memo ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("transaction.table.deposit")}:</span>
                  <span className="font-medium text-blue-600">
                    {finding.transaction.depositAmount
                      ? formatCurrency(Number(finding.transaction.depositAmount))
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("transaction.table.withdrawal")}:</span>
                  <span className="font-medium text-red-600">
                    {finding.transaction.withdrawalAmount
                      ? formatCurrency(Number(finding.transaction.withdrawalAmount))
                      : "-"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 해결일 표시 */}
        {finding.isResolved && finding.resolvedAt && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            {t("finding.resolvedAt")}: {formatDate(finding.resolvedAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Finding 목록 컴포넌트
 */
interface FindingListProps {
  findings: Finding[];
  caseId: string; // Story 6.5: FindingCard에 caseId 전달 필요
  onUpdate?: () => void;
}

export function FindingList({ findings, caseId, onUpdate }: FindingListProps) {
  const { t } = useI18n();

  if (findings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
        <p className="text-lg font-medium">{t("finding.title")} 없음</p>
        <p className="text-sm">표시할 발견사항이 없습니다.</p>
      </div>
    );
  }

  // 미해결 Finding을 먼저, 심각도 순으로 정렬
  const sortedFindings = [...findings].sort((a, b) => {
    // 1. 해결 여부 (미해결 먼저)
    if (a.isResolved !== b.isResolved) {
      return a.isResolved ? 1 : -1;
    }

    // 2. 심각도 (CRITICAL > WARNING > INFO)
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const severityA = severityOrder[a.severity];
    const severityB = severityOrder[b.severity];

    if (severityA !== severityB) {
      return severityA - severityB;
    }

    // 3. 생성일 (최신순)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {t("finding.title")} ({findings.length})
        </h2>
        <div className="text-sm text-gray-600">
          미해결: {findings.filter((f) => !f.isResolved).length}건
        </div>
      </div>

      <div className="space-y-4">
        {sortedFindings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            caseId={caseId}
            onResolve={onUpdate}
            onUnresolve={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
