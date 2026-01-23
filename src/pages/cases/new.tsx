import { type NextPage } from "next";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/utils/api";
import { useAuth } from "~/contexts/AuthContext";

const createCaseSchema = z.object({
  caseNumber: z.string().optional(), // 사건번호 선택 사항
  debtorName: z.string().min(1, "채무자명은 필수 항목입니다"),
  courtName: z.string().optional(),
  filingDate: z.string().optional(),
});

type CreateCaseForm = z.infer<typeof createCaseSchema>;

const NewCasePage: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const { mutate: createCase, isPending } = api.case.createCase.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Redirect to cases list after successful creation
      void router.push("/cases");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCaseForm>({
    resolver: zodResolver(createCaseSchema),
  });

  const onSubmit = (data: CreateCaseForm) => {
    // Transform filingDate from string to Date object
    const transformedData = {
      ...data,
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
    };

    // Validate filingDate is not in the future
    if (transformedData.filingDate && transformedData.filingDate > new Date()) {
      toast.error("접수일자는 미래일 수 없습니다");
      return;
    }

    createCase(transformedData);
  };

  // Redirect to login if not authenticated
  if (!user) {
    void router.push("/login");
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">새 사건 등록</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Case Number */}
          <div>
            <Label htmlFor="caseNumber">
              사건번호 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="caseNumber"
              type="text"
              placeholder="예: 2023하12345"
              {...register("caseNumber")}
            />
            {errors.caseNumber && (
              <p className="text-red-500 text-sm mt-1">
                {errors.caseNumber.message}
              </p>
            )}
          </div>

          {/* Debtor Name */}
          <div>
            <Label htmlFor="debtorName">
              채무자명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="debtorName"
              type="text"
              placeholder="채무자 이름 입력"
              {...register("debtorName")}
            />
            {errors.debtorName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.debtorName.message}
              </p>
            )}
          </div>

          {/* Court Name */}
          <div>
            <Label htmlFor="courtName">법원명</Label>
            <Input
              id="courtName"
              type="text"
              placeholder="예: 서울회생법원"
              {...register("courtName")}
            />
          </div>

          {/* Filing Date */}
          <div>
            <Label htmlFor="filingDate">접수일자</Label>
            <Input
              id="filingDate"
              type="date"
              {...register("filingDate")}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCasePage;
