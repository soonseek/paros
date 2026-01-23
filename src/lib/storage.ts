/**
 * File Storage Abstraction Layer
 * Supports both S3 and local filesystem storage
 * Uses database settings with fallback to environment variables
 */

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { db } from "~/server/db";
import { SettingsService } from "~/server/services/settings-service";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Cache for storage configuration
let configCache: {
  useS3: boolean;
  lastCheck: number;
} | null = null;

const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Check if S3 is properly configured (from DB or env)
 */
async function isS3Configured(): Promise<boolean> {
  try {
    const settingsService = new SettingsService(db);
    
    // Try to get from database first
    const accessKeyId = await settingsService.getSetting('AWS_ACCESS_KEY_ID');
    const secretAccessKey = await settingsService.getSetting('AWS_SECRET_ACCESS_KEY');
    
    // If found in DB and valid
    if (accessKeyId && secretAccessKey) {
      if (accessKeyId.includes('dummy') || accessKeyId.includes('local')) return false;
      if (secretAccessKey.includes('dummy') || secretAccessKey.includes('local')) return false;
      return true;
    }
    
    // Fallback to environment variables
    const envAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const envSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!envAccessKeyId || !envSecretAccessKey) return false;
    if (envAccessKeyId.includes('dummy') || envAccessKeyId.includes('local')) return false;
    if (envSecretAccessKey.includes('dummy') || envSecretAccessKey.includes('local')) return false;
    
    return true;
  } catch (error) {
    console.error('[Storage] Error checking S3 config:', error);
    return false;
  }
}

/**
 * Get storage configuration with caching
 */
async function getStorageConfig(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (configCache && (now - configCache.lastCheck) < CONFIG_CACHE_TTL) {
    return configCache.useS3;
  }
  
  // Check configuration
  const useS3 = await isS3Configured();
  
  // Update cache
  configCache = {
    useS3,
    lastCheck: now,
  };
  
  if (useS3) {
    console.log('[Storage] Using AWS S3 storage');
  } else {
    console.log('[Storage] Using local filesystem storage');
    // Ensure upload directory exists
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true }).catch(console.error);
  }
  
  return useS3;
}

/**
 * Upload a file to storage (S3 or local filesystem)
 */
export async function uploadFile(
  fileBuffer: Buffer,
  caseId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const timestamp = Date.now();
  const uuid = randomUUID();
  const storageKey = `cases/${caseId}/${timestamp}-${uuid}-${fileName}`;

  const useS3 = await getStorageConfig();

  if (useS3) {
    // Use S3
    const { uploadFileToS3 } = await import('./s3');
    return await uploadFileToS3(fileBuffer, caseId, fileName, mimeType);
  } else {
    // Use local filesystem
    const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey);
    const dirPath = path.dirname(filePath);
    
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, fileBuffer);
    
    console.log(`[Local Storage] File uploaded: ${storageKey}`);
    return storageKey;
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const useS3 = await getStorageConfig();

  if (useS3) {
    // Use S3
    const { deleteFileFromS3 } = await import('./s3');
    return await deleteFileFromS3(storageKey);
  } else {
    // Use local filesystem
    const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey);
    
    try {
      await fs.unlink(filePath);
      console.log(`[Local Storage] File deleted: ${storageKey}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[Local Storage] File not found (already deleted): ${storageKey}`);
      } else {
        console.error('[Local Storage Delete Error]', error);
        throw new Error("파일 삭제 실패");
      }
    }
  }
}

/**
 * Download a file from storage
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const useS3 = await getStorageConfig();

  if (useS3) {
    // Use S3
    const { downloadFileFromS3 } = await import('./s3');
    return await downloadFileFromS3(storageKey);
  } else {
    // Use local filesystem
    const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey);
    
    try {
      const buffer = await fs.readFile(filePath);
      console.log(`[Local Storage] File downloaded: ${storageKey} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error('[Local Storage Download Error]', error);
      throw new Error("파일 다운로드 실패");
    }
  }
}

/**
 * Get the storage backend being used
 */
export async function getStorageBackend(): Promise<'S3' | 'LOCAL'> {
  const useS3 = await getStorageConfig();
  return useS3 ? 'S3' : 'LOCAL';
}

/**
 * Clear storage configuration cache (call after updating settings)
 */
export function clearStorageConfigCache(): void {
  configCache = null;
  console.log('[Storage] Configuration cache cleared');
}
