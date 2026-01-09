import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card } from "~/components/ui/card";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";

/**
 * Case Edit Page
 *
 * Allows lawyers to edit case information.
 * Story 2.4: 사건 정보 수정
 */

// Case status labels (reused from Story 2.2, 2.3)
const statusLabels: Record<string, string> = {
  PENDING: "대기",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  SUSPENDED: "정지",
  CLOSED: "종료",
};

// Zod schema for validation
const updateCaseSchema = z.object({
  debtorName: z.string()
    .min(1, "채무자명은 필수 항목입니다")
    .max(50, "채무자명은 50자 이하여야 합니다")
    .regex(/^[가-힣a-zA-Z\s]+$/, "채무자명은 한글 또는 영문만 입력 가능합니다"),
  courtName: z.string()
    .optional()
    .transform(value => value?.trim && value.trim() !== "" ? value.trim() : undefined),
  filingDate: z.string().optional(), // Date input as string
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SUSPENDED", "CLOSED"]),
});

type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

const CaseEditPage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;

  // Fetch current case data
  const { data: caseItem, isPending } = api.case.getCaseById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Update mutation
  const updateMutation = api.case.updateCase.useMutation({
    onSuccess: () => {
      toast.success("사건이 업데이트되었습니다");
      void router.push(`/cases/${id}`);
    },
    onError: (err) => {
      toast.error(err.message || "사건 업데이트에 실패했습니다");
    },
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateCaseInput>({
    resolver: zodResolver(updateCaseSchema),
    defaultValues: {
      debtorName: "",
      courtName: "",
      filingDate: "",
      status: "PENDING",
    },
  });

  // Update form when case data loads
  useEffect(() => {
    if (caseItem) {
      reset({
        debtorName: caseItem.debtorName,
        courtName: caseItem.courtName || "",
        filingDate: caseItem.filingDate
          ? new Date(caseItem.filingDate).toISOString().split('T')[0]
          : "",
        status: caseItem.status,
      });
    }
  }, [caseItem, reset]);

  // Redirect to login if not authenticated
  if (!user) {
    void router.push("/auth/login");
    return null;
  }

  // Loading state
  if (isPending) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // No case data (shouldn't happen due to error handling in getCaseById)
  if (!caseItem) {
    return null;
  }

  const onSubmit = (data: UpdateCaseInput) => {
    updateMutation.mutate({
      id: id as string,
      ...data,
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
    });
  };

  const onCancel = () => {
    if (isDirty) {
      if (confirm("저장하지 않은 변경사항이 있습니다. 정말 취소하시겠습니까?")) {
        void router.push(`/cases/${id}`);
      }
    } else {
      void router.push(`/cases/${id}`);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">사건 정보 수정</h1>
          <p className="text-gray-600 mt-2">사건 기본 정보를 수정합니다</p>
        </div>

        {/* Edit Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Case Number (READONLY) */}
            <div>
              <Label htmlFor="caseNumber">사건번호</Label>
              <Input
                id="caseNumber"
                type="text"
                value={caseItem.caseNumber}
                disabled
                className="bg-gray-100"
              />
              <p className="text-sm text-gray-500 mt-1">사건번호는 수정할 수 없습니다</p>
            </div>

            {/* Debtor Name */}
            <div>
              <Label htmlFor="debtorName">채무자명 *</Label>
              <Input
                id="debtorName"
                type="text"
                {...register("debtorName")}
                placeholder="예: 홍길동"
              />
              {errors.debtorName && (
                <p className="text-sm text-red-600 mt-1">{errors.debtorName.message}</p>
              )}
            </div>

            {/* Court Name */}
            <div>
              <Label htmlFor="courtName">법원명</Label>
              <Input
                id="courtName"
                type="text"
                {...register("courtName")}
                placeholder="예: 서울회생법원"
              />
              {errors.courtName && (
                <p className="text-sm text-red-600 mt-1">{errors.courtName.message}</p>
              )}
            </div>

            {/* Filing Date */}
            <div>
              <Label htmlFor="filingDate">접수일자</Label>
              <Input
                id="filingDate"
                type="date"
                {...register("filingDate")}
              />
              {errors.filingDate && (
                <p className="text-sm text-red-600 mt-1">{errors.filingDate.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">상태 *</Label>
              <select
                id="status"
                aria-label="상태 선택"
                aria-required="true"
                {...register("status")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PENDING">{statusLabels.PENDING}</option>
                <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
                <option value="COMPLETED">{statusLabels.COMPLETED}</option>
                <option value="SUSPENDED">{statusLabels.SUSPENDED}</option>
                <option value="CLOSED">{statusLabels.CLOSED}</option>
              </select>
              {errors.status && (
                <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending || !isDirty}
              >
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={updateMutation.isPending}
              >
                취소
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CaseEditPage;
