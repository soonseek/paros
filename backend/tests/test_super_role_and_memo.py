"""
Backend Tests for SUPER Role Access and Memo Column Bug Fix
법무법인 파로스 - SUPER 역할 권한 및 비고 컬럼 버그 수정 테스트

Tests:
1. SUPER 사용자 로그인 및 인증
2. SUPER 사용자 템플릿 관리 접근 (CRUD)
3. ADMIN 사용자 템플릿 관리 접근 비교
4. memo(비고) 컬럼이 올바르게 처리되는지 확인
"""

import pytest
import requests
import os
import json

# Use localhost for testing since external URL may have Cloudflare issues
BASE_URL = "http://localhost:3000"

# Test credentials from review request
ADMIN_CREDS = {"email": "admin@test.com", "password": "admin123"}
SUPER_CREDS = {"email": "super@test.com", "password": "admin123"}


class TestUserAuthentication:
    """Test user login and authentication"""
    
    def test_admin_user_login(self):
        """Test ADMIN user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": ADMIN_CREDS}
        )
        
        print(f"Admin login response status: {response.status_code}")
        print(f"Admin login response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        result = data.get("result", {}).get("data", {}).get("json", {})
        
        assert "accessToken" in result, f"No access token in response: {result}"
        assert result.get("user", {}).get("role") == "ADMIN", f"Unexpected role: {result}"
        
        return result.get("accessToken")
    
    def test_super_user_login(self):
        """Test SUPER user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": SUPER_CREDS}
        )
        
        print(f"Super login response status: {response.status_code}")
        print(f"Super login response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Super login failed: {response.text}"
        
        data = response.json()
        result = data.get("result", {}).get("data", {}).get("json", {})
        
        assert "accessToken" in result, f"No access token in response: {result}"
        assert result.get("user", {}).get("role") == "SUPER", f"Unexpected role: {result}"
        
        return result.get("accessToken")


class TestTemplateAccessControl:
    """Test template management access for ADMIN and SUPER users"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin access token"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": ADMIN_CREDS}
        )
        data = response.json()
        return data.get("result", {}).get("data", {}).get("json", {}).get("accessToken")
    
    @pytest.fixture
    def super_token(self):
        """Get super access token"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": SUPER_CREDS}
        )
        data = response.json()
        return data.get("result", {}).get("data", {}).get("json", {}).get("accessToken")
    
    def test_admin_can_list_templates(self, admin_token):
        """Test ADMIN user can list templates"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.list",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            },
            params={"input": json.dumps({"json": {"includeInactive": True}})}
        )
        
        print(f"Admin list templates response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Admin cannot list templates: {response.text}"
        
        data = response.json()
        result = data.get("result", {}).get("data", {}).get("json", [])
        
        assert isinstance(result, list), f"Templates should be a list: {result}"
        print(f"Templates found: {len(result)}")
    
    def test_super_can_list_templates(self, super_token):
        """Test SUPER user can list templates"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.list",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {super_token}"
            },
            params={"input": json.dumps({"json": {"includeInactive": True}})}
        )
        
        print(f"Super list templates response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Super cannot list templates: {response.text}"
        
        data = response.json()
        result = data.get("result", {}).get("data", {}).get("json", [])
        
        assert isinstance(result, list), f"Templates should be a list: {result}"
        print(f"Templates found for SUPER user: {len(result)}")
    
    def test_super_can_access_template_stats(self, super_token):
        """Test SUPER user can access template statistics"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.getStats",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {super_token}"
            }
        )
        
        print(f"Super getStats response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Super cannot access stats: {response.text}"
        
        data = response.json()
        result = data.get("result", {}).get("data", {}).get("json", {})
        
        assert "totalTemplates" in result, f"Stats should contain totalTemplates: {result}"
        assert "activeTemplates" in result, f"Stats should contain activeTemplates: {result}"
        print(f"Total templates: {result.get('totalTemplates')}, Active: {result.get('activeTemplates')}")


class TestMemoColumnHandling:
    """Test memo (비고) column handling in template schema"""
    
    def test_template_has_memo_column(self):
        """Verify existing template has memo column in columnSchema"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": ADMIN_CREDS}
        )
        data = response.json()
        token = data.get("result", {}).get("data", {}).get("json", {}).get("accessToken")
        
        # Get templates
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.list",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            params={"input": json.dumps({"json": {"includeInactive": True}})}
        )
        
        assert response.status_code == 200, f"Cannot list templates: {response.text}"
        
        data = response.json()
        templates = data.get("result", {}).get("data", {}).get("json", [])
        
        assert len(templates) > 0, "No templates found"
        
        # Check first template for memo column
        template = templates[0]
        column_schema = template.get("columnSchema", {})
        columns = column_schema.get("columns", {})
        
        print(f"Template: {template.get('name')}")
        print(f"Column Schema: {json.dumps(column_schema, indent=2)}")
        
        # Verify memo column exists
        assert "memo" in columns, f"memo column missing from template: {columns.keys()}"
        
        memo_config = columns.get("memo", {})
        assert "index" in memo_config, f"memo column missing index: {memo_config}"
        assert "header" in memo_config, f"memo column missing header: {memo_config}"
        
        print(f"Memo column config: {memo_config}")
        print("✅ Template has proper memo column configuration")


class TestTemplateCreateWithMemo:
    """Test creating template with memo column"""
    
    @pytest.fixture
    def super_token(self):
        """Get super access token"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": SUPER_CREDS}
        )
        data = response.json()
        return data.get("result", {}).get("data", {}).get("json", {}).get("accessToken")
    
    def test_super_can_create_template_with_memo(self, super_token):
        """Test SUPER user can create a template with memo column"""
        template_data = {
            "name": "TEST_SUPER_Template_With_Memo",
            "bankName": "테스트은행",
            "description": "SUPER 사용자가 생성한 테스트 템플릿 (비고 컬럼 포함)",
            "identifiers": ["테스트", "거래내역"],
            "columnSchema": {
                "columns": {
                    "date": {"index": 0, "header": "거래일자"},
                    "deposit": {"index": 1, "header": "입금액", "whenDeposit": "amount", "whenWithdrawal": "skip"},
                    "withdrawal": {"index": 2, "header": "출금액", "whenDeposit": "skip", "whenWithdrawal": "amount"},
                    "balance": {"index": 3, "header": "잔액"},
                    "memo": {"index": 4, "header": "비고"}
                },
                "parseRules": {}
            },
            "priority": 5,
            "isActive": True,
            "sampleFileKey": "",
            "sampleFileName": "",
            "sampleFileMimeType": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/trpc/template.create",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {super_token}"
            },
            json={"json": template_data}
        )
        
        print(f"Create template response: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        # Parse response
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {}).get("data", {}).get("json", {})
            
            # Verify template was created
            assert result.get("id"), f"Template creation failed - no ID returned: {result}"
            
            # Verify memo column is in the response
            column_schema = result.get("columnSchema", {})
            columns = column_schema.get("columns", {})
            
            assert "memo" in columns, f"memo column missing from created template: {columns.keys()}"
            print(f"✅ Template created successfully with memo column: {result.get('id')}")
            
            # Cleanup - delete the test template
            delete_response = requests.post(
                f"{BASE_URL}/api/trpc/template.delete",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {super_token}"
                },
                json={"json": {"id": result.get("id")}}
            )
            print(f"Cleanup delete response: {delete_response.status_code}")
        else:
            # If 500 error, check if it's expected (S3 not configured)
            if "S3" in response.text or "storage" in response.text.lower():
                pytest.skip("S3 storage not configured - skipping template creation test")
            else:
                pytest.fail(f"Template creation failed: {response.text}")


class TestRoleComparison:
    """Compare ADMIN and SUPER role capabilities"""
    
    def test_both_roles_can_access_templates(self):
        """Verify both ADMIN and SUPER can access template list"""
        results = {}
        
        for role, creds in [("ADMIN", ADMIN_CREDS), ("SUPER", SUPER_CREDS)]:
            # Login
            login_resp = requests.post(
                f"{BASE_URL}/api/trpc/user.login",
                headers={"Content-Type": "application/json"},
                json={"json": creds}
            )
            
            if login_resp.status_code != 200:
                results[role] = {"login": False, "templates": False}
                continue
            
            token = login_resp.json().get("result", {}).get("data", {}).get("json", {}).get("accessToken")
            
            # Access templates
            template_resp = requests.get(
                f"{BASE_URL}/api/trpc/template.list",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                params={"input": json.dumps({"json": {"includeInactive": True}})}
            )
            
            results[role] = {
                "login": True,
                "templates": template_resp.status_code == 200,
                "template_count": len(template_resp.json().get("result", {}).get("data", {}).get("json", [])) if template_resp.status_code == 200 else 0
            }
        
        print(f"Role comparison results: {json.dumps(results, indent=2)}")
        
        # Both should succeed
        assert results.get("ADMIN", {}).get("templates"), "ADMIN cannot access templates"
        assert results.get("SUPER", {}).get("templates"), "SUPER cannot access templates"
        
        print("✅ Both ADMIN and SUPER can access template management")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
