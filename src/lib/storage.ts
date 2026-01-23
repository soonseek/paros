/**
 * File Storage Abstraction Layer
 * Supports both S3 and local filesystem storage
 */

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

// Check if S3 is properly configured
function isS3Configured(): boolean {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  // Check if these are real credentials (not dummy values)
  if (!accessKeyId || !secretAccessKey) return false;
  if (accessKeyId.includes('dummy') || accessKeyId.includes('local')) return false;
  if (secretAccessKey.includes('dummy') || secretAccessKey.includes('local')) return false;
  
  return true;
}

const USE_S3 = isS3Configured();
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Initialize local upload directory
if (!USE_S3) {
  console.log('[Storage] Using local filesystem storage');
  fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true }).catch(console.error);
} else {
  console.log('[Storage] Using AWS S3 storage');
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

  if (USE_S3) {
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
  if (USE_S3) {
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
  if (USE_S3) {
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
export function getStorageBackend(): 'S3' | 'LOCAL' {
  return USE_S3 ? 'S3' : 'LOCAL';
}
