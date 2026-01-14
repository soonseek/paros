# Story 5.6: 추적 결과 내보내기 (Tracking Result Export)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **사용자**,
I want **자금 흐름 추적 결과를 엑셀로 내보내서**,
So that **보고서나 증거 자료로 활용할 수 있다**.

## Acceptance Criteria

**AC1: 내보내기 옵션 모달 표시**
- **Given** 사용자가 자금 흐름 추적을 완료했을 때
- **When** "내보내기" 버튼을 클릭하면
- **Then** 내보내기 옵션 모달이 표시된다
- **And** 다음 옵션들이 제공된다:
  - 체인 전체 내보내기
  - 현재 필터링된 결과만 내보내기
  - 선택된 거래들만 내보내기

**AC2: 엑셀 파일 생성**
- **Given** 사용자가 내보내기 옵션을 선택했을 때
- **When** "내보내기" 버튼을 클릭하면
- **Then** 선택된 범위의 데이터가 엑셀 파일(.xlsx)로 생성된다
- **And** 파일은 UTF-8 인코딩으로 저장되고 한글이 올바르게 표시된다
- **And** 파일명은 "자금흐름추적_[사건번호]_[날짜].xlsx" 형식이다

**AC3: 엑셀 시트 구성**
- **Given** 엑셀 파일이 생성될 때
- **When** 파일 생성이 완료되면
- **Then** 엑셀에는 다음 시트가 포함된다:
  - **요약 시트**: 추적 개요, 총 거래 수, 총 금액
  - **거래 상세 시트**: 각 거래의 상세 정보 (날짜, 입금액, 출금액, 메모, 태그 등)
  - **체인 시트**: 식별된 거래 체인 정보 (체인 유형, 깊이, 신뢰도)
  - **시각화 시트**: 그래프 이미지 캡처 (선택사항)

**AC4: 다운로드 및 피드백**
- **Given** 엑셀 파일 생성이 완료되었을 때
- **When** 다운로드가 시작되면
- **Then** "엑셀 파일이 다운로드되었습니다" 메시지가 표시된다
- **And** 브라우저 다운로드 폴더에 파일이 저장된다

**AC5: 셀 서식 적용**
- **Given** 엑셀 파일이 생성될 때
- **When** 데이터를 쓸 때
- **Then** 날짜 열은 "yyyy-mm-dd" 형식으로 표시된다
- **And** 금액 열은 천 단위 구분 기호(,)와 "원" 단위가 표시된다
- **And** 헤더 행은 굵게 표시되고 배경색이 적용된다
- **And** 테두리가 적용된다

## Requirements
- FR-037: 자금 흐름 추적 결과 내보내기
- NFR-003: 3초 이내 응답

## Tasks / Subtasks

### Task 1: 엑셀 라이브러리 설치 및 설정 (AC2)
- [ ] Subtask 1.1: `exceljs` 라이브러리 설치
  - [ ] `npm install exceljs` 실행
  - [ ] TypeScript 타입 정의 설치: `@types/exceljs`

- [ ] Subtask 1.2: 엑셀 유틸리티 모듈 생성
  - [ ] `src/lib/export/excel.ts` 파일 생성
  - [ ] Workbook, Worksheet 생성 헬퍼 함수
  - [ ] 셀 서식(스타일) 적용 헬퍼 함수
  - [ ] 한글 폰트 설정 (Malgun Gothic 또는 Pretendard)

### Task 2: tRPC 라우터 구현 (AC1, AC2, AC4)
- [ ] Subtask 2.1: `fundFlow` 라우터 확장
  - [ ] `exportFundFlowResult` 프로시저 추가
  - [ ] 입력 검증 (Zod):
    ```typescript
    z.object({
      caseId: z.string().uuid(),
      chainIds: z.array(z.string().uuid()).optional(), // 선택된 체인
      exportOption: z.enum(["all", "filtered", "selected"]), // 내보내기 옵션
      includeVisualization: z.boolean().default(false), // 시각화 이미지 포함
    })
    ```
  - [ ] RBAC: caseAccessProcedure로 접근 제어

- [ ] Subtask 2.2: 엑셀 생성 로직
  - [ ] **요약 시트 생성**
    - [ ] 사건 기본 정보 (사건번호, 채무자명, 법원)
    - [ ] 추적 개요 (총 체인 수, 총 거래 수, 총 금액)
    - [ ] 체인 유형별 통계 (UPSTREAM/DOWNSTREAM 체인 수)

  - [ ] **거래 상세 시트 생성**
    - [ ] 체인 ID, 거래 ID, 날짜, 입금액, 출금액, 메모
    - [ ] 태그, 거래 성격, 신뢰도 점수
    - [ ] 셀 서식 적용 (헤더: 굵게 + 배경색, 숫자: 통화 형식)

  - [ ] **체인 시트 생성**
    - [ ] 체인 ID, 체인 유형, 깊이, 시작 거래, 종료 거래
    - [ ] 신뢰도 점수, 관련 거래 ID 목록

  - [ ] **시각화 시트 생성 (선택사항)**
    - [ ] `includeVisualization: true`인 경우에만 생성
    - [ ] React Flow 그래프를 이미지로 캡처하여 시트에 삽입
    - [ ] 또는 체인 다이어그램을 Excel 도형으로 직접 그리기

- [ ] Subtask 2.3: 파일 스트림으로 다운로드
  - [ ] `ctx.req.headers`에서 User-Agent 확인
  - [ ] Content-Disposition 헤더 설정: `attachment; filename="자금흐름추적_[사건번호]_[날짜].xlsx"`
  - [ ] MIME 타입: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Task 3: 프론트엔드 컴포넌트 구현 (AC1, AC4)
- [ ] Subtask 3.1: `ExportFundFlowButton` 컴포넌트 생성
  - [ ] shadcn/ui Button 기반
  - [ ] 클릭 시 내보내기 옵션 모달 오픈

- [ ] Subtask 3.2: `ExportFundFlowModal` 컴포넌트 생성
  - [ ] shadcn/ui Dialog 기반
  - [ ] 내보내기 옵션 라디오 버튼:
    - 체인 전체 내보내기
    - 현재 필터링된 결과만 내보내기
    - 선택된 거래들만 내보내기
  - [ ] 시각화 포함 체크박스 (선택사항)
  - [ ] "내보내기", "취소" 버튼

- [ ] Subtask 3.3: React Query 통합
  - [ ] `api.fundFlow.exportFundFlowResult.useMutation()` 사용
  - [ ] 내보내기 중 로딩 상태 표시 (Spinner)
  - [ ] 성공/실패 toast 메시지

### Task 4: 내보내기 옵션별 로직 구현 (AC1, AC2)
- [ ] Subtask 4.1: "체인 전체 내보내기" 옵션
  - [ ] caseId로 모든 TransactionChain 조회
  - [ ] 모든 체인의 거래들을 포함하여 엑셀 생성

- [ ] Subtask 4.2: "현재 필터링된 결과만 내보내기" 옵션
  - [ ] Story 5.5의 필터 상태를 참조
  - [ ] 현재 적용된 필터(FundFlowFilters)를 서버에 전달
  - [ ] 필터링된 체인들만 엑셀에 포함

- [ ] Subtask 4.3: "선택된 거래들만 내보내기" 옵션
  - [ ] 사용자가 선택한 거래 ID 목록을 전달
  - [ ] 해당 거래들이 포함된 체인만 엑셀에 포함

### Task 5: 셀 서식 및 한글 지원 (AC3, AC5)
- [ ] Subtask 5.1: 헤더 스타일
  - [ ] 폰트: 굵게 (bold), 크기 12
  - [ ] 배경색: 파란색 (blue-600)
  - [ ] 글자색: 흰색 (white)
  - [ ] 테두리: 얇은 실선

- [ ] Subtask 5.2: 데이터 셀 스타일
  - [ ] 폰트: 보통, 크기 10
  - [ ] 텍스트 정렬: 날짜/금액은 중앙, 메모는 좌측
  - [ ] 테두리: 얇은 실선
  - [ ] 줄 바꿈: 텍스트 줄 바꿈 허용

- [ ] Subtask 5.3: 숫자 서식
  - [ ] 금액 필드: 천 단위 구분 기호(,) 적용
  - [ ] 단위: "원" 접미사
  - [ ] 예: `1,000,000원`

- [ ] Subtask 5.4: 날짜 서식
  - [ ] 형식: "yyyy-mm-dd"
  - [ ] 예: "2026-01-12"

- [ ] Subtask 5.5: 한글 폰트 설정
  - [ ] exceljs에서 한글 폰트 명시: `{ name: 'Malgun Gothic' }`
  - [ ] 또는 시스템 기본 폰트 사용

### Task 6: 성능 최적화 (NFR-003)
- [ ] Subtask 6.1: 대용량 데이터 처리
  - [ ] 엑셀 파일 생성을 백그라운드에서 수행 (SSE 또는 Web Worker)
  - [ ] 진행률 표시: "엑셀 생성 중... (30%)"

- [ ] Subtask 6.2: 메모리 최적화
  - [ ] Stream API로 파일 생성 (전체 데이터를 메모리에 유지하지 않음)
  - [ ] 청크 단위로 데이터 처리

- [ ] Subtask 6.3: 타임아웃 처리
  - [ ] 엑셀 생성 최대 시간: 30초
  - [ ] 초과 시간 시 사용자에게 알림

### Task 7: 테스트 작성 (모든 AC)
- [ ] Subtask 7.1: 단위 테스트
  - [ ] 엑셀 생성 함수 테스트 (`excel.ts`)
  - [ ] 셀 서식 적용 확인
  - [ ] 한글 데이터 깨짐 없음 확인

- [ ] Subtask 7.2: tRPC 라우터 테스트
  - [ ] `exportFundFlowResult` 프로시저 테스트
  - [ ] RBAC 권한 검증 테스트
  - [ ] 파일 다운로드 응답 확인

- [ ] Subtask 7.3: 통합 테스트
  - [ ] 엑셀 파일 생성 → 다운로드 → 파일 열기 확인
  - [ ] 각 시트가 올바르게 생성되었는지 확인

## Dev Notes

### 관련 아키텍처 패턴 및 제약사항

**Frontend Stack:**
- **Next.js 14+**: App Router
- **React Query v5**: 서버 상태 관리 (useMutation)
- **shadcn/ui**: Dialog, Button, Label, Checkbox, Radio Group
- **exceljs**: 엑셀 파일 생성 (서버 사이드)
- **Tailwind CSS**: 스타일링

**Backend Stack:**
- **tRPC v11**: 타입 안전한 API
- **Node.js Streams**: 파일 다운로드
- **Prisma 7.2.0**: TransactionChain, Transaction 조회

### 소스 트리 구성 요소

**백엔드 파일:**
- `src/lib/export/excel.ts` - 엑셀 생성 유틸리티 (신규)
- `src/server/api/routers/fundFlow.ts` - tRPC 라우터 (확장, Story 5.1-5.5에서 이미 존재)

**프론트엔드 파일:**
- `src/components/molecules/export-fund-flow-button.tsx` - 내보내기 버튼 (신규)
- `src/components/molecules/export-fund-flow-modal.tsx` - 내보내기 옵션 모달 (신규)
- `src/components/molecules/fund-source-trace-result.tsx` - 출처 추적 결과 (확장, 내보내기 버튼 추가)
- `src/components/molecules/fund-destination-trace-result.tsx` - 사용처 추적 결과 (확장, 내보내기 버튼 추가)

### Story 5.1-5.5에서 학습한 패턴 적용

**구현 완료된 패턴:**
- ✅ RBAC: `caseAccessProcedure` 미들웨어로 접근 제어
- ✅ Zod 검증: 모든 tRPC 입력 검증
- ✅ React Query: 서버 상태 관리
- ✅ shadcn/ui: Dialog, Button 컴포넌트
- ✅ 감사 로그: `logFundFlowTrace()` 호출 (Story 5.1/5.2)
- ✅ TypeScript: 인터페이스 및 타입 정의

### Story 5.6 적용 시 주의사항

**엑셀 라이브러리:**
- `exceljs`는 서버 사이드에서 엑셀 파일 생성
- 클라이언트 사이드에서는 파일 다운로드만 처리 (React Query + Blob)
- 한글 지원을 위해 폰트 설정 필수

**파일 다운로드 패턴:**
- tRPC 프로시저는 엑셀 파일을 Buffer로 반환
- 클라이언트에서 `Blob` + `URL.createObjectURL()`로 다운로드
- 또는 서버에서 직접 파일 스트림으로 응답 (tRPC v11 지원)

**필터링 연동:**
- Story 5.5의 `FundFlowFilters` 상태를 참조
- "현재 필터링된 결과만 내보내기" 옵션에서 사용

**데이터 가져오기:**
- Story 5.3의 `TransactionChain` 테이블에서 체인 정보 조회
- Story 5.1/5.2의 추적 결과 데이터 재사용
- Story 5.4의 시각화 데이터 (선택사항)

### 데이터 모델 매핑

**TransactionChain → Excel Row:**
```typescript
// 거래 상세 시트
interface TransactionRow {
  체인ID: string;
  거래ID: string;
  날짜: string; // "yyyy-mm-dd"
  입금액: string; // "1,000,000원"
  출금액: string; // "500,000원"
  메모: string;
  태그: string; // 쉼표로 구분: "대출,담보"
  거래성격: string; // "채권자 관련"
  신뢰도: string; // "92%"
}

// 체인 시트
interface ChainRow {
  체인ID: string;
  체인유형: string; // "UPSTREAM", "DOWNSTREAM"
  깊이: number;
  시작거래날짜: string;
  종료거래날짜: string;
  신뢰도: string;
  관련거래수: number;
}
```

### 아키텍처 준수 사항

**Performance:**
- NFR-003: 3초 이내 응답 (내보내기 시작)
- 엑셀 생성은 백그라운드에서 수행 (진행률 표시)
- 대용량 데이터(1,000건 이상)는 스트리밍으로 처리

**Security:**
- RBAC: caseAccessProcedure로 접근 제어
- 파일 다운로드는 인증된 사용자만 가능
- 감사 로그: 내보내기 작업 기록 (사용자, 사건, 파일명)

**Data Integrity:**
- Zod 검증: 내보내기 옵션 입력값
- 타입 안전성: TypeScript
- 한글 깨짐 방지: UTF-8 인코딩, 폰트 설정

### 라이브러리 및 프레임워크 요구사항

**필수 패키지:**
```bash
# 엑셀 생성 (서버)
npm install exceljs
npm install -D @types/exceljs

# 이미 설치된 패키지 (T3 Stack)
# - next
# - trpc
# - zod
```

**exceljs 기본 사용법:**
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('요약');

// 헤더 스타일
const headerStyle = {
  font: { bold: true, size: 12, name: 'Malgun Gothic' },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0000FF' }
  },
  alignment: { horizontal: 'center' }
};

// 데이터 추가
worksheet.addRow(['항목', '값']);
worksheet.getCell('A1').style = headerStyle;

// 파일 저장
const buffer = await workbook.xlsx.writeBuffer();
```

### 테스트 요구사항

**단위 테스트 (Vitest):**
- 엑셀 생성 함수
- 셀 서식 적용
- 한글 데이터 처리

**tRPC 라우터 테스트:**
- exportFundFlowResult 프로시저
- RBAC 권한 검증
- 파일 응답 형식

**통합 테스트:**
- 엑셀 파일 생성 → 다운로드 → 파일 열기
- 각 시트 내용 검증

### References

**아키텍처:**
- [Architecture: Frontend Architecture](../planning-artifacts/architecture.md#frontend-architecture) - React Query, shadcn/ui
- [Architecture: Component Structure](../planning-artifacts/architecture.md#project-structure--boundaries) - molecules 폴더 구조

**요구사항:**
- [Epic 5: 자금 흐름 추적](../planning-artifacts/epics.md#epic-5-자금-흐름-추적) - Epic 5 전체 개요
- [Story 5.6: 추적 결과 내보내기](../planning-artifacts/epics.md#story-56-추적-결과-내보내기) - 상세 AC

**이전 스토리:**
- [Story 5.1: Fund Source Tracking](./5-1-fund-source-tracking.md) - 추적 데이터 구조
- [Story 5.2: Fund Destination Tracking](./5-2-fund-destination-tracking.md) - 추적 데이터 구조
- [Story 5.3: Transaction Chain Identification](./5-3-transaction-chain-identification.md) - TransactionChain 모델
- [Story 5.4: Linkage Visualization](./5-4-linkage-visualization.md) - 시각화 데이터
- [Story 5.5: Tracking Filtering](./5-5-tracking-filtering.md) - 필터링 상태 (FundFlowFilters)

**ExcelJS Resources:**
- [ExcelJS Documentation](https://github.com/exceljs/exceljs#readme)
- [ExcelJS TypeScript](https://github.com/exceljs/exceljs#typescript)
- [Cell Styles](https://github.com/exceljs/exceljs#styles)

---

## Dev Agent Context

### Story 5.1-5.5에서 학습한 패턴

**구현 완료된 패턴:**
- ✅ RBAC: `caseAccessProcedure` 미들웨어로 접근 제어
- ✅ 감사 로그: `logFundFlowTrace()` 호출
- ✅ Zod 검증: 모든 tRPC 입력 검증
- ✅ React Query: 서버 상태 관리
- ✅ shadcn/ui: Dialog, Button, Label 컴포넌트
- ✅ Zustand: 필터 상태 관리 (Story 5.5)
- ✅ Atomic Design: molecules 폴더 구조

### Story 5.6 적용 시 주의사항

**엑셀 라이브러리:**
- `exceljs` 설치 필요 (프로젝트에 아직 설치되지 않음)
- 한글 폰트 설정 필수 (Malgun Gothic 또는 시스템 폰트)
- UTF-8 인코딩으로 한글 깨짐 방지

**파일 다운로드:**
- tRPC v11에서 파일 반환을 위한 2가지 방법:
  1. Buffer로 반환 → 클라이언트에서 Blob 처리
  2. 서버에서 직접 스트림으로 응답 (추천)

**성능 고려사항:**
- 대용량 데이터(1,000+ 거래)는 스트리밍으로 처리
- 엑셀 생성은 백그라운드에서 수행 (진행률 표시 권장)
- 30초 타임아웃 설정

### 기술 요구사항

**exceljs 버전:**
- `exceljs` 최신 버전 (4.x)
- TypeScript 타입 정의: `@types/exceljs`

**셀 서식:**
- 헤더: 굵게 + 파란색 배경 + 흰색 글자
- 데이터: 보통 + 테두리
- 금액: 천 단위 구분 기호 + "원" 단위
- 날짜: "yyyy-mm-dd" 형식

**파일명:**
- 형식: `자금흐름추적_[사건번호]_[날짜].xlsx`
- 예: `자금흐름추적_2023하1234_20260112.xlsx`

### 아키텍처 준수 사항

**Frontend:**
- Atomic Design: molecules 폴더에 컴포넌트 배치
- React Query: useMutation으로 내보내기 호출
- shadcn/ui: Dialog, Button, Radio Group 컴포넌트

**Backend:**
- tRPC: 타입 안전한 API
- RBAC: caseAccessProcedure로 접근 제어
- Prisma: TransactionChain, Transaction 조회
- 감사 로그: 내보내기 작업 기록

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

- Story 5.1-5.5 패턴 분석 완료
- 엑셀 라이브러리(exceljs) 연구 완료
- 파일 다운로드 패턴 연구 완료

### Completion Notes List

### File List

---

**Story 5.6는 자금 흐름 추적 결과를 엑셀 형식으로 내보내는 기능을 구현합니다.** Story 5.1-5.5에서 구축된 추적 인프라를 활용하여, 사용자가 보고서나 증거 자료로 활용할 수 있는 포괄적인 내보내기 시스템을 제공합니다.
