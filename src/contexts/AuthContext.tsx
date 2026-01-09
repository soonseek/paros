import { createContext, useContext, useState, useEffect } from "react";
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
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 컴포넌트 마운트时 sessionStorage에서 복원 (XSS 완화, 메모리 우선)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = sessionStorage.getItem("user");
      const storedToken = sessionStorage.getItem("access_token");

      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setAccessToken(storedToken);
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
    }
  };

  const clearAuth = () => {
    setUser(null);
    setAccessToken(null);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("access_token");
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
