# PRD: 거래내역서 컬럼 분석 에이전트 오케스트레이션

## 원본 문제 정의
거래내역서를 업로드하면 칼럼을 인지하는 방법이 하드코딩 스러운데, "거래일자, 구분, 금액, 잔액, 비고"로 딱 잘 정리할 수 있는 에이전트 오케스트레이션 설계 요청.

### 3종 거래내역서 형식
1. **Type 1**: 거래일자, 일련번호, 적요, 상태, 지급금액, 입금금액, 잔액, 취급점, 시각, Teller
2. **Type 2**: 거래일자, 내용, 찾으신금액, 맡기신금액, 비고, 잔액, 후송, 마감후, 키, 기번, 점, 점명
3. **Type 3**: No, 거래일시, 거래구분, 거래금액, 거래후잔액, 은행, 계좌정보/결제정보

### 특이점
- Type 1: 지급금액/입금금액 컬럼에 비고 혼합
- Type 2: 비고 컬럼 명확
- Type 3: 거래구분에 [+]/[-] 기호로 입출금 구분

## 핵심 요구사항
1. 다양한 형식의 거래내역서 자동 인식
2. 표준 형식으로 통합 파싱
3. 거래 테이블이 아닌 테이블 회피
4. 비고 컬럼 지능적 추론

## 아키텍처
```
PDF Upload → Table Extraction (Upstage OCR) → LLM Column Analyzer (Gemini 2.5 Flash) → Standard Parser → UI
```

## 구현 완료 (2026-01-22)

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `/app/python-services/column_analyzer_service.py` | FastAPI LLM 분석 서비스 |
| `/app/python-services/test_column_analyzer.py` | PDF 분석 테스트 스크립트 |
| `/app/src/lib/column-analyzer-client.ts` | TypeScript 클라이언트 |
| `/app/src/lib/file-analyzer.ts` | LLM 분석 옵션 통합 (수정) |
| `/app/src/server/api/routers/file.ts` | useLlmAnalysis 옵션 추가 (수정) |
| `/app/docs/column-analyzer-agent-design.md` | 설계 문서 |

### 테스트 결과
| 내역서 | 입출금 구분 | 비고 컬럼 | 신뢰도 |
|--------|------------|----------|--------|
| Type 1 | separate_columns | 금액 컬럼 혼합 | 0.90 |
| Type 2 | separate_columns | 비고 | 0.99 |
| Type 3 | type_column | 계좌정보/결제정보 | 0.98 |

### 환경 변수
```bash
COLUMN_ANALYZER_URL="http://localhost:8002"
EMERGENT_LLM_KEY="sk-emergent-21606D0AeC4F526Fc0"
```

## 구현 완료 (2026-01-23)

### 간소화된 거래내역 UI 통합
| 파일 | 설명 |
|------|------|
| `/app/src/pages/cases/[id].tsx` | SimplifiedTransactionTable 적용, UI 버튼 간소화 |
| `/app/src/components/simplified-transaction-table.tsx` | 간소화된 거래내역 테이블 |
| `/app/src/lib/transaction-normalizer.ts` | 거래내역 정규화 로직 (비고 감지 개선) |

### 변경사항
- 기존 복잡한 `TransactionTable` → 간소화된 `SimplifiedTransactionTable` 교체
- 거래내역 표준 형식: 거래일자, 구분(입금/출금), 금액(+/-), 잔액, 비고
- 입금(파란색)/출금(빨간색) 색상 구분 및 필터 기능 유지
- **비고 컬럼 감지 개선**: 금융 패턴 인식, 제외 키워드 필터, 텍스트 품질 점수 강화
- **UI 간소화**: 불필요한 버튼 제거 (수정, 발견사항 분석, 아카이브)
  - 유지: 목록, 업로드, 내보내기
  - 제거: 수정, 발견사항 분석, 아카이브/복원

### 거래내역서 파싱 개선 (2026-01-23)
| 파일 | 설명 |
|------|------|
| `/app/src/lib/column-mapping.ts` | AMOUNT, TRANSACTION_TYPE 컬럼 타입 추가 |
| `/app/src/lib/data-extractor.ts` | [+]/[-] 거래구분 처리 로직 추가 |
| `/app/src/lib/file-analyzer.ts` | hasAmountColumns 검증 추가 |

### 변경사항
- **거래금액 단일 컬럼 지원**: "거래금액" 컬럼 인식
- **거래 후 잔액 컬럼 지원**: "거래 후 잔액" 컬럼 인식
- **[+]/[-] 거래구분 처리**: 거래구분 컬럼에서 [+]/[-] 기호로 입출금 자동 판별
- **업로드 후 자동 새로고침**: 파일 업로드 완료 시 거래내역 자동 갱신
- **전체 내역 문서명 표시**: 파일명 10글자 초과시 ellipsis, 기본 정렬은 거래일자 오름차순

### LLM 대출금 추적 기능 (2026-01-23)
| 파일 | 설명 |
|------|------|
| `/app/src/components/ai-chat-assistant.tsx` | 대출금 추적 프리셋, 테이블 렌더링, 엑셀 다운로드 |
| `/app/src/server/api/routers/chat.ts` | 대출금 추적 분석 프롬프트 강화 |

### 기능
- **대출금 추적 프리셋 질문**: "대출금 사용처 추적", "자금 이동 경로 추적", "특정 금액 추적"
- **마크다운 테이블 파싱**: AI 응답에서 테이블 자동 감지 및 렌더링
- **엑셀 다운로드**: 테이블 결과를 말풍선 내 버튼으로 바로 다운로드
- **파일명 포함**: 각 거래내역의 출처 파일명 표시

## 백로그

### P0 (완료)
- [x] LLM 기반 컬럼 분석 에이전트 구현
- [x] Python FastAPI 서비스 구현
- [x] TypeScript 클라이언트 구현
- [x] 3종 PDF 테스트 통과
- [x] 간소화된 거래내역 UI 적용 (SimplifiedTransactionTable)
- [x] 거래내역 정규화 로직 통합
- [x] 비고(memo) 컬럼 파싱 개선
- [x] 불필요한 UI 버튼 제거
- [x] 거래금액/거래구분 [+]/[-] 파싱 지원
- [x] 업로드 후 자동 새로고침
- [x] 전체 내역 문서명 표시 (10글자 ellipsis)
- [x] LLM 대출금 추적 기능 (프리셋, 테이블, 엑셀 다운로드)
- [x] 다중 페이지 PDF 데이터 누락 버그 수정 (2026-01-23)
  - `extractFromTableElementsHTML` 함수 개선
  - 최소 컬럼 수 4→3으로 완화
  - 컬럼 차이 허용 범위 ±2→±3으로 확대
  - 날짜 패턴 감지로 데이터 행 vs 헤더 행 구분 개선
  - 스킵된 테이블 경고 로깅 추가
- [x] LLM 분석 결과 UI 표시 개선 (2026-01-23)
  - 업로드 모달 가로 폭 확대 (max-w-2xl → max-w-4xl)
  - 2열 그리드 레이아웃 (드롭존 + 분석 결과)
  - AI 신뢰도 퍼센트 표시
  - 비고 컬럼 인식 상태 표시 (성공/특수형식/미인식)
  - 인식된 컬럼 매핑 시각화
  - AI 분석 근거 상세 보기 토글
- [x] LLM 프롬프트 개선 - '계좌 정보/ 결제 정보' 등 비고로 인식

### P1 (향후)
- [ ] 프론트엔드 UI에 LLM 분석 토글 추가
- [ ] 분석 결과 캐싱 구현
- [ ] 사용자 피드백 학습 루프

### P2 (미래)
- [ ] 배치 처리 지원
- [ ] 모델 자동 선택 (복잡도 기반)
- [ ] 다국어 지원
