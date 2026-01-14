/**
 * Test Fixtures
 *
 * Custom fixtures with auto-cleanup pattern
 * Extends Playwright's base test with domain-specific fixtures
 *
 * @see https://playwright.dev/docs/test-fixtures
 * @see tests/support/fixtures/factories/ for data factories
 */

import { test as base } from '@playwright/test';
import { UserFactory } from './factories/user-factory';
import { CaseFactory } from './factories/case-factory';
import { TransactionFactory } from './factories/transaction-factory';

/**
 * Custom test fixtures
 *
 * Each factory has automatic cleanup after the test completes
 */
export type TestFixtures = {
  userFactory: UserFactory;
  caseFactory: CaseFactory;
  transactionFactory: TransactionFactory;
};

/**
 * Extended test object with custom fixtures
 *
 * Usage:
 * ```ts
 * import { test, expect } from '../support/fixtures';
 *
 * test('should create user and login', async ({ page, userFactory }) => {
 *   const user = await userFactory.createUser();
 *   // ... test logic
 * });
 * ```
 */
export const test = base.extend<TestFixtures>({
  // User factory fixture
  userFactory: async ({}, use) => {
    const factory = new UserFactory();
    await use(factory);
    // Auto-cleanup after test
    await factory.cleanup();
  },

  // Case factory fixture
  caseFactory: async ({}, use) => {
    const factory = new CaseFactory();
    await use(factory);
    // Auto-cleanup after test
    await factory.cleanup();
  },

  // Transaction factory fixture
  transactionFactory: async ({}, use) => {
    const factory = new TransactionFactory();
    await use(factory);
    // Auto-cleanup after test
    await factory.cleanup();
  },
});

// Re-export expect for convenience
export { expect } from '@playwright/test';
