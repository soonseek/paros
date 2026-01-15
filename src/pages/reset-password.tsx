import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { api } from "~/utils/api";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [verifying, setVerifying] = useState(true);

  const verifyResetTokenMutation = api.user.verifyResetToken.useMutation({
    onSuccess: () => {
      setTokenValid(true);
      setVerifying(false);
    },
    onError: (error) => {
      setErrorMessage(error.message || "유효하지 않거나 만료된 링크입니다");
      setVerifying(false);
    },
  });

  const resetPasswordMutation = api.user.resetPassword.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setErrorMessage("");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    },
    onError: (error) => {
      setErrorMessage(error.message || "비밀번호 재설정에 실패했습니다");
      setSuccessMessage("");
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Verify token on page load
  useEffect(() => {
    if (token && typeof token === "string") {
      verifyResetTokenMutation.mutate({ token });
    } else if (!token) {
      setVerifying(false);
      setErrorMessage("유효하지 않은 링크입니다");
    }
  }, [token]);

  const onSubmit = (data: ResetPasswordFormData) => {
    if (!token || typeof token !== "string") {
      setErrorMessage("유효하지 않은 링크입니다");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    resetPasswordMutation.mutate({
      token,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });
  };

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-gray-600">링크 검증 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">링크 오류</CardTitle>
            <CardDescription>
              비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            {/* Back to Login Link */}
            <div className="text-center text-sm">
              <a
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                비밀번호 재설정 다시 요청하기
              </a>
              <span className="mx-2 text-gray-500">|</span>
              <a
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                로그인 페이지로
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">비밀번호 재설정</CardTitle>
          <CardDescription>새 비밀번호를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isSubmitting || !!successMessage}
                  {...register("newPassword")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting || !!successMessage}
                >
                  {showPassword ? "숨기기" : "표시"}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-600">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={isSubmitting || !!successMessage}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm text-green-800">{successMessage}</p>
                <p className="mt-2 text-sm text-green-700">
                  곧 로그인 페이지로 이동합니다...
                </p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !!successMessage}
            >
              {isSubmitting ? "재설정 중..." : "비밀번호 재설정"}
            </Button>

            {/* Back to Login Link */}
            <div className="text-center text-sm">
              <a
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                로그인 페이지로 돌아가기
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
