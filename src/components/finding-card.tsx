/**
 * Finding Card Component
 *
 * Story 4.3: 중요 거래 자동 식별
 *
 * 발견사항(Finding)을 표시하는 카드 컴포넌트
 * - 발견사항 유형, 제목, 설명 표시
 * - 심각도(Severity) 배지 표시
 * - 해결 상태 표시
 * - 해결/미해결 토글 기능
 * - 연결된 거래 정보 표시
 */

"use client";

import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
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
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  transaction: Transaction | null;
}

interface FindingCardProps {
  finding: Finding;
  onResolve?: (findingId: string) => void;
  onUnresolve?: (findingId: string) => void;
}

export function FindingCard({ finding, onResolve, onUnresolve }: FindingCardProps) {
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

  // 심각도별 배경색 스타일
  const getSeverityBgColor = () => {
    if (finding.isResolved) return "";

    switch (finding.severity) {
      case "CRITICAL":
        return "bg-red-50 border-red-200";
      case "WARNING":
        return "bg-yellow-50 border-yellow-200";
      case "INFO":
        return "bg-blue-50 border-blue-200";
      default:
        return "";
    }
  };

  return (
    <Card className={`transition-all ${finding.isResolved ? "opacity-60" : ""} ${getSeverityBgColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{finding.title}</CardTitle>
              <SeverityBadge severity={finding.severity} size="sm" />
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
              onClick={handleResolve}
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
              onClick={handleUnresolve}
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

        {/* 연결된 거래 정보 */}
        {finding.transaction && (
          <div className="border rounded-md p-3 bg-gray-50">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
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
  onUpdate?: () => void;
}

export function FindingList({ findings, onUpdate }: FindingListProps) {
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
            onResolve={onUpdate}
            onUnresolve={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
