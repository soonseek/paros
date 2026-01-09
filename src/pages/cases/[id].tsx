import { type NextPage } from "next";
import { useRouter } from "next/router";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Case Detail Page
 *
 * Displays detailed information about a specific case.
 * Story 2.3: 사건 상세 조회
 */

// Case status badge colors (reused from Story 2.2)
const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  PENDING: "대기",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  SUSPENDED: "정지",
  CLOSED: "종료",
};

const getStatusLabel = (status: string) => statusLabels[status] || status;

const CaseDetailPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;

  // Fetch case details
  const { data: caseItem, isPending, error } = api.case.getCaseById.useQuery(
    { id: id as string },
    {
      enabled: !!id, // Only fetch when id is available
    }
  );

  // Redirect to login if not authenticated
  if (!user) {
    void router.push("/auth/login");
    return null;
  }

  // Handle errors and redirect immediately (prevents unnecessary rendering)
  if (error) {
    const errorCode = error.data?.code;

    if (errorCode === "NOT_FOUND") {
      toast.error("사건을 찾을 수 없습니다");
      void router.push("/cases");
      return null;
    } else if (errorCode === "FORBIDDEN") {
      toast.error("권한이 없습니다");
      void router.push("/cases");
      return null;
    } else {
      // Generic error
      toast.error(error.message || "사건을 불러오는데 실패했습니다");
      return null;
    }
  }

  // Loading state
  if (isPending) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // No case data (shouldn't happen due to error handling above)
  if (!caseItem) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with navigation */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">사건 상세</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/cases")}>
              목록으로 돌아가기
            </Button>
            <Button onClick={() => void router.push(`/cases/${id}/edit`)}>
              수정
            </Button>
          </div>
        </div>

        {/* Case Details Card */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Case Number */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">사건번호</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {caseItem.caseNumber}
                </p>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">상태</h3>
                <div className="mt-1">
                  <span
                    className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                      statusColors[caseItem.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {getStatusLabel(caseItem.status)}
                  </span>
                </div>
              </div>

              {/* Filing Date */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">접수일자</h3>
                <p className="mt-1 text-lg text-gray-900">
                  {caseItem.filingDate
                    ? new Date(caseItem.filingDate).toLocaleDateString("ko-KR")
                    : "-"}
                </p>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Debtor Name */}
            <div>
              <h3 className="text-sm font-medium text-gray-500">채무자명</h3>
              <p className="mt-1 text-lg text-gray-900">{caseItem.debtorName}</p>
            </div>

            {/* Court Name */}
            <div>
              <h3 className="text-sm font-medium text-gray-500">법원명</h3>
              <p className="mt-1 text-lg text-gray-900">
                {caseItem.courtName || "-"}
              </p>
            </div>

            <hr className="border-gray-200" />

            {/* Lawyer Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-500">담당 변호사</h3>
              <div className="mt-1">
                <p className="text-lg font-medium text-gray-900">
                  {caseItem.lawyer.name || caseItem.lawyer.email}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {caseItem.lawyer.email}
                </p>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">생성일</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(caseItem.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">수정일</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(caseItem.updatedAt).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Case Notes Section Placeholder */}
        <div className="mt-6">
          <Card className="p-6 bg-gray-50">
            <div className="text-center">
              <p className="text-gray-600 mb-2">
                사건 메모 기능은 Story 2.6에서 구현 예정입니다
              </p>
              <p className="text-sm text-gray-500">
                메모, 문서 첨부 등의 기능이 추가될 예정입니다
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
