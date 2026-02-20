# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL

## 구현 완료

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

## 백로그
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원
