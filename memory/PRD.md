# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL
- 역할 기반 접근 제어: LAWYER, ADMIN, SUPER

## 구현 완료

### 2026-03-09: 거래내역서 템플릿 매칭 실패 처리 및 관리 기능 강화
- [x] 템플릿 매칭 실패 시 '맞음, 진행' 버튼 비활성화 (이미 숨김 처리됨)
- [x] 매칭 실패 시 역할 기반 안내 모달:
  - ADMIN/SUPER: "양식 매칭에 실패했습니다. 템플릿을 등록해주세요" + 닫기/등록 버튼
  - LAWYER: "양식 매칭에 실패했습니다. ADMIN 사용자에게 문의하세요" + 닫기 버튼만
  - 등록 버튼 클릭 시 `/admin/templates` 페이지로 이동
- [x] 거래내역서 템플릿 관리 - '전체 내보내기' (CSV 다운로드)
- [x] 거래내역서 템플릿 관리 - 'CSV 입력하기' (일괄 등록)
- [x] 거래내역서 템플릿 관리 - '초기화' (확인 모달 후 전체 삭제)
- [x] tRPC 엔드포인트: `template.exportAll`, `template.bulkImport`, `template.deleteAll`

### 2026-03-06: 보정권고 안내사항 데이터 영속성 검증 및 개선
- [x] 수동 추가/편집 내용 DB 저장 기능 검증 완료 (saveManualItems, saveEditedContents)
- [x] 공유 링크 페이지에서 수동 추가/편집 내용 올바르게 표시 확인
- [x] 공유 링크 생성 시 미저장 변경사항 자동 저장 로직 추가
- [x] 공유 링크 에러 페이지 UX 개선 (retry: false로 즉시 에러 표시)
- [x] 불필요한 PDF 관련 파일 정리 (public/fonts/ 삭제)
- [x] 환경 설정: PostgreSQL 설치/구성, Prisma 마이그레이션, Nginx 프록시 설정

### 2026-03-06: 보정권고 안내사항 만들기 핵심 기능 구현
- [x] Upstage Document Parse API 연동 (이미지 기반 PDF OCR)
- [x] "흠결사항" 섹션 추출 로직 (1~99번 항목만 파싱, 100 이상은 날짜 오인식으로 제외)
- [x] GPT-5.2 (OpenAI gpt-4o) 템플릿 매칭 + 신뢰도/근거 산출
- [x] 중복 템플릿 자동 제거 (같은 템플릿 ID는 첫 번째만 유지)
- [x] CorrectionGuideService 서비스 클래스 생성
- [x] tRPC 분석 라우터 엔드포인트 추가:
  - `analyzeDocument`: 문서 업로드 및 AI 분석
  - `updateSelectedItems`: 사용자 선택 항목 업데이트
  - `createShareLink`: 공유 링크 생성
  - `getAnalysisByShareSlug`: 공유 링크로 분석 결과 조회 (인증 불필요)
  - `saveManualItems`: 수동 추가 항목 저장
  - `saveEditedContents`: 편집 내용 저장
- [x] 프론트엔드 분석 컴포넌트 생성 (`CorrectionGuideAnalyzer`)
  - 드래그앤드롭 파일 업로드
  - 2열 레이아웃: 왼쪽(항목 리스트), 오른쪽(미리보기 + 편집)
  - 매칭 결과 기본 펼침 상태
  - 매칭 없음 항목 빨간색 강조 + "수동 추가" 버튼
  - 안내사항 내용 편집 기능 (편집 버튼 → textarea)
  - 흠결사항 기본 접힘 (클릭하여 펼침)
  - 링크 복사 기능 (안전한 클립보드 API + fallback)
  - **안내사항 수동 추가 기능** (모달로 제목/흠결사항/내용 입력)
  - 수동 추가 항목 편집/삭제 가능
  - 공유 링크 생성 전 미저장 데이터 자동 저장
- [x] 공개 페이지 생성 (`/guide/[slug]`) - 인쇄 최적화
- [x] Collapsible UI 컴포넌트 추가 (`@radix-ui/react-collapsible`)
- [x] 공통 타입 정의 파일 생성 (`/src/types/correction-guide.ts`)

### 2026-02-27: GNB 및 네비게이션 개선
- [x] GNB에 보정권고 안내사항 템플릿 관리 아이콘 버튼 추가 (ClipboardList)
- [x] ADMIN/SUPER 사용자에게만 보이도록 권한 처리
- [x] 대시보드(/dashboard) → 사건 목록(/cases)으로 메인 페이지 변경
- [x] 로그인 후 /cases로 리다이렉트
- [x] 모든 페이지의 backHref를 /cases로 통일
- [x] 사건 목록 페이지에서 뒤로가기 버튼 제거 (메인 페이지이므로)

### 2026-02-27: 안내사항 템플릿 이미지/파일 첨부 기능
- [x] tRPC 라우터에 파일 업로드/삭제 API 추가 (`correction-guide.ts`)
- [x] Base64 인코딩 파일 업로드 지원
- [x] 파일 크기 검증 (최대 10MB)
- [x] 이미지 타입 검증 (JPEG, PNG, GIF, WebP)
- [x] 파일 다운로드 API 엔드포인트 (`/api/correction-guide/download`)
- [x] 프론트엔드 파일 업로드 UI 구현 (드래그앤드롭 스타일)
- [x] 업로드된 이미지 미리보기 및 파일 목록 표시
- [x] 파일 삭제 기능 (X 버튼)
- [x] 템플릿 삭제 시 연결된 파일도 함께 삭제

### 2026-02-27: 사건상세 UI 개선 및 보정권고 안내사항 기능
- [x] 발견사항 카드 제거
- [x] 기본정보 → 모달 처리 (상세정보 버튼)
- [x] 사건메모 → 모달 처리 (사건메모 버튼)  
- [x] 페이지 타이틀 옆에 채무자명, 사건번호 배지 표시
- [x] 보정권고 안내사항 섹션 추가 (드래그앤드롭 업로드 영역)
- [x] ADMIN/SUPER 사용자에게만 '안내 사항 템플릿 관리' 링크 표시 (툴팁 포함)
- [x] 보정권고 안내사항 템플릿 관리 페이지 생성 (`/admin/correction-guide-templates`)
- [x] 템플릿 CRUD 기능 (제목, 내용, 이미지/파일 첨부, 특이사항, 우선순위)
- [x] DB 스키마: CorrectionGuideTemplate, CorrectionGuideAnalysis 모델 추가

### 2026-02-23: 거래 정렬 및 파싱 버그 수정
- [x] 같은 날짜 내 거래 순서 뒤섞임 버그 수정
- [x] `transactionDate` 시간 정보 보존
- [x] 정렬 순서 최신순(DESC)으로 변경
- [x] 금액 부호 기반 입금/출금 자동 판단
- [x] 잔액 검증 로직 추가

### 2026-02-23: SUPER 역할 템플릿 권한 확장
- [x] `adminProcedure`에서 SUPER 역할 허용
- [x] 템플릿 관리 페이지에서 SUPER 역할 접근 허용

### 2026-02-20: 도움말 페이지 + 브랜딩 변경
- [x] `/help` 페이지 생성
- [x] GNB 브랜딩 "paros BMAD" → "법무법인 파로스"

### 2026-02-20: 모바일 최적화 + 도움말 전역 적용
- [x] 공통 AppHeader 컴포넌트 생성
- [x] 모든 인증 페이지에 AppHeader 적용

## 사용자 역할
- **LAWYER**: 자신의 사건만 조회/관리
- **ADMIN**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리 + 안내사항 템플릿 관리
- **SUPER**: ADMIN과 동일 권한

## 테스트 계정
- admin@test.com / test1234 (ADMIN)

## GNB 아이콘 (ADMIN/SUPER)
1. 물음표 - 도움말 (/help)
2. 스프레드시트 - 거래내역서 템플릿 (/admin/templates)
3. 체크리스트 - 보정권고 안내사항 템플릿 (/admin/correction-guide-templates)
4. 톱니바퀴 - 설정 (/admin/settings)

## API 키 설정 (관리자 설정)
- `UPSTAGE_API_KEY`: Upstage Document Parse API 키 (OCR용)
- `OPENAI_API_KEY`: OpenAI API 키 (템플릿 매칭용)

## 백로그
- P1: ESLint 설정 수정 (TypeScript 파싱 문제)
- P1: 비고 컬럼 미리보기 버그 (S3 설정 후 재현 테스트)
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원

## 기존 데이터 마이그레이션
기존에 저장된 거래의 `rowNumber`가 `null`인 경우 다음 스크립트를 실행하여 복원:
```bash
npx tsx scripts/migrate-row-numbers.ts
```
