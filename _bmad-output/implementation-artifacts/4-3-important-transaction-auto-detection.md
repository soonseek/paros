# Story 4.3: 중요 거래 자동 식별

Status: ready-for-dev

## Story

As a **시스템**,
I want **대출 실행, 변제, 담보제공 등 중요 거래를 자동 식별해서**,
so that **사용자가 중요한 거래를 놓치지 않는다**.

## Acceptance Criteria

**AC1: 중요 거래 키워드 식별**
- **Given** AI가 거래를 분류할 때
- **When** 메모에 특정 키워드가 포함되어 있으면
- **Then** 해당 거래는 "중요 거래"로 표시된다
- **And** `importantTransaction` 플래그가 `true`로 설정된다

**AC2: 중요 거래 키워드 정의**
- **Given** 중요 거래 키워드가 정의되어 있을 때
- **When** 메모에 다음 키워드가 포함되어 있으면
- **Then** 해당 중요 거래 유형으로 태그된다:
  - 대출 실행, 대출금, 실행 (대출 관련)
  - 변제, 상환, 갚음 (변제/상환 관련)
  - 담보제공, 담보설정, 저당권 (담보 관련)
  - 압류, 가압류 (압류 관련)

**AC3: 중요 거래 시각적 표시**
- **Given** 중요 거래가 식별되었을 때
- **When** TransactionTable에 거래가 표시되면
- **Then** 중요 거래는 시각적으로 강조되어 표시된다 (예: 🔴 배경 또는 아이콘)
- **And** FindingCard로 발견사항 목록에도 추가된다

**AC4: 중요 거래 필터링**
- **Given** 사용자가 중요 거래만 필터링하고 싶을 때
- **When** "중요 거래만 보기" 필터를 활성화하면
- **Then** `importantTransaction`이 `true`인 거래만 표시된다

**Requirements:** FR-025

## Tasks / Subtasks

### Backend Tasks

- [ ] **Task 1: Prisma 스키마 수정** (AC: #1, #2)
  - [ ] Transaction 모델에 중요 거래 관련 필드 추가:
    - `importantTransaction: Boolean? @default(false)` - 중요 거래 여부
    - `importantTransactionType: String?` - 중요 거래 유형 (LOAN_EXECUTION, REPAYMENT, COLLATERAL, SEIZURE)
    - `importantTransactionKeywords: String?` - 매칭된 키워드 (JSON array 또는 comma-separated)
  - [ ] Migration 생성: `npx prisma migrate dev --name add_important_transaction_fields`
  - [ ] Prisma client 재생성: `npx prisma generate`
  - [ ] 인덱스 추가: `@@index([importantTransaction])`

- [ ] **Task 2: Finding 모델 생성** (AC: #3)
  - [ ] Prisma 스키마에 Finding 모델 추가:
    ```prisma
    model Finding {
      id                String      @id @default(cuid())
      caseId            String
      case              Case        @relation(fields: [caseId], references: [id], onDelete: Cascade)
      transactionId     String?
      transaction       Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

      findingType       String      // IMPORTANT_TRANSACTION, PRIORITY_REPAYMENT, COLLATERAL_CHANGE, etc.
      title             String
      description       String?     @db.Text
      severity          String      @default("INFO") // INFO, WARNING, CRITICAL
      isResolved        Boolean     @default(false)
      resolvedAt        DateTime?

      createdAt         DateTime    @default(now())
      updatedAt         DateTime    @updatedAt

      @@index([caseId])
      @@index([transactionId])
      @@index([findingType])
      @@index([isResolved])
      @@map("findings")
    }
    ```
  - [ ] Transaction 모델에 Finding 관계 추가:
    ```prisma
    findings          Finding[]
    ```
  - [ ] Migration 실행

- [ ] **Task 3: 중요 거래 감지 서비스 구현** (AC: #1, #2)
  - [ ] `src/server/ai/important-transaction-detector.ts` 생성:
    - [ ] 키워드 기반 감지 로직 구현
    - [ ] 중요 거래 유형 분류 (대출 실행, 변제, 담보, 압류)
    - [ ] AI 분류와 통합 (Story 4.1의 classification-service 확장)
  - [ ] 키워드 설정 상수화:
    ```typescript
    // src/lib/constants/important-keywords.ts
    export const IMPORTANT_TRANSACTION_KEYWORDS = {
      LOAN_EXECUTION: ['대출 실행', '대출금', '실행'],
      REPAYMENT: ['변제', '상환', '갚음'],
      COLLATERAL: ['담보제공', '담보설정', '저당권'],
      SEIZURE: ['압류', '가압류'],
    } as const;
    ```

- [ ] **Task 4: AI 분류 서비스 확장** (AC: #1, #2)
  - [ ] `src/server/ai/classification-service.ts` 수정:
    - [ ] classifyTransactionsInBatches에 중요 거래 감지 로직 추가
    - [ ] 분류 결과에 `importantTransaction`, `importantTransactionType` 포함
    - [ ] 매칭된 키워드를 `importantTransactionKeywords`에 저장
  - [ ] ClassificationResult 타입 확장:
    ```typescript
    interface ClassificationResult {
      category: string;
      subcategory: string;
      confidenceScore: number;
      reasoning?: string;
      // Story 4.3 추가
      importantTransaction?: boolean;
      importantTransactionType?: 'LOAN_EXECUTION' | 'REPAYMENT' | 'COLLATERAL' | 'SEIZURE' | null;
      matchedKeywords?: string[];
    }
    ```

- [ ] **Task 5: Finding 자동 생성 서비스** (AC: #3)
  - [ ] `src/server/services/finding-service.ts` 생성:
    - [ ] 중요 거래 식별 시 Finding 레코드 자동 생성
    - [ ] Finding 타입: IMPORTANT_TRANSACTION
    - [ ] Severity: WARNING (기본값)
    - [ ] 제목 생성: "중요 거래 식별: {유형} - {금액}"
    - [ ] 설명: 메모 내용 + 감지된 키워드
  - [ ] tRPC 라우터에 Finding 관련 프로시저 추가:
    - `getFindings` - 사건의 모든 발견사항 조회
    - `resolveFinding` - 발견사항 해제 처리

- [ ] **Task 6: tRPC 라우터 업데이트** (AC: #4)
  - [ ] `src/server/api/routers/transaction.ts`에 필터링 로직 추가:
    - [ ] `getPaginatedTransactions` 프로시저에 `importantOnly` 필터 추가
    - [ ] Input Zod 스키마 확장:
      ```typescript
      import { z } from "zod";

      export const getPaginatedTransactionsInput = z.object({
        documentId: z.string().min(1),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
        importantOnly: z.boolean().optional(), // Story 4.3 추가
      });
      ```

### Frontend Tasks

- [ ] **Task 7: 중요 거래 배지 컴포넌트** (AC: #3)
  - [ ] `src/components/important-transaction-badge.tsx` 생성:
    - [ ] shadcn/ui Badge 컴포넌트 기반
    - [ ] 시각적 강조: 🔴 아이콘 또는 red-100 배경
    - [ ] 중요 거래 유형별 아이콘:
      - 대출 실행: 💰
      - 변제: 🔄
      - 담보: 🔒
      - 압류: ⚠️
    - [ ] 툴팁: "중요 거래: {유형}"
  - [ ] 접근성 속성:
    - `aria-label`: "중요 거래, {유형}"
    - `role`: "status"

- [ ] **Task 8: TransactionTable 업데이트** (AC: #3, #4)
  - [ ] `src/components/transaction-table.tsx` 수정:
    - [ ] 중요 거래 필터 버튼 추가:
      ```tsx
      <Button
        variant={importantOnly ? "default" : "outline"}
        size="sm"
        onClick={() => setImportantOnly(!importantOnly)}
        aria-label="중요 거래만 보기"
        aria-pressed={importantOnly}
      >
        🔴 중요 거래만 보기
      </Button>
      ```
    - [ ] 중요 거래 행 하이라이트:
      - `importantTransaction === true`인 행에 배경색 추가 (bg-red-50)
      - 첫 번째 컬럼 앞에 ImportantTransactionBadge 표시
    - [ ] tRPC 쿼리에 `importantOnly` 파라미터 전달
  - [ ] 필터 상태 관리:
    - [ ] URL 상태 저장 (useRouter, useSearchParams)
    - [ ] 기본값: false (모든 거래 표시)

- [ ] **Task 9: FindingCard 컴포넌트** (AC: #3)
  - [ ] `src/components/finding-card.tsx` 생성:
    - [ ] shadcn/ui Card 컴포넌트 기반
    - [ ] 발견사항 목록 표시
    - [ ] 심각도별 색상 코딩:
      - CRITICAL: red-600
      - WARNING: amber-600
      - INFO: blue-600
    - [ ] 해제 버튼 및 상태 표시
  - [ ] Finding 상세 정보:
    - [ ] 제목 (title)
    - [ ] 설명 (description)
    - [ ] 관련 거래 링크 (transactionId)
    - [ ] 생성일시 (createdAt)
    - [ ] 해제 상태 (isResolved)

- [ ] **Task 10: i18n 다국어 지원** (MEDIUM #5 Story 4.2 확장)
  - [ ] `src/lib/i18n/locales/ko.json` 추가:
    ```json
    {
      "importantTransaction": {
        "label": "중요 거래",
        "filterButton": "중요 거래만 보기",
        "types": {
          "LOAN_EXECUTION": "대출 실행",
          "REPAYMENT": "변제",
          "COLLATERAL": "담보",
          "SEIZURE": "압류"
        },
        "tooltip": "중요 거래: {type}"
      },
      "finding": {
        "title": "발견사항",
        "severity": {
          "CRITICAL": "긴급",
          "WARNING": "경고",
          "INFO": "정보"
        },
        "resolve": "해제",
        "resolvedAt": "해제일시",
        "noFindings": "발견사항이 없습니다"
      }
    }
    ```
  - [ ] `src/lib/i18n/locales/en.json`에 영어 번역 추가

### Testing Tasks

- [ ] **Task 11: 단위 테스트** (CRITICAL - 품질 보장)
  - [ ] `src/server/ai/important-transaction-detector.test.ts`:
    - [ ] 각 키워드 세트별 테스트 (대출, 변제, 담보, 압류)
    - [ ] 대소문자 무시 테스트
    - [ ] 부분 일치 테스트 (예: "대출금 실행" → "대출 실행" 매칭)
    - [ ] 중복 키워드 처리 테스트
    - [ ] 엣지 케이스: 빈 문자열, null, undefined
  - [ ] `src/components/important-transaction-badge.test.tsx`:
    - [ ] 각 유형별 렌더링 테스트
    - [ ] 아이콘 및 색상 테스트
    - [ ] 접근성 속성 테스트
  - [ ] `src/components/finding-card.test.tsx`:
    - [ ] Finding 렌더링 테스트
    - [ ] 심각도별 스타일 테스트
    - [ ] 해제 버튼 상호작용 테스트

- [ ] **Task 12: 통합 테스트**
  - [ ] AI 분류 후 중요 거래 식별 테스트
  - [ ] Finding 자동 생성 테스트
  - [ ] 필터링 기능 테스트 (importantOnly)

## Dev Notes

### Architecture Compliance

**AI API 통합 (Story 4.1 확장):**
- 기존 AI 공급자 (Upstage Solar, OpenAI, Anthropic) 재사용
- Story 4.1의 classification-service를 확장하여 중요 거래 감지 로직 추가
- 키워드 기반 선처리 → AI 분류 → 결과 병합 패턴

**Prisma ORM 7.2.0+ (Architecture.md#L261-279):**
- Direct Database Access Pattern 사용
- 새로운 Finding 모델과 Transaction 모델 간 관계 정의
- TypeScript Strict Mode 준수

**tRPC v11 (Architecture.md#L261-279):**
- 기존 transaction 라우터 확장
- Zod 스키마에 `importantOnly` 파라미터 추가
- 타입 안전한 API 통신 유지

**React Query v5:**
- Finding 관련 쿼리 훅 생성
- 캐싱 전략: Finding 데이터는 5분 캐시
- invalidation: 중요 거래 식별 시 Finding 캐시 무효화

### Previous Story Intelligence (Story 4.1, Story 4.2)

**Story 4.1 (AI 기반 거래 자동 분류) - 완료:**
- ✅ AI 분류 서비스 구현 (`classification-service.ts`)
- ✅ Upstage Solar, OpenAI, Anthropic 공급자 지원
- ✅ 일괄 처리 최적화 (100건 배치, 최대 5개 배치 병렬)
- ✅ SSE 실시간 진행률 (Story 3.5 재사용)
- ✅ Prisma 스키마: category, subcategory, confidenceScore 필드
- ✅ RBAC: Case lawyer 또는 Admin만 분류 가능
- **적용 패턴:** Story 4.3에서도 동일한 일괄 처리 패턴과 SSE 진행률 재사용

**Story 4.2 (신뢰도 점수 및 불확실한 분류 표시) - 코드 리뷰 완료:**
- ✅ ConfidenceBadge 컴포넌트 (신뢰도 시각화)
- ✅ CONFIDENCE_THRESHOLDS 설정 (HIGH: 0.7, MEDIUM: 0.5)
- ✅ TransactionTable에 신뢰도 컬럼 및 필터
- ✅ i18n 다국어 지원 (ko.json, en.json)
- ✅ URL 기반 정렬 상태 저장
- ✅ 페이지네이션 지원 (MEDIUM #7)
- **적용 패턴:** ImportantTransactionBadge도 동일한 배지 패턴 따르기
- **학습점:** 컴포넌트 재사용성을 위해 badge props 인터페이스 통일

**코드 리뷰 피드백 (Story 4.2):**
- CRITICAL #1: 하드코딩된 상수를 config 파일로 분리 → 적용 완료
- HIGH #2: URL 상태 관리 → useSearchParams 사용 패턴 확립
- HIGH #3: ARIA 라벨 → 접근성 속성 추가 필요
- MEDIUM #7: 페이지네이션 → Prisma skip/take 패턴 확립

### Database Schema Changes

**Prisma Migration - Story 4.3:**

```prisma
// 1. Transaction 모델에 추가할 필드
model Transaction {
  // ... 기존 필드 ...

  // Story 4.3: 중요 거래 식별
  importantTransaction       Boolean?  @default(false)  // 중요 거래 여부
  importantTransactionType   String?                     // LOAN_EXECUTION, REPAYMENT, COLLATERAL, SEIZURE
  importantTransactionKeywords String?                   // 매칭된 키워드 (JSON 배열)

  // Story 4.3: Finding 관계 (일대다)
  findings                   Finding[]

  // ... 기존 인덱스 ...
  @@index([importantTransaction])
  @@index([importantTransactionType])
}

// 2. Finding 모델 (새로 추가)
model Finding {
  id                String      @id @default(cuid())
  caseId            String
  case              Case        @relation(fields: [caseId], references: [id], onDelete: Cascade)
  transactionId     String?
  transaction       Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  findingType       String      // IMPORTANT_TRANSACTION, PRIORITY_REPAYMENT, COLLATERAL_CHANGE, etc.
  title             String
  description       String?     @db.Text
  severity          String      @default("INFO") // INFO, WARNING, CRITICAL
  isResolved        Boolean     @default(false)
  resolvedAt        DateTime?

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([caseId])
  @@index([transactionId])
  @@index([findingType])
  @@index([isResolved])
  @@map("findings")
}

// 3. Case 모델에 Finding 관계 추가
model Case {
  // ... 기존 필드 ...
  findings          Finding[]
}
```

**Migration Commands:**
```bash
npx prisma migrate dev --name add_important_transaction_and_finding
npx prisma generate
```

### File Structure Requirements

**새로운 파일:**
```
src/
├── server/
│   ├── ai/
│   │   └── important-transaction-detector.ts (중요 거래 감지 서비스)
│   └── services/
│       └── finding-service.ts (Finding 생성/관리 서비스)
├── components/
│   ├── important-transaction-badge.tsx (중요 거래 배지)
│   └── finding-card.tsx (발견사항 카드)
└── lib/
    └── constants/
        └── important-keywords.ts (중요 거래 키워드 상수)
```

**수정할 파일:**
```
src/
├── server/
│   ├── ai/
│   │   └── classification-service.ts (중요 거래 감지 로직 추가)
│   └── api/
│       └── routers/
│           ├── transaction.ts (importantOnly 필터, Finding 관련 프로시저)
│           └── finding.ts (새로 생성)
├── components/
│   └── transaction-table.tsx (중요 거래 필터 및 배지 표시)
└── lib/
    └── i18n/
        └── locales/
            ├── ko.json (중요 거래, Finding 관련 번역 추가)
            └── en.json (영어 번역 추가)
```

### Testing Requirements

**단위 테스트 (Vitest + Testing Library):**
- `important-transaction-detector.test.ts`: 키워드 매칭 로직
- `important-transaction-badge.test.tsx`: 배지 렌더링
- `finding-card.test.tsx`: Finding 카드 렌더링
- 최소 커버리지: 80% (중요한 비즈니스 로직)

**통합 테스트:**
- AI 분류 → 중요 거래 식별 → Finding 생성 흐름
- 필터링 기능 (importantOnly)

**E2E 테스트 (선택적):**
- 중요 거래 식별 후 Finding 목록에 표시되는지 확인

### Security & RBAC

**RBAC (Story 4.1 패턴 재사용):**
- Finding 조회: Case lawyer, Paralegal, Admin, Viewer (모든 역할)
- Finding 해제: Case lawyer, Admin만 가능
- tRPC context 기반 권한 체크

**데이터 검증:**
- Zod 스키마로 입력 검증
- SQL Injection 방지 (Prisma 자동 처리)
- XSS 방지 (React 기본 제공)

### Performance Considerations

**쿼리 최적화:**
- `importantTransaction` 인덱스 추가
- Finding 쿼리에 `findingType`, `isResolved` 인덱스 활용
- N+1 쿼리 방지: Prisma include 사용

**AI 분류 성능 (Story 4.1 패턴 재사용):**
- 키워드 선처리로 불필요한 AI 호출 최소화
- 일괄 처리: 100건 배치, 최대 5개 배치 병렬
- 타임아웃: 60초 (NFR-002 준수)

## Dev Agent Record

### Agent Model Used

(개발 완료 후 기록)

### Debug Log References

(개발 중 이슈 발생 시 기록)

### Completion Notes List

(개발 완료 후 기록)

### File List

(개발 완료 후 수정/생성된 파일 목록)
