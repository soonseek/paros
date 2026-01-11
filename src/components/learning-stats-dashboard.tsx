/**
 * Learning Stats Dashboard Component
 *
 * Story 4.8: Task 8 - 학습 피드백 루프
 *
 * 기능:
 * - 학습 통계 표시 (규칙, 피드백, 오류)
 * - 상위 적용 규칙 목록
 * - 주간 피드백 트렌드 차트
 * - RBAC: ADMIN만 접근 가능
 *
 * @module components/learning-stats-dashboard
 */

import { api } from "~/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { useSession } from "next-auth/react";

/**
 * 학습 통계 대시보드 컴포넌트
 */
export function LearningStatsDashboard() {
  const { data: session } = useSession();

  // ADMIN 권한 체크
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  // 학습 통계 조회
  const { data: stats, isLoading } = api.analytics.getLearningStats.useQuery(
    undefined,
    {
      enabled: isAdmin, // ADMIN만 조회 가능
      refetchInterval: 60000, // 1분마다 자동 갱신
    }
  );

  // 권한 없음 메시지
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            학습 통계는 관리자만 조회할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">학습 통계</h2>
        <p className="text-muted-foreground">
          AI 분류 규칙 학습 현황과 피드백 통계를 확인하세요.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="전체 규칙"
          value={stats.rules.total}
          subtitle={`활성: ${stats.rules.active}`}
          color="blue"
        />
        <StatsCard
          title="전체 피드백"
          value={stats.feedbacks.total}
          subtitle={`최근 30일: ${stats.feedbacks.recent30Days}`}
          color="green"
        />
        <StatsCard
          title="미해결 오류"
          value={stats.errors.unresolved}
          subtitle={`전체: ${stats.errors.total}`}
          color="red"
        />
        <StatsCard
          title="규칙 적용률"
          value={
            stats.rules.topApplied.length > 0
              ? `${Math.round(
                  stats.rules.topApplied.reduce(
                    (sum, rule) => sum + rule.successRate,
                    0
                  ) / stats.rules.topApplied.length
                )}%`
              : "N/A"
          }
          subtitle="평균 성공률"
          color="purple"
        />
      </div>

      {/* 규칙 통계 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>규칙 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">전체 규칙</span>
                <span className="font-semibold">{stats.rules.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">활성 규칙</span>
                <span className="font-semibold text-green-600">
                  {stats.rules.active}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">비활성 규칙</span>
                <span className="font-semibold text-muted-foreground">
                  {stats.rules.inactive}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-semibold">패턴 타입별 분류</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">키워드 기반</span>
                  <Badge variant="secondary">
                    {stats.rules.byPatternType.keyword}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">금액 범위 기반</span>
                  <Badge variant="secondary">
                    {stats.rules.byPatternType.amountRange}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">채권자 기반</span>
                  <Badge variant="secondary">
                    {stats.rules.byPatternType.creditor}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>피드백 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">전체 피드백</span>
                <span className="font-semibold">{stats.feedbacks.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  최근 30일 피드백
                </span>
                <span className="font-semibold text-green-600">
                  {stats.feedbacks.recent30Days}
                </span>
              </div>
            </div>

            {/* 카테고리별 피드백 TOP 5 */}
            {stats.feedbacks.byCategory.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-semibold">
                  카테고리별 피드백 (TOP 5)
                </h4>
                <div className="space-y-2">
                  {stats.feedbacks.byCategory.slice(0, 5).map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{item.category}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 오류 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>분류 오류 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">전체 오류</span>
                <span className="font-semibold">{stats.errors.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">미해결</span>
                <span className="font-semibold text-red-600">
                  {stats.errors.unresolved}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">해결됨</span>
                <span className="font-semibold text-green-600">
                  {stats.errors.resolved}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">오류 유형별 분류</h4>
              <div className="space-y-2">
                {stats.errors.byType.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{get_error_type_label(item.type)}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">심각도별 분류</h4>
              <div className="space-y-2">
                {stats.errors.bySeverity.map((item) => (
                  <div
                    key={item.severity}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{get_severity_label(item.severity)}</span>
                    <Badge
                      variant={
                        item.severity === "HIGH"
                          ? "destructive"
                          : item.severity === "MEDIUM"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 상위 적용 규칙 */}
      {stats.rules.topApplied.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>상위 적용 규칙 (TOP 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-semibold">패턴</th>
                    <th className="pb-2 text-left font-semibold">타입</th>
                    <th className="pb-2 text-left font-semibold">카테고리</th>
                    <th className="pb-2 text-right font-semibold">신뢰도</th>
                    <th className="pb-2 text-right font-semibold">적용 횟수</th>
                    <th className="pb-2 text-right font-semibold">성공률</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rules.topApplied.map((rule) => (
                    <tr key={rule.id} className="border-b">
                      <td className="py-2">{rule.pattern}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{rule.patternType}</Badge>
                      </td>
                      <td className="py-2">{rule.category}</td>
                      <td className="py-2 text-right">
                        {(rule.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="py-2 text-right">{rule.applyCount}</td>
                      <td className="py-2 text-right">
                        <span
                          className={
                            rule.successRate >= 80
                              ? "text-green-600"
                              : rule.successRate >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                          }
                        >
                          {rule.successRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * 통계 카드 컴포넌트
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  color: "blue" | "green" | "red" | "purple";
}

function StatsCard({ title, value, subtitle, color }: StatsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold ${colorClasses[color].split(" ")[1]}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 오류 유형 라벨 변환 헬퍼 함수
 */
function get_error_type_label(type: string): string {
  const labels: Record<string, string> = {
    WRONG_CATEGORY: "잘못된 카테고리",
    MISSED: "누락된 분류",
    LOW_CONFIDENCE: "신뢰도 부정확",
  };
  return labels[type] ?? type;
}

/**
 * 심각도 라벨 변환 헬퍼 함수
 */
function get_severity_label(severity: string): string {
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "보통",
    HIGH: "높음",
  };
  return labels[severity] ?? severity;
}
