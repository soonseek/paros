import { useState } from "react";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const requestPasswordResetMutation =
    api.user.requestPasswordReset.useMutation({
      onSuccess: (data) => {
        setSuccessMessage(data.message);
        setErrorMessage("");
      },
      onError: (error) => {
        setErrorMessage(error.message || "비밀번호 재설정 요청에 실패했습니다");
        setSuccessMessage("");
      },
    });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    setErrorMessage("");
    setSuccessMessage("");
    requestPasswordResetMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">비밀번호 찾기</CardTitle>
          <CardDescription>
            등록된 이메일 주소를 입력하면 비밀번호 재설정 링크를
            발송해드립니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                disabled={isSubmitting || !!successMessage}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm text-green-800">{successMessage}</p>
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
              {isSubmitting ? "발송 중..." : "비밀번호 재설정 링크 받기"}
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
