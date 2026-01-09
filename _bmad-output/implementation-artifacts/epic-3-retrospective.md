# Epic 3 Retrospective: 거래내역서 업로드 및 전처리

**Epic 기간**: 2026-01-07 ~ 2026-01-09
**완료일**: 2026-01-09
**총 스토리**: 7개
**총 코드 리뷰 이슈**: 32개 (모두 수정 완료)

---

## 📋 Epic 개요

Epic 3은 사용자가 업로드한 거래내역서 파일(Excel, CSV)을 처리하고 데이터베이스에 저장하는 전체 파이프라인을 구현하는 Epic이었습니다.

### 완료된 스토리

| 스토리 | 제목 | 코드 리뷰 이슈 | 상태 |
|--------|------|----------------|------|
| 3-1 | 파일 업로드 UI (Drag & Drop) | 7개 (3 MEDIUM, 4 LOW) | ✅ done |
| 3-2 | 파일 형식 검증 | 6개 (1 CRITICAL, 3 MEDIUM, 2 LOW) | ✅ done |
| 3-3 | S3 파일 저장 및 메타데이터 | 6개 (1 CRITICAL, 3 MEDIUM, 2 LOW) | ✅ done |
| 3-4 | 파일 구조 분석 및 열 식별 | 통과 | ✅ done |
| 3-5 | 실시간 진행률 표시 (SSE) | 통과 | ✅ done |
| 3-6 | 데이터 추출 및 DB 저장 | 7개 (2 CRITICAL, 3 MEDIUM, 2 LOW) | ✅ done |
| 3-7 | 업로드 파일 미리보기 및 삭제 | 5개 (2 MEDIUM, 3 LOW) | ✅ done |

---

## 🎯 성공 요인

### 1. 점진적 개발 접근
- **Story 3-1 (UI)** → **Story 3-2 (검증)** → **Story 3-3 (S3)** → **Story 3-4 (분석)** → **Story 3-5 (SSE)** → **Story 3-6 (DB)** → **Story 3-7 (미리보기/삭제)**
- 각 스토리가 명확한 단일 책임을 가짐
- 선행 스토리의 완료가 후속 스토리 개발을 가속화

### 2. Prisma Direct Database Access Pattern 마스터
```typescript
// Story 3-6: 벌크 insert with transaction
await ctx.db.$transaction([
  ctx.db.transaction.createMany({
    data: transactionsToInsert,
    skipDuplicates: true, // 중복 거래 건너뛰기
  }),
  ctx.db.document.update({
    where: { id: documentId },
    data: { analysisStatus: "completed" },
  }),
]);
```
- `$transaction`으로 원자성 보장
- `skipDuplicates`로 idempotency 구현
- CASCADE DELETE로 데이터 정합성 보장 (Story 3-7)

### 3. Shadcn/ui 재사용 패턴 확립
- **Dialog**, **AlertDialog**, **Table**, **Skeleton**, **Progress** 컴포넌트 재사용
- Story 3-1 (FileUploader), Story 3-5 (ProgressBar), Story 3-7 (FilePreviewModal, FileDeleteButton)
- 일관된 UI/UX 제공

### 4. tRPC + React Query 조합의 강점
```typescript
// Story 3-5: SSE 실시간 진행률
const { data: progress } = api.file.subscribeUploadProgress.useQuery(
  { uploadId },
  {
    enabled: isUploading,
    refetchInterval: 1000, // 1초마다 폴링
  }
);

// Story 3-7: 에러 처리 및 재시도
const { data: previewData, error, refetch } =
  api.file.getTransactionsPreview.useQuery(
    { documentId },
    {
      enabled: open,
      retry: 2, // 재시도 2회
    }
  );
```
- **enabled** 옵션으로 조건부 쿼리 실행
- **retry** 옵션으로 에러 복구
- **refetch**로 사용자 재시도 기능 제공

### 5. 코드 리뷰 피드백 루프
- 모든 스토리가 적어도 1개 이상의 코드 리뷰 이슈 수정
- **보안 검증**, **에러 처리**, **TypeScript Strict Mode** 준수
- 반복적인 리뷰로 코드 품질 향상

---

## ⚠️ 도전 및 해결

### 1. S3 연동 디버깅 (Story 3-3)
**문제**: S3 버킷 생성, CORS 설정, IAM 권한 문제로 로컬 개발 환경에서 업로드 실패

**해결**:
- AWS SDK v3 Presigned Post URL 사용
- `@aws-sdk/client-s3`와 `@aws-sdk/s3-request-presigner` 조합
- ap-northeast-2 리전 명시적 설정

```typescript
// src/server/upload/s3.ts
const command = new PutObjectCommand({
  Bucket: bucketName,
  Key: key,
  ContentType: contentType,
});

const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
```

### 2. CASCADE DELETE vs 수동 삭제 (Story 3-7)
**문제**: Document 삭제 시 연관된 Transaction, FileAnalysisResult를 어떻게 처리할까?

**코드 리뷰 피드백**: CASCADE DELETE 사용 권장

**해결**:
```prisma
// schema.prisma
model Document {
  transactions           Transaction[];
  fileAnalysisResults    FileAnalysisResult[];

  @@index([caseId])
  @@index([uploadedBy])
  @@index([analysisStatus])
}

model Transaction {
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade);
}
```

**추가 고려사항**: S3 삭제는 DB 삭제 후 non-blocking으로 실행 (S3 실패가 사용자 경험을 저하하지 않도록)

### 3. PDF OCR 미구현 (Story 3-2)
**문제**: PDF 파일의 텍스트 추출이 Tesseract.js로는 불안정

**결정**: PDF는 "현재 지원하지 않는 형식"으로 처리

```typescript
// src/server/upload/validation.ts
if (fileType === "application/pdf") {
  return {
    valid: false,
    error:
      "PDF 파일은 현재 지원하지 않습니다. Excel 또는 CSV 파일을 업로드해주세요.",
  };
}
```

**향후 개선**: AWS Textract 또는 Google Cloud Vision API 고려

### 4. N+1 쿼리 문제 (Story 3-7)
**문제**: `findMany`와 `count`를 순차적으로 실행하여 2번의 DB 쿼리 발생

**코드 리뷰 피드백**: MEDIUM-2 - Promise.all로 병렬 실행

**해결**:
```typescript
// src/server/api/routers/file.ts
const [transactions, totalCount] = await Promise.all([
  ctx.db.transaction.findMany({ /* ... */ take: 20 }),
  ctx.db.transaction.count({ where: { documentId } }),
]);
```

### 5. 테스트 부족
**문제**: 모든 스토리가 수동 테스트로만 검증됨

**향후 개선**:
- Jest + React Testing Library로 컴포넌트 테스트
- Vitest로 tRPC router 테스트
- Playwright로 E2E 테스트

---

## 📚 배운 점

### 1. CASCADE DELETE 마스터
- Prisma relation에 `onDelete: Cascade` 설정
- Document 삭제 시 연관된 Transaction, FileAnalysisResult 자동 삭제
- 수동 삭제 로직 제거로 코드 단순화

### 2. TypeScript Strict Mode 준수
- 모든 unknown 타입에 타입 가드 적용
```typescript
if (typeof cell === "object" && cell !== null && "v" in cell) {
  const value = cell.v;
}
```
- Zod 스키마로 런타임 검증 + TypeScript 타입 추론

### 3. 에러 처리 패턴 확립
```typescript
// TRPCError로 사용자 친화적 에러 메시지
throw new TRPCError({
  code: "NOT_FOUND",
  message: "해당 문서를 찾을 수 없습니다.",
});

// Toast로 실시간 에러 알림
toast.success("파일이 삭제되었습니다");
toast.error("파일 삭제에 실패했습니다");
```

### 4. 컴포넌트 재사용 및 추상화
- **FileUploader** (Story 3-1) → **FilePreviewModal** (Story 3-7)에서 재사용
- **ProgressBar** (Story 3-5) → 독립 컴포넌트로 추출 후 다른 곳에서 재사용 가능

### 5. RBAC 패턴 일관성
```typescript
// 모든 파일 관련 프로시저에RBAC 적용
export const fileRouter = router({
  deleteDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "해당 문서를 찾을 수 없습니다.",
        });
      }

      // RBAC: Case lawyer or Admin only
      const membership = await ctx.db.caseMember.findFirst({
        where: {
          caseId: document.caseId,
          userId: ctx.user.id,
        },
      });

      if (!membership || membership.role === "viewer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "파일을 삭제할 권한이 없습니다.",
        });
      }

      // ... 삭제 로직
    }),
});
```

---

## 🔍 Epic 4 준비: AI 기반 거래 분류

Epic 4에서는 Epic 3에서 저장된 Transaction 데이터를 사용하여 AI 기반 분류를 구현합니다.

### Epic 3에서 Epic 4로 넘어가는 핵심 데이터

```typescript
// Epic 3에서 저장된 Transaction 모델
model Transaction {
  id                String   @id @default(cuid())
  documentId        String
  transactionDate   DateTime
  depositAmount     Decimal? @db.Decimal(20, 2)
  withdrawalAmount  Decimal? @db.Decimal(20, 2)
  balance           Decimal? @db.Decimal(20, 2)
  memo              String?  // 🎯 Epic 4에서 핵심적으로 활용
  counterparty      String?  // 🎯 Epic 4에서 자동 추출
  rawMetadata       Json?    // 🎯 Epic 4에서 열 매핑 정보 활용
  tags              Tag[]    // 🎯 Epic 4에서 추가
}
```

### Epic 4 구현 시 Epic 3 경험 활용

1. **점진적 개발**: Story 4-1 → 4-2 → ... → 4-8 순서로 개발
2. **Prisma Relation**: Tag 모델 추가 시 CASCADE DELETE 고려
3. **Shadcn/ui 재사용**: Badge, Dialog 컴포넌트로 태그 표시
4. **tRPC + React Query**: AI 분류 결과를 SSE로 실시간 전달 (Story 4-2)
5. **에러 처리**: AI API 실패 시 재시도 로직 구현

---

## 🎉 결론

Epic 3는 **파일 업로드 → 검증 → S3 저장 → 구조 분석 → 데이터 추출 → DB 저장 → 미리보기/삭제**의 전체 파이프라인을 성공적으로 구현했습니다.

32개의 코드 리뷰 이슈를 모두 수정하며 코드 품질을 높였고, CASCADE DELETE, TypeScript Strict Mode, RBAC 패턴을 마스터했습니다.

Epic 4에서는 Epic 3에서 구축한 Transaction 데이터를 기반으로 AI 기반 분류를 구현할 예정입니다.

---

**Epic 3 상태**: ✅ done
**다음 Epic**: Epic 4 (AI 기반 거래 분류)
