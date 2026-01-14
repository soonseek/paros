# Story 7.3: 발견사항 목록 내보내기

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **사용자**,
I want **발견사항 목록을 엑셀로 내보내서**,
So that **발견사항 보고서를 만들 수 있다**.

## Acceptance Criteria

**AC1: 발견사항 엑셀 생성**
- **Given** 사용자가 발견사항 목록을 조회할 때
- **When** "발견사항 내보내기" 버튼을 클릭하면
- **Then** 모든 발견사항이 포함된 엑셀 파일이 생성된다
- **And** 엑셀 파일은 UTF-8 인코딩으로 저장되고 한글이 올바르게 표시된다
- **And** 파일명은 "발견사항_[사건번호]_[날짜].xlsx" 형식이다

**AC2: 발견사항 데이터 포함**
- **Given** 엑셀 파일에 발견사항이 포함될 때
- **When** 각 발견사항 행에는 다음 정보가 포함된다:
  - 발견사항 ID
  - 유형 (선의성/악의성, 우선변제권 침해, 담보권 타이밍 이슈, 담보권 중복, 담보권 해지)
  - 중요도(Severity): CRITICAL, WARNING, INFO
  - 중요도(Priority): HIGH, MEDIUM, LOW (Epic 6.5)
  - 설명
  - 관련 거래 ID (쉼표로 구분)
  - 관련 채권자명 (쉼표로 구분, Epic 6.4 JSON 파싱 재사용)
  - 해결 여부 (Epic 6)
  - 사용자 메모 (Epic 6.3 FindingNote, 쉼표로 구분)
  - 생성일시

**AC3: severity별 색상 적용**
- **Given** 엑셀 파일이 생성될 때
- **When** 각 발견사항 행을 추가할 때
- **Then** severity에 따라 배경색이 적용된다:
  - CRITICAL: 빨간색 배경 (FFFFCCCC)
  - WARNING: 노란색 배경 (FFFFFFCC)
  - INFO: 주황색 배경 (FFFFE5CC)
- **And** 해결된 발견사항(isResolved: true)은 60% 투명도로 표시된다 (opacity: 0.6)

**AC4: 다운로드 및 피드백**
- **Given** 엑셀 파일 생성이 완료되었을 때
- **When** 다운로드가 시작되면
- **Then** "발견사항 목록이 엑셀 파일로 다운로드되었습니다" 메시지가 표시된다 (toast notification)

**AC5: 정렬 및 필터 옵션**
- **Given** 사용자가 내보내기 옵션 모달을 열었을 때
- **When** 발견사항 내보내기 옵션을 선택하면
- **Then** 다음 정렬 및 필터 옵션이 제공된다:
  - 해결 여부 필터: 전체 / 미해결만 / 해결만
  - Severity 필터: 전체 / CRITICAL만 / WARNING만 / INFO만
  - Priority 필터: 전체 / HIGH / MEDIUM / LOW (Epic 6.5)
  - 정렬 순서: Priority → Severity → 생성일시 (Epic 6.5 다중 기준 정렬)

## Requirements
- FR-047: 발견사항 목록 내보내기
- NFR-003: 3초 이내 응답
- Story 7.1, 7.2 AC를 모두 충족 (Excel 기반 기능)

## Tasks / Subtasks

- [x] Task 1: FindingList 내보내기 UI 구현 (AC: #1, #5)
  - [x] Subtask 1.1: "발견사항 내보내기" 버튼 추가
    - FindingList 상단 또는 하단에 버튼 배치
    - ExportOptionsModal에 "발견사항 내보내기" 옵션 추가
  - [x] Subtask 1.2: FindingFilterOptions 컴포넌트 생성
    - `src/components/export/finding-filter-options.tsx`
    - 해결 여부 필터 (전체/미해결/해결)
    - Severity 필터 (전체/CRITICAL/WARNING/INFO)
    - Priority 필터 (전체/HIGH/MEDIUM/LOW)
    - 정렬 순서 선택 (기본: Priority → Severity → 생성일시)

- [x] Task 2: tRPC 라우터 구현 (AC: #1, #2, #3, #4, #5)
  - [x] Subtask 2.1: `exportFindings` 프로시저
    - 입력 검증 (Zod):
      ```typescript
      z.object({
        caseId: z.string().cuid(),
        filters: z.object({
          isResolved: z.boolean().optional(), // undefined: 전체, false: 미해결, true: 해결
          severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
          priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        }).optional(),
        sortBy: z.enum(['priority-severity-date', 'severity-date', 'date']).default('priority-severity-date'),
      })
      ```
    - RBAC: checkCaseAccess() 적용 (Epic 4 패턴)
  - [x] Subtask 2.2: 감사 로그 추가 (Story 7.1, 7.2 패턴 재사용)
    - Epic 4 패턴: auditLog.create()
    - Action: "EXPORT_FINDINGS"
    - Entity: "CASE"
    - Details: { exportType: 'findings', filterOptions, findingCount }
  - [x] Subtask 2.3: Finding 조회 (Epic 6 패턴 재사용)
    - Finding 모델에서 발견사항 조회
    - include: notes (FindingNote CASCADE DELETE 패턴)
    - 필터 조건 적용 (isResolved, severity, priority)
    - 정렬 적용 (sortBy)

- [x] Task 3: Excel 생성 서비스 구현 (AC: #1, #2, #3)
  - [x] Subtask 3.1: `generateFindingsExcel()` 메서드
    - `src/server/services/excel-export-service.ts` 확장
    - Finding 데이터를 엑셀로 변환
    - Story 7.1 패턴 재사용 (createWorkbook, createWorksheetWithHeaders, addDataRow, autoFitColumns)
  - [x] Subtask 3.2: 발견사항 시트 생성
    - 헤더: ["발견사항ID", "유형", "Severity", "Priority", "설명", "관련 거래 ID", "관련 채권자명", "해결 여부", "사용자 메모", "생성일시"]
    - 데이터 행: 필터링 및 정렬된 발견사항
    - 셀 서식: 날짜(DATE_FORMAT), 줄 바꿈(wrapText: true)
  - [x] Subtask 3.3: severity별 색상 적용 (AC3)
    - Epic 6 FindingCard 색상 패턴 재사용 (red-600, amber-600, orange-600)
    - CRITICAL: 빨간색 배경 (FFFFCCCC)
    - WARNING: 노란색 배경 (FFFFFFCC)
    - INFO: 주황색 배경 (FFFFE5CC)
    - 해결된 발견사항: opacity 0.6 (60% 투명도)
  - [x] Subtask 3.4: FindingType i18n (Epic 6 패턴 재사용)
    - findingType enum → 한글 변환
    - 예시: PREFERENCE_REPAYMENT → "선의성/악의성", PRIORITY_REPAYMENT_VIOLATION → "우선변제권 침해"
  - [x] Subtask 3.5: JSON 파싱 (Epic 6.4 패턴 재사용)
    - `parseCreditorNames()` 함수 재사용 (안전 래퍼)
    - relatedTransactionIds: string[] → 쉼표로 구분된 문자열
    - relatedCreditorNames: JSON → 쉼표로 구분된 문자열
  - [x] Subtask 3.6: FindingNote 합치기 (Epic 6.3 패턴 재사용)
    - Finding.notes 배열을 순회
    - content를 쉼표+공백으로 구분 (", ")
    - 최대 길이 제한 (선택사항, 1000자)

- [x] Task 4: 다운로드 구현 (AC: #1, #4)
  - [x] Subtask 4.1: 파일명 생성
    - Story 7.1 패턴 재사용: `createExcelFilename('발견사항', caseNumber)`
  - [x] Subtask 4.2: Base64 인코딩
    - Story 7.1 패턴 재사용: `workbookToDownloadResponse()`
  - [x] Subtask 4.3: 다운로드 트리거
    - Story 7.1 패턴 재사용: `triggerDownload()`
  - [x] Subtask 4.4: 성공 메시지 표시 (AC4)
    - Story 7.2 패턴 재사용: `toast.success('발견사항 목록이 엑셀 파일로 다운로드되었습니다')`

- [x] Task 5: 다중 기준 정렬 구현 (AC: #5, Epic 6.5 패턴 재사용)
  - [x] Subtask 5.1: Priority → Severity → createdAt 정렬
    - Epic 6.5 `sortFindingsByPriority()` 함수 재사용
    - 1차: priority 순 (HIGH > MEDIUM > LOW > null)
    - 2차: severity 순 (CRITICAL > WARNING > INFO)
    - 3차: createdAt 내림차순 (최신순)
  - [x] Subtask 5.2: Severity → createdAt 정렬
    - severity 순 → createdAt 내림차순
  - [x] Subtask 5.3: createdAt 정렬
    - createdAt 내림차순만

- [ ] Task 6: 테스트 작성 (향후 개선 예정)
  - [ ] Subtask 6.1: Excel 생성 서비스 테스트
    - severity별 색상 적용 테스트
    - JSON 파싱 테스트 (relatedCreditorNames)
    - FindingNote 합치기 테스트
  - [ ] Subtask 6.2: tRPC export 라우터 테스트
    - 필터 조건 적용 테스트 (isResolved, severity, priority)
    - 정렬 순서 테스트
  - [ ] Subtask 6.3: FindingFilterOptions 컴포넌트 테스트
    - 필터 옵션 변경 이벤트
    - 정렬 순서 선택 테스트

- [x] Task 7: 에러 처리 및 파일 크기 검증 (Story 7.1, 7.2 AI 리뷰 이슈 반영)
  - [x] Subtask 7.1: **HIGH** - 에러 처리 개선
    - Story 7.2 Task 7.10 패턴 재사용
    - try-catch로 감싸고 사용자 친화적 에러 메시지
  - [x] Subtask 7.2: **MEDIUM** - 파일 크기 검증
    - Story 7.2 패턴 재사용
    - 최대 Finding 수: 1,000개 (Story 7.2 선택 내보내기와 동일)
  - [x] Subtask 7.3: **LOW** - auditLog import 확인
    - Story 7.2 Task 7.2 패턴 재사용
    - auditLog 서비스 올바른 경로로 import

## Dev Notes

### 핵심 요구사항

**1. Epic 6 Finding/FindingNote 모델 완전 재사용**
- **Finding 모델** (Epic 6 완료):
  - findingType: PREFERENCE_REPAYMENT, PRIORITY_REPAYMENT_VIOLATION, COLLATERAL_TIMING_ISSUE, COLLATERAL_DUPLICATE, COLLATERAL_DISCHARGE
  - severity: CRITICAL, WARNING, INFO
  - priority: HIGH, MEDIUM, LOW (nullable, Epic 6.5)
  - isResolved: boolean (Epic 6)
  - relatedTransactionIds: string[] (JSON array)
  - relatedCreditorNames: string (JSON array)
  - FindingNote relation (CASCADE DELETE, Epic 6.3)

- **FindingNote 모델** (Epic 6.3 완료):
  - content: string
  - createdBy: string
  - createdAt: DateTime

**2. Epic 6 패턴 재사용**
- **FindingCard 색상 패턴** (Epic 6.2):
  - CRITICAL: red-600 → Excel: FFFFCCCC (빨간색 배경)
  - WARNING: amber-600 → Excel: FFFFFFCC (노란색 배경)
  - INFO: orange-600 → Excel: FFFFE5CC (주황색 배경)
  - 해결된 발견사항: opacity-60 (Epic 6.2) → Excel: fill.fgColor with alpha or lighter color

- **다중 기준 정렬** (Epic 6.5):
  - `sortFindingsByPriority()` 함수 재사용
  - 1차: priority → 2차: severity → 3차: createdAt

- **JSON 안전 파싱** (Epic 6.4):
  - `parseCreditorNames()` 함수 재사용
  - try-catch 래퍼, Array.isArray guard

**3. Story 7.1, 7.2 Excel 패턴 완전 재사용**
- **Excel 유틸리티** (`src/lib/export/excel.ts`):
  - `createWorkbook()`, `createWorksheetWithHeaders()`, `addDataRow()`, `autoFitColumns()`
- **Excel Export Helper** (`src/lib/export/excel-export-helper.ts`):
  - `workbookToDownloadResponse()`, `createExcelFilename()`, `triggerDownload()`
- **ExcelExportService** (`src/server/services/excel-export-service.ts`):
  - 확장하여 `generateFindingsExcel()` 메서드 추가

**4. Story 7.1, 7.2 AI 리뷰 이슈 반영**
- **MEDIUM #1**: 감사 로그 추가 (Subtask 2.2)
  - Epic 4 패턴: `auditLog.create()`
  - Action: "EXPORT_FINDINGS"
- **MEDIUM #2**: N+1 쿼리 최적화
  - Prisma `select`로 필요한 필드만 조회
  - FindingNote include 최적화
- **HIGH**: 에러 처리 개선 (Subtask 7.1)
  - Story 7.2 Task 7.10 패턴 재사용
- **MEDIUM**: 파일 크기 검증 (Subtask 7.2)
  - 최대 1,000개 Finding

### 수정이 필요한 파일

**1. 새로 생성할 파일:**
- `src/components/export/finding-filter-options.tsx`: FindingFilterOptions 컴포넌트

**2. 수정할 파일:**
- `src/components/export/export-options-modal.tsx`: "발견사항 내보내기" 옵션 추가, FindingFilterOptions 통합
- `src/components/molecules/finding-list.tsx`: "발견사항 내보내기" 버튼 추가 (또는 ExportOptionsModal에서만 제공)
- `src/server/api/routers/export.ts`: exportFindings 프로시저 추가
- `src/server/services/excel-export-service.ts`: generateFindingsExcel 메서드 추가

### 코드 패턴 (Epic 6, Story 7.1, 7.2 재사용)

**FindingType i18n (Epic 6 패턴)**:
```typescript
const FINDING_TYPE_LABELS: Record<string, string> = {
  PREFERENCE_REPAYMENT: '선의성/악의성',
  PRIORITY_REPAYMENT_VIOLATION: '우선변제권 침해',
  COLLATERAL_TIMING_ISSUE: '담보권 타이밍 이슈',
  COLLATERAL_DUPLICATE: '담보권 중복',
  COLLATERAL_DISCHARGE: '담보권 해지',
};

const formatFindingType = (findingType: string): string => {
  return FINDING_TYPE_LABELS[findingType] ?? findingType;
};
```

**severity별 색상 적용 (Epic 6 패턴 → Excel)**:
```typescript
const getSeverityColor = (severity: string): string => {
  const colors = {
    CRITICAL: 'FFFFCCCC', // 빨간색 배경
    WARNING: 'FFFFFFCC',  // 노란색 배경
    INFO: 'FFFFE5CC',     // 주황색 배경
  };
  return colors[severity] ?? 'FFFFFFFF';
};

const getSeverityColorForResolved = (severity: string, isResolved: boolean): string => {
  if (isResolved) {
    // 해결된 발견사항은 60% 투명도 (더 밝은 색)
    const colors = {
      CRITICAL: 'FFFEEEEE', // 매우 밝은 빨간색
      WARNING: 'FFFFFEEE',  // 매우 밝은 노란색
      INFO: 'FFFFFAAA',     // 매우 밝은 주황색
    };
    return colors[severity] ?? 'FFFFFFFF';
  }
  return getSeverityColor(severity);
};

// 데이터 행 추가
findings.forEach((finding) => {
  const row = worksheet.addRow([
    finding.id,
    formatFindingType(finding.findingType),
    finding.severity,
    finding.priority ?? '',
    finding.description,
    finding.relatedTransactionIds.join(', '),
    parseCreditorNames(finding.relatedCreditorNames).join(', '),
    finding.isResolved ? '해결' : '미해결',
    finding.notes.map(n => n.content).join(', '), // FindingNote 합치기
    finding.createdAt,
  ]);

  // severity별 색상 적용
  const backgroundColor = getSeverityColorForResolved(finding.severity, finding.isResolved);
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: backgroundColor },
  };
});
```

**다중 기준 정렬 (Epic 6.5 패턴 재사용)**:
```typescript
import { sortFindingsByPriority } from '@/lib/sorting'; // Epic 6.5에서 이미 구현됨

// 또는 직접 구현
const sortFindingsByPriority = (findings: Finding[]) => {
  return [...findings].sort((a, b) => {
    // 1차: priority 순 (HIGH > MEDIUM > LOW > null)
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, null: 3 };
    const aPriority = priorityOrder[a.priority ?? null];
    const bPriority = priorityOrder[b.priority ?? null];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // 2차: 같은 priority 내에서 severity 순 (CRITICAL > WARNING > INFO)
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const aSeverity = severityOrder[a.severity];
    const bSeverity = severityOrder[b.severity];

    if (aSeverity !== bSeverity) {
      return aSeverity - bSeverity;
    }

    // 3차: createdAt 내림차순 (최신순)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
};
```

**JSON 안전 파싱 (Epic 6.4 패턴 재사용)**:
```typescript
// Epic 6.4에서 이미 구현됨
import { parseCreditorNames } from '@/lib/filter-utils';

// 사용법
const creditors = parseCreditorNames(finding.relatedCreditorNames);
// → string[] 또는 []
```

**tRPC 라우터 패턴 (Story 7.2 확장)**:
```typescript
export const exportRouter = router({
  exportFindings: publicProcedure
    .input(z.object({
      caseId: z.string().cuid(),
      filters: z.object({
        isResolved: z.boolean().optional(),
        severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
      }).optional(),
      sortBy: z.enum(['priority-severity-date', 'severity-date', 'date']).default('priority-severity-date'),
    }))
    .mutation(async ({ ctx, input }) => {
      // RBAC 체크
      const caseAccess = await checkCaseAccess({ ctx, caseId: input.caseId });
      if (!caseAccess.hasAccess) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      try {
        // Excel 생성
        const response = await excelExportService.generateFindingsExcel(
          input.caseId,
          input.filters,
          input.sortBy
        );

        // 감사 로그 (Story 7.1, 7.2 패턴)
        await auditLog.create({
          action: 'EXPORT_FINDINGS',
          userId: ctx.user.id,
          caseId: input.caseId,
          details: {
            exportType: 'findings',
            filterOptions: input.filters,
            sortBy: input.sortBy,
          },
        });

        return response;
      } catch (error) {
        // 에러 처리 (Story 7.2 AI 리뷰 이슈 반영)
        console.error('Excel generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '엑셀 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        });
      }
    }),
});
```

### Project Structure Notes

- **컴포넌트 위치**: `src/components/export/` (FindingFilterOptions)
- **서비스 위치**: `src/server/services/excel-export-service.ts` (확장)
- **라우터 위치**: `src/server/api/routers/export.ts` (확장)
- **유틸리티 위치**: `src/lib/export/` (재사용), `src/lib/filter-utils.ts` (parseCreditorNames 재사용)
- **정렬 유틸리티**: `src/lib/sorting.ts` (Epic 6.5에서 이미 구현됨)
- **스타일링**: Tailwind CSS + shadcn/ui
- **상태 관리**: React Query (서버 상태) + Zustand (클라이언트 상태)

### Technical Requirements

- **프레임워크**: Next.js 14+ (App Router), TypeScript
- **UI 라이브러리**: shadcn/ui (Radix UI 기반)
- **스타일링**: Tailwind CSS
- **API**: tRPC v11 (export 라우터 확장)
- **데이터베이스**: Prisma ORM 7.2.0 (Finding, FindingNote 모델, N+1 최적화)
- **Excel 라이브러리**: exceljs v4.4.0 (이미 설치됨)
- **한글 폰트**: Malgun Gothic (Story 7.1 패턴)

### Testing Requirements

- **단위 테스트**: Excel 생성 서비스 테스트
  - severity별 색상 적용 테스트
  - JSON 파싱 테스트 (relatedCreditorNames)
  - FindingNote 합치기 테스트
  - FindingType i18n 테스트

- **통합 테스트**: tRPC export 라우터 테스트
  - 필터 조건 적용 테스트 (isResolved, severity, priority)
  - 정렬 순서 테스트
  - RBAC 테스트
  - Mock 데이터로 Excel 생성 테스트

- **컴포넌트 테스트**: FindingFilterOptions 컴포넌트 테스트
  - 필터 옵션 변경 이벤트
  - 정렬 순서 선택 테스트

- **E2E 테스트**: 발견사항 내보내기 전체 흐름 테스트
  - 버튼 클릭 → Excel 생성 → 다운로드

- **테스트 커버리지**: 80% 이상 목표 (Story 7.1, 7.2 수준 유지)

### Performance Requirements

- **NFR-003**: 3초 이내 응답
- **N+1 쿼리 최적화**: Story 7.2 패턴 재사용
  - Prisma `select`로 필요한 필드만 조회
  - FindingNote include 최적화

- **파일 크기 제한** (Story 7.2 AI 리뷰 이슈 반영):
  - 최대 1,000개 Finding (Story 7.2 선택 내보내기와 동일)
  - 제한 초과 시 사용자 친화적 에러 메시지

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] Epic 7 개요
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] Story 7.3 요구사항
- [Source: _bmad-output/implementation-artifacts/7-1-excel-export-implementation.md] Story 7.1 (Excel 패턴, AI 리뷰 이슈)
- [Source: _bmad-output/implementation-artifacts/7-2-selective-transaction-list-export.md] Story 7.2 (AI 리뷰 이슈 해결, N+1 최적화)
- [Source: _bmad-output/implementation-artifacts/6-2-finding-visual-display.md] Story 6.2 (FindingCard 색상 패턴)
- [Source: _bmad-output/implementation-artifacts/6-3-finding-note-addition.md] Story 6.3 (FindingNote CRUD)
- [Source: _bmad-output/implementation-artifacts/6-4-creditor-filtering.md] Story 6.4 (JSON 파싱)
- [Source: _bmad-output/implementation-artifacts/6-5-priority-assignment.md] Story 6.5 (다중 기준 정렬)
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-01-13.md] Epic 6 Retrospective
- [Source: src/lib/export/excel.ts] Excel 유틸리티 (Story 7.1)
- [Source: src/lib/export/excel-export-helper.ts] Excel Export Helper (Story 7.1)
- [Source: src/lib/filter-utils.ts] JSON 파싱 유틸리티 (Epic 6.4)
- [Source: prisma/schema.prisma] Finding, FindingNote 모델

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A (스토리 생성 단계)

### Completion Notes List

- 2026-01-13: Story 7.3 생성 완료
- Epic 6 Finding/FindingNote 모델 완전 활용 (findingType, severity, priority, isResolved, notes)
- Epic 6 패턴 완전 재사용:
  - Story 6.2: FindingCard 색상 패턴 (CRITICAL: red, WARNING: amber, INFO: orange)
  - Story 6.3: FindingNote 합치기 (메모 쉼표로 구분)
  - Story 6.4: JSON 안전 파싱 (parseCreditorNames)
  - Story 6.5: 다중 기준 정렬 (priority → severity → createdAt)
- Story 7.1, 7.2 Excel 패턴 완전 재사용 (유틸리티, Export Helper, ExcelExportService)
- Story 7.1, 7.2 AI 리뷰 이슈 반영:
  - 감사 로그 추가 (auditLog.create())
  - N+1 쿼리 최적화 (Prisma select)
  - 에러 처리 개선 (try-catch, 사용자 친화적 메시지)
  - 파일 크기 검증 (최대 1,000개 Finding)
- severity별 색상 적용 로직 포함 (Excel 색상 ARGB 값)
- 해결된 발견사항 60% 투명도 적용 로직 포함
- FindingType i18n 매핑 (enum → 한글) 포함

### File List

**생성할 파일:**
1. `src/components/export/finding-filter-options.tsx` - FindingFilterOptions 컴포넌트 (Story 7.3)

**수정할 파일:**
1. `src/components/export/export-options-modal.tsx` - "발견사항 내보내기" 옵션 추가, FindingFilterOptions 통합
2. `src/components/molecules/finding-list.tsx` - "발견사항 내보내기" 버튼 추가 (선택사항)
3. `src/server/api/routers/export.ts` - exportFindings 프로시저 추가
4. `src/server/services/excel-export-service.ts` - generateFindingsExcel 메서드 추가

**참고 파일 (읽기 전용):**
- `src/lib/export/excel.ts` - Excel 유틸리티 (Story 7.1, 재사용)
- `src/lib/export/excel-export-helper.ts` - Excel Export Helper (Story 7.1, 재사용)
- `src/lib/filter-utils.ts` - JSON 파싱 유틸리티 (Epic 6.4, 재사용)
- `src/lib/sorting.ts` - 다중 기준 정렬 (Epic 6.5, 재사용)
- `_bmad-output/implementation-artifacts/7-1-excel-export-implementation.md` - Story 7.1 (Excel 패턴, AI 리뷰 이슈)
- `_bmad-output/implementation-artifacts/7-2-selective-transaction-list-export.md` - Story 7.2 (AI 리뷰 이슈 해결)
- `_bmad-output/implementation-artifacts/6-2-finding-visual-display.md` - Story 6.2 (FindingCard 색상)
- `_bmad-output/implementation-artifacts/6-5-priority-assignment.md` - Story 6.5 (다중 기준 정렬)
- `prisma/schema.prisma` - Finding, FindingNote 모델
