import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "~/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * 대시보드 페이지 - 파산사건 목록으로 리다이렉트
 * 이 앱에서 대시보드 = 파산사건 목록
 */
export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      void router.replace("/login");
    } else {
      // 인증된 사용자는 파산사건 목록으로 리다이렉트
      void router.replace("/cases");
    }
  }, [isAuthenticated, accessToken, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-muted-foreground">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}
