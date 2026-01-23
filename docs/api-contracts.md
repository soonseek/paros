# paros BMAD - API Contracts

**Generated:** 2026-01-23
**API Layer:** tRPC 11.0.0 (Type-safe RPC)
**Base URL:** `/api/trpc`

---

## Overview

paros BMAD는 **tRPC**를 사용하여 타입 안전한 Full-stack TypeScript API를 제공합니다. 모든 API 요청은 `/api/trpc/[router].[procedure]` 엔드포인트로 라우팅됩니다.

### **Authentication**

모든 API 요청은 **JWT Access Token**을 요구합니다 (publicProcedure 제외).

**Request Headers:**
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Token Lifecycle:**
- **Access Token**: 15분 유효
- **Refresh Token**: 7일 유효
- **Refresh Endpoint**: `POST /api/auth/refresh`

### **RBAC (Role-Based Access Control)**

| Role | Case Access | Case Modify | AI Classification | Notes |
|------|-------------|-------------|-------------------|-------|
| `LAWYER` | Own cases only | Own cases only | Yes | Default role |
| `PARALEGAL` | Own cases only | No | No | Read-only |
| `ADMIN` | All cases | All cases | Yes | Full access |
| `SUPPORT` | All cases | No | No | Read-only |

**Procedure Types:**
- `publicProcedure`: No authentication required
- `protectedProcedure`: Authentication required
- `caseAccessProcedure`: Auth + Case access check
- `caseModifyProcedure`: Auth + Case modification permission

---

## Router Index

### **Core Routers**

| Router | Purpose | Procedures |
|--------|---------|------------|
| `case` | Case Management | createCase, getCases, getCaseById, updateCase, archiveCase, unarchiveCase |
| `transaction` | Transaction Operations | classifyTransactions, getClassificationStatus, getPaginatedTransactions, updateClassification, restoreClassification |
| `findings` | Finding Management | getFindingsForCase, resolveFinding, updatePriority, analyzeFindings, findingNotes |
| `fundFlow` | Fund Flow Tracking (Epic 5) | traceUpstream, traceDownstream, getTransactionChains, getVisualizationData |
| `export` | Excel Export | exportTransactions, exportFindings, exportFundFlow |
| `analytics` | Analytics Reports | getCategoryStats, getAmountByCategory, getTimelineAnalysis |
| `tag` | Tag Management | getTags, createTag, deleteTag, addTagToTransaction, removeTagFromTransaction |
| `savedFilters` | Saved Filters | getSavedFilters, createSavedFilter, deleteSavedFilter |
| `user` | User Management | getProfile, updateProfile, changePassword |
| `settings` | System Settings (Admin) | getSettings, updateSettings |

---

## API Reference

### **Case Router** (`case`)

#### **1. createCase**
Create a new bankruptcy case.

**Endpoint:** `mutation case.createCase`

**Authentication:** `protectedProcedure` (LAWYER, ADMIN only)

**Input:**
```typescript
{
  caseNumber: string;  // Format: "2023하12345" (regex: /^\d{4}(하|타)\d{5}$/)
  debtorName: string;  // Max 50 chars, Korean/English only
  courtName?: string;
  filingDate?: Date;   // Cannot be future
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  case: Case;
}
```

**Errors:**
- `CONFLICT`: Case number already exists
- `FORBIDDEN`: User not authorized (not LAWYER/ADMIN)

**Example:**
```typescript
const result = await trpc.case.createCase.mutate({
  caseNumber: "2023하12345",
  debtorName: "홍길동",
  courtName: "서울회생법원",
  filingDate: new Date("2023-01-15"),
});
```

---

#### **2. getCases**
Get paginated list of cases with filtering.

**Endpoint:** `query case.getCases`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  search?: string;           // Case number or debtor name (partial match, case-insensitive)
  courtName?: string;
  filingDateFrom?: Date;
  filingDateTo?: Date;
  showArchived?: boolean;    // Default: false (active cases only)
  page?: number;             // Default: 1
  sortBy?: 'filingDate' | 'caseNumber' | 'debtorName' | 'status' | 'createdAt';  // Default: 'filingDate'
  sortOrder?: 'asc' | 'desc';  // Default: 'desc'
}
```

**Output:**
```typescript
{
  cases: Case[];
  total: number;
  page: number;
  pageSize: number;         // 20
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

**RBAC:** Users only see their own cases (`lawyerId = userId`)

**Example:**
```typescript
const result = await trpc.case.getCases.query({
  search: "홍길동",
  page: 1,
  sortBy: 'filingDate',
  sortOrder: 'desc',
});
```

---

#### **3. getCaseById**
Get detailed case information.

**Endpoint:** `query case.getCaseById`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  id: string;
  caseNumber: string;
  debtorName: string;
  courtName?: string;
  filingDate?: Date;
  status: CaseStatus;
  lawyer: {
    id: string;
    name?: string;
    email: string;
  };
}
```

**Errors:**
- `NOT_FOUND`: Case not found
- `FORBIDDEN`: User doesn't own this case

---

#### **4. updateCase**
Update case information.

**Endpoint:** `mutation case.updateCase`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  id: string;  // UUID
  debtorName: string;
  courtName?: string;
  filingDate?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' | 'CLOSED';
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  case: Case;
}
```

**Errors:**
- `NOT_FOUND`: Case not found
- `FORBIDDEN`: User doesn't own this case

---

#### **5. archiveCase / unarchiveCase**
Archive or unarchive a case.

**Endpoint:** `mutation case.archiveCase` / `mutation case.unarchiveCase`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  case: Case;
}
```

---

### **Transaction Router** (`transaction`)

#### **1. classifyTransactions**
AI-based transaction classification (hybrid rule-based + AI).

**Endpoint:** `mutation transaction.classifyTransactions`

**Authentication:** `protectedProcedure` (LAWYER, ADMIN only)

**Input:**
```typescript
{
  documentId: string;  // Document UUID
}
```

**Output:**
```typescript
{
  jobId: string;  // ClassificationJob ID for progress tracking
}
```

**Classification Pipeline (Story 4.8):**
1. **Rule-Based Classifier**: Keyword/amount/creditor pattern matching
2. **AI Provider Call**: Unmatched transactions only (cost optimization)
3. **Transaction Nature Analysis**: Creditor/collateral/priority repayment detection
4. **Important Transaction Detection**: Key transaction identification

**Errors:**
- `NOT_FOUND`: Document not found
- `FORBIDDEN`: User lacks classification permission

**Example:**
```typescript
const result = await trpc.transaction.classifyTransactions.mutate({
  documentId: "uuid-here",
});
// Track progress: trpc.transaction.getClassificationStatus.query({ jobId: result.jobId })
```

---

#### **2. getClassificationStatus**
Get AI classification progress.

**Endpoint:** `query transaction.getClassificationStatus`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  jobId: string;  // ClassificationJob ID
}
```

**Output:**
```typescript
{
  status: 'processing' | 'completed' | 'failed';
  progress: number;  // 0 ~ total
  total: number;
  error?: string;
}
```

---

#### **3. getPaginatedTransactions**
Get paginated transactions with filtering (Story 8.2: Multidimensional search).

**Endpoint:** `query transaction.getPaginatedTransactions`

**Authentication:** `protectedProcedure` (Case access required)

**Input:**
```typescript
{
  caseId: string;  // UUID
  page?: number;   // Default: 1
  pageSize?: number;  // Default: 50
  sortBy?: string;  // Default: 'transactionDate'
  sortOrder?: 'asc' | 'desc';  // Default: 'desc'

  // Filters (ExtendedSearchFilters)
  dateRange?: { start?: Date; end?: Date };
  amountRange?: { min?: number; max?: number };
  categories?: string[];
  tags?: string[];
  transactionNatures?: ('CREDITOR' | 'COLLATERAL' | 'PRIORITY_REPAYMENT' | 'GENERAL')[];
  importanceFilter?: 'important' | 'normal' | 'all';
  confidenceFilter?: { min?: number; max?: number };
  manualClassificationFilter?: 'manual' | 'auto' | 'all';
  keywordSearch?: string;
}
```

**Output:**
```typescript
{
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

**RBAC:** `caseAccessProcedure` enforces case access

---

#### **4. updateClassification**
Manually update transaction classification.

**Endpoint:** `mutation transaction.updateClassification`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  transactionId: string;  // UUID
  category: string;
  subcategory?: string;
  version: number;  // Optimistic locking version
}
```

**Output:**
```typescript
{
  success: boolean;
  transaction: Transaction;
}
```

**Side Effects:**
- Stores original classification for restore (Story 4.5)
- Creates AuditLog entry (Story 4.5 CRITICAL #2)
- Increments `user.tokenVersion` (security measure)

**Errors:**
- `CONFLICT`: Version mismatch (another user updated this transaction)

---

#### **5. restoreClassification**
Restore original AI classification.

**Endpoint:** `mutation transaction.restoreClassification`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  transactionId: string;  // UUID
  version: number;
}
```

**Output:**
```typescript
{
  success: boolean;
  transaction: Transaction;
}
```

---

### **Findings Router** (`findings`)

#### **1. getFindingsForCase**
Get findings for a case.

**Endpoint:** `query findings.getFindingsForCase`

**Authentication:** `protectedProcedure` (Case access required)

**Input:**
```typescript
{
  caseId: string;  // UUID
  includeResolved?: boolean;  // Default: false
}
```

**Output:**
```typescript
{
  findings: Finding[];
}
```

**Finding Types:**
- `IMPORTANT_TRANSACTION`: Key transaction detected (Story 4.3)
- `PRIORITY_REPAYMENT`: Priority repayment identified
- `COLLATERAL_CHANGE`: Collateral change detected
- `CREDITOR_PATTERN`: Creditor pattern found

---

#### **2. resolveFinding**
Mark a finding as resolved.

**Endpoint:** `mutation findings.resolveFinding`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  findingId: string;  // UUID (cuid format)
}
```

**Output:**
```typescript
{
  success: boolean;
  finding: Finding;
}
```

---

#### **3. updatePriority**
Update finding priority (Story 6.5).

**Endpoint:** `mutation findings.updatePriority`

**Authentication:** `protectedProcedure` (Case owner only)

**Input:**
```typescript
{
  findingId: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;  // null = reset to auto-calculated
}
```

**Output:**
```typescript
{
  success: boolean;
  finding: Finding;
}
```

---

### **Fund Flow Router** (`fundFlow`) - Epic 5

#### **1. traceUpstream**
Trace fund sources (upstream tracking, Story 5.1).

**Endpoint:** `query fundFlow.traceUpstream`

**Authentication:** `caseAccessProcedure`

**Input:**
```typescript
{
  transactionId: string;  // Starting transaction UUID
  caseId: string;         // Case UUID (RBAC)
  maxDepth?: number;      // Default: 3, Max: 5
  amountTolerance?: number; // Default: 0.1 (±10%)
  filters?: FundFlowFilters; // Story 5.5: Filter results
}
```

**Output:**
```typescript
{
  chains: TransactionChain[];  // Pre-calculated chains
  relations: TransactionRelation[];
  summary: {
    totalAmount: number;
    chainCount: number;
    maxDepth: number;
  };
}
```

**Tracing Algorithm:**
- Match withdrawals to deposits with ±10% amount tolerance
- Date filter: Withdrawal date < Deposit date
- Max depth: 5 levels (configurable)
- Confidence scoring based on amount/date match

**Performance:** NFR-003 requires < 3 seconds response time

---

#### **2. traceDownstream**
Trace fund usage (downstream tracking, Story 5.2).

**Endpoint:** `query fundFlow.traceDownstream`

**Authentication:** `caseAccessProcedure`

**Input:** Same as `traceUpstream`

**Output:** Same structure as `traceUpstream`

---

#### **3. getVisualizationData**
Get data for flow visualization (Story 5.4).

**Endpoint:** `query fundFlow.getVisualizationData`

**Authentication:** `caseAccessProcedure`

**Input:**
```typescript
{
  transactionId: string;
  caseId: string;
  direction: 'upstream' | 'downstream';
  filters?: FundFlowFilters;
}
```

**Output:**
```typescript
{
  nodes: Array<{
    id: string;
    type: 'source' | 'target';
    data: Transaction;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    confidence: number;
    matchReason: string;
  }>;
}
```

---

### **Export Router** (`export`)

#### **1. exportTransactions**
Export transactions to Excel.

**Endpoint:** `mutation export.exportTransactions`

**Authentication:** `caseAccessProcedure`

**Input:**
```typescript
{
  caseId: string;
  columns?: string[];  // Selected columns (default: all)
  filters?: ExtendedSearchFilters;  // Apply filters before export
  includeFindings?: boolean;  // Add findings column
}
```

**Output:**
```typescript
{
  downloadUrl: string;  // S3 presigned URL
  filename: string;
  rowCount: number;
}
```

**Excel Format:**
- Standard columns: Date, Deposit, Withdrawal, Balance, Memo, Category, Subcategory, etc.
- Optional: Findings, Tags, Transaction Nature, Confidence Score

---

### **Analytics Router** (`analytics`)

#### **1. getCategoryStats**
Get transaction statistics by category.

**Endpoint:** `query analytics.getCategoryStats`

**Authentication:** `caseAccessProcedure`

**Input:**
```typescript
{
  caseId: string;
  dateRange?: { start?: Date; end?: Date };
}
```

**Output:**
```typescript
{
  categories: Array<{
    category: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
}
```

---

#### **2. getTimelineAnalysis**
Get transaction timeline analysis.

**Endpoint:** `query analytics.getTimelineAnalysis`

**Authentication:** `caseAccessProcedure`

**Input:**
```typescript
{
  caseId: string;
  groupBy: 'day' | 'week' | 'month';
  dateRange?: { start?: Date; end?: Date };
}
```

**Output:**
```typescript
{
  timeline: Array<{
    period: string;
    depositTotal: number;
    withdrawalTotal: number;
    netFlow: number;
    transactionCount: number;
  }>;
}
```

---

### **Tag Router** (`tag`)

#### **1. getTags**
Get all tags for a case.

**Endpoint:** `query tag.getTags`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  caseId: string;
}
```

**Output:**
```typescript
{
  tags: Tag[];
  // With usage counts
}
```

---

#### **2. createTag**
Create a new tag.

**Endpoint:** `mutation tag.createTag`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  name: string;  // Unique per user
  caseId?: string;
}
```

**Output:**
```typescript
{
  tag: Tag;
}
```

---

#### **3. addTagToTransaction**
Add a tag to a transaction.

**Endpoint:** `mutation tag.addTagToTransaction`

**Authentication:** `protectedProcedure` (Case access required)

**Input:**
```typescript
{
  transactionId: string;
  tagId: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  transactionTag: TransactionTag;
}
```

---

### **User Router** (`user`)

#### **1. getProfile**
Get current user profile.

**Endpoint:** `query user.getProfile`

**Authentication:** `protectedProcedure`

**Input:** None

**Output:**
```typescript
{
  id: string;
  email: string;
  name?: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}
```

---

#### **2. updateProfile**
Update user profile.

**Endpoint:** `mutation user.updateProfile`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  name?: string;
  email?: string;  // Requires verification
}
```

**Output:**
```typescript
{
  success: boolean;
  user: User;
}
```

**Security:** Email changes require email verification (`pendingEmail` field)

---

#### **3. changePassword**
Change user password.

**Endpoint:** `mutation user.changePassword`

**Authentication:** `protectedProcedure`

**Input:**
```typescript
{
  currentPassword: string;
  newPassword: string;  // Min 8 chars
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Security:** Increments `tokenVersion` after password change

---

### **Settings Router** (`settings`) - Admin Only

#### **1. getSettings**
Get system settings.

**Endpoint:** `query settings.getSettings`

**Authentication:** `protectedProcedure` (ADMIN only)

**Input:**
```typescript
{
  category?: 'GENERAL' | 'AI' | 'EMAIL';  // Optional filter
}
```

**Output:**
```typescript
{
  settings: SystemSetting[];
}
```

---

#### **2. updateSettings**
Update system settings.

**Endpoint:** `mutation settings.updateSettings`

**Authentication:** `protectedProcedure` (ADMIN only)

**Input:**
```typescript
{
  updates: Array<{
    key: string;  // e.g., "AI_PROVIDER", "UPSTAGE_API_KEY"
    value: string;
  }>;
}
```

**Output:**
```typescript
{
  success: boolean;
  updated: SystemSetting[];
}
```

**Security:** Sensitive values are encrypted in database (`isEncrypted = true`)

---

## Error Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| `UNAUTHORIZED` | Authentication required | Missing/invalid access token |
| `FORBIDDEN` | Permission denied | RBAC violation |
| `NOT_FOUND` | Resource not found | Invalid ID, resource doesn't exist |
| `CONFLICT` | Resource conflict | Duplicate case number, version mismatch |
| `BAD_REQUEST` | Invalid input | Validation error, malformed request |
| `INTERNAL_SERVER_ERROR` | Server error | Unexpected error, check logs |
| `TOO_MANY_REQUESTS` | Rate limit exceeded | Too many requests |

---

## Rate Limiting

**Default Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per user

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Pagination Pattern

All list endpoints follow this pattern:

**Input:**
```typescript
{
  page?: number;       // Default: 1
  pageSize?: number;   // Default: 20/50 (varies by endpoint)
  sortBy?: string;     // Default: field-specific
  sortOrder?: 'asc' | 'desc';  // Default: varies
}
```

**Output:**
```typescript
{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

---

## Webhooks (Future)

Not implemented yet. Planned for:
- File analysis completion
- Classification job completion
- Finding auto-generation

---

## Testing

**tRPC Client Testing:**
```typescript
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { type AppRouter } from "~/server/api/root";

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
    }),
  ],
});

// Test
const cases = await client.case.getCases.query({ page: 1 });
```

---

**Last Updated:** 2026-01-23
**API Version:** 1.0.0
**Maintained By:** BMAD Development Team
