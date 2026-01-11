/**
 * Vitest Setup File
 *
 * Story 4.1, CRITICAL-1 FIX: 테스트 환경 설정
 *
 * @testing-library/jest-dom 매처를 전역으로 사용할 수 있도록 설정합니다.
 */

import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 각 테스트 후 자동 정리
afterEach(() => {
  cleanup();
});

// Prisma 모킹
vi.mock("~/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    classificationJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    fileAnalysisResult: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
    case: {
      findUnique: vi.fn(),
    },
  },
}));

// tRPC 모킹
vi.mock("~/utils/api", () => ({
  api: {
    transaction: {
      classifyTransactions: {
        useMutation: vi.fn(),
      },
      getClassificationStatus: {
        useQuery: vi.fn(),
      },
    },
  },
}));
