"""
Backend tests for new template management features:
1. template.exportAll - Export all templates as CSV-friendly data
2. template.bulkImport - Import templates from CSV data
3. template.deleteAll - Delete all templates (reset)
"""

import pytest
import requests
import json
import os

# Base URL from environment - Next.js app with tRPC
BASE_URL = os.environ.get('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns valid token"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": {"email": "admin@test.com", "password": "test1234"}}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "result" in data
        assert "data" in data["result"]
        result = data["result"]["data"]["json"]
        assert result["success"] is True
        assert "accessToken" in result
        assert result["user"]["role"] == "ADMIN"
        print(f"✓ Admin login successful, role: {result['user']['role']}")
        return result["accessToken"]


class TestTemplateExportAll:
    """Tests for template.exportAll endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": {"email": "admin@test.com", "password": "test1234"}}
        )
        if response.status_code != 200:
            pytest.skip("Auth failed")
        data = response.json()
        return data["result"]["data"]["json"]["accessToken"]
    
    def test_export_all_returns_data(self, auth_token):
        """Test exportAll returns template data array"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.exportAll?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        data = response.json()
        # tRPC returns array of results for batch queries
        assert isinstance(data, list) or "result" in data
        
        if isinstance(data, list):
            result = data[0]["result"]["data"]["json"]
        else:
            result = data["result"]["data"]["json"]
        
        # Should be a list (possibly empty)
        assert isinstance(result, list), "Export should return an array"
        print(f"✓ exportAll returned {len(result)} templates")
        
        # If there are templates, verify structure
        if len(result) > 0:
            template = result[0]
            assert "name" in template, "Template should have name"
            assert "description" in template, "Template should have description"
            assert "columnSchema" in template, "Template should have columnSchema"
            assert "identifiers" in template, "Template should have identifiers"
            print(f"✓ Template structure verified: {template['name']}")
        
        return result


class TestTemplateBulkImport:
    """Tests for template.bulkImport endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": {"email": "admin@test.com", "password": "test1234"}}
        )
        if response.status_code != 200:
            pytest.skip("Auth failed")
        data = response.json()
        return data["result"]["data"]["json"]["accessToken"]
    
    def test_bulk_import_creates_templates(self, auth_token):
        """Test bulkImport creates templates from CSV data"""
        # Test template data in CSV-like format
        test_templates = [
            {
                "name": "TEST_BulkImport_Template1",
                "bankName": "테스트은행",
                "description": "Bulk import test template 1 for automated testing",
                "identifiers": "테스트은행|거래내역",
                "columnSchema": '{"columns":{"date":{"index":0,"header":"거래일"},"deposit":{"index":1,"header":"입금"},"withdrawal":{"index":2,"header":"출금"},"balance":{"index":3,"header":"잔액"}},"parseRules":{}}',
                "priority": 0,
                "isActive": True
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/trpc/template.bulkImport",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json={"json": {"templates": test_templates}}
        )
        
        assert response.status_code == 200, f"Bulk import failed: {response.text}"
        
        data = response.json()
        result = data["result"]["data"]["json"]
        
        assert "count" in result, "Response should include count"
        assert result["count"] >= 1, f"Should create at least 1 template, got {result['count']}"
        print(f"✓ bulkImport created {result['count']} templates")
        
        # Clean up - delete the test template
        # First get the template list to find our test template
        list_response = requests.get(
            f"{BASE_URL}/api/trpc/template.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22includeInactive%22%3Atrue%7D%7D%7D",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        
        if list_response.status_code == 200:
            list_data = list_response.json()
            templates = list_data[0]["result"]["data"]["json"] if isinstance(list_data, list) else list_data["result"]["data"]["json"]
            for t in templates:
                if t["name"].startswith("TEST_BulkImport"):
                    requests.post(
                        f"{BASE_URL}/api/trpc/template.delete",
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {auth_token}"
                        },
                        json={"json": {"id": t["id"]}}
                    )
                    print(f"✓ Cleaned up test template: {t['name']}")


class TestTemplateDeleteAll:
    """Tests for template.deleteAll endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": {"email": "admin@test.com", "password": "test1234"}}
        )
        if response.status_code != 200:
            pytest.skip("Auth failed")
        data = response.json()
        return data["result"]["data"]["json"]["accessToken"]
    
    def test_delete_all_returns_count(self, auth_token):
        """Test deleteAll endpoint returns deleted count"""
        # First, create a test template to ensure there's something to delete
        test_template = {
            "name": "TEST_DeleteAll_Template",
            "bankName": "삭제테스트",
            "description": "Template to be deleted by deleteAll test",
            "identifiers": "삭제테스트",
            "columnSchema": '{"columns":{},"parseRules":{}}',
            "priority": 0,
            "isActive": True
        }
        
        # Create test template
        create_response = requests.post(
            f"{BASE_URL}/api/trpc/template.bulkImport",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json={"json": {"templates": [test_template]}}
        )
        
        if create_response.status_code == 200:
            print("✓ Created test template for deleteAll test")
        
        # Call deleteAll
        response = requests.post(
            f"{BASE_URL}/api/trpc/template.deleteAll",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json={"json": {}}
        )
        
        assert response.status_code == 200, f"deleteAll failed: {response.text}"
        
        data = response.json()
        result = data["result"]["data"]["json"]
        
        assert "count" in result, "Response should include count"
        assert isinstance(result["count"], int), "Count should be an integer"
        print(f"✓ deleteAll deleted {result['count']} templates")
        
        # Verify templates are deleted
        list_response = requests.get(
            f"{BASE_URL}/api/trpc/template.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22includeInactive%22%3Atrue%7D%7D%7D",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        
        if list_response.status_code == 200:
            list_data = list_response.json()
            templates = list_data[0]["result"]["data"]["json"] if isinstance(list_data, list) else list_data["result"]["data"]["json"]
            assert len(templates) == 0, f"After deleteAll, should have 0 templates, got {len(templates)}"
            print("✓ Verified all templates were deleted")


class TestTemplateManagementUI:
    """Tests for template management page UI data-testid elements"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/trpc/user.login",
            headers={"Content-Type": "application/json"},
            json={"json": {"email": "admin@test.com", "password": "test1234"}}
        )
        if response.status_code != 200:
            pytest.skip("Auth failed")
        data = response.json()
        return data["result"]["data"]["json"]["accessToken"]
    
    def test_template_list_api(self, auth_token):
        """Test template list API works"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22includeInactive%22%3Atrue%7D%7D%7D",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        assert response.status_code == 200, f"Template list failed: {response.text}"
        print("✓ template.list API works")
    
    def test_template_stats_api(self, auth_token):
        """Test template stats API works"""
        response = requests.get(
            f"{BASE_URL}/api/trpc/template.getStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D%7D",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        assert response.status_code == 200, f"Template stats failed: {response.text}"
        print("✓ template.getStats API works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
