/**
 * Example E2E Tests
 *
 * Demonstrates best practices for writing E2E tests with Playwright
 *
 * @see tests/README.md for comprehensive testing guide
 */

import { test, expect } from '../support/fixtures';

test.describe('Authentication Flow', () => {
  test('[P0] should load login page', async ({ page }) => {
    // GIVEN: User navigates to login page
    await page.goto('/login');

    // WHEN: Page loads
    // THEN: Display login form
    await expect(page.locator('h1')).toContainText('로그인');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('[P0] should login with valid credentials', async ({ page, userFactory }) => {
    // GIVEN: Create test user
    const user = await userFactory.createUser({
      email: 'test@example.com',
      role: 'LAWYER',
    });

    // WHEN: User logs in
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');

    // THEN: Redirect to dashboard and show user menu
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('[P1] should show error with invalid credentials', async ({ page }) => {
    // GIVEN: User navigates to login page
    await page.goto('/login');

    // WHEN: User enters invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // THEN: Show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      '이메일 또는 비밀번호가 올바르지 않습니다'
    );
  });
});

test.describe('Case Management', () => {
  test('[P0] should create new case', async ({ page, userFactory }) => {
    // GIVEN: Logged in lawyer user
    const user = await userFactory.createUser({ role: 'LAWYER' });
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // WHEN: User creates new case
    await page.click('[data-testid="create-case-button"]');
    await page.fill('[data-testid="case-number"]', '2023-1234-5678');
    await page.fill('[data-testid="debtor-name"]', '홍길동');
    await page.fill('[data-testid="court-name"]', '서울회생법원');
    await page.fill('[data-testid="filing-date"]', '2023-01-15');
    await page.click('[data-testid="save-case-button"]');

    // THEN: Case is created and visible in list
    await expect(page.locator('[data-testid="case-list"]')).toContainText('2023-1234-5678');
    await expect(page.locator('[data-testid="case-list"]')).toContainText('홍길동');
  });

  test('[P1] should filter cases by status', async ({ page, userFactory, caseFactory }) => {
    // GIVEN: Logged in user with multiple cases
    const user = await userFactory.createUser({ role: 'LAWYER' });
    await caseFactory.createCases(3, {
      lawyerId: user.id,
      status: 'IN_PROGRESS',
    });
    await caseFactory.createCases(2, {
      lawyerId: user.id,
      status: 'COMPLETED',
    });

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/cases/);

    // WHEN: User filters by "진행 중" status
    await page.click('[data-testid="status-filter"]');
    await page.click('text=진행 중');

    // THEN: Only show IN_PROGRESS cases
    const caseCount = await page.locator('[data-testid="case-item"]').count();
    expect(caseCount).toBe(3);
  });
});

test.describe('File Upload Flow', () => {
  test('[P0] should upload transaction file', async ({ page, userFactory, caseFactory }) => {
    // GIVEN: Logged in user with a case
    const user = await userFactory.createUser({ role: 'LAWYER' });
    const case_ = await caseFactory.createCase({ lawyerId: user.id });

    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');

    // Navigate to case detail
    await page.goto(`/cases/${case_.id}`);

    // WHEN: User uploads a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/sample-transactions.xlsx');

    // THEN: Show upload success
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-progress"]')).toHaveText(/100%/);
  });

  test('[P1] should show error for invalid file type', async ({ page, userFactory, caseFactory }) => {
    // GIVEN: Logged in user with a case
    const user = await userFactory.createUser({ role: 'LAWYER' });
    const case_ = await caseFactory.createCase({ lawyerId: user.id });

    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');

    await page.goto(`/cases/${case_.id}`);

    // WHEN: User uploads invalid file type
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/sample-document.txt');

    // THEN: Show error message
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText(
      '지원하지 않는 파일 형식입니다'
    );
  });
});

test.describe('Data Export', () => {
  test('[P1] should export transactions to Excel', async ({ page, userFactory, caseFactory, transactionFactory }) => {
    // GIVEN: Logged in user with case and transactions
    const user = await userFactory.createUser({ role: 'LAWYER' });
    const case_ = await caseFactory.createCase({ lawyerId: user.id });

    // Create document and transactions
    const document = await page.evaluate(async () => {
      // This would normally be done via API or file upload
      // For test purposes, we're assuming document exists
      return { id: 'test-document-id' };
    });

    await transactionFactory.createTransactions(10, {
      caseId: case_.id,
      documentId: document.id,
    });

    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.plainPassword);
    await page.click('button[type="submit"]');

    await page.goto(`/cases/${case_.id}`);

    // WHEN: User clicks export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-excel-button"]');
    const download = await downloadPromise;

    // THEN: File is downloaded
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe('RBAC Authorization', () => {
  test('[P0] should restrict admin pages to admin users only', async ({ page, userFactory }) => {
    // GIVEN: Regular lawyer user
    const lawyer = await userFactory.createUser({ role: 'LAWYER' });

    await page.goto('/login');
    await page.fill('input[type="email"]', lawyer.email);
    await page.fill('input[type="password"]', lawyer.plainPassword);
    await page.click('button[type="submit"]');

    // WHEN: Lawyer tries to access admin page
    await page.goto('/admin');

    // THEN: Redirect to unauthorized page
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      '접근 권한이 없습니다'
    );
  });

  test('[P0] should allow admin users to access admin pages', async ({ page, userFactory }) => {
    // GIVEN: Admin user
    const admin = await userFactory.createUser({ role: 'ADMIN' });

    await page.goto('/login');
    await page.fill('input[type="email"]', admin.email);
    await page.fill('input[type="password"]', admin.plainPassword);
    await page.click('button[type="submit"]');

    // WHEN: Admin navigates to admin page
    await page.goto('/admin');

    // THEN: Admin page loads successfully
    await expect(page.locator('h1')).toContainText('관리자 대시보드');
    await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
  });
});
