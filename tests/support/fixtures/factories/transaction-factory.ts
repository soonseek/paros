/**
 * Transaction Factory
 *
 * Creates test transactions with automatic cleanup
 * Uses faker.js for generating realistic test data
 *
 * @see tests/support/fixtures/index.ts
 */

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type TransactionOverrides = {
  caseId?: string;
  documentId?: string;
  transactionDate?: Date;
  depositAmount?: number;
  withdrawalAmount?: number;
  balance?: number;
  memo?: string;
  category?: string;
  subcategory?: string;
  confidenceScore?: number;
  isManuallyClassified?: boolean;
  aiClassificationStatus?: string;
};

export class TransactionFactory {
  private createdTransactions: string[] = [];

  /**
   * Create a test transaction
   *
   * @param overrides - Override default faker values
   * @returns Created transaction object
   *
   * @example
   * ```ts
   * const transaction = await transactionFactory.createTransaction({
   *   caseId: case.id,
   *   documentId: document.id,
   * });
   * ```
   */
  async createTransaction(overrides: TransactionOverrides) {
    if (!overrides.caseId || !overrides.documentId) {
      throw new Error('caseId and documentId are required to create a transaction');
    }

    // Generate random transaction type (deposit or withdrawal)
    const isDeposit = faker.datatype.boolean();
    const amount = faker.number.int({ min: 10000, max: 100000000 });

    const transactionData = {
      caseId: overrides.caseId,
      documentId: overrides.documentId,
      transactionDate: overrides.transactionDate || faker.date.past({ years: 3 }),
      depositAmount: overrides.depositAmount ?? (isDeposit ? amount : null),
      withdrawalAmount: overrides.withdrawalAmount ?? (!isDeposit ? amount : null),
      balance: overrides.balance,
      memo: overrides.memo || faker.helpers.arrayElement([
        '이체',
        '입금',
        '출금',
        '수수료',
        '이자',
        '대출 상환',
        '배당금',
      ]),
      category: overrides.category,
      subcategory: overrides.subcategory,
      confidenceScore: overrides.confidenceScore ?? faker.number.float({ min: 0.7, max: 1.0, fractionDigits: 2 }),
      isManuallyClassified: overrides.isManuallyClassified ?? false,
      aiClassificationStatus: overrides.aiClassificationStatus ?? 'pending',
    };

    const transaction = await prisma.transaction.create({
      data: transactionData,
    });

    this.createdTransactions.push(transaction.id);
    return transaction;
  }

  /**
   * Create multiple transactions
   *
   * @param count - Number of transactions to create
   * @param overrides - Override default faker values
   * @returns Array of created transactions
   *
   * @example
   * ```ts
   * const transactions = await transactionFactory.createTransactions(10, {
   *   caseId: case.id,
   *   documentId: document.id,
   * });
   * ```
   */
  async createTransactions(count: number, overrides: TransactionOverrides) {
    const transactions = [];
    for (let i = 0; i < count; i++) {
      const transaction = await this.createTransaction(overrides);
      transactions.push(transaction);
    }
    return transactions;
  }

  /**
   * Create a transaction chain (related transactions for fund flow testing)
   *
   * @param caseId - Case ID
   * @param documentId - Document ID
   * @param count - Number of transactions in chain
   * @returns Array of related transactions
   *
   * @example
   * ```ts
   * const chain = await transactionFactory.createTransactionChain({
   *   caseId: case.id,
   *   documentId: document.id,
   *   count: 5,
   * });
   * ```
   */
  async createTransactionChain({
    caseId,
    documentId,
    count = 5,
  }: {
    caseId: string;
    documentId: string;
    count?: number;
  }) {
    const transactions = [];
    let currentDate = faker.date.past({ years: 3 });
    let runningBalance = faker.number.int({ min: 1000000, max: 10000000 });

    for (let i = 0; i < count; i++) {
      const isDeposit = faker.datatype.boolean();
      const amount = faker.number.int({ min: 10000, max: 1000000 });

      if (isDeposit) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }

      const transaction = await this.createTransaction({
        caseId,
        documentId,
        transactionDate: new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000), // Daily intervals
        depositAmount: isDeposit ? amount : null,
        withdrawalAmount: !isDeposit ? amount : null,
        balance: runningBalance,
      });

      transactions.push(transaction);
    }

    return transactions;
  }

  /**
   * Cleanup all created transactions
   *
   * Automatically called after each test
   */
  async cleanup() {
    if (this.createdTransactions.length === 0) {
      return;
    }

    // Delete all created transactions
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: this.createdTransactions,
        },
      },
    });

    this.createdTransactions = [];
  }
}
