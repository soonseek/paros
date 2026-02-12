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
  
  // S3 설정
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('ap-northeast-2');
  const [awsS3BucketName, setAwsS3BucketName] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  // 설정 조회
  const { data: aiSettings, refetch: refetchAI } = api.settings.getByCategory.useQuery(
    { category: 'AI' }
  );

  // AI 설정값 로드
  useEffect(() => {
    if (aiSettings) {
      const providerSetting = aiSettings.find((s) => s.key === 'AI_PROVIDER');
      if (providerSetting?.value) {
        setAiProvider(providerSetting.value);
      }
    }
  }, [aiSettings]);

  // S3 설정 조회
  const { data: generalSettings, refetch: refetchGeneral } = api.settings.getByCategory.useQuery(
    { category: 'GENERAL' }
  );

  // S3 설정값 로드
  useEffect(() => {
    if (generalSettings) {
      const awsRegionSetting = generalSettings.find((s) => s.key === 'AWS_REGION');
      if (awsRegionSetting?.value) {
        setAwsRegion(awsRegionSetting.value);
      }
      
      const bucketSetting = generalSettings.find((s) => s.key === 'AWS_S3_BUCKET_NAME');
      if (bucketSetting?.value) {
        setAwsS3BucketName(bucketSetting.value);
      }
    }
  }, [generalSettings]);

  const refetch = () => {
    void refetchAI();
    void refetchGeneral();
  };

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

      // S3 설정 저장
      if (awsAccessKeyId.trim()) {
        await updateSetting.mutateAsync({
          key: 'AWS_ACCESS_KEY_ID',
          value: awsAccessKeyId.trim(),
          category: 'GENERAL',
          isEncrypted: true,
        });
      }

      if (awsSecretAccessKey.trim()) {
        await updateSetting.mutateAsync({
          key: 'AWS_SECRET_ACCESS_KEY',
          value: awsSecretAccessKey.trim(),
          category: 'GENERAL',
          isEncrypted: true,
        });
      }

      if (awsRegion.trim()) {
        await updateSetting.mutateAsync({
          key: 'AWS_REGION',
          value: awsRegion.trim(),
          category: 'GENERAL',
          isEncrypted: false,
        });
      }

      if (awsS3BucketName.trim()) {
        await updateSetting.mutateAsync({
          key: 'AWS_S3_BUCKET_NAME',
          value: awsS3BucketName.trim(),
          category: 'GENERAL',
          isEncrypted: false,
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

          {/* 템플릿 관리 바로가기 */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-200">거래내역서 템플릿 관리</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  은행별 거래내역서 형식을 정의하여 파싱 정확도를 높입니다
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/templates")}
                className="bg-white dark:bg-gray-800"
              >
                템플릿 관리 →
              </Button>
            </div>
          </div>

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

        {/* S3 설정 */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            AWS S3 설정 (파일 저장소)
          </h2>

          {/* AWS Access Key ID */}
          <div className="mb-6">
            <Label htmlFor="aws-access-key" className="mb-2 block">
              AWS Access Key ID
            </Label>
            <Input
              id="aws-access-key"
              type="password"
              value={awsAccessKeyId}
              onChange={(e) => setAwsAccessKeyId(e.target.value)}
              placeholder="빈칸으로 두면 기존 값 유지"
              data-testid="aws-access-key-input"
            />
          </div>

          {/* AWS Secret Access Key */}
          <div className="mb-6">
            <Label htmlFor="aws-secret-key" className="mb-2 block">
              AWS Secret Access Key
            </Label>
            <Input
              id="aws-secret-key"
              type="password"
              value={awsSecretAccessKey}
              onChange={(e) => setAwsSecretAccessKey(e.target.value)}
              placeholder="빈칸으로 두면 기존 값 유지"
              data-testid="aws-secret-key-input"
            />
          </div>

          {/* AWS Region */}
          <div className="mb-6">
            <Label htmlFor="aws-region" className="mb-2 block">
              AWS Region
            </Label>
            <Input
              id="aws-region"
              type="text"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              placeholder="예: ap-northeast-2"
              data-testid="aws-region-input"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              서울: ap-northeast-2, 도쿄: ap-northeast-1
            </p>
          </div>

          {/* S3 Bucket Name */}
          <div className="mb-6">
            <Label htmlFor="s3-bucket" className="mb-2 block">
              S3 Bucket Name
            </Label>
            <Input
              id="s3-bucket"
              type="text"
              value={awsS3BucketName}
              onChange={(e) => setAwsS3BucketName(e.target.value)}
              placeholder="예: paros-uploads"
              data-testid="s3-bucket-input"
            />
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
