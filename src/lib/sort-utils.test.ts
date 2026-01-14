/**
 * Sorting Utilities Tests
 *
 * Story 6.5: 중요도 지정 - Priority Sorting Tests
 */

import { describe, it, expect } from "vitest";
import { sortFindingsByPriority, sortFindingsByResolvedAndPriority, type Finding } from "./sort-utils";

describe("sortFindingsByPriority", () => {
  const mockFindings: Finding[] = [
    {
      id: "1",
      findingType: "TEST",
      title: "Low Priority Finding",
      description: null,
      severity: "CRITICAL",
      priority: "LOW",
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-01"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
    {
      id: "2",
      findingType: "TEST",
      title: "High Priority Finding",
      description: null,
      severity: "INFO",
      priority: "HIGH",
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-02"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
    {
      id: "3",
      findingType: "TEST",
      title: "Medium Priority Finding",
      description: null,
      severity: "WARNING",
      priority: "MEDIUM",
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-03"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
    {
      id: "4",
      findingType: "TEST",
      title: "No Priority Finding",
      description: null,
      severity: "CRITICAL",
      priority: null,
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-04"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
  ];

  it("priority 순으로 정렬 (HIGH > MEDIUM > LOW > null)", () => {
    const sorted = sortFindingsByPriority(mockFindings);

    expect(sorted[0].priority).toBe("HIGH");
    expect(sorted[1].priority).toBe("MEDIUM");
    expect(sorted[2].priority).toBe("LOW");
    expect(sorted[3].priority).toBe(null);
  });

  it("동일한 priority인 경우 severity 순으로 정렬 (CRITICAL > WARNING > INFO)", () => {
    const findings: Finding[] = [
      {
        id: "1",
        findingType: "TEST",
        title: "Low Priority INFO",
        description: null,
        severity: "INFO",
        priority: "LOW",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-01"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
      {
        id: "2",
        findingType: "TEST",
        title: "Low Priority CRITICAL",
        description: null,
        severity: "CRITICAL",
        priority: "LOW",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-02"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
      {
        id: "3",
        findingType: "TEST",
        title: "Low Priority WARNING",
        description: null,
        severity: "WARNING",
        priority: "LOW",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-03"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
    ];

    const sorted = sortFindingsByPriority(findings);

    expect(sorted[0].severity).toBe("CRITICAL");
    expect(sorted[1].severity).toBe("WARNING");
    expect(sorted[2].severity).toBe("INFO");
  });

  it("동일한 priority와 severity인 경우 최신순으로 정렬", () => {
    const findings: Finding[] = [
      {
        id: "1",
        findingType: "TEST",
        title: "Old Finding",
        description: null,
        severity: "CRITICAL",
        priority: "HIGH",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-01"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
      {
        id: "2",
        findingType: "TEST",
        title: "New Finding",
        description: null,
        severity: "CRITICAL",
        priority: "HIGH",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-03"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
      {
        id: "3",
        findingType: "TEST",
        title: "Middle Finding",
        description: null,
        severity: "CRITICAL",
        priority: "HIGH",
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date("2024-01-02"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
    ];

    const sorted = sortFindingsByPriority(findings);

    expect(sorted[0].id).toBe("2"); // Newest
    expect(sorted[1].id).toBe("3"); // Middle
    expect(sorted[2].id).toBe("1"); // Oldest
  });

  it("원본 배열을 변경하지 않음 (immutability)", () => {
    const original = [...mockFindings];
    sortFindingsByPriority(mockFindings);

    expect(mockFindings).toEqual(original);
  });
});

describe("sortFindingsByResolvedAndPriority", () => {
  const mockFindings: Finding[] = [
    {
      id: "1",
      findingType: "TEST",
      title: "Resolved High Priority",
      description: null,
      severity: "CRITICAL",
      priority: "HIGH",
      isResolved: true,
      resolvedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
    {
      id: "2",
      findingType: "TEST",
      title: "Unresolved Low Priority",
      description: null,
      severity: "INFO",
      priority: "LOW",
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-02"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
    {
      id: "3",
      findingType: "TEST",
      title: "Unresolved High Priority",
      description: null,
      severity: "WARNING",
      priority: "HIGH",
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date("2024-01-03"),
      transaction: null,
      relatedTransactionIds: [],
      relatedCreditorNames: null,
    },
  ];

  it("미해결 Finding을 먼저 표시", () => {
    const sorted = sortFindingsByResolvedAndPriority(mockFindings);

    expect(sorted[0].isResolved).toBe(false);
    expect(sorted[1].isResolved).toBe(false);
    expect(sorted[2].isResolved).toBe(true);
  });

  it("미해결 Finding 내에서 priority 순으로 정렬", () => {
    const sorted = sortFindingsByResolvedAndPriority(mockFindings);

    // 첫 번째는 미해결 HIGH
    expect(sorted[0].isResolved).toBe(false);
    expect(sorted[0].priority).toBe("HIGH");

    // 두 번째는 미해결 LOW
    expect(sorted[1].isResolved).toBe(false);
    expect(sorted[1].priority).toBe("LOW");
  });

  it("해결된 Finding 내에서도 priority 순으로 정렬", () => {
    const findings: Finding[] = [
      {
        id: "1",
        findingType: "TEST",
        title: "Resolved Low",
        description: null,
        severity: "INFO",
        priority: "LOW",
        isResolved: true,
        resolvedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
      {
        id: "2",
        findingType: "TEST",
        title: "Resolved High",
        description: null,
        severity: "CRITICAL",
        priority: "HIGH",
        isResolved: true,
        resolvedAt: new Date("2024-01-02"),
        createdAt: new Date("2024-01-02"),
        transaction: null,
        relatedTransactionIds: [],
        relatedCreditorNames: null,
      },
    ];

    const sorted = sortFindingsByResolvedAndPriority(findings);

    expect(sorted[0].priority).toBe("HIGH");
    expect(sorted[1].priority).toBe("LOW");
  });

  it("원본 배열을 변경하지 않음 (immutability)", () => {
    const original = [...mockFindings];
    sortFindingsByResolvedAndPriority(mockFindings);

    expect(mockFindings).toEqual(original);
  });
});
