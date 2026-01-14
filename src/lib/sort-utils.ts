/**
 * Finding Sorting Utilities
 *
 * Story 6.5: 중요도 지정 - Priority Sorting (AC3)
 *
 * Helper functions for sorting Findings by various criteria:
 * - Priority (HIGH > MEDIUM > LOW > null)
 * - Severity (CRITICAL > WARNING > INFO)
 * - Creation date (newest first)
 * - Multi-criteria sorting with priority first
 */

// Finding interface (matching FindingCard and FindingList components)
export interface Finding {
  id: string;
  findingType: string;
  title: string;
  description: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  priority: "HIGH" | "MEDIUM" | "LOW" | null; // Story 6.5: 사용자 지정 중요도
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  transaction: {
    id: string;
    transactionDate: Date;
    depositAmount: string | null;
    withdrawalAmount: string | null;
    memo: string | null;
  } | null;
  relatedTransactionIds: string[];
  relatedCreditorNames: string | null;
}

/**
 * Priority 순서 매핑 (높을수록 우선순위 높음)
 */
const PRIORITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  null: 3, // priority가 없는 Finding은 가장 나중에
};

/**
 * Severity 순서 매핑 (높을수록 우선순위 높음)
 */
const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

/**
 * Finding을 priority > severity > createdAt 순으로 정렬
 *
 * Story 6.5 AC3: 중요도순 정렬
 * - 1차: priority (HIGH > MEDIUM > LOW > null)
 * - 2차: severity (CRITICAL > WARNING > INFO)
 * - 3차: createdAt (최신순)
 *
 * @param findings - 정렬할 Finding 배열
 * @returns 정렬된 Finding 배열 (원본 배열 변경하지 않음)
 */
export function sortFindingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    // 1. Priority 순 (HIGH > MEDIUM > LOW > null)
    const priorityA = PRIORITY_ORDER[a.priority ?? "null"] ?? 3;
    const priorityB = PRIORITY_ORDER[b.priority ?? "null"] ?? 3;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 2. Severity 순 (CRITICAL > WARNING > INFO)
    const severityA = SEVERITY_ORDER[a.severity] ?? 999;
    const severityB = SEVERITY_ORDER[b.severity] ?? 999;

    if (severityA !== severityB) {
      return severityA - severityB;
    }

    // 3. 생성일 순 (최신순)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Finding을 isResolved > priority > severity > createdAt 순으로 정렬
 *
 * 기존 정렬 로직에 priority를 추가:
 * - 1차: isResolved (미해결 먼저)
 * - 2차: priority (HIGH > MEDIUM > LOW > null)
 * - 3차: severity (CRITICAL > WARNING > INFO)
 * - 4차: createdAt (최신순)
 *
 * @param findings - 정렬할 Finding 배열
 * @returns 정렬된 Finding 배열 (원본 배열 변경하지 않음)
 */
export function sortFindingsByResolvedAndPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    // 1. 해결 여부 (미해결 먼저)
    if (a.isResolved !== b.isResolved) {
      return a.isResolved ? 1 : -1;
    }

    // 2. Priority 순 (HIGH > MEDIUM > LOW > null)
    const priorityA = PRIORITY_ORDER[a.priority ?? "null"] ?? 3;
    const priorityB = PRIORITY_ORDER[b.priority ?? "null"] ?? 3;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 3. Severity 순 (CRITICAL > WARNING > INFO)
    const severityA = SEVERITY_ORDER[a.severity] ?? 999;
    const severityB = SEVERITY_ORDER[b.severity] ?? 999;

    if (severityA !== severityB) {
      return severityA - severityB;
    }

    // 4. 생성일 순 (최신순)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
