/**
 * RBAC Helper Tests
 *
 * Story 4.5 HIGH #1: Role-Based Access Control
 */

import { describe, it, expect } from "vitest";
import {
  checkTransactionAccess,
  checkTransactionReadAccess,
  assertTransactionAccess,
  assertTransactionReadAccess,
} from "./rbac";
import { TRPCError } from "@trpc/server";

describe("RBAC Helper", () => {
  const baseParams = {
    userId: "user-1",
    caseLawyerId: "lawyer-1",
  };

  describe("checkTransactionAccess (Write Access)", () => {
    describe("ADMIN role", () => {
      it("should allow access to any transaction", () => {
        const result = checkTransactionAccess({
          ...baseParams,
          userRole: "ADMIN",
        });

        expect(result.allowed).toBe(true);
      });

      it("should allow access to own case", () => {
        const result = checkTransactionAccess({
          userId: "lawyer-1",
          caseLawyerId: "lawyer-1",
          userRole: "ADMIN",
        });

        expect(result.allowed).toBe(true);
      });
    });

    describe("LAWYER role", () => {
      it("should allow access to own case", () => {
        const result = checkTransactionAccess({
          userId: "lawyer-1",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });

        expect(result.allowed).toBe(true);
      });

      it("should deny access to other lawyer's case", () => {
        const result = checkTransactionAccess({
          userId: "lawyer-2",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("변호사는 자신의 사건");
      });
    });

    describe("PARALEGAL role", () => {
      it("should deny write access to own case", () => {
        const result = checkTransactionAccess({
          userId: "paralegal-1",
          caseLawyerId: "lawyer-1",
          userRole: "PARALEGAL",
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("읽기 전용");
      });

      it("should deny write access to any case", () => {
        const result = checkTransactionAccess({
          userId: "paralegal-1",
          caseLawyerId: "lawyer-2",
          userRole: "PARALEGAL",
        });

        expect(result.allowed).toBe(false);
      });
    });

    describe("SUPPORT role", () => {
      it("should deny write access", () => {
        const result = checkTransactionAccess({
          userId: "support-1",
          caseLawyerId: "lawyer-1",
          userRole: "SUPPORT",
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("읽기 전용");
      });
    });
  });

  describe("checkTransactionReadAccess (Read Access)", () => {
    describe("ADMIN role", () => {
      it("should allow read access to any transaction", () => {
        const result = checkTransactionReadAccess({
          ...baseParams,
          userRole: "ADMIN",
        });

        expect(result.allowed).toBe(true);
      });
    });

    describe("LAWYER role", () => {
      it("should allow read access to own case", () => {
        const result = checkTransactionReadAccess({
          userId: "lawyer-1",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });

        expect(result.allowed).toBe(true);
      });

      it("should deny read access to other lawyer's case", () => {
        const result = checkTransactionReadAccess({
          userId: "lawyer-2",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });

        expect(result.allowed).toBe(false);
      });
    });

    describe("PARALEGAL role", () => {
      it("should allow read access to any case (for support/documentation)", () => {
        const result = checkTransactionReadAccess({
          userId: "paralegal-1",
          caseLawyerId: "lawyer-1",
          userRole: "PARALEGAL",
        });

        expect(result.allowed).toBe(true);
      });

      it("should allow read access to other lawyer's case", () => {
        const result = checkTransactionReadAccess({
          userId: "paralegal-1",
          caseLawyerId: "lawyer-2",
          userRole: "PARALEGAL",
        });

        expect(result.allowed).toBe(true);
      });
    });

    describe("SUPPORT role", () => {
      it("should allow read access to any case", () => {
        const result = checkTransactionReadAccess({
          userId: "support-1",
          caseLawyerId: "lawyer-1",
          userRole: "SUPPORT",
        });

        expect(result.allowed).toBe(true);
      });
    });
  });

  describe("assertTransactionAccess", () => {
    it("should not throw when access is allowed", () => {
      expect(() => {
        assertTransactionAccess({
          userId: "lawyer-1",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });
      }).not.toThrow();
    });

    it("should throw FORBIDDEN when access is denied", () => {
      expect(() => {
        assertTransactionAccess({
          userId: "lawyer-2",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });
      }).toThrow(TRPCError);
    });

    it("should throw with correct error code", () => {
      try {
        assertTransactionAccess({
          userId: "lawyer-2",
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });
        fail("Expected TRPCError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("assertTransactionReadAccess", () => {
    it("should not throw when read access is allowed", () => {
      expect(() => {
        assertTransactionReadAccess({
          userId: "support-1",
          caseLawyerId: "lawyer-1",
          userRole: "SUPPORT",
        });
      }).not.toThrow();
    });

    it("should throw FORBIDDEN when read access is denied", () => {
      expect(() => {
        assertTransactionReadAccess({
          userId: "lawyer-2",  // Different lawyer
          caseLawyerId: "lawyer-1",
          userRole: "LAWYER",
        });
      }).toThrow(TRPCError);
    });
  });
});
