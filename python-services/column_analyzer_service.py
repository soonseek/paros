"""
Column Analyzer Service - LLM 기반 거래내역서 컬럼 분석

FastAPI 서비스로 구현하여 Next.js에서 호출
"""

import os
import json
import tempfile
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Column Analyzer Service")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-21606D0AeC4F526Fc0")


class TableData(BaseModel):
    """추출된 테이블 데이터"""
    headers: list[str]
    rows: list[list[str]]


class ColumnMapping(BaseModel):
    """표준 컬럼 매핑"""
    거래일자: str
    구분: Optional[str] = None
    입금금액: Optional[str] = None
    출금금액: Optional[str] = None
    금액: Optional[str] = None
    잔액: Optional[str] = None
    비고: str


class TransactionTypeDetection(BaseModel):
    """입출금 구분 방식"""
    method: str  # separate_columns, type_column, sign_in_type, amount_sign
    details: Optional[str] = None


class MemoAnalysis(BaseModel):
    """비고 컬럼 분석"""
    columnName: str
    contentType: str
    confidence: float


class ColumnAnalysisResult(BaseModel):
    """컬럼 분석 결과"""
    success: bool
    tableType: Optional[str] = None
    columnMapping: ColumnMapping
    headerRowIndex: int
    dataStartRowIndex: int
    transactionTypeDetection: TransactionTypeDetection
    memoAnalysis: MemoAnalysis
    confidence: float
    reasoning: str
    error: Optional[str] = None


# LLM 분석 프롬프트
COLUMN_ANALYSIS_PROMPT = """당신은 한국 은행 거래내역서 분석 전문가입니다.
업로드된 PDF 파일 또는 제공된 테이블 데이터를 분석하여 거래내역 테이블의 컬럼 구조를 파악하세요.

## 목표
거래내역 테이블을 다음 표준 형식으로 매핑:
- 거래일자: 거래 발생 날짜
- 구분: 입금 또는 출금
- 금액: 거래 금액 (입금이면 +, 출금이면 -)
- 잔액: 거래 후 잔액
- 비고: 입금자/출금처, 계좌정보, 거래 설명 등 기록성 데이터

## 분석 시 주의사항

1. **거래내역 테이블 식별**
   - 문서에 여러 테이블이 있을 수 있음
   - "거래일자", "날짜", "일시" 등 날짜 컬럼이 있는 테이블이 거래내역
   - 계좌정보, 요약표, 집계표 등은 제외

2. **입출금 구분 방식 (4가지 유형)**
   - separate_columns: 입금/출금 별도 컬럼 (예: "입금금액", "출금금액" 또는 "맡기신금액", "찾으신금액")
   - type_column: 거래구분 컬럼에 텍스트 (예: "입금", "출금")
   - sign_in_type: 거래구분에 [+]/[-] 기호 (예: "[+] 충전", "[-] 송금")
   - amount_sign: 금액에 +/- 부호

3. **비고 컬럼 식별 (가장 중요)**
   - 적요, 비고, 내용, 계좌정보/결제정보 등 다양한 이름 가능
   - 내용을 보고 판단: 사람 이름, 계좌번호, 거래처명, 상품명 등이 포함된 컬럼
   - **특이점**: 일부 내역서에서는 입금/출금 금액 컬럼 중 빈 쪽에 비고가 들어감
     예) 지급금액에 숫자, 입금금액에 "홍길동" (비고)

4. **헤더 행 찾기**
   - 첫 번째 행이 아닐 수 있음
   - 계좌정보 등 메타데이터 행 이후에 헤더가 있음

## 응답 형식 (JSON만 반환, 다른 텍스트 없이)
{
  "success": true,
  "tableType": "은행 거래내역서",
  "columnMapping": {
    "거래일자": "실제 컬럼명",
    "구분": "실제 컬럼명 또는 null",
    "입금금액": "실제 컬럼명 또는 null",
    "출금금액": "실제 컬럼명 또는 null",
    "금액": "실제 컬럼명 또는 null",
    "잔액": "실제 컬럼명",
    "비고": "실제 컬럼명"
  },
  "headerRowIndex": 0,
  "dataStartRowIndex": 1,
  "transactionTypeDetection": {
    "method": "separate_columns",
    "details": "설명"
  },
  "memoAnalysis": {
    "columnName": "비고",
    "contentType": "입금자명/거래처/계좌정보/거래설명",
    "confidence": 0.95
  },
  "confidence": 0.9,
  "reasoning": "분석 근거 설명"
}"""


async def analyze_with_llm(content: str, is_pdf: bool = False, file_path: str = None) -> dict:
    """LLM을 사용하여 컬럼 분석"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"column-analysis-{os.urandom(8).hex()}",
        system_message=COLUMN_ANALYSIS_PROMPT
    ).with_model("gemini", "gemini-2.5-flash")
    
    if is_pdf and file_path:
        # PDF 파일 첨부
        pdf_file = FileContentWithMimeType(file_path, "application/pdf")
        response = await chat.send_message(
            UserMessage(
                text="첨부된 PDF 파일의 거래내역 테이블을 분석하고 컬럼 매핑을 JSON 형식으로 반환해주세요. JSON만 반환하고 다른 텍스트는 포함하지 마세요.",
                file_contents=[pdf_file]
            )
        )
    else:
        # 테이블 데이터 텍스트
        response = await chat.send_message(
            UserMessage(
                text=f"다음 테이블 데이터를 분석하고 컬럼 매핑을 JSON 형식으로 반환해주세요. JSON만 반환하고 다른 텍스트는 포함하지 마세요:\n\n{content}"
            )
        )
    
    # JSON 파싱
    import re
    json_match = re.search(r'\{[\s\S]*\}', response)
    if not json_match:
        raise ValueError("LLM 응답에서 JSON을 찾을 수 없습니다")
    
    return json.loads(json_match.group())


@app.post("/analyze/pdf", response_model=ColumnAnalysisResult)
async def analyze_pdf(file: UploadFile = File(...)):
    """PDF 파일 분석"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            result = await analyze_with_llm("", is_pdf=True, file_path=tmp_path)
            return ColumnAnalysisResult(**result)
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        return ColumnAnalysisResult(
            success=False,
            columnMapping=ColumnMapping(거래일자="", 비고=""),
            headerRowIndex=0,
            dataStartRowIndex=1,
            transactionTypeDetection=TransactionTypeDetection(method="separate_columns"),
            memoAnalysis=MemoAnalysis(columnName="", contentType="unknown", confidence=0),
            confidence=0,
            reasoning="",
            error=str(e)
        )


@app.post("/analyze/table", response_model=ColumnAnalysisResult)
async def analyze_table(data: TableData):
    """테이블 데이터 분석"""
    try:
        # 샘플 데이터 준비
        sample_rows = data.rows[:10]
        table_preview = [
            f"헤더: {' | '.join(data.headers)}",
            "",
            "샘플 데이터:",
            *[f"Row {i+1}: {' | '.join(row)}" for i, row in enumerate(sample_rows)]
        ]
        content = "\n".join(table_preview)
        
        result = await analyze_with_llm(content, is_pdf=False)
        return ColumnAnalysisResult(**result)
        
    except Exception as e:
        return ColumnAnalysisResult(
            success=False,
            columnMapping=ColumnMapping(거래일자="", 비고=""),
            headerRowIndex=0,
            dataStartRowIndex=1,
            transactionTypeDetection=TransactionTypeDetection(method="separate_columns"),
            memoAnalysis=MemoAnalysis(columnName="", contentType="unknown", confidence=0),
            confidence=0,
            reasoning="",
            error=str(e)
        )


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy", "service": "column-analyzer"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
