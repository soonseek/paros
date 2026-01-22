"""
Column Analyzer 테스트 스크립트

3개의 거래내역서 PDF를 분석하여 LLM 기반 컬럼 매핑이 올바르게 동작하는지 확인
"""

import asyncio
import os
import sys
import json
import tempfile
import urllib.request

# 테스트 PDF URL
PDF_URLS = {
    "거래내역서1": "https://customer-assets.emergentagent.com/job_e9714c6e-1809-44e3-a2c0-35434369c560/artifacts/gmb14u1j_%EA%B1%B0%EB%9E%98%EB%82%B4%EC%97%AD%EC%84%9C%201.pdf",
    "거래내역서2": "https://customer-assets.emergentagent.com/job_e9714c6e-1809-44e3-a2c0-35434369c560/artifacts/1un6x7o3_%EA%B1%B0%EB%9E%98%EB%82%B4%EC%97%AD%EC%84%9C%202.pdf",
    "거래내역서3": "https://customer-assets.emergentagent.com/job_e9714c6e-1809-44e3-a2c0-35434369c560/artifacts/qgkpguka_%EA%B1%B0%EB%9E%98%EB%82%B4%EC%97%AD%EC%84%9C%203.pdf",
}

# 기대 결과 (문서 분석 기반)
EXPECTED_RESULTS = {
    "거래내역서1": {
        "헤더": ["거래일자", "일련번호", "적요", "상태", "지급금액", "입금금액", "잔액", "취급점", "시각", "Teller"],
        "입출금_구분_방식": "separate_columns",
        "비고_컬럼": "입금금액 또는 지급금액에 비고 포함 (특이점)",
    },
    "거래내역서2": {
        "헤더": ["거래일자", "내용", "찾으신금액", "맡기신금액", "비고", "잔액", "후송", "마감후", "키", "기번", "점", "점명"],
        "입출금_구분_방식": "separate_columns",
        "비고_컬럼": "비고",
    },
    "거래내역서3": {
        "헤더": ["No", "거래일시", "거래구분", "거래금액", "거래후잔액", "은행", "계좌정보/결제정보"],
        "입출금_구분_방식": "sign_in_type",  # [+], [-] 기호
        "비고_컬럼": "계좌정보/결제정보",
    },
}


async def analyze_pdf(name: str, url: str):
    """PDF 다운로드 후 분석"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    
    print(f"\n{'='*60}")
    print(f"분석 중: {name}")
    print(f"{'='*60}")
    
    # PDF 다운로드
    print(f"[1] PDF 다운로드 중...")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        urllib.request.urlretrieve(url, tmp.name)
        pdf_path = tmp.name
    
    try:
        # LLM 분석
        print(f"[2] LLM 분석 중 (Gemini 2.5 Flash)...")
        
        EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-21606D0AeC4F526Fc0")
        
        PROMPT = """당신은 한국 은행 거래내역서 분석 전문가입니다.
첨부된 PDF를 분석하여 거래내역 테이블의 컬럼 구조를 JSON으로 반환하세요.

목표: 거래일자, 구분(입금/출금), 금액, 잔액, 비고 형식으로 매핑

응답 형식 (JSON만):
{
  "success": true,
  "tableType": "은행 거래내역서",
  "columnMapping": {
    "거래일자": "실제 헤더명",
    "입금금액": "헤더명 또는 null",
    "출금금액": "헤더명 또는 null",
    "금액": "통합 금액 컬럼 또는 null",
    "잔액": "헤더명",
    "비고": "헤더명 (입금자명, 계좌정보 등)"
  },
  "transactionTypeDetection": {
    "method": "separate_columns|sign_in_type|type_column",
    "details": "설명"
  },
  "memoAnalysis": {
    "columnName": "비고 컬럼명",
    "contentType": "내용 유형",
    "confidence": 0.95
  },
  "confidence": 0.9,
  "reasoning": "분석 근거"
}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"test-{name}",
            system_message=PROMPT
        ).with_model("gemini", "gemini-2.5-flash")
        
        pdf_file = FileContentWithMimeType("application/pdf", pdf_path)
        
        response = await chat.send_message(
            UserMessage(
                text="첨부된 PDF의 거래내역 테이블을 분석하세요. JSON만 반환하세요.",
                file_contents=[pdf_file]
            )
        )
        
        # JSON 추출
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            result = json.loads(json_match.group())
            
            print(f"\n[결과]")
            print(f"  성공: {result.get('success', False)}")
            print(f"  신뢰도: {result.get('confidence', 0)}")
            print(f"  입출금 구분 방식: {result.get('transactionTypeDetection', {}).get('method', 'N/A')}")
            print(f"\n  컬럼 매핑:")
            for key, value in result.get('columnMapping', {}).items():
                if value:
                    print(f"    - {key}: {value}")
            print(f"\n  비고 분석:")
            memo = result.get('memoAnalysis', {})
            print(f"    - 컬럼명: {memo.get('columnName', 'N/A')}")
            print(f"    - 내용 유형: {memo.get('contentType', 'N/A')}")
            print(f"    - 신뢰도: {memo.get('confidence', 0)}")
            print(f"\n  분석 근거: {result.get('reasoning', 'N/A')[:200]}...")
            
            # 기대값과 비교
            expected = EXPECTED_RESULTS.get(name, {})
            expected_method = expected.get('입출금_구분_방식', '')
            actual_method = result.get('transactionTypeDetection', {}).get('method', '')
            
            print(f"\n[검증]")
            print(f"  기대 방식: {expected_method}")
            print(f"  실제 방식: {actual_method}")
            print(f"  일치 여부: {'✓' if expected_method == actual_method else '✗'}")
            
            return result
        else:
            print(f"[오류] JSON 파싱 실패")
            print(f"응답: {response[:500]}...")
            return None
            
    finally:
        os.unlink(pdf_path)


async def main():
    print("="*60)
    print("거래내역서 PDF 컬럼 분석 테스트")
    print("="*60)
    
    results = {}
    for name, url in PDF_URLS.items():
        try:
            result = await analyze_pdf(name, url)
            results[name] = result
        except Exception as e:
            print(f"\n[오류] {name}: {e}")
            import traceback
            traceback.print_exc()
    
    # 요약
    print(f"\n{'='*60}")
    print("테스트 요약")
    print(f"{'='*60}")
    
    for name, result in results.items():
        if result:
            method = result.get('transactionTypeDetection', {}).get('method', 'N/A')
            memo = result.get('memoAnalysis', {}).get('columnName', 'N/A')
            confidence = result.get('confidence', 0)
            print(f"  {name}:")
            print(f"    - 입출금 구분: {method}")
            print(f"    - 비고 컬럼: {memo}")
            print(f"    - 신뢰도: {confidence}")
        else:
            print(f"  {name}: 분석 실패")


if __name__ == "__main__":
    asyncio.run(main())
