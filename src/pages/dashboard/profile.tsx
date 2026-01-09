import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
    newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, clearAuth } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Fetch user profile (only when authenticated)
  const { data: profile, isLoading } = api.user.getProfile.useQuery(
    undefined,
    {
      enabled: !!authUser, // Only run query when authUser exists
    }
  );

  // Update name mutation
  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setErrorMessage("");
      // Invalidate query to refetch updated data
      void utils.user.getProfile.invalidate();
    },
    onError: (error) => {
      setErrorMessage(error.message || "프로필 업데이트에 실패했습니다");
      setSuccessMessage("");
    },
  });

  // Change password mutation
  const changePasswordMutation = api.user.changePassword.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setErrorMessage("");
      // Redirect to login after 2 seconds
      setTimeout(() => {
        clearAuth();
        router.push("/login");
      }, 2000);
    },
    onError: (error) => {
      setErrorMessage(error.message || "비밀번호 변경에 실패했습니다");
      setSuccessMessage("");
    },
  });

  // Update email mutation
  const updateEmailMutation = api.user.updateEmail.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setErrorMessage("");
      // Redirect to login after 3 seconds
      setTimeout(() => {
        clearAuth();
        router.push("/login");
      }, 3000);
    },
    onError: (error) => {
      setErrorMessage(error.message || "이메일 변경에 실패했습니다");
      setSuccessMessage("");
    },
  });

  const utils = api.useContext();

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    reset: resetPassword,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmitPassword = (data: ChangePasswordFormData) => {
    setErrorMessage("");
    setSuccessMessage("");
    changePasswordMutation.mutate(data);
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      LAWYER: "변호사",
      PARALEGAL: "법무사",
      ADMIN: "관리자",
      SUPPORT: "지원팀",
    };
    return roleMap[role] || role;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-red-600">프로필을 불러올 수 없습니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Pharos BMAD</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              대시보드
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>내 프로필</CardTitle>
              <CardDescription>사용자 정보를 조회하고 관리하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Read-only Fields */}
              <div className="grid gap-4">
                <div>
                  <Label className="text-gray-600">이메일</Label>
                  <p className="text-sm font-medium">{profile.email}</p>
                </div>
                <div>
                  <Label className="text-gray-600">역할</Label>
                  <p className="text-sm font-medium">
                    {getRoleName(profile.role)}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">계정 상태</Label>
                  <p className="text-sm font-medium">
                    {profile.isActive ? "활성" : "비활성"}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">가입일</Label>
                  <p className="text-sm font-medium">
                    {formatDate(profile.createdAt)}
                  </p>
                </div>
              </div>

              {/* Name Edit Field */}
              <div className="pt-4 border-t">
                <Label htmlFor="name">이름</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="name"
                    defaultValue={profile.name || ""}
                    placeholder="이름을 입력하세요"
                    disabled={updateProfileMutation.isPending}
                  />
                  <Button
                    onClick={() => {
                      const nameInput = document.getElementById(
                        "name"
                      ) as HTMLInputElement;
                      if (nameInput) {
                        updateProfileMutation.mutate({
                          name: nameInput.value || null,
                        });
                      }
                    }}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending
                      ? "저장 중..."
                      : "저장"}
                  </Button>
                </div>
              </div>

              {/* Messages */}
              {successMessage && (
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              )}
              {errorMessage && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Change Card */}
          <Card>
            <CardHeader>
              <CardTitle>이메일 변경</CardTitle>
              <CardDescription>
                이메일을 변경하면 새 이메일로 인증이 필요합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showEmailChange ? (
                <Button
                  variant="outline"
                  onClick={() => setShowEmailChange(true)}
                >
                  이메일 변경하기
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">새 이메일 주소</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="new-email@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={updateEmailMutation.isPending}
                    />
                    <p className="text-sm text-gray-500">
                      현재 이메일: {profile.email}
                    </p>
                  </div>

                  {/* Success/Redirect Message */}
                  {successMessage && successMessage.includes("인증 링크를 발송") && (
                    <div className="rounded-md bg-green-50 p-3">
                      <p className="text-sm text-green-800">{successMessage}</p>
                      <p className="mt-2 text-sm text-green-700">
                        곧 로그인 페이지로 이동합니다...
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setErrorMessage("");
                        setSuccessMessage("");
                        updateEmailMutation.mutate({ newEmail });
                      }}
                      disabled={updateEmailMutation.isPending || !newEmail}
                    >
                      {updateEmailMutation.isPending
                        ? "발송 중..."
                        : "인증 링크 발송"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEmailChange(false);
                        setNewEmail("");
                      }}
                      disabled={updateEmailMutation.isPending}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Password Change Card */}
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>
                비밀번호를 정기적으로 변경하여 계정을 보호하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showPasswordChange ? (
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordChange(true)}
                >
                  비밀번호 변경하기
                </Button>
              ) : (
                <form
                  onSubmit={handleSubmitPassword(onSubmitPassword)}
                  className="space-y-4"
                >
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">현재 비밀번호</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="현재 비밀번호"
                        disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                        {...registerPassword("currentPassword")}
                      />
                    </div>
                    {passwordErrors.currentPassword && (
                      <p className="text-sm text-red-600">
                        {passwordErrors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">새 비밀번호</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="새 비밀번호 (8자 이상)"
                        disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                        {...registerPassword("newPassword")}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                      >
                        {showPassword ? "숨기기" : "표시"}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="text-sm text-red-600">
                        {passwordErrors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="비밀번호 확인"
                      disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                      {...registerPassword("confirmPassword")}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-sm text-red-600">
                        {passwordErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Success/Redirect Message */}
                  {successMessage && successMessage.includes("비밀번호가 변경") && (
                    <div className="rounded-md bg-green-50 p-3">
                      <p className="text-sm text-green-800">{successMessage}</p>
                      <p className="mt-2 text-sm text-green-700">
                        곧 로그인 페이지로 이동합니다...
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                    >
                      {isPasswordSubmitting || changePasswordMutation.isPending
                        ? "변경 중..."
                        : "비밀번호 변경"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordChange(false);
                        resetPassword();
                      }}
                      disabled={isPasswordSubmitting || changePasswordMutation.isPending}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
