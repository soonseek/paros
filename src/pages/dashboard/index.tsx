import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";
import { ThemeToggleButton } from "~/components/theme-toggle";

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, clearAuth, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated || !accessToken) {
      // Redirect to login if not authenticated
      router.push("/login");
    }
  }, [isAuthenticated, accessToken, router]);

  const logoutMutation = api.user.logout.useMutation({
    onSuccess: () => {
      // Clear auth state
      clearAuth();
      // Redirect to login
      router.push("/login");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">paros BMAD</h1>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {user?.name || user?.email || "사용자 메뉴"}
            </Button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push("/dashboard/profile");
                      setShowUserMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    내 프로필
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>대시보드</CardTitle>
            <CardDescription>
              환영합니다! {user?.name || user?.email}님
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <h3 className="font-medium text-blue-900">
                  시작하기
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  파산 사건 관리 시스템에 오신 것을 환영합니다.
                  왼쪽 메뉴에서 원하는 기능을 선택하세요.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div
                  className="rounded-lg border bg-white p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => router.push("/cases")}
                >
                  <h3 className="font-medium">파산 사건</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    사건 등록 및 조회
                  </p>
                  <p className="mt-2 text-xs text-blue-600">클릭하여 이동 →</p>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <h3 className="font-medium">거래내역서</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    파일 업로드 및 분석
                  </p>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <h3 className="font-medium">보고서</h3>
                  <p className="mt-1 text-sm text-gray-600">
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
