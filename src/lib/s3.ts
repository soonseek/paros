import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import { SettingsService } from "~/server/services/settings-service";

/**
 * S3 Configuration and Utility Functions
 *
 * Provides functions for uploading and deleting files from AWS S3.
 * All files are stored with AES-256 server-side encryption.
 *
 * Configuration Priority:
 * 1. Database settings (from admin panel)
 * 2. Environment variables (fallback)
 */

/**
 * Get S3 configuration from database or environment
 */
async function getS3Config() {
  try {
    const settingsService = new SettingsService(db);
    
    // Try database first
    const accessKeyId = await settingsService.getSetting('AWS_ACCESS_KEY_ID');
    const secretAccessKey = await settingsService.getSetting('AWS_SECRET_ACCESS_KEY');
    const region = await settingsService.getSetting('AWS_REGION');
    const bucketName = await settingsService.getSetting('AWS_S3_BUCKET_NAME');
    
    // If all required settings found in DB, use them
    if (accessKeyId && secretAccessKey) {
      return {
        accessKeyId,
        secretAccessKey,
        region: region || process.env.AWS_REGION || 'ap-northeast-2',
        bucketName: bucketName || process.env.AWS_S3_BUCKET_NAME || 'paros-bmad-files',
      };
    }
  } catch (error) {
    console.warn('[S3] Failed to get config from database, using env vars:', error);
  }
  
  // Fallback to environment variables
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-northeast-2',
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'paros-bmad-files',
  };
}

/**
 * Initialize and validate S3 client with environment variable validation
 *
 * @throws Error if required AWS credentials are missing
 * @returns Configured S3Client instance
 */
async function initializeS3Client(): Promise<S3Client> {
  const config = await getS3Config();
  
  const { accessKeyId, secretAccessKey, region } = config;

  // CRITICAL-1 FIX: Validate required environment variables (fail fast)
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 환경변수가 누락되었습니다: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY가 필요합니다"
    );
  }

  console.log(`[S3] Initializing with bucket: ${config.bucketName}`);

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Lazy initialization - only create client when needed
let s3Client: S3Client | null = null;
let s3BucketName: string | null = null;

async function getS3Client(): Promise<S3Client> {
  if (!s3Client) {
    s3Client = await initializeS3Client();
  }
  return s3Client;
}

async function getS3Bucket(): Promise<string> {
  if (!s3BucketName) {
    const config = await getS3Config();
    s3BucketName = config.bucketName;
  }
  return s3BucketName;
}

/**
 * Clear S3 client cache (call after updating settings)
 */
export function clearS3Cache(): void {
  s3Client = null;
  s3BucketName = null;
  console.log('[S3] Client cache cleared');
}

/**
 * Upload a file to S3 with improved directory structure
 *
 * LOW-1 FIX: Uses case-based directory structure for better organization
 * Format: cases/{caseId}/{timestamp}-{uuid}-{filename}
 *
 * @param fileBuffer - Buffer containing the file content
 * @param caseId - Case ID for directory grouping
 * @param fileName - Original filename
 * @param mimeType - MIME type of the file
 * @returns S3 object key with directory structure
 * @throws Error if upload fails
 *
 * @example
 * const s3Key = await uploadFileToS3(buffer, "case-123", "statement.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
 * // Returns: "cases/case-123/1704782400000-550e8400-statement.xlsx"
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  caseId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  // LOW-1 FIX: Improved directory structure (cases/{caseId}/{timestamp}-{uuid}-{filename})
  const timestamp = Date.now();
  const uuid = randomUUID();
  const s3Key = `cases/${caseId}/${timestamp}-${uuid}-${fileName}`;

  const bucket = await getS3Bucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    ServerSideEncryption: "AES256", // Server-side encryption
  });

  try {
    const client = await getS3Client();
    await client.send(command);
    console.log(`[S3 Upload Success] File uploaded to ${bucket}: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error("[S3 Upload Error - Details]", error);
    // Extract actual error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as { Code?: string }).Code || "Unknown";
    console.error(`[S3 Error] Code: ${errorCode}, Message: ${errorMessage}`);
    throw new Error(`S3 업로드 실패: ${errorMessage} (Code: ${errorCode})`);
  }
}

/**
 * Delete a file from S3
 *
 * @param s3Key - S3 object key to delete
 * @throws Error if deletion fails
 *
 * @example
 * await deleteFileFromS3("550e8400-e29b-41d4-a716-446655440000-statement.xlsx");
 */
export async function deleteFileFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  try {
    await getS3Client().send(command);
    console.log(`[S3 Delete Success] File deleted: ${s3Key}`);
  } catch (error) {
    console.error("[S3 Delete Error]", error);
    throw new Error("S3 파일 삭제 실패");
  }
}

/**
 * Download a file from S3
 *
 * Story 3.4: Used for downloading uploaded files for structure analysis.
 * Handles streaming response and converts to Buffer for processing.
 *
 * @param s3Key - S3 object key to download
 * @returns Buffer containing the file content
 * @throws Error if download fails
 *
 * @example
 * const buffer = await downloadFileFromS3("cases/case-123/1704782400000-550e8400-statement.xlsx");
 */
export async function downloadFileFromS3(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  try {
    const response = await getS3Client().send(command);

    // Handle streaming response and convert to Buffer
    if (!response.Body) {
      throw new Error("S3 응답 본문이 비어있습니다");
    }

    // Convert stream to Buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as NodeJS.ReadableStream;

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    console.log(`[S3 Download Success] File downloaded: ${s3Key} (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error("[S3 Download Error]", error);
    throw new Error("S3 파일 다운로드 실패");
  }
}
