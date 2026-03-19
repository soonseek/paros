# PRD - 법무법인 파로스 파산 사건 분석 시스템

## 아키텍처
- Next.js 15.5.9 (Pages Router) + Tailwind CSS + shadcn/ui + tRPC + Prisma + PostgreSQL
- 역할 기반 접근 제어: LAWYER, ADMIN, SUPER

## 구현 완료

### 2026-03-10: 대출금 사용 추적 버그 수정 (P0)
- [x] **핵심 버그 수정: `trackLoanUsage` 이체 오계산** - 이체/이동 거래 시 `remainingLoan` 차감하지 않도록 수정. 이체 키워드: "이체", "송금", "이동", "振込"
- [x] **Dead code 제거: `trackMultipleLoans`** - 사용하지 않는 전체 출금 쿼리 (모든 계좌 대상) 제거
- [x] 이체 거래 시 전액 소진 판단(break) 조건에서 제외
- [x] **핵심 버그 수정: 이동 대상 계좌 출금 누락** - `remainingLoan` 전역 제한자 제거, 이동 예산(budget)으로만 제한
- [x] **loanBudget 도입**: 1단계에서 이동+직접출금 합산이 대출금을 초과하지 않도록 관리
- [x] **remainingLoan 순차 재계산**: 정렬 후 날짜순으로 대출실행→유지, 이동→유지, 출금→차감
- [x] **동일 날짜+금액 이동 다건 매칭**: depositMatchMap 배열 기반으로 변경 (usedDepositCounts 카운트 기반 추적)

### 2026-03-10: 거래내역서 매칭 로직 버그 수정 및 UX 개선
- [x] **핵심 버그 수정: 매칭 불일치** - 실제 업로드에서 `matchByIdentifiers`(Layer 1만) → `classifyTransaction`(3단계 파이프라인) 사용으로 변경
- [x] **핵심 버그 수정: AI 칼럼 매핑 비고 누락** - `findColumnIndex`에서 `index`와 `header` 교차 검증 추가
- [x] **핵심 버그 수정: AI 프롬프트 기본값 오류** - 입금/출금 서브컬럼 예시가 `"memo"`로 되어있어 AI가 항상 memo로 설정 → `"skip"`(무시)으로 수정
- [x] **핵심 버그 수정: 동일 일자 내 거래 순서 뒤바뀜** - 조회 시 `rowNumber: "desc"` → `"asc"` 수정 + 잔액 연속성 기반 순서 보정 로직 추가
- [x] 새 템플릿 생성 모달 AI 자동 분석 영역에 드래그앤드롭 지원 추가
- [x] 템플릿 매칭 실패 시 '맞음, 진행' 버튼 비활성화
- [x] 매칭 실패 판단 기준 (파싱 데이터 품질 검증)
- [x] 매칭 실패 시 역할 기반 안내 모달
- [x] 거래내역서 템플릿 관리 - '전체 내보내기', 'CSV 입력하기', '초기화'
- [x] 템플릿 작성자 이메일 저장

### 2026-03-06: 보정권고 안내사항 데이터 영속성 검증 및 개선
- [x] 수동 추가/편집 내용 DB 저장 기능 검증 완료
- [x] 공유 링크 페이지에서 수동 추가/편집 내용 올바르게 표시 확인
- [x] 공유 링크 생성 시 미저장 변경사항 자동 저장 로직 추가

### 2026-03-06: 보정권고 안내사항 만들기 핵심 기능 구현
- [x] Upstage Document Parse API 연동 (이미지 기반 PDF OCR)
- [x] GPT-5.2 (OpenAI gpt-4o) 템플릿 매칭 + 신뢰도/근거 산출
- [x] CorrectionGuideService 서비스 클래스 생성
- [x] tRPC 분석 라우터 엔드포인트 추가
- [x] 프론트엔드 분석 컴포넌트 생성

### 2026-02-27: GNB 및 네비게이션 개선
- [x] GNB에 보정권고 안내사항 템플릿 관리 아이콘 버튼 추가
- [x] 대시보드(/dashboard) → 사건 목록(/cases)으로 메인 페이지 변경

### 2026-02-27: 안내사항 템플릿 이미지/파일 첨부 기능
- [x] tRPC 라우터에 파일 업로드/삭제 API 추가
- [x] 이미지 타입 검증 (JPEG, PNG, GIF, WebP)

### 2026-02-27: 사건상세 UI 개선 및 보정권고 안내사항 기능
- [x] 보정권고 안내사항 섹션 추가
- [x] 보정권고 안내사항 템플릿 관리 페이지 생성

### 2026-02-23: 거래 정렬 및 파싱 버그 수정
- [x] 같은 날짜 내 거래 순서 뒤섞임 버그 수정
- [x] 금액 부호 기반 입금/출금 자동 판단

### 2026-03-10: ESLint 설정 정상화
- [x] ESLint 설정 수정: 1,914 문제 → 0 에러, 545 경고로 정리

### 2026-03-10: 거래 순서 수정 (프론트엔드 보강)
- [x] 백엔드 `transaction.search`에 잔액 기반 순서 보정 후처리 추가
- [x] `SimplifiedTransactionTable` + `TransactionTable` 정렬 시 같은 날짜 내 `rowNumber` 보조 정렬

### 2026-03-10: 보정권고 안내사항 504 타임아웃 수정 + AI 맞춤 안내문
- [x] `analyzeDocument` 비동기 처리
- [x] GPT 프롬프트 변경: 어투/간결함 유지, 최소한의 사실 대입만 수행
- [x] `originalContent` 필드 추가

### 2026-03-10: 보정권고 흠결사항 추출 GPT 기반 전환
- [x] regex 기반 → GPT 기반 추출로 전환

### 2026-03-10: 거래내역서 업로드 PDF 전용 + Upstage OCR 최적화
- [x] 거래내역서 업로드: PDF만 허용
- [x] Upstage API `ocr: "force"` → `"auto"`
- [x] `application/vnd.epapyrus.plugin.pdf` MIME 타입 지원 추가

### 2026-03-10: 보정권고 문서 다양한 포맷 대응 강화
- [x] GPT 항목 추출 프롬프트 대폭 개선
- [x] 텍스트 제한 6,000자 → 15,000자

### 2026-03-10: 거래내역서 D형 + C형 확장
- [x] D형 지원: 거래금액에 +/- 부호가 포함된 형식
- [x] C형 확장: 매도/매수/체결 등 비입출금 거래 자동 필터링

## 사용자 역할
- **LAWYER**: 자신의 사건만 조회/관리
- **ADMIN**: 모든 사건 조회 + 시스템 설정 + 템플릿 관리
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

## 사용자 검증 대기 항목
- 거래 순서 뒤바뀜 수정 - 배포 후 검증 필요
- 보정권고 안내사항 전체 워크플로우 - 배포 후 검증 필요

## 백로그
- P1: 비고 컬럼 미리보기 버그 (S3 설정 후 재현 테스트)
- P1: 도움말 검색 기능
- P2: 동영상 튜토리얼, 다국어 지원

## 기존 데이터 마이그레이션
기존에 저장된 거래의 `rowNumber`가 `null`인 경우 다음 스크립트를 실행하여 복원:
```bash
npx tsx scripts/migrate-row-numbers.ts
```
