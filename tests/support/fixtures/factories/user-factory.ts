/**
 * User Factory
 *
 * Creates test users with automatic cleanup
 * Uses faker.js for generating realistic test data
 *
 * @see tests/support/fixtures/index.ts
 */

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export type UserOverrides = {
  email?: string;
  password?: string;
  name?: string;
  role?: 'LAWYER' | 'PARALEGAL' | 'ADMIN' | 'SUPPORT';
  isActive?: boolean;
};

export class UserFactory {
  private createdUsers: string[] = [];

  /**
   * Create a test user
   *
   * @param overrides - Override default faker values
   * @returns Created user object
   *
   * @example
   * ```ts
   * const user = await userFactory.createUser();
   * const admin = await userFactory.createUser({ role: 'ADMIN' });
   * const lawyer = await userFactory.createUser({
   *   email: 'lawyer@example.com',
   *   role: 'LAWYER',
   * });
   * ```
   */
  async createUser(overrides: UserOverrides = {}) {
    const password = overrides.password || 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      email: overrides.email || faker.internet.email().toLowerCase(),
      password: hashedPassword,
      name: overrides.name || faker.person.fullName(),
      role: overrides.role || 'PARALEGAL',
      isActive: overrides.isActive ?? true, // Default to active for tests
    };

    const user = await prisma.user.create({
      data: userData,
    });

    this.createdUsers.push(user.id);

    // Return plain password for login tests
    return {
      ...user,
      plainPassword: password,
    };
  }

  /**
   * Create multiple users
   *
   * @param count - Number of users to create
   * @param overrides - Override default faker values
   * @returns Array of created users
   *
   * @example
   * ```ts
   * const users = await userFactory.createUsers(5);
   * const lawyers = await userFactory.createUsers(3, { role: 'LAWYER' });
   * ```
   */
  async createUsers(count: number, overrides: UserOverrides = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createUser(overrides);
      users.push(user);
    }
    return users;
  }

  /**
   * Cleanup all created users
   *
   * Automatically called after each test
   * Uses cascade delete to clean up related data
   */
  async cleanup() {
    if (this.createdUsers.length === 0) {
      return;
    }

    // Delete all created users (cascade will handle related data)
    await prisma.user.deleteMany({
      where: {
        id: {
          in: this.createdUsers,
        },
      },
    });

    this.createdUsers = [];
  }
}
