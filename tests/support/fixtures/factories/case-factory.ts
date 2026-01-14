/**
 * Case Factory
 *
 * Creates test cases (bankruptcy cases) with automatic cleanup
 * Uses faker.js for generating realistic test data
 *
 * @see tests/support/fixtures/index.ts
 */

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type CaseOverrides = {
  caseNumber?: string;
  debtorName?: string;
  courtName?: string;
  filingDate?: Date;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' | 'CLOSED';
  lawyerId?: string;
  isArchived?: boolean;
};

export class CaseFactory {
  private createdCases: string[] = [];

  /**
   * Create a test case
   *
   * @param overrides - Override default faker values
   * @returns Created case object
   *
   * @example
   * ```ts
   * const case = await caseFactory.createCase({ lawyerId: user.id });
   * const activeCase = await caseFactory.createCase({
   *   lawyerId: user.id,
   *   status: 'IN_PROGRESS',
   * });
   * ```
   */
  async createCase(overrides: CaseOverrides) {
    if (!overrides.lawyerId) {
      throw new Error('lawyerId is required to create a case');
    }

    const caseData = {
      caseNumber: overrides.caseNumber || this.generateCaseNumber(),
      debtorName: overrides.debtorName || faker.person.fullName(),
      courtName: overrides.courtName || this.generateCourtName(),
      filingDate: overrides.filingDate || faker.date.past({ years: 2 }),
      status: overrides.status || 'PENDING',
      lawyerId: overrides.lawyerId,
      isArchived: overrides.isArchived ?? false,
    };

    const case_ = await prisma.case.create({
      data: caseData,
    });

    this.createdCases.push(case_.id);
    return case_;
  }

  /**
   * Create multiple cases
   *
   * @param count - Number of cases to create
   * @param overrides - Override default faker values
   * @returns Array of created cases
   *
   * @example
   * ```ts
   * const cases = await caseFactory.createCases(5, { lawyerId: user.id });
   * const inProgressCases = await caseFactory.createCases(3, {
   *   lawyerId: user.id,
   *   status: 'IN_PROGRESS',
   * });
   * ```
   */
  async createCases(count: number, overrides: CaseOverrides) {
    const cases = [];
    for (let i = 0; i < count; i++) {
      const case_ = await this.createCase(overrides);
      cases.push(case_);
    }
    return cases;
  }

  /**
   * Generate a realistic Korean case number
   *
   * Format: 年度-단일번호-사건번호 (e.g., 2023-1234-1234)
   *
   * @returns Random case number string
   */
  private generateCaseNumber(): string {
    const year = faker.date.past({ years: 5 }).getFullYear();
    const courtNumber = faker.number.int({ min: 1000, max: 9999 });
    const caseNumber = faker.number.int({ min: 1000, max: 9999 });
    return `${year}-${courtNumber}-${caseNumber}`;
  }

  /**
   * Generate a realistic Korean court name
   *
   * @returns Random court name string
   */
  private generateCourtName(): string {
    const courts = [
      '서울회생법원',
      '서울파산법원',
      '부산회생법원',
      '인천회생법원',
      '대전회생법원',
      '광주회생법원',
      '대구회생법원',
    ];
    return faker.helpers.arrayElement(courts);
  }

  /**
   * Cleanup all created cases
   *
   * Automatically called after each test
   * Uses cascade delete to clean up related data (documents, transactions, findings)
   */
  async cleanup() {
    if (this.createdCases.length === 0) {
      return;
    }

    // Delete all created cases (cascade will handle related data)
    await prisma.case.deleteMany({
      where: {
        id: {
          in: this.createdCases,
        },
      },
    });

    this.createdCases = [];
  }
}
