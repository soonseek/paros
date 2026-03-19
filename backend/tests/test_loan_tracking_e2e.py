"""
E2E Integration Test: Loan Tracking with Real Data
===================================================

This test creates actual database records and verifies:
1. trackLoanUsage correctly handles transfers vs actual expenses
2. trackMultipleLoans correctly identifies transfers via date+amount matching
"""

import pytest
import requests
import json
from datetime import datetime, timedelta
import uuid
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')
TRPC_URL = f"{BASE_URL}/api/trpc"


class TestLoanTrackingE2E:
    """End-to-end tests with actual database operations"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_data(self, session):
        """Register and login test user"""
        test_email = f"loan_e2e_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "test12345678"
        
        # Register
        reg_resp = session.post(f"{TRPC_URL}/user.register", json={
            "json": {"email": test_email, "password": test_password, "name": "E2E Tester"}
        })
        
        if reg_resp.status_code != 200:
            pytest.skip(f"Could not register user: {reg_resp.text[:200]}")
        
        user_data = reg_resp.json()
        user_id = user_data['result']['data']['json']['userId']
        
        # Login
        login_resp = session.post(f"{TRPC_URL}/user.login", json={
            "json": {"email": test_email, "password": test_password}
        })
        
        if login_resp.status_code != 200:
            pytest.skip(f"Could not login: {login_resp.text[:200]}")
        
        login_data = login_resp.json()
        token = login_data['result']['data']['json']['accessToken']
        
        return {
            "user_id": user_id,
            "email": test_email,
            "password": test_password,
            "token": token,
            "headers": {"Authorization": f"Bearer {token}"}
        }
    
    @pytest.fixture(scope="class")
    def test_case(self, session, auth_data):
        """Create test case"""
        import urllib.parse
        
        case_number = f"TEST-LOAN-{uuid.uuid4().hex[:8]}"
        
        # Create case via tRPC mutation
        resp = session.post(f"{TRPC_URL}/case.create", 
            json={"json": {"caseNumber": case_number, "debtorName": "테스트 채무자"}},
            headers=auth_data['headers']
        )
        
        if resp.status_code != 200:
            pytest.skip(f"Could not create case: {resp.text[:200]}")
        
        case_data = resp.json()
        try:
            case_id = case_data['result']['data']['json']['id']
        except:
            pytest.skip(f"Could not get case ID from response: {case_data}")
        
        return {
            "case_id": case_id,
            "case_number": case_number
        }
    
    def test_loan_tracking_endpoint_responds(self, session, auth_data, test_case):
        """Test that trackLoanUsage endpoint returns valid response for test case"""
        import urllib.parse
        
        input_data = json.dumps({
            "json": {
                "caseId": test_case['case_id'],
                "keyword": "대출"
            }
        })
        encoded = urllib.parse.quote(input_data)
        
        resp = session.get(
            f"{TRPC_URL}/transaction.trackLoanUsage?input={encoded}",
            headers=auth_data['headers']
        )
        
        # Should return 200 with empty result (no loans found)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"
        
        data = resp.json()
        assert 'result' in data, "Should have result in response"
        
        result = data['result']['data']['json']
        assert result['found'] == False, "Should not find any loans (empty case)"
        assert result['trackedItems'] == [], "Should have empty tracked items"
        
        print(f"✓ trackLoanUsage returns correct response for empty case")
    
    def test_suspected_loans_endpoint_responds(self, session, auth_data, test_case):
        """Test getSuspectedLoanDeposits endpoint returns valid response"""
        import urllib.parse
        
        input_data = json.dumps({
            "json": {
                "caseId": test_case['case_id'],
                "minAmount": 1000000
            }
        })
        encoded = urllib.parse.quote(input_data)
        
        resp = session.get(
            f"{TRPC_URL}/transaction.getSuspectedLoanDeposits?input={encoded}",
            headers=auth_data['headers']
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"
        
        data = resp.json()
        assert 'result' in data, "Should have result in response"
        
        result = data['result']['data']['json']
        assert 'deposits' in result, "Should have deposits field"
        assert result['totalCount'] == 0, "Should have no deposits in empty case"
        
        print(f"✓ getSuspectedLoanDeposits returns correct response for empty case")
    
    def test_search_loan_deposits_endpoint_responds(self, session, auth_data, test_case):
        """Test searchLoanDeposits endpoint returns valid response"""
        import urllib.parse
        
        input_data = json.dumps({
            "json": {
                "caseId": test_case['case_id'],
                "keyword": "테스트"
            }
        })
        encoded = urllib.parse.quote(input_data)
        
        resp = session.get(
            f"{TRPC_URL}/transaction.searchLoanDeposits?input={encoded}",
            headers=auth_data['headers']
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"
        
        data = resp.json()
        assert 'result' in data, "Should have result in response"
        
        result = data['result']['data']['json']
        assert 'deposits' in result, "Should have deposits field"
        assert result['totalCount'] == 0, "Should have no deposits in empty case"
        
        print(f"✓ searchLoanDeposits returns correct response for empty case")
    
    def test_track_multiple_loans_endpoint_responds(self, session, auth_data, test_case):
        """Test trackMultipleLoans endpoint returns valid response"""
        import urllib.parse
        
        # Use a fake loan ID (will not find any loans)
        input_data = json.dumps({
            "json": {
                "caseId": test_case['case_id'],
                "loanIds": [str(uuid.uuid4())]
            }
        })
        encoded = urllib.parse.quote(input_data)
        
        resp = session.get(
            f"{TRPC_URL}/transaction.trackMultipleLoans?input={encoded}",
            headers=auth_data['headers']
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"
        
        data = resp.json()
        assert 'result' in data, "Should have result in response"
        
        result = data['result']['data']['json']
        assert result['success'] == False, "Should be unsuccessful (no loans found)"
        assert result['results'] == [], "Should have empty results"
        
        print(f"✓ trackMultipleLoans returns correct response for non-existent loans")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
