# Story 4.1 코드 리뷰 - 액션 아이템 추적 (Action Items Tracking)

**생성 날짜**: 2026-01-10  
**리뷰어**: Amelia (Developer Agent)  
**프로젝트**: Pharos BMAD  
**대상**: Story 4.1 - AI 기반 거래 자동 분류  

---

## 📊 액션 아이템 요약

| # | 우선순위 | 항목 | 심각도 | 파일 | 예상시간 | 상태 | 담당자 |
|---|---------|------|--------|------|---------|------|--------|
| AI-1 | 🔴 즉시 | 테스트 커버리지 추가 | CRITICAL | `classification-service.ts` | 3일 | ❌ 미시작 | - |
| AI-2 | 🔴 즉시 | Redis/DB 상태 관리 | CRITICAL | `transaction.ts` | 2일 | ❌ 미시작 | - |
| AI-3 | 🟠 높음 | SSE 진행률 실시간 전송 | HIGH | `transaction.ts`, UI | 2일 | ❌ 미시작 | - |
| AI-4 | 🟡 높음 | Prisma 스키마 오류 수정 | MEDIUM | `schema.prisma` | 0.5일 | ❌ 미시작 | - |
| AI-5 | 🟡 높음 | 환경 변수 검증 강화 | MEDIUM | `src/env.js` | 1일 | ❌ 미시작 | - |
| AI-6 | 🟡 높음 | 성능 벤치마크 추가 | MEDIUM | `classification-service.test.ts` | 1.5일 | ❌ 미시작 | - |
| AI-7 | 🟡 중간 | confidenceScore 검증 | MEDIUM | `types.ts` | 0.5일 | ❌ 미시작 | - |
| AI-8 | 🟡 중간 | 컴포넌트 상태 동기화 | MEDIUM | `ai-classification-button.tsx` | 1일 | ❌ 미시작 | - |

**전체 예상 소요 시간**: 11.5일 (병렬 처리 시 6-7일)  
**심각도 분포**: 🔴 2개 (CRITICAL), 🟠 1개 (HIGH), 🟡 5개 (MEDIUM)

---

## 🔴 CRITICAL 액션 아이템

### AI-1: 테스트 커버리지 0% 해결

**우선순위**: 🔴 **즉시** (배포 전 필수)  
**심각도**: CRITICAL  
**예상 소요 시간**: 3일  
**상태**: ❌ 미시작  

**변경 사항**:
```
신규 생성 파일:
- src/server/ai/__tests__/classification-service.test.ts (200줄)
- src/server/api/routers/__tests__/transaction.test.ts (250줄)
- src/components/__tests__/ai-classification-button.test.tsx (150줄)

수정 파일:
- package.json (test 스크립트 확인)
```

**완료 기준**:
- [ ] `retryWithBackoff` 함수 테스트 (재시도 횟수, 지수 백오프)
- [ ] `classifyTransaction` 단위 테스트
- [ ] `classifyTransactionsInBatches` 테스트 (배치 분할, 병렬화)
- [ ] `transaction.classifyTransactions` tRPC 라우터 테스트
- [ ] RBAC 권한 검증 테스트
- [ ] AC1-AC4 요구사항별 테스트
- [ ] AIClassificationButton 컴포넌트 렌더링 테스트
- [ ] 테스트 커버리지 80% 이상 달성
- [ ] `npm test` 모두 통과

**구체적인 테스트 케이스**:
```typescript
// retryWithBackoff 테스트
✓ 최대 3회 재시도 후 실패
✓ 지수 백오프: 1s, 2s, 4s 대기
✓ 첫 시도 성공 시 즉시 반환
✓ 에러 로깅 확인

// classifyTransactionsInBatches 테스트
✓ 1000건을 100건씩 배치로 분할
✓ 최대 5개 배치 동시 실행
✓ 진행률 콜백 정확성 (0% → 100%)
✓ 배치 내 실패 처리

// transaction.classifyTransactions 라우터 테스트
✓ [AC1] RBAC: Case lawyer만 분류 가능
✓ [AC2] 분류 결과 DB 저장
✓ [AC3] 1000건 60초 이내 분류
✓ [AC4] API 실패 시 재시도
✓ 없는 문서 처리 (NOT_FOUND)
✓ 분류할 거래 없음 (BAD_REQUEST)

// AIClassificationButton 테스트
✓ 완료 상태 시 비활성화
✓ 클릭 시 확인 다이얼로그 표시
✓ 확인 후 API 호출
✓ 성공/실패 토스트 표시
```

**참고 자료**: 
- 리뷰 보고서 [4-1-code-review.md](4-1-code-review.md) - Issue #1 상세 내용

---

### AI-2: 프로덕션 부적합한 인메모리 상태 관리 개선

**우선순위**: 🔴 **즉시** (프로덕션 배포 전 필수)  
**심각도**: CRITICAL  
**예상 소요 시간**: 2일  
**상태**: ❌ 미시작  

**변경 사항**:
```
신규 생성 파일:
- src/server/ai/classification-job-store.ts (150줄) - Redis 상태 관리
- OR prisma/migrations/[timestamp]_add_classification_job.sql

수정 파일:
- src/server/api/routers/transaction.ts (L21-29: 인메모리 Map 제거)
- prisma/schema.prisma (ClassificationJob 모델 추가, 선택사항)
```

**완료 기준**:

**옵션 A: Redis 기반** (권장, 빠른 응답)
- [ ] Redis 클라이언트 설정 확인 (`src/server/redis.ts`)
- [ ] `classification-job-store.ts` 구현:
  - [ ] `startClassificationJob(jobId, total)` - TTL 3600초
  - [ ] `updateProgress(jobId, progress)` - 상태 업데이트
  - [ ] `getJob(jobId)` - 상태 조회
  - [ ] `completeJob(jobId, result)` - 완료 처리
  - [ ] 자동 정리 (TTL 만료)
- [ ] `transaction.ts`에서 사용하도록 변경
- [ ] 다중 서버 환경에서 테스트:
  - [ ] 서버 A에서 분류 시작
  - [ ] 서버 B에서 진행률 조회
  - [ ] 정확한 상태 반환 확인

**옵션 B: Prisma 테이블 기반** (더 나은 영속성)
- [ ] `schema.prisma`에 `ClassificationJob` 모델 추가
- [ ] 마이그레이션 생성 및 실행
- [ ] `classification-job-store.ts` 구현 (Prisma 사용)
- [ ] 자동 정리 작업 추가 (cron job)

**테스트 시나리오**:
```
✓ 로드 밸런서 환경: 요청 분산 후 상태 조회 정확성
✓ 서버 재시작: 진행 중인 작업 상태 유지 (Redis) 또는 복구
✓ Race condition: 동시 업데이트 시 데이터 일관성
✓ 메모리 누수: 완료된 작업 자동 정리 확인
✓ 성능: 상태 조회 < 100ms
```

**참고 자료**:
- 리뷰 보고서 [4-1-code-review.md](4-1-code-review.md) - Issue #2 상세 내용

---

## 🟠 HIGH 액션 아이템

### AI-3: SSE 진행률 실시간 전송 구현

**우선순위**: 🟠 **높음** (UX 품질 직결)  
**심각도**: HIGH  
**예상 소요 시간**: 2일  
**상태**: ❌ 미시작  

**변경 사항**:
```
신규 생성 파일:
- src/server/api/routers/file.ts (getClassificationProgress 구독)
- src/hooks/use-classification-progress.ts (React hook)

수정 파일:
- src/components/ai-classification-button.tsx (SSE 구독)
```

**완료 기준**:
- [ ] tRPC 구독 엔드포인트 구현:
  - [ ] `file.getClassificationProgress` subscription
  - [ ] 500ms마다 상태 조회
  - [ ] 완료/실패 시 스트림 종료
- [ ] React hook 생성: `useClassificationProgress(documentId)`
- [ ] UI 컴포넌트 업데이트:
  - [ ] 실시간 진행률 표시 (진행 바)
  - [ ] 완료 시 토스트 알림
  - [ ] 실패 시 에러 처리
- [ ] 실시간 업데이트 테스트

**예상 구현**:
```typescript
// src/server/api/routers/file.ts
export const fileRouter = createTRPCRouter({
  getClassificationProgress: publicProcedure
    .input(z.object({ documentId: z.string() }))
    .subscription(async function* ({ ctx, input }) {
      // 실시간 스트림
      const { documentId } = input;
      
      while (true) {
        const job = await getClassificationJob(documentId);
        
        yield {
          status: job?.status ?? 'pending',
          progress: job?.progress ?? 0,
          total: job?.total ?? 0,
        };
        
        if (job?.status !== 'processing') break;
        await new Promise(r => setTimeout(r, 500));
      }
    }),
});

// src/components/ai-classification-button.tsx
const { data: progress } = api.file.getClassificationProgress.useSubscription(
  { documentId },
  {
    onData: (data) => {
      setProgress(data.progress);
      if (data.status === 'completed') {
        toast.success('AI 분류 완료!');
      }
    },
  }
);
```

**참고 자료**:
- 리뷰 보고서 [4-1-code-review.md](4-1-code-review.md) - Issue #3 상세 내용
- Story 3.5 SSE 구현 참고

---

## 🟡 MEDIUM 액션 아이템

### AI-4: Prisma 스키마 오류 수정 (errorMessage 필드)

**우선순위**: 🟡 **높음** (타입 안정성)  
**심각도**: MEDIUM  
**예상 소요 시간**: 0.5일  
**상태**: ❌ 미시작  

**변경 사항**:
```
수정 파일:
- prisma/schema.prisma (FileAnalysisResult 모델)
- src/server/api/routers/transaction.ts (에러 메시지 저장 필드명)

신규 마이그레이션:
- prisma/migrations/[timestamp]_add_error_field_to_file_analysis_result/migration.sql
```

**구체적인 변경**:

**1단계: Prisma 스키마 수정**
```prisma
// prisma/schema.prisma
model FileAnalysisResult {
  // ... 기존 필드 ...
  status          String                          
  error           String?                    // ✅ 추가: 에러 메시지 저장
  // ... 기존 필드 ...
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**2단계: 마이그레이션 생성**
```bash
npx prisma migrate dev --name add_error_field_to_file_analysis_result
```

**3단계: 코드 수정**
```typescript
// src/server/api/routers/transaction.ts
// 변경 전:
data: {
  status: "failed",
  errorMessage: "AI 분류에 실패했습니다. ...",  // ❌ 필드 없음
}

// 변경 후:
data: {
  status: "failed",
  error: "AI 분류에 실패했습니다. 다시 시도해주세요.",  // ✅ 정정
}
```

**완료 기준**:
- [ ] Prisma 스키마 수정
- [ ] 마이그레이션 생성 및 실행
- [ ] 컴파일 에러 없음 (`npm run build`)
- [ ] 타입 검증 통과

---

### AI-5: 환경 변수 검증 강화

**우선순위**: 🟡 **높음** (초기 설정)  
**심각도**: MEDIUM  
**예상 소요 시간**: 1일  
**상태**: ❌ 미시작  

**변경 사항**:
```
수정 파일:
- src/env.js (Zod 스키마 추가)
- .env.example (생성)
- README.md (설정 가이드 추가)
```

**완료 기준**:

**1단계: env.js 수정**
```typescript
// src/env.js
const server = z.object({
  // 기존 변수들...
  
  // 🟢 추가
  AI_PROVIDER: z.enum(["upstage", "openai", "anthropic"]).default("upstage"),
  UPSTAGE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const processEnv = {
  // ... 기존 ...
  AI_PROVIDER: process.env.AI_PROVIDER,
  UPSTAGE_API_KEY: process.env.UPSTAGE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

const parsed = server.safeParse(processEnv);

if (!parsed.success) {
  // 상세한 에러 메시지 출력
  throw new Error(`❌ 환경 변수 설정 오류:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`);
}

// AI_PROVIDER에 따라 필수 키 검증
const { AI_PROVIDER, UPSTAGE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY } = parsed.data;

if (AI_PROVIDER === "upstage" && !UPSTAGE_API_KEY) {
  throw new Error("❌ AI_PROVIDER=upstage 선택 시 UPSTAGE_API_KEY는 필수입니다");
}
if (AI_PROVIDER === "openai" && !OPENAI_API_KEY) {
  throw new Error("❌ AI_PROVIDER=openai 선택 시 OPENAI_API_KEY는 필수입니다");
}
if (AI_PROVIDER === "anthropic" && !ANTHROPIC_API_KEY) {
  throw new Error("❌ AI_PROVIDER=anthropic 선택 시 ANTHROPIC_API_KEY는 필수입니다");
}
```

**2단계: .env.example 생성**
```bash
# AI Classification Configuration (Story 4.1)
AI_PROVIDER=upstage  # 선택: upstage | openai | anthropic

# Upstage Solar API
# 가입: https://console.upstage.ai
# API 키 발급 후 아래에 입력
UPSTAGE_API_KEY=sk_...

# OpenAI GPT API
# 가입: https://platform.openai.com
# API 키 발급 후 아래에 입력
OPENAI_API_KEY=sk-...

# Anthropic Claude API
# 가입: https://console.anthropic.com
# API 키 발급 후 아래에 입력
ANTHROPIC_API_KEY=sk-ant-...
```

**3단계: README.md 설정 가이드 추가**
```markdown
## AI Classification Setup (Story 4.1)

### 지원되는 AI 공급자

Pharos BMAD는 거래 분류를 위해 3가지 AI 공급자를 지원합니다:

#### 옵션 A: Upstage Solar (한국어 최적화, 권장)

1. Upstage 가입: https://console.upstage.ai
2. API 키 발급
3. `.env`에 추가:
   ```
   AI_PROVIDER=upstage
   UPSTAGE_API_KEY=sk_[발급받은_키]
   ```

#### 옵션 B: OpenAI GPT

1. OpenAI 가입: https://platform.openai.com
2. API 키 발급
3. `.env`에 추가:
   ```
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-[발급받은_키]
   ```

#### 옵션 C: Anthropic Claude

1. Anthropic 가입: https://console.anthropic.com
2. API 키 발급
3. `.env`에 추가:
   ```
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-[발급받은_키]
   ```

### 검증

앱 시작 시 환경 변수가 자동으로 검증됩니다:
```bash
npm run dev
# ❌ 에러: AI_PROVIDER=upstage 선택 시 UPSTAGE_API_KEY는 필수입니다
```
```

**완료 기준**:
- [ ] env.js 수정 완료
- [ ] `.env.example` 생성
- [ ] README.md 가이드 추가
- [ ] 환경 변수 검증 테스트:
  - [ ] 필수 키 누락 시 에러 발생
  - [ ] 모든 필수 키 설정 시 정상 실행
  - [ ] 유효하지 않은 AI_PROVIDER 시 에러 발생

---

### AI-6: 성능 벤치마크 테스트 추가

**우선순위**: 🟡 **높음** (AC3 검증)  
**심각도**: MEDIUM  
**예상 소요 시간**: 1.5일  
**상태**: ❌ 미시작  

**변경 사항**:
```
신규 생성 파일:
- src/server/ai/__tests__/classification-service.perf.test.ts (200줄)
```

**완료 기준**:
- [ ] 1000건 분류 성능 테스트:
  - [ ] 60초 이내 완료 확인 (AC3)
  - [ ] 실제 API 호출 시뮬레이션
- [ ] 배치 크기별 성능 비교:
  - [ ] batchSize: 50, 100, 200
  - [ ] 최적 배치 크기 결정
- [ ] 동시 배치 수별 성능 비교:
  - [ ] maxConcurrentBatches: 3, 5, 10
  - [ ] 최적 동시 실행 수 결정
- [ ] 재시도 오버헤드 측정:
  - [ ] 성공 케이스 vs 재시도 포함 케이스
  - [ ] 지연 영향도 분석

**테스트 시나리오**:
```typescript
describe('classifyTransactionsInBatches - Performance', () => {
  test('[AC3] 1000건을 60초 이내 분류', async () => {
    const transactions = generateMockTransactions(1000);
    
    const startTime = performance.now();
    const results = await classifyTransactionsInBatches(transactions, {
      batchSize: 100,
      maxConcurrentBatches: 5,
    });
    const elapsed = performance.now() - startTime;
    
    console.log(`⏱️ 1000건 소요 시간: ${elapsed}ms (요구: 60000ms 이내)`);
    expect(elapsed).toBeLessThan(60000);
    expect(results.size).toBe(1000);
  });
  
  test('배치 크기별 성능 비교 (벤치마크)', async () => {
    const transactions = generateMockTransactions(1000);
    const results = [];
    
    for (const batchSize of [50, 100, 200]) {
      const start = performance.now();
      await classifyTransactionsInBatches(transactions, {
        batchSize,
        maxConcurrentBatches: 5,
      });
      const elapsed = performance.now() - start;
      results.push({ batchSize, elapsed });
    }
    
    // 결과 출력
    console.table(results);
    // → 최적 배치 크기 결정
  });
});
```

**참고 자료**:
- 리뷰 보고서 [4-1-code-review.md](4-1-code-review.md) - Issue #6 상세 내용

---

### AI-7: confidenceScore 범위 검증

**우선순위**: 🟡 **중간** (데이터 무결성)  
**심각도**: MEDIUM  
**예상 소요 시간**: 0.5일  
**상태**: ❌ 미시작  

**변경 사항**:
```
수정 파일:
- src/server/ai/types.ts (Zod 스키마 추가)
- src/server/ai/providers/upstage.ts (검증)
- src/server/ai/providers/openai.ts (검증)
- src/server/ai/providers/anthropic.ts (검증)
```

**완료 기준**:

**1단계: types.ts 수정**
```typescript
import { z } from "zod";

export const ClassificationResultSchema = z.object({
  category: z.string().min(1, "카테고리는 필수입니다"),
  subcategory: z.string().min(1, "서브카테고리는 필수입니다"),
  confidenceScore: z
    .number()
    .min(0, "신뢰도는 0 이상이어야 합니다")
    .max(1, "신뢰도는 1 이하여야 합니다"),
  reasoning: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
```

**2단계: 각 공급자에서 검증**
```typescript
// src/server/ai/providers/upstage.ts
const rawResult = await response.json();

// ✅ 범위 보정 (0.0 ~ 1.0)
const confidenceScore = Math.max(0, Math.min(1, rawResult.confidence));

return ClassificationResultSchema.parse({
  category: rawResult.category,
  subcategory: rawResult.subcategory,
  confidenceScore,
  reasoning: rawResult.reasoning,
});
```

**3단계: 테스트**
- [ ] 범위 내 값: 0.5 (통과)
- [ ] 범위 외 값: 1.5 (에러 또는 보정)
- [ ] 음수: -0.5 (에러 또는 보정)

---

### AI-8: 컴포넌트 상태 동기화 개선

**우선순위**: 🟡 **중간** (UX 개선)  
**심각도**: MEDIUM  
**예상 소요 시간**: 1일  
**상태**: ❌ 미시작  

**변경 사항**:
```
수정 파일:
- src/components/ai-classification-button.tsx (실시간 상태 구독)
```

**완료 기준**:
- [ ] 실시간 상태 동기화:
  - [ ] SSE 구독으로 진행 중 상태 실시간 업데이트
  - [ ] 완료 시 버튼 상태 변경
- [ ] 폴링 구현 (SSE 미지원 환경용):
  - [ ] 1초마다 상태 조회
  - [ ] 완료 시 폴링 중지
- [ ] 에러 처리:
  - [ ] 분류 실패 시 에러 표시
  - [ ] 재시도 옵션 제공
- [ ] UI 테스트:
  - [ ] 로딩 상태 표시 정확성
  - [ ] 완료 시 버튼 상태 변경

**구현 예시**:
```typescript
export function AIClassificationButton({
  documentId,
  classificationStatus,
  onClassificationComplete,
}: AIClassificationButtonProps) {
  const [localStatus, setLocalStatus] = useState(classificationStatus);
  const [isClassifying, setIsClassifying] = useState(false);

  // ✅ SSE 구독으로 실시간 업데이트
  const { data: progress } = api.file.getClassificationProgress.useSubscription(
    { documentId },
    {
      enabled: localStatus === "processing",
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

  // ... 나머지 코드 ...
}
```

---

## 📋 체크리스트

### 수행 전
- [ ] 리뷰 보고서 읽음 (`4-1-code-review.md`)
- [ ] 현재 코드 상태 확인 (모든 AC 충족)
- [ ] 팀 회의로 우선순위 논의

### 수행 중
- [ ] 각 아이템별 진행 상태 업데이트
- [ ] 종속성 확인 (AI-1, AI-2는 먼저 완료 필요)
- [ ] 테스트 작성 & 검증

### 수행 후
- [ ] 모든 액션 아이템 완료 여부 확인
- [ ] 전체 통합 테스트
- [ ] 부하 테스트 (1000건 60초)
- [ ] 코드 리뷰 (fresh context)
- [ ] 스테이징 배포

---

## 🔗 참고 자료

- [4-1-ai-based-transaction-classification.md](4-1-ai-based-transaction-classification.md) - 구현 상세
- [4-1-code-review.md](4-1-code-review.md) - 코드 리뷰 전문
- [sprint-status.yaml](sprint-status.yaml) - 스프린트 상태 추적
- Story 3.5 SSE 구현 (참고용)

---

**작성자**: Amelia (Developer Agent)  
**작성 날짜**: 2026-01-10  
**버전**: 1.0  
**다음 검토**: 2026-01-15 (AI-1, AI-2 완료 예상)
