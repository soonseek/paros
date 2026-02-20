import { useRouter } from "next/router";
import { useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { AppHeader } from "~/components/app-header";

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      router.push("/login");
    }
  }, [isAuthenticated, accessToken, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader />

      {/* Main Content */}
      <main className="px-3 sm:px-4 py-4 sm:py-8 max-w-7xl mx-auto">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="dark:text-gray-100">대시보드</CardTitle>
            <CardDescription className="dark:text-gray-400">
              환영합니다! {user?.name || user?.email}님
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-300">
                  시작하기
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                  파산 사건 관리 시스템에 오신 것을 환영합니다.
                  왼쪽 메뉴에서 원하는 기능을 선택하세요.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div
                  className="rounded-lg border bg-white dark:bg-gray-700 dark:border-gray-600 p-4 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => router.push("/cases")}
                >
                  <h3 className="font-medium dark:text-gray-100">파산 사건</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    사건 등록 및 조회
                  </p>
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">클릭하여 이동 →</p>
                </div>

                <div className="rounded-lg border bg-white dark:bg-gray-700 dark:border-gray-600 p-4 shadow-sm">
                  <h3 className="font-medium dark:text-gray-100">거래내역서</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    파일 업로드 및 분석
                  </p>
                </div>

                <div className="rounded-lg border bg-white dark:bg-gray-700 dark:border-gray-600 p-4 shadow-sm">
                  <h3 className="font-medium dark:text-gray-100">보고서</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    분석 결과 내보내기
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
