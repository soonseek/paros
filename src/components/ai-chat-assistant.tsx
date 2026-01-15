/**
 * AI Chat Assistant Component
 *
 * 거래내역 질의응답을 위한 AI 어시스턴트 채팅 UI
 * 성능 최적화를 위해 별도 컴포넌트로 분리
 */

"use client";

import { useState, useCallback, memo } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { api } from "~/utils/api";
import { toast } from "sonner";

interface Transaction {
  id: string;
  transactionDate: Date;
  depositAmount: string | number | null;
  withdrawalAmount: string | number | null;
  balance: string | number | null;
  memo: string | null;
  category: string | null;
  subcategory: string | null;
}

interface AIChatAssistantProps {
  caseId: string;
  transactions: Transaction[];
}

// React.memo로 불필요한 리렌더링 방지
export const AIChatAssistant = memo<AIChatAssistantProps>(({ caseId, transactions }) => {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");

  const utils = api.useUtils();
  const chatMutation = api.chat.askAssistant.useMutation();

  // useCallback으로 함수 메모이제이션
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || transactions.length === 0) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        caseId,
        message: userMessage,
        model: selectedModel,
        transactions,
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 응답 실패");
      setChatMessages(prev => [...prev, { role: 'assistant', content: "죄송합니다. AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setIsLoading(false);
    }
  }, [chatInput, caseId, selectedModel, transactions, chatMutation]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">AI 어시스턴트</h2>
      <div className="space-y-4">
        {/* 모델 선택 */}
        <div className="flex gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <optgroup label="OpenAI GPT (최신)">
              <option value="gpt-4o">GPT-4o (OpenAI) - 추천</option>
              <option value="gpt-4o-mini">GPT-4o Mini (OpenAI) - 빠름</option>
            </optgroup>
            <optgroup label="OpenAI GPT">
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4">GPT-4</option>
            </optgroup>
            <optgroup label="Anthropic Claude">
              <option value="claude-sonnet-4">Claude Sonnet 4 (Anthropic)</option>
              <option value="claude-haiku">Claude Haiku (Anthropic) - 빠름</option>
            </optgroup>
          </select>
        </div>

        {/* 채팅 메시지 영역 */}
        <div className="bg-gray-50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
          {chatMessages.length === 0 ? (
            <p className="text-sm text-gray-600">
              거래내역에 대해 질문하세요. 예: "가장 큰 입금액은 얼마인가요?", "출금이 가장 많은 달은 언제인가요?"
            </p>
          ) : (
            <div className="space-y-3">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <div className="flex gap-2">
          <Input
            placeholder="거래내역에 대해 질문하세요..."
            className="flex-1"
            disabled={transactions.length === 0 || isLoading}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button
            disabled={transactions.length === 0 || isLoading || !chatInput.trim()}
            onClick={handleSendMessage}
          >
            {isLoading ? '전송 중...' : '전송'}
          </Button>
        </div>
        {transactions.length === 0 && (
          <p className="text-xs text-gray-500">
            * 거래내역이 로드되면 AI 어시스턴트를 사용할 수 있습니다
          </p>
        )}
      </div>
    </Card>
  );
});

AIChatAssistant.displayName = "AIChatAssistant";
