# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL
- 역할 기반 접근 제어: LAWYER, ADMIN, SUPER

## 구현 완료

### 2026-02-23: 거래 정렬 및 파싱 버그 수정
- [x] 같은 날짜 내 거래 순서 뒤섞임 버그 수정
- [x] `transactionDate` 시간 정보 보존 (스키마에서 `@db.Date` 제거)
- [x] 정렬 순서 최신순(DESC)으로 변경
- [x] 금액 부호 기반 입금/출금 자동 판단 (양수=입금, 음수=출금)
- [x] 잔액 검증 로직 추가 (입금/출금 반전 자동 수정)
- [x] unique constraint에 `rowNumber` 추가
- [x] 기존 데이터 마이그레이션 스크립트 생성 (`scripts/migrate-row-numbers.ts`)

### 2026-02-23: SUPER 역할 템플릿 권한 확장
- [x] `adminProcedure`에서 SUPER 역할 허용 (src/server/api/trpc.ts)
- [x] 템플릿 관리 페이지에서 SUPER 역할 접근 허용 (src/pages/admin/templates.tsx)
- [x] SUPER 사용자가 템플릿 CRUD(생성/조회/수정/삭제) 기능 사용 가능

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

## 사용자 역할
- **LAWYER**: 자신의 사건만 조회/관리
- **ADMIN**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리
- **SUPER**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리 (ADMIN과 동일 권한)

## 테스트 계정
- admin@test.com / admin123 (ADMIN)
- super@test.com / admin123 (SUPER)

## 백로그
- P0: 비고 컬럼 미리보기 버그 (S3 설정 후 재현 테스트)
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원

## 기존 데이터 마이그레이션
기존에 저장된 거래의 `rowNumber`가 `null`인 경우 다음 스크립트를 실행하여 복원:
```bash
npx tsx scripts/migrate-row-numbers.ts
```

**주의**: 기존에 업로드된 파일의 거래 순서가 잘못된 경우, 해당 문서를 삭제하고 다시 업로드해야 합니다.
