/**
 * AI 설정 관리
 * 환경 변수와 데이터베이스 설정을 통합 관리합니다.
 */

import { env } from '~/env';
import { db } from '~/server/db';
import { SettingsService } from '~/server/services/settings-service';

export type AIProvider = 'upstage' | 'openai' | 'anthropic';

/**
 * AI 제공자 가져오기 (DB 우선, 환경 변수 대체)
 */
export async function getAIProvider(): Promise<AIProvider> {
  try {
    const service = new SettingsService(db);
    const provider = await service.getSetting('AI_PROVIDER');
    
    if (provider && ['upstage', 'openai', 'anthropic'].includes(provider)) {
      return provider as AIProvider;
    }
  } catch (error) {
    console.warn('[AI Config] DB에서 AI_PROVIDER 가져오기 실패, 환경 변수 사용:', error);
  }
  
  // DB에 없으면 환경 변수 사용
  return env.AI_PROVIDER as AIProvider;
}

/**
 * AI API 키 가져오기 (DB 우선, 환경 변수 대체)
 */
export async function getAIApiKey(provider: AIProvider): Promise<string | null> {
  try {
    const service = new SettingsService(db);
    const key = await service.getAIApiKey(provider);
    
    if (key) {
      return key;
    }
  } catch (error) {
    console.warn(`[AI Config] DB에서 ${provider} API 키 가져오기 실패, 환경 변수 사용:`, error);
  }
  
  // DB에 없으면 환경 변수 사용
  switch (provider) {
    case 'upstage':
      return env.UPSTAGE_API_KEY || null;
    case 'openai':
      return env.OPENAI_API_KEY || null;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY || null;
    default:
      return null;
  }
}

/**
 * AI 설정 검증
 */
export async function validateAIConfig(): Promise<{ valid: boolean; message?: string }> {
  const provider = await getAIProvider();
  const apiKey = await getAIApiKey(provider);
  
  if (!apiKey) {
    return {
      valid: false,
      message: `${provider} API 키가 설정되지 않았습니다. 관리자 설정 페이지에서 API 키를 추가하세요.`,
    };
  }
  
  return { valid: true };
}
