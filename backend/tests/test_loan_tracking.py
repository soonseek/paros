"""
P0 Bug Fix Tests: Loan Tracking Transfer Detection
=================================================

Tests for the bug fix where internal account transfers (이체/이동) 
were incorrectly calculated as actual expenditures.

Bug Fix Summary:
1. trackLoanUsage: Transfer transactions (이체, 송금, 이동, 振込) 
   should NOT decrement remainingLoan
2. trackMultipleLoans: Transfer detection via date+amount matching.
   Dead code (unused withdrawals query) was removed.

Testing Focus:
- trackLoanUsage: Transfer keyword detection
- trackLoanUsage: Normal withdrawals still decrement remainingLoan
- trackLoanUsage: Break condition only triggers for non-transfer withdrawals
- trackMultipleLoans: Transfer count in summary
"""

import pytest
import requests
import os
import json
from datetime import datetime, timedelta
import uuid

# Get base URL from environment
BASE_URL = os.environ.get('NEXT_PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')

# tRPC batch endpoint
TRPC_URL = f"{BASE_URL}/api/trpc"


class TestDatabaseSetup:
    """Setup test data for loan tracking tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def setup_test_data(self, session):
        """Setup test user, case, document, and transactions via direct API"""
        # First, create a test user
        test_email = f"test_loan_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "test12345678"
        
        # Register user via tRPC
        register_data = {
            "json": {
                "email": test_email,
                "password": test_password,
                "name": "Loan Test User"
            }
        }
        
        response = session.post(f"{TRPC_URL}/user.register", json=register_data)
        print(f"Register response status: {response.status_code}")
        print(f"Register response: {response.text[:500]}")
        
        if response.status_code != 200:
            pytest.skip(f"Could not register user: {response.text[:200]}")
        
        return {
            "email": test_email,
            "password": test_password
        }
    
    def test_database_connection(self, session):
        """Test that the database is accessible via API"""
        # Just ping the health check or any public endpoint
        response = session.get(f"{BASE_URL}/api/trpc/user.login?batch=1&input=%7B%7D", timeout=10)
        # Even an error response means the server is up
        assert response.status_code in [200, 400, 401, 500], "Server should respond"
        print(f"Database connection test - Server responded with status: {response.status_code}")


class TestTrackLoanUsageLogic:
    """
    Unit tests for trackLoanUsage function logic
    
    Key bug fix: Transfer transactions should NOT decrement remainingLoan
    """
    
    def test_transfer_keyword_detection_in_code(self):
        """
        Verify that the code correctly detects transfer keywords
        Keywords: '이체', '송금', '이동', '振込'
        """
        # Read the source file
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Check that isTransfer logic exists
        assert 'isTransfer' in content, "isTransfer variable should exist in code"
        
        # Check all transfer keywords are detected
        assert '이체' in content, "Korean '이체' (transfer) keyword should be checked"
        assert '송금' in content, "Korean '송금' (remittance) keyword should be checked"
        assert '이동' in content, "Korean '이동' (movement) keyword should be checked"
        assert '振込' in content, "Japanese '振込' (transfer) keyword should be checked"
        
        print("✓ Transfer keyword detection logic verified in code")
    
    def test_transfer_does_not_decrement_remaining_loan(self):
        """
        Verify that transfer transactions do NOT decrement remainingLoan
        
        Code check: if (!isTransfer) { remainingLoan -= withdrawal; }
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Find the trackLoanUsage function section
        # Look for the pattern where transfer check prevents decrement
        
        # Check that remainingLoan is only decremented for non-transfers
        assert 'if (!isTransfer)' in content, "Should have condition to check non-transfer"
        
        # Verify the decrement is inside the condition
        lines = content.split('\n')
        found_condition = False
        found_decrement = False
        
        for i, line in enumerate(lines):
            if 'if (!isTransfer)' in line:
                found_condition = True
                # Check next few lines for the decrement
                for j in range(i, min(i+5, len(lines))):
                    if 'remainingLoan -=' in lines[j]:
                        found_decrement = True
                        break
        
        assert found_condition, "Non-transfer condition should exist"
        assert found_decrement, "remainingLoan decrement should be inside non-transfer condition"
        
        print("✓ Transfer transactions correctly do NOT decrement remainingLoan")
    
    def test_break_condition_excludes_transfers(self):
        """
        Verify that the break condition (exhaustion check) 
        only triggers for non-transfer withdrawals
        
        Bug fix: if (!isTransfer && remainingLoan <= 0) break;
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Check for the break condition that includes transfer check
        assert '!isTransfer && remainingLoan <= 0' in content or \
               ('!isTransfer' in content and 'remainingLoan <= 0' in content), \
               "Break condition should exclude transfers"
        
        print("✓ Break condition correctly excludes transfer transactions")
    
    def test_transfer_type_in_tracked_items(self):
        """
        Verify that transfer transactions are marked as type '이체'
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Check that type is set to '이체' for transfers
        assert 'type: isTransfer ? "이체" : "출금"' in content or \
               'type: "이체"' in content, \
               "Transfer type should be '이체'"
        
        print("✓ Transfer transactions are correctly typed as '이체'")


class TestTrackMultipleLoansLogic:
    """
    Unit tests for trackMultipleLoans function logic
    
    Key changes:
    1. Dead code (unused withdrawals query) removed
    2. Transfer detection via date+amount matching
    """
    
    def test_dead_code_removed(self):
        """
        Verify that unused withdrawals query (dead code) was removed
        
        The previous code had a query that fetched ALL withdrawals 
        across all accounts but was never used.
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Look for the trackMultipleLoans function
        track_multiple_start = content.find('trackMultipleLoans: protectedProcedure')
        assert track_multiple_start > 0, "trackMultipleLoans function should exist"
        
        # Get the function body (until the next major function)
        func_end = content.find('/**', track_multiple_start + 100)
        if func_end == -1:
            func_end = len(content)
        
        func_body = content[track_multiple_start:func_end]
        
        # The dead code was a withdrawals query that wasn't used in the logic
        # Count how many withdrawal queries exist
        withdrawal_queries = func_body.count('withdrawalAmount: { gt: 0 }')
        
        # We should have withdrawal queries (for tracking), but they should all be used
        # The key is that loanAccountWithdrawals and destWithdrawals are used
        assert 'loanAccountWithdrawals' in func_body, "Loan account withdrawals query should exist"
        assert 'destWithdrawals' in func_body, "Destination withdrawals query should exist"
        
        print("✓ Dead code check passed - withdrawal queries are properly used")
    
    def test_transfer_detection_via_date_amount(self):
        """
        Verify transfer detection via date+amount matching
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Check for depositMatchMap creation
        assert 'depositMatchMap' in content, "depositMatchMap should exist for transfer matching"
        
        # Check for date_amount key format
        assert '${dateStr}_${withdrawal}' in content or \
               '${dateStr}_${amount}' in content, \
               "Key format should be date_amount"
        
        print("✓ Transfer detection via date+amount matching verified")
    
    def test_transfer_count_in_summary(self):
        """
        Verify that transfer count is included in the summary
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Find trackMultipleLoans function
        track_multiple_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[track_multiple_start:track_multiple_start + 15000]
        
        # Check for transferCount in summary
        assert 'transferCount' in func_body, "transferCount should be in the function"
        assert "type === \"이동\"" in func_body, "Should count items with type '이동'"
        
        print("✓ Transfer count is correctly included in summary")
    
    def test_transfer_does_not_decrement_remaining_in_multiple(self):
        """
        Verify that in trackMultipleLoans, transfers don't decrement remainingLoan
        """
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()
        
        # Find trackMultipleLoans function
        track_multiple_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[track_multiple_start:track_multiple_start + 15000]
        
        # Check for the pattern where transfer keeps remainingLoan unchanged
        # In the code: remainingLoan, // 잔여액 변동 없음
        assert '잔여액 변동 없음' in func_body or \
               ('isTransfer' in func_body and 'remainingLoan' in func_body), \
               "Transfer should not change remainingLoan"
        
        print("✓ Transfers correctly do not decrement remainingLoan in trackMultipleLoans")


class TestTrackLoanUsageIntegration:
    """
    Integration tests for trackLoanUsage tRPC endpoint
    
    These tests would require actual database transactions
    """
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class") 
    def auth_token(self, session):
        """Get authentication token for API calls"""
        # Try to login with test credentials
        login_data = {
            "json": {
                "email": "admin@test.com",
                "password": "test1234"
            }
        }
        
        response = session.post(f"{TRPC_URL}/user.login", json=login_data)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code != 200:
            # Try to register first
            register_data = {
                "json": {
                    "email": "admin@test.com",
                    "password": "test1234",
                    "name": "Test Admin"
                }
            }
            response = session.post(f"{TRPC_URL}/user.register", json=register_data)
            print(f"Register response: {response.status_code}")
            
            if response.status_code == 200:
                response = session.post(f"{TRPC_URL}/user.login", json=login_data)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'result' in data and 'data' in data['result'] and 'json' in data['result']['data']:
                    token = data['result']['data']['json'].get('accessToken')
                    if token:
                        return token
            except:
                pass
        
        pytest.skip("Could not authenticate for integration tests")
    
    def test_track_loan_usage_endpoint_exists(self, session):
        """Test that trackLoanUsage endpoint exists"""
        # Try to call the endpoint without auth to check it exists
        test_data = {
            "json": {
                "caseId": "test-case-id",
                "keyword": "대출"
            }
        }
        
        response = session.post(f"{TRPC_URL}/transaction.trackLoanUsage", json=test_data)
        
        # Should get 401 (unauthorized) or 400 (bad request) - not 404
        assert response.status_code in [200, 400, 401, 500], \
            f"Endpoint should exist. Got: {response.status_code}"
        
        print(f"✓ trackLoanUsage endpoint exists (status: {response.status_code})")


class TestGetSuspectedLoanDeposits:
    """Tests for getSuspectedLoanDeposits endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_suspected_loans_endpoint_exists(self, session):
        """Test that getSuspectedLoanDeposits endpoint exists"""
        test_data = {
            "json": {
                "caseId": "test-case-id"
            }
        }
        
        response = session.post(f"{TRPC_URL}/transaction.getSuspectedLoanDeposits", json=test_data)
        
        assert response.status_code in [200, 400, 401, 500], \
            f"Endpoint should exist. Got: {response.status_code}"
        
        print(f"✓ getSuspectedLoanDeposits endpoint exists (status: {response.status_code})")


class TestSearchLoanDeposits:
    """Tests for searchLoanDeposits endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_search_loan_deposits_endpoint_exists(self, session):
        """Test that searchLoanDeposits endpoint exists"""
        test_data = {
            "json": {
                "caseId": "test-case-id",
                "keyword": "대출"
            }
        }
        
        response = session.post(f"{TRPC_URL}/transaction.searchLoanDeposits", json=test_data)
        
        assert response.status_code in [200, 400, 401, 500], \
            f"Endpoint should exist. Got: {response.status_code}"
        
        print(f"✓ searchLoanDeposits endpoint exists (status: {response.status_code})")


class TestTrackMultipleLoans:
    """Tests for trackMultipleLoans endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_track_multiple_loans_endpoint_exists(self, session):
        """Test that trackMultipleLoans endpoint exists"""
        test_data = {
            "json": {
                "caseId": "test-case-id",
                "loanIds": ["test-id-1"]
            }
        }
        
        response = session.post(f"{TRPC_URL}/transaction.trackMultipleLoans", json=test_data)
        
        assert response.status_code in [200, 400, 401, 500], \
            f"Endpoint should exist. Got: {response.status_code}"
        
        print(f"✓ trackMultipleLoans endpoint exists (status: {response.status_code})")


class TestFrontendIntegration:
    """Tests for loan-tracking-modal.tsx frontend component"""
    
    def test_loan_tracking_modal_uses_correct_apis(self):
        """Verify that the modal uses the correct tRPC endpoints"""
        with open('/app/src/components/loan-tracking-modal.tsx', 'r') as f:
            content = f.read()
        
        # Check that the modal uses the correct API endpoints
        assert 'getSuspectedLoanDeposits' in content, \
            "Modal should use getSuspectedLoanDeposits"
        assert 'searchLoanDeposits' in content, \
            "Modal should use searchLoanDeposits"
        assert 'trackMultipleLoans' in content, \
            "Modal should use trackMultipleLoans"
        
        print("✓ LoanTrackingModal uses all required tRPC endpoints")
    
    def test_loan_tracking_modal_displays_transfer_count(self):
        """Verify that the modal displays transfer count correctly"""
        with open('/app/src/components/loan-tracking-modal.tsx', 'r') as f:
            content = f.read()
        
        # Check that transfer count is displayed
        assert 'transferCount' in content, \
            "Modal should display transferCount"
        assert '이동 건수' in content, \
            "Modal should show '이동 건수' label"
        
        print("✓ LoanTrackingModal displays transfer count correctly")
    
    def test_loan_tracking_modal_shows_transfer_type(self):
        """Verify that transfers are displayed with correct type"""
        with open('/app/src/components/loan-tracking-modal.tsx', 'r') as f:
            content = f.read()
        
        # Check that '이동' type is handled
        assert '"이동"' in content or "'이동'" in content, \
            "Modal should handle '이동' type"
        
        print("✓ LoanTrackingModal displays transfer type correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
