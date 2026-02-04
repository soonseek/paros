/**
 * AI Chat Assistant Component
 *
 * 거래내역 질의응답을 위한 AI 어시스턴트 채팅 UI
 * 대출금 추적 분석 및 엑셀 다운로드 기능 포함
 */

"use client";

import { useState, useCallback, memo, useRef, useEffect } from "react";
import { Loader2, Send, Bot, User, Copy, CheckCheck, Sparkles, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api } from "~/utils/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface AIChatAssistantProps {
  caseId: string;
  // transactions 더 이상 필요 없음 - DB에서 직접 조회
}

// 테이블 데이터 인터페이스
interface TableData {
  headers: string[];
  rows: string[][];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tableData?: TableData; // 테이블 데이터 (선택적)
}

// 마크다운 테이블 파싱 함수
function parseMarkdownTable(content: string): TableData | null {
  const lines = content.split('\n');
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable && trimmed === '') {
      break;
    }
  }

  if (tableLines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    return line.split('|')
      .filter((_, i, arr) => i !== 0 && i !== arr.length - 1)
      .map(cell => cell.trim());
  };

  const headers = parseRow(tableLines[0] ?? '');
  // Skip separator line (---|---|---)
  const rows = tableLines.slice(2).map(parseRow);

  if (headers.length === 0 || rows.length === 0) return null;

  return { headers, rows };
}

// 엑셀 다운로드 함수
function downloadAsExcel(tableData: TableData, filename: string = '대출금_추적_결과') {
  const ws = XLSX.utils.aoa_to_sheet([tableData.headers, ...tableData.rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '추적결과');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success('엑셀 파일이 다운로드되었습니다');
}

// React.memo로 불필요한 리렌더링 방지
export const AIChatAssistant = memo<AIChatAssistantProps>(({ caseId }) => {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = api.chat.askAssistant.useMutation();

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // useCallback으로 함수 메모이제이션
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        caseId,
        message: userMessage,
        model: selectedModel,
      });

      // 응답에서 테이블 데이터 파싱
      const tableData = parseMarkdownTable(result.response);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        tableData: tableData ?? undefined,
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 응답 실패");
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "죄송합니다. AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [chatInput, caseId, selectedModel, chatMutation]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleCopy = useCallback((content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      toast.success("메시지가 클립보드에 복사되었습니다");
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }, []);

  // 대출금 추적 관련 프리셋 질문
  const suggestedQuestions = [
    "대출로 보이는 입금건을 찾아줘",
    "가장 큰 입금액의 사용처를 추적해줘",
    "총 입금액과 출금액을 알려줘",
    "최근 거래 내역을 요약해줘"
  ];

  // 대출금 추적 전용 프리셋
  const loanTrackingPresets = [
    {
      label: "대출금 사용처 추적",
      question: "대출로 보이는 입금건을 찾고, 해당 대출금이 어떻게 사용되었는지 소명 가능하도록 사용처를 정리해줘. 입금 시점부터 해당 금액이 모두 소진되는 시점까지의 출금 내역을 테이블로 보여줘. 각 거래가 어느 거래내역서(파일)에서 발생했는지도 명시해줘.",
    },
    {
      label: "자금 이동 경로 추적",
      question: "여러 거래내역서 간의 자금 이동을 추적해줘. 한 계좌에서 다른 계좌로 이체된 금액이 있다면, 그 경로와 최종 사용처를 파악해서 테이블로 정리해줘.",
    },
    {
      label: "특정 금액 추적",
      question: "입금된 금액 중 가장 큰 금액을 찾아서, 해당 금액이 어떻게 사용되었는지 추적해줘. 누적 출금액이 해당 입금액을 초과하는 시점까지의 내역을 테이블로 보여줘.",
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 ring-4 ring-primary/5">
              <Bot className="size-7 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                AI 어시스턴트
                <Sparkles className="size-5 text-primary animate-pulse" />
              </CardTitle>
              <CardDescription className="text-base mt-1">
                거래내역에 대해 질문하고 인사이트를 얻으세요
              </CardDescription>
            </div>
          </div>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o (추천)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
              <SelectItem value="claude-haiku">Claude Haiku</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* 채팅 메시지 영역 */}
        <div className="h-[400px] overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="text-center space-y-2">
                <div className="p-4 rounded-full bg-muted inline-flex">
                  <Bot className="size-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  아래 추천 질문을 클릭하거나 직접 질문해보세요
                </p>
              </div>

              {/* 대출금 추적 전용 프리셋과 일반 추천 질문 */}
              <div className="w-full max-w-lg space-y-4">
                  {/* 대출금 추적 전용 프리셋 */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">
                      📊 대출금 추적 분석
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {loanTrackingPresets.map((preset, idx) => (
                        <button
                          key={`loan-${idx}`}
                          onClick={() => {
                            setChatInput(preset.question);
                            inputRef.current?.focus();
                          }}
                          className="text-left p-3 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors text-sm font-medium text-primary"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 일반 추천 질문 */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      추천 질문
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedQuestions.map((question, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setChatInput(question);
                            inputRef.current?.focus();
                          }}
                          className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-sm"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          ) : (
            <>
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-3 slide-up ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 mt-1 p-2 rounded-lg bg-primary/10 size-fit">
                      <Bot className="size-4 text-primary" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col gap-1 max-w-[80%] ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className={`relative group rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted border border-border text-foreground'
                    }`}>
                      {/* 텍스트 내용 (테이블 제외) */}
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.role === 'assistant' && msg.tableData
                          ? msg.content.split(/\|.*\|/s)[0]?.trim()
                          : msg.content}
                      </div>
                      
                      {/* 테이블 렌더링 */}
                      {msg.role === 'assistant' && msg.tableData && (
                        <div className="mt-4 space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="min-w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  {msg.tableData.headers.map((header, hIdx) => (
                                    <th key={hIdx} className="px-3 py-2 text-left font-semibold border-b">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.tableData.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="px-3 py-2 border-b border-border/50">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* 엑셀 다운로드 버튼 */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => downloadAsExcel(msg.tableData!, '대출금_추적_결과')}
                          >
                            <FileSpreadsheet className="size-4" />
                            엑셀로 다운로드
                          </Button>
                        </div>
                      )}
                      
                      {msg.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border shadow-sm"
                          onClick={() => handleCopy(msg.content, idx)}
                        >
                          {copiedIndex === idx ? (
                            <CheckCheck className="size-3 text-success" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground px-1">
                      {msg.timestamp.toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>

                  {msg.role === 'user' && (
                    <div className="shrink-0 mt-1 p-2 rounded-lg bg-primary/10 size-fit">
                      <User className="size-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start slide-up">
                  <div className="shrink-0 mt-1 p-2 rounded-lg bg-primary/10 size-fit">
                    <Bot className="size-4 text-primary" />
                  </div>
                  <div className="bg-muted border border-border rounded-lg px-4 py-3">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 입력 영역 */}
        <div className="border-t bg-muted/20 p-6">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              placeholder="거래내역에 대해 질문하세요..."
              className="flex-1 h-12 text-base"
              disabled={isLoading}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={500}
            />
            <Button
              disabled={isLoading || !chatInput.trim()}
              onClick={handleSendMessage}
              size="lg"
              className="shrink-0 px-6"
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
              <span className="ml-2 font-semibold">전송</span>
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium">
              {chatInput.length > 0 && `${chatInput.length}/500자`}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 text-xs bg-muted border border-border rounded">Enter</kbd>
              <span>로 전송</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AIChatAssistant.displayName = "AIChatAssistant";
