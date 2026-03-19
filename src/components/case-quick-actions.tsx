import {
  ArrowRightLeft,
  Banknote,
  FileSearch,
  SearchCheck,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface CaseQuickActionsProps {
  onLoanTrackingOpen: () => void;
  onAmountFilterOpen: () => void;
  onCounterpartyFilterOpen: () => void;
  onInternalTransferOpen: () => void;
}

const quickActions = [
  {
    key: "loan",
    title: "대출금 사용 소명자료 생성",
    description: "대출 실행 이후 사용 흐름을 빠르게 정리합니다.",
    icon: FileSearch,
    action: "onLoanTrackingOpen" as const,
    testId: "case-loan-tracking-open-button",
  },
  {
    key: "amount",
    title: "금액 이상 입출금건 뽑기",
    description: "기준 금액 이상의 거래만 모아 바로 검토합니다.",
    icon: Banknote,
    action: "onAmountFilterOpen" as const,
    testId: "case-amount-filter-open-button",
  },
  {
    key: "counterparty",
    title: "특정 인물 거래 찾기",
    description: "이름이나 계좌번호로 관련 거래를 좁혀봅니다.",
    icon: SearchCheck,
    action: "onCounterpartyFilterOpen" as const,
    testId: "case-counterparty-filter-open-button",
  },
  {
    key: "internal-transfer",
    title: "내부 계좌이체 연결",
    description: "문서 간 동일 금액 이동을 자동으로 이어봅니다.",
    icon: ArrowRightLeft,
    action: "onInternalTransferOpen" as const,
    testId: "case-internal-transfer-open-button",
  },
];

export function CaseQuickActions({
  onLoanTrackingOpen,
  onAmountFilterOpen,
  onCounterpartyFilterOpen,
  onInternalTransferOpen,
}: CaseQuickActionsProps) {
  const handlers = {
    onLoanTrackingOpen,
    onAmountFilterOpen,
    onCounterpartyFilterOpen,
    onInternalTransferOpen,
  };

  return (
    <Card
      className="h-full border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-sm"
      data-testid="case-quick-actions-card"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl">빠른 실행</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                className="group h-auto min-h-[160px] flex-col items-start justify-between rounded-2xl border-slate-200 bg-white p-5 text-left shadow-sm transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                onClick={handlers[item.action]}
                data-testid={item.testId}
              >
                <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold leading-snug text-slate-900">{item.title}</p>
                  <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}