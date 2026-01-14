# Test Suite Documentation

**Framework:** Playwright with TypeScript
**Project:** pharos-bmad (AI 기반 회생 파산 분석 시스템)

---

## Table of Contents

1. [Setup](#setup)
2. [Running Tests](#running-tests)
3. [Architecture](#architecture)
4. [Best Practices](#best-practices)
5. [Test Data Management](#test-data-management)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

---

## Setup

### Prerequisites

- Node.js 20.11.0 (see `.nvmrc`)
- PostgreSQL database (for test data)
- npm or yarn package manager

### Installation

1. **Install Playwright:**

   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Install faker for test data generation:**

   ```bash
   npm install -D @faker-js/faker
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and fill in required values
   ```

4. **Install browser binaries:**

   ```bash
   npx playwright install chromium firefox webkit
   ```

---

## Running Tests

### Basic Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests with Playwright Inspector
npm run test:e2e:debug

# View HTML test report
npm run test:e2e:report
```

### Running Specific Tests

```bash
# Run specific test file
npx playwright test example.spec.ts

# Run tests matching pattern
npx playwright test -g "should login"

# Run tests in specific project (browser)
npx playwright test --project=chromium
```

### Test Files

Tests are organized in the `tests/e2e/` directory:

```
tests/
├── e2e/                    # E2E test files
│   ├── example.spec.ts     # Example tests
│   ├── auth/               # Authentication tests
│   ├── cases/              # Case management tests
│   └── uploads/            # File upload tests
└── support/                # Test infrastructure
    ├── fixtures/           # Custom fixtures
    └── helpers/            # Utility functions
```

---

## Architecture

### Fixture Pattern

This test suite uses Playwright's **fixture extension pattern** for clean, maintainable tests:

```typescript
import { test, expect } from '../support/fixtures';

test('should create user and login', async ({ page, userFactory }) => {
  const user = await userFactory.createUser();
  // ... test logic
});
```

**Benefits:**
- ✅ Automatic cleanup after each test
- ✅ Shared test data generation logic
- ✅ Consistent test patterns across the suite
- ✅ Type-safe with TypeScript

### Available Fixtures

| Fixture | Description | Example |
|---------|-------------|---------|
| `page` | Playwright page object | `await page.goto('/')` |
| `userFactory` | Create test users | `await userFactory.createUser()` |
| `caseFactory` | Create test cases | `await caseFactory.createCase({ lawyerId })` |
| `transactionFactory` | Create test transactions | `await transactionFactory.createTransactions(10)` |

All factories have **automatic cleanup** - no manual teardown needed!

---

## Best Practices

### 1. Selector Strategy

**Always use `data-testid` attributes** for UI elements:

```tsx
// ✅ GOOD - data-testid
<input data-testid="email-input" />
await page.fill('[data-testid="email-input"]', 'test@example.com');

// ❌ BAD - CSS selectors (brittle)
await page.fill('.MuiInput-root input', 'test@example.com');

// ❌ BAD - XPath (brittle)
await page.fill('//input[@type="email"]', 'test@example.com');
```

### 2. Test Isolation

Each test should be **completely independent**:

```typescript
test('should create case', async ({ page, userFactory, caseFactory }) => {
  // Create fresh user for this test
  const user = await userFactory.createUser();

  // Create fresh case for this test
  const case_ = await caseFactory.createCase({ lawyerId: user.id });

  // Test logic...
  // ✅ Cleanup happens automatically
});
```

### 3. Deterministic Tests

Avoid non-deterministic behavior:

```typescript
// ✅ GOOD - Explicit waiting
await page.click('[data-testid="submit-button"]');
await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

// ❌ BAD - Hard wait
await page.click('[data-testid="submit-button"]');
await page.waitForTimeout(3000); // Don't do this!
```

### 4. Given-When-Then Pattern

Structure tests clearly:

```typescript
test('should filter transactions by date', async ({ page }) => {
  // GIVEN: User is on transaction list page
  await page.goto('/cases/123/transactions');

  // WHEN: User applies date filter
  await page.fill('[data-testid="date-from"]', '2023-01-01');
  await page.fill('[data-testid="date-to"]', '2023-12-31');
  await page.click('[data-testid="apply-filter"]');

  // THEN: Only transactions in date range are shown
  const transactions = await page.locator('[data-testid="transaction-item"]').all();
  expect(transactions.length).toBeGreaterThan(0);
});
```

### 5. Priority Tags

Tag tests by priority:

```typescript
test('[P0] should login with valid credentials', async ({ page }) => {
  // Critical test - blocks release if failed
});

test('[P1] should show user profile', async ({ page }) => {
  // High priority - important feature
});

test('[P2] should display nice hover animation', async ({ page }) => {
  // Medium priority - cosmetic enhancement
});
```

---

## Test Data Management

### Data Factories

Use factories to generate test data:

```typescript
// Create single user
const user = await userFactory.createUser({
  email: 'lawyer@example.com',
  role: 'LAWYER',
  isActive: true,
});

// Create multiple users
const users = await userFactory.createUsers(5, { role: 'PARALEGAL' });

// Create case with specific data
const case_ = await caseFactory.createCase({
  lawyerId: user.id,
  caseNumber: '2023-1234-5678',
  debtorName: '홍길동',
  status: 'IN_PROGRESS',
});

// Create transaction chain (related transactions)
const transactions = await transactionFactory.createTransactionChain({
  caseId: case_.id,
  documentId: document.id,
  count: 10,
});
```

### Factory Options

| Factory | Override Options |
|---------|-----------------|
| `UserFactory` | `email`, `password`, `name`, `role`, `isActive` |
| `CaseFactory` | `caseNumber`, `debtorName`, `courtName`, `filingDate`, `status`, `lawyerId` |
| `TransactionFactory` | `transactionDate`, `depositAmount`, `withdrawalAmount`, `memo`, `category`, `confidenceScore` |

### Auto-Cleanup

All factories automatically clean up created data after each test:

```typescript
test('example', async ({ userFactory }) => {
  const user1 = await userFactory.createUser();
  const user2 = await userFactory.createUser();

  // Test logic...

  // ✅ Automatic cleanup happens here
  // No need to manually delete users
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20.11.0

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
          BASE_URL: http://localhost:3000

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/
          retention-days: 30
```

### Environment Variables

Set these in your CI/CD pipeline:

```bash
CI=true
BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:5432/testdb
JWT_SECRET=test-jwt-secret
```

---

## Troubleshooting

### Common Issues

#### Issue: Tests timeout on CI

**Solution:** Increase timeout in `playwright.config.ts`:

```typescript
timeout: 120 * 1000, // 120 seconds
```

#### Issue: Flaky tests (sometimes pass, sometimes fail)

**Solution:** Add explicit waits instead of hard timeouts:

```typescript
// ❌ BAD
await page.waitForTimeout(5000);

// ✅ GOOD
await expect(page.locator('[data-testid="loading"]')).toBeHidden();
```

#### Issue: "Database connection failed"

**Solution:** Ensure test database is configured:

```bash
# .env.test
DATABASE_URL="postgresql://user:password@localhost:5432/testdb"
```

#### Issue: "Cannot find module '@faker-js/faker'"

**Solution:** Install missing dependency:

```bash
npm install -D @faker-js/faker
```

### Debugging Tips

1. **Run tests in headed mode** to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```

2. **Use Playwright Inspector** for step-by-step debugging:
   ```bash
   npm run test:e2e:debug
   ```

3. **View trace files** after test failures:
   ```bash
   npx playwright show-trace test-results/trace.zip
   ```

4. **Take screenshots** manually:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

---

## Knowledge Base References

This test suite follows best practices from:

- **Fixture Architecture Pattern:** Pure functions → Fixtures → mergeTests composition
- **Data Factories:** Faker-based with auto-cleanup
- **Network-First Testing:** Deterministic waits, HAR capture
- **Test Quality:** Deterministic, isolated, explicit assertions

For advanced patterns and techniques, refer to:
- `_bmad/bmm/testarch/tea-index.csv` - Complete test engineering knowledge base

---

## Need Help?

- **Playwright Docs:** https://playwright.dev
- **Faker Docs:** https://fakerjs.dev
- **Project Issues:** Check `test-results/html/report.html` after test runs
