# Story 4.1 코드 리뷰 보고서

**리뷰어**: Amelia (개발자 에이전트)  
**리뷰 날짜**: 2026-01-10  
**프로젝트**: Pharos BMAD  
**상태**: 🔴 **주요 개선사항 필요** 

---

## 📊 리뷰 개요

### 구현 현황
- ✅ **백엔드 코어**: Prisma 스키마, AI 분류 서비스, tRPC 라우터 모두 구현
- ✅ **프론트엔드**: AI 분류 버튼 컴포넌트 구현
- ✅ **AC 1-4 기능 요구사항**: 모두 구현 완료
- ❌ **테스트**: 전무
- ❌ **프로덕션 준비**: 부족

### 리뷰 결과
- **발견된 문제**: 8개 (Critical 2, High 1, Medium 4, Low 1)
- **심각도 레벨**: 🔴 HIGH (프로덕션 배포 불가)
- **해결 예상 시간**: 5-7 영업일

---

## 🔴 **CRITICAL 이슈** (즉시 수정 필요)

### ❌ Issue #1: 테스트 커버리지 0%

**파일**: 
- `src/server/ai/classification-service.ts` (296줄)
- `src/server/ai/classification-service.test.ts` (미존재)
- `src/server/api/routers/transaction.ts` (261줄)
- `src/server/api/routers/__tests__/transaction.test.ts` (미존재)
- `src/components/ai-classification-button.tsx`
- `src/components/__tests__/ai-classification-button.test.tsx` (미존재)

**문제 설명**:
```typescript
// ❌ 다음 코드가 실제로 동작하는지 검증 불가능
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2 }
): Promise<T> {
  // - 최대 3회 재시도가 실제로 동작하는가?
  // - 지수 백오프 계산이 정확한가? (1s, 2s, 4s, ...)
  // - 마지막 실패는 exception을 던지는가?
  // 테스트 없이 검증 불가능
}

export async function classifyTransactionsInBatches(
  transactions: TransactionInput[],
  options: BatchOptions = { batchSize: 100, maxConcurrentBatches: 5 },
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ClassificationResult>> {
  // - 1000건을 100건씩 정확히 분할하는가?
  // - 5개 배치가 병렬로 실행되는가?
  // - 진행률 콜백이 정확한가?
  // 테스트 없이 검증 불가능
}
```

**AC 영향**:
- AC1 (AI 분류 시작): 테스트 미흡
- AC2 (분류 결과 저장): 데이터 저장 검증 미흡
- AC3 (성능 요구사항): 1000건 60초 요구사항 검증 불가능 ⚠️
- AC4 (에러 처리 및 재시도): 재시도 로직 검증 불가능

**리스크**:
- 프로덕션 배포 후 버그 발견 시 심각한 문제 발생 가능
- 회귀 테스트 불가능 (향후 리팩토링 위험)

**해결 방안**:
1. **분류 서비스 테스트** (`src/server/ai/__tests__/classification-service.test.ts`)
   ```typescript
   describe('retryWithBackoff', () => {
     test('최대 3회 재시도 후 실패', async () => {
       const mockFn = jest.fn().mockRejectedValue(new Error('API Error'));
       await expect(retryWithBackoff(mockFn)).rejects.toThrow();
       expect(mockFn).toHaveBeenCalledTimes(3);
     });

     test('지수 백오프: 1초, 2초, 4초 대기', async () => {
       // useFakeTimers로 시간 시뮬레이션
       // 각 시도 사이에 정확한 지연 확인
     });

     test('첫 번째 시도에서 성공하면 즉시 반환', async () => {
       const mockFn = jest.fn().mockResolvedValue({ category: '입금' });
       const result = await retryWithBackoff(mockFn);
       expect(mockFn).toHaveBeenCalledTimes(1);
     });
   });

   describe('classifyTransactionsInBatches', () => {
     test('1000건을 100건씩 배치로 분할', async () => {
       const transactions = Array.from({ length: 1000 }, (_, i) => ({
         id: `tx-${i}`,
         memo: `거래 ${i}`,
         depositAmount: 1000,
         withdrawalAmount: null,
       }));

       const results = await classifyTransactionsInBatches(transactions, {
         batchSize: 100,
         maxConcurrentBatches: 5,
       });

       expect(results.size).toBe(1000);
     });

     test('최대 5개 배치 동시 실행 (동시성 검증)', async () => {
       // 동시 실행 수를 tracking하여 5개를 초과하지 않는지 확인
     });

     test('진행률 콜백이 정확하게 호출됨 (0% → 100%)', async () => {
       const progressUpdates: number[] = [];
       await classifyTransactionsInBatches(
         transactions,
         options,
         (current, total) => progressUpdates.push((current / total) * 100)
       );
       // [1%, 2%, ..., 100%] 정렬 확인
     });
   });
   ```

2. **Transaction 라우터 테스트** (`src/server/api/routers/__tests__/transaction.test.ts`)
   ```typescript
   describe('transaction.classifyTransactions', () => {
     test('[AC1] RBAC: Case lawyer만 분류 가능', async () => {
       // Case lawyer: 성공 ✅
       // Paralegal: 거부 (FORBIDDEN) ✅
       // Admin: 성공 ✅
     });

     test('[AC2] 분류 결과가 DB에 저장됨', async () => {
       const result = await caller.transaction.classifyTransactions({
         documentId: 'doc-1',
       });
       
       const transaction = await db.transaction.findFirst({
         where: { documentId: 'doc-1', id: result.jobId },
       });
       
       expect(transaction.category).toBe('입금');
       expect(transaction.confidenceScore).toBeGreaterThan(0.5);
     });

     test('[AC3] 1000건을 60초 내 분류', async () => {
       // 성능 테스트 (느린 테스트로 마크)
       const startTime = Date.now();
       await caller.transaction.classifyTransactions({ documentId: 'doc-1000' });
       const elapsed = Date.now() - startTime;
       
       expect(elapsed).toBeLessThan(60000); // 60초
     });

     test('[AC4] API 실패 시 재시도', async () => {
       // Mock AI provider를 처음 2회는 실패, 3회차 성공하도록 설정
       // 재시도가 3회 발생하는지 확인
     });
   });
   ```

3. **AI 분류 버튼 컴포넌트 테스트** (`src/components/__tests__/ai-classification-button.test.tsx`)
   ```typescript
   describe('AIClassificationButton', () => {
     test('완료 상태면 버튼 비활성화', () => {
       const { getByRole } = render(
         <AIClassificationButton
           documentId="doc-1"
           classificationStatus="completed"
         />
       );
       expect(getByRole('button')).toBeDisabled();
     });

     test('클릭 시 확인 다이얼로그 표시', async () => {
       const { getByRole } = render(
         <AIClassificationButton
           documentId="doc-1"
           classificationStatus="pending"
         />
       );
       await userEvent.click(getByRole('button'));
       expect(getByRole('dialog')).toBeInTheDocument();
     });

     test('[AC1] 분류 시작 버튼 클릭 → API 호출', async () => {
       const mockMutate = jest.fn();
       // API mock 설정
       await userEvent.click(getByRole('button'));
       await userEvent.click(getByText('시작'));
       
       expect(mockMutate).toHaveBeenCalledWith({ documentId: 'doc-1' });
     });
   });
   ```

**우선순위**: 🔴 **즉시**  
**완료 기준**: 테스트 커버리지 80% 이상 달성

---

### ❌ Issue #2: 프로덕션 부적합한 인메모리 상태 관리

**파일**: [src/server/api/routers/transaction.ts](src/server/api/routers/transaction.ts#L21-L29)

**문제 코드**:
```typescript
const classificationJobs = new Map<
  string,
  {
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    total: number;
    error?: string;
  }
>();
```

**문제 상세**:

| 시나리오 | 현재 동작 | 문제점 |
|---------|---------|--------|
| **서버 재시작** | 모든 진행 상태 손실 | 분류 중인 작업의 진행률 조회 불가 |
| **로드 밸런서** (다중 서버) | 요청이 다른 서버로 라우팅되면 상태 없음 | `getClassificationStatus` 항상 `pending` 반환 |
| **동시 요청 (Race Condition)** | 여러 사용자가 동시에 분류 | 상태 업데이트 충돌 가능성 |
| **메모리 누수** | 완료된 작업 자동 정리 없음 | 장시간 운영 시 메모리 증가 |

**예시 시나리오**:
```typescript
// 사용자 A: 분류 시작 (요청이 서버1로 라우팅)
await api.transaction.classifyTransactions({ documentId: 'doc-1' });
// → classificationJobs.set('doc-1-12345', { status: 'processing' })
// → 서버1의 인메모리 Map에만 저장

// 사용자 B: 진행률 조회 (요청이 서버2로 라우팅)
const status = await api.transaction.getClassificationStatus({ documentId: 'doc-1' });
// → classificationJobs.get('doc-1-12345') 실행
// → 서버2는 Map에 해당 jobId가 없음 → status: 'pending' 반환 ❌
// → UI는 "분류 아직 시작 안 됨"이라고 표시
```

**AC 영향**:
- AC3 (성능 요구사항): 진행률 추적 불가능
- Story 3.5 (SSE 시스템) 통합 불가능

**해결 방안**:

**방안 1: Redis 기반 상태 관리** (권장)
```typescript
// src/server/ai/classification-job-store.ts
import { redis } from '~/server/redis';

interface ClassificationJob {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  error?: string;
  createdAt: number;
}

export async function startClassificationJob(
  jobId: string,
  total: number
): Promise<void> {
  const job: ClassificationJob = {
    status: 'processing',
    progress: 0,
    total,
    createdAt: Date.now(),
  };
  
  // TTL 1시간으로 설정 (자동 정리)
  await redis.setex(
    `classification:${jobId}`,
    3600,
    JSON.stringify(job)
  );
}

export async function updateProgress(
  jobId: string,
  progress: number
): Promise<void> {
  const job = await redis.get(`classification:${jobId}`);
  if (!job) return;
  
  const updated = { ...JSON.parse(job), progress };
  await redis.setex(
    `classification:${jobId}`,
    3600,
    JSON.stringify(updated)
  );
}

export async function getJob(jobId: string): Promise<ClassificationJob | null> {
  const job = await redis.get(`classification:${jobId}`);
  return job ? JSON.parse(job) : null;
}
```

**방안 2: Prisma 테이블 기반** (더 나은 영속성)
```prisma
model ClassificationJob {
  id        String   @id
  documentId String
  status    String  // processing, completed, failed
  progress  Int     @default(0)
  total     Int
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([documentId])
  @@index([status])
}
```

**우선순위**: 🔴 **즉시** (프로덕션 배포 전 필수)  
**완료 기준**: Redis/DB 기반 상태 관리로 전환, 다중 서버 환경에서 테스트 완료

---

## 🟠 **HIGH 이슈**

### ❌ Issue #3: SSE 진행률 실시간 전송 미구현

**파일**: [src/server/api/routers/transaction.ts](src/server/api/routers/transaction.ts#L132-L145)

**문제 설명**:

구현 문서에서:
> "진행률 추적: FileAnalysisResult의 status를 업데이트 (pending → processing → completed/failed)
> SSE 엔드포인트를 통해 실시간 진행률 전송 (Story 3.5 재사용)"

하지만 실제 코드:
- ✅ `FileAnalysisResult.status` 업데이트: 구현됨
- ❌ SSE 엔드포인트: **미구현**
- ❌ Story 3.5 연결: **없음**

**현재 상태**:
```typescript
// ✅ 상태는 DB에 저장됨
await ctx.db.fileAnalysisResult.updateMany({
  where: { documentId },
  data: { status: "processing" },
});

// ❌ 하지만 클라이언트로 실시간 스트림을 보낼 방법이 없음
// getClassificationStatus는 폴링(polling)만 가능
```

**UI 영향**:
```typescript
// src/components/ai-classification-button.tsx에서는
// 진행률 업데이트를 받을 방법이 없음
// → 무한 로딩 상태로 보일 가능성
const classifyMutation = api.transaction.classifyTransactions.useMutation();
// 응답 후 onClassificationComplete 호출
// → 실시간 진행률 표시 불가능
```

**해결 방안**:

1. **SSE 엔드포인트 생성** (`src/server/api/routers/file.ts`)
   ```typescript
   export const fileRouter = createTRPCRouter({
     getClassificationProgress: publicProcedure
       .input(z.object({ documentId: z.string() }))
       .query(async ({ ctx, input }) => {
         // 이것도 폴링이므로 실시간이 아님
         // 진정한 SSE가 필요함
       })
       .subscription(async function* ({ ctx, input }) {
         // ✅ 실시간 스트림
         const { documentId } = input;
         
         while (true) {
           const job = await ctx.db.classificationJob.findFirst({
             where: { documentId },
           });
           
           if (!job) break;
           
           yield {
             status: job.status,
             progress: job.progress,
             total: job.total,
           };
           
           if (job.status !== 'processing') break;
           
           // 500ms마다 업데이트 확인
           await new Promise(resolve => setTimeout(resolve, 500));
         }
       }),
   });
   ```

2. **UI에서 구독** (`src/components/ai-classification-button.tsx`)
   ```typescript
   const { data: progress } = api.file.getClassificationProgress.useSubscription(
     { documentId },
     {
       onData: (data) => {
         setProgress(data.progress);
         if (data.status === 'completed') {
           toast.success('AI 분류 완료!');
           onClassificationComplete?.();
         }
       },
     }
   );
   ```

**우선순위**: 🟠 **높음** (UX 품질 직결)  
**완료 기준**: 실시간 SSE 스트림으로 진행률 업데이트, 클라이언트에서 실시간 표시 확인

---

## 🟡 **MEDIUM 이슈**

### ❌ Issue #4: Prisma 스키마 오류

**파일**: [src/server/api/routers/transaction.ts](src/server/api/routers/transaction.ts#L180-L185)

**문제 코드**:
```typescript
await ctx.db.fileAnalysisResult.updateMany({
  where: { documentId },
  data: {
    status: "failed",
    errorMessage: "AI 분류에 실패했습니다. 다시 시도해주세요.",  // ❌ 필드 없음!
  },
});
```

**스키마 확인**:
```prisma
// prisma/schema.prisma - FileAnalysisResult 모델
model FileAnalysisResult {
  id              String   @id @default(uuid())
  documentId      String   @unique
  caseId          String
  status          String                          // ✅ 있음
  columnMapping   Json     @default("{}")
  headerRowIndex  Int
  totalRows       Int
  detectedFormat  String
  hasHeaders      Boolean  @default(true)
  confidence      Float    @default(0.0)
  // ❌ errorMessage 필드 없음!
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**문제점**:
- TypeScript 컴파일은 통과할 수 있지만 런타임 에러 발생
- Prisma strict mode에서는 컴파일 에러 발생
- DB에 저장되지 않아 에러 로깅 불가능

**해결 방안**:

스키마에 `error` 필드 추가:
```prisma
model FileAnalysisResult {
  id              String   @id @default(uuid())
  documentId      String   @unique
  caseId          String
  status          String                          
  columnMapping   Json     @default("{}")
  headerRowIndex  Int
  totalRows       Int
  detectedFormat  String
  hasHeaders      Boolean  @default(true)
  confidence      Float    @default(0.0)
  error           String?                         // ✅ 추가
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

마이그레이션 생성:
```bash
npx prisma migrate dev --name add_error_field_to_file_analysis_result
```

코드 수정:
```typescript
await ctx.db.fileAnalysisResult.updateMany({
  where: { documentId },
  data: {
    status: "failed",
    error: "AI 분류에 실패했습니다. 다시 시도해주세요.",
  },
});
```

**우선순위**: 🟡 **높음** (타입 안정성)  
**완료 기준**: 스키마 수정, 마이그레이션 실행, 컴파일 에러 없음 확인

---

### ❌ Issue #5: 환경 변수 검증 부족

**파일**: [src/server/ai/classification-service.ts](src/server/ai/classification-service.ts#L33-L40)

**문제 코드**:
```typescript
function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || "upstage";

  if (!["upstage", "openai", "anthropic"].includes(provider)) {
    throw new Error(`지원하지 않는 AI 공급자입니다: ${provider}`);
  }

  return provider as AIProvider;
}
```

**문제점**:
1. **API 키 검증 없음**:
   ```typescript
   // ❌ 다음 코드는 실행됨 (API 키 없이)
   process.env.AI_PROVIDER = "upstage";
   // process.env.UPSTAGE_API_KEY는 설정 안 됨
   // → 런타임 에러 발생 (API 호출 실패)
   ```

2. **`.env` 파일 설정 가이드 없음**
3. **각 공급자별 필수 환경 변수 문서화 없음**

**필요한 환경 변수**:
```bash
# .env.example
AI_PROVIDER=upstage  # upstage | openai | anthropic

# Upstage Solar API
UPSTAGE_API_KEY=your_upstage_api_key

# OpenAI GPT
OPENAI_API_KEY=your_openai_api_key

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**해결 방안**:

1. **`src/env.js` 수정** (환경 변수 검증):
   ```typescript
   import { z } from "zod";

   const server = z.object({
     // ... 기존 변수들
     AI_PROVIDER: z.enum(["upstage", "openai", "anthropic"]).default("upstage"),
     UPSTAGE_API_KEY: z.string().optional(),
     OPENAI_API_KEY: z.string().optional(),
     ANTHROPIC_API_KEY: z.string().optional(),
   });

   const processEnv = {
     // ... 기존 변수들
     AI_PROVIDER: process.env.AI_PROVIDER,
     UPSTAGE_API_KEY: process.env.UPSTAGE_API_KEY,
     OPENAI_API_KEY: process.env.OPENAI_API_KEY,
     ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
   };

   const parsed = server.safeParse(processEnv);

   if (!parsed.success) {
     throw new Error(
       `❌ Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`
     );
   }

   // AI_PROVIDER에 따라 필수 키 검증
   const provider = parsed.data.AI_PROVIDER;
   if (provider === "upstage" && !parsed.data.UPSTAGE_API_KEY) {
     throw new Error("❌ UPSTAGE_API_KEY is required when AI_PROVIDER=upstage");
   }
   if (provider === "openai" && !parsed.data.OPENAI_API_KEY) {
     throw new Error("❌ OPENAI_API_KEY is required when AI_PROVIDER=openai");
   }
   if (provider === "anthropic" && !parsed.data.ANTHROPIC_API_KEY) {
     throw new Error("❌ ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
   }
   ```

2. **`.env.example` 생성**:
   ```bash
   # AI Classification Configuration (Story 4.1)
   AI_PROVIDER=upstage  # Choose: upstage, openai, or anthropic
   
   # Upstage Solar API - https://console.upstage.ai
   UPSTAGE_API_KEY=sk_...
   
   # OpenAI GPT API - https://platform.openai.com/api-keys
   OPENAI_API_KEY=sk-...
   
   # Anthropic Claude API - https://console.anthropic.com
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **README.md에 설정 가이드 추가**:
   ```markdown
   ## AI Classification Setup (Story 4.1)
   
   ### 1. Choose an AI Provider
   
   Pharos BMAD supports three AI providers for transaction classification:
   
   #### Option A: Upstage Solar (Recommended for Korean)
   ```bash
   AI_PROVIDER=upstage
   UPSTAGE_API_KEY=sk_...
   ```
   
   #### Option B: OpenAI GPT
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```
   
   #### Option C: Anthropic Claude
   ```bash
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   ```

**우선순위**: 🟡 **높음** (초기 설정 어려움)  
**완료 기준**: 환경 변수 검증 구현, `.env.example` 생성, README 가이드 추가

---

### ❌ Issue #6: 일괄 처리 성능 벤치마크 부재

**파일**: [src/server/ai/classification-service.ts](src/server/ai/classification-service.ts#L228-L296)

**AC3 요구사항**:
> "1,000건의 거래를 분류할 때, 모든 거래가 60초 이내에 분류된다"

**문제**:
- ✅ 일괄 처리 로직 구현: 있음 (배치 크기 100, 동시 배치 5)
- ❌ 실제 성능 테스트: **없음**
- ❌ 배치 크기 최적화: 검증 불가능
- ❌ 동시 배치 수 최적화: 검증 불가능
- ❌ AI API 레이트 리미트 고려: 없음

**성능 계산 예상치**:
```
가정:
- 1개 거래 분류 시간: 0.5초 (API 호출 + 재시도 포함)
- 배치 크기: 100건
- 동시 배치 수: 5

계산:
- 총 배치 수: 1000 / 100 = 10개 배치
- 동시 처리: 10 / 5 = 2 라운드 (각 라운드 5개 배치 병렬)
- 각 라운드 소요 시간: 100건 × 0.5초 = 50초 (배치 내부 직렬)
- 전체 소요 시간: 2라운드 × 50초 = 100초 ❌

❌ AC3 위반! (60초 초과)

개선 방안:
1. AI API 응답 시간 개선 (더 빠른 모델 선택)
2. 배치 내부도 병렬화 (현재는 직렬)
3. 동시 배치 수 증가 (현재 5 → 10으로 증가)
```

**해결 방안**:

1. **성능 테스트 작성**:
   ```typescript
   // src/server/ai/__tests__/classification-service.perf.test.ts
   describe('classifyTransactionsInBatches - Performance', () => {
     test('[AC3] 1000건을 60초 이내 분류 (성능 테스트)', async () => {
       // 느린 테스트 (--slow-test 플래그)
       const transactions = generateMockTransactions(1000);
       
       const startTime = performance.now();
       const results = await classifyTransactionsInBatches(
         transactions,
         { batchSize: 100, maxConcurrentBatches: 5 }
       );
       const elapsed = performance.now() - startTime;
       
       console.log(`⏱️ 1000건 분류 소요 시간: ${elapsed}ms`);
       
       expect(results.size).toBe(1000);
       expect(elapsed).toBeLessThan(60000); // AC3 요구사항
     });
     
     test('배치 크기별 성능 비교', async () => {
       const transactions = generateMockTransactions(1000);
       
       const batchSizes = [50, 100, 200];
       for (const batchSize of batchSizes) {
         const startTime = performance.now();
         await classifyTransactionsInBatches(
           transactions,
           { batchSize, maxConcurrentBatches: 5 }
         );
         const elapsed = performance.now() - startTime;
         
         console.log(`Batch size ${batchSize}: ${elapsed}ms`);
       }
     });
     
     test('동시 배치 수별 성능 비교', async () => {
       const transactions = generateMockTransactions(1000);
       
       const maxConcurrentValues = [3, 5, 10];
       for (const maxConcurrent of maxConcurrentValues) {
         const startTime = performance.now();
         await classifyTransactionsInBatches(
           transactions,
           { batchSize: 100, maxConcurrentBatches: maxConcurrent }
         );
         const elapsed = performance.now() - startTime;
         
         console.log(`Max concurrent ${maxConcurrent}: ${elapsed}ms`);
       }
     });
   });
   ```

2. **배치 내부 병렬화** (선택사항, AC3 요구 시):
   ```typescript
   export async function classifyTransactionsInBatches(
     transactions: TransactionInput[],
     options: BatchOptions = { batchSize: 100, maxConcurrentBatches: 5 },
     onProgress?: (current: number, total: number) => void
   ): Promise<Map<string, ClassificationResult>> {
     const { batchSize, maxConcurrentBatches } = options;
     const results = new Map<string, ClassificationResult>();
     
     // ... 배치 분할 코드 ...
     
     for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
       const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);
       
       await Promise.all(
         concurrentBatches.map(async (batch) => {
           // ✅ 배치 내부도 병렬화 (현재: 직렬)
           const batchResults = await Promise.all(
             batch.map(tx => classifyTransaction(tx.memo, {...}))
           );
           
           batchResults.forEach((result, idx) => {
             results.set(batch[idx].id, result);
           });
         })
       );
     }
     
     return results;
   }
   ```

**우선순위**: 🟡 **높음** (AC3 요구사항 검증)  
**완료 기준**: 성능 테스트 추가, 1000건 60초 이내 달성 확인

---

### ❌ Issue #7: 타입 안정성 - confidenceScore 범위 검증

**파일**: [src/server/ai/types.ts](src/server/ai/types.ts#L23) & [classification-service.ts](src/server/ai/classification-service.ts#L125)

**문제**:
```typescript
export interface ClassificationResult {
  category: string;
  subcategory: string;
  confidenceScore: number;  // ❌ 0.0 ~ 1.0 범위 강제 없음
  reasoning?: string;
}

// ❌ 다음 모두 타입 통과
const result1: ClassificationResult = { category: '입금', subcategory: '급여', confidenceScore: 1.5 }; // 1.5?!
const result2: ClassificationResult = { category: '입금', subcategory: '급여', confidenceScore: -0.5 }; // 음수?!
const result3: ClassificationResult = { category: '입금', subcategory: '급여', confidenceScore: 999 }; // 999?!
```

**해결 방안**:

1. **Zod 스키마로 런타임 검증**:
   ```typescript
   // src/server/ai/types.ts
   import { z } from "zod";

   export const ClassificationResultSchema = z.object({
     category: z.string().min(1, "카테고리는 필수입니다"),
     subcategory: z.string().min(1, "서브카테고리는 필수입니다"),
     confidenceScore: z.number().min(0).max(1, "신뢰도는 0.0 ~ 1.0 범위여야 합니다"),
     reasoning: z.string().optional(),
   });

   export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
   ```

2. **AI 공급자에서 검증**:
   ```typescript
   // src/server/ai/providers/upstage.ts
   export async function classifyWithUpstage(
     memo: string,
     amount?: { deposit?: number; withdrawal?: number }
   ): Promise<ClassificationResult> {
     // ... API 호출 ...
     
     const rawResult = await response.json();
     
     // ✅ 검증
     return ClassificationResultSchema.parse({
       category: rawResult.category,
       subcategory: rawResult.subcategory,
       confidenceScore: Math.max(0, Math.min(1, rawResult.confidence)), // 범위 보정
       reasoning: rawResult.reasoning,
     });
   }
   ```

**우선순위**: 🟡 **중간** (데이터 무결성)  
**완료 기준**: Zod 검증 추가, 범위 외 값 처리 확인

---

### ❌ Issue #8: 컴포넌트 상태 동기화 문제

**파일**: [src/components/ai-classification-button.tsx](src/components/ai-classification-button.tsx#L45-L52)

**문제**:
```typescript
const isDisabled = 
  classificationStatus === "completed" ||
  classificationStatus === "processing" ||
  isClassifying;

// ❌ classificationStatus가 변경되지 않으면
// → 버튼이 계속 로딩 상태로 보임
// → 사용자는 "분류가 아직 진행 중인가?"라고 생각
```

**시나리오**:
1. 사용자가 "AI 분류 시작" 버튼 클릭
2. API 호출 성공 → `classificationStatus = "processing"`
3. 분류가 백그라운드에서 진행 중
4. **컴포넌트가 prop 변화를 감지하지 못함**
5. 버튼은 여전히 "분류 중..." 상태 유지
6. 실제로는 분류가 완료되었는데 UI는 모름

**해결 방안**:

1. **Polling으로 상태 추적** (빠른 방안):
   ```typescript
   export function AIClassificationButton({
     documentId,
     classificationStatus,
     onClassificationComplete,
   }: AIClassificationButtonProps) {
     const [localStatus, setLocalStatus] = useState(classificationStatus);
     const [isClassifying, setIsClassifying] = useState(false);

     // ✅ 분류 중일 때 상태 폴링
     useEffect(() => {
       if (localStatus !== "processing") return;

       const interval = setInterval(async () => {
         const status = await api.transaction.getClassificationStatus.query({
           documentId,
         });

         setLocalStatus(status.status);

         if (status.status === "completed") {
           toast.success("AI 분류 완료!");
           onClassificationComplete?.();
           setIsClassifying(false);
         } else if (status.status === "failed") {
           toast.error("AI 분류에 실패했습니다.");
           setIsClassifying(false);
         }
       }, 1000); // 1초마다 확인

       return () => clearInterval(interval);
     }, [localStatus, documentId]);

     // ...
   }
   ```

2. **Real-time 구독** (최적):
   ```typescript
   export function AIClassificationButton({
     documentId,
     classificationStatus,
     onClassificationComplete,
   }: AIClassificationButtonProps) {
     const [localStatus, setLocalStatus] = useState(classificationStatus);
     const [isClassifying, setIsClassifying] = useState(false);

     // ✅ SSE로 실시간 업데이트 구독
     const { data: progress } = api.file.getClassificationProgress.useSubscription(
       { documentId },
       {
         onData: (data) => {
           setLocalStatus(data.status);

           if (data.status === "completed") {
             toast.success("AI 분류 완료!");
             onClassificationComplete?.();
             setIsClassifying(false);
           } else if (data.status === "failed") {
             toast.error("AI 분류에 실패했습니다.");
             setIsClassifying(false);
           }
         },
       }
     );

     // ...
   }
   ```

**우선순위**: 🟡 **중간** (UX 개선)  
**완료 기준**: 실시간 상태 동기화 구현, UI 테스트 추가

---

## 📋 **액션 아이템 요약**

| # | 이슈 | 파일 | 심각도 | 예상 시간 | 담당자 | 상태 |
|---|-----|------|--------|---------|--------|------|
| 1 | 테스트 커버리지 0% | `classification-service.ts`, `transaction.ts`, `ai-classification-button.tsx` | 🔴 CRITICAL | 3일 | - | ❌ 미시작 |
| 2 | 인메모리 상태 관리 | `transaction.ts` (L21-29) | 🔴 CRITICAL | 2일 | - | ❌ 미시작 |
| 3 | SSE 진행률 미구현 | `transaction.ts`, UI 컴포넌트 | 🟠 HIGH | 2일 | - | ❌ 미시작 |
| 4 | Prisma 스키마 오류 | `transaction.ts` (L180-185), `schema.prisma` | 🟡 MEDIUM | 0.5일 | - | ❌ 미시작 |
| 5 | 환경 변수 검증 부족 | `src/env.js`, `README.md`, `.env.example` | 🟡 MEDIUM | 1일 | - | ❌ 미시작 |
| 6 | 성능 벤치마크 부재 | `classification-service.test.ts` | 🟡 MEDIUM | 1.5일 | - | ❌ 미시작 |
| 7 | confidenceScore 검증 | `types.ts`, `providers/` | 🟡 MEDIUM | 0.5일 | - | ❌ 미시작 |
| 8 | 컴포넌트 상태 동기화 | `ai-classification-button.tsx` | 🟡 MEDIUM | 1일 | - | ❌ 미시작 |

**전체 예상 소요 시간**: 11.5일 (병렬 처리 시 6-7일)

---

## ✅ **잘 구현된 부분**

### 1. Prisma 스키마 설계
**파일**: [prisma/schema.prisma](prisma/schema.prisma#L185-L211)

```prisma
model Transaction {
  id                     String   @id @default(uuid())
  documentId             String
  caseId                 String
  
  // Story 4.1: AI 분류 필드 (완벽하게 설계됨)
  category               String?              // ✅ 거래 카테고리
  subcategory            String?              // ✅ 세부 카테고리
  confidenceScore        Float?   @default(0.0)  // ✅ AI 신뢰도
  isManuallyClassified   Boolean? @default(false) // ✅ 수동 수정 추적
  aiClassificationStatus String?              // ✅ 분류 상태 추적
  
  // 인덱스: 상태별 조회 최적화
  @@index([aiClassificationStatus])
  @@map("transactions")
}
```

**장점**:
- 필드 설계가 정확함 (모든 AC 요구사항 커버)
- 인덱스 설정으로 조회 성능 고려
- 향후 확장 가능성 좋음

---

### 2. AI 공급자 추상화
**파일**: [src/server/ai/](src/server/ai/)

```typescript
// 3개 공급자 지원 - 확장 가능한 설계
export type AIProvider = "upstage" | "openai" | "anthropic";

const providerMap = {
  upstage: classifyWithUpstage,
  openai: classifyWithOpenAI,
  anthropic: classifyWithAnthropic,
};
```

**장점**:
- 새로운 공급자 추가 시 쉬운 확장
- 공급자별 로직 분리
- 환경 변수로 동적 선택 가능

---

### 3. 재시도 메커니즘
**파일**: [src/server/ai/classification-service.ts](src/server/ai/classification-service.ts#L45-L81)

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
  }
): Promise<T> {
  // ✅ 지수 백오프 (1s, 2s, 4s)
  // ✅ 최대 3회 재시도
  // ✅ 제너릭으로 유연함
}
```

**장점**:
- AC4 요구사항 (재시도) 완벽 구현
- 지수 백오프 로직 정확함
- 다른 함수에서도 재사용 가능

---

### 4. RBAC 권한 검증
**파일**: [src/server/api/routers/transaction.ts](src/server/api/routers/transaction.ts#L67-L85)

```typescript
// Case lawyer 또는 Admin만 분류 가능
if (document.case.lawyerId !== userId && user.role !== "ADMIN") {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "거래 분류를 수행할 권한이 없습니다.",
  });
}
```

**장점**:
- 보안 정책 준수
- 역할별 접근 제어 정확함
- 에러 메시지 명확함

---

### 5. 충실한 문서화
**파일**: 모든 주요 파일

```typescript
/**
 * AI Classification Service
 *
 * Story 4.1: AI 기반 거래 자동 분류
 *
 * 기능:
 * - AI 공급자 선택 로직
 * - 거래 메모를 기반으로 한 분류
 * - 재시도 메커니즘 (최대 3회, 지수 백오프)
 * - 타임아웃 처리 (15초)
 *
 * @example
 * const result = await classifyTransaction(memo, { deposit: 100000 });
 */
```

**장점**:
- JSDoc 주석이 상세함
- 사용 예시 포함
- Story 추적 가능

---

## 🎯 **다음 단계**

### Phase 1: Critical Issues 해결 (3-4일)
1. ✅ 테스트 작성 (분류 서비스, 라우터, 컴포넌트)
2. ✅ Redis/DB 기반 상태 관리로 전환
3. ✅ Prisma 스키마 수정 (`errorMessage` → `error`)

### Phase 2: High/Medium Issues 해결 (3-4일)
4. ✅ SSE 엔드포인트 구현
5. ✅ 환경 변수 검증 강화
6. ✅ 성능 테스트 추가
7. ✅ confidenceScore 범위 검증
8. ✅ 컴포넌트 상태 동기화 개선

### Phase 3: 검증 & 배포 (2-3일)
9. ✅ 전체 통합 테스트
10. ✅ 부하 테스트 (1000건 60초 검증)
11. ✅ 코드 리뷰 (fresh context)
12. ✅ 스테이징 배포 및 검증

---

## 📞 **리뷰 문의**

- **일괄 처리 동시성**: 배치 크기 100, 동시 5개가 최적인지?
- **SSE vs Polling**: 실시간 요구사항이 강한가?
- **다중 AI 공급자**: 런타임에 변경 가능해야 하는가?
- **에러 메시지**: 사용자 친화적으로 한국어 제공 필요한가?

---

**리뷰 완료**  
**작성자**: Amelia (Developer Agent)  
**날짜**: 2026-01-10  
**버전**: 1.0
