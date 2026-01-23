# paros BMAD - Project Context

**Generated:** 2026-01-23
**Project:** paros BMAD (Business Money Analysis & Detection)
**Type:** Full-stack Web Application (Legal Tech AI System)
**Version:** 0.1.0

---

## Executive Summary

paros BMAD는 **법률 사무소를 위한 AI 기반 금융 거래 분석 플랫폼**입니다. 파산·개인 회생 사건의 거래 내역을 자동으로 추출, 분류, 분석하여 변호사의 업무 효율을 극대화합니다.

### 핵심 기능
- 📁 **파일 분석**: Excel, CSV, PDF에서 거래 내역 자동 추출
- 🤖 **AI 자동 분류**: 거래 메모 기반 카테고리 자동 분류 (Upstage Solar, OpenAI GPT, Anthropic Claude 지원)
- 🔍 **중요 거래 식별**: 채권자, 담보, 우선변제 관련 거래 자동 감지
- 💰 **자금 흐름 추적**: 상류/하류 거래 연결 및 시각화 (Epic 5)
- 📊 **발견사항 관리**: 자동/수동 발견사항 생성 및 메모 관리 (Epic 6)
- 🔐 **역할 기반 접근 제어 (RBAC)**: LAWYER, PARALEGAL, ADMIN, SUPPORT 권한 관리

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15.2.3 (Pages Router + App Router 혼합)
- **Language**: TypeScript 5.8.2 (Strict mode)
- **Styling**: Tailwind CSS 4.0.15 + shadcn/ui
- **State Management**: TanStack Query 5.69.0 + Zustand (fundFlowFilterStore)
- **Internationalization**: next-intl 4.7.0 (한국어/영어)

### Backend
- **API Layer**: tRPC 11.0.0 (타입 안전한 Full-stack TypeScript)
- **Database**: PostgreSQL + Prisma ORM 6.6.0
- **Authentication**: Custom JWT (Access Token + Refresh Token rotation)
- **File Storage**: AWS S3
- **Job Processing**: node-cron 4.2.1

### AI/ML
- **Providers**: Upstage Solar (한국어 최적화), OpenAI GPT, Anthropic Claude
- **Classification**: Rule-based classifier + AI hybrid (Story 4.8)
- **Analysis**: Transaction nature analyzer (Story 4.4), Important transaction detector (Story 4.3)

### Testing
- **Unit Tests**: Vitest 4.0.16 + Testing Library
- **E2E Tests**: Playwright (Chromium, Firefox, WebKit)
- **Coverage**: V8 (현재 71.01% for Classification Service)

### Deployment
- **Platform**: Netlify (Netlify DB - Neon PostgreSQL)
- **CI/CD**: Netlify Build + Deploy
- **Environment**: Production/Development/Staging

---

## Architecture Pattern

### **Layered Architecture with tRPC**

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js Pages)        │
│  - React Components (src/components/)   │
│  - tRPC Client (src/server/api/)        │
│  - TanStack Query (Data Fetching)       │
└──────────────┬──────────────────────────┘
               │ tRPC (Type-safe RPC)
               ▼
┌─────────────────────────────────────────┐
│       API Layer (tRPC Routers)          │
│  - src/server/api/routers/*.ts          │
│  - protectedProcedure (Auth required)   │
│  - caseAccessProcedure (RBAC)           │
│  - caseModifyProcedure (RBAC)           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Business Logic Layer            │
│  - Services (src/server/services/)      │
│  - AI Classification (src/server/ai/)   │
│  - Audit (src/server/audit/)            │
│  - Jobs (src/server/jobs/)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Data Access Layer               │
│  - Prisma Client (src/server/db.ts)     │
│  - PostgreSQL Database                  │
└─────────────────────────────────────────┘
```

### **Key Architectural Decisions**

1. **tRPC for Type Safety**: 프론트엔드/백엔드 간 타입 안전성 보장
2. **JWT with Refresh Token Rotation**: 보안 강화 (Access Token 15분, Refresh Token 7일)
3. **RBAC Middleware**: tRPC 프로시저 수준에서 권한 강제 (`caseAccessProcedure`, `caseModifyProcedure`)
4. **Hybrid AI Classification**: Rule-based classifier → AI API (Story 4.8, 비용 절감)
5. **Optimistic Locking**: Transaction 테이블의 `version` 필드로 동시 수정 충돌 방지 (HIGH #2)
6. **Audit Logging**: 모든 보안 조치와 데이터 변경 사항 기록 (AuditLog 모델)

---

## Critical Rules for AI Agents

### **1. RBAC (Role-Based Access Control) 항상 준수**

**Roles:**
- `LAWYER`: 사건 소유자, 사件 생성/수정 가능
- `PARALEGAL`: 읽기 전용, 자신의 사건만 접근 가능
- `ADMIN`: 모든 사件 접근/수정 가능
- `SUPPORT`: 읽기 전용, 모든 사件 접근 가능

**RBAC Enforcement:**
```typescript
// ✅ CORRECT: Use caseAccessProcedure for read operations
export const myProcedure = caseAccessProcedure
  .input(z.object({ caseId: z.string() }))
  .query(async ({ ctx, input }) => {
    // ctx.userId is guaranteed to have access to input.caseId
    return ctx.db.case.findUnique({ where: { id: input.caseId } });
  });

// ❌ WRONG: Using protectedProcedure without case access check
export const myProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    // Missing RBAC check - users can access other users' cases
    return ctx.db.case.findMany();
  });
```

### **2. Authentication & Session Management**

**JWT Structure:**
- **Access Token**: 15분 유효, API 요청 시 사용
- **Refresh Token**: 7일 유효, 토큰 갱신용
- **Token Rotation**: Refresh token 사용 시 새 토큰 발급 및 기존 토큰 폐기
- **Token Version Increment**: 보안 조치 후 `user.tokenVersion++` (기존 refresh tokens 무효화)

**Security Best Practices:**
```typescript
// ✅ CORRECT: Verify access token in tRPC context
const decoded = verifyAccessToken(accessToken);
userId = decoded.userId;

// ✅ CORRECT: Increment tokenVersion after sensitive actions
await ctx.db.user.update({
  where: { id: ctx.userId },
  data: { tokenVersion: { increment: 1 } },
});
```

### **3. Database Concurrency Control**

**Optimistic Locking (HIGH #2):**
- Transaction 테이블에 `version` 필드 존재
- 수정 시 `version` 증가 및 충돌 감지
- 충돌 시 409 CONFLICT 에러 반환

### **4. Error Handling & Logging**

**tRPC Error Codes:**
- `UNAUTHORIZED`: 인증 필요 (Access Token 없음 또는 만료)
- `FORBIDDEN`: 권한 없음 (RBAC 위반)
- `NOT_FOUND`: 리소스 없음
- `CONFLICT`: 중복 데이터 또는 동시 수정 충돌
- `BAD_REQUEST`: 잘못된 입력

**Audit Logging (Story 4.5 CRITICAL #2):**
```typescript
// 모든 중요 작업은 AuditLog에 기록
await ctx.db.auditLog.create({
  data: {
    userId: ctx.userId,
    action: "UPDATE",
    entityType: "TRANSACTION_CLASSIFICATION",
    entityId: transactionId,
    changes: { before: original, after: updated },
  },
});
```

### **5. AI Classification Flow (Story 4.1 + Story 4.8)**

**Hybrid Classification Pipeline:**
1. **Rule-Based Classifier** (Story 4.8): 키워드/금액/채권자 패턴 매칭
2. **AI Provider Call** (Story 4.1): 매칭 안 된 거래만 AI API 호출
3. **Transaction Nature Analysis** (Story 4.4): 채권자/담보/우선변제 판단
4. **Important Transaction Detection** (Story 4.3): 주요 거래 식별

**API Provider Selection:**
```typescript
// env.AI_PROVIDER로 선택 (upstage, openai, anthropic)
const provider = env.AI_PROVIDER;
validateAIProviderConfig(); // 해당 API Key 확인
```

### **6. File Upload & Storage (Story 3.3)**

**S3 Upload Flow:**
1. 프론트엔드: S3 Presigned URL 요청 (`/api/analyze/upload`)
2. S3에 직접 업로드 (용량 제한 50MB)
3. 백엔드: S3 Key를 DB에 저장 (`Document` 모델)
4. 백엔드: 비동기 분석 시작 (`FileAnalysisResult`)

### **7. Data Validation**

**Zod Schemas:**
- 모든 tRPC input은 Zod schema로 검증
- Prisma 자동 생성 타입 사용 (`@prisma/client`)
- 커스텀 에러 메시지 (한국어)

**Example:**
```typescript
.input(
  z.object({
    caseNumber: z.string()
      .min(1, "사건번호는 필수 항목입니다")
      .regex(/^\d{4}(하|타)\d{5}$/, "사건번호 형식이 올바르지 않습니다"),
    debtorName: z.string()
      .max(50, "채무자명은 50자 이하여야 합니다")
      .regex(/^[가-힣a-zA-Z\s]+$/, "채무자명은 한글 또는 영문만 입력 가능합니다"),
  })
)
```

---

## Directory Structure

```
paros-bmad/
├── prisma/
│   ├── schema.prisma              # 데이터베이스 스키마 (전체 모델 정의)
│   └── migrations/                 # 마이그레이션 히스토리
├── public/                        # 정적 파일
├── src/
│   ├── app/                       # Next.js App Router (일부 API routes)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui 기본 컴포넌트
│   │   ├── atoms/                 # 최소 단위 컴포넌트 (TagBadge, PrioritySelector)
│   │   ├── molecules/             # 결합된 컴포넌트 (ChainCard, BatchEditDialog)
│   │   └── export/                # 내보내기 관련 컴포넌트
│   ├── contexts/
│   │   ├── AuthContext.tsx        # 인증 상태 관리
│   │   └── ThemeContext.tsx       # 테마 상태 관리
│   ├── hooks/                     # React Hooks
│   ├── lib/
│   │   ├── auth.ts                # JWT 유틸리티
│   │   ├── rbac.ts                # RBAC 함수 (canAccessCase, canModifyCase)
│   │   ├── search/                # 다차원 검색 필터 (Story 8.2)
│   │   └── export/                # 엑셀 내보내기
│   ├── pages/
│   │   ├── api/trpc/[trpc].ts     # tRPC API endpoint
│   │   ├── dashboard/             # 대시보드 페이지
│   │   ├── cases/                 # 사건 관리 페이지
│   │   ├── admin/                 # 관리자 페이지
│   │   └── _app.tsx               # Next.js App Wrapper (Provider 설정)
│   ├── server/
│   │   ├── api/
│   │   │   ├── trpc.ts            # tRPC 설정 (Context, Procedures)
│   │   │   └── routers/           # tRPC 라우터 (각 도메인별)
│   │   │       ├── case.ts        # 사건 관리 (CRUD + Archive)
│   │   │       ├── transaction.ts # 거래 관리 (분류, 수정, 태그)
│   │   │       ├── findings.ts    # 발견사항 (Epic 6)
│   │   │       ├── fundFlow.ts    # 자금 흐름 추적 (Epic 5)
│   │   │       ├── export.ts      # 엑셀 내보내기
│   │   │       └── analytics.ts   # 분석 리포트
│   │   ├── ai/
│   │   │   ├── classification-service.ts        # AI 분류 메인 (Story 4.1)
│   │   │   ├── rule-based-classifier.ts         # 규칙 기반 분류 (Story 4.8)
│   │   │   ├── transaction-nature-analyzer.ts   # 거래 성격 판단 (Story 4.4)
│   │   │   ├── important-transaction-detector.ts # 중요 거래 감지 (Story 4.3)
│   │   │   └── providers/
│   │   │       ├── upstage.ts     # Upstage Solar API
│   │   │       ├── openai.ts      # OpenAI GPT API
│   │   │       └── anthropic.ts   # Anthropic Claude API
│   │   ├── services/
│   │   │   ├── fund-flow-service.ts           # 자금 흐름 추적
│   │   │   ├── transaction-chain-service.ts   # 거래 체인 관리
│   │   │   ├── finding-service.ts             # 발견사항 생성
│   │   │   └── excel-export-service.ts        # 엑셀 내보내기
│   │   ├── audit/
│   │   │   ├── classification-audit.ts        # 분류 감사
│   │   │   ├── finding-audit.ts               # 발견사항 감사
│   │   │   └── audit-log.ts                   # 감사 로그
│   │   ├── jobs/
│   │   │   └── training-job.ts    # 머신러닝 학습 작업 (Story 4.8)
│   │   ├── auth/
│   │   │   ├── config.ts          # NextAuth 설정
│   │   │   └── index.ts           # Auth exports
│   │   └── db.ts                  # Prisma Client Singleton
│   ├── store/
│   │   └── fundFlowFilterStore.ts # 자금 흐름 필터 상태 (Zustand)
│   ├── types/
│   │   └── search.ts              # 검색 필터 타입 정의
│   └── utils/                     # 유틸리티 함수
├── tests/
│   ├── e2e/                       # Playwright E2E 테스트
│   └── support/                   # 테스트 유틸리티
├── .env.example                   # 환경 변수 템플릿
├── next.config.js                 # Next.js 설정
├── tsconfig.json                  # TypeScript 설정
├── vitest.config.ts               # Vitest 설정
└── playwright.config.ts           # Playwright 설정
```

---

## Key Domain Models

### **Core Models**

**User (사용자)**
- `id`, `email`, `password` (bcrypt)
- `role`: LAWYER, PARALEGAL, ADMIN, SUPPORT
- `isActive`: 이메일 인증 상태
- `tokenVersion`: Refresh token rotation (보안)

**Case (사건)**
- `caseNumber` (unique): 사건번호 (ex: 2023하12345)
- `debtorName`: 채무자명
- `status`: PENDING, IN_PROGRESS, COMPLETED, SUSPENDED, CLOSED
- `lawyerId`: 담당 변호사 (FK → User)
- `isArchived`: 아카이브 여부

**Transaction (거래)**
- `transactionDate`: 거래 일자
- `depositAmount`, `withdrawalAmount`: 입출금액
- `memo`: 거래 메모
- `category`, `subcategory`: AI 분류 결과
- `confidenceScore`: AI 신뢰도 (0.0 ~ 1.0)
- `isManuallyClassified`: 수동 수정 여부
- `originalCategory`, `originalSubcategory`: 원본 AI 분류 (복원용)
- `transactionNature`: 거래 성격 (CREDITOR, COLLATERAL, PRIORITY_REPAYMENT, GENERAL)
- `importantTransaction`: 중요 거래 여부
- `version`: 낙관적 잠금 (Optimistic Locking)

**Finding (발견사항)**
- `findingType`: IMPORTANT_TRANSACTION, PRIORITY_REPAYMENT, COLLATERAL_CHANGE
- `severity`: INFO, WARNING, CRITICAL
- `priority`: HIGH, MEDIUM, LOW (사용자 지정 중요도)
- `relatedTransactionIds`: 관련 거래 ID 배열 (JSON)

**ClassificationJob (AI 분류 작업)**
- `status`: processing, completed, failed
- `progress`: 진행률 (0 ~ total)
- `fileAnalysisResultId`: 분석 대상 파일

### **Relationships**

- User ↔ Case: One-to-Many (lawyerId)
- User ↔ Transaction: One-to-Many (through Case)
- Case ↔ Document: One-to-Many
- Document ↔ Transaction: One-to-Many
- Transaction ↔ Finding: One-to-Many
- Transaction ↔ Tag: Many-to-Many (TransactionTag join table)

---

## Common Patterns

### **1. Creating a New tRPC Router**

```typescript
// src/server/api/routers/myRouter.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const myRouter = createTRPCRouter({
  // Query (Read)
  getItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.myModel.findUnique({
        where: { id: input.id },
      });
    }),

  // Mutation (Write)
  createItem: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.myModel.create({
        data: input,
      });
    }),
});
```

### **2. Adding RBAC to Procedures**

```typescript
import { caseAccessProcedure, caseModifyProcedure } from "~/server/api/trpc";

// Read-only with case access check
export const myRouter = createTRPCRouter({
  viewCase: caseAccessProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ctx.userId has access to input.caseId
      return ctx.db.case.findUnique({ where: { id: input.caseId } });
    }),

  // Write with case modification check
  updateCase: caseModifyProcedure
    .input(z.object({
      caseId: z.string(),
      debtorName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.userId can modify input.caseId
      return ctx.db.case.update({
        where: { id: input.caseId },
        data: { debtorName: input.debtorName },
      });
    }),
});
```

### **3. Error Handling**

```typescript
import { TRPCError } from "@trpc/server";

// Not Found
if (!item) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "항목을 찾을 수 없습니다",
  });
}

// Forbidden (RBAC)
if (!hasAccess) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "권한이 없습니다",
  });
}

// Conflict (Duplicate)
if (existing) {
  throw new TRPCError({
    code: "CONFLICT",
    message: "이미 존재하는 항목입니다",
  });
}
```

### **4. Audit Logging**

```typescript
import { AuditLogAction, AuditLogEntityType } from "~/server/audit/audit-log";

await ctx.db.auditLog.create({
  data: {
    userId: ctx.userId,
    action: "UPDATE",
    entityType: "TRANSACTION_CLASSIFICATION",
    entityId: transactionId,
    changes: {
      before: { category: original.category },
      after: { category: updated.category },
    },
    ipAddress: ctx.req.headers["x-forwarded-for"] as string,
    userAgent: ctx.req.headers["user-agent"],
  },
});
```

### **5. Transaction with Optimistic Locking**

```typescript
const updated = await ctx.db.transaction.update({
  where: {
    id: input.id,
    version: input.version, // Conflict detection
  },
  data: {
    category: input.category,
    version: { increment: 1 }, // Increment version
  },
});

if (!updated) {
  throw new TRPCError({
    code: "CONFLICT",
    message: "다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.",
  });
}
```

---

## Environment Variables

### **Required**

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# JWT (Secret keys)
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
JWT_ACCESS_TOKEN_EXPIRES_IN="15m"
JWT_REFRESH_TOKEN_EXPIRES_IN="7d"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### **AI Provider (Choose One)**

```bash
# Upstage Solar (한국어 최적화, 추천)
AI_PROVIDER="upstage"
UPSTAGE_API_KEY="your-upstage-api-key"

# OR OpenAI GPT
AI_PROVIDER="openai"
OPENAI_API_KEY="your-openai-api-key"

# OR Anthropic Claude
AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### **Optional**

```bash
# AWS S3 (File Upload)
AWS_S3_BUCKET="your-bucket-name"
AWS_S3_REGION="ap-northeast-2"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

---

## Testing Guidelines

### **Unit Tests (Vitest)**

```bash
# Run tests in watch mode
npm run test

# Run all tests once
npm run test:run

# Generate coverage report
npm run test:coverage
```

**Test File Location:** Same directory as source file (`.test.ts` suffix)

**Example:**
```typescript
// src/lib/myUtils.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./myUtils";

describe("myFunction", () => {
  it("should return correct result", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

### **E2E Tests (Playwright)**

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e:headed
```

**Test Location:** `tests/e2e/`

---

## Deployment

### **Netlify (Recommended)**

```bash
# Install Netlify CLI
npm i -g netlify

# Login
netlify login

# Deploy to production
npm run netlify:deploy
```

**Build Command:** `npm run netlify:build`
**Publish Directory:** `.next`
**Node Version:** 18+

### **Environment Variables in Netlify**

Set in Netlify Dashboard:
- `DATABASE_URL`
- `JWT_SECRET`
- `AI_PROVIDER`
- `{PROVIDER}_API_KEY`

---

## Troubleshooting

### **Common Issues**

**1. tRPC Error: "UNAUTHORIZED"**
- Cause: Access token expired or missing
- Solution: Refresh token using `/api/auth/refresh`

**2. Prisma Error: "Unique constraint failed"**
- Cause: Duplicate record (e.g., caseNumber already exists)
- Solution: Check for existing records before creation

**3. AI Classification Timeout**
- Cause: AI API not responding within 15s
- Solution: Check API key, retry with exponential backoff

**4. File Upload Failed**
- Cause: File size exceeds 50MB limit
- Solution: Compress file or increase limit in `next.config.js`

---

## References

### **Documentation**
- [Next.js Docs](https://nextjs.org/docs)
- [tRPC Docs](https://trpc.io/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### **Internal Docs**
- [Netlify Deployment Guide](./NETLIFY_DEPLOYMENT.md)
- [Architecture Decision Records](./docs/architecture/)
- [API Reference](./docs/api/)

---

**Last Updated:** 2026-01-23
**Maintained By:** BMAD Development Team
