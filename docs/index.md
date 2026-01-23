# paros BMAD - Documentation Index

**Generated:** 2026-01-23
**Version:** 0.1.0
**Project:** Business Money Analysis & Detection (법률 사건 금융 거래 분석 플랫폼)

---

## Quick Reference

- **Type:** Full-stack Web Application (Legal Tech AI)
- **Framework:** Next.js 15 + tRPC + Prisma + PostgreSQL
- **Language:** TypeScript (Strict Mode)
- **Deployment:** Netlify (Netlify DB - Neon PostgreSQL)
- **Authentication:** JWT with Refresh Token Rotation
- **Status:** 🟢 Active Development

---

## Getting Started

### **For New Developers**

1. **Read This First:** [Project Context](./project-context.md)
   - Critical rules for AI agents
   - Technology stack overview
   - Common patterns
   - Troubleshooting

2. **Understand the Architecture:** [Architecture Documentation](./architecture.md)
   - System design and data flow
   - Security model (RBAC)
   - Database schema
   - Deployment architecture

3. **API Reference:** [API Contracts](./api-contracts.md)
   - All tRPC procedures
   - Input/output schemas
   - Authentication requirements
   - Error codes

### **Quick Setup**

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Initialize database
npx prisma migrate deploy
npx prisma generate

# 4. Start development server
npm run dev
```

**Access:** http://localhost:3000

---

## Documentation Index

### **Core Documentation**

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [**Project Context**](./project-context.md) | Critical rules, patterns, and conventions for AI-assisted development | 2026-01-23 |
| [**Architecture**](./architecture.md) | System architecture, data flow, security, and scaling strategy | 2026-01-23 |
| [**API Contracts**](./api-contracts.md) | Complete tRPC API reference with examples | 2026-01-23 |
| [**Netlify Deployment**](./NETLIFY_DEPLOYMENT.md) | Deployment guide for Netlify platform | Existing |

### **Supporting Documentation**

| Document | Description | Status |
|----------|-------------|--------|
| **Data Models** | Prisma schema reference (see `project-context.md`) | ✅ Included |
| **Component Library** | shadcn/ui + custom components | 📋 Planned |
| **Testing Guide** | Unit and E2E testing patterns | 📋 Planned |
| **Contributing** | Development workflow and PR guidelines | 📋 Planned |

---

## Project Overview

### **What is paros BMAD?**

**Business Money Analysis & Detection** - An AI-powered platform for bankruptcy/rehabilitation law firms to analyze financial transactions.

**Key Capabilities:**
- 📁 **File Analysis**: Automatic extraction from Excel, CSV, PDF
- 🤖 **AI Classification**: Transaction categorization using Upstage Solar, OpenAI GPT, or Anthropic Claude
- 🔍 **Important Transaction Detection**: Identify creditor, collateral, and priority repayment transactions
- 💰 **Fund Flow Tracking**: Trace upstream/downstream money flows (Epic 5)
- 📊 **Finding Management**: Auto-generate and track important findings (Epic 6)
- 🔐 **Role-Based Access Control**: LAWYER, PARALEGAL, ADMIN, SUPPORT roles

### **Target Users**

- **Bankruptcy Lawyers**: Analyze transaction patterns for cases
- **Paralegals**: Prepare case documents and reports
- **Law Firms**: Manage multiple cases efficiently

---

## Architecture Summary

### **Technology Stack**

**Frontend:**
- Next.js 15.2.3 (Pages + App Router)
- React 19.0.0
- TypeScript 5.8.2
- Tailwind CSS 4.0.15 + shadcn/ui
- TanStack Query 5.69.0

**Backend:**
- tRPC 11.0.0 (Type-safe RPC)
- Prisma ORM 6.6.0
- PostgreSQL (Neon on Netlify)
- Custom JWT Authentication

**AI/ML:**
- Upstage Solar (한국어 최적화)
- OpenAI GPT
- Anthropic Claude
- Rule-based classifier (hybrid approach)

**Testing:**
- Vitest 4.0.16 (Unit tests)
- Playwright (E2E tests)

### **Architecture Pattern**

```
┌─────────────────┐
│   Frontend      │  Next.js Pages + React Components
│   (Next.js)     │  TanStack Query (State Management)
└────────┬────────┘
         │ tRPC (Type-safe RPC)
         ▼
┌─────────────────┐
│   API Layer     │  tRPC Routers (Protected Procedures)
│   (tRPC)        │  RBAC Middleware (Authorization)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Business Logic │  Services (Fund Flow, Findings, Export)
│   (Services)    │  AI Classification (Hybrid Rule + AI)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Data Access   │  Prisma ORM (Type-safe Queries)
│   (Prisma)      │  PostgreSQL Database
└─────────────────┘
```

**Key Design Decisions:**
- **Type Safety**: tRPC provides end-to-end TypeScript types
- **Security**: JWT with refresh token rotation, RBAC at procedure level
- **Performance**: Rule-based classifier before AI calls (40% cost reduction)
- **Scalability**: Optimistic locking, database indexes, batch processing

---

## Development Guidelines

### **Critical Rules (MUST READ)**

1. **RBAC Compliance**
   - Use `caseAccessProcedure` for read operations on cases
   - Use `caseModifyProcedure` for write operations on cases
   - Never bypass RBAC checks

2. **Error Handling**
   - Use tRPC error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`
   - Provide Korean error messages for users
   - Log errors to console for debugging

3. **Audit Logging**
   - Log all sensitive actions (classification changes, finding updates)
   - Use `AuditLog` model for comprehensive tracking
   - Include `before` and `after` state in changes

4. **Database Operations**
   - Use Prisma Client for all database operations
   - Implement optimistic locking for transactions (`version` field)
   - Use transactions for multi-step operations

5. **Type Safety**
   - Define all input schemas with Zod
   - Use Prisma-generated types (`@prisma/client`)
   - Never use `any` type

### **Code Patterns**

**Creating a New tRPC Router:**
```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const myRouter = createTRPCRouter({
  getItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.myModel.findUnique({ where: { id: input.id } });
    }),
});
```

**RBAC-Protected Procedure:**
```typescript
import { caseAccessProcedure } from "~/server/api/trpc";

export const myRouter = createTRPCRouter({
  viewCase: caseAccessProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ctx.userId guaranteed to have access to input.caseId
      return ctx.db.case.findUnique({ where: { id: input.caseId } });
    }),
});
```

**Error Handling:**
```typescript
import { TRPCError } from "@trpc/server";

if (!item) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "항목을 찾을 수 없습니다",
  });
}
```

---

## API Reference

### **Core Routers**

| Router | Purpose | Key Procedures |
|--------|---------|----------------|
| [`case`](./api-contracts.md#case-router) | Case Management | createCase, getCases, updateCase, archiveCase |
| [`transaction`](./api-contracts.md#transaction-router) | Transaction Operations | classifyTransactions, updateClassification, getPaginatedTransactions |
| [`findings`](./api-contracts.md#findings-router) | Finding Management | getFindingsForCase, resolveFinding, updatePriority |
| [`fundFlow`](./api-contracts.md#fund-flow-router) | Fund Flow Tracking (Epic 5) | traceUpstream, traceDownstream, getVisualizationData |
| [`export`](./api-contracts.md#export-router) | Excel Export | exportTransactions, exportFindings |
| [`analytics`](./api-contracts.md#analytics-router) | Analytics Reports | getCategoryStats, getTimelineAnalysis |

### **Authentication**

**All API requests require JWT Access Token:**
```http
Authorization: Bearer <access_token>
```

**Token Lifecycle:**
- Access Token: 15 minutes (use for API calls)
- Refresh Token: 7 days (use to get new access token)
- Refresh Endpoint: `POST /api/auth/refresh`

**RBAC Roles:**
- `LAWYER`: Full access to own cases
- `PARALEGAL`: Read-only access to own cases
- `ADMIN`: Full access to all cases
- `SUPPORT`: Read-only access to all cases

---

## Database Schema

### **Core Models**

**User**
- `id`, `email`, `password` (bcrypt)
- `role`: LAWYER, PARALEGAL, ADMIN, SUPPORT
- `isActive`: Email verification status
- `tokenVersion`: Refresh token rotation

**Case**
- `caseNumber` (unique): 사건번호 (ex: 2023하12345)
- `debtorName`: 채무자명
- `status`: PENDING, IN_PROGRESS, COMPLETED, SUSPENDED, CLOSED
- `lawyerId`: 담당 변호사

**Transaction**
- `transactionDate`, `depositAmount`, `withdrawalAmount`, `memo`
- `category`, `subcategory`: AI 분류 결과
- `confidenceScore`: AI 신뢰도 (0.0 ~ 1.0)
- `transactionNature`: CREDITOR, COLLATERAL, PRIORITY_REPAYMENT, GENERAL
- `importantTransaction`: 중요 거래 여부
- `version`: Optimistic locking

**Finding**
- `findingType`: IMPORTANT_TRANSACTION, PRIORITY_REPAYMENT, COLLATERAL_CHANGE
- `severity`: INFO, WARNING, CRITICAL
- `priority`: HIGH, MEDIUM, LOW (사용자 지정)
- `relatedTransactionIds`: 관련 거래 ID 배열

**Relationships:**
- User ↔ Case: One-to-Many
- Case ↔ Document ↔ Transaction: One-to-Many
- Transaction ↔ Finding: One-to-Many
- Transaction ↔ Tag: Many-to-Many

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

**Environment Variables (Netlify Dashboard):**
- `DATABASE_URL` (Netlify DB Neon)
- `JWT_SECRET`
- `AI_PROVIDER` (upstage, openai, or anthropic)
- `{PROVIDER}_API_KEY`
- `AWS_S3_BUCKET`, `AWS_S3_REGION` (for file uploads)

**Build Configuration:**
- Build Command: `npm run build`
- Publish Directory: `.next`
- Node Version: 18+

### **Monitoring**

- **Netlify Analytics**: Page views, performance
- **Audit Logs**: User actions in database
- **Error Tracking**: Browser console + server logs

---

## Testing

### **Unit Tests (Vitest)**

```bash
# Watch mode
npm run test

# Single run
npm run test:run

# Coverage report
npm run test:coverage
```

**Current Coverage:** ~70% (Classification Service, components)

### **E2E Tests (Playwright)**

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

---

## Troubleshooting

### **Common Issues**

**"UNAUTHORIZED" Error**
- Cause: Access token expired or missing
- Solution: Refresh token using `/api/auth/refresh`

**"FORBIDDEN" Error**
- Cause: RBAC violation (no access to resource)
- Solution: Check user role and case ownership

**"CONFLICT" Error**
- Cause: Duplicate case number or version mismatch
- Solution: Use unique case number, refresh data before update

**AI Classification Timeout**
- Cause: AI API not responding within 15s
- Solution: Check API key, retry with exponential backoff

**File Upload Failed**
- Cause: File size exceeds 50MB limit
- Solution: Compress file or increase limit in `next.config.js`

---

## Contributing

### **Development Workflow**

1. **Branch**: Create feature branch from `main`
2. **Develop**: Follow code patterns and guidelines
3. **Test**: Run unit tests and E2E tests
4. **Document**: Update relevant documentation
5. **PR**: Create pull request with description
6. **Review**: Code review and address feedback
7. **Merge**: Squash and merge to `main`

### **Commit Conventions**

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code
test: Add/update tests
chore: Maintenance tasks
```

---

## Support

### **Documentation Issues**
- Create an issue in the repository
- Tag with `documentation` label

### **Technical Questions**
- Check [Project Context](./project-context.md) first
- Review [Architecture Documentation](./architecture.md)
- Search existing GitHub issues

### **Bug Reports**
- Use GitHub Issues
- Include: Steps to reproduce, expected behavior, actual behavior
- Attach logs/screenshots if applicable

---

## Roadmap

### **Completed** ✅
- Core case management
- File upload and analysis
- AI transaction classification (Story 4.1)
- Important transaction detection (Story 4.3)
- Transaction nature analysis (Story 4.4)
- Manual classification restore (Story 4.5)
- Tag management (Story 4.6)
- Rule-based classifier (Story 4.8)
- Fund flow tracking (Epic 5)
- Finding management (Epic 6)

### **In Progress** 🚧
- Advanced filtering (Story 5.5)
- Multidimensional search (Story 8.2)

### **Planned** 📋
- Real-time collaboration
- Custom report templates
- Mobile app (React Native)
- ML model training (Story 4.8)
- Advanced analytics dashboards
- External API integrations

---

## Changelog

### **Version 0.1.0** (2026-01-23)
- Initial release
- Core features implemented
- Documentation generation

---

**Last Updated:** 2026-01-23
**Maintained By:** BMAD Development Team
**License:** Commercial (All Rights Reserved)
