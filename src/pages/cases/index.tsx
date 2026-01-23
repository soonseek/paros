import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Cases List Page
 *
 * Displays paginated list of user's cases with filtering, search, and sorting.
 * Story 2.2: 사건 목록 조회 및 검색
 */

// Case status badge colors
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

// Korean status labels for display
const getStatusLabel = (status: string) => statusLabels[status] || status;

const CasesIndexPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  // Filter state
  const [search, setSearch] = useState("");
  const [courtName, setCourtName] = useState("");
  const [filingDateFrom, setFilingDateFrom] = useState("");
  const [filingDateTo, setFilingDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false); // NEW: 아카이브 필터
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("filingDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch cases with filters
  const { data, isPending, error } = api.case.getCases.useQuery({
    search: search || undefined,
    courtName: courtName || undefined,
    filingDateFrom: filingDateFrom ? new Date(filingDateFrom) : undefined,
    filingDateTo: filingDateTo ? new Date(filingDateTo) : undefined,
    showArchived, // NEW
    page: currentPage,
    sortBy: sortBy as "filingDate" | "caseNumber" | "debtorName" | "status" | "createdAt",
    sortOrder,
  });

  // Redirect to login if not authenticated
  if (!user) {
    void router.push("/login");
    return null;
  }

  // Handle search/filter submit
  const handleFilter = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Handle reset filters
  const handleReset = () => {
    setSearch("");
    setCourtName("");
    setFilingDateFrom("");
    setFilingDateTo("");
    setShowArchived(false); // Reset archived filter
    setCurrentPage(1);
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle order
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Handle row click (navigate to case detail - Story 2.3)
  const handleRowClick = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {showArchived ? "아카이브된 사건" : "사건 목록"}
          </h1>
          <Button onClick={() => router.push("/cases/new")}>
            새 사건 등록
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <Label htmlFor="search">검색</Label>
              <Input
                id="search"
                type="text"
                placeholder="사건번호 또는 채무자명"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Court Name */}
            <div>
              <Label htmlFor="courtName">법원명</Label>
              <Input
                id="courtName"
                type="text"
                placeholder="예: 서울회생법원"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
              />
            </div>

            {/* Filing Date From */}
            <div>
              <Label htmlFor="filingDateFrom">접수일자 (시작)</Label>
              <Input
                id="filingDateFrom"
                type="date"
                value={filingDateFrom}
                onChange={(e) => setFilingDateFrom(e.target.value)}
              />
            </div>

            {/* Filing Date To */}
            <div>
              <Label htmlFor="filingDateTo">접수일자 (종료)</Label>
              <Input
                id="filingDateTo"
                type="date"
                value={filingDateTo}
                onChange={(e) => setFilingDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* NEW: Archive Toggle */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
                aria-label="아카이브된 사건 보기"
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                아카이브된 사건 보기
              </span>
            </label>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 mt-4">
            <Button onClick={handleFilter} disabled={isPending}>
              검색
            </Button>
            <Button onClick={handleReset} variant="outline">
              초기화
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isPending && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">로딩 중...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">사건 목록을 불러오는데 실패했습니다</p>
            <p className="text-sm text-red-500 mt-2">{error.message}</p>
          </div>
        )}

        {/* Cases Table */}
        {data && !isPending && !error && (
          <>
            {data.cases.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600 mb-4">등록된 사건이 없습니다</p>
                <Button onClick={() => router.push("/cases/new")}>
                  새 사건 등록하기
                </Button>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("caseNumber")}
                          >
                            사건번호
                            {sortBy === "caseNumber" && (
                              <span>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                            )}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("debtorName")}
                          >
                            채무자명
                            {sortBy === "debtorName" && (
                              <span>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                            )}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("courtName")}
                          >
                            법원명
                            {sortBy === "courtName" && (
                              <span>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                            )}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("filingDate")}
                          >
                            접수일자
                            {sortBy === "filingDate" && (
                              <span>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                            )}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("status")}
                          >
                            상태
                            {sortBy === "status" && (
                              <span>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.cases.map((caseItem) => (
                          <tr
                            key={caseItem.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleRowClick(caseItem.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {caseItem.caseNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {caseItem.debtorName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {caseItem.courtName || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {caseItem.filingDate
                                ? new Date(caseItem.filingDate).toLocaleDateString("ko-KR")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  statusColors[caseItem.status] || "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {getStatusLabel(caseItem.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-700">
                    총 {data.total}건 중 {(currentPage - 1) * data.pageSize + 1}-
                    {Math.min(currentPage * data.pageSize, data.total)}건 표시
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      disabled={!data.hasPrevPage || isPending}
                    >
                      이전
                    </Button>
                    <span className="flex items-center px-4">
                      페이지 {currentPage} / {data.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!data.hasNextPage || isPending}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CasesIndexPage;
