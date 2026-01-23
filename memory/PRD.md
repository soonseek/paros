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

## 백로그

### P0 (완료)
- [x] LLM 기반 컬럼 분석 에이전트 구현
- [x] Python FastAPI 서비스 구현
- [x] TypeScript 클라이언트 구현
- [x] 3종 PDF 테스트 통과

### P1 (향후)
- [ ] 프론트엔드 UI에 LLM 분석 토글 추가
- [ ] 분석 결과 캐싱 구현
- [ ] 사용자 피드백 학습 루프

### P2 (미래)
- [ ] 배치 처리 지원
- [ ] 모델 자동 선택 (복잡도 기반)
- [ ] 다국어 지원
