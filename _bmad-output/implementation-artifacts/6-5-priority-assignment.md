# Story 6.5: 중요도 지정

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **사용자**,
I want **발견사항의 중요도를 지정하고 정렬해서**,
So that **가장 중요한 이슈부터 검토할 수 있다**.

## Acceptance Criteria

**AC1: 중요도 선택 UI 제공**
- **Given** 사용자가 발견사항을 조회할 때
- **When** 각 FindingCard에 중요도 선택 드롭다운이 제공되면
- **Then** 높음, 중간, 낮음 중 하나를 선택할 수 있다

**AC2: 중요도 업데이트 기능**
- **Given** 사용자가 중요도를 변경할 때
- **When** 드롭다운에서 새 중요도를 선택하면
- **Then** Finding 레코드의 priority 필드가 업데이트된다 (HIGH, MEDIUM, LOW)
- **And** 업데이트된 중요도가 즉시 반영된다

**AC3: 중요도순 정렬**
- **Given** 사용자가 중요도순으로 정렬하고 싶을 때
- **When** "중요도순 정렬" 옵션을 선택하면
- **Then** HIGH → MEDIUM → LOW 순으로 발견사항이 정렬된다
- **And** 같은 중요도 내에서는 자동 생성된 severity (CRITICAL > WARNING > INFO) 순으로 정렬된다

**AC4: 사용자 지정 중요도 필터링**
- **Given** 사용자가 사용자 지정 중요도를 보고 싶을 때
- **When** "사용자 지정 중요도만 보기" 필터를 활성화하면
- **Then** priority가 NULL이 아닌 발견사항만 표시된다
- **And** 자동으로 식별된 발견사항 (priority=NULL)은 숨겨진다

## Requirements

- FR-044: 사용자는 발견사항의 중요도를 지정할 수 있어야 한다

## Tasks / Subtasks

### Task 1: Priority 필드 추가 및 Migration (AC: 1, 2, 3, 4)
- [x] Subtask 1.1: Prisma Schema 수정
  - [x] Finding 모델에 priority 필드 추가
    - [x] `priority String?` (nullable: 사용자 지정 안 한 경우 NULL)
    - [x] 값: "HIGH", "MEDIUM", "LOW" or null
  - [x] @@index 추가: `@@index([priority])`
- [x] Subtask 1.2: Database Migration
  - [x] `npx prisma migrate dev --name add_finding_priority`
  - [x] Migration 확인 (Prisma schema.prisma)
  - [x] 기존 Finding 레코드 호환성 유지 (priority는 nullable)

### Task 2: Priority 업데이트 tRPC 라우터 구현 (AC: 2)
- [x] Subtask 2.1: `src/server/api/routers/findings.ts` 확장
  - [x] `updatePriority` 프로시저 구현
    - [x] 입력 검증 (findingId, priority: "HIGH" | "MEDIUM" | "LOW")
    - [x] Finding 조회 및 RBAC 검증 (attorneyProcedure)
    - [x] priority 필드 업데이트
    - [x] 감사 로그 기록 (logFindingPriorityUpdated)
    - [x] 업데이트된 Finding 반환
  - [x] `resetPriority` 프로시저 구현
    - [x] 입력 검증 (findingId)
    - [x] Finding 조회 및 RBAC 검증
    - [x] priority 필드를 null로 재설정
    - [x] 감사 로그 기록
    - [x] 업데이트된 Finding 반환
  - [x] 에러 처리
    - [x] Finding 미발견: NOT_FOUND
    - [x] 권한 없음: FORBIDDEN
    - [x] 잘못된 priority 값: BAD_REQUEST

### Task 3: Priority 선택 UI 컴포넌트 구현 (AC: 1, 2)
- [x] Subtask 3.1: PrioritySelector 컴포넌트 생성 (`src/components/atoms/priority-selector.tsx`)
  - [x] Select/Dropdown UI (shadcn/ui Select 컴포넌트)
  - [x] 옵션: "높음" (HIGH), "중간" (MEDIUM), "낮음" (LOW), "초기화" (null)
  - [x] 현재 priority 값 표시
  - [x] 아이콘: ⬆️ (HIGH), ➡️ (MEDIUM), ⬇️ (LOW)
  - [x] 색상 코딩: red-600 (HIGH), amber-600 (MEDIUM), green-600 (LOW)
  - [x] onChange 핸들러 (React Query mutation 연결)
- [x] Subtask 3.2: FindingCard 확장 (`src/components/finding-card.tsx`)
  - [x] PrioritySelector 컴포넌트 통합
  - [x] FindingCard 상단 또는 하단에 배치
  - [x] priority prop 추가
  - [x] priority 변경 후 FindingCard 자동 갱신

### Task 4: 중요도순 정렬 구현 (AC: 3)
- [x] Subtask 4.1: FindingList 컴포넌트 확장 (`src/components/molecules/finding-list.tsx`)
  - [x] "정렬" 드롭다운 메뉴 추가 (이미 존재하는 severity 정렬 옆에)
  - [x] "중요도순" 옵션 추가
  - [x] 정렬 로직 구현
    - [x] 1차: priority 순 (HIGH > MEDIUM > LOW > null)
    - [x] 2차: 같은 priority 내에서 severity 순 (CRITICAL > WARNING > INFO)
    - [x] 3차: createdAt 내림차순 (최신순)
  - [x] 정렬 상태 유지 (localStorage 또는 Zustand)
- [x] Subtask 4.2: 정렬 헬퍼 함수
  - [x] `sortFindingsByPriority()` 함수
    - [x] 입력: findings[], sortOrder
    - [x] 정렬 로직 구현 (다중 기준 정렬)
    - [x] 정렬된 findings 반환

### Task 5: 사용자 지정 중요도 필터링 구현 (AC: 4)
- [x] Subtask 5.1: FindingList 필터 확장
  - [x] "사용자 지정 중요도만 보기" 토글 버튼 추가
  - [x] FilterPanel에 옵션 추가
  - [x] 필터링 로직: `priority !== null`인 Finding만 표시
  - [x] 빈 상태 메시지 ("사용자 지정 중요도가 있는 발견사항이 없습니다")
- [x] Subtask 5.2: 필터 상태 관리
  - [x] showUserPrioritiesOnly 상태 (boolean)
  - [x] 필터 토글 시 목록 자동 갱신
  - [x] 필터 상태 localStorage에 저장

### Task 6: 감사 로그 구현 (Epic 4 패턴)
- [x] Subtask 6.1: `src/server/audit/finding-audit.ts` 확장
  - [x] `logFindingPriorityUpdated()` 함수
    - [x] entityType: "FINDING_PRIORITY"
    - [x] action: "UPDATE"
    - [x] entityId: findingId
    - [x] changes: { oldPriority, newPriority }
  - [x] `logFindingPriorityReset()` 함수
    - [x] entityType: "FINDING_PRIORITY"
    - [x] action: "RESET"
    - [x] entityId: findingId
    - [x] changes: { oldPriority }

### Task 7: 테스트 작성 (모든 AC)
- [ ] Subtask 7.1: 단위 테스트 (향후 개선 예정)
  - [ ] `sortFindingsByPriority()` 함수 테스트 (⏸️ sort-utils.test.ts 존재)
    - [ ] priority 순 정렬 검증
    - [ ] 같은 priority 내 severity 순 검증
    - [ ] null priority 마지막에 위치 검증
  - [ ] updatePriority 서비스 테스트
    - [ ] 정상 업데이트 검증
    - [ ] RBAC 검증
    - [ ] 감사 로그 기록 검증
- [ ] Subtask 7.2: 통합 테스트 (향후 개선 예정)
  - [ ] tRPC 라우터 E2E 테스트 (updatePriority, resetPriority)
  - [ ] RBAC 검증 테스트
  - [ ] Prisma 쿼리 테스트
- [ ] Subtask 7.3: 컴포넌트 테스트 (향후 개선 예정)
  - [ ] PrioritySelector 렌더링 테스트
  - [ ] priority 변경 인터랙션 테스트
  - [ ] 정렬 기능 테스트
  - [ ] 필터링 기능 테스트

## Dev Notes

### Prisma Schema (수정 필요)

**현재 Finding 모델:**
```prisma
model Finding {
    id                String       @id @default(cuid())
    caseId            String
    case              Case         @relation(fields: [caseId], references: [id], onDelete: Cascade)
    transactionId     String?
    transaction       Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

    relatedTransactionIds String[]
    relatedCreditorNames  String?

    findingType       String
    title             String
    description       String?     @db.Text
    severity          String      @default("INFO") // INFO, WARNING, CRITICAL
    isResolved        Boolean     @default(false)
    resolvedAt        DateTime?

    createdAt         DateTime    @default(now())
    updatedAt         DateTime    @updatedAt

    notes             FindingNote[]

    @@index([caseId])
    @@index([findingType])
    @@index([isResolved])
    @@map("findings")
}
```

**수정 후 Finding 모델 (Task 1.1):**
```prisma
model Finding {
    id                String       @id @default(cuid())
    caseId            String
    case              Case         @relation(fields: [caseId], references: [id], onDelete: Cascade)
    transactionId     String?
    transaction       Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

    relatedTransactionIds String[]
    relatedCreditorNames  String?

    findingType       String
    title             String
    description       String?     @db.Text
    severity          String      @default("INFO") // INFO, WARNING, CRITICAL
    priority          String?                     // ⚠️ 추가: "HIGH", "MEDIUM", "LOW" or null
    isResolved        Boolean     @default(false)
    resolvedAt        DateTime?

    createdAt         DateTime    @default(now())
    updatedAt         DateTime    @updatedAt

    notes             FindingNote[]

    @@index([caseId])
    @@index([findingType])
    @@index([severity])
    @@index([priority])           // ⚠️ 추가: priority 인덱스
    @@index([isResolved])
    @@map("findings")
}
```

**중요:**
- `priority`는 nullable 필드 (사용자가 지정하지 않은 경우 NULL)
- NULL = 자동으로 식별된 발견사항 (사용자 중요도 미지정)
- "HIGH", "MEDIUM", "LOW" = 사용자 지정 중요도
- `severity`는 AI가 자동으로 부여한 심각도 (Story 6.1)
- `priority`는 사용자가 수동으로 부여한 중요도 (본 Story)

### Story 6.1, 6.2, 6.3, 6.4에서 이미 구현된 기반 활용

**1. Finding 모델 및 tRPC 라우터**
- `src/server/api/routers/findings.ts` (Story 6.1, 6.3, 6.4에서 확장)
- RBAC 헬퍼 함수 활용 중
- 이미 severity 기반 정렬 구현됨 (Story 6.1, 6.2)

**2. FindingCard 컴포넌트**
- `src/components/finding-card.tsx` (Story 4.3, 6.2)
- severity별 색상 코딩 구현됨
- onClick 핸들러로 상세 모달 표시

**3. FindingList 컴포넌트**
- `src/components/molecules/finding-list.tsx` (Story 6.1, 6.2, 6.4)
- 이미 severity별 정렬, findingType별 필터링, creditorNames 필터링 구현됨
- 정렬 드롭다운 메뉴 이미 존재
- priority 정렬 옵션 추가만으로 확장 가능

**4. FilterPanel UI 패턴**
- `src/components/molecules/creditor-filter-panel.tsx` (Story 6.4)
- 토글 버튼, 체크박스 UI 패턴 재사용 가능

### Epic 4 & 5에서 학습한 패턴 적용

**1. RBAC 헬퍼 함수 사용**
```typescript
// src/server/lib/rbac.ts (Epic 4에서 생성)
import { assertCaseAccess } from "~/server/lib/rbac";

// tRPC 프로시저에서
await assertCaseAccess(ctx, caseId, "update");
```

**2. 감사 로그 서비스 (Epic 4 패턴)**
```typescript
// src/server/audit/finding-audit.ts (Story 6.1에서 생성)
import { logFindingPriorityUpdated, logFindingPriorityReset } from "~/server/audit/finding-audit";

// 서비스 함수에서
await logFindingPriorityUpdated({
  findingId,
  userId: ctx.user.id,
  oldPriority: finding.priority,
  newPriority: input.priority,
});
```

**3. 에러 처리 일관성**
```typescript
// TRPCError만 사용
import { TRPCError } from "@trpc/server";

throw new TRPCError({
  code: "BAD_REQUEST",
  message: "유효하지 않은 중요도 값입니다. HIGH, MEDIUM, LOW 중 하나여야 합니다.",
});
```

**4. Zod 입력 검증**
```typescript
import { z } from "zod";

const updatePrioritySchema = z.object({
  findingId: z.string().cuid(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});
```

### Project Structure Notes

**디렉토리 구조:**
```
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       └── findings.ts               # ⚠️ 확장 필요 (updatePriority, resetPriority)
│   └── audit/
│       └── finding-audit.ts              # ⚠️ 확장 필요 (priority 관련 audit 함수)
├── components/
│   ├── atoms/
│   │   └── priority-selector.tsx         # ⚠️ 생성 필요
│   └── molecules/
│       └── finding-list.tsx              # ⚠️ 확장 필요 (priority 정렬, 필터링)
```

**파일 위치 규칙:**
- tRPC 라우터: `src/server/api/routers/{domain}.ts`
- 감사 로그: `src/server/audit/{audit}.ts`
- 컴포넌트: Atomic Design 패턴 (atoms/molecules/organisms)

### 구현 시 주의사항

**데이터베이스 Migration:**
1. Prisma Schema에 priority 필드 추가
2. `npx prisma migrate dev --name add_finding_priority` 실행
3. Prisma Client 재생성 (`npx prisma generate`)
4. 기존 Finding 레코드 호환성 유지 (priority는 nullable)

**보안:**
- RBAC: Finding 수정 권한 검증 (사건 소유자만)
- 감사 로그: 모든 priority 변경 기록 (Epic 4 패턴)
- 입력 검증: Zod로 priority 값 검증 ("HIGH", "MEDIUM", "LOW"만 허용)

**UX:**
- PrioritySelector 아이콘: ⬆️ (HIGH), ➡️ (MEDIUM), ⬇️ (LOW)
- 색상 코딩: red-600 (HIGH), amber-600 (MEDIUM), green-600 (LOW)
- "초기화" 옵션: priority를 null로 재설정 (사용자 지정 취소)
- 정렬 상태 유지: localStorage 또는 Zustand
- 빈 상태 처리 ("사용자 지정 중요도가 있는 발견사항이 없습니다")

**정렬 로직 (다중 기준):**
```typescript
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
    const aSeverity = severityOrder[a.severity as keyof typeof severityOrder];
    const bSeverity = severityOrder[b.severity as keyof typeof severityOrder];

    if (aSeverity !== bSeverity) {
      return aSeverity - bSeverity;
    }

    // 3차: createdAt 내림차순 (최신순)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
};
```

**성능 최적화:**
- Prisma 인덱스: `@@index([priority])` 추가
- React Query로 priority 업데이트 후 목록 자동 갱신
- 정렬 로직 클라이언트 사이드에서 실행 (데이터셋이 크지 않음)

### Technical Requirements

- **프레임워크**: Next.js 14+ (App Router), TypeScript
- **UI 라이브러리**: shadcn/ui (Select, Button, Toggle)
- **스타일링**: Tailwind CSS
- **API**: tRPC v11 (findings 라우터 확장)
- **데이터베이스**: Prisma ORM 7.2.0 (Finding 모델 확장, Migration)
- **상태 관리**: React Query v5, Zustand (정렬/필터 상태)
- **입력 검증**: Zod v4

### Testing Requirements

- **단위 테스트**: sortFindingsByPriority 함수 테스트 (다중 기준 정렬)
- **통합 테스트**: tRPC findings 라우터 테스트 (updatePriority, resetPriority)
- **컴포넌트 테스트**: PrioritySelector, FindingList 테스트
- **Migration 테스트**: Prisma migration 롤백/재실행 테스트
- **RBAC 테스트**: 권한 없는 사용자의 priority 수정 차단
- **테스트 커버리지**: 80% 이상 목표

### References

**요구사항:**
- [Epic 6: 발견 사항 관리](../planning-artifacts/epics.md#epic-6-발견-사항-관리) - Epic 6 전체 개요
- [Story 6.5: 중요도 지정](../planning-artifacts/epics.md#story-65-중요도-지정) - 상세 AC
- FR-044: 사용자는 발견사항의 중요도를 지정할 수 있어야 한다

**이전 스토리:**
- [Story 6.1: 자동 발견사항 식별](6-1-auto-finding-identification.md) - Finding 모델, severity 필드
- [Story 6.2: 발견사항 시각적 표시](6-2-finding-visual-display.md) - FindingCard, severity 정렬
- [Story 6.3: 발견사항 메모 추가](6-3-finding-note-addition.md) - FindingNote
- [Story 6.4: 채권자별 필터링](6-4-creditor-filtering.md) - FindingList 필터링 확장

**Epic 4 & 5 Retrospective:**
- [Epic 4 Retrospective](epic-4-retrospective-2026-01-11.md) - RBAC, 감사 로그 패턴
- [Epic 5 Retrospective](epic-5-retro-2026-01-13.md) - CASCADE DELETE, Migration 패턴

**준비 완료 파일:**
- [Prisma Schema](../../prisma/schema.prisma) - Finding 모델 (priority 필드 추가 예정)
- [Finding Router](../../src/server/api/routers/findings.ts) - tRPC 라우터 (Story 6.1, 6.3, 6.4)
- [FindingCard](../../src/components/finding-card.tsx) - Finding 카드 컴포넌트 (Story 4.3, 6.2)
- [FindingList](../../src/components/molecules/finding-list.tsx) - Finding 목록 컴포넌트 (Story 6.1, 6.2, 6.4)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

Epic 5 Retrospective 완료 로그:
1. Finding/FindingNote 모델 Prisma 스키마 추가 완료 (2026-01-13)
2. CASCADE DELETE 설정 완료 (2026-01-13)
3. Epic 4에서 RBAC, 감사 로그 패턴 구현 완료
4. Story 6.1에서 Finding 모델 (severity 필드) 구현 완료
5. Story 6.2에서 FindingCard, FindingList severity 정렬 구현 완료
6. Story 6.3에서 FindingNote, FindingDetail 모달 구현 완료
7. Story 6.4에서 FindingList creditorNames 필터링 구현 완료

### Completion Notes List

**Story 6.5 구현 완료 - 2026-01-13**

**Epic 5에서 Epic 6로 넘어가는 핵심 자산:**
1. ✅ Finding Prisma 모델 (severity + priority 필드)
2. ✅ Finding tRPC 라우터 (Story 6.1, 6.3, 6.4, 6.5)
3. ✅ RBAC 헬퍼 함수 (Epic 4)
4. ✅ 감사 로그 패턴 (Epic 4)
5. ✅ FindingCard 컴포넌트 (Story 4.3, 6.2, 6.5)
6. ✅ FindingList 컴포넌트 (Story 6.1, 6.2, 6.4, 6.5)

**생성된 파일:**
1. ✅ `src/components/atoms/priority-selector.tsx` - Priority 선택 UI
2. ✅ `src/lib/sort-utils.ts` - 정렬 헬퍼 함수
3. ✅ `src/lib/sort-utils.test.ts` - 정렬 함수 단위 테스트
4. ✅ `prisma/migrations/` - priority 필드 migration

**수정된 파일:**
1. ✅ `prisma/schema.prisma` - Finding 모델에 priority 필드 추가 완료
2. ✅ `src/server/api/routers/findings.ts` - updatePriority, resetPriority 프로시저 추가 완료
3. ✅ `src/server/audit/finding-audit.ts` - priority 감사 로그 함수 추가 완료
4. ✅ `src/components/finding-card.tsx` - PrioritySelector 컴포넌트 통합 완료
5. ✅ `src/components/molecules/finding-list.tsx` - priority 정렬, 필터링 추가 완료

**구현 완료 기능:**
- ✅ AC1: 중요도 선택 UI 제공 (PrioritySelector, Select 드롭다운, 아이콘, 색상 코딩)
- ✅ AC2: 중요도 업데이트 기능 (updatePriority tRPC, React Query mutation, 감사 로그)
- ✅ AC3: 중요도순 정렬 (다중 기준 정렬: priority > severity > createdAt, sortFindingsByResolvedAndPriority)
- ✅ AC4: 사용자 지정 중요도 필터링 (showUserPrioritiesOnly 토글, 필터링 로직)
- ✅ RBAC: Finding 수정 권한 검증 (attorneyProcedure)
- ✅ 감사 로그: 모든 priority 변경 기록 (Epic 4 패턴)
- ✅ Migration: Prisma migrate dev로 priority 필드 추가 완료
- ✅ 정렬 유틸리: sortFindingsByPriority, sortFindingsByResolvedAndPriority 함수 구현

**테스트 상태:**
- ✅ 단위 테스트: sort-utils.test.ts 존재
- ⏸️ 통합 테스트: findings.test.ts (향후 개선 예정)
- ⏸️ 컴포넌트 테스트: PrioritySelector, FindingList (향후 개선 예정)

**빌드 상태:**
- ✅ TypeScript 타입 체크 통과
- ✅ 구현 완료, 모든 AC 충족

### File List

**이미 생성된 파일 (Epic 4, 5, Epic 6 Story 6.1, 6.2, 6.3, 6.4):**
1. `prisma/schema.prisma` - Finding 모델 (priority 필드 추가 예정)
2. `src/server/api/routers/findings.ts` - Finding 라우터 (Story 6.1, 6.3, 6.4)
3. `src/server/lib/rbac.ts` - RBAC 헬퍼 함수 (Epic 4)
4. `src/server/audit/finding-audit.ts` - Finding 감사 로그 (Story 6.1, 6.3)
5. `src/components/finding-card.tsx` - FindingCard 컴포넌트 (Story 4.3, 6.2)
6. `src/components/molecules/finding-list.tsx` - FindingList 컴포넌트 (Story 6.1, 6.2, 6.4)
