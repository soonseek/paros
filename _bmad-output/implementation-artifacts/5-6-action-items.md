# Story 5.6 Action Items
## Detailed Implementation Plan for Code Review Fixes

**Created**: 2026-01-13  
**Story**: 5.6 - Tracking Result Export (자금 흐름 추적 결과 내보내기)  
**Total Issues**: 10 (3 CRITICAL, 2 HIGH, 5 MEDIUM)  
**Estimated Total Effort**: 12 days (7-8 days with parallel execution)  
**Phase**: CRITICAL & HIGH fixes required before release; MEDIUM fixes recommended

---

## Priority Matrix

```
                High
            Impact
                |
                | [CRITICAL] #1, #2, #3
                | [HIGH] #4, #5
         [MEDIUM] #6-10
                |
                +------------ Effort -------->
            Low                              High
```

### Recommended Phase Execution
- **Phase 1 (Release Blocker)**: Issue #1, #2, #3 (4-5 days) → Must complete before merge
- **Phase 2 (Pre-Release)**: Issue #4, #5 (3-4 days) → Must complete before release
- **Phase 3 (Post-Release)**: Issue #6-10 (4-5 days) → Sprint backlog for next iteration

---

## CRITICAL ISSUES

### [CRITICAL] Issue #1: Buffer Serialization - tRPC Return Type Mismatch

**ID**: ACTION-5.6-1
**Severity**: 🔴 CRITICAL
**Category**: Architecture / Type Safety
**Status**: ✅ COMPLETED (2026-01-13)
**Effort Estimate**: 1 day  

#### Problem Statement
`exportFundFlowResult` mutation returns `Buffer` object directly, which cannot be JSON-serialized by tRPC. This breaks the entire export functionality at the type level.

**Files Affected**:
- `src/server/api/routers/fundFlow.ts` (lines 793-795) - return type
- `src/components/molecules/export-fund-flow-modal.tsx` (missing download logic)

**Current Behavior**:
```typescript
// ❌ WRONG: Buffer is not JSON-serializable
exportFundFlowResult: caseAccessProcedure
  .mutation(async ({ ctx, input }) => {
    const buffer = await writeExcelBuffer(workbook);
    return {
      buffer,              // ← Error: Buffer cannot be serialized!
      filename,
      mimeType,
    };
  }),
```

#### Root Cause
- Buffer is a Node.js runtime object, not serializable to JSON
- tRPC requires all return values to be JSON-serializable
- No encoding/decoding layer between server and client

#### Business Impact
- ❌ Export feature completely non-functional
- ❌ No file download possible
- ❌ User cannot save/report fund flow results
- 📉 Feature fails acceptance criteria AC4

#### Technical Impact
- ❌ Type error on tRPC procedure return
- ❌ Runtime JSON serialization error
- ❌ Missing client-side Blob conversion
- ❌ No download trigger mechanism

#### Acceptance Criteria
- ✅ Buffer encoded as Base64 string before returning
- ✅ Client-side Base64 → Blob conversion working
- ✅ Browser download dialog triggered automatically
- ✅ File saves to Downloads folder with correct name
- ✅ All existing tests still pass

#### Implementation Plan

**Step 1: Update fundFlow.ts - Use Base64 Encoding** (30 min)

Replace return statement in `exportFundFlowResult` mutation:
```typescript
// fundFlow.ts - lines 793-795 (BEFORE)
return {
  buffer,
  filename,
  mimeType,
};

// fundFlow.ts - lines 793-795 (AFTER)
// Encode Buffer to Base64 for JSON serialization
const base64Data = buffer.toString('base64');

return {
  data: base64Data,           // Base64-encoded string
  filename,
  mimeType,
  success: true,
};
```

**Step 2: Update Modal Component - Implement Download** (30 min)

File: `src/components/molecules/export-fund-flow-modal.tsx`

```tsx
const handleExport = async () => {
  try {
    setIsLoading(true);
    
    const result = await exportMutation.mutateAsync({
      caseId,
      exportOption: selectedOption,
      chainIds: exportOption === 'selected' ? selectedChainIds : undefined,
      filters: exportOption === 'filtered' ? filters : undefined,
      includeVisualization: includeViz,
    });

    if (!result?.data) {
      throw new Error('응답 데이터가 없습니다');
    }

    // Step 1: Decode Base64 to binary string
    const binaryString = atob(result.data);
    
    // Step 2: Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Step 3: Create Blob from Uint8Array
    const blob = new Blob([bytes], { 
      type: result.mimeType 
    });

    // Step 4: Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    
    // Step 5: Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    toast.success(`${result.filename} 다운로드 완료`);
    onOpenChange(false);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    toast.error(`내보내기 실패: ${errorMsg}`);
    console.error('[Export Error]', error);
  } finally {
    setIsLoading(false);
  }
};
```

**Acceptance Test Cases**:
- ✅ "체인 전체" 선택 → 파일 다운로드 → 파일 존재 확인
- ✅ "필터링 결과" 선택 → 파일 다운로드 → 데이터 일치 확인
- ✅ "선택된 체인" 선택 → 파일 다운로드 → 크기 비교
- ✅ 한글 파일명 올바르게 저장됨
- ✅ 파일 확장자 .xlsx 올바름

---

### [CRITICAL] Issue #2: Missing exceljs Library & excel.ts Implementation

**ID**: ACTION-5.6-2
**Severity**: 🔴 CRITICAL
**Category**: Dependencies / Missing Implementation
**Status**: ✅ COMPLETED (2026-01-13)
**Effort Estimate**: 1.5 days  

#### Problem Statement
`exceljs` library is not installed and `src/lib/export/excel.ts` utility module is not implemented. The code references these as if they exist, but they are completely missing.

**Files Affected**:
- `package.json` - missing dependency
- `src/lib/export/excel.ts` - missing entire file

**Current Behavior**:
```typescript
// ❌ WRONG: Dynamic import of non-existent module
const {
  createWorkbook,
  createWorksheetWithHeaders,
  addDataRow,
  autoFitColumns,
  writeExcelBuffer,
  formatTags,
  formatTransactionNature,
  formatConfidence,
  formatAmount,
  formatDate,
} = await import("~/lib/export/excel");
```

#### Business Impact
- ❌ Excel file generation impossible
- ❌ Feature completely broken
- ❌ Cannot fulfill AC2, AC3, AC5 requirements
- 📉 No spreadsheet output at all

#### Acceptance Criteria
- ✅ exceljs v4.x installed via npm
- ✅ All utility functions implemented
- ✅ AC5 styling applied correctly
- ✅ UTF-8 encoding with Korean support
- ✅ All existing tests pass

#### Implementation Plan

**Step 1: Install exceljs** (5 min)
```bash
npm install exceljs
npm install -D @types/exceljs
```

**Step 2: Create `src/lib/export/excel.ts`** (2 hours)

```typescript
/**
 * Excel Export Utilities (Story 5.6)
 * 
 * AC5: 셀 서식 및 한글 지원
 * - 헤더: 굵음, 파란색 배경, 흰색 글자
 * - 데이터: 보통, 테두리
 * - 날짜: "yyyy-mm-dd" 형식
 * - 금액: 천단위 "원" 단위
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Workbook & Worksheet Creation
// ============================================================================

/**
 * Create new Excel workbook with default properties
 */
export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.properties.title = '자금 흐름 추적 결과';
  workbook.properties.author = 'Pharos BMAD';
  return workbook;
}

/**
 * Create worksheet with styled header row
 * 
 * AC5: Header styling
 * - Font: Bold, 12pt, Malgun Gothic
 * - Background: Blue (#0066CC)
 * - Text color: White
 * - Alignment: Center
 * - Border: Thin black border
 */
export function createWorksheetWithHeaders(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add header row
  const headerRow = worksheet.addRow(headers);
  
  // AC5: Apply header styling
  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      size: 12,
      name: 'Malgun Gothic',
      color: { argb: 'FFFFFFFF' }, // White text
    };
    
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }, // Blue background
    };
    
    cell.alignment = {
      horizontal: 'center',
      vertical: 'center',
      wrapText: false,
    };
    
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });
  
  // Set header row height
  headerRow.height = 20;
  
  return worksheet;
}

// ============================================================================
// Data Row Insertion
// ============================================================================

/**
 * Add multiple data rows to worksheet
 * 
 * AC5: Data cell styling
 * - Font: Regular, 10pt, Malgun Gothic
 * - Border: Thin light gray border
 * - Alignment: Text left, Numbers right, Dates center
 * - Wrapping: Enabled for long text
 */
export function addDataRow(
  worksheet: ExcelJS.Worksheet,
  data: Array<Record<string, any>>
): void {
  for (const rowData of data) {
    const values = Object.values(rowData);
    const row = worksheet.addRow(values);
    
    // Apply styling to each cell
    row.eachCell((cell, colNumber) => {
      // Font styling
      cell.font = {
        size: 10,
        name: 'Malgun Gothic',
      };
      
      // Border styling (light gray)
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      };
      
      // Value type-specific formatting
      const cellValue = cell.value;
      
      if (cellValue instanceof Date) {
        // AC5: Date formatting "yyyy-mm-dd"
        cell.value = formatDate(cellValue);
        cell.alignment = { horizontal: 'center', vertical: 'center' };
      } else if (typeof cellValue === 'number' && !isNaN(cellValue)) {
        // AC5: Number formatting with thousand separator
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'center' };
      } else {
        // Text: left align with wrapping
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      }
    });
  }
}

// ============================================================================
// Column Management
// ============================================================================

/**
 * Auto-fit column widths based on content
 * Maximum width: 50 characters (prevents extremely wide columns)
 */
export function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    if (!column || !column.index) return;
    
    let maxLength = 10; // Minimum width
    
    column.eachCell?.({ relativeColumn: column.index }, (cell) => {
      const cellValue = cell.value?.toString() ?? '';
      const cellLength = cellValue.length;
      
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    
    // Set width with 2 char padding, max 50
    column.width = Math.min(maxLength + 2, 50);
  });
}

// ============================================================================
// Workbook Export
// ============================================================================

/**
 * Convert workbook to Buffer for download
 * 
 * AC2: UTF-8 encoding with Korean support
 */
export async function writeExcelBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  // IMPORTANT: exceljs returns Promise<Buffer>, not Promise<ArrayBuffer>
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * AC5: Format date as "yyyy-mm-dd"
 * 
 * @example formatDate(new Date('2026-01-13')) → "2026-01-13"
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * AC5: Format amount with thousand separator and "원" unit
 * 
 * @example formatAmount(1000000) → "1,000,000원"
 * @example formatAmount(null) → "-"
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  
  const formatted = Math.floor(amount).toLocaleString('ko-KR');
  return `${formatted}원`;
}

/**
 * Format transaction tags as comma-separated list
 * 
 * @example formatTags([{tag:{name:"대출"}}, {tag:{name:"담보"}}]) → "대출, 담보"
 */
export function formatTags(
  tags: Array<{ tag: { name: string } }> | null | undefined
): string {
  if (!tags || tags.length === 0) return '-';
  return tags.map(t => t.tag.name).join(', ');
}

/**
 * Format transaction nature enum as Korean label
 * Maps TransactionNature enum values to display names
 */
export function formatTransactionNature(nature: string | null | undefined): string {
  if (!nature) return '-';
  
  const natureLabels: Record<string, string> = {
    'CREDITOR_RELATED': '채권자 관련',
    'REPAYMENT': '상환 관련',
    'LOAN_EXECUTION': '대출 실행',
    'COLLATERAL': '담보 관련',
  };
  
  return natureLabels[nature] ?? nature;
}

/**
 * Format confidence score as percentage
 * 
 * @example formatConfidence(0.92) → "92%"
 */
export function formatConfidence(score: number | null | undefined): string {
  if (score === null || score === undefined) return '-';
  
  const percentage = Math.round(score * 100);
  return `${percentage}%`;
}
```

**Validation Tests**:
- ✅ `npm install` succeeds without errors
- ✅ `npm run typecheck` passes
- ✅ All functions export correctly
- ✅ Korean fonts render properly in Excel
- ✅ Workbook writes to Buffer successfully

---

### [CRITICAL] Issue #3: Transaction Data Loading - Chain Path Not Fully Included

**ID**: ACTION-5.6-3
**Severity**: 🔴 CRITICAL
**Category**: Data Integrity / Completeness
**Status**: ✅ COMPLETED (2026-01-13)
**Effort Estimate**: 2 days  

#### Problem Statement
When exporting fund flow results, the code only includes `startTx` and `endTx` in the TransactionChain query. The intermediate transactions in the chain path are never loaded or displayed in the "거래 상세" sheet. This violates AC3 requirement to include all chain-related transactions.

**Files Affected**:
- `src/server/api/routers/fundFlow.ts` (lines 656-762) - TransactionChain queries
- Query includes only: `startTx`, `endTx`
- Query missing: All transactions referenced in `chain.path`

**Current Behavior**:
```typescript
// ❌ INCOMPLETE: Only start/end transactions loaded
chains = await ctx.db.transactionChain.findMany({
  where: { caseId },
  include: {
    startTx: { select: { /* ... */ } },  // ✓ Loaded
    endTx: { select: { /* ... */ } },    // ✓ Loaded
    // ✗ chain.path transactions NOT loaded
  },
});

// Later, when building transaction data:
const chainTransactions = [chain.startTx, chain.endTx]; // ✗ Missing intermediate txs!

for (const tx of chainTransactions) {
  transactionData.push({
    체인ID: chain.id,
    거래ID: tx.id,  // ✗ Only 2 transactions per chain!
    // ...
  });
}
```

#### Root Cause
- `chain.path` is a CSV string of transaction IDs: `"tx-1,tx-2,tx-3,tx-4,tx-5"`
- The code never parses `chain.path` to load all intermediate transactions
- Assumption that startTx/endTx is sufficient for AC3

#### Business Impact
- ❌ AC3 "거래 상세 시트" shows incomplete data
- ❌ Finance team cannot see full transaction chain in report
- ❌ Missing critical transaction details for audit trail
- 📉 Export report is incomplete and unusable

#### Technical Impact
- ❌ Data loss: Only 2 of 5 transactions exported
- ❌ Chart consistency: startTx/endTx mismatch with chain.path
- ❌ No relationship between exported data and chain.path
- ❌ Hard to trace which transactions belong to which chain

#### Acceptance Criteria
- ✅ All transactions in `chain.path` are loaded from database
- ✅ Transactions appear in correct order (path order preserved)
- ✅ "거래 상세" sheet includes ALL chain transactions
- ✅ Exported data matches actual chain composition
- ✅ 100% test coverage for transaction loading

#### Implementation Plan

**Step 1: Create Helper Function to Load All Chain Transactions** (1 hour)

Add to `src/server/api/routers/fundFlow.ts`:

```typescript
/**
 * Load all transactions from chain path (CSV format)
 * 
 * @param db - Prisma client
 * @param chainPath - CSV string like "tx-1,tx-2,tx-3"
 * @returns Transactions in path order
 */
async function loadChainPathTransactions(
  db: PrismaClient,
  chainPath: string
): Promise<Array<{
  id: string;
  transactionDate: Date;
  depositAmount: Decimal | null;
  withdrawalAmount: Decimal | null;
  memo: string | null;
  tags: Array<{ tag: { name: string } }>;
  transactionNature: string | null;
  importantTransaction: boolean | null;
}>> {
  // Parse CSV: "tx-1,tx-2,tx-3" → ["tx-1", "tx-2", "tx-3"]
  const txIds = chainPath
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  if (txIds.length === 0) {
    return [];
  }
  
  // Load transactions from database
  const transactions = await db.transaction.findMany({
    where: {
      id: { in: txIds },
    },
    select: {
      id: true,
      transactionDate: true,
      depositAmount: true,
      withdrawalAmount: true,
      memo: true,
      tags: { include: { tag: { select: { name: true } } } },
      transactionNature: true,
      importantTransaction: true,
    },
  });
  
  // Preserve order from chain.path (input order)
  const txMap = new Map(transactions.map(tx => [tx.id, tx]));
  const orderedTxs = txIds
    .map(id => txMap.get(id))
    .filter((tx): tx is typeof transactions[0] => tx !== undefined);
  
  return orderedTxs;
}
```

**Step 2: Update Transaction Data Collection** (30 min)

Replace the transaction data loop:

```typescript
// BEFORE: ✗ Only 2 transactions per chain
const transactionData: any[] = [];
for (const chain of chains) {
  const chainTransactions = [chain.startTx, chain.endTx];
  for (const tx of chainTransactions) {
    transactionData.push({
      체인ID: chain.id,
      거래ID: tx.id ?? "",
      // ...
    });
  }
}

// AFTER: ✓ All transactions from chain.path
const transactionData: any[] = [];
for (const chain of chains) {
  // Load ALL transactions from chain path
  const chainTransactions = await loadChainPathTransactions(
    ctx.db,
    chain.path
  );
  
  for (const tx of chainTransactions) {
    transactionData.push({
      체인ID: chain.id,
      거래ID: tx.id,  // ✓ All transactions have valid IDs
      날짜: tx.transactionDate,
      입금액: tx.depositAmount ? Number(tx.depositAmount) : null,
      출금액: tx.withdrawalAmount ? Number(tx.withdrawalAmount) : null,
      메모: tx.memo ?? "",
      태그: formatTags(tx.tags),
      거래성격: formatTransactionNature(tx.transactionNature),
    });
  }
}
```

**Validation Tests**:
- ✅ Single transaction chain (depth=1): 1 transaction exported
- ✅ Five-transaction chain (depth=5): All 5 transactions in export
- ✅ Chain path order preserved in export sheet
- ✅ All transaction IDs match chain.path
- ✅ No duplicate transactions in export
- ✅ startTx/endTx still accessible for chain overview

---

## HIGH PRIORITY ISSUES

### [HIGH] Issue #4: Test Coverage 0% - Missing exportFundFlowResult Tests

**ID**: ACTION-5.6-4  
**Severity**: 🟠 HIGH  
**Category**: Testing / Quality Assurance  
**Status**: Not Started  
**Effort Estimate**: 1.5 days  

#### Problem Statement
`exportFundFlowResult` procedure has zero test coverage. No unit tests, integration tests, or component tests exist for the entire export feature.

**Files Affected**:
- `src/server/api/routers/__tests__/fundFlow.export.test.ts` - MISSING

**Current Status**:
```
Test Coverage:
  exportFundFlowResult: 0/1 (0%)
  export-fund-flow-modal.tsx: 0/1 (0%)
  export-fund-flow-button.tsx: 0/1 (0%)
```

#### Acceptance Criteria
- ✅ Unit tests for `exportFundFlowResult` mutation
- ✅ Integration tests for export workflow (export → download → verify)
- ✅ Component tests for modal and button
- ✅ Coverage target: 85%+ for export feature
- ✅ All AC1-AC5 requirements covered by tests

#### Implementation Plan

**Create: `src/server/api/routers/__tests__/fundFlow.export.test.ts`** (1.5 hours)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { fundFlowRouter } from '../fundFlow';

describe('fundFlow.exportFundFlowResult', () => {
  let ctx: any;
  let testCaseId: string;
  let testChainIds: string[];

  beforeEach(async () => {
    // Setup test context with authenticated user, case, chains
    ctx = await createTestContext();
    testCaseId = await createTestCase(ctx);
    testChainIds = await createTestChains(ctx, testCaseId, 3);
  });

  describe('AC1: Export Options Modal', () => {
    it('should accept "all" export option', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });
      
      expect(result).toBeDefined();
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/^자금흐름추적_/);
    });

    it('should accept "filtered" export option with filters', async () => {
      const filters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };
      
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'filtered',
        filters,
      });
      
      expect(result.data).toBeTruthy();
    });

    it('should accept "selected" export option with chainIds', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'selected',
        chainIds: [testChainIds[0], testChainIds[1]],
      });
      
      expect(result.data).toBeTruthy();
    });
  });

  describe('AC2: Excel File Generation', () => {
    it('should generate valid .xlsx file', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });

      // Decode Base64
      const buffer = Buffer.from(result.data, 'base64');
      
      // Load with exceljs to verify format
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      expect(workbook.worksheets.length).toBeGreaterThan(0);
    });

    it('should use UTF-8 encoding (한글 support)', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });

      const buffer = Buffer.from(result.data, 'base64');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      const summarySheet = workbook.getWorksheet('요약');
      expect(summarySheet).toBeDefined();
      // Verify Korean characters rendered correctly
      expect(summarySheet?.getCell('A1').value).toBe('항목');
    });

    it('should generate filename with case number and date', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });

      expect(result.filename).toMatch(/^자금흐름추적_.*_\d{8}\.xlsx$/);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });

  describe('AC3: Excel Sheet Structure', () => {
    let workbook: ExcelJS.Workbook;

    beforeEach(async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });
      
      const buffer = Buffer.from(result.data, 'base64');
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
    });

    it('should include 요약 (Summary) sheet', () => {
      const sheet = workbook.getWorksheet('요약');
      expect(sheet).toBeDefined();
      expect(sheet?.getCell('A1').value).toBe('항목');
      
      // Verify summary data
      const values = sheet!.getRows(2, 7)?.map(r => r.getCell(2).value);
      expect(values).toContain(testCaseId); // Case number
    });

    it('should include 거래 상세 (Transaction Details) sheet', () => {
      const sheet = workbook.getWorksheet('거래 상세');
      expect(sheet).toBeDefined();
      
      // Verify headers
      const headers = sheet!.getRow(1).values as string[];
      expect(headers).toContain('체인ID');
      expect(headers).toContain('거래ID');
      expect(headers).toContain('날짜');
      expect(headers).toContain('입금액');
      expect(headers).toContain('출금액');
      expect(headers).toContain('메모');
    });

    it('should include 체인 (Chain) sheet', () => {
      const sheet = workbook.getWorksheet('체인');
      expect(sheet).toBeDefined();
      
      const headers = sheet!.getRow(1).values as string[];
      expect(headers).toContain('체인ID');
      expect(headers).toContain('체인유형');
      expect(headers).toContain('깊이');
    });
  });

  describe('AC4: Download & Feedback', () => {
    it('should return Base64-encoded data for client download', async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });

      // Verify Base64 encoding
      expect(result.data).toMatch(/^[A-Za-z0-9+/=]+$/);
      
      // Should be decodable
      expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
    });
  });

  describe('AC5: Cell Formatting', () => {
    let workbook: ExcelJS.Workbook;

    beforeEach(async () => {
      const result = await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });
      
      const buffer = Buffer.from(result.data, 'base64');
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
    });

    it('should format header row with bold, blue background, white text', () => {
      const sheet = workbook.getWorksheet('거래 상세');
      const headerRow = sheet!.getRow(1);
      
      headerRow.eachCell(cell => {
        expect(cell.font?.bold).toBe(true);
        expect(cell.font?.size).toBe(12);
        expect(cell.fill?.pattern).toBe('solid');
      });
    });

    it('should format date column as yyyy-mm-dd', () => {
      const sheet = workbook.getWorksheet('거래 상세');
      const dateCell = sheet!.getCell('C2'); // 날짜 column
      
      const value = dateCell.value as string;
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should format amount columns with thousand separator and 원 unit', () => {
      const sheet = workbook.getWorksheet('거래 상세');
      const amountCell = sheet!.getCell('D2'); // 입금액
      
      const value = amountCell.value as string;
      expect(value).toMatch(/^\d+,?\d*원$/);
    });

    it('should apply borders to all cells', () => {
      const sheet = workbook.getWorksheet('거래 상세');
      sheet!.eachRow(row => {
        row.eachCell(cell => {
          expect(cell.border).toBeDefined();
          expect(cell.border?.top?.style).toBeDefined();
        });
      });
    });
  });

  describe('RBAC & Security', () => {
    it('should throw FORBIDDEN when user lacks case access', async () => {
      const unauthorizedCtx = await createTestContext({ caseAccess: [] });
      
      await expect(
        fundFlowRouter.createCaller(unauthorizedCtx).exportFundFlowResult({
          caseId: testCaseId,
          exportOption: 'all',
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('should throw NOT_FOUND for non-existent case', async () => {
      await expect(
        fundFlowRouter.createCaller(ctx).exportFundFlowResult({
          caseId: 'non-existent-id',
          exportOption: 'all',
        })
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('Performance', () => {
    it('should complete export within 3 seconds (NFR-003)', async () => {
      const startTime = performance.now();
      
      await fundFlowRouter.createCaller(ctx).exportFundFlowResult({
        caseId: testCaseId,
        exportOption: 'all',
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(3000); // 3 seconds
    });
  });
});
```

**Acceptance Criteria Checklist**:
- ✅ 10+ test cases covering all AC1-AC5
- ✅ Unit tests pass: `npm test -- fundFlow.export.test.ts`
- ✅ Coverage: 85%+ for `fundFlow.ts` export section
- ✅ Integration test: Export → Decode → Verify file structure

---

### [HIGH] Issue #5: Large Dataset Handling - Memory Optimization for 1000+ Transactions

**ID**: ACTION-5.6-5  
**Severity**: 🟠 HIGH  
**Category**: Performance / Scalability  
**Status**: Not Started  
**Effort Estimate**: 1 day  

#### Problem Statement
Current implementation loads all transaction data into memory before writing to Excel. For large chains (1000+ transactions), this can cause memory exhaustion and timeout exceeding NFR-003 (3-second response requirement).

**Performance Issue**:
```
Current Behavior:
- Load all chains into memory
- Load all transactions into memory
- Build entire transactionData array
- Write all to Excel in one operation
→ For 10,000 transactions: ~500MB memory, 5+ seconds

Required Behavior:
- Process in batches/chunks
- Stream to Excel file
- Complete within 3 seconds for <5000 transactions
```

#### Acceptance Criteria
- ✅ Handle 1000 transactions in <2 seconds
- ✅ Handle 5000 transactions in <3 seconds
- ✅ Memory usage capped at 200MB for 5000 transactions
- ✅ No timeout errors for large datasets

#### Implementation Plan

**Batch Processing Strategy** (1 day):

```typescript
// fundFlow.ts - Batch transaction loading
const BATCH_SIZE = 500;

let transactionData: any[] = [];
for (const chain of chains) {
  const chainTransactions = await loadChainPathTransactions(ctx.db, chain.path);
  
  for (const tx of chainTransactions) {
    transactionData.push({
      체인ID: chain.id,
      거래ID: tx.id,
      // ...
    });
    
    // Write batch when size reaches limit
    if (transactionData.length >= BATCH_SIZE) {
      addDataRow(transactionSheet, transactionData);
      transactionData = []; // Clear memory
    }
  }
}

// Write remaining transactions
if (transactionData.length > 0) {
  addDataRow(transactionSheet, transactionData);
}
```

---

## MEDIUM PRIORITY ISSUES

### [MEDIUM] Issue #6: Error Handling - Comprehensive Exception Management

**ID**: ACTION-5.6-6  
**Severity**: 🟡 MEDIUM  
**Category**: User Experience / Reliability  
**Status**: Not Started  
**Effort Estimate**: 1 day  

#### Problem
Export modal lacks proper error handling for edge cases:
- Network timeout
- Empty export (no chains match filter)
- File generation failure
- Base64 encoding error

#### Implementation Plan
Add comprehensive error states to modal component with user-friendly messaging.

---

### [MEDIUM] Issue #7: i18n Completeness - Missing Translation Keys

**ID**: ACTION-5.6-7  
**Severity**: 🟡 MEDIUM  
**Category**: Internationalization  
**Status**: Not Started  
**Effort Estimate**: 0.5 day  

#### Required Translations
Add to `src/lib/i18n/locales/ko.json`:
```json
{
  "fundFlowExport": {
    "title": "자금 흐름 추적 결과 내보내기",
    "options": {
      "all": "체인 전체 내보내기",
      "filtered": "현재 필터링된 결과만",
      "selected": "선택된 거래만"
    },
    "success": "{{filename}} 다운로드 완료",
    "error": "내보내기 실패: {{error}}"
  }
}
```

---

### [MEDIUM] Issue #8: Progress Indication - User Feedback During Export

**ID**: ACTION-5.6-8  
**Severity**: 🟡 MEDIUM  
**Category**: User Experience  
**Status**: Not Started  
**Effort Estimate**: 0.5 day  

#### Missing
- Progress bar during file generation
- Percentage complete display
- Cancel button option

---

### [MEDIUM] Issue #9: Filename Sanitization - Security Hardening

**ID**: ACTION-5.6-9  
**Severity**: 🟡 MEDIUM  
**Category**: Security  
**Status**: Not Started  
**Effort Estimate**: 0.5 day  

#### Current Issue
```typescript
// ⚠️ Insufficient sanitization
const caseNumber = (caseInfo.caseNumber ?? "unknown").replace(/[^a-zA-Z0-9가-힣]/g, "_");
```

#### Required Fix
```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s가-힣-]/g, '')  // Remove special chars
    .replace(/\s+/g, '_')           // Spaces → underscore
    .substring(0, 200)              // Max length
    .trim();
}
```

---

### [MEDIUM] Issue #10: Documentation - Code Comments & Export Flow

**ID**: ACTION-5.6-10  
**Severity**: 🟡 MEDIUM  
**Category**: Maintainability  
**Status**: Not Started  
**Effort Estimate**: 0.5 day  

#### Missing
- JSDoc comments for all functions in `excel.ts`
- Flow documentation for export workflow
- Examples in README

---

## Summary Table

| # | Issue | Severity | Phase | Effort | Dependencies |
|---|-------|----------|-------|--------|--------------|
| 1 | Buffer Serialization | 🔴 CRITICAL | 1 | 1d | None |
| 2 | exceljs & excel.ts | 🔴 CRITICAL | 1 | 1.5d | Issue #1 |
| 3 | Transaction Loading | 🔴 CRITICAL | 1 | 2d | Issue #2 |
| 4 | Test Coverage | 🟠 HIGH | 2 | 1.5d | Issue #1-3 |
| 5 | Performance | 🟠 HIGH | 2 | 1d | Issue #2-3 |
| 6 | Error Handling | 🟡 MEDIUM | 3 | 1d | Issue #1-5 |
| 7 | i18n | 🟡 MEDIUM | 3 | 0.5d | - |
| 8 | Progress | 🟡 MEDIUM | 3 | 0.5d | - |
| 9 | Security | 🟡 MEDIUM | 3 | 0.5d | - |
| 10 | Documentation | 🟡 MEDIUM | 3 | 0.5d | All |

**Total Effort**: 9 days  
**Critical Path**: Issue #1 → #2 → #3 → #4/5 (4.5 days)  
**Parallel Track**: Issue #6-10 (3 days)

---

## Next Steps

1. **Phase 1 (Days 1-5)**: Resolve CRITICAL issues #1-3
   - [ ] Fix Buffer serialization
   - [ ] Install exceljs & implement excel.ts
   - [ ] Load all chain transactions

2. **Phase 2 (Days 5-7)**: Complete HIGH issues #4-5
   - [ ] Write comprehensive tests
   - [ ] Optimize for large datasets

3. **Phase 3 (Days 7-9)**: MEDIUM improvements #6-10
   - [ ] Enhance error handling
   - [ ] Add i18n & UX improvements

4. **Final Validation**:
   - [ ] All tests passing
   - [ ] Coverage 85%+
   - [ ] Performance benchmark passed
   - [ ] Ready for production

