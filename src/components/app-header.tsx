/**
 * 공통 페이지 헤더 컴포넌트
 * 모든 인증된 페이지에서 사용 - 도움말 링크 포함
 */
import { useRouter } from "next/router";
import { useAuth } from "~/contexts/AuthContext";
import { ThemeToggleButton } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { HelpCircle, FileSpreadsheet, ChevronLeft, Menu, LogOut, User, Settings, ClipboardList } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

export function AppHeader({ title = "법무법인 파로스", showBack = false, backHref }: AppHeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const logoutMutation = api.user.logout.useMutation({
    onSuccess: () => {
      toast.success("로그아웃 되었습니다");
      void router.push("/login");
    },
  });

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="border-b bg-white dark:bg-gray-800 dark:border-gray-700 sticky top-0 z-30" data-testid="app-header">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center">
        {/* 좌측 */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {showBack && (
            <button
              onClick={() => backHref ? router.push(backHref) : router.back()}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              data-testid="header-back-button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h1
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate cursor-pointer"
            onClick={() => router.push(isAuthenticated ? "/cases" : "/login")}
            data-testid="header-title"
          >
            {title}
          </h1>
        </div>

        {/* 우측 */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* 도움말 */}
          <button
            onClick={() => router.push("/help")}
            className="p-1.5 sm:p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="도움말"
            data-testid="header-help-link"
          >
            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* 관리자: 거래내역서 템플릿 관리 */}
          {isAuthenticated && (user?.role === "ADMIN" || user?.role === "SUPER") && (
            <button
              onClick={() => router.push("/admin/templates")}
              className="hidden sm:flex p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="거래내역서 템플릿 관리"
              data-testid="header-templates-link"
            >
              <FileSpreadsheet className="h-5 w-5" />
            </button>
          )}

          {/* 관리자: 보정권고 안내사항 템플릿 관리 */}
          {isAuthenticated && (user?.role === "ADMIN" || user?.role === "SUPER") && (
            <button
              onClick={() => router.push("/admin/correction-guide-templates")}
              className="hidden sm:flex p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="보정권고 안내사항 템플릿"
              data-testid="header-correction-guide-link"
            >
              <ClipboardList className="h-5 w-5" />
            </button>
          )}

          {/* 관리자: 설정 */}
          {isAuthenticated && (user?.role === "ADMIN" || user?.role === "SUPER") && (
            <button
              onClick={() => router.push("/admin/settings")}
              className="hidden sm:flex p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="관리자 설정"
              data-testid="header-settings-link"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}

          <ThemeToggleButton />

          {/* 사용자 메뉴 */}
          {isAuthenticated && user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                data-testid="header-user-menu"
              >
                <span className="hidden sm:inline truncate max-w-[120px]">{user.name || user.email}</span>
                <Menu className="h-4 w-4 sm:hidden" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                  {/* 모바일: 이름 표시 */}
                  <div className="sm:hidden px-4 py-2 border-b dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name || user.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); void router.push("/dashboard/profile"); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    data-testid="header-profile-link"
                  >
                    <User className="h-4 w-4" /> 내 프로필
                  </button>
                  {(user.role === "ADMIN" || user.role === "SUPER") && (
                    <>
                      <button
                        onClick={() => { setMenuOpen(false); void router.push("/admin/settings"); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 sm:hidden flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" /> 관리자 설정
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); void router.push("/admin/templates"); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 sm:hidden flex items-center gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" /> 거래내역서 템플릿
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); void router.push("/admin/correction-guide-templates"); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 sm:hidden flex items-center gap-2"
                      >
                        <ClipboardList className="h-4 w-4" /> 보정권고 안내사항
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); void router.push("/help"); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <HelpCircle className="h-4 w-4" /> 도움말
                  </button>
                  <hr className="dark:border-gray-700" />
                  <button
                    onClick={() => { setMenuOpen(false); logoutMutation.mutate(); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    data-testid="header-logout-button"
                  >
                    <LogOut className="h-4 w-4" /> 로그아웃
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
