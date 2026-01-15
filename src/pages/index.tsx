import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "~/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // 즉시 리다이렉션 (AuthContext는 sessionStorage에서 복원하므로 바로 사용 가능)
    if (isAuthenticated) {
      void router.push("/dashboard");
    } else {
      void router.push("/login");
    }
  }, [isAuthenticated, router]);

  // 로딩 표시
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">paros</h1>
        <p className="mt-2 text-gray-600">로딩 중...</p>
      </div>
    </div>
  );
}
