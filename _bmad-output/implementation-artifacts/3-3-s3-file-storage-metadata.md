# Story 3.3: S3 파일 저장 및 메타데이터 관리

**Status:** ready-for-dev
**Epic:** Epic 3 - 거래내역서 업로드 및 전처리
**Story Key:** 3-3-s3-file-storage-metadata
**Created:** 2026-01-09
**Dependencies:** Epic 1 완료 (사용자 인증), Epic 2 완료 (사건 관리), Story 3.1 완료 (파일 업로드 UI), Story 3.2 완료 (파일 형식 검증)

---

## Story

**As a** 시스템,
**I want** 업로드된 파일을 S3에 저장하고 메타데이터를 DB에 기록해서,
**So that** 파일을 안전하게 저장하고 추적할 수 있다.

---

## Acceptance Criteria

### AC1: S3 파일 업로드

**Given** 파일 형식 검증이 통과된 파일이 있을 때
**When** 파일 업로드가 시작되면
**Then** 파일은 ap-northeast-2 리전의 AWS S3 버킷에 업로드된다
**And** 파일은 고유한 파일명(UUID)으로 저장된다
**And** 원본 파일명은 메타데이터로 보존된다

### AC2: Document 메타데이터 생성

**Given** 파일이 S3에 업로드되었을 때
**When** 업로드가 완료되면
**Then** Document 테이블에 파일 메타데이터가 생성된다
**And** 메타데이터에는 원본 파일명, S3 키, 파일 크기, MIME 타입, 업로드일시, 소유자 ID, 연결된 Case ID가 포함된다

### AC3: 업로드 실패 처리

**Given** 파일 업로드 중에 네트워크 오류가 발생했을 때
**When** 업로드가 실패하면
**Then** "파일 업로드 중 오류가 발생했습니다. 다시 시도해주세요" 에러 메시지가 표시된다
**And** 부분적으로 업로드된 S3 객체는 삭제된다

### AC4: 파일 접근 제어

**Given** 사용자가 자신의 파일이 아닌 다른 사용자의 파일에 접근하려고 할 때
**When** S3 URL을 통해 직접 접근을 시도하면
**Then** presigned URL이 만료되었거나 권한이 없어 접근이 거부된다

**Requirements:** FR-017, NFR-016 (S3 직접 통합), Architecture (AWS S3 ap-northeast-2)

---

## Developer Context & Guardrails

### 🎯 CRITICAL IMPLEMENTATION REQUIREMENTS

**🚨 THIS IS THE MOST IMPORTANT SECTION - READ CAREFULLY!**

### Technical Stack & Versions

- **Framework:** Next.js 14+ (Pages Router) - 프로젝트는 Pages Router 사용
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Prisma ORM 7.2.0+
- **API Layer:** tRPC v11
- **State Management:** TanStack Query v5 (React Query)
- **UI Components:** shadcn/ui (Radix UI)
- **File Storage:** AWS S3 (ap-northeast-2 리전)
- **AWS SDK:** AWS SDK v3 for JavaScript
- **File Upload:** Server-side upload (MVP), 현재 Story 3.2의 Base64 검증 활용

### Architecture Compliance

**1. Prisma Schema - Document Model**

먼저 Document 모델을 Prisma schema에 추가해야 합니다:

```prisma
// prisma/schema.prisma

model Document {
  id          String   @id @default(uuid())
  caseId      String
  originalFileName String
  s3Key       String   @unique // S3 객체 키 (UUID)
  fileSize    Int      // 파일 크기 (bytes)
  mimeType    String   // MIME 타입
  uploadedAt  DateTime @default(now())
  uploaderId  String   // 업로더 사용자 ID

  case        Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  uploader    User     @relation(fields: [uploaderId], references: [id])

  @@index([caseId])
  @@index([uploaderId])
  @@map("documents")
}
```

**2. S3 Configuration**

```typescript
// src/lib/s3.ts (NEW FILE)

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// S3 클라이언트 초기화
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME || "pharos-bmad-files";

/**
 * S3에 파일 업로드
 *
 * @param fileBuffer - 파일 버퍼
 * @param fileName - 원본 파일명
 * @param mimeType - MIME 타입
 * @returns S3 키 (UUID)
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // UUID 생성하여 고유한 파일명으로 사용
  const s3Key = `${randomUUID()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    // 서버 측 암호화 (AES-256)
    ServerSideEncryption: "AES256",
  });

  try {
    await s3Client.send(command);
    return s3Key;
  } catch (error) {
    console.error("[S3 Upload Error]", error);
    throw new Error("S3 파일 업로드 실패");
  }
}

/**
 * S3에서 파일 삭제
 *
 * @param s3Key - S3 객체 키
 */
export async function deleteFileFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error("[S3 Delete Error]", error);
    throw new Error("S3 파일 삭제 실패");
  }
}
```

**3. tRPC Router - File Upload Mutation**

Story 3.2의 file 라우터를 확장하여 업로드 기능을 추가합니다:

```typescript
// src/server/api/routers/file.ts (MODIFY - ADD to existing file.ts)

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import * as pdfParse from "pdf-parse";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { FILE_VALIDATION, validateFileSignature } from "~/lib/file-validation";
import { uploadFileToS3, deleteFileFromS3 } from "~/lib/s3";

// S3 클라이언트는 s3.ts에서 관리

export const fileRouter = createTRPCRouter({
  // ... 기존 validateFileFormat mutation 유지 ...

  /**
   * Upload validated file to S3 and create Document record
   *
   * POST /api/trpc/file.uploadFile
   *
   * Flow:
   * 1. Validate file format (re-use validateFileFormat)
   * 2. Upload to S3 with UUID filename
   * 3. Create Document record in DB
   * 4. Return Document metadata
   *
   * @param caseId - Case ID to link file to
   * @param fileName - Original filename
   * @param fileType - MIME type
   * @param fileSize - File size in bytes
   * @param fileBuffer - Base64-encoded file content
   *
   * @returns Created Document object
   *
   * @throws BAD_REQUEST if validation fails
   * @throws INTERNAL_SERVER_ERROR if S3 upload or DB create fails
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
        fileName: z.string().min(1, "파일명은 필수 항목입니다"),
        fileType: z.string().min(1, "파일 타입은 필수 항목입니다"),
        fileSize: z.number().min(0, "파일 크기는 0 이상이어야 합니다"),
        fileBuffer: z.string().min(1, "파일 내용은 필수 항목입니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { caseId, fileName, fileType, fileSize, fileBuffer } = input;
      const userId = ctx.userId;

      // Step 1: Validate file format (re-use Story 3.2 validation)
      let validatedFileType: string | undefined;
      try {
        // File size validation
        if (fileSize > FILE_VALIDATION.MAX_FILE_SIZE_ENCODED_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `파일 크기는 ${FILE_VALIDATION.MAX_FILE_SIZE_MB}MB 이하여야 합니다`,
          });
        }

        // MIME type validation
        if (
          !FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(
            fileType as (typeof FILE_VALIDATION.ALLOWED_MIME_TYPES)[number]
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "지원되지 않는 파일 형식입니다",
          });
        }

        // File structure parsing
        const buffer = Buffer.from(fileBuffer, "base64");
        const fileExtension = fileName.slice(fileName.lastIndexOf("."));

        if (!validateFileSignature(buffer, fileExtension)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "파일 형식이 확장자와 일치하지 않습니다",
          });
        }

        // Detect file type for metadata
        if (fileExtension.endsWith(".xlsx") || fileExtension.endsWith(".xls")) {
          validatedFileType = "엑셀 파일";
        } else if (fileExtension.endsWith(".csv")) {
          validatedFileType = "CSV 파일";
        } else if (fileExtension.endsWith(".pdf")) {
          validatedFileType = "PDF 파일";
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일 형식 검증 실패",
        });
      }

      // Step 2: Upload to S3
      let s3Key: string;
      try {
        const buffer = Buffer.from(fileBuffer, "base64");
        s3Key = await uploadFileToS3(buffer, fileName, fileType);
      } catch (error) {
        console.error("[S3 Upload Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 업로드 중 오류가 발생했습니다. 다시 시도해주세요",
        });
      }

      // Step 3: Create Document record
      try {
        const document = await ctx.db.document.create({
          data: {
            caseId,
            originalFileName: fileName,
            s3Key,
            fileSize,
            mimeType: fileType,
            uploaderId: userId,
          },
        });

        return {
          success: true,
          document,
          message: `${validatedFileType || "파일"} 업로드 완료`,
        };
      } catch (error) {
        // Rollback: Delete S3 object if DB create fails
        console.error("[DB Create Error]", error);
        try {
          await deleteFileFromS3(s3Key);
        } catch (deleteError) {
          console.error("[S3 Rollback Error]", deleteError);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "파일 메타데이터 저장 실패",
        });
      }
    }),
});
```

**4. Frontend Integration - Modify FileUploadZone**

Story 3.2의 FileUploadZone을 수정하여 업로드 기능을 연결합니다:

```typescript
// src/components/upload-zone.tsx (MODIFY)

import { useCallback, useState, useRef } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Upload, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/utils/api";
import { FILE_VALIDATION } from "~/lib/file-validation";

interface FileUploadProps {
  caseId: string;
  onFilesSelected: (files: File[]) => void;
}

const MAX_FILE_SIZE = FILE_VALIDATION.MAX_FILE_SIZE_BYTES;

/**
 * Helper function to convert File to Base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to convert file to Base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FileUploadZone({ caseId, onFilesSelected }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Story 3.2: Backend validation
  const validateFileMutation = api.file.validateFileFormat.useMutation();

  // Story 3.3: File upload mutation
  const uploadFileMutation = api.file.uploadFile.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.document.originalFileName}: ${data.message}`);
      // Remove uploaded file from selection list
      setSelectedFiles((prev) =>
        prev.filter((f) => f.name !== data.document.originalFileName)
      );
    },
    onError: (err) => {
      toast.error(err.message || "파일 업로드 실패");
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setIsProcessing(true);

      // Handle file size rejections
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((rejection) => {
          const errors = rejection.errors.map((err) => {
            if (err.code === "file-too-large") {
              return `파일 "${rejection.file.name}"이(가) 50MB 제한을 초과했습니다`;
            }
            if (err.code === "file-invalid-type") {
              return `파일 "${rejection.file.name}"은(는) 지원하지 않는 형식입니다`;
            }
            return `파일 "${rejection.file.name}" 업로드 실패`;
          });
          setFileErrors((prev) => [...prev, ...errors]);
          errors.forEach((err) => toast.error(err));
        });
      }

      // Backend validation + Upload (Story 3.2 + Story 3.3)
      const validFiles: File[] = [];

      for (const file of acceptedFiles) {
        try {
          // Story 3.2: Validate file format
          const fileBuffer = await fileToBase64(file);

          // Story 3.3: Upload validated file to S3
          const result = await uploadFileMutation.mutateAsync({
            caseId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileBuffer,
          });

          if (result.success) {
            validFiles.push(file);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "파일 업로드 실패";
          setFileErrors((prev) => [...prev, `${file.name}: ${errorMsg}`]);
          toast.error(`${file.name}: ${errorMsg}`);
        }
      }

      // Check for duplicates
      const newFiles = validFiles.filter(
        (newFile) =>
          !selectedFiles.some(
            (existingFile) =>
              existingFile.name === newFile.name &&
              existingFile.size === newFile.size
          )
      );

      if (newFiles.length < validFiles.length) {
        const duplicateCount = validFiles.length - newFiles.length;
        const dupMsg = `${duplicateCount}개의 중복 파일이 건너뛰기되었습니다`;
        setFileErrors((prev) => [...prev, dupMsg]);
        toast.info(dupMsg);
      }

      setSelectedFiles((prev) => [...prev, ...newFiles]);
      onFilesSelected(newFiles);

      // Clear errors after 5 seconds
      setTimeout(() => {
        setFileErrors([]);
      }, 5000);

      setIsProcessing(false);
    },
    [onFilesSelected, selectedFiles, uploadFileMutation, caseId]
  );

  // ... rest of the component (useDropzone config, UI rendering) ...
}
```

**5. Required Dependencies**

```bash
# AWS SDK v3
npm install @aws-sdk/client-s3

# Prisma schema update
npx prisma generate

# Database migration (after schema change)
npx prisma migrate dev --name add_document_model
```

**6. Environment Variables**

```bash
# .env
DATABASE_URL="postgresql://..."
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="ap-northeast-2"
S3_BUCKET_NAME="pharos-bmad-files"
```

### Project Structure Notes

**File Locations:**
- **NEW:** `src/lib/s3.ts` - S3 upload/download utilities
- **NEW:** `prisma/schema.prisma` - Add Document model
- **MODIFY:** `src/server/api/routers/file.ts` - Add uploadFile mutation
- **MODIFY:** `src/components/upload-zone.tsx` - Integrate upload mutation

**Import Aliases:**
- `~/lib/s3` - S3 utilities
- `~/lib/file-validation` - Validation constants (Story 3.2)
- `~/utils/api` - tRPC utilities

**Naming Conventions:**
- Functions: camelCase with descriptive verbs (`uploadFileToS3`, `deleteFileFromS3`)
- S3 Keys: UUID prefix + original filename (`uuid-filename.xlsx`)
- Database tables: snake_case (`documents`)
- Prisma models: PascalCase (`Document`)

**Existing Patterns (from Story 3.2):**
- Base64 file transmission (already implemented)
- File validation logic (re-use from Story 3.2)
- Error handling with TRPCError
- Toast notifications for user feedback

### References

- **Epic 3 Stories:** `_bmad-output/planning-artifacts/epics.md` (lines 618-646)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
  - File upload: lines 511-523 (multipart/form-data + S3)
  - S3 configuration: lines 699-710 (AWS S3 ap-northeast-2)
  - Environment variables: lines 722-730 (AWS credentials)
  - Data flow: lines 1457-1458 (FileUploader → tRPC → S3 → Prisma)
- **Previous Story:** `_bmad-output/implementation-artifacts/3-2-file-format-validation.md`
  - Base64 conversion logic (lines 446-457)
  - File validation patterns (lines 423-444)
  - Error handling approaches (lines 459-466)

### Dependencies

**Required Stories:**
- ✅ Epic 1: 사용자 인증 (JWT 기반, userId 필수)
- ✅ Epic 2: 파산 사건 관리 (Case 모델, caseId 필수)
- ✅ Story 3.1: 파일 업로드 UI (FileUploadZone 컴포넌트)
- ✅ Story 3.2: 파일 형식 검증 (Base64 변환, 검증 로직 재사용)

**Next Stories (will use Document metadata):**
- Story 3.4: 파일 구조 분석 (Document에서 S3 키 조회)
- Story 3.6: 데이터 추출 (S3에서 파일 다운로드하여 파싱)
- Story 3.7: 업로드 파일 미리보기/삭제 (Document CRUD 연산)

### Testing Standards Summary

**Unit Tests:**
- `uploadFileToS3` helper function
  - Successful upload returns S3 key
  - Upload failure throws error
- `deleteFileFromS3` helper function
  - Successful deletion
  - Delete non-existent file handling
- `uploadFile` mutation
  - Validation failure (invalid file type, size exceeded)
  - Successful upload creates Document record
  - Rollback on DB create failure (S3 object deleted)

**Integration Tests:**
- File upload flow:
  1. File validation (Story 3.2)
  2. S3 upload
  3. Document creation
  4. Error handling at each step
- RBAC: Only case owner can upload files
- Rollback: DB create failure → S3 object cleanup

**Manual Testing Checklist:**
- [ ] 정상 파일 업로드 성공 (엑셀, CSV, PDF)
- [ ] S3 버킷에 파일 저장 확인 (UUID 파일명)
- [ ] Document 테이블에 메타데이터 확인
- [ ] 원본 파일명 보존 확인
- [ ] 파일 크기 초과 시 에러 메시지
- [ ] 네트워크 오류 시 롤백 확인 (S3 객체 삭제)
- [ ] 권한 없는 사용자 업로드 시도 차단 (RBAC)

---

## Implementation Tasks

- [ ] **Task 1: Add Document model to Prisma schema** (AC: 2)
  - [ ] 1.1: Add Document model to `prisma/schema.prisma`
  - [ ] 1.2: Define fields (id, caseId, originalFileName, s3Key, fileSize, mimeType, uploadedAt, uploaderId)
  - [ ] 1.3: Add relations (case, uploader)
  - [ ] 1.4: Add indexes (caseId, uploaderId)
  - [ ] 1.5: Run `npx prisma generate`
  - [ ] 1.6: Run `npx prisma migrate dev --name add_document_model`

- [ ] **Task 2: Create S3 utility functions** (AC: 1)
  - [ ] 2.1: Create `src/lib/s3.ts`
  - [ ] 2.2: Initialize S3Client with AWS credentials
  - [ ] 2.3: Implement `uploadFileToS3` function (UUID filename)
  - [ ] 2.4: Implement `deleteFileFromS3` function (for rollback)
  - [ ] 2.5: Add error handling and logging

- [ ] **Task 3: Implement uploadFile mutation** (AC: 1, 2, 3)
  - [ ] 3.1: Add `uploadFile` procedure to `src/server/api/routers/file.ts`
  - [ ] 3.2: Re-use file validation logic from Story 3.2
  - [ ] 3.3: Call S3 upload with UUID filename
  - [ ] 3.4: Create Document record in database
  - [ ] 3.5: Implement rollback on DB failure (delete S3 object)
  - [ ] 3.6: Add comprehensive error handling

- [ ] **Task 4: Integrate upload into FileUploadZone** (AC: 1, 2)
  - [ ] 4.1: Add `uploadFile` mutation to FileUploadZone
  - [ ] 4.2: Replace validateFileFormat with uploadFile call
  - [ ] 4.3: Show success toast with file metadata
  - [ ] 4.4: Show error toast for upload failures
  - [ ] 4.5: Remove uploaded file from selection list

- [ ] **Task 5: Install and configure dependencies** (AC: 1)
  - [ ] 5.1: Install `@aws-sdk/client-s3`
  - [ ] 5.2: Configure environment variables (.env)
  - [ ] 5.3: Set up AWS credentials
  - [ ] 5.4: Verify S3 bucket exists (ap-northeast-2)

- [ ] **Task 6: Add TypeScript types** (AC: 1, 2)
  - [ ] 6.1: Define S3 upload input schema
  - [ ] 6.2: Define upload response type
  - [ ] 6.3: Ensure proper type annotations for S3 operations

- [ ] **Task 7: Error handling and UX** (AC: 3, 4)
  - [ ] 7.1: Korean error messages for each failure scenario
  - [ ] 7.2: Network error handling with retry suggestion
  - [ ] 7.3: Rollback mechanism (S3 object cleanup)
  - [ ] 7.4: Toast notifications for upload progress

- [ ] **Task 8: Validation** (선택사항)
  - [ ] 8.1: Run TypeScript check: `npm run typecheck`
  - [ ] 8.2: Run ESLint: `npm run lint`
  - [ ] 8.3: Manual browser testing with different file types
  - [ ] 8.4: Verify S3 bucket contains uploaded files
  - [ ] 8.5: Verify Document records in database

---

## 🔍 Code Review Findings

**Review Date:** 2026-01-09
**Review Method:** BMAD Adversarial Code Review
**Reviewer:** Senior Developer Agent
**Status:** ⚠️ **ACTION REQUIRED** - 7 issues found (1 CRITICAL, 3 MEDIUM, 3 LOW)

---

### 🚨 CRITICAL Issues

#### **CRITICAL-1: 환경변수 누락 시 빈 문자열 사용 - S3 인증 실패**

**Location:** [src/lib/s3.ts#L26-L30](src/lib/s3.ts#L26-L30)

**Severity:** CRITICAL
**AC Impact:** AC1 (S3 파일 업로드) - 환경변수 누락 시 암시적 실패

**Problem:**
```typescript
credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
},
```

**Vulnerability Analysis:**
- **빈 문자열 전달:** 환경변수가 없으면 `""` (빈 문자열)이 AWS에 전달됨
- **암시적 실패:** S3 요청 시 AWS SDK가 빈 문자열로 인증 시도 → 타임아웃까지 기다림
- **에러 메시지 불명확:** "InvalidAccessKeyId" 대신 "NetworkingError" 등 다양한 에러 표시

**Impact:**
- **개발 환경 설정 오류 발견 지연:** 환경변수 누락을 즉시 감지하지 못함
- **디버깅 어려움:** 실제 원인(환경변수)과 다른 에러 메시지로 인한 혼동
- **서버리스 환경 문제:** Vercel에서 환경변수 설정 누락 시 배포 후 실패

**Recommended Fix:**
```typescript
// src/lib/s3.ts

// S3 클라이언트 초기화 함수 (환경변수 검증 포함)
function initializeS3Client(): S3Client {
  const region = process.env.AWS_REGION ?? "ap-northeast-2";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.S3_BUCKET_NAME;

  // 환경변수 검증 (개발/프로덕션 모두)
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 환경변수가 누락되었습니다: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY가 필요합니다"
    );
  }

  // 개발 환경에서만 bucketName 검증 (테스트용 모킹 허용)
  if (process.env.NODE_ENV === "production" && !bucketName) {
    throw new Error("S3_BUCKET_NAME 환경변수가 누락되었습니다");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// 모듈 로드 시 초기화 (즉시 실패로 빠른 감지)
const s3Client = initializeS3Client();

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "pharos-bmad-files";

// 테스트용 모킹 헬퍼
export function __TEST__overrideS3Client(mockClient: S3Client) {
  if (process.env.NODE_ENV === "test") {
    (globalThis as any).__S3_CLIENT_OVERRIDE__ = mockClient;
  }
}

function getS3Client(): S3Client {
  return (globalThis as any).__S3_CLIENT_OVERRIDE__ ?? s3Client;
}
```

---

### ⚠️ MEDIUM Issues

#### **MEDIUM-1: RBAC 누락 - Case 접근 권한 검증 없음**

**Location:** [src/server/api/routers/file.ts#L379](src/server/api/routers/file.ts#L379)

**Severity:** MEDIUM
**AC Impact:** AC4 (파일 접근 제어) - 권한 우회 가능

**Problem:**
```typescript
uploadFile: protectedProcedure
  .input(z.object({
    caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
    // ...
  }))
  .mutation(async ({ ctx, input }) => {
    const { caseId, /* ... */ } = input;
    const userId = ctx.userId;

    // ❌ Case 접근 권한 검증 없음
    // 누구나 모든 Case에 파일 업로드 가능
```

**Vulnerability:**
- **권한 우회:** 로그인된 사용자가 모든 Case에 파일 업로드 가능
- **데이터 오염:** 의도치 않은 Case에 파일이 업로드될 수 있음
- **보안 위반:** 사용자A가 사용자B의 사건에 파일 업로드 가능

**Attack Scenario:**
```javascript
// 사용자A가 사용자B의 사건에 파일 업로드 시도
await uploadFileMutation.mutateAsync({
  caseId: "user-b-case-id", // 다른 사용자의 Case
  fileName: "malicious.pdf",
  // ...
});
// → 성공! 사용자B의 사건에 사용자A의 파일이 저장됨
```

**Recommended Fix:**
```typescript
uploadFile: protectedProcedure
  .input(z.object({
    caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
    // ...
  }))
  .mutation(async ({ ctx, input }) => {
    const { caseId, /* ... */ } = input;
    const userId = ctx.userId;

    // ✅ RBAC: Case 접근 권한 검증
    const targetCase = await ctx.db.case.findUnique({
      where: { id: caseId },
      select: { lawyerId: true },
    });

    if (!targetCase) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사건을 찾을 수 없습니다",
      });
    }

    // ✅ Case 담당자 또는 Admin만 업로드 가능
    if (targetCase.lawyerId !== userId && ctx.userRole !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "이 사건에 파일을 업로드할 권한이 없습니다",
      });
    }

    // 파일 업로드 로직 계속...
```

---

#### **MEDIUM-2: 중복 파일 업로드 감지 없음**

**Location:** [src/server/api/routers/file.ts#L379-L460](src/server/api/routers/file.ts#L379-L460)

**Severity:** MEDIUM
**AC Impact:** AC2 (Document 메타데이터 생성) - 중복 저장

**Problem:**
```typescript
uploadFile: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    // 파일 검증, S3 업로드, DB 생성
    // ❌ 동일한 파일을 여러 번 업로드하는지 확인하지 않음

    const document = await ctx.db.document.create({
      data: {
        caseId,
        originalFileName: fileName, // 동일한 파일명 허용
        s3Key, // UUID라 중복되지 않음
        // ...
      },
    });
```

**Impact:**
- **스토리지 낭비:** 동일한 파일이 여러 번 S3에 업로드됨
- **비용 증가:** S3 저장 비용, 전송 비용 발생
- **사용자 경험 저하:** 실수로 같은 파일 여러 번 업로드 가능

**Recommended Fix:**
```typescript
// ✅ 중복 파일 감지 옵션 (선택적 파라미터)
uploadFile: protectedProcedure
  .input(
    z.object({
      caseId: z.string().min(1, "사건 ID는 필수 항목입니다"),
      fileName: z.string().min(1, "파일명은 필수 항목입니다"),
      fileType: z.string().min(1, "파일 타입은 필수 항목입니다"),
      fileSize: z.number().min(0, "파일 크기는 0 이상이어야 합니다"),
      fileBuffer: z.string().min(1, "파일 내용은 필수 항목입니다"),
      allowDuplicates: z.boolean().optional().default(false), // ✅ 새로운 파라미터
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { caseId, fileName, fileSize, allowDuplicates } = input;

    // ✅ 중복 파일 감지 (같은 Case, 같은 파일명, 같은 크기)
    if (!allowDuplicates) {
      const existingDoc = await ctx.db.document.findFirst({
        where: {
          caseId,
          originalFileName: fileName,
          fileSize,
          uploadedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간 이내
          },
        },
      });

      if (existingDoc) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${fileName}" 파일은 이미 업로드되었습니다 (동일한 크기: ${(fileSize / 1024 / 1024).toFixed(2)}MB). 중복 업로드를 원하시면 allowDuplicates를 true로 설정하세요`,
        });
      }
    }

    // 파일 업로드 로직 계속...
```

---

#### **MEDIUM-3: Rollback 실패 시 S3 객체 고아 상태**

**Location:** [src/server/api/routers/file.ts#L445-L455](src/server/api/routers/file.ts#L445-L455)

**Severity:** MEDIUM
**AC Impact:** AC3 (업로드 실패 처리) - 롤백 불완전

**Problem:**
```typescript
} catch (error) {
  console.error("[Document Create Error]", error);

  // Rollback: Delete S3 object if DB creation fails
  try {
    await deleteFileFromS3(s3Key);
    console.log("[Rollback Success] S3 object deleted after DB failure");
  } catch (deleteError) {
    // ❌ Rollback 실패 시 S3 객체가 영구적으로 남음
    console.error("[Rollback Error] Failed to delete S3 object", deleteError);
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "파일 메타데이터 저장 실패",
  });
}
```

**Vulnerability:**
- **고아 S3 객체:** Rollback 실패 시 S3에 파일이 영구적으로 남음
- **스토리지 누출:** 중간에 DB 실패 발생 시마다 S3 공간 낭비
- **수동 정리 필요:** 관리자가 수동으로 고아 객체 제거해야 함

**Recommended Fix:**
```typescript
// ✅ Dead Letter Queue 패턴으로 고아 객체 추적
// 1. Prisma 스키마에 OrphanedS3Object 모델 추가
model OrphanedS3Object {
  id         String   @id @default(uuid())
  s3Key      String   @unique
  caseId     String
  fileName   String
  createdAt  DateTime @default(now())
  cleanedAt  DateTime?
  
  @@index([createdAt])
  @@map("orphaned_s3_objects")
}

// 2. Rollback 실패 시 기록
} catch (error) {
  console.error("[Document Create Error]", error);

  // Rollback 시도
  try {
    await deleteFileFromS3(s3Key);
    console.log("[Rollback Success] S3 object deleted");
  } catch (deleteError) {
    // ✅ Rollback 실패 시 DB에 기록 (나중에 정리 작업 가능)
    console.error("[Rollback Error] S3 object orphaned", deleteError);
    
    try {
      await ctx.db.orphanedS3Object.create({
        data: {
          s3Key,
          caseId,
          fileName,
        },
      });
      console.log("[Orphan Recorded] S3 object recorded for cleanup");
    } catch (recordError) {
      console.error("[Record Error] Failed to record orphaned object", recordError);
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "파일 메타데이터 저장 실패",
  });
}

// 3. 정리 작업용 Cron Job (별도 작업)
// - 매일 OrphanedS3Object 조회 및 S3 삭제 시도
// - 7일 이상 된 객체 삭제
```

---

### 📝 LOW Issues

#### **LOW-1: S3 키 형식 개선 필요**

**Location:** [src/lib/s3.ts#L60](src/lib/s3.ts#L60)

**Severity:** LOW
**AC Impact:** AC1 (S3 파일 업로드) - 추적 용이성

**Problem:**
```typescript
const s3Key = `${randomUUID()}-${fileName}`;
```

**Potential Issues:**
- **UUID-파일명 형식:** `550e8400-e29b-41d4-a716-446655440000-statement.xlsx`
- **파일명에 하이픈 포함:** `my-file-name.xlsx` → `UUID-my-file-name.xlsx`
- **추적 어려움:** S3 콘솔에서 파일명으로 검색 시 UUID 앞부분 때문에 어려움

**Recommended Improvement:**
```typescript
// ✅ 디렉토리 구조로 개선
const s3Key = `cases/${caseId}/${Date.now()}-${randomUUID()}-${fileName}`;

// 결과: cases/123e4567-89ab/1704782400000-550e8400-statement.xlsx
// 장점:
// 1. Case별로 파일 그룹화 (접근 제어, 정리 용이)
// 2. 타임스탬프로 업로드 순서 파악
// 3. 파일명 추적 용이 (UUID 제외하고 검색)

// 또는 파티션 패턴
const s3Key = `${caseId.slice(0, 2)}/${caseId.slice(2, 4)}/${caseId}/${randomUUID()}-${fileName}`;
// 결과: 12/34/5678/550e8400-statement.xlsx
// 장점: S3 파티션 분산으로 성능 향상
```

---

#### **LOW-2: 업로드 진행률 표시 없음**

**Location:** [src/components/upload-zone.tsx#L95-L117](src/components/upload-zone.tsx#L95-L117)

**Severity:** LOW
**AC Impact:** UX 향상

**Problem:**
```typescript
for (const file of acceptedFiles) {
  try {
    const fileBuffer = await fileToBase64(file); // ⏳ 시간 소요
    const result = await uploadFileMutation.mutateAsync({ /* ... */ }); // ⏳ 시간 소요
    
    if (result.success) {
      successfullyUploadedFiles.push(file);
      toast.success(`${file.name}: ${result.message}`);
    }
  } catch (error) {
    // ...
  }
}
```

**Improvement Needed:**
- **진행률 불명확:** 대용량 파일 업로드 시 진행 상황을 알 수 없음
- **순차 처리:** 파일을 순서대로 하나씩 업로드 (병렬 처리 가능)
- **취소 불가:** 업로드 중간에 취소할 수 없음

**Recommended Improvement:**
```typescript
// ✅ 진행률 상태 추가
const [uploadProgress, setUploadProgress] = useState<{
  [fileName: string]: { stage: string; progress: number };
}>({});

// 각 파일별 진행률 추적
for (const file of acceptedFiles) {
  try {
    setUploadProgress((prev) => ({
      ...prev,
      [file.name]: { stage: "변환 중", progress: 10 },
    }));

    const fileBuffer = await fileToBase64(file);

    setUploadProgress((prev) => ({
      ...prev,
      [file.name]: { stage: "검증 중", progress: 30 },
    }));

    const result = await uploadFileMutation.mutateAsync({
      // ...
    });

    setUploadProgress((prev) => ({
      ...prev,
      [file.name]: { stage: "완료", progress: 100 },
    }));

    if (result.success) {
      successfullyUploadedFiles.push(file);
      toast.success(`${file.name}: ${result.message}`);
    }
  } catch (error) {
    setUploadProgress((prev) => ({
      ...prev,
      [file.name]: { stage: "실패", progress: 0 },
    }));
  }
}

// UI에서 진행률 표시
{Object.entries(uploadProgress).map(([fileName, { stage, progress }]) => (
  <div key={fileName} className="flex items-center gap-2">
    <span>{fileName}</span>
    <span>{stage}</span>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
    </div>
  </div>
))}
```

---

#### **LOW-3: 에러 로깅 일관성 부족**

**Location:** Various locations in s3.ts and file.ts

**Severity:** LOW
**AC Impact:** 운영/디버깅 용이성

**Problem:**
```typescript
// s3.ts
console.log(`[S3 Upload Success] File uploaded: ${s3Key}`);
console.error("[S3 Upload Error]", error);

// file.ts
console.error("[Document Create Error]", error);
console.error("[Rollback Error] Failed to delete S3 object", deleteError);
```

**Improvement Needed:**
- **로깅 수준 불일치:** 성공 로그는 `console.log`, 에러는 `console.error`
- **구조화된 로깅 부족:** JSON 형식의 구조화된 로깅 미사용
- **프로덕션 환경 고려:** 로그 집계 서비스(Sentry, DataDog) 연동 고려

**Recommended Improvement:**
```typescript
// ✅ 구조화된 로거 생성 (src/lib/logger.ts)
type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, meta?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...meta,
    };

    // 개발: console, 프로덕션: 로그 서비스
    if (process.env.NODE_ENV === "production") {
      // Sentry, DataDog 등으로 전송
      // sendToLogService(logEntry);
    } else {
      if (level === "error") {
        console.error(JSON.stringify(logEntry));
      } else if (level === "warn") {
        console.warn(JSON.stringify(logEntry));
      } else {
        console.log(JSON.stringify(logEntry));
      }
    }
  }

  info(message: string, meta?: LogContext) {
    this.log("info", message, meta);
  }

  error(message: string, meta?: LogContext) {
    this.log("error", message, meta);
  }
}

// 사용
const logger = new Logger("S3");
logger.info("File uploaded", { s3Key, fileName, fileSize });
logger.error("Upload failed", { s3Key, error: error.message });
```

---

## 📊 Review Summary

| 심각도 | Issue | AC Impact | Location |
|--------|-------|-----------|----------|
| **CRITICAL** | 환경변수 누락 시 빈 문자열 사용 | AC1 | [s3.ts#L26](src/lib/s3.ts#L26) |
| **MEDIUM-1** | RBAC 누락 (Case 접근 권한) | AC4 | [file.ts#L379](src/server/api/routers/file.ts#L379) |
| **MEDIUM-2** | 중복 파일 업로드 감지 없음 | AC2 | [file.ts#L379](src/server/api/routers/file.ts#L379) |
| **MEDIUM-3** | Rollback 실패 시 고아 상태 | AC3 | [file.ts#L445](src/server/api/routers/file.ts#L445) |
| **LOW-1** | S3 키 형식 개선 필요 | AC1 | [s3.ts#L60](src/lib/s3.ts#L60) |
| **LOW-2** | 업로드 진행률 표시 없음 | UX | [upload-zone.tsx#L95](src/components/upload-zone.tsx#L95) |
| **LOW-3** | 에러 로깅 일관성 부족 | 운영 | Multiple locations |

**총 7개 Issue 발견 (1 CRITICAL, 3 MEDIUM, 3 LOW)**

---

## ✅ Action Items

### Priority 1 (CRITICAL - Must Fix Before Release)

- [ ] **ACTION-1:** [s3.ts#L26](src/lib/s3.ts#L26) - 환경변수 누락 시 즉시 실패하도록 초기화 함수 추가 및 검증 로직 구현

### Priority 2 (MEDIUM - Should Fix Soon)

- [ ] **ACTION-2:** [file.ts#L379](src/server/api/routers/file.ts#L379) - RBAC: Case 접근 권한 검증 추가 (lawyerId 또는 ADMIN 확인)
- [ ] **ACTION-3:** [file.ts#L379](src/server/api/routers/file.ts#L379) - 중복 파일 업로드 감지 로직 추가 (24시간 이내 동일 파일명+크기)
- [ ] **ACTION-4:** [file.ts#L445](src/server/api/routers/file.ts#L445) - Rollback 실패 시 OrphanedS3Object 테이블에 기록하는 Dead Letter Queue 패턴 구현

### Priority 3 (LOW - Nice to Have)

- [ ] **ACTION-5:** [s3.ts#L60](src/lib/s3.ts#L60) - S3 키 형식을 `cases/${caseId}/${timestamp}-${uuid}-${filename}`로 개선
- [ ] **ACTION-6:** [upload-zone.tsx#L95](src/components/upload-zone.tsx#L95) - 업로드 진행률 표시 UI 추가 (변환/검증/업로드 단계별 progress)
- [ ] **ACTION-7:** [s3.ts, file.ts] - 구조화된 로거 (src/lib/logger.ts) 도입으로 로깅 일관성 확보

---

**Story Status 변경:** `ready-for-dev` → `in-progress` (CRITICAL 및 MEDIUM issues 수정 필요)

**다음 단계:**
1. CRITICAL issue 수정 (ACTION-1)
2. MEDIUM issues 수정 (ACTION-2, ACTION-3, ACTION-4)
3. 전체 테스트 스위트 실행
4. 재심의 요청

---

## Dev Agent Record

### Agent Model Used

_Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) will implement this story_

### Completion Notes List

_Story completion notes will be added after implementation_

### File List

_Files created/modified during implementation will be listed here_
