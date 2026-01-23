# 거래내역서 컬럼 분석 에이전트 오케스트레이션 설계

## 개요

다양한 형식의 한국 은행 거래내역서를 통합된 표준 형식으로 파싱하는 LLM 기반 에이전트 시스템입니다.

### 표준 출력 형식
| 컬럼 | 설명 |
|------|------|
| 거래일자 | 거래 발생 날짜 |
| 구분 | 입금 또는 출금 |
| 금액 | +1,234,567 (입금) 또는 -1,234,567 (출금) |
| 잔액 | 거래 후 잔액 |
| 비고 | 입금자명, 계좌정보, 거래 설명 등 |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Transaction Analysis Pipeline                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐    ┌─────────────────┐    ┌──────────────────┐ │
│  │ PDF Upload │───▶│ Table Extractor │───▶│ LLM Column       │ │
│  │            │    │ (Upstage OCR)   │    │ Analyzer Agent   │ │
│  └────────────┘    └─────────────────┘    │ (Gemini 2.5)     │ │
│                                           └────────┬─────────┘ │
│                                                    │           │
│                                           ┌────────▼─────────┐ │
│  ┌────────────┐    ┌─────────────────┐    │ Standard Format  │ │
│  │ UI Display │◀───│ Data Transformer│◀───│ Parser           │ │
│  │            │    │                 │    └──────────────────┘ │
│  └────────────┘    └─────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 지원하는 내역서 유형

### Type 1: 은행 거래내역서 (지급/입금 분리형)
- **헤더**: 거래일자, 일련번호, 적요, 상태, 지급금액, 입금금액, 잔액, ...
- **입출금 구분**: `separate_columns` (지급금액/입금금액 별도)
- **특이점**: 비고가 금액 컬럼에 혼합 (입금 시 지급금액에 비고, 출금 시 입금금액에 비고)

### Type 2: 은행 거래내역서 (찾으신/맡기신 분리형)
- **헤더**: 거래일자, 내용, 찾으신금액, 맡기신금액, 비고, 잔액, ...
- **입출금 구분**: `separate_columns` (찾으신금액/맡기신금액 별도)
- **비고 컬럼**: 명확하게 "비고" 컬럼 존재

### Type 3: 카카오페이/핀테크 거래내역
- **헤더**: No, 거래일시, 거래구분, 거래금액, 거래후잔액, 은행, 계좌정보/결제정보
- **입출금 구분**: `sign_in_type` ([+]/[-] 기호 포함)
- **비고 컬럼**: "계좌정보/결제정보"

## 에이전트 오케스트레이션 단계

### Step 1: PDF 테이블 추출
```typescript
const tableData = await parsePdfWithUpstage(pdfBuffer);
// Returns: { headers: string[], rows: string[][], totalRows: number }
```

### Step 2: LLM 컬럼 분석
```typescript
const analysisResult = await analyzeColumnsFromTableData(tableData, emergentLlmKey);
// Returns: ColumnAnalysisResult (컬럼 매핑, 입출금 구분 방식, 비고 분석)
```

### Step 3: 표준 형식 변환
```typescript
const standardTx = {
  거래일자: transactionDate,
  구분: typeResult.type,  // "입금" | "출금"
  금액: typeResult.amount,  // 양수
  잔액: balance,
  비고: memo
};
```

### Step 4: UI 포맷팅
```typescript
const formatted = {
  거래일자: "2024-07-01",
  구분: "입금",
  구분색상: "text-blue-600",  // 입금: blue, 출금: red
  금액: "+1,234,567",
  잔액: "5,678,901",
  비고: "홍길동"
};
```

## LLM 분석 프롬프트 구조

```
당신은 한국 은행 거래내역서 분석 전문가입니다.

## 목표
거래내역 테이블을 표준 형식으로 매핑:
- 거래일자, 구분, 금액, 잔액, 비고

## 분석 시 주의사항
1. 거래내역 테이블 식별 (계좌정보표, 요약표 제외)
2. 입출금 구분 방식 판별 (4가지 유형)
3. 비고 컬럼 지능적 추론
4. 헤더 행 정확한 위치 파악

## 응답 형식 (JSON)
{ success, columnMapping, transactionTypeDetection, memoAnalysis, ... }
```

## API 엔드포인트

### Python Column Analyzer Service
```bash
# 헬스 체크
GET http://localhost:8002/health

# PDF 분석
POST http://localhost:8002/analyze/pdf
Content-Type: multipart/form-data
file: [PDF 파일]

# 테이블 데이터 분석
POST http://localhost:8002/analyze/table
Content-Type: application/json
{ "headers": [...], "rows": [[...], ...] }
```

### Next.js tRPC 확장
```typescript
// LLM 분석 옵션 추가
file.analyzeFile({
  documentId: "...",
  useLlmAnalysis: true  // LLM 기반 분석 활성화
})
```

## 환경 변수

```bash
# Column Analyzer Service
COLUMN_ANALYZER_URL="http://localhost:8002"
EMERGENT_LLM_KEY="sk-emergent-..."
```

## 테스트 결과

| 내역서 | 입출금 구분 | 비고 컬럼 | 신뢰도 | 결과 |
|--------|------------|----------|--------|------|
| Type 1 | separate_columns | 금액 컬럼 혼합 | 0.90 | ✓ |
| Type 2 | separate_columns | 비고 | 0.99 | ✓ |
| Type 3 | type_column | 계좌정보/결제정보 | 0.98 | ✓ |

## 파일 구조

```
/app/
├── python-services/
│   ├── column_analyzer_service.py   # FastAPI LLM 분석 서비스
│   ├── test_column_analyzer.py      # 테스트 스크립트
│   ├── requirements.txt
│   └── .env
├── src/
│   ├── lib/
│   │   ├── column-analyzer-client.ts  # TypeScript 클라이언트
│   │   ├── file-analyzer.ts           # 확장된 분석기 (LLM 통합)
│   │   └── column-mapping.ts          # 기존 규칙 기반 매핑
│   └── server/
│       └── ai/
│           ├── column-analyzer-agent.ts        # (TypeScript 버전)
│           └── transaction-analysis-orchestrator.ts
```

## 향후 개선 사항

1. **캐싱**: 동일 문서 구조 패턴 학습 및 캐싱
2. **피드백 루프**: 사용자 수정 사항을 학습하여 정확도 향상
3. **배치 처리**: 대량 문서 병렬 처리 지원
4. **모델 선택**: 문서 복잡도에 따른 동적 모델 선택 (Flash vs Pro)
