# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL
- 역할 기반 접근 제어: LAWYER, ADMIN, SUPER

## 구현 완료

### 2026-02-23: SUPER 역할 템플릿 권한 확장
- [x] `adminProcedure`에서 SUPER 역할 허용 (src/server/api/trpc.ts)
- [x] 템플릿 관리 페이지에서 SUPER 역할 접근 허용 (src/pages/admin/templates.tsx)
- [x] SUPER 사용자가 템플릿 CRUD(생성/조회/수정/삭제) 기능 사용 가능
- [x] 비고(memo) 컬럼 파싱 로직 디버그 로깅 추가
- [x] 테스트 87.5% 백엔드 / 100% 프론트엔드 통과 (iteration 5)

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

## 사용자 역할
- **LAWYER**: 자신의 사건만 조회/관리
- **ADMIN**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리
- **SUPER**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리 (ADMIN과 동일 권한)

## 테스트 계정
- admin@test.com / admin123 (ADMIN)
- super@test.com / admin123 (SUPER)

## 백로그
- P0: 비고 컬럼 미리보기 버그 - 실제 파일 업로드 시 재현 테스트 필요 (S3 설정 후)
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원
