/**
 * 시스템 설정 서비스
 * 데이터베이스에서 설정을 관리합니다.
 */

import { type PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../lib/encryption';

export type SettingCategory = 'AI' | 'EMAIL' | 'GENERAL';

export interface SystemSettingInput {
  key: string;
  value: string;
  category?: SettingCategory;
  isEncrypted?: boolean;
}

export class SettingsService {
  constructor(private db: PrismaClient) {}

  /**
   * 설정 값 가져오기
   */
  async getSetting(key: string): Promise<string | null> {
    const setting = await this.db.systemSetting.findUnique({
      where: { key },
    });

    if (!setting || !setting.value) {
      return null;
    }

    // 암호화된 값이면 복호화
    if (setting.isEncrypted) {
      try {
        return decrypt(setting.value);
      } catch (error) {
        console.error(`[SettingsService] 복호화 실패: ${key}`, error);
        return null;
      }
    }

    return setting.value;
  }

  /**
   * 설정 값 저장
   */
  async setSetting(
    input: SystemSettingInput,
    userId?: string
  ): Promise<void> {
    const { key, value, category = 'GENERAL', isEncrypted = false } = input;

    // 암호화가 필요한 경우
    const finalValue = isEncrypted ? encrypt(value) : value;

    await this.db.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: finalValue,
        category,
        isEncrypted,
        updatedBy: userId,
      },
      update: {
        value: finalValue,
        category,
        isEncrypted,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 카테고리별 설정 목록 가져오기
   */
  async getSettingsByCategory(category: SettingCategory) {
    const settings = await this.db.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings.map((setting) => ({
      key: setting.key,
      value: setting.isEncrypted && setting.value ? '********' : setting.value,
      category: setting.category,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt,
    }));
  }

  /**
   * 모든 설정 가져오기 (관리자용)
   */
  async getAllSettings() {
    const settings = await this.db.systemSetting.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });

    return settings.map((setting) => ({
      key: setting.key,
      value: setting.isEncrypted && setting.value ? '********' : setting.value,
      category: setting.category,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt,
    }));
  }

  /**
   * 설정 삭제
   */
  async deleteSetting(key: string): Promise<void> {
    await this.db.systemSetting.delete({
      where: { key },
    });
  }

  /**
   * AI 제공자 설정 가져오기 (env 대신 DB 사용)
   */
  async getAIProvider(): Promise<string> {
    const provider = await this.getSetting('AI_PROVIDER');
    return provider || 'upstage'; // 기본값
  }

  /**
   * AI API 키 가져오기
   */
  async getAIApiKey(provider: string): Promise<string | null> {
    switch (provider) {
      case 'upstage':
        return await this.getSetting('UPSTAGE_API_KEY');
      case 'openai':
        return await this.getSetting('OPENAI_API_KEY');
      case 'anthropic':
        return await this.getSetting('ANTHROPIC_API_KEY');
      default:
        return null;
    }
  }
}
