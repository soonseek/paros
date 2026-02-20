# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL

## 구현 완료

### 2026-02-20: SUPER 역할 구현 + 금액 필터 버그 수정 + 잔액 기반 OCR 검증 + 대출 추적 개선
- [x] Prisma schema에 SUPER 역할 추가 (Role enum)
- [x] RBAC 파일(`/app/src/server/lib/rbac.ts`)에 SUPER 권한 추가
- [x] `case.ts` 라우터: SUPER 사용자 모든 사건 조회 + 변호사 정보 포함
- [x] `templates.tsx`: SUPER 사용자 템플릿 관리 접근 허용
- [x] `cases/index.tsx`: SUPER 사용자에게 담당 변호사 이름 표시
- [x] **금액 필터 버그 수정 (핵심)**: 
  - **문제**: 출금 금액이 음수로 저장된 경우 필터링 결과에서 누락됨
  - **원인**: DB 쿼리가 `withdrawalAmount >= minAmount`만 체크하여 음수 출금 미포함
  - **해결**: `withdrawalAmount <= -minAmount` 조건 추가하여 음수 출금도 필터링
  - 통계 계산 시 `Math.abs()` 사용하여 절대값 비교
  - **디버깅 로그 추가**:
    - 서버: `[filterByAmount]` 접두어로 콘솔 로그 (caseId, minAmount, 조회 결과, 각 거래 상세)
    - 클라이언트: `[금액필터]` 접두어로 브라우저 콘솔 로그 (검색 조건, 응답 요약, 거래 목록)
- [x] **잔액 기반 OCR 파싱 오류 자동 감지/교정**:
  - **문제**: OCR에서 입금/출금이 반대로 파싱되는 경우 (예: 대출 입금이 출금으로 기록)
  - **해결 1**: 데이터 저장 시 자동 교정 (`/app/src/lib/data-extractor.ts`)
    - `validateAndCorrectTransactions()` 함수로 잔액 역산 검증
    - 불일치 시 입금↔출금 자동 교정
    - 서버 로그: `[Balance Validator]` 접두어
  - **해결 2**: 기존 데이터 검증 API (`transaction.validateBalanceAndCorrect`)
    - `dryRun=true`: 검증만 수행 (교정 안함)
    - `dryRun=false`: 실제 DB 교정 수행
  - **UI**: 사건 상세 페이지에 "입출금 오류 검증" 버튼 추가
    - `/app/src/components/balance-validation-modal.tsx`
    - 오분류 목록 표시 및 일괄 교정 기능
- [x] **대출금 추적 크로스 계좌 기능 복구 및 개선**:
  - **문제 1**: 이동 대상이 `-`로 표시되고 크로스 계좌 추적 안됨
  - **문제 2**: 대출금이 다 소진될 때까지 추적 안됨
  - **원인**: 음수 출금 금액 미처리 + 단일 계좌만 추적
  - **해결**: 
    - 음수 출금/입금 금액도 조회 (`OR: [gt: 0, lt: 0]`)
    - 금액 매칭 시 절대값 사용 (`Math.abs()`)
    - **BFS 다단계 추적** 구현: 이동 감지 시 해당 계좌도 추적 큐에 추가
    - 토스뱅크 → 우리은행 이동 시 우리은행 내역도 자동 추적
  - **디버깅 로그 추가**:
    - 서버: `[trackMultipleLoans]` 접두어
    - 클라이언트: `[대출추적]` 접두어 (브라우저 콘솔)

### 2026-02-20: 도움말 페이지 + 브랜딩 변경
- [x] `/help` 페이지 생성 (사용자 12개 + 관리자 4개 카테고리)
- [x] GNB 브랜딩 "paros BMAD" → "법무법인 파로스"

### 2026-02-20: 도움말 UX 개선
- [x] GNB 햄버거 버튼 → 사이드바 슬라이드
- [x] 관리자 템플릿 관리 버튼 추가

### 2026-02-20: 모바일 최적화 + 도움말 전역 적용
- [x] 공통 AppHeader 컴포넌트 생성 (도움말/설정/템플릿/유저메뉴 통합)
- [x] 모든 인증 페이지에 AppHeader 적용 (dashboard, cases, profile, admin)
- [x] 모든 비인증 페이지에 도움말 링크 (login, register, forgot-password)
- [x] 사건 목록: 모바일 카드뷰 + 데스크톱 테이블뷰
- [x] 반응형 grid/padding/font 전체 적용
- [x] S3 설정 암호화 버그 안전장치 추가
- [x] AWS Region 드롭다운 변경
- [x] 테스트 100% 통과 (iteration 2~4)

## SUPER 역할 설정 방법
PostgreSQL에서 직접 설정:
```sql
UPDATE users SET role = 'SUPER' WHERE email = '원하는이메일@example.com';
```

## 백로그
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원
