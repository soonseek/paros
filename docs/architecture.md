# paros BMAD - Architecture Documentation

**Generated:** 2026-01-23
**Version:** 0.1.0
**Architecture Style:** Layered Architecture with tRPC

---

## Executive Summary

paros BMAD는 **TypeScript 풀스택 법륌 테크 애플리케이션**으로, Next.js 15, tRPC, Prisma ORM, PostgreSQL을 기반으로 구축되었습니다. AI 기반 거래 분류, 자금 흐름 추적, 발견사항 관리 등의 고급 기능을 제공합니다.

### **Key Architectural Decisions**

1. **tRPC for End-to-End Type Safety**: 프론트엔드/백엔드 간 타입 안전성 보장
2. **JWT with Refresh Token Rotation**: 보안 강화 및 세션 관리
3. **RBAC at Procedure Level**: tRPC 미들웨어에서 권한 강제
4. **Hybrid AI Classification**: Rule-based → AI (비용 최적화)
5. **Optimistic Locking**: 동시 수정 충돌 방지
6. **Audit Logging**: 모든 보안 조치와 데이터 변경 기록

---

## System Architecture

### **High-Level Architecture**

```
┌──────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │  Mobile Web  │  │   Future     │      │
│  │  (React 19)  │  │  (Responsive)│  │   Native App │      │
│  └───────┬──────┘  └──────┬───────┘  └──────┬───────┘      │
└──────────┼──────────────────┼──────────────────┼─────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Presentation Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Next.js 15 (Pages + App Router)           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │  Pages   │  │  App Dir │  │ API Routes       │   │   │
│  │  │(src/pages)│  │(src/app) │  │(src/pages/api)  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                   │
│  ┌────────────────────────┼──────────────────────────────┐  │
│  │       UI Components     │    State Management         │  │
│  │  ┌───────────────────┐ │  ┌──────────────────────┐  │  │
│  │  │  shadcn/ui        │ │  │ TanStack Query        │  │  │
│  │  │  Atoms/Molecules  │ │  │ Zustand (Filters)     │  │  │
│  │  │  (src/components/)│ │  │ (React Context)       │  │  │
│  │  └───────────────────┘ │  └──────────────────────┘  │  │
│  └────────────────────────┴──────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ tRPC (Type-safe RPC)
┌────────────────────────────┴────────────────────────────────┐
│                     API Layer (tRPC)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              tRPC Server (src/server/api/)            │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │         Context Creation                     │   │   │
│  │  │  - JWT Verification (Access Token)           │   │   │
│  │  │  - User ID Extraction                        │   │   │
│  │  │  - Database Injection                        │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │         Procedures (Middlewares)             │   │   │
│  │  │  - publicProcedure (No auth)                 │   │   │
│  │  │  - protectedProcedure (Auth required)        │   │   │
│  │  │  - caseAccessProcedure (Auth + RBAC)         │   │   │
│  │  │  - caseModifyProcedure (Auth + RBAC write)   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │         Routers (Domain Logic)               │   │   │
│  │  │  - case.ts, transaction.ts, findings.ts      │   │   │
│  │  │  - fundFlow.ts, export.ts, analytics.ts      │   │   │
│  │  │  - tag.ts, user.ts, settings.ts              │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                  Business Logic Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       Services (src/server/services/)               │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │ Fund Flow      │  │ Finding        │             │   │
│  │  │ - Trace Up/Down│  │ - Generate     │             │   │
│  │  │ - Chain Build  │  │ - Priority     │             │   │
│  │  └────────────────┘  └────────────────┘             │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │ Excel Export   │  │ Creditors      │             │   │
│  │  │ - Column Select│  │ - Extract      │             │   │
│  │  │ - Format       │  │ - Group        │             │   │
│  │  └────────────────┘  └────────────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       AI Classification (src/server/ai/)            │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  Classification Service (Main Orchestrator)  │   │   │
│  │  │  - classifyTransactions()                    │   │   │
│  │  │  - classifyTransactionsInBatches()           │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  Hybrid Pipeline (Story 4.8)                 │   │   │
│  │  │  1. Rule-Based Classifier (Cost Optimize)   │   │   │
│  │  │  2. AI Provider Call (Unmatched only)       │   │   │
│  │  │  3. Transaction Nature Analyzer             │   │   │
│  │  │  4. Important Transaction Detector          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  AI Providers (Pluggable)                    │   │   │
│  │  │  - Upstage Solar (한국어 최적화)            │   │   │
│  │  │  - OpenAI GPT (다국어)                      │   │   │
│  │  │  - Anthropic Claude (긴 컨텍스트)          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       Audit & Security (src/server/audit/)          │   │
│  │  - Classification Audit (User changes)              │   │
│  │  - Finding Audit (Priority updates)                │   │
│  │  - Fund Flow Audit (Trace operations)              │   │
│  │  - Audit Log (Universal audit trail)               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                  Data Access Layer                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Prisma ORM (src/server/db.ts)                │   │
│  │  - Type-safe Database Access                        │   │
│  │  - Query Builder                                    │   │
│  │  - Migration Management                             │   │
│  │  - Connection Pooling                               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                    Data Layer (PostgreSQL)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Database Schema (Prisma)                │   │
│  │  Core Models:                                        │   │
│  │  - User, Case, Document, Transaction               │   │
│  │  - Finding, ClassificationJob                       │   │
│  │  - Tag, TransactionTag                              │   │
│  │  - AuditLog, SystemSetting                          │   │
│  │  Epic 5 Models:                                      │   │
│  │  - TransactionRelation, TransactionChain            │   │
│  │  - SavedFilter                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Infrastructure                          │   │
│  │  - Netlify DB (Neon PostgreSQL)                     │   │
│  │  - Automated Backups                                 │   │
│  │  - Read Replicas (Future)                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### **Frontend Components (src/components/)**

```
components/
├── ui/                          # shadcn/ui base components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   └── ...
├── atoms/                       # Atomic design: atoms
│   ├── tag-badge.tsx            # Tag display with color coding
│   ├── priority-selector.tsx    # Finding priority selector
│   └── ...
├── molecules/                   # Atomic design: molecules
│   ├── chain-card.tsx           # Transaction chain display
│   ├── chain-visualization.tsx  # Flow diagram (React Flow)
│   ├── batch-edit-dialog.tsx    # Bulk edit interface
│   ├── fund-flow-filter-panel.tsx  # Filter sidebar
│   └── ...
├── export/                      # Export feature components
│   ├── export-options-modal.tsx
│   ├── column-selector.tsx
│   └── finding-filter-options.tsx
├── ai-classification-button.tsx  # AI classification trigger
├── transaction-table.tsx         # Main data grid
├── finding-card.tsx             # Finding display
└── upload-zone.tsx              # File upload interface
```

**Component Patterns:**
- **Atomic Design**: atoms → molecules → organisms
- **Composition**: Small components compose larger features
- **Reusability**: Shared logic in custom hooks (`src/hooks/`)
- **Type Safety**: All props typed with TypeScript

---

## Data Flow

### **1. Authentication Flow**

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. POST /api/auth/login
     │    { email, password }
     ▼
┌──────────────────┐
│  Auth Handler    │
│  (NextAuth)      │
└────┬─────────────┘
     │
     │ 2. Verify credentials
     ▼
┌──────────────────┐
│   Database       │
│   (User table)   │
└────┬─────────────┘
     │
     │ 3. Generate tokens
     ▼
┌──────────────────┐
│  JWT Service     │
│  - Access Token  │ (15 min)
│  - Refresh Token │ (7 days)
└────┬─────────────┘
     │
     │ 4. Return tokens
     ▼
┌──────────────────┐
│  Client Storage  │
│  - Memory (AT)   │
│  - HttpOnly (RT) │
└──────────────────┘

Subsequent Requests:
Client → tRPC Context → Verify Access Token → Extract userId → Proceed
```

**Token Refresh Flow:**
```
Client ─(1)──> tRPC Procedure
           <─(401)── Expired Access Token
Client ─(2)──> POST /api/auth/refresh
              { refreshToken }
           <─(200)── New Access Token
Client ─(3)──> Retry tRPC Procedure
```

---

### **2. File Upload & Analysis Flow**

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. POST /api/analyze/upload
     │    { filename, fileType }
     ▼
┌──────────────────┐
│   Backend        │
│  Generate S3     │
│  Presigned URL   │
└────┬─────────────┘
     │
     │ 2. Return presigned URL
     ▼
┌──────────┐
│  Client  │───3. Upload to S3───> ┌──────────┐
└────┬─────┘                            │   S3    │
     │                                  └──────────┘
     │ 4. POST /api/analyze/complete
     │    { s3Key, caseId }
     ▼
┌──────────────────┐
│   Backend        │
│  Create Document │
│  Record in DB    │
└────┬─────────────┘
     │
     │ 5. Trigger async analysis
     ▼
┌──────────────────┐
│  Analysis Job    │
│  - Extract data  │
│  - Map columns   │
│  - Save results  │
└────┬─────────────┘
     │
     │ 6. Complete
     ▼
┌──────────────────┐
│  FileAnalysis    │
│  Result (status: │
│   completed)     │
└──────────────────┘
```

---

### **3. AI Classification Flow (Story 4.1 + 4.8)**

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. mutation transaction.classifyTransactions
     │    { documentId }
     ▼
┌──────────────────┐
│  tRPC Router     │
│  (transaction)   │
└────┬─────────────┘
     │
     │ 2. Fetch transactions
     ▼
┌──────────────────┐
│  Database        │
│  Transaction     │
│  Records         │
└────┬─────────────┘
     │
     │ 3. classifyTransactionsInBatches()
     ▼
┌──────────────────────────────┐
│  Classification Service      │
│  (src/server/ai/)           │
└────┬───────────────────────┘
     │
     ├─> 4a. Rule-Based Classifier (Story 4.8)
     │    - Match keywords/amounts/creditors
     │    - ✓ Match: Use rule result (NO AI call)
     │    - ✗ No match: Continue to AI
     │
     ├─> 4b. AI Provider Call (Story 4.1)
     │    - Upstage Solar / OpenAI / Anthropic
     │    - Batch processing (100 tx/batch)
     │    - Retry with exponential backoff (3x)
     │
     ├─> 4c. Transaction Nature Analyzer (Story 4.4)
     │    - Detect creditor/collateral/priority
     │    - Pattern matching on memo + amount
     │
     └─> 4d. Important Transaction Detector (Story 4.3)
          - Match high-value keywords
          - Flag as important if matched
     │
     │ 5. Save results
     ▼
┌──────────────────┐
│  Database        │
│  Update          │
│  Transactions    │
└────┬─────────────┘
     │
     │ 6. Poll for progress
     ▼
┌──────────────────┐
│  query           │
│  getClassificationStatus
│  { jobId }        │
└────┬─────────────┘
     │
     │ 7. Return status
     ▼
┌──────────┐
│  Client  │
└──────────┘
```

**Performance Optimizations:**
- **Rule-based first**: Reduce AI API calls by ~40%
- **Batch processing**: 100 transactions per batch
- **Concurrent batches**: Max 5 batches in parallel
- **Progress tracking**: Real-time UI updates

---

### **4. Fund Flow Tracing Flow (Epic 5)**

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. query fundFlow.traceUpstream
     │    { transactionId, caseId, maxDepth, filters }
     ▼
┌──────────────────┐
│  tRPC Router     │
│  (fundFlow)      │
└────┬─────────────┘
     │
     │ 2. Load start transaction
     ▼
┌──────────────────┐
│  Database        │
│  Get start tx    │
└────┬─────────────┘
     │
     │ 3. traceUpstreamFunds()
     ▼
┌──────────────────────────────┐
│  Fund Flow Service           │
│  (src/server/services/)     │
└────┬───────────────────────┘
     │
     ├─> 4a. Find related withdrawals
     │    - Amount: ±10% tolerance
     │    - Date: Before start date
     │    - Confidence scoring
     │
     ├─> 4b. Build chains (maxDepth: 5)
     │    - Recursive BFS traversal
     │    - Circular reference detection
     │    - Store in TransactionChain table
     │
     └─> 4c. Apply filters (Story 5.5)
          - Transaction nature
          - Category
          - Tags
          - Amount range
     │
     │ 5. Return chains + visualization data
     ▼
┌──────────────────┐
│  Client          │
│  Render React    │
│  Flow diagram    │
└──────────────────┘
```

**Algorithm:**
- **BFS Traversal**: Level-by-level exploration
- **Confidence Scoring**: Amount match (50%) + Date proximity (50%)
- **Performance**: Pre-calculated chains (< 3s per NFR-003)

---

## Security Architecture

### **Authentication & Authorization**

```
┌─────────────────────────────────────────────────────────┐
│                  Security Layers                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │  1. Network Security                              │ │
│  │     - HTTPS only (TLS 1.3)                       │ │
│  │     - CORS headers (next.config.js)              │ │
│  │     - Rate limiting (100 req/min)                │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  2. Authentication                               │ │
│  │     - JWT Access Token (15 min)                  │ │
│  │     - Refresh Token (7 days, rotation)           │ │
│  │     - HttpOnly cookies (XSS protection)          │ │
│  │     - Token versioning (session invalidation)    │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  3. Authorization (RBAC)                         │ │
│  │     - Role-based access control                  │ │
│  │     - Procedure-level enforcement                │ │
│  │     - Case ownership validation                  │ │
│  │     - Audit logging for sensitive actions        │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  4. Data Protection                              │ │
│  │     - Password hashing (bcrypt)                  │ │
│  │     - Sensitive field encryption (SystemSetting) │ │
│  │     - SQL injection prevention (Prisma)          │ │
│  │     - XSS prevention (React escaping)            │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  5. Audit & Monitoring                           │ │
│  │     - Comprehensive audit logs                   │ │
│  │     - IP address logging                         │ │
│  │     - User agent tracking                        │ │
│  │     - Change history (before/after)              │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### **RBAC Matrix**

| Operation | LAWYER | PARALEGAL | ADMIN | SUPPORT |
|-----------|--------|-----------|-------|---------|
| Create cases | ✅ | ❌ | ✅ | ❌ |
| View own cases | ✅ | ✅ | ✅ | ✅ |
| View all cases | ❌ | ❌ | ✅ | ✅ |
| Update own cases | ✅ | ❌ | ✅ | ❌ |
| Delete cases | ❌ | ❌ | ✅ | ❌ |
| Classify transactions | ✅ | ❌ | ✅ | ❌ |
| Update classification | ✅ | ❌ | ✅ | ❌ |
| Resolve findings | ✅ | ❌ | ✅ | ❌ |
| Export data | ✅ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ | ❌ |
| System settings | ❌ | ❌ | ✅ | ❌ |

---

## Database Schema

### **Entity Relationships**

```
User (1) ──< (N) Case
  │                │
  │                │
  │                ├─> (1) Document (1) ──< (N) Transaction
  │                │                │
  │                │                ├─> (N) Finding
  │                │                ├─> (N) TransactionTag (M) ──< (N) Tag
  │                │                │
  │                │                └─> (1) ClassificationJob
  │                │
  │                ├─> (N) CaseNote
  │                │
  │                ├─> (N) FileAnalysisResult
  │                │
  │                └─> (N) Finding
  │
  └─> (N) RefreshToken
  └─> (N) AuditLog

Transaction ──> (M) TransactionRelation (M) ──< Transaction
   │                                          │
   └─> (N) TransactionChain (upstream)        └─> (N) TransactionChain (downstream)
```

### **Indexes for Performance**

```sql
-- User authentication
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Case queries
CREATE INDEX idx_cases_lawyer_id ON cases(lawyer_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_is_archived ON cases(is_archived);
CREATE INDEX idx_cases_case_number ON cases(case_number);

-- Transaction filtering
CREATE INDEX idx_transactions_case_id ON transactions(case_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_ai_classification_status ON transactions(ai_classification_status);
CREATE INDEX idx_transactions_important_transaction ON transactions(important_transaction);
CREATE INDEX idx_transactions_transaction_nature ON transactions(transaction_nature);
CREATE INDEX idx_transactions_is_manually_classified ON transactions(is_manually_classified);

-- Finding queries
CREATE INDEX idx_findings_case_id ON findings(case_id);
CREATE INDEX idx_findings_transaction_id ON findings(transaction_id);
CREATE INDEX idx_findings_finding_type ON findings(finding_type);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_priority ON findings(priority);
CREATE INDEX idx_findings_is_resolved ON findings(is_resolved);

-- Fund flow tracing (Epic 5)
CREATE INDEX idx_transaction_relations_case_id ON transaction_relations(case_id);
CREATE INDEX idx_transaction_relations_source_tx_id ON transaction_relations(source_tx_id);
CREATE INDEX idx_transaction_relations_target_tx_id ON transaction_relations(target_tx_id);
CREATE INDEX idx_transaction_chains_case_id ON transaction_chains(case_id);
CREATE INDEX idx_transaction_chains_start_tx_id ON transaction_chains(start_tx_id);
CREATE INDEX idx_transaction_chains_end_tx_id ON transaction_chains(end_tx_id);

-- Audit logging
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## Deployment Architecture

### **Netlify Deployment**

```
┌────────────────────────────────────────────────────────┐
│                  Netlify Edge                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │  CDN + Edge Functions                            │ │
│  │  - Static asset caching (.next/static/)          │ │
│  │  - Image optimization                            │ │
│  │  - Edge authentication (future)                  │ │
│  └──────────────────────────────────────────────────┘ │
└────────┬───────────────────────────────────────────┘
         │
         │ Git Push
         ▼
┌────────────────────────────────────────────────────────┐
│              Netlify Build Pipeline                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │  1. Install Dependencies                         │ │
│  │     npm ci                                       │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  2. Run Tests                                    │ │
│  │     npm run test:run                             │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  3. Type Check                                   │ │
│  │     npm run typecheck                            │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  4. Lint                                         │ │
│  │     npm run lint                                 │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  5. Build Application                            │ │
│  │     npm run build                                │ │
│  │     Output: .next/ folder                        │ │
│  └──────────────────────────────────────────────────┘ │
└────────┬───────────────────────────────────────────┘
         │
         │ Deploy
         ▼
┌────────────────────────────────────────────────────────┐
│            Netlify Production                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Next.js Server (Serverless Functions)          │ │
│  │  - API Routes (/api/*)                          │ │
│  │  - tRPC Handler (/api/trpc/*)                   │ │
│  │  - SSR Pages (as needed)                        │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Netlify DB (Neon PostgreSQL)                   │ │
│  │  - Auto-scaling                                 │ │
│  │  - Automated backups                            │ │
│  │  - Branch preview databases                     │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │  AWS S3 (File Storage)                          │ │
│  │  - Document uploads                             │ │
│  │  - Export files                                 │ │
│  │  - Presigned URLs                               │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### **Environment Configuration**

**Production:**
```bash
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://paros-bmad.netlify.app"
DATABASE_URL="<Netlify DB Neon>"
JWT_SECRET="<32+ chars random>"
AI_PROVIDER="upstage"
UPSTAGE_API_KEY="<from admin panel>"
AWS_S3_BUCKET="paros-bmad-docs"
AWS_S3_REGION="ap-northeast-2"
```

**Development:**
```bash
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://localhost:5432/paros_dev"
JWT_SECRET="dev-secret-key-change-in-production"
AI_PROVIDER="upstage"
UPSTAGE_API_KEY="<dev key>"
```

---

## Performance Optimization

### **Frontend**

1. **Code Splitting**: Next.js automatic splitting
2. **Lazy Loading**: `React.lazy()` for heavy components
3. **Image Optimization**: `next/image` with WebP
4. **Bundle Size**: Tree-shaking, dead code elimination
5. **Caching**: TanStack Query with staleTime

### **Backend**

1. **Database Indexes**: Strategic indexes on foreign keys
2. **Connection Pooling**: Prisma default (10 connections)
3. **Batch Processing**: AI classification (100 tx/batch)
4. **Pre-calculated Chains**: Transaction chains stored in DB
5. **Query Optimization**: Prisma `select` for partial fetching

### **Monitoring**

- **Netlify Analytics**: Page views, performance
- **Audit Logs**: User actions, errors
- **Sentry** (Future): Error tracking
- **Performance Budget**: < 3s for fund flow tracing (NFR-003)

---

## Scaling Strategy

### **Current Capacity**
- **Users**: ~100 (small law firms)
- **Cases**: ~1,000
- **Transactions**: ~100,000
- **Concurrent Users**: ~20

### **Scaling Plan**

**Phase 1: Vertical Scaling (Current)**
- Larger Netlify plan
- Database read replicas
- CDN optimization

**Phase 2: Horizontal Scaling**
- Multi-instance deployment
- Load balancing
- Database sharding (by caseId)

**Phase 3: Architecture Evolution**
- Move to Vercel/AWS for more control
- Queue system for long-running jobs (BullMQ)
- Redis caching layer
- GraphQL federation (microservices)

---

## Technology Rationale

| Technology | Reason | Alternatives Considered |
|------------|--------|-------------------------|
| **Next.js 15** | React framework with SSR/SSG, great DX | Remix, Vite + React Router |
| **tRPC** | End-to-end type safety, no codegen | REST + OpenAPI, GraphQL |
| **Prisma** | Type-safe ORM, great migrations | Drizzle, TypeORM, Sequelize |
| **PostgreSQL** | Relational data, ACID, JSON support | MySQL, MongoDB, SQLite |
| **JWT** | Stateless auth, easy scaling | Sessions, OAuth2 only |
| **shadcn/ui** | Copy-paste components, full customization | Material-UI, Chakra UI, Ant Design |
| **TanStack Query** | Server state management, caching | SWR, React Query v4 |
| **Zustand** | Simple client state, minimal boilerplate | Redux Toolkit, Jotai |
| **Vitest** | Fast unit tests, native ESM | Jest, Ava |
| **Playwright** | Reliable E2E tests, multi-browser | Cypress, Puppeteer |

---

## Future Enhancements

### **Short-term (3 months)**
- [ ] Real-time collaboration (WebSocket)
- [ ] Advanced filtering UI
- [ ] Custom report templates
- [ ] Mobile app (React Native)

### **Mid-term (6 months)**
- [ ] Machine learning model training (Story 4.8)
- [ ] Advanced analytics (dashboards)
- [ ] Integration with external APIs (court systems)
- [ ] Multi-language support (English, Japanese)

### **Long-term (12 months)**
- [ ] Microservices architecture
- [ ] Event-driven architecture (Kafka)
- [ ] Blockchain integration (evidence integrity)
- [ ] AI chatbot assistant (legal advice)

---

**Last Updated:** 2026-01-23
**Maintained By:** BMAD Development Team
