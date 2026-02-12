import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;  // Prisma 모델과 일치 (String? → string | null)
  role: string;  // Role enum from Prisma
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 컴포넌트 마운트시 sessionStorage 또는 쿠키에서 복원 (새로고침 대응)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 먼저 sessionStorage 시도
      let storedUser = sessionStorage.getItem("user");
      let storedToken = sessionStorage.getItem("access_token");

      // sessionStorage에 토큰이 없으면 쿠키에서 시도
      if (!storedToken) {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key) acc[key] = value ?? '';
          return acc;
        }, {} as Record<string, string>);

        if (cookies.accessToken) {
          storedToken = cookies.accessToken;
        }
      }

      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setAccessToken(storedToken);

          // 쿠키에 토큰이 없으면 저장 (새로고침 후 유지)
          // 7일 (604800초)로 연장
          if (!document.cookie.includes('accessToken=')) {
            document.cookie = `accessToken=${storedToken}; path=/; max-age=604800; sameSite=strict`;
          }
        } catch {
          // 파싱 실패시 무시
        }
      }
    }
  }, []);

  const setAuth = (newUser: User, newToken: string) => {
    setUser(newUser);
    setAccessToken(newToken);

    // sessionStorage에 백업 (페이지 새로고침 대응, localStorage보다 안전)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("user", JSON.stringify(newUser));
      sessionStorage.setItem("access_token", newToken);

      // 쿠키에도 저장 (SSE 연결을 위해 - EventSource는 Authorization 헤더를 지원하지 않음)
      // 7일 (604800초)로 연장
      document.cookie = `accessToken=${newToken}; path=/; max-age=604800; sameSite=strict`;
    }
  };

  const clearAuth = () => {
    setUser(null);
    setAccessToken(null);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("access_token");

      // 쿠키도 삭제
      document.cookie = "accessToken=; path=/; max-age=0; sameSite=strict";
    }
  };

  const value = {
    user,
    accessToken,
    setAuth,
    clearAuth,
    isAuthenticated: !!user && !!accessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
