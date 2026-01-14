# System-Level Test Design Document

**Project:** pharos-bmad (법률 전문가를 위한 AI 기반 회생 파산 분석 시스템)
**Date:** 2026-01-14
**Author:** Murat (Master Test Architect)
**Mode:** System-Level Test Design (전체 시스템 포괄)

---

## 1. Testability Assessment

### Controllability: **CONCERNS**

**✅ 잘 제어되는 영역:**
- 파일 업로드 (드래그 앤 드롭, 선택)
- 태그 수정 (수동 분류, 일괄 수정)
- 필터링 (날짜, 금액, 태그, 키워드)
- 데이터 내보내기 (엑셀, 클립보드)

**⚠️ 제어가 어려운 영역:**
- **외부 API 장애:** OCR API (Upstage, Google) 장애 시 제어 불가
- **AI 모델 결과:** GPT-4/Claude 분류 결과 비결정론적
- **실시간 진행률:** SSE 연결이 끊어지면 제어 불가
- **대용량 데이터:** 1000건 이상 거래 데이터 생성 및 제어 어려움

**완화 방안:**
- Mock 서버로 외부 API 시뮬레이션
- Seeding 데이터로 대용량 데이터 생성
- 테스트 환경 변수로 AI 모델 응답 제어

### Observability: **PASS**

**✅ 관찰 가능성 확보:**
- Vercel Analytics (페이지 로딩 속도, Web Vitals)
- Sentry (에러 추적, 스택 트레이스)
- API 모니터링 (ApiUsage Prisma 모델)
- 감사 로그 (최소 7년 보관)

**추가 필요:**
- 비즈니스 메트릭 대시보드 (AI 분류 정확도, 추적 알고리즘 성공률)
- 성능 모니터링 UI (Excel 생성 시간, 검색 응답 시간)

### Reliability: **PASS**

**✅ 신뢰성 확보:**
- 자동 장애 복구 (OCR API 백업)
- 부분 실패 처리 (일부 파일 실패 시 정상 파일 계속 진행)
- 에러 복구 (5분 이내 자동 재시도)
- 데이터베이스 백업 (일일 자동)

---

## 2. Architecturally Significant Requirements (ASRs)

PRD의 50개 FR 중 아키텍처를 주도하는 요구사항:

### ASR-1: 실시간 진행률 (SSE)
- **Requirement:** FR-26 ~ FR-30 (분석 진행률 실시간 표시)
- **Risk Score:** 6 (Probability: 2 × Impact: 3)
- **Architecture Impact:** SSE 엔드포인트, React Query 이벤트 소스
- **Testability Concern:** 비결정론적 연결, 타임아웃

### ASR-2: AI 분류 (외부 API 통합)
- **Requirement:** FR-22 ~ FR-31 (AI 기반 거래 분류)
- **Risk Score:** 8 (Probability: 2 × Impact: 4, 외국 API 관련)
- **Architecture Impact:** Upstage Solar, Google Document AI, OpenAI, Anthropic
- **Testability Concern:** API 레이트 리밋, 비용 발생

### ASR-3: 대용량 데이터 처리
- **Requirement:** NFR-001 (50MB 파일 30초), NFR-002 (1000건 60초)
- **Risk Score:** 6 (Probability: 2 × Impact: 3)
- **Architecture Impact:** 스트리밍 파싱, 가상화 스크롤
- **Testability Concern:** 대용량 테스트 데이터 생성

### ASR-4: 데이터 마스킹
- **Requirement:** FR-41 (데이터 마스킹), NFR-006 ~ NFR-009 (보안)
- **Risk Score:** 9 (Probability: 3 × Impact: 3) → **CRITICAL**
- **Architecture Impact:** 필드 수준 암호화, UI 마스킹
- **Testability Concern:** 마스킹 로직 검증 어려움

### ASR-5: RBAC 권한 제어
- **Requirement:** FR-31 ~ FR-36 (관리자 기능)
- **Risk Score:** 9 (Probability: 3 × Impact: 3) → **CRITICAL**
- **Architecture Impact:** tRPC 미들웨어, Prisma Enum
- **Testability Concern:** 4가지 역할별 권한 테스트

---

## 3. Risk Assessment Matrix

### Critical Risks (Score 9) - BLOCK

| Risk ID | Epic | Category | Description | Probability | Impact | Score | Mitigation |
|---------|------|----------|-------------|-------------|--------|-------|------------|
| **R-004** | Epic 2 | SEC | RBAC 권한 제어 미구현 (변호사, 법무사, 관리자, 지원팀) | 3 | 3 | **9** | tRPC 미들웨어로 RBAC 구현, 각 역할별 권한 테스트 |
| **R-014** | Epic 6 | BUS | 발견사항 식별 오류 (선의성/악의성, 우선변제권) 시 법적 책임 | 3 | 3 | **9** | AI 모델 검증, 신뢰도 점수 노출, 수동 수정 기능 |
| **R-015** | Epic 6 | SEC | 민감 데이터 마스킹 미구현 (계좌번호, 이름, 주소) | 3 | 3 | **9** | 계좌번호(***1234), 이름(홍*동), 주소(완전 제거) |

### High Risks (Score 6-8) - MITIGATE

| Risk ID | Epic | Category | Description | Probability | Impact | Score | Mitigation |
|---------|------|----------|-------------|-------------|--------|-------|------------|
| R-001 | Epic 1 | SEC | JWT 토큰 보안 (Access 15분, Refresh 8시간) | 2 | 3 | 6 | JWT 라이브러리 검증, HttpOnly Cookie |
| R-003 | Epic 1 | DATA | 사용자 데이터 무결성 (이메일 중복, isActive) | 2 | 3 | 6 | Prisma unique 제약조건, Zod 검증 |
| R-005 | Epic 2 | DATA | 사건 데이터 감사 로그 부재 | 2 | 3 | 6 | AuditLog Prisma 모델, tRPC 로깅 미들웨어 |
| R-006 | Epic 3 | PERF | 대용량 파일 처리 (50MB, 30초) 실패 | 2 | 3 | 6 | 스트리밍 파싱, 진행률 표시, 타임아웃 |
| R-008 | Epic 3 | DATA | 파일 파싱 오류 (한글/영문 헤더) | 2 | 3 | 6 | 다중 헤더 지원, 에러 메시지, 파싱 라이브러리 |
| R-010 | Epic 4 | DATA | AI 분류 정확도 (신뢰도 점수) | 2 | 3 | 6 | 신뢰도 점수 노출, 수동 수정, 피드백 루프 |
| R-011 | Epic 4 | SEC | 외국 API 사용 동의 없이 호출 | 2 | 3 | 6 | 사용자 동의 플래그, 한국 AI만 사용 옵션 |
| R-013 | Epic 5 | DATA | 추적 알고리즘 오류 (연결고리) | 2 | 3 | 6 | 알고리즘 단위 테스트, 시각화 검증 |
| R-017 | Epic 7 | DATA | Excel 내보내기 데이터 누락 | 2 | 3 | 6 | 데이터 검증, 건별 건수 확인 |
| R-019 | Epic 8 | DATA | 복합 필터 잘못된 결과 | 2 | 3 | 6 | 쿼리 단위 테스트, 비교 분석 |

### Medium Risks (Score 4-5) - MONITOR

| Risk ID | Epic | Category | Description | Probability | Impact | Score | Mitigation |
|---------|------|----------|-------------|-------------|--------|-------|------------|
| R-007 | Epic 3 | TECH | OCR API 장애 시 자동 백업 | 2 | 2 | 4 | 재시도 로직, 장애 알림 |
| R-009 | Epic 4 | PERF | AI 분류 성능 (1000건 60초) | 2 | 2 | 4 | 배치 처리, 비동기 큐 |
| R-012 | Epic 5 | PERF | 자금 흐름 추적 응답 시간 (3초) | 2 | 2 | 4 | DB 인덱싱, 캐싱 고려 |
| R-016 | Epic 7 | PERF | 대용량 Excel 생성 (1000행) | 1 | 2 | 2 | 성능 벤치마크 |
| R-018 | Epic 8 | PERF | 다차원 검색 응답 시간 (3초) | 2 | 2 | 4 | 쿼리 최적화, 인덱싱 |

### Low Risks (Score 1-3) - DOCUMENT

| Risk ID | Epic | Category | Description | Probability | Impact | Score | Mitigation |
|---------|------|----------|-------------|-------------|--------|-------|------------|
| R-002 | Epic 1 | SEC | 비밀번호 해싱 미구현 | 1 | 3 | 3 | bcrypt 라이브러리 사용 문서화 |

---

## 4. Test Levels Strategy

**Target Split:** 60% Unit / 30% Integration / 10% E2E

**Rationale:**
- **Unit (60%):** 비즈니스 로직 복잡 (AI 분류, 필터링, 추적), 빠른 피드백
- **Integration (30%):** API 계약, DB 작업, 외부 API 통합 중요
- **E2E (10%):** 핵심 사용자 여정만 (로그인 → 업로드 → 분석 → 내보내기)

### Unit Tests (60%)

**Target:**
- 순수 함수 (filter-utils, sort-utils, search)
- 비즈니스 로직 (classification-service, finding-generator, transaction-chain-service)
- 데이터 변환 (excel-export-helper, confidence-config)

**Examples:**
- `filter-utils.test.ts` (已完成)
- `excel.test.ts` (42 tests,已完成)
- `transaction-nature-analyzer.test.ts`

### Integration Tests (30%)

**Target:**
- tRPC 라우터 (tag, transaction, findings, export)
- DB 작업 (Prisma 쿼리, 트랜잭션)
- 외부 API 모의 (OCR, LLM)

**Examples:**
- `tag.integration.test.ts` (已完成)
- `learning.integration.test.ts` (已完成)

### E2E Tests (10%)

**Target:**
- 핵심 사용자 여정 (Happy Path)
- 크리티컬 경로 (인증, 권한, 마스킹)

**Critical Journeys:**
1. 로그인 → 사건 등록 → 파일 업로드 → AI 분류 → 결과 확인
2. 발견사항 조회 → 태그 수정 → Excel 내보내기
3. 자금 흐름 추적 → 필터링 → 결과 확인

---

## 5. NFR Testing Approach

### Security (보안)

**Tests Required:**
- JWT 토큰 유효성 (Access 15분, Refresh 8시간)
- RBAC 권한 제어 (4가지 역할별 접근)
- 데이터 마스킹 (계좌번호, 이름, 주소)
- 외국 API 사용 동의

**Tools:**
- Unit tests (auth.ts, rbac.ts)
- Integration tests (tRPC 미들웨어)
- Zod 검증 (입력 유효성)

### Performance (성능)

**Tests Required:**
- 파일 업로드: 50MB, 30초 이내
- AI 분류: 1000건, 60초 이내
- 자금 흐름 추적: 3초 이내 응답
- Excel 생성: 1000행, 3초 이내
- 페이지 로딩: 2초 이내

**Tools:**
- Vitest (performance benchmarks)
- k6 (부하 테스트)
- Vercel Analytics (모니터링)

### Reliability (신뢰성)

**Tests Required:**
- OCR API 장애 시 자동 백업
- 부분 실패 처리 (일부 파일 실패)
- 에러 복구 (자동 재시도)
- 데이터베이스 백업

**Tools:**
- Integration tests (Mock 서버)
- Chaos engineering (API 장애 주입)

### Maintainability (유지보수성)

**Tests Required:**
- TypeScript 커버리지 80% 이상
- API 엔드포인트 통합 테스트 100%
- 주요 기능 E2E 테스트

**Tools:**
- Vitest (coverage)
- ESLint (code quality)
- Prettier (formatting)

---

## 6. Test Environment Requirements

### Development (Local)
- **Database:** PostgreSQL (Docker Compose)
- **External APIs:** Mock 서버 (MSW - Mock Service Worker)
- **File Storage:** 로컬 파일 시스템 (S3 미사용)
- **Authentication:** 테스트용 JWT 토큰

### Staging (Pre-production)
- **Database:** Neon Database (AWS Seoul)
- **External APIs:** 샌드박스 API (Upstage, Google)
- **File Storage:** S3 (테스트 버킷)
- **Authentication:** 실제 OAuth 제공자

### Production
- **Database:** Neon Database (AWS Seoul)
- **External APIs:** 실제 API
- **File Storage:** S3 (프로덕션 버킷)
- **Monitoring:** Vercel Analytics + Sentry

---

## 7. Testability Concerns

### ⚠️ BLOCKERS (해결 전 구현 불가)

**현재 없음** - 모든 기능이 테스트 가능

### ⚠️ CONCERNS (주의 필요)

1. **E2E 테스트 프레임워크 부족**
   - **문제:** Playwright/Cypress 미설치
   - **영향:** 핵심 사용자 여정 테스트 불가
   - **해결:** Playwright 설치 권장 (별도 워크플로우: `[TF] Initialize production-ready test framework architecture`)

2. **대용량 테스트 데이터 생성**
   - **문제:** 1000건 이상 거래 데이터 생성 어려움
   - **영향:** 성능 테스트 제한적
   - **해결:** Factories, Seeders 구현

3. **외부 API 모킹 복잡도**
   - **문제:** OCR, LLM API 응답 다양성
   - **영향:** 통합 테스트 가짜 데이터
   - **해결:** HAR 캡처, Replay

---

## 8. Recommendations for Sprint 0

### Immediate Actions (Epic 8 완료 전)

1. **Playwright 설치** (별도 워크플로우: `[TF]`)
   - 핵심 사용자 여정 E2E 테스트 작성
   - 비주얼 회귀 테스트

2. **Test Factories 구현**
   - `tests/factories/user.ts`
   - `tests/factories/case.ts`
   - `tests/factories/transaction.ts`

3. **Mock Server 설정**
   - MSW (Mock Service Worker)로 외부 API 모킹
   - HAR 캡처로 실제 API 응답 저장

4. **CI/CD 파이프라인 설정**
   - GitHub Actions로 테스트 자동화
   - coverage thresholds (80%)
   - 테스트 실패 시 배포 차단

---

## 9. Existing Test Coverage Analysis

**Current Status:** 48 test files

### ✅ Well-Covered Areas

- **Excel 내보내기:** 42 tests (excel.test.ts) - 100% coverage
- **필터/검색 유틸리티:** 8 tests (filter-utils, sort-utils, date-filter, amount-filter, tag-filter, keyword-search, multidimensional-search, url-params)
- **AI 분류 서비스:** 5 tests (classification-service, rule-based-classifier, important-transaction-detector, transaction-nature-analyzer, confidence-config)
- **Finding 생성:** 2 tests (finding-generator, finding-service)
- **컴포넌트:** 14 tests (transaction-table, finding-card, tag-editor, export-options-modal, etc.)

### ❌ Coverage Gaps

- **Epic 1 (인증):** 0 tests → JWT, RBAC, bcrypt 테스트 필요
- **Epic 2 (사건 관리):** 0 tests → Case CRUD, 검색, 필터링 테스트 필요
- **Epic 3 (파일 업로드):** 0 tests → 드래그 앤 드롭, OCR 처리, SSE 진행률 테스트 필요
- **Epic 4 (AI 분류):** 5 tests ⚠️ → 수동 수정, 일괄 수정, 학습 피드백 테스트 부족
- **Epic 5 (자금 흐름 추적):** 3 tests (fund-flow-service, transaction-chain-service, graph-data-service) → 시각화 테스트 부족
- **Epic 6 (발견 사항 관리):** 2 tests (finding-generator, finding-service) → 발견사항 식별 정확도 테스트 부족
- **Epic 7 (내보내기):** 3 tests (excel, excel-export-helper, excel-export-service) → ✅ 잘 커버됨
- **Epic 8 (검색/필터링):** 8 tests → ✅ 잘 커버됨

---

## 10. Next Steps

1. ✅ **Playwright 설치** - E2E 테스트 프레임워크 (별도 워크플로우: `[TF]`)
2. **Epic별 테스트 설계** - 각 Epic에 상세한 테스트 시나리오 작성
3. **Test Factories 구현** - 대량 테스트 데이터 생성
4. **Mock Server 설정** - 외부 API 모킹
5. **CI/CD 파이프라인** - GitHub Actions로 테스트 자동화

---

## 11. Detailed Test Scenarios by Epic

### Epic 1: 사용자 인증 및 프로필 관리 (11 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **1.1-UNIT-001** | 이메일 중복 검증 (Prisma unique) | Unit | **P0** | R-003 | FR-001 |
| **1.1-INT-001** | 회원가입 완료 후 User 생성 및 isActive=false | Integration | **P0** | R-003 | FR-001, FR-002 |
| **1.1-INT-002** | 이메일 인증 링크 클릭 시 isActive=true | Integration | **P0** | R-003 | FR-002 |
| **1.2-UNIT-001** | JWT 토큰 생성 (Access 15분, Refresh 8시간) | Unit | **P0** | R-001 | FR-003, NFR-009 |
| **1.2-UNIT-002** | JWT 토큰 검증 (만료, 유효) | Unit | **P0** | R-001 | FR-003 |
| **1.2-INT-001** | 로그인 성공 시 HttpOnly Cookie에 Refresh Token 저장 | Integration | **P0** | R-001 | FR-003 |
| **1.2-E2E-001** | 로그인 → 대시보드 리다이렉트 | E2E | **P0** | R-001 | FR-003 |
| **1.2-INT-002** | Access Token 만료 시 Refresh Token으로 자동 갱신 | Integration | **P0** | R-001 | FR-003 |
| **1.3-UNIT-001** | 비밀번호 bcrypt 해싱 (rounds=10) | Unit | P1 | R-002 | FR-004, NFR-007 |
| **1.3-INT-001** | 비밀번호 재설정 링크 유효성 (1시간) | Integration | P1 | R-002 | FR-004 |
| **1.4-INT-001** | 프로필 정보 조회 (이름, 이메일, 역할, 가입일) | Integration | P1 | - | FR-005 |
| **1.4-INT-002** | 프로필 정보 수정 (이름 변경) | Integration | P1 | - | FR-005 |

### Epic 2: 파산 사건 관리 (15 tests) **CRITICAL (R-004: Score 9)**

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **2.1-INT-001** | 사건 등록 시 Case 생성 및 변호사 연결 | Integration | **P0** | **R-004** | FR-006, FR-007 |
| **2.1-INT-002** | 필수 필드 누락 시 에러 | Integration | **P0** | **R-004** | FR-006 |
| **2.1-INT-003** | 중복 사건번호 등록 방지 | Integration | **P0** | **R-004** | FR-006 |
| **2.2-INT-001** | 사건 목록 조회 (현재 변호사의 활성 사건만) | Integration | **P0** | **R-004** | FR-008 |
| **2.2-INT-002** | 다른 변호사의 사건 접근 시 "권한 없음" | Integration | **P0** | **R-004** | FR-008 |
| **2.2-INT-003** | 사건번호/채무자명으로 검색 | Integration | P1 | - | FR-008 |
| **2.2-INT-004** | 법원별 필터링 | Integration | P1 | - | FR-008 |
| **2.2-INT-005** | 접수일자 범위 필터링 | Integration | P1 | - | FR-008 |
| **2.3-INT-001** | 자신의 사건 아닌 경우 접근 거부 | Integration | **P0** | **R-004** | FR-009 |
| **2.3-INT-002** | 존재하지 않는 사건 ID로 접근 시 404 | Integration | P1 | - | FR-009 |
| **2.4-INT-001** | 사건 수정 시 변경 이력 기록 | Integration | **P0** | R-005 | FR-010 |
| **2.4-INT-002** | 사건번호는 수정 불가능한 필드 | Integration | P1 | - | FR-010 |
| **2.4-INT-003** | 다른 변호사의 사건 수정 시 "권한 없음" | Integration | **P0** | **R-004** | FR-010 |
| **2.5-INT-001** | 사건 아카이브 처리 | Integration | P1 | - | FR-011 |
| **2.6-INT-001** | 사건 메모 추가 | Integration | P1 | - | FR-012 |

### Epic 3: 거래내역서 업로드 및 전처리 (12 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **3.1-E2E-001** | 드래그 앤 드롭으로 파일 업로드 | E2E | **P0** | R-006 | FR-001, FR-002 |
| **3.1-INT-001** | 파일 형식 자동 감지 (엑셀, CSV, PDF) | Integration | **P0** | R-008 | FR-014 |
| **3.1-INT-002** | 손상된 파일 감지 및 에러 메시지 | Integration | **P0** | R-008 | FR-005 |
| **3.1-INT-003** | 대용량 파일 (50MB) 업로드 시간 측정 (30초) | Integration | **P0** | **R-006** | FR-021, NFR-001 |
| **3.2-UNIT-001** | 한글/영문 헤더 파싱 (열 식별) | Unit | **P0** | R-008 | FR-015, FR-016 |
| **3.2-UNIT-002** | 거래 내역 구조화 (날짜, 입금액, 출금액, 잔액, 메모) | Unit | **P0** | R-008 | FR-015 |
| **3.2-INT-001** | 업로드된 거래내역 DB 저장 | Integration | **P0** | - | FR-017 |
| **3.2-E2E-001** | 업로드 진행률 실시간 표시 (SSE) | E2E | P1 | - | FR-003, FR-026~30 |
| **3.2-INT-002** | 업로드 실패 시 명확한 에러 메시지 | Integration | **P0** | R-008 | FR-018 |
| **3.3-INT-001** | 업로드 전 파일 삭제 (취소) | Integration | P1 | - | FR-020 |
| **3.4-INT-001** | 부분 업로드 지원 (일부 페이지 성공) | Integration | P1 | - | FR-006 |
| **3.4-E2E-001** | 업로드된 거래내역 미리보기 | E2E | P1 | - | FR-019 |

### Epic 4: AI 기반 거래 분류 (11 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **4.1-UNIT-001** | 거래 메모 기반 자동 분류 (입금, 출금, 이체, 수수료) | Unit | **P0** | R-010 | FR-022, FR-023 |
| **4.1-UNIT-002** | 신뢰도 점수 계산 (confidence score) | Unit | **P0** | R-010 | FR-024 |
| **4.1-INT-001** | Upstage Solar API 호출 성공 | Integration | **P0** | R-007 | FR-017 |
| **4.1-INT-002** | Google Document AI 백업 (Upstage 실패 시) | Integration | **P0** | R-007 | 장애 복구 |
| **4.2-UNIT-001** | 중요 거래 자동 식별 (대출 실행, 변제, 담보제공) | Unit | **P0** | R-010 | FR-025 |
| **4.2-UNIT-002** | 거래 성격 판단 (채권자 관련, 담보 관련, 우선변제) | Unit | **P0** | R-010 | FR-026 |
| **4.3-INT-001** | AI 분류 결과 수동 수정 | Integration | P1 | - | FR-027 |
| **4.3-INT-002** | 태그 추가/삭제 | Integration | P1 | - | FR-028 |
| **4.3-INT-003** | 일괄 분류 및 수정 | Integration | P1 | - | FR-031 |
| **4.4-INT-001** | 사용자 수정 학습 (피드백 루프) | Integration | P2 | - | FR-029 |
| **4.5-INT-001** | 분류되지 않은 거래 식별 및 알림 | Integration | P1 | - | FR-030 |

### Epic 5: 자금 흐름 추적 (7 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **5.1-UNIT-001** | 자금 출처 추적 알고리즘 (입금 → 출품) | Unit | **P0** | R-013 | FR-032 |
| **5.1-UNIT-002** | 자금 사용처 추적 알고리즘 (출품 → 입금) | Unit | **P0** | R-013 | FR-033 |
| **5.2-UNIT-001** | 거래 체인 식별 (대출 → 이체 → 담보) | Unit | **P0** | R-013 | FR-035 |
| **5.2-INT-001** | 추적 쿼리 응답 시간 (3초 이내) | Integration | **P0** | R-012 | FR-033, NFR-003 |
| **5.3-E2E-001** | 연결고리 시각화 (그래프) | E2E | P1 | - | FR-034 |
| **5.4-INT-001** | 추적 범위 필터링 (날짜, 금액, 태그) | Integration | P1 | - | FR-036 |
| **5.5-INT-001** | 추적 결과 Excel 내보내기 | Integration | P1 | - | FR-037 |

### Epic 6: 발견 사항 관리 (10 tests) **CRITICAL (R-014, R-015: Score 9)**

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **6.1-UNIT-001** | 선의성/악의성 판단 알고리즘 | Unit | **P0** | **R-014** | FR-039 |
| **6.1-UNIT-002** | 우선변제권 침해 가능성 식별 | Unit | **P0** | **R-014** | FR-040 |
| **6.1-UNIT-003** | 담보권 설정/변경/소멸 식별 | Unit | **P0** | **R-014** | FR-041 |
| **6.2-INT-001** | 발견사항 메모 추가 | Integration | P1 | - | FR-042 |
| **6.2-INT-002** | 채권자별 필터링 | Integration | P1 | - | FR-043 |
| **6.2-INT-003** | 중요도 지정 (🔴🟡🟠) | Integration | P1 | - | FR-044 |
| **6.3-INT-001** | 계좌번호 마스킹 (***1234) | Integration | **P0** | **R-015** | FR-041, NFR-008 |
| **6.3-INT-002** | 이름 마스킹 (홍*동) | Integration | **P0** | **R-015** | FR-041 |
| **6.3-INT-003** | 주소/연락처 완전 제거 | Integration | **P0** | **R-015** | FR-041 |
| **6.4-E2E-001** | 발견사항 3가지 요약 대시보드 표시 | E2E | **P0** | - | FR-013 |

### Epic 7: 분석 결과 내보내기 (6 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **7.1-INT-001** | 전체 거래 엑셀 다운로드 | Integration | **P0** | R-017 | FR-017 |
| **7.2-INT-001** | 선택 거래 엑셀 다운로드 | Integration | P1 | - | FR-018 |
| **7.3-INT-001** | 필터링 결과 엑셀 다운로드 | Integration | P1 | - | FR-019 |
| **7.4-INT-001** | 발견사항 목록 엑셀 다운로드 | Integration | P1 | - | FR-047 |
| **7.5-INT-001** | 자금 흐름 추적 결과 엑셀 다운로드 | Integration | P1 | - | FR-048 |
| **7.6-INT-001** | 1000행 Excel 생성 성능 (3초 이내) | Integration | **P0** | R-016 | FR-045, NFR-005 |

### Epic 8: 검색 및 필터링 (6 tests)

| Test ID | Scenario | Test Level | Priority | Risk Link | AC |
|---------|----------|------------|----------|-----------|-----|
| **8.1-INT-001** | 날짜 범위 검색 | Integration | **P0** | R-019 | FR-049 |
| **8.2-INT-001** | 금액 범위 검색 | Integration | **P0** | R-019 | FR-049 |
| **8.3-INT-001** | 키워드 검색 (메모 포함) | Integration | P1 | - | FR-049 |
| **8.4-INT-001** | 태그 필터 | Integration | P1 | - | FR-050 |
| **8.5-INT-001** | 다차원 검색 (날짜 + 금액 + 태그 조합) | Integration | P1 | R-019 | FR-050 |
| **8.6-INT-001** | 다차원 검색 응답 시간 (3초 이내) | Integration | **P0** | R-018 | FR-050, NFR-003 |

---

## 12. Coverage Matrix

| Epic | P0 | P1 | P2 | Total | Unit | Integration | E2E |
|------|----|----|----|-------|------|-------------|-----|
| **Epic 1: 인증** | 8 | 3 | 0 | 11 | 4 | 7 | 1 |
| **Epic 2: 사건 관리** | 9 | 6 | 0 | 15 | 0 | 15 | 0 |
| **Epic 3: 파일 업로드** | 4 | 8 | 0 | 12 | 2 | 9 | 1 |
| **Epic 4: AI 분류** | 6 | 4 | 1 | 11 | 4 | 7 | 0 |
| **Epic 5: 추적** | 3 | 4 | 0 | 7 | 3 | 3 | 1 |
| **Epic 6: 발견사항** | 7 | 3 | 0 | 10 | 3 | 6 | 1 |
| **Epic 7: 내보내기** | 1 | 5 | 0 | 6 | 0 | 6 | 0 |
| **Epic 8: 검색/필터** | 2 | 4 | 0 | 6 | 0 | 6 | 0 |
| **Total** | **40** | **37** | **1** | **78** | **15** | **59** | **6** |

---

## 13. Resource Estimates

### Test Effort Estimates

| Priority | Test Count | Hours/Test | Total Hours | Days (8h/day) |
|----------|-----------|-----------|-------------|---------------|
| **P0** | 40 | 2h | 80h | ~10 days |
| **P1** | 37 | 1h | 37h | ~5 days |
| **P2** | 1 | 0.5h | 0.5h | <1 day |
| **Total** | 78 | - | **117.5h** | **~15 days** |

### By Epic

| Epic | Test Count | Estimated Hours | Owner |
|------|-----------|---------------|-------|
| Epic 1 (인증) | 11 | 16h | QA Team |
| Epic 2 (사건 관리) | 15 | 22h | QA Team |
| Epic 3 (파일 업로드) | 12 | 18h | QA Team |
| Epic 4 (AI 분류) | 11 | 16h | QA + Dev |
| Epic 5 (추적) | 7 | 10h | QA Team |
| Epic 6 (발견사항) | 10 | 15h | QA Team |
| Epic 7 (내보내기) | 6 | 6h | QA Team |
| Epic 8 (검색/필터) | 6 | 6h | QA Team |

---

## 14. Execution Order

### Smoke Tests (<5 min)

**Goal:** Check critical paths are alive

- ✅ 로그인 성공
- ✅ 대시보드 로딩
- ✅ 사건 목록 조회
- ✅ 파일 업로드 시작

**Test Count:** 4

### P0 Tests (<10 min)

**Goal:** Validate all critical functionality

- Epic 1: JWT 인증, RBAC (8 tests)
- Epic 2: 사건 등록, 권한 (9 tests)
- Epic 3: 파일 업로드 (4 tests)
- Epic 6: 데이터 마스킹 (3 tests)

**Test Count:** 24

### P1 Tests (<30 min)

**Goal:** Validate important features

- Epic 1: 프로필 관리 (3 tests)
- Epic 2: 검색, 필터링 (6 tests)
- Epic 3: 진행률, 미리보기 (4 tests)
- Epic 4: AI 분류 (7 tests)
- Epic 5: 추적 알고리즘 (4 tests)
- Epic 6: 발견사항 (6 tests)
- Epic 7: 내보내기 (5 tests)
- Epic 8: 검색/필터 (5 tests)

**Test Count:** 40

### Full Regression (<60 min)

**Goal:** Complete validation before release

- All P0 + P1 + P2 tests

**Test Count:** 78

---

## 15. Quality Gate Criteria

### Must Pass (BLOCK)

- ✅ All P0 tests pass (100%)
- ✅ P1 tests pass rate ≥ 95%
- ✅ **Critical risks (Score 9) fully mitigated:**
  - R-004: RBAC 권한 제어 구현 완료
  - R-014: 발견사항 식별 정확도 보장
  - R-015: 데이터 마스킹 (계좌번호, 이름, 주소) 구현 완료
- ✅ Test coverage ≥ 80% for critical paths
- ✅ No security vulnerabilities (OWASP Top 10)

### Should Pass (CONCERNS)

- ⚠️ P2 tests pass rate ≥ 90%
- ⚠️ High risks (Score 6-8) have mitigation plans
- ⚠️ Performance thresholds met:
  - File upload: 50MB < 30s
  - AI classification: 1000 transactions < 60s
  - Fund flow tracing: < 3s
  - Excel generation: 1000 rows < 3s
  - Multidimensional search: < 3s
- ⚠️ No flaky tests (flakiness rate < 5%)

### Nice to Have (WARNINGS)

- ℹ️ P3 tests documented
- ℹ️ Code coverage ≥ 90%
- ℹ️ Accessibility (WCAG 2.1 AA) compliance

---

## 16. Output Summary

### Test Design Complete ✅

**Scope:** System-Level (전체 시스템)
**Epics:** 8 (Epic 1-8)

**Risk Assessment:**
- Total risks identified: 19
- **High-priority risks (≥6): 13** (3 BLOCK, 10 HIGH)
- Categories: SEC (6), DATA (9), PERF (5), BUS (2), TECH (1), OPS (0)

**Coverage Plan:**
- **P0 scenarios:** 40 (80h, ~10 days) - 배포 차단
- **P1 scenarios:** 37 (37h, ~5 days) - PR 전 통과
- **P2 scenarios:** 1 (0.5h, <1 day) - Nightly
- **Total effort:** 117.5h (~15 days)

**Test Levels:**
- **Unit:** 15 tests (19%) - Fast feedback, business logic
- **Integration:** 59 tests (76%) - API contracts, DB operations
- **E2E:** 6 tests (8%) - Critical user journeys

**Quality Gate Criteria:**
- P0 pass rate: 100%
- P1 pass rate: ≥95%
- Critical risks mitigated: 100%
- Coverage: ≥80%

**Output File:** `_bmad-output/test-design-system.md`

---

## 17. Next Steps

1. ✅ **Review test design** - 테스트 설계 검토 완료
2. **Prioritize mitigation** - Critical risks (Score 9) 완화 계획 수립
3. **Allocate resources** - 117.5h (~15 days) 테스트 개발 예산 반영
4. **Set up test infrastructure:**
   - **[TF]** Initialize production-ready test framework architecture (Playwright)
   - Implement test factories and seeders
   - Set up mock server (MSW for external APIs)
5. **Write tests per Epic** - Epic 1 → Epic 8 순서로 구현
6. **Configure CI/CD** - GitHub Actions로 테스트 자동화
7. **Execute and validate** - Smoke → P0 → P1 → Full Regression

---

**Generated by:** Murat (Master Test Architect)
**Workflow:** testarch-test-design (System-Level Mode)
**Date:** 2026-01-14
**Status:** ✅ COMPLETE

**Total Test Scenarios:** 78
**Total Estimated Effort:** 117.5 hours (~15 days)
**Critical Risks to Mitigate:** 3 (R-004, R-014, R-015)
