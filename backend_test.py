#!/usr/bin/env python3
"""
Backend Test Suite for Column Analyzer Service
Tests LLM-based column analysis orchestration system
"""

import requests
import json
import sys
import tempfile
import urllib.request
from datetime import datetime
from typing import Dict, Any, Optional

class ColumnAnalyzerTester:
    def __init__(self, base_url: str = "http://localhost:8002"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test PDF URLs from the context
        self.test_pdfs = {
            "거래내역서1": "https://customer-assets.emergentagent.com/job_e9714c6e-1809-44e3-a2c0-35434369c560/artifacts/gmb14u1j_%EA%B1%B0%EB%9E%98%EB%82%B4%EC%97%AD%EC%84%9C%201.pdf"
        }

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })
        print()

    def test_health_check(self) -> bool:
        """Test health check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("service") == "column-analyzer":
                    self.log_test("Health Check", True, f"Service healthy: {data}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_table_analysis(self) -> bool:
        """Test table data analysis endpoint"""
        try:
            # Sample Korean bank transaction data
            test_data = {
                "headers": ["거래일자", "일련번호", "적요", "상태", "지급금액", "입금금액", "잔액", "취급점"],
                "rows": [
                    ["2024-07-01", "001", "홍길동", "정상", "", "1000000", "5000000", "본점"],
                    ["2024-07-02", "002", "ATM출금", "정상", "50000", "", "4950000", "본점"],
                    ["2024-07-03", "003", "김철수", "정상", "", "200000", "5150000", "본점"]
                ]
            }
            
            response = requests.post(
                f"{self.base_url}/analyze/table",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Validate response structure
                required_fields = ["success", "columnMapping", "transactionTypeDetection", "memoAnalysis", "confidence"]
                missing_fields = [field for field in required_fields if field not in result]
                
                if missing_fields:
                    self.log_test("Table Analysis", False, f"Missing fields: {missing_fields}")
                    return False
                
                if result.get("success"):
                    column_mapping = result.get("columnMapping", {})
                    transaction_type = result.get("transactionTypeDetection", {})
                    memo_analysis = result.get("memoAnalysis", {})
                    confidence = result.get("confidence", 0)
                    
                    details = f"Confidence: {confidence}, Method: {transaction_type.get('method')}, Memo: {memo_analysis.get('columnName')}"
                    self.log_test("Table Analysis", True, details, result)
                    return True
                else:
                    error_msg = result.get("error", "Unknown error")
                    self.log_test("Table Analysis", False, f"Analysis failed: {error_msg}")
                    return False
            else:
                self.log_test("Table Analysis", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Table Analysis", False, f"Request error: {str(e)}")
            return False

    def test_pdf_analysis(self) -> bool:
        """Test PDF analysis endpoint"""
        try:
            # Download test PDF
            pdf_url = self.test_pdfs["거래내역서1"]
            print(f"📥 Downloading test PDF from: {pdf_url}")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                urllib.request.urlretrieve(pdf_url, tmp_file.name)
                
                # Test PDF analysis
                with open(tmp_file.name, 'rb') as pdf_file:
                    files = {'file': ('test.pdf', pdf_file, 'application/pdf')}
                    
                    response = requests.post(
                        f"{self.base_url}/analyze/pdf",
                        files=files,
                        timeout=60  # PDF analysis can take longer
                    )
            
            if response.status_code == 200:
                result = response.json()
                
                # Validate response structure
                required_fields = ["success", "columnMapping", "transactionTypeDetection", "memoAnalysis", "confidence"]
                missing_fields = [field for field in required_fields if field not in result]
                
                if missing_fields:
                    self.log_test("PDF Analysis", False, f"Missing fields: {missing_fields}")
                    return False
                
                if result.get("success"):
                    column_mapping = result.get("columnMapping", {})
                    transaction_type = result.get("transactionTypeDetection", {})
                    memo_analysis = result.get("memoAnalysis", {})
                    confidence = result.get("confidence", 0)
                    
                    details = f"Confidence: {confidence}, Method: {transaction_type.get('method')}, Memo: {memo_analysis.get('columnName')}"
                    self.log_test("PDF Analysis", True, details, result)
                    return True
                else:
                    error_msg = result.get("error", "Unknown error")
                    self.log_test("PDF Analysis", False, f"Analysis failed: {error_msg}")
                    return False
            else:
                self.log_test("PDF Analysis", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("PDF Analysis", False, f"Request error: {str(e)}")
            return False

    def test_llm_integration(self) -> bool:
        """Test LLM integration with Emergent API"""
        try:
            # Test with complex table data that requires LLM analysis
            complex_data = {
                "headers": ["No", "거래일시", "거래구분", "거래금액", "거래후잔액", "은행", "계좌정보/결제정보"],
                "rows": [
                    ["1", "2024-07-01 14:30", "[+] 충전", "100000", "500000", "카카오뱅크", "홍길동 1002-123-456789"],
                    ["2", "2024-07-02 09:15", "[-] 송금", "50000", "450000", "국민은행", "김철수 123-456-789012"],
                    ["3", "2024-07-03 16:45", "[+] 입금", "200000", "650000", "신한은행", "이영희 110-987-654321"]
                ]
            }
            
            response = requests.post(
                f"{self.base_url}/analyze/table",
                json=complex_data,
                headers={"Content-Type": "application/json"},
                timeout=45  # LLM calls can take longer
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get("success"):
                    transaction_type = result.get("transactionTypeDetection", {})
                    method = transaction_type.get("method")
                    
                    # This should detect sign_in_type method for [+]/[-] format
                    if method == "sign_in_type":
                        self.log_test("LLM Integration", True, f"Correctly detected sign_in_type method")
                        return True
                    else:
                        self.log_test("LLM Integration", False, f"Expected sign_in_type, got {method}")
                        return False
                else:
                    error_msg = result.get("error", "Unknown error")
                    self.log_test("LLM Integration", False, f"LLM analysis failed: {error_msg}")
                    return False
            else:
                self.log_test("LLM Integration", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("LLM Integration", False, f"Request error: {str(e)}")
            return False

    def test_error_handling(self) -> bool:
        """Test error handling with invalid data"""
        try:
            # Test with empty data
            empty_data = {"headers": [], "rows": []}
            
            response = requests.post(
                f"{self.base_url}/analyze/table",
                json=empty_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Should return success=false with error handling
                if not result.get("success") and result.get("error"):
                    self.log_test("Error Handling", True, f"Properly handled empty data: {result.get('error')}")
                    return True
                else:
                    self.log_test("Error Handling", False, f"Should have failed with empty data: {result}")
                    return False
            else:
                # HTTP error is also acceptable for invalid data
                self.log_test("Error Handling", True, f"HTTP error for invalid data: {response.status_code}")
                return True
                
        except Exception as e:
            self.log_test("Error Handling", False, f"Request error: {str(e)}")
            return False

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return summary"""
        print("="*60)
        print("Column Analyzer Service Backend Tests")
        print("="*60)
        print(f"Testing service at: {self.base_url}")
        print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Run tests in order
        tests = [
            ("Health Check", self.test_health_check),
            ("Table Analysis", self.test_table_analysis),
            ("PDF Analysis", self.test_pdf_analysis),
            ("LLM Integration", self.test_llm_integration),
            ("Error Handling", self.test_error_handling)
        ]
        
        for test_name, test_func in tests:
            print(f"🔍 Running {test_name}...")
            try:
                test_func()
            except Exception as e:
                self.log_test(test_name, False, f"Test execution error: {str(e)}")
        
        # Print summary
        print("="*60)
        print("Test Summary")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = ColumnAnalyzerTester()
    
    try:
        results = tester.run_all_tests()
        
        # Return appropriate exit code
        if results["failed_tests"] == 0:
            print("\n🎉 All tests passed!")
            return 0
        else:
            print(f"\n⚠️  {results['failed_tests']} test(s) failed")
            return 1
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())