/**
 * 암호화 유틸리티
 * 민감한 설정 값(API 키 등)을 암호화/복호화합니다.
 */

import CryptoJS from 'crypto-js';
import { env } from '~/env';

/**
 * 암호화 키 (JWT_SECRET 재사용)
 */
function getEncryptionKey(): string {
  return env.JWT_SECRET;
}

/**
 * 문자열 암호화
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(text, key).toString();
}

/**
 * 문자열 복호화
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
