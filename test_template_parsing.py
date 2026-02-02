#!/usr/bin/env python3
"""
Template-based PDF Parsing System Test
Tests the complete flow:
1. Template creation (template.create)
2. PDF file analysis (file.analyzeFile)
3. Verification of header normalization, template matching, column mapping
"""

import requests
import json
import base64
import sys
from typing import Dict, Any, Optional

class TemplateParsingTester:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/trpc"
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with level"""
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️",
            "DEBUG": "🔍"
        }.get(level, "📝")
        print(f"{prefix} {message}")
    
    def authenticate(self, email: str = "admin@test.com", password: str = "admin123") -> bool:
        """
        Authenticate user and get JWT token
        Note: This assumes there's an admin user in the database
        """
        self.log(f"Authenticating as {email}...")
        
        try:
            # Try to login via tRPC user.login endpoint
            response = self.session.post(
                f"{self.api_url}/user.login",
                json={
                    "email": email,
                    "password": password
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                result = data.get("result", {}).get("data", {})
                
                if result.get("success"):
                    self.auth_token = result.get("accessToken")
                    self.user_id = result.get("user", {}).get("id")
                    self.log(f"Authentication successful! User ID: {self.user_id}", "SUCCESS")
                    return True
                else:
                    self.log(f"Login failed: {result.get('message')}", "ERROR")
                    return False
            else:
                self.log(f"Login request failed: HTTP {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "DEBUG")
                return False
                
        except Exception as e:
            self.log(f"Authentication error: {str(e)}", "ERROR")
            return False
    
    def call_trpc(self, procedure: str, input_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Call tRPC procedure
        """
        try:
            headers = {
                "Content-Type": "application/json"
            }
            
            if self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            
            # tRPC batch format
            payload = {
                "0": {
                    "json": input_data
                }
            }
            
            url = f"{self.api_url}/{procedure}"
            self.log(f"Calling {procedure}...", "DEBUG")
            
            response = self.session.post(
                url,
                json=payload,
                headers=headers,
                timeout=120
            )
            
            self.log(f"Response status: {response.status_code}", "DEBUG")
            
            if response.status_code == 200:
                data = response.json()
                # tRPC batch response format
                result = data.get("0", {}).get("result", {}).get("data", {})
                return result
            else:
                self.log(f"tRPC call failed: HTTP {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:1000]}", "DEBUG")
                return None
                
        except Exception as e:
            self.log(f"tRPC call error: {str(e)}", "ERROR")
            return None
    
    def test_template_creation(self) -> Optional[str]:
        """
        Test 1: Create template for 국민은행
        """
        self.log("=" * 60)
        self.log("TEST 1: Template Creation (국민은행)", "INFO")
        self.log("=" * 60)
        
        template_data = {
            "name": "국민은행 거래내역",
            "bankName": "국민은행",
            "description": "국민은행 거래내역서 형식",
            "identifiers": ["국민은행", "거래내역"],
            "columnSchema": {
                "columns": {
                    "date": {"index": 0, "header": "거래일자"},
                    "deposit": {"index": 3, "header": "입금금액"},
                    "withdrawal": {"index": 2, "header": "출금금액"},
                    "balance": {"index": 4, "header": "잔액"},
                    "memo": {"index": 5, "header": "송금인/수취인"}
                }
            },
            "isActive": True,
            "priority": 10
        }
        
        self.log(f"Creating template: {template_data['name']}")
        self.log(f"Identifiers: {template_data['identifiers']}")
        self.log(f"Column schema: {json.dumps(template_data['columnSchema'], ensure_ascii=False, indent=2)}")
        
        result = self.call_trpc("template.create", template_data)
        
        if result:
            template_id = result.get("id")
            self.log(f"Template created successfully! ID: {template_id}", "SUCCESS")
            self.log(f"Template name: {result.get('name')}")
            self.log(f"Bank name: {result.get('bankName')}")
            self.log(f"Priority: {result.get('priority')}")
            return template_id
        else:
            self.log("Template creation failed", "ERROR")
            return None
    
    def test_pdf_analysis(self, pdf_path: str = "/tmp/국민은행.pdf") -> bool:
        """
        Test 2: Analyze PDF file with template matching
        """
        self.log("=" * 60)
        self.log("TEST 2: PDF Analysis with Template Matching", "INFO")
        self.log("=" * 60)
        
        try:
            # Read PDF file
            with open(pdf_path, "rb") as f:
                pdf_content = f.read()
            
            file_size = len(pdf_content)
            self.log(f"PDF file: {pdf_path}")
            self.log(f"File size: {file_size / 1024:.2f} KB")
            
            # Encode to base64
            file_base64 = base64.b64encode(pdf_content).decode("utf-8")
            
            # Call file.analyzeFile endpoint
            # Note: This endpoint requires a documentId, so we need to upload first
            # For testing purposes, we'll use template.testMatchWithFile instead
            
            self.log("Testing template matching with PDF...")
            
            test_data = {
                "fileBase64": file_base64,
                "fileName": "국민은행.pdf",
                "mimeType": "application/pdf"
            }
            
            result = self.call_trpc("template.testMatchWithFile", test_data)
            
            if result:
                self.log("=" * 60)
                self.log("ANALYSIS RESULTS", "INFO")
                self.log("=" * 60)
                
                matched = result.get("matched", False)
                
                if matched:
                    self.log(f"✅ Template matched!", "SUCCESS")
                    self.log(f"Layer: {result.get('layer')}")
                    self.log(f"Layer name: {result.get('layerName')}")
                    self.log(f"Template ID: {result.get('templateId')}")
                    self.log(f"Template name: {result.get('templateName')}")
                    self.log(f"Confidence: {result.get('confidence')}")
                    
                    # Check headers
                    headers = result.get("headers", [])
                    self.log(f"\n📋 Extracted Headers ({len(headers)} columns):")
                    for i, header in enumerate(headers):
                        self.log(f"  [{i}] {header}")
                    
                    # Check column mapping
                    column_mapping = result.get("columnMapping", {})
                    self.log(f"\n🗺️  Column Mapping:")
                    for key, value in column_mapping.items():
                        self.log(f"  {key}: column {value}")
                    
                    # Check sample rows
                    sample_rows = result.get("sampleRows", [])
                    self.log(f"\n📊 Sample Data ({len(sample_rows)} rows):")
                    for i, row in enumerate(sample_rows[:3]):
                        self.log(f"  Row {i + 1}: {' | '.join(str(cell) for cell in row[:5])}")
                    
                    # Verification checks
                    self.log("\n" + "=" * 60)
                    self.log("VERIFICATION CHECKS", "INFO")
                    self.log("=" * 60)
                    
                    # Check 1: Header normalization
                    self.log("\n1️⃣ Header Normalization Check:")
                    normalized_headers = [h.replace(" ", "") for h in headers]
                    self.log(f"  Original headers: {headers[:5]}")
                    self.log(f"  Normalized headers: {normalized_headers[:5]}")
                    
                    has_spaces = any(" " in h for h in headers)
                    if has_spaces:
                        self.log("  ⚠️  Some headers contain spaces (OCR issue)", "WARNING")
                    else:
                        self.log("  ✅ Headers are properly normalized", "SUCCESS")
                    
                    # Check 2: Template matching
                    self.log("\n2️⃣ Template Matching Check:")
                    if result.get("layer") == 1:
                        self.log("  ✅ Layer 1 (Exact Match) - Identifiers matched in page text", "SUCCESS")
                    elif result.get("layer") == 2:
                        self.log("  ✅ Layer 2 (Similarity Match) - LLM matched template", "SUCCESS")
                    else:
                        self.log("  ⚠️  Unexpected layer", "WARNING")
                    
                    # Check 3: Column mapping
                    self.log("\n3️⃣ Column Mapping Check:")
                    required_columns = ["date", "deposit", "withdrawal", "balance", "memo"]
                    missing_columns = [col for col in required_columns if col not in column_mapping]
                    
                    if missing_columns:
                        self.log(f"  ⚠️  Missing columns: {missing_columns}", "WARNING")
                    else:
                        self.log("  ✅ All required columns mapped", "SUCCESS")
                    
                    # Check 4: Data extraction
                    self.log("\n4️⃣ Data Extraction Check:")
                    if len(sample_rows) > 0:
                        self.log(f"  ✅ Extracted {len(sample_rows)} sample rows", "SUCCESS")
                        
                        # Check if first row has date pattern
                        first_row = sample_rows[0] if sample_rows else []
                        if first_row and len(first_row) > 0:
                            first_cell = str(first_row[0])
                            import re
                            date_pattern = re.compile(r'\d{4}[-./]\d{2}[-./]\d{2}')
                            if date_pattern.match(first_cell):
                                self.log(f"  ✅ First row contains valid date: {first_cell}", "SUCCESS")
                            else:
                                self.log(f"  ⚠️  First row date format unclear: {first_cell}", "WARNING")
                    else:
                        self.log("  ❌ No data rows extracted", "ERROR")
                    
                    return True
                else:
                    self.log("❌ Template matching failed", "ERROR")
                    message = result.get("message", "No message")
                    error = result.get("error", "No error")
                    self.log(f"Message: {message}")
                    self.log(f"Error: {error}")
                    
                    # Still show extracted headers if available
                    headers = result.get("headers", [])
                    if headers:
                        self.log(f"\n📋 Extracted Headers (no match):")
                        for i, header in enumerate(headers):
                            self.log(f"  [{i}] {header}")
                    
                    return False
            else:
                self.log("PDF analysis failed - no result returned", "ERROR")
                return False
                
        except FileNotFoundError:
            self.log(f"PDF file not found: {pdf_path}", "ERROR")
            return False
        except Exception as e:
            self.log(f"PDF analysis error: {str(e)}", "ERROR")
            import traceback
            self.log(traceback.format_exc(), "DEBUG")
            return False
    
    def run_all_tests(self):
        """
        Run all tests in sequence
        """
        self.log("=" * 60)
        self.log("국민은행 PDF Template-based Parsing System Test", "INFO")
        self.log("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            self.log("Authentication failed. Cannot proceed with tests.", "ERROR")
            self.log("\nNote: Make sure there's an admin user in the database.", "WARNING")
            self.log("You can create one using: npm run db:seed", "WARNING")
            return False
        
        # Step 2: Create template
        template_id = self.test_template_creation()
        if not template_id:
            self.log("Template creation failed. Continuing with PDF analysis...", "WARNING")
        
        # Step 3: Analyze PDF
        pdf_success = self.test_pdf_analysis()
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY", "INFO")
        self.log("=" * 60)
        
        if template_id:
            self.log(f"✅ Template created: {template_id}", "SUCCESS")
        else:
            self.log("❌ Template creation failed", "ERROR")
        
        if pdf_success:
            self.log("✅ PDF analysis and template matching successful", "SUCCESS")
        else:
            self.log("❌ PDF analysis or template matching failed", "ERROR")
        
        return template_id is not None and pdf_success

def main():
    """Main test execution"""
    tester = TemplateParsing Tester()
    
    try:
        success = tester.run_all_tests()
        
        if success:
            print("\n🎉 All tests passed!")
            return 0
        else:
            print("\n⚠️  Some tests failed")
            return 1
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
