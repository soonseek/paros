import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { api } from "~/utils/api";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  const verifyMutation = api.user.verifyEmail.useMutation();

  useEffect(() => {
    // Get token from URL query parameters
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("유효하지 않은 인증 링크입니다");
      return;
    }

    // Verify email
    verifyMutation
      .mutateAsync({ token })
      .then((result) => {
        if (result.success) {
          setStatus("success");
          setMessage(result.message);
          // Redirect to login page after 3 seconds
          setTimeout(() => {
            router.push("/login");
          }, 3000);
        }
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error.message || "이메일 인증에 실패했습니다");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">이메일 인증</CardTitle>
          <CardDescription>
            {status === "loading" && "이메일 인증을 확인하는 중..."}
            {status === "success" && "인증 완료!"}
            {status === "error" && "인증 실패"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
              <p className="mt-4 text-sm text-gray-600">
                잠시만 기다려주세요...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    {message}
                  </p>
                  <p className="mt-2 text-sm text-green-700">
                    곧 로그인 페이지로 이동합니다...
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{message}</p>
                  <p className="mt-2 text-sm text-red-700">
                    다시 시도하거나 고객센터에 문의해주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mt-4">
              <a
                href="/register"
                className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
              >
                회원가입으로 돌아가기
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
