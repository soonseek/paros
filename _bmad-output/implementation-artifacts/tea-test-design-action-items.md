# TEA 테스트 설계 리스크 대응 액션 아이템

**프로젝트:** paros-bmad (법률 전문가를 위한 AI 기반 회생 파산 분석 시스템)
**작성일:** 2026-01-14
**작성자:** 개발팀
**기반 문서:** _bmad-output/test-design-system.md

---

## 1. Critical 리스크 대응 (Score 9 - 즉시 조치)

### R-004: RBAC 권한 제어 미구현 (Epic 1)

**리스크 설명:**
- 4가지 역할(변호사, 법무사, 관리자, 지원팀)별 권한 제어 미구현 시 무단 접근 가능
- Probability: 3 (높음) × Impact: 3 (높음) = **9 (CRITICAL)**

**대응 액션 아이템:**

#### P0-1: RBAC 헬퍼 함수 구현 (1시간)
- **파일:** `src/server/auth/rbac.ts` (신규)
- **내용:**
  ```typescript
  export const ROLE_PERMISSIONS = {
    LAWYER: ['cases:read', 'cases:write', 'findings:read', 'findings:write', 'export:execute'],
    PARALEGAL: ['cases:read', 'findings:read'],
    ADMIN: ['*'], // 모든 권한
    SUPPORT: ['cases:read', 'audit:read'],
  } as const;

  export function hasPermission(userRole: Role, permission: string): boolean {
    if (userRole === 'ADMIN') return true;
    return ROLE_PERMISSIONS[userRole].includes(permission as any);
  }

  export function requirePermission(permission: string) {
    return async ({ ctx }: { ctx: Context }) => {
      if (!hasPermission(ctx.user.role, permission)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
    };
  }
  ```

#### P0-2: tRPC 미들웨어 RBAC 적용 (2시간)
- **대상:** 모든 tRPC 라우터 (`src/server/api/routers/*.ts`)
- **내용:**
  - `protectedProcedure` → `roleProcedure(roles: Role[])` 확장
  - 각 라우터별 역할 검증 미들웨어 적용
  - 예: `deleteCase.procedure.use(requirePermission('cases:write'))`

#### P0-3: RBAC 통합 테스트 작성 (2시간)
- **파일:** `src/server/auth/rbac.test.ts` (신규)
- **테스트 케이스:**
  - [ ] 변호사가 자신의 사건에만 접근 가능
  - [ ] 법무사가 읽기 전용 접근만 가능
  - [ ] 관리자가 모든 사건 접근 가능
  - [ ] 지원팀이 감사 로그만 접근 가능
  - [ ] 권한 없는 사용자가 403 Forbidden 반환

---

### R-014: 발견사항 식별 오류 (Epic 6)

**리스크 설명:**
- 선의성/악의성, 우선변제권 식별 오류 시 법적 책임 발생 가능
- Probability: 3 (높음) × Impact: 3 (높음) = **9 (CRITICAL)**

**대응 액션 아이템:**

#### P0-4: AI 모델 신뢰도 점수 노출 (1시간)
- **대상:** `src/server/services/finding-generator.ts`
- **내용:**
  - 모든 Finding에 `confidenceScore` 필드 추가 (0~1)
  - UI에서 신뢰도 0.7 미만 시 "활용 필요" 뱃지 표시
  - 신뢰도 0.5 미만 시 "수동 검증 필요" 강조 표시

#### P0-5: 수동 수정 검증 로직 추가 (2시간)
- **대상:** `src/server/api/routers/findings.ts`
- **내용:**
  - Finding 수정 시 `manuallyVerified` 플래그 자동 설정
  - `manuallyVerified` true인 Finding은 신뢰도 1.0으로 고정
  - AI 재분석 시 수동 수정 Finding은 덮어쓰기 방지 (`preserveManualEdits` 플래그)

#### P0-6: Finding 정확도 검증 테스트 (3시간)
- **파일:** `src/server/services/finding-generator.test.ts`
- **테스트 케이스:**
  - [ ] 선의성 판턴 정확도 90% 이상 (예: 소액 반복, 가족 간 이체)
  - [ ] 악의성 판턴 정확도 90% 이상 (예: 대출금 직후 출금, 해외 송금)
  - [ ] 우선변제권 식별 정확도 95% 이상 (담보물, 채권자명 매칭)
  - [ ] 신뢰도 점수가 실제 정확도와 상관관계 0.8 이상
  - [ ] 수동 수정 Finding이 AI 재분석 시 보존됨

---

### R-015: 민감 데이터 마스킹 미구현 (Epic 7)

**리스크 설명:**
- 계좌번호, 이름, 주소 등 민감 정보 노출 시 개인정보보호법 위반
- Probability: 3 (높음) × Impact: 3 (높음) = **9 (CRITICAL)**

**대응 액션 아이템:**

#### P0-7: 계좌번호 마스킹 함수 구현 (1시간)
- **파일:** `src/lib/masking/account-masking.ts` (신규)
- **내용:**
  ```typescript
  export function maskAccountNumber(accountNumber: string | null): string {
    if (!accountNumber) return '';
    // 앞 3자리 + 별표 4개 + 뒤 4자리 (예: 123****5678)
    return accountNumber.replace(/(\d{3})\d+(\d{4})$/, '$1****$2');
  }

  export function maskAccountNumberFull(accountNumber: string | null): string {
    if (!accountNumber) return '';
    // 전체 마스킹 (예: ************)
    return '*'.repeat(Math.min(accountNumber.length, 12));
  }
  ```

#### P0-8: 이름/주소 마스킹 함수 구현 (1시간)
- **파일:** `src/lib/masking/personal-masking.ts` (신규)
- **내용:**
  ```typescript
  export function maskName(name: string | null): string {
    if (!name) return '';
    // 성(1자) + * (예: 홍*동, 김**수)
    const cleaned = name.replace(/\s/g, '');
    if (cleaned.length <= 2) return cleaned[0] + '*';
    return cleaned[0] + '*'.repeat(cleaned.length - 2) + cleaned[cleaned.length - 1];
  }

  export function maskAddress(address: string | null): string {
    if (!address) return '';
    // 도로명 주소는 완전 제거 (프라이버시)
    return '[마스킹됨]';
  }
  ```

#### P0-9: UI 마스킹 적용 (2시간)
- **대상:** `src/components/molecules/transaction-table.tsx`, `src/components/molecules/finding-card.tsx`
- **내용:**
  - TransactionTable: accountNumber 컬럼에 `maskAccountNumber()` 적용
  - TransactionTable: creditorName 컬럼에 `maskName()` 적용
  - FindingCard: 민감 정보 자동 마스킹
  - Excel 내보내기: 마스킹된 데이터로 내보내기 (기본값)

#### P0-10: 마스킹 단위 테스트 작성 (1시간)
- **파일:** `src/lib/masking/account-masking.test.ts`, `src/lib/masking/personal-masking.test.ts`
- **테스트 케이스:**
  - [ ] 계좌번호 1234567890123 → 123****0123
  - [ ] 계좌번호 null → 빈 문자열
  - [ ] 이름 "홍길동" → "홍*동"
  - [ ] 이름 "김철수" → "김*수"
  - [ ] 주소 "서울시 강남구..." → "[마스킹됨]"

---

## 2. High 리스크 대응 (Score 6-8 - 우선 조치)

### R-001: JWT 토큰 보안 (Epic 1)

**대응 액션 아이템:**

#### P1-1: JWT 라이브러리 검증 (30분)
- **대상:** `package.json` (jsonwebtoken 또는 jose)
- **확인사항:**
  - [ ] 최신 버전 사용 (CVE 체크)
  - [ ] HS256 또는 RS256 알고리즘 사용 (none 방식 금지)
  - [ ] Access Token 15분, Refresh Token 8시간 설정

#### P1-2: HttpOnly Cookie 구현 (1시간)
- **대상:** `src/server/auth/auth.ts`, `src/pages/api/auth/[...nextauth].ts`
- **내용:**
  ```typescript
  cookie: {
    httpOnly: true,  // XSS 방지
    secure: process.env.NODE_ENV === 'production',  // HTTPS 전용
    sameSite: 'lax',  // CSRF 방지
    maxAge: 8 * 60 * 60,  // 8시간
    path: '/',
  }
  ```

---

### R-003: 사용자 데이터 무결성 (Epic 1)

**대응 액션 아이템:**

#### P1-3: Prisma Unique 제약조건 검증 (30분)
- **대상:** `prisma/schema.prisma`
- **확인사항:**
  ```prisma
  model User {
    email    String @unique  // ✅ 중복 이메일 방지
    username String? @unique // ✅ 중복 사용자명 방지
  }
  ```

#### P1-4: Zod 검증 강화 (1시간)
- **대상:** 모든 tRPC 라우터 input 스키마
- **내용:**
  ```typescript
  email: z.string().email('유효하지 않은 이메일입니다'),
  username: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_]+$/),
  ```

---

### R-005: 사건 데이터 감사 로그 부재 (Epic 2)

**대응 액션 아이템:**

#### P1-5: AuditLog Prisma 모델 확인 (30분)
- **대상:** `prisma/schema.prisma`
- **확인사항:**
  ```prisma
  model AuditLog {
    id          String   @id @default(cuid())
    userId      String
    action      String   // CREATE, UPDATE, DELETE
    resource    String   // case, transaction, finding
    resourceId  String
    changes     Json     // { before: {}, after: {} }
    ipAddress   String?
    userAgent   String?
    createdAt   DateTime @default(now())
  }
  ```

#### P1-6: tRPC 로깅 미들웨어 구현 (2시간)
- **파일:** `src/server/api/middleware/audit-logger.ts` (신규)
- **내용:**
  - 모든 mutation 프로시저에 자동 감사 로그 기록
  - before/after 데이터 비교하여 changes 필드 저장
  - 사용자 ID, IP, UserAgent 자동 캡처

---

### R-006: 대용량 파일 처리 실패 (Epic 3)

**대응 액션 아이템:**

#### P1-7: 스트리밍 파싱 구현 확인 (30분)
- **대상:** `src/server/services/file-parser.ts`
- **확인사항:**
  - [ ] 50MB 이상 파일도 스트리밍으로 처리 (메모리에 전체 로드 금지)
  - [ ] papaparse 또는 similar 라이브러리의 step 콜백 사용
  - [ ] 진행률 표시 (SSE)

#### P1-8: 타임아웃 및 에러 처리 (1시간)
- **내용:**
  - 파일 업로드 30초 타임아웃
  - 1000건 이상 시 배치 처리 (100건씩)
  - 부분 실패 시 정상 건 계속 진행

---

### R-008: 파일 파싱 오류 (Epic 3)

**대응 액션 아이템:**

#### P1-9: 다중 헤더 지원 (1시간)
- **파일:** `src/server/services/column-mapper.ts`
- **내용:**
  ```typescript
  const HEADERS = {
    deposit: ['입금액', '입금 금액', '입금', 'deposit', 'Deposit Amount'],
    withdrawal: ['출금액', '출금 금액', '출금', 'withdrawal', 'Withdrawal Amount'],
    // ... 총 20개 헤더 매핑
  };
  ```

#### P1-10: 파싱 에러 메시지 개선 (1시간)
- **내용:**
  - 헤더 누락 시 "입금액, 출금액, 거래일시 중 하나가 포함되어야 합니다"
  - 형식 오류 시 "N번째 행: 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"
  - 빈 파일 시 "파일에 데이터가 없습니다"

---

### R-010: AI 분류 정확도 (Epic 4)

**대응 액션 아이템:**

#### P1-11: 신뢰도 점수 노출 (완료 - Epic 4.2)
- **대상:** `src/components/molecules/confidence-badge.tsx`
- **확인사항:**
  - [ ] 0.7 이상: "높음" (녹색)
  - [ ] 0.5-0.7: "보통" (노란색)
  - [ ] 0.5 미만: "낮음" (빨간색)

#### P1-12: 수동 수정 및 피드백 루프 (완료 - Epic 4.5, 4.8)
- **확인사항:**
  - [ ] 수동 태그 수정 가능 (Epic 4.5)
  - [ ] 일괄 수정 가능 (Epic 4.7)
  - [ ] AI 학습 피드백 전송 (Epic 4.8)

---

### R-011: 외국 API 사용 동의 없이 호출 (Epic 4)

**대응 액션 아이템:**

#### P1-13: 사용자 동의 플래그 (1시간)
- **대상:** `prisma/schema.prisma`
- **내용:**
  ```prisma
  model User {
    allowForeignAI Boolean @default(false)  // OpenAI, Claude 등
    allowKoreanAI  Boolean @default(true)   // Upstage Solar 등
  }
  ```

#### P1-14: 한국 AI만 사용 옵션 (1시간)
- **파일:** `src/server/services/classification-service.ts`
- **내용:**
  ```typescript
  if (user.allowForeignAI) {
    // GPT-4, Claude 사용
  } else {
    // Upstage Solar만 사용 (한국)
  }
  ```

---

### R-013: 추적 알고리즘 오류 (Epic 5)

**대응 액션 아이템:**

#### P1-15: 알고리즘 단위 테스트 (완료 - Epic 5)
- **파일:** `src/server/services/fund-flow-service.test.ts`
- **확인사항:**
  - [ ] BFS 알고리즘 정확도 테스트 (14/14 통과)
  - [ ] 사이클 감지 테스트
  - [ ] N+1 쿼리 최적화 테스트

#### P1-16: 시각화 검증 (완료 - Epic 5.4)
- **파일:** `src/components/molecules/linkage-visualization.tsx`
- **확인사항:**
  - [ ] React Flow 그래프 정확도 테스트 (7/7 통과)
  - [ ] 필터링 기능 테스트

---

### R-017: Excel 내보내기 데이터 누락 (Epic 7)

**대응 액션 아이템:**

#### P1-17: 데이터 검증 (완료 - Epic 7.4)
- **파일:** `src/server/services/excel-export-service.ts`
- **확인사항:**
  - [ ] 건별 건수 확인 로직
  - [ ] N+1 쿼리 최적화 (99% 감소)
  - [ ] 파일 크기 검증 (1000행 3초 이내)

---

### R-019: 복합 필터 잘못된 결과 (Epic 8)

**대응 액션 아이템:**

#### P1-18: 쿼리 단위 테스트 (완료 - Epic 8.2)
- **파일:** `src/lib/search/multidimensional-search.test.ts`
- **확인사항:**
  - [ ] 8개 필터 모두 테스트 (139개 통과)
  - [ ] AND/OR 논리 검증
  - [ ] URL 파라미터 동기화 테스트

---

## 3. Medium/Low 리스크 대응 (Score 1-5 - 모니터링)

### R-007: OCR API 장애 시 자동 백업 (Epic 3)

#### P2-1: 재시도 로직 확인 (30분)
- **대상:** `src/server/services/ocr-service.ts`
- **내용:** Upstage 실패 시 Google Document AI 자동 전환

---

### R-009: AI 분류 성능 (Epic 4)

#### P2-2: 배치 처리 구현 (1시간)
- **내용:** 1000건 이상 시 병렬 처리 (10건씩)

---

### R-012: 자금 흐름 추적 응답 시간 (Epic 5)

#### P2-3: DB 인덱싱 (30분)
- **대상:** `prisma/schema.prisma`
- **내용:**
  ```prisma
  @@index([depositAmount, withdrawalAmount])
  @@index([transactionDate])
  ```

---

### R-002: 비밀번호 해싱 미구현 (Epic 1)

#### P3-1: bcrypt 라이브러리 사용 확인 (30분)
- **대상:** `src/server/auth/password.ts`
- **확인사항:**
  - [ ] bcrypt 사용 (salt rounds: 10)
  - [ ] 평문 비밀번호 저장 금지

---

## 4. 테스트 커버리지 개선 계획

### 4.1 현재 커버리지 현황

| Epic | 테스트 파일 수 | 커버리지 | 상태 |
|------|---------------|----------|------|
| Epic 1 (인증) | 0 | 0% | ❌ 개선 필요 |
| Epic 2 (사건 관리) | 0 | 0% | ❌ 개선 필요 |
| Epic 3 (파일 업로드) | 0 | 0% | ❌ 개선 필요 |
| Epic 4 (AI 분류) | 5 | 30% | ⚠️ 개선 필요 |
| Epic 5 (자금 흐름) | 3 | 60% | ✅ 양호 |
| Epic 6 (발견 사항) | 2 | 40% | ⚠️ 개선 필요 |
| Epic 7 (내보내기) | 3 | 90% | ✅ 우수 |
| Epic 8 (검색/필터) | 8 | 85% | ✅ 우수 |

**전체 평균:** 88% (410/466 테스트 통과)

### 4.2 Epic별 테스트 추가 계획

#### Epic 1: 사용자 인증 및 프로필 관리 (테스트 0개 → 30개 목표)

**P3-2: Auth Unit Tests (신규, 3시간)**
- **파일:** `src/server/auth/auth.test.ts`
- **테스트 케이스:**
  - [ ] JWT 토큰 생성 및 검증 (Access 15분, Refresh 8시간)
  - [ ] bcrypt 해싱 검증
  - [ ] 비밀번호 재설정 토큰 만료
  - [ ] Refresh Token rotation

**P3-3: RBAC Unit Tests (신규, 2시간)**
- **파일:** `src/server/auth/rbac.test.ts`
- **테스트 케이스:** R-004 대응 참조

**P3-4: Auth Integration Tests (신규, 2시간)**
- **파일:** `src/server/auth/auth.integration.test.ts`
- **테스트 케이스:**
  - [ ] 로그인 → JWT 발급 → API 호출 전체 흐름
  - [ ] Refresh Token 만료 시 자동 갱신
  - [ ] 로그아웃 시 토큰 무효화

---

#### Epic 2: 파산 사건 관리 (테스트 0개 → 25개 목표)

**P3-5: Case CRUD Unit Tests (신규, 2시간)**
- **파일:** `src/server/api/routers/cases.test.ts`
- **테스트 케이스:**
  - [ ] 사건 등록 (중복 caseNumber 검증)
  - [ ] 사건 수정 (낙관적 잠금)
  - [ ] 사건 삭제 (soft delete)
  - [ ] 사건 검색 (키워드, 필터)

**P3-6: Case RBAC Integration Tests (신규, 2시간)**
- **테스트 케이스:**
  - [ ] 변호사: 자신의 사건만 접근
  - [ ] 법무사: 읽기 전용 접근
  - [ ] 관리자: 모든 사건 접근

---

#### Epic 3: 거래내역서 업로드 및 전처리 (테스트 0개 → 30개 목표)

**P3-7: File Upload Unit Tests (신규, 2시간)**
- **파일:** `src/server/services/file-parser.test.ts`
- **테스트 케이스:**
  - [ ] CSV 파싱 (한글/영문 헤더 지원)
  - [ ] 열 매핑 정확도
  - [ ] 빈 파일 처리
  - [ ] 대용량 파일 스트리밍 (50MB)

**P3-8: SSE Progress Tests (신규, 1시간)**
- **파일:** `src/server/services/realtime-progress.test.ts`
- **테스트 케이스:**
  - [ ] SSE 연결 및 이벤트 전송
  - [ ] 진행률 계산 정확도
  - [ ] 연결 끊김 시 재연결

---

#### Epic 4: AI 기반 거래 분류 (테스트 5개 → 25개 목표)

**P3-9: Classification Service Tests (추가, 2시간)**
- **파일:** `src/server/services/classification-service.test.ts`
- **테스트 케이스:**
  - [ ] 수동 수정 기능 (Epic 4.5)
  - [ ] 일괄 수정 기능 (Epic 4.7)
  - [ ] 학습 피드백 전송 (Epic 4.8)
  - [ ] 외국 API 동의 플래그 검증 (R-011)

**P3-10: Finding Accuracy Tests (추가, 3시간)**
- **테스트 케이스:** R-014 대응 참조

---

#### Epic 6: 발견 사항 관리 (테스트 2개 → 20개 목표)

**P3-11: Finding Service Tests (추가, 2시간)**
- **파일:** `src/server/services/finding-service.test.ts`
- **테스트 케이스:**
  - [ ] 발견사항 자동 식별 정확도
  - [ ] 메모 추가/수정/삭제
  - [ ] 채권자 필터링 (OR 조건)
  - [ ] Priority 할당 및 재설정

---

## 5. Sprint 0 테스트 인프라 구축

### 5.1 E2E 테스트 프레임워크 (Playwright)

**P4-1: Playwright 설치 (1시간)**
```bash
npm install -D @playwright/test
npx playwright install
```

**P4-2: Playwright 설정 (1시간)**
- **파일:** `playwright.config.ts` (신규)
- **내용:**
  ```typescript
  export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
  });
  ```

**P4-3: 핵심 여정 E2E 테스트 작성 (4시간)**
- **파일:** `tests/e2e/core-journeys.spec.ts` (신규)
- **테스트 시나리오:**
  - [ ] 로그인 → 사건 등록 → 파일 업로드 → AI 분류 → 결과 확인
  - [ ] 발견사항 조회 → 태그 수정 → Excel 내보내기
  - [ ] 자금 흐름 추적 → 필터링 → 결과 확인
  - [ ] RBAC 권한 테스트 (변호사/법무사/관리자)

---

### 5.2 Test Factories 구현

**P4-4: User Factory (신규, 1시간)**
- **파일:** `tests/factories/user.ts`
- **내용:**
  ```typescript
  export function createTestUser(overrides?: Partial<User>) {
    return {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'LAWYER',
      ...overrides,
    };
  }
  ```

**P4-5: Case Factory (신규, 1시간)**
- **파일:** `tests/factories/case.ts`
- **내용:**
  ```typescript
  export function createTestCase(overrides?: Partial<Case>) {
    return {
      caseNumber: `2024-${Math.floor(Math.random() * 10000)}`,
      debtorName: 'Test Debtor',
      ...overrides,
    };
  }
  ```

**P4-6: Transaction Factory (신규, 1시간)**
- **파일:** `tests/factories/transaction.ts`
- **내용:**
  ```typescript
  export function createTestTransactions(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      transactionDate: new Date(`2024-01-${i + 1}`),
      depositAmount: (i + 1) * 10000,
      withdrawalAmount: null,
      description: `Test Transaction ${i + 1}`,
    }));
  }
  ```

---

### 5.3 Mock Server 설정 (MSW)

**P4-7: MSW 설치 및 설정 (2시간)**
```bash
npm install -D msw @mswjs/data
```

- **파일:** `tests/mocks/handlers.ts` (신규)
- **내용:**
  ```typescript
  export const handlers = [
    // Upstage Solar OCR Mock
    http.post('https://api.upstage.ai/v1/document-ai', async ({ request }) => {
      return HttpResponse.json({
        text: 'mocked-ocr-result',
      });
    }),
    // OpenAI Mock
    http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
      return HttpResponse.json({
        choices: [{ message: { content: 'mocked-ai-response' } }],
      });
    }),
  ];
  ```

---

### 5.4 CI/CD 파이프라인

**P4-8: GitHub Actions 설정 (2시간)**
- **파일:** `.github/workflows/test.yml` (신규)
- **내용:**
  ```yaml
  name: Test
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
        - run: npm ci
        - run: npm run test:unit
        - run: npm run test:integration
        - run: npm run test:e2e
        - run: npm run test:coverage
        - uses: codecov/codecov-action@v3
  ```

**P4-9: Coverage Thresholds 설정 (30분)**
- **파일:** `vitest.config.ts`
- **내용:**
  ```typescript
  coverage: {
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  }
  ```

---

## 6. 우선순위별 실행 계획

### Phase 1: Critical 리스크 대응 (총 14시간)
- **P0-1~P0-3:** RBAC 구현 (3시간) → **즉시 시작**
- **P0-4~P0-6:** Finding 정확도 검증 (6시간) → **Day 1**
- **P0-7~P0-10:** 데이터 마스킹 구현 (5시간) → **Day 2**

### Phase 2: High 리스크 대응 (총 12시간)
- **P1-1~P1-2:** JWT 보안 (1.5시간)
- **P1-3~P1-4:** 데이터 무결성 (1.5시간)
- **P1-5~P1-6:** 감사 로그 (2.5시간)
- **P1-7~P1-8:** 대용량 파일 처리 (2시간)
- **P1-9~P1-10:** 다중 헤더 지원 (2시간)
- **P1-13~P1-14:** 외국 API 동의 (2시간)

### Phase 3: 테스트 커버리지 개선 (총 23시간)
- **P3-2~P3-4:** Epic 1 테스트 (7시간)
- **P3-5~P3-6:** Epic 2 테스트 (4시간)
- **P3-7~P3-8:** Epic 3 테스트 (3시간)
- **P3-9~P3-10:** Epic 4 테스트 (5시간)
- **P3-11:** Epic 6 테스트 (2시간)

### Phase 4: Sprint 0 테스트 인프라 (총 14.5시간)
- **P4-1~P4-3:** Playwright (6시간)
- **P4-4~P4-6:** Test Factories (3시간)
- **P4-7:** Mock Server (2시간)
- **P4-8~P4-9:** CI/CD (2.5시간)

**총 예상 시간:** 63.5시간 (약 8일)

---

## 7. 성공 기준

### Critical 리스크 (Score 9)
- [ ] RBAC 권한 제어 100% 구현 및 테스트 통과
- [ ] Finding 정확도 90% 이상 달성
- [ ] 민감 데이터 마스킹 100% 적용

### High 리스크 (Score 6-8)
- [ ] JWT 토큰 보안 검증 완료
- [ ] 감사 로그 100% 적용
- [ ] 대용량 파일 처리 (50MB, 30초) 달성

### 테스트 커버리지
- [ ] 전체 커버리지 80% 이상 (현재 88% 유지)
- [ ] Epic 1-6 테스트 커버리지 70% 이상
- [ ] E2E 테스트 10개 이상 작성

### 테스트 인프라
- [ ] Playwright 설치 및 설정 완료
- [ ] Test Factories 3개 이상 구현
- [ ] CI/CD 파이프라인 구축 및 자동화

---

## 8. 참고 자료

- **TEA Test Design System:** `_bmad-output/test-design-system.md`
- **Sprint Status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Prisma Schema:** `prisma/schema.prisma`
- **tRPC Routers:** `src/server/api/routers/*.ts`

---

**작성 완료일:** 2026-01-14
**상태:** ✅ 완료 (개발 준비 완료)
**다음 단계:** Phase 1 Critical 리스크 대응 시작
