/**
 * 관리자 설정 페이지
 * AI API 키 및 시스템 설정 관리
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '~/utils/api';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card } from '~/components/ui/card';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export default function AdminSettings() {
  const router = useRouter();
  const [aiProvider, setAiProvider] = useState('upstage');
  const [upstageApiKey, setUpstageApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 설정 조회
  const { data: settings, refetch } = api.settings.getByCategory.useQuery(
    { category: 'AI' },
    {
      onSuccess: (data) => {
        // 기존 설정값 로드
        const providerSetting = data.find((s) => s.key === 'AI_PROVIDER');
        if (providerSetting?.value) {
          setAiProvider(providerSetting.value);
        }
      },
    }
  );

  // 설정 저장 mutation
  const updateSetting = api.settings.update.useMutation({
    onSuccess: () => {
      toast.success('설정이 저장되었습니다.');
      void refetch();
    },
    onError: (error) => {
      toast.error(`저장 실패: ${error.message}`);
    },
  });

  // 저장 처리
  const handleSave = async () => {
    setIsSaving(true);

    try {
      // AI Provider 저장
      await updateSetting.mutateAsync({
        key: 'AI_PROVIDER',
        value: aiProvider,
        category: 'AI',
        isEncrypted: false,
      });

      // Upstage API Key 저장
      if (upstageApiKey.trim()) {
        await updateSetting.mutateAsync({
          key: 'UPSTAGE_API_KEY',
          value: upstageApiKey.trim(),
          category: 'AI',
          isEncrypted: true,
        });
      }

      // OpenAI API Key 저장
      if (openaiApiKey.trim()) {
        await updateSetting.mutateAsync({
          key: 'OPENAI_API_KEY',
          value: openaiApiKey.trim(),
          category: 'AI',
          isEncrypted: true,
        });
      }

      // Anthropic API Key 저장
      if (anthropicApiKey.trim()) {
        await updateSetting.mutateAsync({
          key: 'ANTHROPIC_API_KEY',
          value: anthropicApiKey.trim(),
          category: 'AI',
          isEncrypted: true,
        });
      }

      toast.success('모든 설정이 저장되었습니다.');
    } catch (error) {
      console.error('설정 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
            data-testid="back-button"
          >
            ← 뒤로 가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            관리자 설정
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            시스템 설정 및 AI API 키를 관리합니다.
          </p>
        </div>

        {/* AI 설정 */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            AI 분류 설정
          </h2>

          {/* AI 제공자 선택 */}
          <div className="mb-6">
            <Label htmlFor="ai-provider" className="mb-2 block">
              AI 제공자
            </Label>
            <Select value={aiProvider} onValueChange={setAiProvider}>
              <SelectTrigger data-testid="ai-provider-select">
                <SelectValue placeholder="AI 제공자 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upstage">Upstage Solar (한국어 최적화)</SelectItem>
                <SelectItem value="openai">OpenAI GPT</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              거래 자동 분류에 사용할 AI 제공자를 선택하세요.
            </p>
          </div>

          {/* Upstage API Key */}
          <div className="mb-6">
            <Label htmlFor="upstage-key" className="mb-2 block">
              Upstage Solar API Key
            </Label>
            <Input
              id="upstage-key"
              type="password"
              value={upstageApiKey}
              onChange={(e) => setUpstageApiKey(e.target.value)}
              placeholder="빈칸으로 두면 기존 값 유지"
              data-testid="upstage-api-key-input"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              <a
                href="https://console.upstage.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Upstage Console
              </a>
              에서 API 키를 발급받을 수 있습니다.
            </p>
          </div>

          {/* OpenAI API Key */}
          <div className="mb-6">
            <Label htmlFor="openai-key" className="mb-2 block">
              OpenAI API Key
            </Label>
            <Input
              id="openai-key"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="빈칸으로 두면 기존 값 유지"
              data-testid="openai-api-key-input"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                OpenAI Platform
              </a>
              에서 API 키를 발급받을 수 있습니다.
            </p>
          </div>

          {/* Anthropic API Key */}
          <div className="mb-6">
            <Label htmlFor="anthropic-key" className="mb-2 block">
              Anthropic Claude API Key
            </Label>
            <Input
              id="anthropic-key"
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder="빈칸으로 두면 기존 값 유지"
              data-testid="anthropic-api-key-input"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Anthropic Console
              </a>
              에서 API 키를 발급받을 수 있습니다.
            </p>
          </div>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            data-testid="cancel-button"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-button"
          >
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
